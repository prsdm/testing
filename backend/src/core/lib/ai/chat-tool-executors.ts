import { Buffer } from "node:buffer";
import type { ToolExecutionOptions } from "ai";
import { withChatLatencySpan } from "@/core/lib/ai/chat-latency";
import type {
  ChatWorkflowInput,
  ConnectorWorkflowToolDescriptor,
  McpWorkflowToolDescriptor,
} from "@/core/lib/ai/chat-workflow-types";
import { executeIdempotentTool } from "@/core/lib/ai/execute-idempotent-tool";
import { generateOpenAiImage } from "@/core/lib/ai/openai-images";
import {
  type ImportLibraryToSandboxToolInput,
  importLibraryToSandboxSuccessContextForLlm,
  normalizeImportLibraryToSandboxInput,
} from "@/core/lib/ai/tools/import-library-to-sandbox";
import {
  formatKnowledgeBaseListForLlm,
  resolveKnowledgeBaseForSearch,
} from "@/core/lib/ai/tools/knowledge-base-scope";
import { peopleSearch } from "@/core/lib/ai/tools/people-search";
import {
  isFailedSaveToLibraryResult,
  type ListLibraryToolInput,
  listLibraryInputSchema,
  normalizeSaveToLibraryInput,
  SAVE_TO_LIBRARY_RETRY_BLOCKED_MESSAGE,
  type SaveToLibraryToolInput,
  saveToLibrarySuccessContextForLlm,
} from "@/core/lib/ai/tools/save-to-library";
import {
  type TodoWriteToolInput,
  todoWriteInputSchema,
} from "@/core/lib/ai/tools/todo-write";
import { webSearch } from "@/core/lib/ai/tools/web-search";
import { isRoomChat } from "@/core/lib/chat/chat-access";
import { executeConnectorTool } from "@/core/lib/connectors/execute-connector-tool";
import {
  listLibraryFiles,
  listLibraryFilesForChannelChat,
} from "@/core/lib/db/library-queries";
import {
  getChatById,
  getCompletedToolExecutionsForWorkflowRun,
  toTenantUserId,
  withTenantId,
} from "@/core/lib/db/queries";
import {
  listKnowledgeBaseSources,
  listKnowledgeBasesForUser,
} from "@/core/lib/knowledge-bases/knowledge-base-queries";
import { buildKnowledgeBaseSearchToolOutput } from "@/core/lib/knowledge-bases/knowledge-base-search-output";
import { runKnowledgeBaseSearchForChat } from "@/core/lib/knowledge-bases/run-knowledge-base-search";
import { getReadableLibraryFile } from "@/core/lib/library/library-file-access";
import {
  readLibraryFileBytes,
  toLibraryFileResponse,
  writeLibraryFile,
} from "@/core/lib/library/library-storage";
import { importLibraryFileToSandbox } from "@/core/lib/sandbox/import-library-file-to-sandbox";
import { readSandboxSessionFile } from "@/core/lib/sandbox/read-session-file";
import {
  runSandboxExec,
  sandboxScriptId,
} from "@/core/lib/sandbox/run-sandbox-exec";
import type { SharedCitationContext } from "@/core/lib/search/citation-context";
import {
  isUserRejectedApprovalRetry,
  isWriteToolName,
  USER_REJECTED_APPROVAL_RETRY_REASON,
} from "@/shared/ai/tool-approvals";
import {
  type CreateChartToolInput,
  normalizeCreateChartInput,
} from "@/shared/ai/tools/create-chart";
import {
  assertGeneratedImageWithinLibraryLimit,
  GENERATE_IMAGE_RETRY_BLOCKED_MESSAGE,
  type GenerateImageToolInput,
  imageFileNameFromPrompt,
  isFailedGenerateImageResult,
  normalizeGenerateImageInput,
  toGenerateImageModelText,
} from "@/shared/ai/tools/generate-image";
import {
  normalizeSandboxExecInput,
  type SandboxExecToolInput,
  toSandboxExecModelText,
} from "@/shared/ai/tools/sandbox-exec";
import { normalizeTodoItems } from "@/shared/chat/todo-types";
import { KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG } from "@/shared/knowledge-bases/knowledge-base-search-ui";
import {
  inferSandboxWorkSkillId,
  isWorkSkillId,
} from "@/shared/sandbox/work-skill-catalog";

