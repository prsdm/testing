"use client";

import { AlertCircleIcon } from "lucide-react";

export function SidebarListError({
  label,
  onRetry,
}: {
  label: string;
  onRetry: () => void;
}) {
  return (
    <button
      className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-[13px] text-destructive/90 hover:text-destructive"
      onClick={onRetry}
      type="button"
    >
      <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
