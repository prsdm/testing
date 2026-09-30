import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";
import { formatConnectorFocusInstruction } from "@/shared/connectors/composer-connector-focus";

const COMPOSER_MENTION_HANDLE = /\B@([\w.-]+)/g;

export function composerFocusKey(focus: ComposerConnectorFocus): string {
  switch (focus.kind) {
    case "work-skill":
      return `work-skill:${focus.skillId}`;
    case "google-app":
      return `google-app:${focus.appId}`;
    case "provider":
      return `provider:${focus.provider}`;
    case "mcp":
      return `mcp:${focus.serverId}`;
    default: {
      const _exhaustive: never = focus;
      return _exhaustive;
    }
  }
}

export function mergeComposerConnectorFocuses(
  ...entries: Array<
    ComposerConnectorFocus | ComposerConnectorFocus[] | null | undefined
  >
): ComposerConnectorFocus[] {
  const seen = new Set<string>();
  const merged: ComposerConnectorFocus[] = [];
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    const list = Array.isArray(entry) ? entry : [entry];
    for (const focus of list) {
      const key = composerFocusKey(focus);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(focus);
    }
  }
  return merged;
}

export function resolveComposerConnectorFocusesFromText(
  text: string,
  targets: Array<{ handle: string; focus: ComposerConnectorFocus }>
): ComposerConnectorFocus[] {
  if (!text.trim() || targets.length === 0) {
    return [];
  }
  const handleToFocus = new Map<string, ComposerConnectorFocus>();
  for (const target of targets) {
    handleToFocus.set(target.handle.toLowerCase(), target.focus);
    if (target.focus.kind === "work-skill") {
      handleToFocus.set(target.focus.skillId.toLowerCase(), target.focus);
    }
  }
  const ordered: ComposerConnectorFocus[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(COMPOSER_MENTION_HANDLE)) {
    const rawHandle = match[1];
    if (!rawHandle) {
      continue;
    }
    const focus = handleToFocus.get(rawHandle.toLowerCase());
    if (!focus) {
      continue;
    }
    const key = composerFocusKey(focus);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    ordered.push(focus);
  }
  return ordered;
}

export function normalizeComposerConnectorFocuses(args: {
  focuses?: ComposerConnectorFocus[] | null;
  legacyFocus?: ComposerConnectorFocus | null;
  messageText?: string;
  mentionTargets?: Array<{ handle: string; focus: ComposerConnectorFocus }>;
}): ComposerConnectorFocus[] {
  return mergeComposerConnectorFocuses(
    args.focuses,
    args.legacyFocus,
    args.messageText && args.mentionTargets
      ? resolveComposerConnectorFocusesFromText(
          args.messageText,
          args.mentionTargets
        )
      : []
  );
}

export function formatConnectorFocusInstructions(
  focuses: ComposerConnectorFocus[]
): string | null {
  if (focuses.length === 0) {
    return null;
  }
  if (focuses.length === 1) {
    const only = focuses[0];
    return only ? formatConnectorFocusInstruction(only) : null;
  }
  const lines = focuses.map(
    (focus, index) => `${index + 1}. ${formatConnectorFocusInstruction(focus)}`
  );
  return [
    "The user scoped this turn to multiple tools via @ mentions. Each line is one scope; the union of their tools is available:",
    "",
    ...lines,
  ].join("\n");
}
