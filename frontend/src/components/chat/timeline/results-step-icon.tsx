import { cn } from "@/shared/utils";

/** Lucide `circle-small` (r=6). Not in lucide-react@0.446 yet. */
export function ResultsStepIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-4 text-muted-foreground", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <title>Results</title>
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}
