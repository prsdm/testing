import type { ConnectorProvider } from "@/contracts/connectors";
import {
  type ComposerConnectorFocus,
  connectorFocusMentionHandle,
} from "@/shared/connectors/composer-connector-focus";
import type { ConnectorPanelItem } from "@/shared/connectors/connectors-panel-types";
import type { WorkSkillId } from "@/shared/sandbox/work-skill-catalog";

export type ConnectorMentionTarget = {
  handle: string;
  label: string;
  description: string;
  focus: ComposerConnectorFocus;
  icon:
    | { kind: "work-skill"; skillId: WorkSkillId }
    | { kind: "provider"; provider: ConnectorProvider }
    | { kind: "mcp" };
};

function connectorPanelItemFocus(
  item: ConnectorPanelItem
): ComposerConnectorFocus | null {
  switch (item.kind) {
    case "work-skill":
      return { kind: "work-skill", name: item.name, skillId: item.skillId };
    case "google-app":
      return {
        appId: item.initialStatus.appId,
        kind: "google-app",
        name: item.name,
        provider: item.initialStatus.uiProvider,
      };
    case "confluence":
      return { kind: "provider", name: item.name, provider: "confluence" };
    case "notion":
      return { kind: "provider", name: item.name, provider: "notion" };
    case "sharepoint":
      return { kind: "provider", name: item.name, provider: "sharepoint" };
    case "slack":
      return { kind: "provider", name: item.name, provider: "slack" };
    case "jira":
      return { kind: "provider", name: item.name, provider: "jira" };
    case "mcp":
      return {
        kind: "mcp",
        name: item.name,
        serverId: item.initialStatus.serverId,
      };
    default:
      return null;
  }
}

function connectorMentionIcon(
  item: ConnectorPanelItem
): ConnectorMentionTarget["icon"] | null {
  switch (item.kind) {
    case "work-skill":
      return { kind: "work-skill", skillId: item.skillId };
    case "google-app":
      return { kind: "provider", provider: item.initialStatus.uiProvider };
    case "confluence":
      return { kind: "provider", provider: "confluence" };
    case "notion":
      return { kind: "provider", provider: "notion" };
    case "sharepoint":
      return { kind: "provider", provider: "sharepoint" };
    case "slack":
      return { kind: "provider", provider: "slack" };
    case "jira":
      return { kind: "provider", provider: "jira" };
    case "mcp":
      return { kind: "mcp" };
    default:
      return null;
  }
}

/** Built-in work skills always appear; OAuth/MCP entries only when connected. */
export function isConnectorPanelItemMentionable(
  item: ConnectorPanelItem
): boolean {
  switch (item.kind) {
    case "work-skill":
      return true;
    case "google-app":
    case "confluence":
    case "notion":
    case "sharepoint":
    case "slack":
    case "jira":
    case "mcp":
      return item.initialStatus.connected;
    default:
      return false;
  }
}

export function buildConnectorMentionTargets(
  items: ConnectorPanelItem[]
): ConnectorMentionTarget[] {
  const targets: ConnectorMentionTarget[] = [];

  for (const item of items) {
    if (!isConnectorPanelItemMentionable(item)) {
      continue;
    }
    const focus = connectorPanelItemFocus(item);
    const icon = connectorMentionIcon(item);
    const handle = focus ? connectorFocusMentionHandle(focus) : null;
    if (!(focus && handle && icon)) {
      continue;
    }
    targets.push({
      description: item.description,
      focus,
      handle,
      icon,
      label: item.name,
    });
  }

  return targets.sort((a, b) => a.label.localeCompare(b.label));
}

export function filterConnectorMentionTargets(
  targets: ConnectorMentionTarget[],
  query: string
): ConnectorMentionTarget[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return targets;
  }
  return targets.filter((target) => {
    const legacyHandle =
      target.focus.kind === "work-skill" ? target.focus.skillId : "";
    const haystack = [
      target.label,
      target.handle,
      target.description,
      legacyHandle,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function connectorMentionHandleSet(
  targets: ConnectorMentionTarget[]
): Set<string> {
  return new Set(targets.map((target) => target.handle.toLowerCase()));
}
