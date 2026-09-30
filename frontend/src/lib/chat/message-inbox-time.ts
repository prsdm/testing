import { format, formatDistanceToNowStrict, isToday } from "date-fns";

/** Long date for inbox row footer (Tolaria-style). */
export function formatInboxRowDate(
  createdAt: string | undefined
): string | null {
  if (!createdAt) {
    return null;
  }
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Relative time for inbox list rows (mail-style). */
export function formatInboxListTime(
  createdAt: string | undefined
): string | null {
  if (!createdAt) {
    return null;
  }
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

/** Full timestamp for thread detail header. */
export function formatInboxDetailTime(
  createdAt: string | undefined
): string | null {
  if (!createdAt) {
    return null;
  }
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return format(date, "PPpp");
}
