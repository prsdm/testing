import fs from "node:fs/promises";
import path from "node:path";
import {
  BUILTIN_WORK_SKILL_IDS,
  buildBuiltinWorkSkillFileSet,
  computeBuiltinWorkSkillsHash,
  KIMIRO_SKILLS_REL_PATH,
} from "@/core/lib/sandbox/sandbox-skills-files";
import type { WorkSkillId } from "@/shared/sandbox/work-skill-catalog";

const SKILLS_HASH_MARKER = ".skills-hash";

export function getSessionSkillsRoot(sessionRoot: string): string {
  return path.join(sessionRoot, ...KIMIRO_SKILLS_REL_PATH.split("/"));
}

export async function ensureSandboxSkillsInSession(
  sessionRoot: string,
  enabledSkillIds: readonly WorkSkillId[] = BUILTIN_WORK_SKILL_IDS
): Promise<void> {
  const files = buildBuiltinWorkSkillFileSet(enabledSkillIds);
  const desiredHash = computeBuiltinWorkSkillsHash(files);
  const kimiroRoot = path.join(sessionRoot, ".kimiro");
  const skillsRoot = getSessionSkillsRoot(sessionRoot);
  const hashPath = path.join(kimiroRoot, SKILLS_HASH_MARKER);

  let currentHash = "";
  try {
    currentHash = (await fs.readFile(hashPath, "utf8")).trim();
  } catch {
    currentHash = "";
  }

  if (currentHash !== desiredHash) {
    await fs.mkdir(skillsRoot, { recursive: true });
    await Promise.all(
      Object.entries(files).map(async ([relativePath, content]) => {
        const destination = path.join(skillsRoot, relativePath);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, content);
      })
    );
    await fs.mkdir(kimiroRoot, { recursive: true });
    await fs.writeFile(hashPath, desiredHash, "utf8");
  }
}
