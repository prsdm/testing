import { jsonSchema, type ToolSet, tool } from "ai";
import { z } from "zod";
import {
  type ChatToolContext,
  connectorChatTool,
  createChartChatTool,
  generateImageChatTool,
  importLibraryToSandboxChatTool,
  knowledgeBaseSearchChatTool,
  listKnowledgeBasesChatTool,
  listLibraryChatTool,
  mcpToolChatTool,
  peopleSearchChatTool,
  sandboxExecChatTool,
  saveToLibraryChatTool,
  todoWriteChatTool,
  webSearchChatTool,
} from "@/core/lib/ai/chat-tool-executors";
import type {
  ChatWorkflowInput,
  WorkflowToolsConfiguration,
} from "@/core/lib/ai/chat-workflow-types";
import { resolveMutatingToolNeedsApproval } from "@/core/lib/ai/serial-write-tools";
import { importLibraryToSandboxInputSchema } from "@/core/lib/ai/tools/import-library-to-sandbox";
import {
  listLibraryInputSchema,
  saveToLibraryInputSchema,
} from "@/core/lib/ai/tools/save-to-library";
import { todoWriteInputSchema } from "@/core/lib/ai/tools/todo-write";
import { isSandboxConfigured } from "@/core/lib/sandbox/config";
import {
  createSharedCitationContext,
  type SharedCitationContext,
} from "@/core/lib/search/citation-context";
import {
  latestUserMessageText,
  shouldExposeConnectorTool,
} from "@/shared/ai/chat-task-planning";
import { toolAllowedForTurn } from "@/shared/ai/tool-approvals";
import { generateImageInputSchema } from "@/shared/ai/tools/generate-image";
import { sandboxExecInputSchema } from "@/shared/ai/tools/sandbox-exec";
import {
  builtInToolAllowedForConnectorFocuses,
  connectorToolAllowedForConnectorFocuses,
  mcpToolAllowedForConnectorFocuses,
} from "@/shared/connectors/connector-focus-tool-filter";

const contextSchema = z.object({
  citationContext: z.custom<SharedCitationContext>(),
  connector: z
    .object({
      description: z.string(),
      inputSchema: z.record(z.string(), z.unknown()),
      name: z.string(),
      providerId: z.string(),
      toolConfigId: z.string(),
      toolId: z.string(),
    })
    .optional(),
  mcp: z
    .object({
      description: z.string(),
      inputSchema: z.record(z.string(), z.unknown()),
      mcpToolName: z.string(),
      name: z.string(),
      serverId: z.string(),
    })
    .optional(),
  input: z.custom<ChatWorkflowInput>(),
  workflowRunId: z.string(),
});

const createChartSchema = z.object({
  chartType: z.enum(["bar", "line", "pie", "doughnut"]),
  datasets: z
    .array(
      z.object({
        data: z.array(z.number().finite()).min(1).max(50),
        label: z.string().min(1).max(80),
      })
    )
    .min(1)
    .max(8),
  labels: z.array(z.string().min(1).max(80)).min(1).max(50),
  title: z.string().min(1).max(120),
});

