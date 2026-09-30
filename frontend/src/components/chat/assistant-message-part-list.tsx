"use client";

import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTypewriter } from "@/hooks/use-typewriter";
import {
  extractKnowledgeSearchDocuments,
  resolveSearchDisplayQueries,
} from "@/lib/chat/search-tool-display";
import {
  extractWebQueriesFromPart,
  extractWebSourcesFromPart,
} from "@/lib/chat/web-search-parts";
import { parseModelErrorFromText } from "@/shared/ai/format-model-error-message";
import type { CreateChartToolOutput } from "@/shared/ai/tools/create-chart";
import {
  type GenerateImageToolOutput,
  isSuccessfulGenerateImageOutput,
} from "@/shared/ai/tools/generate-image";
import {
  type AssistantMessagePart,
  getAssistantPartKey,
  isToolAssistantPart,
  shouldDeferAssistantPartReveal,
} from "@/shared/chat/assistant-message-parts";
import {
  buildSlackUserLookupFromParts,
  type ConnectionActionToolOutput,
  isConnectorActionToolType,
  type SlackUserLookup,
} from "@/shared/chat/connector-action-tools";
import { isMcpActionToolType } from "@/shared/chat/mcp-action-tools";
import {
  aggregateToolPartStatuses,
  buildAssistantRenderBlocks,
  getToolPartAggregateStatus,
} from "@/shared/chat/parallel-tool-batch";
import {
  isInterruptedToolForDisplay,
  isToolPartPendingForDisplay,
} from "@/shared/chat/tool-part-pending";
import { pendingToolApprovalFromToolPart } from "@/shared/chat/ui-message-parts";
import { isKnowledgeBaseScopeSourceSearchInput } from "@/shared/knowledge-bases/knowledge-base-search-scope";
import { libraryContentTypeFromFileName } from "@/shared/library/content-type";
import {
  deliverableToolLabel,
  libraryPreviewKindFromMeta,
} from "@/shared/library/library-preview-kind";
import { normalizeMarkdownLists } from "@/shared/markdown/normalize-assistant-markdown";
import type {
  CitedDocument,
  InternalSearchToolOutput,
} from "@/shared/search/citations";
import type { ChatMessage, ChatMessagePart } from "@/shared/types";
import { sanitizeText } from "@/shared/utils";
import { MessageContent, MessageResponse } from "../ai-elements/message";
import {
  CreateChartToolView,
  CreateDocumentToolView,
  DeliverableToolView,
  GenerateImageToolView,
  ImportLibraryToolView,
  KnowledgeSearchToolView,
  PeopleSearchToolView,
  ReadPagesToolView,
  SandboxExecToolView,
  WebSearchToolView,
} from "./activity-tool-views";
import { AssistantModelError } from "./assistant-model-error";
import { ChartMessage } from "./chart-message";
import { CitedMessageResponse } from "./cited-message-response";
import { DocumentPreview } from "./document-preview";
import { GeneratedImageMessage } from "./generated-image-message";
import { InlineToolApprovalStep } from "./inline-tool-approval-step";
import { LibraryFilePreview } from "./library-file-preview";
import { MessageReasoning } from "./message-reasoning";
import { ConnectorToolCard } from "./tool-cards/connector-tool-card";
import { McpToolCard } from "./tool-cards/mcp-tool-card";
import { ParallelToolGroup } from "./tool-cards/parallel-tool-group";

type AssistantMessagePartListProps = {
  assistantMessageId?: string;
  messageParts: ChatMessage["parts"];
  isMessageStreaming: boolean;
  isReadonly: boolean;
  messageCitations: Record<number, CitedDocument>;
  artifactTitle: string;
  artifactKind: "text" | "code" | "sheet";
};