export type ChatToolContext = {
  input: ChatWorkflowInput;
  workflowRunId: string;
  connector?: ConnectorWorkflowToolDescriptor;
  mcp?: McpWorkflowToolDescriptor;
  citationContext: SharedCitationContext;
};

export function todoWriteChatTool(
  input: TodoWriteToolInput,
  _options: ToolExecutionOptions<ChatToolContext>
) {
  return {
    todos: normalizeTodoItems(todoWriteInputSchema.parse(input).todos),
  };
}

export function createChartChatTool(
  input: CreateChartToolInput,
  _options: ToolExecutionOptions<ChatToolContext>
) {
  const normalized = normalizeCreateChartInput(input);
  return "error" in normalized
    ? { contextForLlm: normalized.error, error: normalized.error }
    : {
        ...normalized,
        contextForLlm: `Chart created: "${normalized.title}" (${normalized.chartType}).`,
      };
}

export async function listLibraryChatTool(
  input: ListLibraryToolInput,
  options: ToolExecutionOptions<ChatToolContext>
) {
  const context = options.context.input;
  const parsed = listLibraryInputSchema.parse(input);
  return await withChatLatencySpan(
    "chat.tool.execute",
    { "chat.tool.kind": "list-library", "chat.tool.mutating": false },
    async () => {
      const limit = parsed.limit ?? 20;
      const rows = await withTenantId(context.tenantId, async () => {
        const chat = await getChatById({ id: context.chatId });
        if (chat && isRoomChat(chat)) {
          return listLibraryFilesForChannelChat({
            chatId: context.chatId,
            limit,
            tenantId: context.tenantId,
          });
        }
        return listLibraryFiles({
          limit,
          tenantId: context.tenantId,
          userId: toTenantUserId(context.authUser.id),
        });
      });
      const files = rows.map(toLibraryFileResponse);
      return {
        contextForLlm:
          files.length === 0
            ? "No deliverable files in this conversation yet."
            : files
                .map(
                  (file) =>
                    `- libraryFileId ${file.id} | ${file.name} (${file.contentType}, ${file.sizeBytes} bytes)`
                )
                .join("\n"),
        files,
      };
    }
  );
}

export async function generateImageChatTool(
  input: GenerateImageToolInput,
  options: ToolExecutionOptions<ChatToolContext>
) {
  const context = options.context.input;
  const normalized = normalizeGenerateImageInput(input);
  if ("error" in normalized) {
    return { contextForLlm: normalized.contextForLlm, error: normalized.error };
  }

  const apiKey = context.llmKeys.openai?.trim();
  if (!apiKey) {
    const message =
      "Image generation requires an OpenAI API key configured for this workspace.";
    return { contextForLlm: message, error: message };
  }

  const priorFailed = await withTenantId(context.tenantId, async () => {
    const executions = await getCompletedToolExecutionsForWorkflowRun({
      workflowRunId: options.context.workflowRunId,
    });
    return executions.some(
      (entry) =>
        entry.toolName === "generateImage" &&
        entry.toolCallId !== options.toolCallId &&
        (Boolean(entry.error?.trim()) ||
          isFailedGenerateImageResult(entry.result))
    );
  });
  if (priorFailed) {
    return {
      contextForLlm: GENERATE_IMAGE_RETRY_BLOCKED_MESSAGE,
      error: GENERATE_IMAGE_RETRY_BLOCKED_MESSAGE,
    };
  }

  return await withChatLatencySpan(
    "chat.tool.execute",
    { "chat.tool.kind": "generate-image", "chat.tool.mutating": true },
    async () =>
      await executeIdempotentTool({
        execute: async () => {
          const generated = await generateOpenAiImage({
            apiKey,
            prompt: normalized.prompt,
            size: normalized.size,
          });
          if ("error" in generated) {
            return {
              contextForLlm: generated.error,
              error: generated.error,
            };
          }

          const sizeError = assertGeneratedImageWithinLibraryLimit(
            generated.buffer.byteLength
          );
          if (sizeError) {
            return sizeError;
          }

          const saved = await withTenantId(context.tenantId, () =>
            writeLibraryFile({
              body: generated.buffer,
              chatId: context.chatId,
              contentType: generated.contentType,
              name:
                normalized.filename ??
                imageFileNameFromPrompt(normalized.prompt),
              source: "agent",
              tenantId: context.tenantId,
              userId: toTenantUserId(context.authUser.id),
            })
          );

          const output = {
            contentType: saved.contentType,
            contextForLlm: toGenerateImageModelText({
              contentType: saved.contentType,
              contextForLlm: "",
              id: saved.id,
              name: saved.name,
              prompt: normalized.prompt,
              revisedPrompt: generated.revisedPrompt,
              sizeBytes: saved.sizeBytes,
              url: saved.url,
            }),
            id: saved.id,
            name: saved.name,
            prompt: normalized.prompt,
            revisedPrompt: generated.revisedPrompt,
            sizeBytes: saved.sizeBytes,
            url: saved.url,
          };

          return output;
        },
        input: normalized,
        tenantId: context.tenantId,
        toolCallId: options.toolCallId,
        toolName: "generateImage",
        workflowRunId: options.context.workflowRunId,
      })
  );
}

