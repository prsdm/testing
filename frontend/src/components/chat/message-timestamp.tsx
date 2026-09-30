export function formatMessageTime(createdAt?: string): string | null {
  if (!createdAt) {
    return null;
  }
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
  }).format(date);
}

type MessageTimestampProps = {
  align?: "start" | "end";
  createdAt?: string;
  editedAt?: string;
};

export function MessageTimestamp({
  align = "start",
  createdAt,
  editedAt,
}: MessageTimestampProps) {
  const timeLabel = formatMessageTime(editedAt ?? createdAt);
  if (!(timeLabel || editedAt)) {
    return null;
  }

  const baseClass =
    align === "end"
      ? "text-[11px] text-muted-foreground/70 tabular-nums"
      : "shrink-0 text-muted-foreground text-xs tabular-nums";

  return (
    <span className={baseClass}>
      {timeLabel ? <span>{timeLabel}</span> : null}
      {editedAt ? <span>{timeLabel ? " " : ""}(edited)</span> : null}
    </span>
  );
}