export function buildChatTools(args: {
  input: ChatWorkflowInput;
  workflowRunId: string;
  configuration: WorkflowToolsConfiguration;
}): {
  tools: ToolSet;
  activeToolNames: string[];
  toolsContext: Record<string, ChatToolContext>;
} {
  const tools: ToolSet = {};
  const activeToolNames: string[] = [];
  const toolsContext: Record<string, ChatToolContext> = {};
  const citationContext = createSharedCitationContext();
  const connectorFocuses = args.input.connectorFocuses?.length
    ? args.input.connectorFocuses
    : args.input.connectorFocus
      ? [args.input.connectorFocus]
      : [];
  const add = (
    name: string,
    definition: ToolSet[string],
    contextExtras?: Pick<ChatToolContext, "connector" | "mcp">
  ) => {
    tools[name] = definition;
    activeToolNames.push(name);
    toolsContext[name] = {
      citationContext,
      connector: contextExtras?.connector,
      input: args.input,
      mcp: contextExtras?.mcp,
      workflowRunId: args.workflowRunId,
    };
  };

  if (builtInToolAllowedForConnectorFocuses("todoWrite", connectorFocuses)) {
    add(
      "todoWrite",
      tool({
        contextSchema,
        description:
          "Create or update the visible task plan for multi-step work. Call at the start of non-trivial requests with all planned steps (status pending). Re-call with the full list as you start (in_progress) and finish (completed) each step. At most one step may be in_progress at a time. Mark completed only for steps that actually succeeded. When the user rejects an approval, mark only that step skipped and continue — do not retry the same action. After a failed execution (not a user rejection), retry the same tool and intent without switching APIs. Never mark a succeeded step as skipped. Always send the complete todos array on every call.",
        execute: todoWriteChatTool,
        inputSchema: todoWriteInputSchema,
      })
    );
  }
  if (builtInToolAllowedForConnectorFocuses("peopleSearch", connectorFocuses)) {
    add(
      "peopleSearch",
      tool({
        contextSchema,
        description:
          "Find signed-in teammates by name, email, role, or department.",
        execute: peopleSearchChatTool,
        inputSchema: z.object({ query: z.string().min(1) }),
      })
    );
  }
  if (
    builtInToolAllowedForConnectorFocuses(
      "listKnowledgeBases",
      connectorFocuses
    )
  ) {
    add(
      "listKnowledgeBases",
      tool({
        contextSchema,
        description:
          "List knowledge bases this user can access, including each knowledge base's description when set.",
        execute: listKnowledgeBasesChatTool,
        inputSchema: z.object({}),
      })
    );
  }
  if (
    builtInToolAllowedForConnectorFocuses(
      "knowledgeBaseSearch",
      connectorFocuses
    )
  ) {
    add(
      "knowledgeBaseSearch",
      tool({
        contextSchema,
        description:
          "Search a knowledge base's indexed files and sources. Pass knowledgeBaseName or knowledgeBaseId when the user refers to a specific knowledge base; call listKnowledgeBases to see options.",
        execute: knowledgeBaseSearchChatTool,
        inputSchema: z.object({
          knowledgeBaseId: z.string().uuid().optional(),
          knowledgeBaseName: z.string().min(1).optional(),
          query: z.string().min(1),
        }),
      })
    );
  }
  if (builtInToolAllowedForConnectorFocuses("createChart", connectorFocuses)) {
    add(
      "createChart",
      tool({
        contextSchema,
        description:
          "Create an interactive chart from numeric data for trends and comparisons.",
        execute: createChartChatTool,
        inputSchema: createChartSchema,
      })
    );
  }
  if (builtInToolAllowedForConnectorFocuses("listLibrary", connectorFocuses)) {
    add(
      "listLibrary",
      tool({
        contextSchema,
        description:
          "List the user's deliverable files (most recent first). Each entry includes libraryFileId for importLibraryToSandbox.",
        execute: listLibraryChatTool,
        inputSchema: listLibraryInputSchema,
      })
    );
  }
  if (
    builtInToolAllowedForConnectorFocuses("saveToLibrary", connectorFocuses)
  ) {
    add(
      "saveToLibrary",
      tool({
        contextSchema,
        description:
          "Save a deliverable file for the user. For sandbox outputs (.pptx, .xlsx, PDF, etc.) pass filename and sandboxPath only (e.g. outputs/deck.pptx) — omit content. For text exports pass filename and content. On success an inline preview card appears in chat — open/download from the card; do not mention the filename or provide download links in your message.",
        execute: saveToLibraryChatTool,
        inputSchema: saveToLibraryInputSchema,
      })
    );
  }
  if (
    args.input.llmKeys.openai &&
    builtInToolAllowedForConnectorFocuses("generateImage", connectorFocuses)
  ) {
    add(
      "generateImage",
      tool({
        contextSchema,
        description:
          "Generate an image from a text prompt. Use when the user asks to create, draw, design, or generate a visual. The image appears inline in chat. Do not use for written descriptions only. Do not provide download links or markdown images in your message — the inline card is the deliverable. If a call fails, do not call this tool again in the same turn — tell the user and wait for a new message.",
        execute: generateImageChatTool,
        inputSchema: generateImageInputSchema,
      })
    );
  }

  if (args.configuration.sandboxEnabled && isSandboxConfigured()) {
    if (
      builtInToolAllowedForConnectorFocuses(
        "importLibraryToSandbox",
        connectorFocuses
      )
    ) {
      add(
        "importLibraryToSandbox",
        tool({
          contextSchema,
          description:
            "Copy a library deliverable into sandbox outputs/ so it can be edited with sandboxExec and work skills. Call when the user asks to change an existing file — use libraryFileId from listLibrary or a prior saveToLibrary result. Skip if the file is already at the sandbox path from this chat and unchanged.",
          execute: importLibraryToSandboxChatTool,
          inputSchema: importLibraryToSandboxInputSchema,
        })
      );
    }
    if (
      builtInToolAllowedForConnectorFocuses("sandboxExec", connectorFocuses)
    ) {
      add(
        "sandboxExec",
        tool({
          contextSchema,
          description:
            "Run Python or bash in an isolated per-chat sandbox workspace. Always pass label — a short present-tense action shown on the tool card (e.g. 'Create sample Word docs', 'Validate deck layout'). Use for data transforms, CSV/Excel work, calculations, and multi-step scripts. Bundled playbooks live under `.kimiro/skills/{name}/` — read that skill's SKILL.md via sandboxExec when the task needs it; do not preload skill docs on unrelated work. Session folders: uploads/ (attachments), staging/ (intermediate), outputs/ (deliverables), scripts/ (generated runners). Put final files in outputs/ and call saveToLibrary when the user should receive the deliverable.",
          execute: sandboxExecChatTool,
          inputSchema: sandboxExecInputSchema,
        })
      );
    }
  }

  if (
    args.configuration.webSearchConfig?.search?.apiKey &&
    builtInToolAllowedForConnectorFocuses("webSearch", connectorFocuses)
  ) {
    add(
      "webSearch",
      tool({
        contextSchema,
        description:
          "Search the public web for current events, live facts, or external information not available in company sources or connectors. Prefer connector read tools when the question is about internal docs or connected apps. Pass a focused query string.",
        execute: webSearchChatTool,
        inputSchema: z.object({
          query: z.string().min(1),
        }),
      })
    );
  }

  const userMessageText = latestUserMessageText(args.input.messages);

  for (const connector of args.configuration.connectorTools) {
    if (!connectorToolAllowedForConnectorFocuses(connector, connectorFocuses)) {
      continue;
    }
    if (
      !shouldExposeConnectorTool({
        toolId: connector.toolId,
        userMessageText,
      })
    ) {
      continue;
    }
    if (
      !toolAllowedForTurn({
        blockedApprovalToolNames: args.input.blockedApprovalToolNames,
        toolName: connector.name,
        writeToolsBlocked: args.input.writeToolsBlocked,
      })
    ) {
      continue;
    }
    add(
      connector.name,
      tool({
        contextSchema,
        description: connector.description,
        execute: connectorChatTool,
        inputSchema: jsonSchema(connector.inputSchema),
        needsApproval: (input) =>
          resolveMutatingToolNeedsApproval({
            attempts: args.input.userRejectedApprovalAttempts ?? [],
            input,
            toolName: connector.name,
          }),
      }),
      { connector }
    );
  }

  for (const mcpTool of args.configuration.mcpTools) {
    if (!mcpToolAllowedForConnectorFocuses(mcpTool, connectorFocuses)) {
      continue;
    }
    if (
      !toolAllowedForTurn({
        blockedApprovalToolNames: args.input.blockedApprovalToolNames,
        toolName: mcpTool.name,
        writeToolsBlocked: args.input.writeToolsBlocked,
      })
    ) {
      continue;
    }
    add(
      mcpTool.name,
      tool({
        contextSchema,
        description: mcpTool.description,
        execute: mcpToolChatTool,
        inputSchema: jsonSchema(mcpTool.inputSchema),
      }),
      { mcp: mcpTool }
    );
  }

  return { activeToolNames, tools, toolsContext };
}