export async function sandboxExecChatTool(
  input: SandboxExecToolInput,
  options: ToolExecutionOptions<ChatToolContext>
) {
  const context = options.context.input;
  const normalized = normalizeSandboxExecInput(input);
  if ("error" in normalized) {
    return { contextForLlm: normalized.contextForLlm, error: normalized.error };
  }

  return await withChatLatencySpan(
    "chat.tool.execute",
    { "chat.tool.kind": "sandbox-exec", "chat.tool.mutating": true },
    async () =>
      await executeIdempotentTool({
        execute: async () => {
          const userId = toTenantUserId(context.authUser.id);
          const enabledWorkSkillIds =
            context.toolConfiguration.sandboxWorkSkillIds ?? [];
          const inferredSkillId = inferSandboxWorkSkillId(normalized.code);
          const skillId =
            inferredSkillId &&
            enabledWorkSkillIds.includes(inferredSkillId) &&
            isWorkSkillId(inferredSkillId)
              ? inferredSkillId
              : undefined;

          const response = await runSandboxExec({
            chatId: context.chatId,
            code: normalized.code,
            command: normalized.command,
            cwd: normalized.cwd ?? ".",
            enabledWorkSkillIds,
            scriptId: sandboxScriptId(options.toolCallId),
            tenantId: context.tenantId,
            timeoutMs: normalized.timeoutMs ?? 60_000,
            userId,
          });

          if (response.error && response.exitCode === undefined) {
            return {
              contextForLlm: response.error,
              error: response.error,
            };
          }

          const outputFiles = response.outputFiles ?? [];
          const exitCode = response.exitCode ?? null;
          const stdout = response.stdout ?? "";
          const stderr = response.stderr ?? "";
          const durationMs = response.durationMs ?? 0;
          const contextForLlm = toSandboxExecModelText({
            durationMs,
            exitCode,
            outputFiles,
            stderr,
            stdout,
          });

          if (!response.ok) {
            return {
              contextForLlm,
              durationMs,
              error:
                response.error ??
                (stderr.trim() ||
                  `Sandbox exited with code ${exitCode ?? "unknown"}.`),
              exitCode,
              outputFiles,
              skillId,
              stderr,
              stdout,
            };
          }

          return {
            contextForLlm,
            durationMs,
            exitCode,
            outputFiles,
            skillId,
            stderr,
            stdout,
          };
        },
        input: normalized,
        tenantId: context.tenantId,
        toolCallId: options.toolCallId,
        toolName: "sandboxExec",
        workflowRunId: options.context.workflowRunId,
      })
  );
}

