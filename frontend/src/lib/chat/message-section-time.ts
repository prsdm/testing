const SECTION_TIME_GAP_MS = 60 * 60 * 1000;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatSectionClockTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
  }).format(date);
}

export function formatMessageSectionTime(
  createdAt: string,
  now = new Date()
): string | null {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const time = formatSectionClockTime(date);

  if (isSameDay(date, now)) {
    return `Today ${time}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    return `Yesterday ${time}`;
  }

  const datePart = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    weekday: "short",
  }).format(date);

  return `${datePart} at ${time}`;
}

export function shouldShowMessageSectionTime(
  currentAt: string | undefined,
  previousAt: string | undefined
): boolean {
  if (!currentAt) {
    return false;
  }

  if (!previousAt) {
    return true;
  }

  const current = new Date(currentAt);
  const previous = new Date(previousAt);
  if (Number.isNaN(current.getTime()) || Number.isNaN(previous.getTime())) {
    return true;
  }

  if (!isSameDay(current, previous)) {
    return true;
  }

  return current.getTime() - previous.getTime() > SECTION_TIME_GAP_MS;
}

export function getMessageSectionAnchor(message: {
  metadata?: { createdAt?: string };
}): string | undefined {
  return message.metadata?.createdAt;
}
