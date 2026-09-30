import path from "node:path";
import { getSandboxLocalSessionsRoot } from "@/core/lib/sandbox/config";
import {
  SANDBOX_GCS_PREFIX,
  SANDBOX_SESSIONS_ROOT,
} from "@/core/lib/sandbox/constants";
import { getSessionDirectoryPath } from "@/core/lib/sandbox/path-jail";

export function getSandboxSessionDirectory(args: {
  tenantId: string;
  userId: string;
  chatId: string;
  sessionsRoot?: string;
}): string {
  return getSessionDirectoryPath({
    chatId: args.chatId,
    sessionsRoot: args.sessionsRoot ?? SANDBOX_SESSIONS_ROOT,
    tenantId: args.tenantId,
    userId: args.userId,
  });
}

export function getLocalSandboxSessionRoot(args: {
  tenantId: string;
  userId: string;
  chatId: string;
}): string {
  return getSessionDirectoryPath({
    chatId: args.chatId,
    sessionsRoot: getSandboxLocalSessionsRoot(),
    tenantId: args.tenantId,
    userId: args.userId,
  });
}

export function sandboxSessionGcsPrefix(args: {
  tenantId: string;
  userId: string;
  chatId: string;
  sandboxRoot?: string;
}): string {
  const root = (args.sandboxRoot ?? SANDBOX_GCS_PREFIX).replace(/\/+$/, "");
  return path.posix.join(
    root,
    args.tenantId,
    args.userId,
    "sessions",
    args.chatId
  );
}

/** Idempotent mkdir layout for a chat workspace (bash, run inside executor). */
export function buildSessionSetupScript(sessionPath: string): string {
  const quoted = shellQuote(sessionPath);
  return `
set -e
session_path=${quoted}
mkdir -p "$session_path/uploads"
mkdir -p "$session_path/staging"
mkdir -p "$session_path/outputs"
mkdir -p "$session_path/scripts"
mkdir -p "$session_path/.meta"
echo SANDBOX_SESSION_READY
`.trim();
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
