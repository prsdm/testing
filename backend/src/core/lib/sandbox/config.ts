import path from "node:path";
import { getRepoRoot } from "@/core/lib/sandbox/repo-root";

export function isSandboxEnabled(): boolean {
  return process.env.SANDBOX_ENABLED === "true";
}

export function getSandboxExecutorUrl(): string | null {
  const url = process.env.SANDBOX_EXECUTOR_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

export function getSandboxLocalSessionsRoot(): string {
  const configured = process.env.SANDBOX_LOCAL_SESSIONS_ROOT?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(getRepoRoot(), ".sandbox-sessions");
}

export function shouldSyncSandboxSessionToGcs(): boolean {
  if (process.env.SANDBOX_SKIP_GCS_SYNC === "true") {
    return false;
  }
  return Boolean(
    process.env.GCS_CHAT_UPLOADS_BUCKET?.trim() ||
      process.env.GCS_BUCKET?.trim()
  );
}

export function isSandboxConfigured(): boolean {
  return isSandboxEnabled() && Boolean(getSandboxExecutorUrl());
}