export async function saveToLibraryChatTool(
  input: SaveToLibraryToolInput,
  options: ToolExecutionOptions<ChatToolContext>
) {
  const context = options.context.input;
  const normalized = normalizeSaveToLibraryInput(input);
  if ("error" in normalized) {
    return { contextForLlm: normalized.contextForLlm, error: normalized.error };
  }

  const priorFailed = await withTenantId(context.tenantId, async () => {
    const executions = await getCompletedToolExecutionsForWorkflowRun({
      workflowRunId: options.context.workflowRunId,
    });
    return executions.some(
      (entry) =>
        entry.toolName === "saveToLibrary" &&
        entry.toolCallId !== options.toolCallId &&
        (Boolean(entry.error?.trim()) ||
          isFailedSaveToLibraryResult(entry.result))
    );
  });
  if (priorFailed) {
    return {
      contextForLlm: SAVE_TO_LIBRARY_RETRY_BLOCKED_MESSAGE,
      error: SAVE_TO_LIBRARY_RETRY_BLOCKED_MESSAGE,
    };
  }

  return await withChatLatencySpan(
    "chat.tool.execute",
    { "chat.tool.kind": "save-to-library", "chat.tool.mutating": true },
    async () =>
      await executeIdempotentTool({
        execute: async () => {
          let body: Buffer;
          if (normalized.source.kind === "text") {
            body = Buffer.from(normalized.source.content, "utf8");
          } else if (normalized.source.kind === "base64") {
            body = Buffer.from(normalized.source.content, "base64");
          } else {
            const read = await readSandboxSessionFile({
              chatId: context.chatId,
              sandboxPath: normalized.source.sandboxPath,
              tenantId: context.tenantId,
              userId: toTenantUserId(context.authUser.id),
            });
            if ("error" in read) {
              return { contextForLlm: read.error, error: read.error };
            }
            body = read.body;
          }

          const saved = await withTenantId(context.tenantId, () =>
            writeLibraryFile({
              body,
              chatId: context.chatId,
              contentType: normalized.contentType,
              name: normalized.filename,
              source: "agent",
              tenantId: context.tenantId,
              userId: toTenantUserId(context.authUser.id),
            })
          );
          return {
            ...saved,
            contextForLlm: saveToLibrarySuccessContextForLlm({
              libraryFileId: saved.id,
              sandboxPath:
                normalized.source.kind === "sandbox"
                  ? normalized.source.sandboxPath
                  : undefined,
            }),
          };
        },
        input: normalized,
        tenantId: context.tenantId,
        toolCallId: options.toolCallId,
        toolName: "saveToLibrary",
        workflowRunId: options.context.workflowRunId,
      })
  );
}

export async function importLibraryToSandboxChatTool(
  input: ImportLibraryToSandboxToolInput,
  options: ToolExecutionOptions<ChatToolContext>
) {
  const context = options.context.input;
  const normalized = normalizeImportLibraryToSandboxInput(input);
  if ("error" in normalized) {
    return { contextForLlm: normalized.contextForLlm, error: normalized.error };
  }

  return await withChatLatencySpan(
    "chat.tool.execute",
    {
      "chat.tool.kind": "import-library-to-sandbox",
      "chat.tool.mutating": false,
    },
    async () => {
      const userId = toTenantUserId(context.authUser.id);
      const file = await withTenantId(context.tenantId, () =>
        getReadableLibraryFile({
          authUserId: context.authUser.id,
          email: context.authUser.email,
          fileId: normalized.libraryFileId,
          tenantId: context.tenantId,
          tenantUserId: userId,
        })
      );
      if (!file) {
        const message = "Library file not found.";
        return { contextForLlm: message, error: message };
      }

      const body = await readLibraryFileBytes(file.pathname);
      if (!body) {
        const message = "Library file content not found.";
        return { contextForLlm: message, error: message };
      }

      const imported = await importLibraryFileToSandbox({
        body,
        chatId: context.chatId,
        libraryFileId: file.id,
        name: file.name,
        sandboxPath: normalized.sandboxPath,
        sizeBytes: file.sizeBytes,
        tenantId: context.tenantId,
        userId,
      });

      if ("error" in imported) {
        return { contextForLlm: imported.error, error: imported.error };
      }

      return {
        ...imported,
        contextForLlm: importLibraryToSandboxSuccessContextForLlm({
          libraryFileId: imported.libraryFileId,
          reusedExisting: imported.reusedExisting,
          sandboxPath: imported.sandboxPath,
        }),
      };
    }
  );
}

