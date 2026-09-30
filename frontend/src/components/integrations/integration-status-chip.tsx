export function IntegrationStatusChip({
  label,
}: {
  label: "Active" | "Recommended";
}) {
  return (
    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-[10px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
      {label}
    </span>
  );
}

export function NotConfiguredStatusChip() {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
      Not configured
    </span>
  );
}
