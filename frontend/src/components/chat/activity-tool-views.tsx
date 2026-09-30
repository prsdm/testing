"use client";

import {
  BookOpenIcon,
  ChartColumnIcon,
  DatabaseIcon,
  FileSearchIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ImageIcon,
  SquareTerminalIcon,
} from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { shouldHideSandboxSkillStdout } from "@/lib/chat/sandbox-skill-display";
import {
  type WebSource,
  webSourceKey,
  webSourceLabel,
} from "@/lib/chat/web-search-parts";
import {
  sandboxExecToolCardLabel,
  summarizeSandboxExecFailure,
} from "@/shared/ai/tools/sandbox-exec";
import type {
  CitedDocument,
  InternalSearchToolOutput,
} from "@/shared/search/citations";
import { cn } from "@/shared/utils";
import { Shimmer } from "../ai-elements/shimmer";
import { ActivityChipList, activityChipClassName } from "./activity-chip-list";
import { KnowledgeDocumentChip } from "./internal-search";
import { ResultsStepIcon } from "./timeline/results-step-icon";
import { SearchToolCard } from "./tool-cards/search-tool-card";
import { ToolCallCard } from "./tool-cards/tool-call-card";
import {
  ToolCardSection,
  ToolCardSurface,
} from "./tool-cards/tool-card-surface";

export {
  KNOWLEDGE_BASE_SEARCH_FOR_STEP_TITLE,
  KNOWLEDGE_BASE_SEARCH_PENDING_LABEL,
  SEARCH_FOR_STEP_TITLE,
  SEARCH_PENDING_LABEL,
} from "@/lib/chat/search-tool-display";

type WebSearchToolViewProps = {
  queries?: string[];
  input?: unknown;
  output?: unknown;
  webSources?: WebSource[];
  isPending: boolean;
  isInterrupted?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  nested?: boolean;
};

