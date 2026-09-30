import { z } from "zod";

export const SANDBOX_MAX_CODE_BYTES = 128 * 1024;
export const SANDBOX_DEFAULT_TIMEOUT_MS = 60_000;
export const SANDBOX_MAX_TIMEOUT_MS = 300_000;

export const SANDBOX_EXEC_LABEL_MAX_LENGTH = 80;

export const sandboxExecInputSchema = z.object({
  code: z.string().min(1).max(SANDBOX_MAX_CODE_BYTES),
  command: z.enum(["python", "bash"]),
  cwd: z.string().max(240).optional(),
  label: z
    .string()
    .min(1)
    .max(SANDBOX_EXEC_LABEL_MAX_LENGTH)
    .describe(
      "Short present-tense action for the tool card (e.g. 'Create sample Word docs', 'Validate spreadsheet formulas')."
    ),
  timeoutMs: z.number().int().min(1000).max(SANDBOX_MAX_TIMEOUT_MS).optional(),
});

export type SandboxExecToolInput = z.infer<typeof sandboxExecInputSchema>;

export type SandboxExecToolOutput = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  outputFiles: Array<{
    path: string;
    sizeBytes: number;
    contentType: string;
  }>;
  durationMs: number;
  skillId?: string;
  contextForLlm: string;
};

export function normalizeSandboxExecInput(
  input: SandboxExecToolInput
): SandboxExecToolInput | { error: string; contextForLlm: string } {
  const parsed = sandboxExecInputSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.errors
      .map((issue) => issue.message)
      .join("; ");
    return { contextForLlm: message, error: message };
  }

  const bytes = Buffer.byteLength(parsed.data.code, "utf8");
  if (bytes > SANDBOX_MAX_CODE_BYTES) {
    const message = `Code exceeds ${SANDBOX_MAX_CODE_BYTES} bytes`;
    return { contextForLlm: message, error: message };
  }

  return {
    code: parsed.data.code,
    command: parsed.data.command,
    cwd: parsed.data.cwd?.trim() || ".",
    label: parsed.data.label.trim(),
    timeoutMs: parsed.data.timeoutMs ?? SANDBOX_DEFAULT_TIMEOUT_MS,
  };
}

const SANDBOX_FAILURE_SUMMARY_MAX = 120;

export function summarizeSandboxExecFailure(args: {
  errorMessage?: string;
  stderr?: string;
  exitCode?: number | null;
}): string {
  const stderr = args.stderr?.trim() ?? "";
  const lines = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const namedError = lines.find((line) =>
    /^(?:\w+Error|\w+Exception):/.test(line)
  );
  if (namedError) {
    return namedError.length <= SANDBOX_FAILURE_SUMMARY_MAX
      ? namedError
      : `${namedError.slice(0, SANDBOX_FAILURE_SUMMARY_MAX - 1)}…`;
  }

  const errorMessage = args.errorMessage?.trim() ?? "";
  if (errorMessage) {
    const firstLine = errorMessage.split("\n")[0]?.trim() ?? "";
    if (firstLine.length <= SANDBOX_FAILURE_SUMMARY_MAX) {
      return firstLine;
    }
    return `${firstLine.slice(0, SANDBOX_FAILURE_SUMMARY_MAX - 1)}…`;
  }

  if (args.exitCode != null && args.exitCode !== 0) {
    return `Script exited with code ${args.exitCode}`;
  }

  const firstStderrLine = lines[0];
  if (firstStderrLine) {
    return firstStderrLine.length <= SANDBOX_FAILURE_SUMMARY_MAX
      ? firstStderrLine
      : `${firstStderrLine.slice(0, SANDBOX_FAILURE_SUMMARY_MAX - 1)}…`;
  }

  return "Script failed";
}

export function sandboxExecToolCardLabel(args: {
  label?: string;
  failed?: boolean;
  interrupted?: boolean;
  pending?: boolean;
  /** Tool input still streaming — label may not have arrived yet. */
  inputStreaming?: boolean;
}): string {
  const action = args.label?.trim();
  if (action) {
    if (args.failed) {
      return `${action} failed`;
    }
    if (args.interrupted) {
      return `${action} interrupted`;
    }
    return action;
  }

  if (args.pending && args.inputStreaming) {
    return "";
  }

  if (args.failed) {
    return "Run failed";
  }
  if (args.interrupted) {
    return "Run interrupted";
  }
  return args.pending ? "Running script" : "Ran script";
}

function sandboxExecRecoveryHints(stderr: string): string[] {
  const hints: string[] = [];
  if (/No module named ['"]docx['"]/i.test(stderr)) {
    hints.push(
      "Word deliverables use the docs skill with Node require('docx'), not Python import docx. Read .kimiro/skills/docs/SKILL.md and retry."
    );
  }
  if (/No module named ['"]fpdf['"]/i.test(stderr)) {
    hints.push(
      "PDF deliverables use the pdf skill. Read .kimiro/skills/pdf/SKILL.md and retry."
    );
  }
  if (/scripts\/run-[^:\s]+: No such file or directory/i.test(stderr)) {
    hints.push(
      "Do not shell out to other scripts/run-* files. Put the full script body in this sandboxExec call; paths are relative to the session root (e.g. outputs/deck.pptx)."
    );
  }
  return hints;
}

export function toSandboxExecModelText(args: {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  outputFiles: SandboxExecToolOutput["outputFiles"];
  durationMs: number;
}): string {
  const lines = [
    `Sandbox ${args.exitCode === 0 ? "completed" : "failed"} (exit ${args.exitCode ?? "unknown"}, ${args.durationMs}ms).`,
  ];
  if (args.stdout.trim()) {
    lines.push(`stdout:\n${args.stdout.trim()}`);
  }
  if (args.stderr.trim()) {
    lines.push(`stderr:\n${args.stderr.trim()}`);
  }
  if (args.exitCode !== 0) {
    for (const hint of sandboxExecRecoveryHints(args.stderr)) {
      lines.push(`hint: ${hint}`);
    }
  }
  if (args.outputFiles.length > 0) {
    lines.push(
      "output files:",
      ...args.outputFiles.map(
        (file) =>
          `- ${file.path} (${file.contentType}, ${file.sizeBytes} bytes)`
      )
    );
    lines.push(
      "Use saveToLibrary with sandboxPath (e.g. outputs/deck.pptx) when the user should receive the deliverable. To edit an existing library file, call importLibraryToSandbox first."
    );
  }
  return lines.join("\n");
}
