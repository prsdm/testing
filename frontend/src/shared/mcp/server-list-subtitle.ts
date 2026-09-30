export function mcpServerListSubtitle(args: {
  description: string | null | undefined;
  serverUrl: string;
  transport: "sse" | "streamable_http";
  connectionsCount?: number;
}): string {
  const trimmed = args.description?.trim();
  if (trimmed) {
    return trimmed;
  }

  const transportLabel = args.transport === "sse" ? "SSE" : "Streamable HTTP";
  const parts = [args.serverUrl.trim(), transportLabel].filter(Boolean);

  if (typeof args.connectionsCount === "number") {
    parts.push(
      `${args.connectionsCount} connection${args.connectionsCount === 1 ? "" : "s"}`
    );
  }

  return parts.join(" · ");
}
