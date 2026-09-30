import {
  publicAssetUrl,
  SANDBOX_WORK_SKILL_LOGOS,
} from "@/shared/assets/public-asset-url";
import type { LibraryPreviewKind } from "@/shared/library/library-preview-kind";

export const WORK_SKILL_IDS = ["slides", "xlsx", "docs", "pdf"] as const;

export type WorkSkillId = (typeof WORK_SKILL_IDS)[number];

/** Guessed folder names that resolve to canonical skill ids in the sandbox. */
export const WORK_SKILL_PATH_ALIASES: Record<string, WorkSkillId> = {
  spreadsheets: "xlsx",
};

export type WorkSkillCatalogEntry = {
  id: WorkSkillId;
  name: string;
  description: string;
};

export const WORK_SKILL_CATALOG: WorkSkillCatalogEntry[] = [
  {
    description: "Create and edit presentations",
    id: "slides",
    name: "Presentation",
  },
  {
    description: "Create and edit spreadsheets",
    id: "xlsx",
    name: "Spreadsheet",
  },
  {
    description: "Create and edit documents",
    id: "docs",
    name: "Document",
  },
  {
    description: "Read, create, and verify PDFs",
    id: "pdf",
    name: "PDF",
  },
];

export type SandboxWorkSkillsEnabled = Record<WorkSkillId, boolean>;

export const DEFAULT_SANDBOX_WORK_SKILLS_ENABLED: SandboxWorkSkillsEnabled = {
  docs: true,
  pdf: true,
  slides: true,
  xlsx: true,
};

export function isWorkSkillId(value: string): value is WorkSkillId {
  return (WORK_SKILL_IDS as readonly string[]).includes(value);
}

export function normalizeSandboxWorkSkillsEnabled(
  raw: unknown
): SandboxWorkSkillsEnabled {
  const normalized = { ...DEFAULT_SANDBOX_WORK_SKILLS_ENABLED };
  if (!raw || typeof raw !== "object") {
    return normalized;
  }

  const record = raw as Record<string, unknown>;

  for (const skillId of WORK_SKILL_IDS) {
    const value = record[skillId];
    if (typeof value === "boolean") {
      normalized[skillId] = value;
    }
  }

  return normalized;
}

export function listEnabledWorkSkillIds(
  enabled: SandboxWorkSkillsEnabled
): WorkSkillId[] {
  return WORK_SKILL_IDS.filter((skillId) => enabled[skillId]);
}

export function workSkillLogoUrl(skillId: WorkSkillId): string {
  return publicAssetUrl(SANDBOX_WORK_SKILL_LOGOS[skillId]);
}

export function workSkillPreviewKind(skillId: WorkSkillId): LibraryPreviewKind {
  switch (skillId) {
    case "slides":
      return "slides";
    case "xlsx":
      return "sheet";
    case "docs":
      return "text";
    case "pdf":
      return "pdf";
    default: {
      const _exhaustive: never = skillId;
      return _exhaustive;
    }
  }
}

/** User-facing format noun for sandbox tool cards (document, presentation, …). */
/** Composer @mention handle (matches catalog display name, e.g. presentation, document). */
export function workSkillMentionHandle(skillId: WorkSkillId): string {
  return getWorkSkillCatalogEntry(skillId).name.toLowerCase();
}

/** Map @mention handle (or legacy skill id) back to a work skill. */
export function resolveWorkSkillIdFromMentionHandle(
  handle: string
): WorkSkillId | null {
  const normalized = handle.trim().toLowerCase();
  for (const skillId of WORK_SKILL_IDS) {
    if (workSkillMentionHandle(skillId) === normalized) {
      return skillId;
    }
  }
  if (isWorkSkillId(normalized)) {
    return normalized;
  }
  return WORK_SKILL_PATH_ALIASES[normalized] ?? null;
}

export function workSkillFormatNoun(skillId: WorkSkillId): string {
  switch (skillId) {
    case "slides":
      return "presentation";
    case "xlsx":
      return "spreadsheet";
    case "docs":
      return "document";
    case "pdf":
      return "PDF";
    default: {
      const _exhaustive: never = skillId;
      return _exhaustive;
    }
  }
}

export function getWorkSkillCatalogEntry(
  skillId: WorkSkillId
): WorkSkillCatalogEntry {
  const entry = WORK_SKILL_CATALOG.find((skill) => skill.id === skillId);
  if (!entry) {
    throw new Error(`Unknown work skill: ${skillId}`);
  }
  return entry;
}

export function inferSandboxWorkSkillId(code: string): WorkSkillId | null {
  const match = code.match(/\.kimiro\/skills\/([a-z0-9-]+)(?:\/|$)/);
  const skillId = match?.[1];
  if (!skillId) {
    return null;
  }
  if (isWorkSkillId(skillId)) {
    return skillId;
  }
  return WORK_SKILL_PATH_ALIASES[skillId] ?? null;
}
