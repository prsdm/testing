import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  buildBuiltinWorkSkillFileSet,
  KIMIRO_SKILLS_REL_PATH,
} from "@/core/lib/sandbox/sandbox-skills-files";
import {
  ensureSandboxSkillsInSession,
  getSessionSkillsRoot,
} from "@/core/lib/sandbox/sandbox-skills-sync";

describe("ensureSandboxSkillsInSession", () => {
  const tempRoots: string[] = [];

  after(async () => {
    await Promise.all(
      tempRoots.map((root) => fs.rm(root, { force: true, recursive: true }))
    );
  });

  it("writes bundled skills into session .kimiro/skills", async () => {
    const sessionRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "kimiro-skills-sync-")
    );
    tempRoots.push(sessionRoot);

    await ensureSandboxSkillsInSession(sessionRoot);
    await ensureSandboxSkillsInSession(sessionRoot);

    const skillsRoot = getSessionSkillsRoot(sessionRoot);
    const expected = buildBuiltinWorkSkillFileSet();

    for (const [relativePath, content] of Object.entries(expected)) {
      const filePath = path.join(skillsRoot, relativePath);
      const onDisk = await fs.readFile(filePath);
      assert.equal(onDisk.compare(content), 0, relativePath);
    }

    const hash = await fs.readFile(
      path.join(sessionRoot, ".kimiro", ".skills-hash"),
      "utf8"
    );
    assert.match(hash, /^[a-f0-9]{64}$/);

    await fs.access(
      path.join(skillsRoot, "slides", "scripts", "office", "validate.py")
    );

    assert.equal(
      skillsRoot,
      path.join(sessionRoot, ...KIMIRO_SKILLS_REL_PATH.split("/"))
    );
  });
});
