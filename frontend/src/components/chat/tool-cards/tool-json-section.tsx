"use client";

export function ToolJsonSection({ value }: { value: unknown }) {
  return (
    <pre className="whitespace-pre-wrap wrap-break-word font-mono text-[0.75rem] text-muted-foreground leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
