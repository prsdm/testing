import fs from "node:fs/promises";
import path from "node:path";
import { shouldSyncSandboxSessionToGcs } from "@/core/lib/sandbox/config";
import {
  resolveSessionPath,
  SandboxPathError,
} from "@/core/lib/sandbox/path-jail";
import { getLocalSandboxSessionRoot } from "@/core/lib/sandbox/session-workspace";
import { MAX_LIBRARY_FILE_BYTES } from "@/shared/library/constants";

export type WriteSandboxSessionFileResult =
  | { sandboxPath: string; sizeBytes: number }
  | { error: string };

async function ensureSessionLayout(sessionRoot: string): Promise<void> {
  await Promise.all(
    ["uploads", "staging", "outputs", "scripts", ".meta"].map((name) =>
      fs.mkdir(path.join(sessionRoot, name), { recursive: true })
    )
  );
}

export async function writeSandboxSessionFile(args: {
  tenantId: string;
  userId: string;
  chatId: string;
  sandboxPath: string;
  body: Buffer;
}): Promise<WriteSandboxSessionFileResult> {
  const sandboxPath = args.sandboxPath.trim().replaceAll("\\", "/");
  if (!sandboxPath.startsWith("outputs/")) {
    return {
      error:
        "sandboxPath must be a file under outputs/ (sandbox deliverables).",
    };
  }
  if (args.body.byteLength > MAX_LIBRARY_FILE_BYTES) {
    return {
      error: `File exceeds ${MAX_LIBRARY_FILE_BYTES} bytes`,
    };
  }

  const sessionRoot = getLocalSandboxSessionRoot({
    chatId: args.chatId,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  try {
    await ensureSessionLayout(sessionRoot);

    if (shouldSyncSandboxSessionToGcs()) {
      const { syncSandboxSessionFromGcs } = await import(
        "@/core/lib/sandbox/sandbox-storage"
      );
      await syncSandboxSessionFromGcs({
        chatId: args.chatId,
        tenantId: args.tenantId,
        userId: args.userId,
      });
    }

    const resolved = resolveSessionPath({
      relativePath: sandboxPath,
      sessionRoot,
    });
    await fs.mkdir(path.dirname(resolved.absolutePath), { recursive: true });
    await fs.writeFile(resolved.absolutePath, args.body);

    if (shouldSyncSandboxSessionToGcs()) {
      const { syncSandboxSessionToGcs } = await import(
        "@/core/lib/sandbox/sandbox-storage"
      );
      await syncSandboxSessionToGcs({
        chatId: args.chatId,
        tenantId: args.tenantId,
        userId: args.userId,
      });
    }

    return {
      sandboxPath: resolved.relativePath,
      sizeBytes: args.body.byteLength,
    };
  } catch (error) {
    if (error instanceof SandboxPathError) {
      return { error: error.message };
    }
    throw error;
  }
}
