import { normalizeSlackMessageTs } from "@/core/lib/connectors/providers/slack/slack-timestamp";

function optionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

const THREAD_TS_KEYS = [
  "threadTs",
  "thread_ts",
  "parentTs",
  "parentMessageTs",
  "replyToTs",
] as const;

export function pickThreadTsFromInput(
  merged: Record<string, unknown>,
  options?: { allowMessageTs?: boolean }
) {
  for (const key of THREAD_TS_KEYS) {
    const normalized = normalizeSlackMessageTs(optionalString(merged[key]));
    if (normalized) {
      return normalized;
    }
  }

  if (options?.allowMessageTs) {
    return normalizeSlackMessageTs(optionalString(merged.messageTs));
  }
}
