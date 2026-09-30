"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils";

export const MIN_INDEXED_CONTENT_MB = 1;
export const MAX_INDEXED_CONTENT_MB = 250;

function clampIndexedSizeMb(value: number) {
  return Math.min(
    MAX_INDEXED_CONTENT_MB,
    Math.max(MIN_INDEXED_CONTENT_MB, value)
  );
}

function parseIndexedSizeMb(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return MIN_INDEXED_CONTENT_MB;
  }
  return clampIndexedSizeMb(parsed);
}

export function IndexingSizeControl({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const numericValue = parseIndexedSizeMb(value);

  const setValue = (next: number) => {
    onChange(String(clampIndexedSizeMb(next)));
  };

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <Button
        aria-label="Decrease indexing limit"
        className="shrink-0 border-border bg-transparent hover:bg-muted/50"
        disabled={numericValue <= MIN_INDEXED_CONTENT_MB}
        onClick={() => setValue(numericValue - 1)}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <MinusIcon className="size-4" />
      </Button>

      <input
        aria-label="Maximum indexed file size in megabytes"
        aria-valuemax={MAX_INDEXED_CONTENT_MB}
        aria-valuemin={MIN_INDEXED_CONTENT_MB}
        aria-valuenow={numericValue}
        className="h-1.5 w-28 cursor-pointer appearance-none rounded-full bg-border accent-foreground sm:w-32 [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-sm [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:bg-foreground"
        max={MAX_INDEXED_CONTENT_MB}
        min={MIN_INDEXED_CONTENT_MB}
        onChange={(event) => setValue(Number.parseInt(event.target.value, 10))}
        type="range"
        value={numericValue}
      />

      <span className="min-w-12 text-right font-medium text-sm tabular-nums">
        {numericValue} MB
      </span>

      <Button
        aria-label="Increase indexing limit"
        className="shrink-0 border-border bg-transparent hover:bg-muted/50"
        disabled={numericValue >= MAX_INDEXED_CONTENT_MB}
        onClick={() => setValue(numericValue + 1)}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <PlusIcon className="size-4" />
      </Button>
    </div>
  );
}

export { clampIndexedSizeMb, parseIndexedSizeMb };
