type ToolLike = {
  toolName?: string;
  input?: unknown;
  args?: unknown;
  output?: unknown;
  result?: unknown;
};

export type MeteredToolPart = {
  type?: string;
  input?: unknown;
  output?: unknown;
  state?: string;
  errorText?: string;
};

function countQueriesInPayload(payload: unknown): number {
  if (!payload || typeof payload !== "object") {
    return 0;
  }
  const record = payload as { queries?: unknown; query?: unknown };
  if (Array.isArray(record.queries)) {
    return Math.max(1, record.queries.length);
  }
  if (typeof record.query === "string" && record.query.trim()) {
    return 1;
  }
  return 0;
}

/** Count web-search API calls from AI SDK step tool results/calls. */
export function countWebSearchesFromSteps(
  steps: Array<{ toolResults?: ToolLike[]; toolCalls?: ToolLike[] }> | undefined
) {
  if (!steps?.length) {
    return 0;
  }
  let count = 0;
  for (const step of steps) {
    for (const toolResult of step.toolResults ?? []) {
      if (toolResult.toolName !== "webSearch") {
        continue;
      }
      const fromInput =
        countQueriesInPayload(toolResult.input) ||
        countQueriesInPayload(toolResult.args);
      count += fromInput > 0 ? fromInput : 1;
    }
    if ((step.toolResults ?? []).some((t) => t.toolName === "webSearch")) {
      continue;
    }
    for (const toolCall of step.toolCalls ?? []) {
      if (toolCall.toolName !== "webSearch") {
        continue;
      }
      const fromInput =
        countQueriesInPayload(toolCall.input) ||
        countQueriesInPayload(toolCall.args);
      count += fromInput > 0 ? fromInput : 1;
    }
  }
  return count;
}

/** Count web-search API calls from tool UI parts. */
export function countWebSearchesFromToolParts(
  toolParts: Array<{ type?: string; input?: unknown; output?: unknown }>
) {
  let count = 0;
  for (const part of toolParts) {
    const type = typeof part.type === "string" ? part.type : "";
    if (!type.includes("webSearch")) {
      continue;
    }
    const fromInput =
      countQueriesInPayload(part.input) ||
      countQueriesInPayload(
        part.output && typeof part.output === "object"
          ? (part.output as { input?: unknown }).input
          : null
      );
    count += fromInput > 0 ? fromInput : 1;
  }
  return count;
}

function isSuccessfulGenerateImageOutput(
  output: unknown
): output is { url: string } {
  if (!output || typeof output !== "object") {
    return false;
  }
  const record = output as { url?: unknown; error?: unknown };
  if (typeof record.error === "string" && record.error.trim()) {
    return false;
  }
  return typeof record.url === "string" && record.url.trim().length > 0;
}

export type BillableImageGeneration = {
  size?: string;
};

export type MeteredSandboxExec = {
  durationMs: number;
};

function isSuccessfulSandboxExecOutput(
  output: unknown
): output is { exitCode: number | null; durationMs?: number } {
  if (!output || typeof output !== "object") {
    return false;
  }
  const record = output as {
    exitCode?: unknown;
    error?: unknown;
    durationMs?: unknown;
  };
  if (typeof record.error === "string" && record.error.trim()) {
    return false;
  }
  if (record.exitCode !== 0) {
    return false;
  }
  return true;
}

/** Successful sandboxExec tool calls metered this turn (failed calls excluded). */
export function listMeteredSandboxExecsFromToolParts(
  toolParts: MeteredToolPart[]
): MeteredSandboxExec[] {
  const execs: MeteredSandboxExec[] = [];
  for (const part of toolParts) {
    const type = typeof part.type === "string" ? part.type : "";
    if (!type.includes("sandboxExec")) {
      continue;
    }
    if (part.state === "output-error") {
      continue;
    }
    if (typeof part.errorText === "string" && part.errorText.trim()) {
      continue;
    }
    if (!isSuccessfulSandboxExecOutput(part.output)) {
      continue;
    }
    const output = part.output as { durationMs?: unknown };
    const durationMs =
      typeof output.durationMs === "number" &&
      Number.isFinite(output.durationMs)
        ? Math.max(0, Math.round(output.durationMs))
        : 0;
    execs.push({ durationMs });
  }
  return execs;
}

export function sumSandboxExecDurationMsFromToolParts(
  toolParts: MeteredToolPart[]
): number {
  return listMeteredSandboxExecsFromToolParts(toolParts).reduce(
    (total, entry) => total + entry.durationMs,
    0
  );
}

/** Successful generateImage tool calls billable this turn (failed calls excluded). */
export function listBillableImageGenerationsFromToolParts(
  toolParts: MeteredToolPart[]
): BillableImageGeneration[] {
  const generations: BillableImageGeneration[] = [];
  for (const part of toolParts) {
    const type = typeof part.type === "string" ? part.type : "";
    if (!type.includes("generateImage")) {
      continue;
    }
    if (part.state === "output-error") {
      continue;
    }
    if (typeof part.errorText === "string" && part.errorText.trim()) {
      continue;
    }
    if (!isSuccessfulGenerateImageOutput(part.output)) {
      continue;
    }
    const input =
      part.input && typeof part.input === "object"
        ? (part.input as { size?: unknown })
        : {};
    const size = typeof input.size === "string" ? input.size : undefined;
    generations.push(size ? { size } : {});
  }
  return generations;
}