export async function peopleSearchChatTool(
  input: { query: string },
  options: ToolExecutionOptions<ChatToolContext>
) {
  const definition = peopleSearch({
    tenantId: options.context.input.tenantId,
  });
  return await withChatLatencySpan(
    "chat.tool.execute",
    { "chat.tool.kind": "people-search", "chat.tool.mutating": false },
    async () => await definition.execute?.(input, options)
  );
}

export async function listKnowledgeBasesChatTool(
  _input: Record<string, never>,
  options: ToolExecutionOptions<ChatToolContext>
) {
  const context = options.context.input;
  const knowledgeBases = await withTenantId(context.tenantId, () =>
    listKnowledgeBasesForUser({
      tenantId: context.tenantId,
      userId: context.authUser.id,
    })
  );
  const entries = knowledgeBases.map((entry) => ({
    description: entry.description,
    id: entry.id,
    name: entry.name,
  }));
  return {
    contextForLlm: formatKnowledgeBaseListForLlm(entries),
    knowledgeBases: entries,
  };
}

export async function knowledgeBaseSearchChatTool(
  input: {
    query: string;
    knowledgeBaseId?: string;
    knowledgeBaseName?: string;
  },
  options: ToolExecutionOptions<ChatToolContext>
) {
  const context = options.context.input;
  const knowledgeBases = await withTenantId(context.tenantId, () =>
    listKnowledgeBasesForUser({
      tenantId: context.tenantId,
      userId: context.authUser.id,
    })
  );
  const entries = knowledgeBases.map((entry) => ({
    description: entry.description,
    id: entry.id,
    name: entry.name,
  }));
  const messageHint = [context.turnUserMessage, input.query]
    .filter((value) => value?.trim())
    .join(" ");
  const resolution = resolveKnowledgeBaseForSearch({
    composerKnowledgeBaseId: context.knowledgeBaseId,
    knowledgeBaseId: input.knowledgeBaseId,
    knowledgeBaseName: input.knowledgeBaseName,
    knowledgeBases: entries,
    messageHint,
  });
  if (resolution.kind !== "resolved") {
    return {
      contextForLlm: resolution.message,
      input: {
        query: input.query,
        ...(input.knowledgeBaseId
          ? { knowledgeBaseId: input.knowledgeBaseId }
          : {}),
        ...(input.knowledgeBaseName
          ? { knowledgeBaseName: input.knowledgeBaseName }
          : {}),
        [KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG]: true,
      },
      resultCount: 0,
    };
  }

  const { knowledgeBase } = resolution;
  try {
    return await withChatLatencySpan(
      "chat.tool.execute",
      {
        "chat.tool.kind": "knowledge-base-search",
        "chat.tool.mutating": false,
      },
      async () => {
        const search = await withTenantId(context.tenantId, () =>
          runKnowledgeBaseSearchForChat({
            chatHistory: [],
            citationContext: options.context.citationContext,
            knowledgeBaseId: knowledgeBase.id,
            query: input.query,
            tenantId: context.tenantId,
            userId: context.authUser.id,
          })
        );

        let contextForLlm = search.contextForLlm;
        if (search.resultCount === 0) {
          const linkedSources = await withTenantId(context.tenantId, () =>
            listKnowledgeBaseSources({
              knowledgeBaseId: knowledgeBase.id,
            })
          );
          if (linkedSources.length > 0) {
            const inventory = linkedSources
              .map((entry) => `- ${entry.source.title.trim() || "Untitled"}`)
              .join("\n");
            contextForLlm = `${contextForLlm}\n\nLinked sources in this knowledge base (${linkedSources.length}):\n${inventory}\n\nSummarize these for the user or run knowledgeBaseSearch again with a query about their topics.`;
          }
        }

        return {
          contextForLlm,
          input: {
            knowledgeBaseId: knowledgeBase.id,
            query: input.query,
            [KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG]: true,
            knowledgeBaseName: knowledgeBase.name,
          },
          output: buildKnowledgeBaseSearchToolOutput(search),
          resultCount: search.resultCount,
        };
      }
    );
  } catch (error) {
    console.error("[knowledgeBaseSearchChatTool]", error);
    const message =
      error instanceof Error ? error.message : "Knowledge base search failed";
    const embeddingHint = /fetch failed|ECONNREFUSED|Model server/i.test(
      message
    )
      ? " Embedding servers may still be starting — ensure model_server and indexing_model_server are healthy, then try again."
      : "";
    return {
      contextForLlm: `Knowledge base search is temporarily unavailable.${embeddingHint}`,
      input: {
        knowledgeBaseId: knowledgeBase.id,
        query: input.query,
        [KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG]: true,
        knowledgeBaseName: knowledgeBase.name,
      },
      resultCount: 0,
    };
  }
}

