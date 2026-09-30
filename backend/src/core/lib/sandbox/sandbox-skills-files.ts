import crypto from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORK_SKILL_CATALOG,
  WORK_SKILL_IDS,
  WORK_SKILL_PATH_ALIASES,
  type WorkSkillId,
} from "@/shared/sandbox/work-skill-catalog";

/** Session-relative skills root synced into each chat workspace. */
export const KIMIRO_SKILLS_REL_PATH = ".kimiro/skills";

export const SLIDES_SKILL_DOC_PATH = `${KIMIRO_SKILLS_REL_PATH}/slides/SKILL.md`;

export const XLSX_SKILL_DOC_PATH = `${KIMIRO_SKILLS_REL_PATH}/xlsx/SKILL.md`;

export const DOCS_SKILL_DOC_PATH = `${KIMIRO_SKILLS_REL_PATH}/docs/SKILL.md`;

export const PDF_SKILL_DOC_PATH = `${KIMIRO_SKILLS_REL_PATH}/pdf/SKILL.md`;

export const BUILTIN_WORK_SKILL_IDS = WORK_SKILL_IDS;
export type BuiltinWorkSkillId = WorkSkillId;

export type SandboxSkillFileSet = Record<string, Buffer>;

const ACTION_AVAILABILITY_PLACEHOLDER = "{{ACTION_AVAILABILITY_SECTION}}";

const EXCLUDED_DIR_NAMES = new Set(["__pycache__"]);

export function getBuiltinSkillsRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "skills/builtin");
}

export function renderSkillTemplate(template: string): string {
  if (!template.includes(ACTION_AVAILABILITY_PLACEHOLDER)) {
    return template;
  }
  return template.replace(`${ACTION_AVAILABILITY_PLACEHOLDER}\n\n`, "");
}

function collectSkillFiles(
  skillId: string,
  skillDir: string
): SandboxSkillFileSet {
  const files: SandboxSkillFileSet = {};

  for (const entry of walkFiles(skillDir)) {
    const relativePath = entry.slice(skillDir.length + 1);
    if (relativePath.includes("/.")) {
      continue;
    }

    if (entry.endsWith(".template")) {
      if (entry.endsWith("SKILL.md.template")) {
        const rendered = renderSkillTemplate(readFileSync(entry, "utf8"));
        files[`${skillId}/SKILL.md`] = Buffer.from(rendered, "utf8");
      }
      continue;
    }

    files[`${skillId}/${relativePath}`] = readFileSync(entry);
  }

  return files;
}

function walkFiles(rootDir: string): string[] {
  const paths: string[] = [];

  for (const entry of readdirSync(rootDir)) {
    if (EXCLUDED_DIR_NAMES.has(entry) || entry.startsWith(".")) {
      continue;
    }

    const fullPath = join(rootDir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      paths.push(...walkFiles(fullPath));
      continue;
    }
    if (stat.isFile()) {
      paths.push(fullPath);
    }
  }

  return paths;
}

/** Flat `{skillId}/...` map for syncing into `.kimiro/skills/`. */
export function buildBuiltinWorkSkillFileSet(
  enabledSkillIds: readonly WorkSkillId[] = BUILTIN_WORK_SKILL_IDS
): SandboxSkillFileSet {
  const root = getBuiltinSkillsRoot();
  const files: SandboxSkillFileSet = {};

  for (const skillId of enabledSkillIds) {
    const skillDir = join(root, skillId);
    Object.assign(files, collectSkillFiles(skillId, skillDir));
  }

  for (const [alias, skillId] of Object.entries(WORK_SKILL_PATH_ALIASES)) {
    if (!enabledSkillIds.includes(skillId)) {
      continue;
    }
    for (const [path, content] of Object.entries(files)) {
      if (path === `${skillId}/SKILL.md` || path.startsWith(`${skillId}/`)) {
        files[`${alias}/${path.slice(skillId.length + 1)}`] = content;
      }
    }
  }

  return files;
}

export function computeBuiltinWorkSkillsHash(
  files: SandboxSkillFileSet = buildBuiltinWorkSkillFileSet()
): string {
  const digest = crypto.createHash("sha256");

  for (const filePath of Object.keys(files).sort()) {
    const content = files[filePath];
    digest.update(Buffer.from(filePath, "utf8"));
    digest.update(content);
  }

  return digest.digest("hex");
}

export function buildWorkSkillsList(): string {
  return BUILTIN_WORK_SKILL_IDS.map((skillId) => {
    const entry = WORK_SKILL_CATALOG.find((skill) => skill.id === skillId);
    const label = entry?.name ?? skillId;
    return `- \`${skillId}/\` (${label}) — \`${KIMIRO_SKILLS_REL_PATH}/${skillId}/SKILL.md\``;
  }).join("\n");
}

/** Rendered SKILL.md body for a bundled work skill. */
export function getBundledSkillMarkdown(skillId: string): string | null {
  const files = buildBuiltinWorkSkillFileSet();
  const content = files[`${skillId}/SKILL.md`];
  return content ? content.toString("utf8") : null;
}
