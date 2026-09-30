export function slugifyMcpServerName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "mcp-server";
}

export function mcpExecutableToolName(serverSlug: string, toolName: string) {
  const safeServer = serverSlug.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40);
  const safeTool = toolName.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
  return `mcp_${safeServer}_${safeTool}`.slice(0, 128);
}