type ToolPart = {
  type: string;
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function inlineToolApprovalForPart(
  toolPart: ToolPart,
  isReadonly: boolean,
  slackUserLookup: SlackUserLookup
): ReactNode | null {
  if (isReadonly || toolPart.state !== "approval-requested") {
    return null;
  }
  const pending = pendingToolApprovalFromToolPart(toolPart as ChatMessagePart);
  if (!pending?.approvalId) {
    return null;
  }
  return (
    <InlineToolApprovalStep
      pending={pending}
      slackUserLookup={slackUserLookup}
    />
  );
}

function StreamingNarrativeBlock({
  text,
  usesTypewriter,
  isMessageStreaming,
  messageCitations,
  onRevealChange,
}: {
  text: string;
  usesTypewriter: boolean;
  isMessageStreaming: boolean;
  messageCitations: Record<number, CitedDocument>;
  onRevealChange: (isRevealing: boolean) => void;
}) {
  const { displayed, isActive } = useTypewriter(
    text,
    usesTypewriter,
    !isMessageStreaming && !usesTypewriter
  );
  const onRevealChangeRef = useRef(onRevealChange);
  const lastRevealingRef = useRef<boolean | null>(null);

  useEffect(() => {
    onRevealChangeRef.current = onRevealChange;
  }, [onRevealChange]);
  useEffect(() => {
    const isRevealing = usesTypewriter && isActive;
    if (lastRevealingRef.current !== isRevealing) {
      lastRevealingRef.current = isRevealing;
      onRevealChangeRef.current(isRevealing);
    }
  }, [isActive, usesTypewriter]);

  const isAnimating = usesTypewriter && isActive;
  const responseProps = {
    caret: isAnimating ? ("block" as const) : undefined,
    isAnimating,
    mode: isAnimating ? ("streaming" as const) : ("static" as const),
    parseIncompleteMarkdown: isAnimating,
  };
  const visibleText = normalizeMarkdownLists(isAnimating ? displayed : text);

  return Object.keys(messageCitations).length > 0 ? (
    <CitedMessageResponse citations={messageCitations} {...responseProps}>
      {visibleText}
    </CitedMessageResponse>
  ) : (
    <MessageResponse {...responseProps}>{visibleText}</MessageResponse>
  );
}

function readDocumentIdentity(part: ToolPart) {
  const input =
    part.input && typeof part.input === "object"
      ? (part.input as Record<string, unknown>)
      : {};
  const output =
    part.output && typeof part.output === "object"
      ? (part.output as Record<string, unknown>)
      : {};
  const title =
    (typeof input.title === "string" && input.title.trim()) ||
    (typeof input.description === "string" && input.description.trim()) ||
    (typeof output.title === "string" && output.title.trim()) ||
    undefined;
  const rawKind = input.kind ?? output.kind;
  const kind: "text" | "code" | "sheet" | undefined =
    rawKind === "text" || rawKind === "code" || rawKind === "sheet"
      ? rawKind
      : undefined;
  return { kind, title };
}

function renderToolPart(args: {
  part: AssistantMessagePart;
  isReadonly: boolean;
  isMessageStreaming: boolean;
  artifactTitle: string;
  artifactKind: "text" | "code" | "sheet";
  nested?: boolean;
  slackUserLookup: SlackUserLookup;
}) {
  const {
    part,
    isReadonly,
    isMessageStreaming,
    artifactTitle,
    artifactKind,
    nested = false,
    slackUserLookup,
  } = args;
  if (!isToolAssistantPart(part) || !("toolCallId" in part)) {
    return null;
  }
  const toolPart = part as ToolPart;
  const hasOutput =
    "output" in toolPart ? toolPart.output !== undefined : undefined;
  const isPending = isToolPartPendingForDisplay({
    hasOutput,
    isMessageStreaming,
    state: toolPart.state,
  });
  const isInterrupted = isInterruptedToolForDisplay({
    hasOutput,
    isMessageStreaming,
    state: toolPart.state,
  });

  if (
    part.type === "tool-sourceSearch" ||
    part.type === "tool-knowledgeSearch"
  ) {
    const output =
      toolPart.state === "output-available"
        ? (toolPart.output as InternalSearchToolOutput)
        : undefined;
    return (
      <KnowledgeSearchToolView
        documents={
          isPending ? undefined : extractKnowledgeSearchDocuments(output)
        }
        input={toolPart.input}
        isFirst
        isInterrupted={isInterrupted}
        isKnowledgeBaseScope={isKnowledgeBaseScopeSourceSearchInput(
          toolPart.input
        )}
        isLast
        isPending={isPending}
        nested={nested}
        output={output}
        queries={resolveSearchDisplayQueries(toolPart.input, output)}
      />
    );
  }

  if (part.type === "tool-peopleSearch") {
    const input =
      toolPart.input && typeof toolPart.input === "object"
        ? (toolPart.input as { query?: unknown })
        : {};
    const query = typeof input.query === "string" ? input.query.trim() : "";
    return (
      <PeopleSearchToolView
        input={toolPart.input}
        isFirst
        isInterrupted={isInterrupted}
        isLast
        isPending={isPending}
        nested={nested}
        output={
          toolPart.state === "output-available" ? toolPart.output : undefined
        }
        queries={query ? [query] : []}
      />
    );
  }

  if (part.type === "tool-webSearch") {
    return (
      <WebSearchToolView
        input={toolPart.input}
        isFirst
        isInterrupted={isInterrupted}
        isLast
        isPending={isPending}
        nested={nested}
        output={
          toolPart.state === "output-available" ? toolPart.output : undefined
        }
        queries={extractWebQueriesFromPart(part)}
        webSources={isPending ? undefined : extractWebSourcesFromPart(part)}
      />
    );
  }

  if (part.type === "tool-openUrl") {
    return (
      <ReadPagesToolView
        isFirst
        isLast
        isPending={isPending}
        sources={extractWebSourcesFromPart(part)}
      />
    );
  }

  if (part.type === "tool-createChart") {
    if (toolPart.state === "output-available") {
      const output = toolPart.output as
        | CreateChartToolOutput
        | { error?: string }
        | undefined;
      if (output && !("error" in output) && "chartType" in output) {
        return <ChartMessage chart={output} />;
      }
    }
    const input =
      toolPart.input && typeof toolPart.input === "object"
        ? (toolPart.input as { title?: unknown })
        : {};
    return (
      <CreateChartToolView
        isFirst
        isLast
        isPending={isPending}
        title={typeof input.title === "string" ? input.title.trim() : undefined}
      />
    );
  }

  if (part.type === "tool-generateImage") {
    const input =
      toolPart.input && typeof toolPart.input === "object"
        ? (toolPart.input as { prompt?: unknown })
        : {};
    const inputPrompt =
      typeof input.prompt === "string" ? input.prompt.trim() : undefined;

    if (
      toolPart.state === "output-available" ||
      toolPart.state === "output-error"
    ) {
      const output =
        toolPart.output && typeof toolPart.output === "object"
          ? (toolPart.output as GenerateImageToolOutput | { error?: string })
          : undefined;
      const errorMessage =
        (typeof toolPart.errorText === "string" && toolPart.errorText.trim()) ||
        (output && "error" in output && typeof output.error === "string"
          ? output.error
          : undefined);

      if (errorMessage) {
        return (
          <GenerateImageToolView
            errorMessage={errorMessage}
            failed
            isFirst
            isLast
            isPending={false}
            nested={nested}
            prompt={inputPrompt}
          />
        );
      }

      if (output && isSuccessfulGenerateImageOutput(output)) {
        const prompt = inputPrompt ?? (output.prompt?.trim() || undefined);
        return (
          <>
            <GenerateImageToolView
              isFirst
              isLast
              isPending={false}
              nested={nested}
              prompt={prompt}
            />
            <GeneratedImageMessage image={output} />
          </>
        );
      }
    }

    return (
      <GenerateImageToolView
        isFirst
        isInterrupted={isInterrupted}
        isLast
        isPending={isPending}
        nested={nested}
        prompt={inputPrompt}
      />
    );
  }

  if (part.type === "tool-sandboxExec") {
    const input =
      toolPart.input && typeof toolPart.input === "object"
        ? (toolPart.input as {
            command?: unknown;
            code?: unknown;
            label?: unknown;
          })
        : {};
    const command =
      typeof input.command === "string" ? input.command.trim() : undefined;
    const code = typeof input.code === "string" ? input.code : undefined;
    const actionLabel =
      typeof input.label === "string" ? input.label.trim() : undefined;
    const isInputStreaming = toolPart.state === "input-streaming";

    if (isInputStreaming && !actionLabel) {
      return null;
    }
    const output =
      (toolPart.state === "output-available" ||
        toolPart.state === "output-error") &&
      toolPart.output &&
      typeof toolPart.output === "object"
        ? (toolPart.output as {
            exitCode?: number | null;
            stdout?: string;
            stderr?: string;
            outputFiles?: Array<{ path?: string; sizeBytes?: number }>;
            durationMs?: number;
            skillId?: string;
            error?: string;
          })
        : undefined;
    const errorMessage =
      (typeof toolPart.errorText === "string" && toolPart.errorText.trim()) ||
      (output && typeof output.error === "string" ? output.error : undefined);
    const failed =
      Boolean(errorMessage) ||
      (!isPending &&
        output !== undefined &&
        output.exitCode !== undefined &&
        output.exitCode !== null &&
        output.exitCode !== 0);
    const outputFiles =
      output?.outputFiles?.flatMap((file) =>
        typeof file.path === "string" && file.path.trim()
          ? [
              {
                path: file.path.trim(),
                sizeBytes:
                  typeof file.sizeBytes === "number"
                    ? file.sizeBytes
                    : undefined,
              },
            ]
          : []
      ) ?? [];

    return (
      <SandboxExecToolView
        actionLabel={actionLabel}
        code={code}
        command={command}
        errorMessage={errorMessage}
        exitCode={output?.exitCode}
        failed={failed}
        inputStreaming={isInputStreaming}
        isFirst
        isInterrupted={isInterrupted}
        isLast
        isPending={isPending}
        nested={nested}
        outputFiles={outputFiles}
        stderr={output?.stderr}
        stdout={output?.stdout}
      />
    );
  }

  if (part.type === "tool-saveToLibrary") {
    const input =
      toolPart.input && typeof toolPart.input === "object"
        ? (toolPart.input as { filename?: unknown })
        : {};
    const output =
      toolPart.state === "output-available" &&
      toolPart.output &&
      typeof toolPart.output === "object"
        ? (toolPart.output as {
            id?: string;
            name?: string;
            url?: string;
            contentType?: string;
            sizeBytes?: number;
            error?: string;
          })
        : undefined;
    const errorMessage =
      output?.error ??
      (typeof toolPart.errorText === "string" ? toolPart.errorText : undefined);
    const failed =
      Boolean(errorMessage?.trim()) || (!isPending && !output?.url);
    const filename =
      (typeof output?.name === "string" ? output.name : undefined) ??
      (typeof input.filename === "string" ? input.filename.trim() : undefined);
    const contentType =
      (typeof output?.contentType === "string"
        ? output.contentType
        : undefined) ??
      (filename
        ? libraryContentTypeFromFileName(filename)
        : "application/octet-stream");
    const kind =
      filename && contentType
        ? libraryPreviewKindFromMeta({ contentType, name: filename })
        : "unsupported";
    const previewFile =
      !failed &&
      output?.id &&
      output.url &&
      typeof output.name === "string" &&
      typeof output.contentType === "string" &&
      typeof output.sizeBytes === "number"
        ? {
            contentType: output.contentType,
            id: output.id,
            name: output.name,
            sizeBytes: output.sizeBytes,
            url: output.url,
          }
        : null;

    if (failed) {
      return (
        <DeliverableToolView
          errorMessage={errorMessage?.trim() || undefined}
          failed
          isFirst
          isInterrupted={isInterrupted}
          isLast
          isPending={false}
          label={deliverableToolLabel(kind, "completed")}
          nested={nested}
          pendingLabel={deliverableToolLabel(kind, "pending")}
        />
      );
    }

    if (isPending) {
      return (
        <DeliverableToolView
          isFirst
          isLast
          isPending
          label={deliverableToolLabel(kind, "completed")}
          nested={nested}
          pendingLabel={deliverableToolLabel(kind, "pending")}
        />
      );
    }

    if (previewFile) {
      return <LibraryFilePreview file={previewFile} isReadonly={isReadonly} />;
    }

    return (
      <DeliverableToolView
        isFirst
        isLast
        isPending={false}
        label={deliverableToolLabel(kind, "completed")}
        nested={nested}
        pendingLabel={deliverableToolLabel(kind, "pending")}
      />
    );
  }

  if (part.type === "tool-importLibraryToSandbox") {
    const output =
      toolPart.state === "output-available" &&
      toolPart.output &&
      typeof toolPart.output === "object"
        ? (toolPart.output as { error?: string })
        : undefined;
    const errorMessage =
      (typeof toolPart.errorText === "string" && toolPart.errorText.trim()) ||
      (output && typeof output.error === "string" ? output.error : undefined);
    const failed = Boolean(errorMessage);

    if (!failed) {
      return null;
    }

    return (
      <ImportLibraryToolView
        errorMessage={errorMessage}
        failed={failed}
        isFirst
        isLast
        isPending={isPending}
        nested={nested}
      />
    );
  }

  if (part.type === "tool-listLibrary") {
    const output =
      toolPart.state === "output-available" &&
      toolPart.output &&
      typeof toolPart.output === "object"
        ? (toolPart.output as { error?: string })
        : undefined;
    const errorMessage =
      (typeof toolPart.errorText === "string" && toolPart.errorText.trim()) ||
      (output && typeof output.error === "string" ? output.error : undefined);
    const failed = Boolean(errorMessage);

    if (!failed) {
      return null;
    }

    return (
      <ImportLibraryToolView
        errorMessage={errorMessage}
        failed
        isFirst
        isLast
        isPending={false}
        nested={nested}
      />
    );
  }

  if (
    part.type === "tool-createDocument" ||
    part.type === "tool-updateDocument"
  ) {
    const inlineApproval = inlineToolApprovalForPart(
      toolPart,
      isReadonly,
      slackUserLookup
    );
    if (inlineApproval) {
      return inlineApproval;
    }
    if (toolPart.state === "output-available") {
      const output = toolPart.output as
        | { id: string; title: string; kind: "text" | "code" | "sheet" }
        | { error?: string }
        | undefined;
      if (output && !("error" in output) && "id" in output) {
        return <DocumentPreview isReadonly={isReadonly} result={output} />;
      }
    }
    if (isPending) {
      const input =
        toolPart.input && typeof toolPart.input === "object"
          ? (toolPart.input as Record<string, unknown>)
          : {};
      if (
        part.type === "tool-createDocument" &&
        typeof input.title === "string" &&
        (input.kind === "text" ||
          input.kind === "code" ||
          input.kind === "sheet")
      ) {
        return (
          <DocumentPreview
            args={{ kind: input.kind, title: input.title }}
            isReadonly={isReadonly}
          />
        );
      }
      if (part.type === "tool-updateDocument") {
        return (
          <DocumentPreview
            args={{
              isUpdate: true,
              kind: artifactKind,
              title: artifactTitle || "Document",
            }}
            isReadonly={isReadonly}
          />
        );
      }
    }
    const identity = readDocumentIdentity(toolPart);
    return (
      <CreateDocumentToolView
        action={part.type === "tool-createDocument" ? "create" : "update"}
        isFirst
        isLast
        isPending={isPending}
        kind={identity.kind}
        title={identity.title}
      />
    );
  }

  if (isConnectorActionToolType(part.type)) {
    const inlineApproval = inlineToolApprovalForPart(
      toolPart,
      isReadonly,
      slackUserLookup
    );
    if (inlineApproval) {
      return inlineApproval;
    }
    const output =
      (toolPart.state === "output-available" ||
        toolPart.state === "output-denied" ||
        toolPart.state === "output-error") &&
      toolPart.output
        ? (toolPart.output as ConnectionActionToolOutput)
        : undefined;
    return (
      <ConnectorToolCard
        input={toolPart.input}
        isMessageStreaming={isMessageStreaming}
        nested={nested}
        output={output}
        slackUserLookup={slackUserLookup}
        state={toolPart.state}
        toolType={part.type}
      />
    );
  }

  if (isMcpActionToolType(part.type)) {
    const output =
      (toolPart.state === "output-available" ||
        toolPart.state === "output-denied" ||
        toolPart.state === "output-error") &&
      toolPart.output !== undefined
        ? toolPart.output
        : undefined;
    return (
      <McpToolCard
        errorText={toolPart.errorText}
        input={toolPart.input}
        isMessageStreaming={isMessageStreaming}
        nested={nested}
        output={output}
        state={toolPart.state}
        toolType={part.type}
      />
    );
  }

  return null;
}

export function AssistantMessagePartList({
  assistantMessageId: _assistantMessageId,
  messageParts,
  isMessageStreaming,
  isReadonly,
  messageCitations,
  artifactTitle,
  artifactKind,
}: AssistantMessagePartListProps) {
  const slackUserLookup = useMemo(
    () => buildSlackUserLookupFromParts(messageParts),
    [messageParts]
  );
  const [revealingNarratives, setRevealingNarratives] = useState<
    Record<string, boolean>
  >({});
  const setNarrativeReveal = useCallback((key: string, revealing: boolean) => {
    setRevealingNarratives((current) => {
      if (revealing === Boolean(current[key])) {
        return current;
      }
      if (revealing) {
        return { ...current, [key]: true };
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);
  const renderBlocks = useMemo(
    () => buildAssistantRenderBlocks(messageParts),
    [messageParts]
  );
  const latestNarrativeBlockIndex = useMemo(
    () =>
      renderBlocks.findLastIndex((candidate) => {
        if (candidate.kind !== "part") {
          return false;
        }
        return messageParts[candidate.partIndex]?.type === "text";
      }),
    [messageParts, renderBlocks]
  );

  const renderSinglePart = useCallback(
    (partIndex: number, nested: boolean) => {
      const part = messageParts[partIndex];
      if (!part) {
        return null;
      }
      const key = getAssistantPartKey(messageParts, partIndex);
      if (
        isToolAssistantPart(part) &&
        shouldDeferAssistantPartReveal({
          isMessageStreaming,
          messageParts,
          partIndex,
          revealingNarratives,
        })
      ) {
        return null;
      }
      if (part.type === "reasoning") {
        const blockIndex = renderBlocks.findIndex(
          (block) => block.kind === "part" && block.partIndex === partIndex
        );
        return (
          <div className="w-full min-w-0" key={key}>
            <MessageReasoning
              isLoading={
                isMessageStreaming &&
                blockIndex === renderBlocks.length - 1 &&
                "state" in part &&
                part.state === "streaming"
              }
              reasoning={part.text ?? ""}
            />
          </div>
        );
      }
      if (part.type === "text") {
        const text = sanitizeText(part.text);
        const modelError = parseModelErrorFromText(text);
        const blockIndex = renderBlocks.findIndex(
          (block) => block.kind === "part" && block.partIndex === partIndex
        );
        return (
          <MessageContent
            className="bg-transparent px-0 py-0 text-left text-base [&_li]:text-base [&_ol]:text-base [&_p]:text-base [&_ul]:text-base"
            data-testid="message-content"
            key={key}
          >
            {modelError ? (
              <AssistantModelError error={modelError} />
            ) : (
              <StreamingNarrativeBlock
                isMessageStreaming={isMessageStreaming}
                messageCitations={messageCitations}
                onRevealChange={(revealing) =>
                  setNarrativeReveal(key, revealing)
                }
                text={text}
                usesTypewriter={
                  isMessageStreaming && blockIndex === latestNarrativeBlockIndex
                }
              />
            )}
          </MessageContent>
        );
      }
      return (
        <Fragment key={key}>
          {renderToolPart({
            artifactKind,
            artifactTitle,
            isMessageStreaming,
            isReadonly,
            nested,
            part,
            slackUserLookup,
          })}
        </Fragment>
      );
    },
    [
      artifactKind,
      artifactTitle,
      isMessageStreaming,
      isReadonly,
      latestNarrativeBlockIndex,
      messageCitations,
      messageParts,
      renderBlocks,
      revealingNarratives,
      setNarrativeReveal,
      slackUserLookup,
    ]
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-1 md:gap-2">
      {renderBlocks.map((block, blockIndex) => {
        if (block.kind === "toolGroup") {
          const groupParts = block.partIndices
            .map((partIndex) => messageParts[partIndex])
            .filter((part): part is ChatMessagePart => Boolean(part));
          const firstPartIndex = block.partIndices[0];
          if (firstPartIndex === undefined) {
            return null;
          }
          if (
            shouldDeferAssistantPartReveal({
              isMessageStreaming,
              messageParts,
              partIndex: firstPartIndex,
              revealingNarratives,
            })
          ) {
            return null;
          }
          const aggregateStatus = aggregateToolPartStatuses(groupParts, {
            isMessageStreaming,
          });
          const failedCount = groupParts.filter(
            (part) =>
              getToolPartAggregateStatus(part, { isMessageStreaming }) ===
              "failed"
          ).length;
          const followedByNarrative = renderBlocks
            .slice(blockIndex + 1)
            .some(
              (candidate) =>
                candidate.kind === "part" &&
                messageParts[candidate.partIndex]?.type === "text"
            );
          const groupKey = block.partIndices
            .map((partIndex) => {
              const part = messageParts[partIndex];
              return part && "toolCallId" in part ? part.toolCallId : partIndex;
            })
            .join("-");

          return (
            <ParallelToolGroup
              aggregateStatus={aggregateStatus}
              autoCollapse={followedByNarrative}
              failedCount={failedCount}
              key={`tool-group-${groupKey}`}
              provider={block.provider}
              toolCount={block.partIndices.length}
            >
              {block.partIndices.map((partIndex) =>
                renderSinglePart(partIndex, true)
              )}
            </ParallelToolGroup>
          );
        }

        return renderSinglePart(block.partIndex, false);
      })}
    </div>
  );
}
