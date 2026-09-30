import { createHash } from "node:crypto";
import { shouldSyncSandboxSessionToGcs } from "@/core/lib/sandbox/config";
import { callSandboxExecutor } from "@/core/lib/sandbox/executor-client";
import { ensureSandboxSkillsInSession } from "@/core/lib/sandbox/sandbox-skills-sync";
import {
  ensureLocalSandboxSessionLayout,
  syncSandboxSessionFromGcs,
  syncSandboxSessionToGcs,
  writeSandboxScript,
} from "@/core/lib/sandbox/sandbox-storage";
import { getLocalSandboxSessionRoot } from "@/core/lib/sandbox/session-workspace";
import type { WorkSkillId } from "@/shared/sandbox/work-skill-catalog";

export async function runSandboxExec(args: {
  tenantId: string;
  userId: string;
  chatId: string;
  command: "python" | "bash";
  code: string;
  cwd: string;
  timeoutMs: number;
  scriptId: string;
  enabledWorkSkillIds?: readonly WorkSkillId[];
}) {
  const sessionRoot = getLocalSandboxSessionRoot({
    chatId: args.chatId,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  await ensureLocalSandboxSessionLayout(sessionRoot);
  await ensureSandboxSkillsInSession(sessionRoot, args.enabledWorkSkillIds);

  if (shouldSyncSandboxSessionToGcs()) {
    await syncSandboxSessionFromGcs({
      chatId: args.chatId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
  }

  const scriptPath = await writeSandboxScript({
    code: args.code,
    command: args.command,
    scriptId: args.scriptId,
    sessionRoot,
  });

  const execCommand = args.command === "python" ? "python" : "bash";
  const execArgs = args.command === "python" ? [scriptPath] : [scriptPath];

  // Generated runners live at scripts/run-*.py|sh relative to the session root.
  // Model-provided cwd (e.g. outputs/) breaks execution with "No such file or directory".
  const response = await callSandboxExecutor({
    args: execArgs,
    chatId: args.chatId,
    command: execCommand,
    cwd: ".",
    tenantId: args.tenantId,
    timeoutMs: args.timeoutMs,
    userId: args.userId,
  });

  if (shouldSyncSandboxSessionToGcs()) {
    await syncSandboxSessionToGcs({
      chatId: args.chatId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
  }

  return response;
}

export function sandboxScriptId(toolCallId: string): string {
  const digest = createHash("sha256").update(toolCallId).digest("hex");
  return digest.slice(0, 12);
}
