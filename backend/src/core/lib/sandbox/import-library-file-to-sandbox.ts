import { readSandboxSessionFile } from "@/core/lib/sandbox/read-session-file";
import { writeSandboxSessionFile } from "@/core/lib/sandbox/write-session-file";
import { sanitizeLibraryFileName } from "@/shared/library/constants";

export function defaultSandboxPathForLibraryFile(name: string): string {
  return `outputs/${sanitizeLibraryFileName(name)}`;
}

export async function importLibraryFileToSandbox(args: {
  tenantId: string;
  userId: string;
  chatId: string;
  libraryFileId: string;
  name: string;
  sizeBytes: number;
  body: Buffer;
  sandboxPath?: string;
}): Promise<
  | {
      libraryFileId: string;
      sandboxPath: string;
      sizeBytes: number;
      reusedExisting: boolean;
    }
  | { error: string }
> {
  const sandboxPath =
    args.sandboxPath?.trim().replaceAll("\\", "/") ??
    defaultSandboxPathForLibraryFile(args.name);

  const existing = await readSandboxSessionFile({
    chatId: args.chatId,
    sandboxPath,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  if (
    !("error" in existing) &&
    existing.sizeBytes === args.sizeBytes &&
    existing.body.equals(args.body)
  ) {
    return {
      libraryFileId: args.libraryFileId,
      reusedExisting: true,
      sandboxPath,
      sizeBytes: existing.sizeBytes,
    };
  }

  const written = await writeSandboxSessionFile({
    body: args.body,
    chatId: args.chatId,
    sandboxPath,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  if ("error" in written) {
    return { error: written.error };
  }

  return {
    libraryFileId: args.libraryFileId,
    reusedExisting: false,
    sandboxPath: written.sandboxPath,
    sizeBytes: written.sizeBytes,
  };
}
