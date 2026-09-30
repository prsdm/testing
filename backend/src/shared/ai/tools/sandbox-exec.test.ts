import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSandboxConfigured } from "@/core/lib/sandbox/config";
import {
  normalizeSandboxExecInput,
  sandboxExecToolCardLabel,
  summarizeSandboxExecFailure,
  toSandboxExecModelText,
} from "@/shared/ai/tools/sandbox-exec";

describe("sandboxExec tool", () => {
  it("normalizes python input", () => {
    const normalized = normalizeSandboxExecInput({
      code: "print('hi')",
      command: "python",
      label: "Create sample Word docs",
    });
    assert.ok(!("error" in normalized));
    if (!("error" in normalized)) {
      assert.equal(normalized.command, "python");
      assert.equal(normalized.cwd, ".");
      assert.equal(normalized.timeoutMs, 60_000);
    }
  });

  it("rejects empty code", () => {
    const normalized = normalizeSandboxExecInput({
      code: "",
      command: "bash",
      label: "Run shell script",
    });
    assert.ok("error" in normalized);
  });

  it("summarizes sandbox failures for tool cards", () => {
    assert.equal(
      summarizeSandboxExecFailure({
        stderr: `SyntaxError: Unexpected token '}'\n    at wrapSafe (node:internal/modules/cjs/loader:1861:18)`,
      }),
      "SyntaxError: Unexpected token '}'"
    );
    assert.equal(
      summarizeSandboxExecFailure({
        errorMessage: "Sandbox exited with code 2.",
        exitCode: 2,
      }),
      "Sandbox exited with code 2."
    );
  });

  it("formats tool card labels from action label", () => {
    assert.equal(
      sandboxExecToolCardLabel({
        label: "Create sample Word docs",
        pending: true,
      }),
      "Create sample Word docs"
    );
    assert.equal(
      sandboxExecToolCardLabel({
        failed: true,
        label: "Validate deck layout",
      }),
      "Validate deck layout failed"
    );
    assert.equal(sandboxExecToolCardLabel({ pending: true }), "Running script");
    assert.equal(
      sandboxExecToolCardLabel({ inputStreaming: true, pending: true }),
      ""
    );
  });

  it("formats model text with stdout and files", () => {
    const text = toSandboxExecModelText({
      durationMs: 120,
      exitCode: 0,
      outputFiles: [
        {
          contentType: "text/csv",
          path: "outputs/report.csv",
          sizeBytes: 12,
        },
      ],
      stderr: "",
      stdout: "done",
    });
    assert.match(text, /done/);
    assert.match(text, /outputs\/report.csv/);
    assert.match(text, /sandboxPath/);
  });

  it("adds recovery hints for common skill mistakes", () => {
    const text = toSandboxExecModelText({
      durationMs: 50,
      exitCode: 1,
      outputFiles: [],
      stderr: "ModuleNotFoundError: No module named 'docx'",
      stdout: "",
    });
    assert.match(text, /docs skill/);
    assert.match(text, /require\('docx'\)/);
  });
});

describe("sandbox config", () => {
  it("requires executor url and enabled flag", () => {
    const enabled = process.env.SANDBOX_ENABLED;
    const url = process.env.SANDBOX_EXECUTOR_URL;
    process.env.SANDBOX_ENABLED = "true";
    process.env.SANDBOX_EXECUTOR_URL = "http://127.0.0.1:8089";
    try {
      assert.equal(isSandboxConfigured(), true);
    } finally {
      if (enabled === undefined) {
        process.env.SANDBOX_ENABLED = undefined;
      } else {
        process.env.SANDBOX_ENABLED = enabled;
      }
      if (url === undefined) {
        process.env.SANDBOX_EXECUTOR_URL = undefined;
      } else {
        process.env.SANDBOX_EXECUTOR_URL = url;
      }
    }
  });
});
