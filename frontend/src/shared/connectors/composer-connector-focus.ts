import type { ConnectorProvider } from "@/contracts/connectors";
import type { GoogleAppId } from "@/shared/connectors/providers/google-shared/apps";
import {
  isWorkSkillId,
  type WorkSkillId,
  workSkillMentionHandle,
} from "@/shared/sandbox/work-skill-catalog";

export type ComposerConnectorFocus =
  | {
      kind: "work-skill";
      skillId: WorkSkillId;
      name: string;
    }
  | {
      kind: "google-app";
      appId: GoogleAppId;
      name: string;
      provider: ConnectorProvider;
    }
  | {
      kind: "provider";
      provider: ConnectorProvider;
      name: string;
    }
  | {
      kind: "mcp";
      serverId: string;
      name: string;
    };

const PENDING_CONNECTOR_FOCUS_KEY = "kimiro.pendingConnectorFocus";

export function connectorFocusMentionHandle(
  focus: ComposerConnectorFocus
): string {
  switch (focus.kind) {
    case "work-skill":
      return workSkillMentionHandle(focus.skillId);
    case "google-app":
      return focus.provider;
    case "provider":
      return focus.provider;
    case "mcp":
      return focus.name.replace(/\s+/g, "").slice(0, 32).toLowerCase() || "mcp";
    default: {
      const _exhaustive: never = focus;
      return _exhaustive;
    }
  }
}

export function connectorFocusMentionToken(focus: ComposerConnectorFocus) {
  return `@${connectorFocusMentionHandle(focus)}`;
}

export function prependConnectorMentionToInput(
  focus: ComposerConnectorFocus,
  input: string
) {
  const token = connectorFocusMentionToken(focus);
  const trimmed = input.trim();
  if (trimmed.toLowerCase().startsWith(token.toLowerCase())) {
    return input;
  }
  if (!trimmed) {
    return `${token} `;
  }
  return `${token} ${trimmed}`;
}

export function stashPendingConnectorFocus(focus: ComposerConnectorFocus) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(PENDING_CONNECTOR_FOCUS_KEY, JSON.stringify(focus));
}

export function clearPendingConnectorFocus() {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.removeItem(PENDING_CONNECTOR_FOCUS_KEY);
}

export function consumePendingConnectorFocus(): ComposerConnectorFocus | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  const raw = sessionStorage.getItem(PENDING_CONNECTOR_FOCUS_KEY);
  sessionStorage.removeItem(PENDING_CONNECTOR_FOCUS_KEY);
  if (!raw) {
    return null;
  }
  try {
    return parseComposerConnectorFocus(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function parseComposerConnectorFocus(
  value: unknown
): ComposerConnectorFocus | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const name = record.name;
  if (typeof name !== "string" || !name.trim()) {
    return null;
  }
  switch (record.kind) {
    case "work-skill":
      return typeof record.skillId === "string" && isWorkSkillId(record.skillId)
        ? { kind: "work-skill", name, skillId: record.skillId }
        : null;
    case "google-app":
      return typeof record.appId === "string" &&
        typeof record.provider === "string"
        ? {
            appId: record.appId as GoogleAppId,
            kind: "google-app",
            name,
            provider: record.provider as ConnectorProvider,
          }
        : null;
    case "provider":
      return typeof record.provider === "string"
        ? {
            kind: "provider",
            name,
            provider: record.provider as ConnectorProvider,
          }
        : null;
    case "mcp":
      return typeof record.serverId === "string"
        ? { kind: "mcp", name, serverId: record.serverId }
        : null;
    default:
      return null;
  }
}

export function connectorFocusLabel(focus: ComposerConnectorFocus) {
  return focus.name;
}

export function removeConnectorMentionFromInput(
  focus: ComposerConnectorFocus,
  input: string
) {
  const token = connectorFocusMentionToken(focus);
  const pattern = new RegExp(`^\\s*${escapeRegExp(token)}\\s*`, "i");
  return input.replace(pattern, "").trimStart();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
