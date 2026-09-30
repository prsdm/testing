/** Normalize tool input into Slack's Unix timestamp string (seconds with optional decimals). */
export function normalizeSlackTimestamp(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      return;
    }
    if (numeric > 1e12) {
      return String(numeric / 1000);
    }
    return trimmed;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const ms = Date.parse(`${trimmed}T00:00:00.000Z`);
    if (Number.isFinite(ms)) {
      return `${ms / 1000}.000000`;
    }
  }

  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed)) {
    return `${parsed / 1000}.000000`;
  }
}

export function startOfUtcDayTimestamp(date = new Date()) {
  const start = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
  return `${start / 1000}.000000`;
}

/** Normalize Slack message ts / thread_ts (e.g. 1718890000.123456 or permalink compact form). */
export function normalizeSlackMessageTs(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return;
  }

  const withoutPrefix = trimmed.replace(/^p(?=\d)/, "");

  if (/^\d+\.\d+$/.test(withoutPrefix)) {
    return withoutPrefix;
  }

  if (/^\d{16}$/.test(withoutPrefix)) {
    return `${withoutPrefix.slice(0, 10)}.${withoutPrefix.slice(10)}`;
  }

  if (/^\d{10}$/.test(withoutPrefix)) {
    return `${withoutPrefix}.000000`;
  }

  return withoutPrefix;
}
