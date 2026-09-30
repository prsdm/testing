import type {
  CitedDocument,
  InternalSearchToolOutput,
} from "@/shared/search/citations";
import type { InternalSearchStep } from "@/shared/search/types";

export function extractKnowledgeSearchQueries(
  output?: InternalSearchToolOutput
): string[] {
  if (!output?.steps) {
    return [];
  }
  const queries: string[] = [];
  for (const rawStep of output.steps) {
    const step = rawStep as InternalSearchStep;
    if (step.type === "queries" && Array.isArray(step.queries)) {
      queries.push(
        ...step.queries.filter((query) => typeof query === "string")
      );
    }
  }
  return queries;
}

export function extractKnowledgeSearchDocuments(
  output?: InternalSearchToolOutput
): CitedDocument[] {
  return output?.documents ?? [];
}

export function extractSearchQueriesFromInput(input: unknown): string[] {
  if (typeof input !== "object" || input === null) {
    return [];
  }

  const record = input as Record<string, unknown>;

  if (typeof record.query === "string" && record.query.trim()) {
    return [record.query.trim()];
  }

  if (Array.isArray(record.queries)) {
    return record.queries.filter(
      (query): query is string =>
        typeof query === "string" && query.trim().length > 0
    );
  }

  return [];
}

export function extractKnowledgeBaseNameFromInput(
  input: unknown
): string | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const knowledgeBaseName = (input as Record<string, unknown>)
    .knowledgeBaseName;
  return typeof knowledgeBaseName === "string" && knowledgeBaseName.trim()
    ? knowledgeBaseName.trim()
    : undefined;
}

export function resolveSearchDisplayQueries(
  input: unknown,
  output?: unknown
): string[] {
  const fromOutput = extractKnowledgeSearchQueries(
    output as InternalSearchToolOutput | undefined
  );
  if (fromOutput.length > 0) {
    return fromOutput;
  }
  const fromOutputQuery = extractSearchQueriesFromInput(output);
  if (fromOutputQuery.length > 0) {
    return fromOutputQuery;
  }
  return extractSearchQueriesFromInput(input);
}

export function sanitizeSearchInputForDisplay(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    return input;
  }
  return input;
}

export function sanitizeSearchOutputForDisplay(output: unknown): unknown {
  if (typeof output !== "object" || output === null) {
    return output;
  }

  const { contextForLlm: _contextForLlm, ...rest } = output as Record<
    string,
    unknown
  >;
  return rest;
}

/** Tool execute wrappers may nest the UI payload under `output`. */
export function unwrapSearchToolResultOutput(output: unknown): unknown {
  if (typeof output !== "object" || output === null) {
    return output;
  }
  const record = output as Record<string, unknown>;
  const nested = record.output;
  if (typeof nested === "object" && nested !== null) {
    return nested;
  }
  return output;
}

export function searchToolHasExpandableBody(args: {
  input?: unknown;
  output?: unknown;
  isPending?: boolean;
}): boolean {
  if (args.isPending) {
    return false;
  }

  const displayOutput = sanitizeSearchOutputForDisplay(
    unwrapSearchToolResultOutput(args.output)
  );

  const hasInput =
    typeof args.input === "object" &&
    args.input !== null &&
    Object.keys(args.input as object).length > 0;

  const hasOutput =
    typeof displayOutput === "object" &&
    displayOutput !== null &&
    Object.keys(displayOutput as object).length > 0;

  return hasInput || hasOutput;
}

export function formatSearchQueryChip(queries: string[]): string | undefined {
  const trimmed = queries
    .map((query) => query.trim())
    .filter((query) => query.length > 0);
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length === 1) {
    return trimmed[0];
  }
  if (trimmed.length === 2) {
    return `${trimmed[0]}, ${trimmed[1]}`;
  }
  return `${trimmed[0]}, ${trimmed[1]} +${trimmed.length - 2}`;
}

export function resolveSearchStepSummary(args: {
  variant: "knowledge" | "web" | "people";
  isPending: boolean;
  isInterrupted?: boolean;
  isKnowledgeBaseScope?: boolean;
  input?: unknown;
  output?: unknown;
}): {
  title: string;
  pendingLabel: string;
  isPendingLabel: boolean;
} {
  const pendingLabel =
    args.variant === "knowledge" && args.isKnowledgeBaseScope
      ? KNOWLEDGE_BASE_SEARCH_PENDING_LABEL
      : args.variant === "web"
        ? "Searching web"
        : args.variant === "people"
          ? "Searching people"
          : SEARCH_PENDING_LABEL;

  if (args.isInterrupted) {
    let title = "Stopped";
    if (args.variant === "web") {
      title = "Search stopped";
    } else if (args.variant === "people") {
      title = "People search stopped";
    } else if (args.isKnowledgeBaseScope) {
      title = "Knowledge base search stopped";
    }

    return {
      isPendingLabel: false,
      pendingLabel,
      title,
    };
  }

  if (args.isPending) {
    return {
      isPendingLabel: true,
      pendingLabel,
      title: pendingLabel,
    };
  }

  let title = "Searched";
  if (args.variant === "web") {
    title = "Searched web";
  } else if (args.variant === "people") {
    title = "Searched people";
  } else if (args.variant === "knowledge" && args.isKnowledgeBaseScope) {
    title = "Searched knowledge base";
  }

  return {
    isPendingLabel: false,
    pendingLabel,
    title,
  };
}

export const SEARCH_PENDING_LABEL = "Searching…";
export const KNOWLEDGE_BASE_SEARCH_PENDING_LABEL = "Searching knowledge base…";

export const SEARCH_FOR_STEP_TITLE = "Searching for";
export const SEARCHED_FOR_STEP_TITLE = "Searched for";
export const KNOWLEDGE_BASE_SEARCH_FOR_STEP_TITLE =
  "Searching knowledge base for";
export const KNOWLEDGE_BASE_SEARCHED_FOR_STEP_TITLE =
  "Searched knowledge base for";
