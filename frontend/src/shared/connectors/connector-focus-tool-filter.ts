import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";

/** Built-ins kept available when focus is a sandbox work skill (Document, PDF, …). */
const WORK_SKILL_FOCUS_BUILT_INS = new Set([
  "todoWrite",
  "listLibrary",
  "saveToLibrary",
  "importLibraryToSandbox",
  "sandboxExec",
]);

/** Built-ins kept when focus is an OAuth connector or MCP server. */
const INTEGRATION_FOCUS_BUILT_INS = new Set(["todoWrite"]);

export function builtInToolAllowedForConnectorFocus(
  toolName: string,
  focus: ComposerConnectorFocus | null | undefined
): boolean {
  if (!focus) {
    return true;
  }
  if (focus.kind === "work-skill") {
    return WORK_SKILL_FOCUS_BUILT_INS.has(toolName);
  }
  return INTEGRATION_FOCUS_BUILT_INS.has(toolName);
}

export function connectorToolAllowedForConnectorFocus(
  connector: { providerId: string },
  focus: ComposerConnectorFocus | null | undefined
): boolean {
  if (!focus) {
    return true;
  }
  if (focus.kind === "provider" || focus.kind === "google-app") {
    return connector.providerId === focus.provider;
  }
  return false;
}

export function mcpToolAllowedForConnectorFocus(
  mcp: { serverId: string },
  focus: ComposerConnectorFocus | null | undefined
): boolean {
  if (!focus) {
    return true;
  }
  if (focus.kind === "mcp") {
    return mcp.serverId === focus.serverId;
  }
  return false;
}

export function builtInToolAllowedForConnectorFocuses(
  toolName: string,
  focuses: ComposerConnectorFocus[] | null | undefined
): boolean {
  if (!focuses?.length) {
    return true;
  }
  return focuses.some((focus) =>
    builtInToolAllowedForConnectorFocus(toolName, focus)
  );
}

export function connectorToolAllowedForConnectorFocuses(
  connector: { providerId: string },
  focuses: ComposerConnectorFocus[] | null | undefined
): boolean {
  if (!focuses?.length) {
    return true;
  }
  return focuses.some((focus) =>
    connectorToolAllowedForConnectorFocus(connector, focus)
  );
}

export function mcpToolAllowedForConnectorFocuses(
  mcp: { serverId: string },
  focuses: ComposerConnectorFocus[] | null | undefined
): boolean {
  if (!focuses?.length) {
    return true;
  }
  return focuses.some((focus) => mcpToolAllowedForConnectorFocus(mcp, focus));
}
