import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSandboxSkillLoadCode,
  looksLikeSkillMarkdown,
  sandboxSkillToolFailedLabel,
  sandboxSkillToolLabel,
  shouldHideSandboxSkillStdout,
} from "./sandbox-skill-display";

describe("sandbox skill display", () => {
  it("detects cat/head reads of SKILL.md", () => {
    assert.equal(
      isSandboxSkillLoadCode("cat .kimiro/skills/xlsx/SKILL.md"),
      true
    );
    assert.equal(
      isSandboxSkillLoadCode("head -n 20 .kimiro/skills/slides/SKILL.md"),
      true
    );
    assert.equal(
      isSandboxSkillLoadCode(
        "python .kimiro/skills/xlsx/scripts/recalc.py outputs/sheet.xlsx"
      ),
      false
    );
  });

  it("detects SKILL.md dumped to stdout", () => {
    assert.equal(
      looksLikeSkillMarkdown(`---
name: xlsx
description: Spreadsheet work
`),
      true
    );
    assert.equal(looksLikeSkillMarkdown("50 rows written"), false);
  });

  it("hides stdout for skill loads and SKILL.md dumps", () => {
    assert.equal(
      shouldHideSandboxSkillStdout({
        code: "cat .kimiro/skills/xlsx/SKILL.md",
        stdout: "---\nname: xlsx\n",
      }),
      true
    );
    assert.equal(
      shouldHideSandboxSkillStdout({
        code: "python build.py",
        stdout: "done",
      }),
      false
    );
  });

  it("labels load vs run phases", () => {
    assert.equal(
      sandboxSkillToolLabel({
        formatNoun: "spreadsheet",
        isLoad: true,
        phase: "pending",
      }),
      "Loading spreadsheet"
    );
    assert.equal(
      sandboxSkillToolLabel({
        formatNoun: "spreadsheet",
        isLoad: false,
        phase: "completed",
      }),
      "Used spreadsheet"
    );
    assert.equal(
      sandboxSkillToolFailedLabel("presentation"),
      "presentation failed"
    );
  });
});
