export function isMcpActionToolType(type: string): boolean {
  return type.startsWith("tool-mcp_");
}

export function mcpExecutableNameFromPartType(type: string): string | null {
  if (!isMcpActionToolType(type)) {
    return null;
  }
  return type.slice("tool-".length);
}

export function parseMcpExecutableToolName(executableName: string): {
  serverSlug: string;
  toolName: string;
} | null {
  if (!executableName.startsWith("mcp_")) {
    return null;
  }
  const rest = executableName.slice("mcp_".length);
  const separator = rest.indexOf("_");
  if (separator <= 0) {
    return null;
  }
  return {
    serverSlug: rest.slice(0, separator),
    toolName: rest.slice(separator + 1),
  };
}

export function humanizeMcpToolName(toolName: string): string {
  return humanizeMcpSegment(toolName);
}

function humanizeMcpSegment(segment: string): string {
  const normalized = segment.replace(/[_-]+/g, " ").trim();
  if (!normalized) {
    return segment;
  }
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatMcpToolCardLabel(meta: {
  serverLabel: string;
  toolLabel: string;
}): string {
  const { serverLabel, toolLabel } = meta;
  const serverKey = serverLabel.trim().toLowerCase();
  const toolKey = toolLabel.trim().toLowerCase();
  if (!serverKey) {
    return toolLabel;
  }
  if (
    toolKey === serverKey ||
    toolKey.endsWith(` ${serverKey}`) ||
    toolKey.startsWith(`${serverKey} `)
  ) {
    return toolLabel;
  }
  return `${toolLabel} · ${serverLabel}`;
}

export function getMcpToolDisplayMeta(partType: string): {
  serverLabel: string;
  toolLabel: string;
} {
  const executable = mcpExecutableNameFromPartType(partType);
  if (!executable) {
    return { serverLabel: "MCP", toolLabel: "Tool" };
  }
  const parsed = parseMcpExecutableToolName(executable);
  if (!parsed) {
    return { serverLabel: "MCP", toolLabel: humanizeMcpSegment(executable) };
  }
  return {
    serverLabel: humanizeMcpSegment(parsed.serverSlug),
    toolLabel: humanizeMcpSegment(parsed.toolName),
  };
}

export function sanitizeMcpToolOutputForDisplay(output: unknown): unknown {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return output;
  }
  const record = output as Record<string, unknown>;
  if (record.result !== undefined) {
    return record.result;
  }
  if (typeof record.error === "string") {
    return { error: record.error };
  }
  return output;
}