export async function webSearchChatTool(
  input: { query: string },
  options: ToolExecutionOptions<ChatToolContext>
) {
  const context = options.context.input;
  const config = context.toolConfiguration.webSearchConfig;
  if (!config?.search?.apiKey) {
    return { error: "Web search is not configured." };
  }
  const searchProvider = config.search;
  return await withChatLatencySpan(
    "chat.tool.execute",
    { "chat.tool.kind": "web-search", "chat.tool.mutating": false },
    async () => {
      const definition = webSearch({
        citationContext: options.context.citationContext,
        contentProvider: config.content,
        maxAutoReadPages: config.maxAutoReadPages ?? 3,
        provider: searchProvider,
      });
      return await definition.execute?.(input, options);
    }
  );
}

export async function connectorChatTool(
  input: Record<string, unknown>,
  options: ToolExecutionOptions<ChatToolContext>
) {
  const context = options.context;
  const connector = context.connector;
  if (!connector) {
    throw new Error("Connector tool context is missing");
  }
  if (
    isUserRejectedApprovalRetry({
      attempts: context.input.userRejectedApprovalAttempts ?? [],
      input,
      toolName: connector.name,
    })
  ) {
    return {
      reason: USER_REJECTED_APPROVAL_RETRY_REASON,
      type: "execution-denied",
    };
  }
  const mutating = isWriteToolName(connector.name);
  return await withChatLatencySpan(
    "chat.tool.execute",
    { "chat.tool.kind": "connector", "chat.tool.mutating": mutating },
    async () => {
      const execute = () =>
        executeConnectorTool({
          input,
          providerId: connector.providerId,
          tenantId: context.input.tenantId,
          toolConfigId: connector.toolConfigId,
          toolId: connector.toolId,
          toolInputOverrides: {},
          userId: context.input.authUser.id,
        });
      return await (mutating
        ? executeIdempotentTool({
            execute,
            input,
            tenantId: context.input.tenantId,
            toolCallId: options.toolCallId,
            toolName: connector.name,
            workflowRunId: context.workflowRunId,
          })
        : execute());
    }
  );
}

function formatMcpToolResultForLlm(result: unknown) {
  if (
    result &&
    typeof result === "object" &&
    "content" in result &&
    Array.isArray((result as { content: unknown }).content)
  ) {
    const parts = (
      result as { content: Array<{ type?: string; text?: string }> }
    ).content;
    const text = parts
      .map((part) => (part.type === "text" ? part.text : JSON.stringify(part)))
      .filter(Boolean)
      .join("\n");
    if (text.trim()) {
      return text;
    }
  }
  return JSON.stringify(result);
}

export async function mcpToolChatTool(
  input: Record<string, unknown>,
  options: ToolExecutionOptions<ChatToolContext>
) {
  const mcp = options.context.mcp;
  if (!mcp) {
    return {
      contextForLlm:
        "MCP tool context is missing. Reconnect the MCP server under Connectors and start a new chat message.",
      error: "MCP tool context is missing",
    };
  }
  const context = options.context.input;
  const { callMcpToolForServer } = await import("@/core/lib/mcp/mcp-client");
  const { getTenantMcpServerSecretsById } = await import(
    "@/core/lib/db/mcp-queries"
  );

  return await withChatLatencySpan(
    "chat.tool.execute",
    { "chat.tool.kind": "mcp", "chat.tool.mutating": false },
    async () => {
      const server = await getTenantMcpServerSecretsById({
        serverId: mcp.serverId,
        tenantId: context.tenantId,
      });
      if (!server) {
        return {
          contextForLlm: "MCP server is no longer available.",
          error: "MCP server not found",
        };
      }

      const result = await callMcpToolForServer(server, mcp.mcpToolName, input);
      const contextForLlm = formatMcpToolResultForLlm(result);
      return { contextForLlm, result };
    }
  );
}
