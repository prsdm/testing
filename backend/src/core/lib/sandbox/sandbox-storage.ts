import fs from "node:fs/promises";
import path from "node:path";
import { Storage } from "@google-cloud/storage";
import { uploadsBucketName } from "@/core/lib/library/gcs-bucket";
import {
  getLocalSandboxSessionRoot,
  sandboxSessionGcsPrefix,
} from "@/core/lib/sandbox/session-workspace";

const SYNC_SUBDIRS = ["uploads", "staging", "outputs", "scripts"] as const;

let storageClient: Storage | null = null;

function getStorage() {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

export async function ensureLocalSandboxSessionLayout(
  sessionRoot: string
): Promise<void> {
  await Promise.all(
    [...SYNC_SUBDIRS, ".meta"].map((name) =>
      fs.mkdir(path.join(sessionRoot, name), { recursive: true })
    )
  );
}

export async function writeSandboxScript(args: {
  sessionRoot: string;
  command: "python" | "bash";
  code: string;
  scriptId: string;
}): Promise<string> {
  const extension = args.command === "python" ? "py" : "sh";
  const relativePath = `scripts/run-${args.scriptId}.${extension}`;
  const absolutePath = path.join(args.sessionRoot, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, args.code, "utf8");
  return relativePath;
}

async function listLocalFiles(
  sessionRoot: string
): Promise<Array<{ relativePath: string; absolutePath: string }>> {
  const files: Array<{ relativePath: string; absolutePath: string }> = [];
  for (const subdir of SYNC_SUBDIRS) {
    const base = path.join(sessionRoot, subdir);
    let entries: string[] = [];
    try {
      entries = await walkFiles(base);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }
      throw error;
    }
    for (const absolutePath of entries) {
      const relativePath = path
        .relative(sessionRoot, absolutePath)
        .split(path.sep)
        .join("/");
      if (relativePath.split("/").some((segment) => segment.startsWith("."))) {
        continue;
      }
      files.push({ absolutePath, relativePath });
    }
  }
  return files;
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

export async function syncSandboxSessionFromGcs(args: {
  tenantId: string;
  userId: string;
  chatId: string;
}): Promise<void> {
  const sessionRoot = getLocalSandboxSessionRoot(args);
  await ensureLocalSandboxSessionLayout(sessionRoot);
  const prefix = `${sandboxSessionGcsPrefix(args)}/`;
  const bucket = getStorage().bucket(uploadsBucketName());
  const [objects] = await bucket.getFiles({ prefix });
  await Promise.all(
    objects.map(async (file) => {
      if (!file.name.startsWith(prefix) || file.name.endsWith("/")) {
        return;
      }
      const relativePath = file.name.slice(prefix.length);
      if (
        !SYNC_SUBDIRS.some(
          (subdir) =>
            relativePath === subdir || relativePath.startsWith(`${subdir}/`)
        )
      ) {
        return;
      }
      const destination = path.join(sessionRoot, relativePath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await file.download({ destination });
    })
  );
}

export async function syncSandboxSessionToGcs(args: {
  tenantId: string;
  userId: string;
  chatId: string;
}): Promise<void> {
  const sessionRoot = getLocalSandboxSessionRoot(args);
  const prefix = sandboxSessionGcsPrefix(args);
  const bucket = getStorage().bucket(uploadsBucketName());
  const files = await listLocalFiles(sessionRoot);
  await Promise.all(
    files.map(async ({ relativePath, absolutePath }) => {
      const destination = `${prefix}/${relativePath}`;
      await bucket.upload(absolutePath, {
        destination,
        metadata: {
          cacheControl: "private, max-age=0",
        },
        resumable: false,
      });
    })
  );
}