function getWebSourceFaviconUrl(source: WebSource) {
  if (source.type !== "url") {
    return;
  }
  try {
    const parsed = new URL(source.url);
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(parsed.hostname)}`;
  } catch {}
}

export function WebSearchToolView({
  queries: _queries,
  input,
  output,
  webSources: _webSources,
  isPending,
  isInterrupted = false,
  isFirst: _isFirst,
  isLast: _isLast,
  nested,
}: WebSearchToolViewProps) {
  return (
    <SearchToolCard
      input={input}
      isInterrupted={isInterrupted}
      isPending={isPending}
      nested={nested}
      output={output}
      variant="web"
    />
  );
}

type ReadPagesToolViewProps = {
  sources: WebSource[];
  isPending: boolean;
  isInterrupted?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
};

export function ReadPagesToolView({
  sources,
  isPending,
  isFirst: _isFirst,
  isLast: _isLast,
}: ReadPagesToolViewProps) {
  const hasBody = sources.length > 0;
  const status = isPending ? "pending" : "completed";
  const label = isPending ? (
    <Shimmer as="span" duration={1}>
      Reading pages
    </Shimmer>
  ) : (
    "Read pages"
  );

  return (
    <ToolCallCard
      dense
      expandable={hasBody}
      label={label}
      leadingIcon={<BookOpenIcon aria-hidden />}
      status={status}
    >
      {hasBody ? (
        <ToolCardSurface>
          <ToolCardSection>
            <div className="flex flex-wrap items-center gap-1.5">
              {sources.map((source) =>
                source.type === "url" ? (
                  <a
                    className={cn(
                      activityChipClassName,
                      "max-w-full gap-1 transition-colors hover:bg-muted"
                    )}
                    href={source.url}
                    key={webSourceKey(source)}
                    rel="noopener noreferrer"
                    target="_blank"
                    title={webSourceLabel(source)}
                  >
                    {(() => {
                      const faviconUrl = getWebSourceFaviconUrl(source);
                      return faviconUrl ? (
                        <Image
                          alt=""
                          className="size-3 rounded-full"
                          height={12}
                          referrerPolicy="no-referrer"
                          src={faviconUrl}
                          unoptimized
                          width={12}
                        />
                      ) : (
                        <BookOpenIcon className="size-3 shrink-0 text-muted-foreground" />
                      );
                    })()}
                    <span className="max-w-40 truncate">
                      {webSourceLabel(source)}
                    </span>
                  </a>
                ) : null
              )}
            </div>
          </ToolCardSection>
        </ToolCardSurface>
      ) : null}
    </ToolCallCard>
  );
}

type KnowledgeSearchToolViewProps = {
  queries?: string[];
  input?: unknown;
  output?: InternalSearchToolOutput;
  documents?: CitedDocument[];
  isPending: boolean;
  isInterrupted?: boolean;
  isKnowledgeBaseScope?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  nested?: boolean;
};

export function KnowledgeSearchToolView({
  queries: _queries,
  input,
  output,
  documents: _documents,
  isPending,
  isInterrupted = false,
  isKnowledgeBaseScope = false,
  isFirst: _isFirst,
  isLast: _isLast,
  nested,
}: KnowledgeSearchToolViewProps) {
  return (
    <SearchToolCard
      input={input}
      isInterrupted={isInterrupted}
      isKnowledgeBaseScope={isKnowledgeBaseScope}
      isPending={isPending}
      nested={nested}
      output={output}
      variant="knowledge"
    />
  );
}

type PeopleSearchToolViewProps = {
  queries?: string[];
  input?: unknown;
  output?: unknown;
  isPending: boolean;
  isInterrupted?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  nested?: boolean;
};

export function PeopleSearchToolView({
  queries: _queries,
  input,
  output,
  isPending,
  isInterrupted = false,
  isFirst: _isFirst,
  isLast: _isLast,
  nested,
}: PeopleSearchToolViewProps) {
  return (
    <SearchToolCard
      input={input}
      isInterrupted={isInterrupted}
      isPending={isPending}
      nested={nested}
      output={output}
      variant="people"
    />
  );
}

type CreateChartToolViewProps = {
  title?: string;
  isPending: boolean;
  isInterrupted?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
};

export function CreateChartToolView({
  title,
  isPending,
  isFirst: _isFirst,
  isLast: _isLast,
}: CreateChartToolViewProps) {
  const label = isPending ? (
    <Shimmer as="span" duration={1}>
      Creating chart
    </Shimmer>
  ) : (
    "Created chart"
  );

  return (
    <ToolCallCard
      dense
      expandable={Boolean(title?.trim())}
      label={label}
      leadingIcon={<ChartColumnIcon aria-hidden />}
      status={isPending ? "pending" : "completed"}
    >
      {title?.trim() ? (
        <ToolCardSurface>
          <ToolCardSection>
            <ActivityChipList items={[title]} variant="query" />
          </ToolCardSection>
        </ToolCardSurface>
      ) : null}
    </ToolCallCard>
  );
}

type GenerateImageToolViewProps = {
  prompt?: string;
  isPending: boolean;
  isInterrupted?: boolean;
  failed?: boolean;
  errorMessage?: string;
  isFirst?: boolean;
  isLast?: boolean;
  nested?: boolean;
};

export function GenerateImageToolView({
  prompt,
  isPending,
  isInterrupted = false,
  failed = false,
  errorMessage,
  isFirst: _isFirst,
  isLast: _isLast,
  nested = false,
}: GenerateImageToolViewProps) {
  const promptText = prompt?.trim() || undefined;
  const status = isPending
    ? "pending"
    : failed
      ? "failed"
      : isInterrupted
        ? "interrupted"
        : "completed";

  const label = isPending ? (
    <Shimmer as="span" duration={1}>
      Generating image
    </Shimmer>
  ) : failed ? (
    "Image generation failed"
  ) : isInterrupted ? (
    "Image generation interrupted"
  ) : (
    "Generated image"
  );

  const hasBody = Boolean(promptText?.trim()) || Boolean(errorMessage?.trim());

  return (
    <ToolCallCard
      defaultOpen={isPending || failed}
      dense
      expandable={hasBody}
      failed={failed}
      footer={
        errorMessage?.trim() ? (
          <span className="text-muted-foreground">{errorMessage}</span>
        ) : undefined
      }
      label={label}
      leadingIcon={<ImageIcon aria-hidden />}
      nested={nested}
      status={status}
    >
      {promptText ? (
        <ToolCardSurface>
          <ToolCardSection>
            <p className="whitespace-pre-wrap text-foreground/90 text-sm">
              {promptText}
            </p>
          </ToolCardSection>
        </ToolCardSurface>
      ) : null}
    </ToolCallCard>
  );
}

type DeliverableToolViewProps = {
  label: string;
  pendingLabel: string;
  errorMessage?: string;
  isPending: boolean;
  failed?: boolean;
  isInterrupted?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  nested?: boolean;
};

export function DeliverableToolView({
  label,
  pendingLabel,
  errorMessage,
  isPending,
  failed = false,
  isInterrupted = false,
  isFirst: _isFirst,
  isLast: _isLast,
  nested = false,
}: DeliverableToolViewProps) {
  const status = isPending
    ? "pending"
    : failed
      ? "failed"
      : isInterrupted
        ? "interrupted"
        : "completed";

  const cardLabel = isPending ? (
    <Shimmer as="span" duration={1}>
      {pendingLabel}
    </Shimmer>
  ) : failed ? (
    "Could not create file"
  ) : isInterrupted ? (
    "File creation interrupted"
  ) : (
    label
  );

  const hasBody = Boolean(errorMessage?.trim());

  return (
    <ToolCallCard
      defaultOpen={isPending || failed}
      dense
      expandable={hasBody}
      failed={failed}
      footer={
        errorMessage?.trim() ? (
          <span className="text-muted-foreground">{errorMessage}</span>
        ) : undefined
      }
      label={cardLabel}
      leadingIcon={<FileTextIcon aria-hidden />}
      nested={nested}
      status={status}
    />
  );
}

type SandboxExecToolViewProps = {
  actionLabel?: string;
  inputStreaming?: boolean;
  command?: string;
  code?: string;
  stdout?: string;
  stderr?: string;
  outputFiles?: Array<{ path: string; sizeBytes?: number }>;
  errorMessage?: string;
  exitCode?: number | null;
  failed?: boolean;
  isPending: boolean;
  isInterrupted?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  nested?: boolean;
};

function formatOutputFileChip(path: string): string {
  const name = path.split("/").at(-1)?.trim();
  return name && name.length > 0 ? name : path;
}

export function SandboxExecToolView({
  actionLabel,
  inputStreaming = false,
  command: _command,
  code,
  stdout,
  stderr,
  outputFiles = [],
  errorMessage,
  exitCode,
  failed = false,
  isPending,
  isInterrupted = false,
  isFirst: _isFirst,
  isLast: _isLast,
  nested = false,
}: SandboxExecToolViewProps) {
  const hideSkillStdout = shouldHideSandboxSkillStdout({ code, stdout });
  const stdoutText = failed || hideSkillStdout ? "" : (stdout?.trim() ?? "");
  const stderrText = failed ? "" : (stderr?.trim() ?? "");
  const hasOutputFiles = outputFiles.length > 0;
  const hasBody = hasOutputFiles || Boolean(stdoutText) || Boolean(stderrText);
  const footerMessage = failed
    ? summarizeSandboxExecFailure({
        errorMessage,
        exitCode,
        stderr,
      })
    : errorMessage?.trim();
  const status = isPending
    ? "pending"
    : failed
      ? "failed"
      : isInterrupted
        ? "interrupted"
        : "completed";

  const labelText = sandboxExecToolCardLabel({
    failed,
    inputStreaming,
    interrupted: isInterrupted,
    label: actionLabel,
    pending: isPending,
  });
  const label = isPending ? (
    <Shimmer as="span" duration={1}>
      {labelText}
    </Shimmer>
  ) : (
    labelText
  );

  return (
    <ToolCallCard
      defaultOpen={false}
      dense
      expandable={hasBody}
      failed={failed}
      footer={
        footerMessage ? (
          <span className="text-muted-foreground">{footerMessage}</span>
        ) : undefined
      }
      label={label}
      leadingIcon={<SquareTerminalIcon aria-hidden />}
      nested={nested}
      status={status}
    >
      {hasBody ? (
        <ToolCardSurface>
          {hasOutputFiles ? (
            <ToolCardSection>
              <p className="mb-2 font-medium text-foreground/80 text-xs">
                Output files
              </p>
              <ActivityChipList
                initialCount={6}
                items={outputFiles.map((file) =>
                  formatOutputFileChip(file.path)
                )}
              />
            </ToolCardSection>
          ) : null}
          {stdoutText ? (
            <ToolCardSection divider={hasOutputFiles}>
              <p className="mb-2 font-medium text-foreground/80 text-xs">
                Output
              </p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-foreground/90 text-xs leading-relaxed">
                {stdoutText}
              </pre>
            </ToolCardSection>
          ) : null}
          {stderrText ? (
            <ToolCardSection divider={hasOutputFiles || Boolean(stdoutText)}>
              <p className="mb-2 font-medium text-foreground/80 text-xs">
                Errors
              </p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-foreground/90 text-xs leading-relaxed">
                {stderrText}
              </pre>
            </ToolCardSection>
          ) : null}
        </ToolCardSurface>
      ) : null}
    </ToolCallCard>
  );
}

type ImportLibraryToolViewProps = {
  errorMessage?: string;
  failed?: boolean;
  isPending: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  nested?: boolean;
};

export function ImportLibraryToolView({
  errorMessage,
  failed = false,
  isPending,
  isFirst: _isFirst,
  isLast: _isLast,
  nested = false,
}: ImportLibraryToolViewProps) {
  const label = isPending ? (
    <Shimmer as="span" duration={1}>
      Preparing edit
    </Shimmer>
  ) : failed ? (
    "Could not prepare edit"
  ) : (
    "Ready to edit"
  );

  return (
    <ToolCallCard
      defaultOpen={failed}
      dense
      expandable={Boolean(errorMessage?.trim())}
      failed={failed}
      footer={
        errorMessage?.trim() ? (
          <span className="text-muted-foreground">{errorMessage}</span>
        ) : undefined
      }
      label={label}
      leadingIcon={<FileTextIcon aria-hidden />}
      nested={nested}
      status={isPending ? "pending" : failed ? "failed" : "completed"}
    />
  );
}

type CreateDocumentToolViewProps = {
  title?: string;
  action: "create" | "update";
  kind?: "text" | "code" | "sheet";
  isPending: boolean;
  isInterrupted?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
};

function documentActivityTitle(args: {
  action: "create" | "update";
  kind?: "text" | "code" | "sheet";
}) {
  const noun =
    args.kind === "sheet"
      ? "spreadsheet"
      : args.kind === "code"
        ? "code"
        : "document";
  if (args.action === "update") {
    return `Updating ${noun}`;
  }
  return `Creating ${noun}`;
}

export function CreateDocumentToolView({
  title,
  action,
  kind,
  isPending,
  isFirst: _isFirst,
  isLast: _isLast,
}: CreateDocumentToolViewProps) {
  const activityLabel = documentActivityTitle({ action, kind });
  const Icon = kind === "sheet" ? FileSpreadsheetIcon : FileTextIcon;
  const label = isPending ? (
    <Shimmer as="span" duration={1}>
      {activityLabel}
    </Shimmer>
  ) : action === "update" ? (
    activityLabel.replace(/^Updating /, "Updated ")
  ) : (
    activityLabel.replace(/^Creating /, "Created ")
  );

  return (
    <ToolCallCard
      dense
      expandable={Boolean(title?.trim())}
      label={label}
      leadingIcon={<Icon aria-hidden />}
      status={isPending ? "pending" : "completed"}
    >
      {title?.trim() ? (
        <ToolCardSurface>
          <ToolCardSection>
            <ActivityChipList items={[title]} variant="query" />
          </ToolCardSection>
        </ToolCardSurface>
      ) : null}
    </ToolCallCard>
  );
}

type SearchResultsToolViewProps = {
  documents?: CitedDocument[];
  sources?: WebSource[];
  isFirst?: boolean;
  isLast?: boolean;
};

type ResultSourceGroupId =
  | "knowledge"
  | "slack"
  | "gmail"
  | "calendar"
  | "jira"
  | "web";

const RESULT_SOURCE_GROUP_ORDER = [
  "knowledge",
  "slack",
  "gmail",
  "calendar",
  "jira",
  "web",
] as const satisfies readonly ResultSourceGroupId[];

const RESULT_SOURCE_GROUP_LABEL: Record<ResultSourceGroupId, string> = {
  calendar: "Calendar",
  gmail: "Gmail",
  jira: "Jira",
  knowledge: "Sources",
  slack: "Slack",
  web: "Web",
};

function resultSourceGroupIdForDocument(
  document: CitedDocument
): Exclude<ResultSourceGroupId, "web"> {
  switch (document.sourceType) {
    case "slack":
      return "slack";
    case "gmail":
      return "gmail";
    case "calendar":
      return "calendar";
    case "jira":
      return "jira";
    default:
      return "knowledge";
  }
}

function groupSearchResultDocuments(documents: CitedDocument[]) {
  const groups = new Map<
    Exclude<ResultSourceGroupId, "web">,
    CitedDocument[]
  >();

  for (const document of documents) {
    const groupId = resultSourceGroupIdForDocument(document);
    const existing = groups.get(groupId);
    if (existing) {
      existing.push(document);
    } else {
      groups.set(groupId, [document]);
    }
  }

  return RESULT_SOURCE_GROUP_ORDER.flatMap((groupId) => {
    if (groupId === "web") {
      return [];
    }
    const items = groups.get(groupId);
    if (!items?.length) {
      return [];
    }
    return [{ id: groupId, items, label: RESULT_SOURCE_GROUP_LABEL[groupId] }];
  });
}

function WebSourceChips({ sources }: { sources: WebSource[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sources.map((source) =>
        source.type === "url" ? (
          <a
            className={cn(
              activityChipClassName,
              "max-w-full gap-1 transition-colors hover:bg-muted"
            )}
            href={source.url}
            key={webSourceKey(source)}
            rel="noopener noreferrer"
            target="_blank"
            title={webSourceLabel(source)}
          >
            {(() => {
              const faviconUrl = getWebSourceFaviconUrl(source);
              return faviconUrl ? (
                <Image
                  alt=""
                  className="size-3 rounded-full"
                  height={12}
                  referrerPolicy="no-referrer"
                  src={faviconUrl}
                  unoptimized
                  width={12}
                />
              ) : (
                <FileSearchIcon className="size-3 shrink-0 text-muted-foreground" />
              );
            })()}
            <span className="max-w-40 truncate">{webSourceLabel(source)}</span>
          </a>
        ) : (
          <span
            className={cn(activityChipClassName, "max-w-full gap-1")}
            key={webSourceKey(source)}
            title={webSourceLabel(source)}
          >
            <DatabaseIcon className="size-3 shrink-0 text-muted-foreground" />
            <span className="max-w-40 truncate">{webSourceLabel(source)}</span>
          </span>
        )
      )}
    </div>
  );
}

function DocumentSourceChips({ documents }: { documents: CitedDocument[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {documents.map((document) => (
        <KnowledgeDocumentChip document={document} key={document.documentId} />
      ))}
    </div>
  );
}

function ResultSourceSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      <p className="font-medium text-muted-foreground text-xs">{label}</p>
      {children}
    </section>
  );
}

export function SearchResultsToolView({
  documents = [],
  sources = [],
  isFirst: _isFirst,
  isLast: _isLast,
}: SearchResultsToolViewProps) {
  const documentGroups = groupSearchResultDocuments(documents);
  const hasWeb = sources.length > 0;
  const sectionCount = documentGroups.length + (hasWeb ? 1 : 0);
  const showSections = sectionCount > 1;
  const hasResults = documents.length > 0 || hasWeb;

  const body = hasResults ? (
    <ToolCardSurface>
      {showSections ? (
        <div className="flex flex-col">
          {documentGroups.map((group, index) => (
            <ToolCardSection
              divider={index > 0}
              key={group.id}
              tinted={index > 0}
            >
              <ResultSourceSection label={group.label}>
                <DocumentSourceChips documents={group.items} />
              </ResultSourceSection>
            </ToolCardSection>
          ))}
          {hasWeb ? (
            <ToolCardSection divider tinted>
              <ResultSourceSection label={RESULT_SOURCE_GROUP_LABEL.web}>
                <WebSourceChips sources={sources} />
              </ResultSourceSection>
            </ToolCardSection>
          ) : null}
        </div>
      ) : (
        <ToolCardSection>
          {documents.length > 0 ? (
            <DocumentSourceChips documents={documents} />
          ) : null}
          {hasWeb ? <WebSourceChips sources={sources} /> : null}
        </ToolCardSection>
      )}
    </ToolCardSurface>
  ) : null;

  return (
    <ToolCallCard
      defaultOpen={false}
      dense
      expandable={hasResults}
      label="Results"
      leadingIcon={<ResultsStepIcon />}
      status="completed"
    >
      {body}
    </ToolCallCard>
  );
}
