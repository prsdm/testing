export function SidebarUnreadBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  const label = count > 99 ? "99+" : String(count);

  return (
    <span className="ml-auto shrink-0 rounded-full bg-primary px-1.5 py-0.5 font-semibold text-[11px] text-primary-foreground leading-none tabular-nums">
      <span className="sr-only">{label} unread</span>
      <span aria-hidden>{label}</span>
    </span>
  );
}
