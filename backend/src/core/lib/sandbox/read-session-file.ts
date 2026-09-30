import fs from "node:fs/promises";
import path from "node:path";
import { shouldSyncSandboxSessionToGcs } from "@/core/lib/sandbox/config";
import {
  resolveSessionPath,
  SandboxPathError,
} from "@/core/lib/sandbox/path-jail";
import { getLocalSandboxSessionRoot } from "@/core/lib/sandbox/session-workspace";
import { MAX_LIBRARY_FILE_BYTES } from "@/shared/library/constants";

export type ReadSandboxSessionFileResult =
  | { body: Buffer; sizeBytes: number }
  | { error: string };

async function ensureSessionLayout(sessionRoot: string): Promise<void> {
  await Promise.all(
    ["uploads", "staging", "outputs", "scripts", ".meta"].map((name) =>
      fs.mkdir(path.join(sessionRoot, name), { recursive: true })
    )
  );
}

export async function readSandboxSessionFile(args: {
  tenantId: string;
  userId: string;
  chatId: string;
  sandboxPath: string;
}): Promise<ReadSandboxSessionFileResult> {
  const sandboxPath = args.sandboxPath.trim().replaceAll("\\", "/");
  if (!sandboxPath.startsWith("outputs/")) {
    return {
      error:
        "sandboxPath must be a file under outputs/ (sandbox deliverables).",
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
    const stat = await fs.stat(resolved.absolutePath);
    if (!stat.isFile()) {
      return { error: `Not a file: ${sandboxPath}` };
    }
    if (stat.size > MAX_LIBRARY_FILE_BYTES) {
      return {
        error: `File exceeds ${MAX_LIBRARY_FILE_BYTES} bytes`,
      };
    }

    const body = await fs.readFile(resolved.absolutePath);
    return { body, sizeBytes: body.byteLength };
  } catch (error) {
    if (error instanceof SandboxPathError) {
      return { error: error.message };
    }
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { error: `Sandbox file not found: ${sandboxPath}` };
    }
    throw error;
  }
}
