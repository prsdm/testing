import type { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import {
  getLibraryFileByPathnameGlobal,
  type LibraryFileRow,
} from "@/core/lib/db/library-queries";
import { toTenantUserId } from "@/core/lib/db/queries";
import { uploadsBucketName } from "@/core/lib/library/gcs-bucket";
import { canReadLibraryFile } from "@/core/lib/library/library-file-access";
import {
  isLibraryPathname,
  libraryContentUrl,
  libraryPathname,
  sanitizeLibraryFileName,
} from "@/shared/library/constants";
import type { LibraryFileResponse } from "@/shared/library/format-library-file";

let storageClient: Storage | null = null;

function getStorage() {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

export { uploadsBucketName } from "@/core/lib/library/gcs-bucket";

async function readGcsObject(pathname: string) {
  const bucket = getStorage().bucket(uploadsBucketName());
  const file = bucket.file(pathname);
  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }
  const [[buffer], [metadata]] = await Promise.all([
    file.download(),
    file.getMetadata(),
  ]);
  const contentType =
    typeof metadata.contentType === "string" && metadata.contentType.trim()
      ? metadata.contentType
      : "application/octet-stream";
  return {
    buffer,
    contentType,
    stream: new Blob([new Uint8Array(buffer)]).stream(),
  };
}

export async function putLibraryObject(args: {
  pathname: string;
  body: Buffer;
  contentType: string;
}) {
  const bucket = getStorage().bucket(uploadsBucketName());
  const file = bucket.file(args.pathname);
  await file.save(args.body, {
    contentType: args.contentType,
    metadata: {
      cacheControl: "private, max-age=0",
    },
    resumable: false,
  });
}

export async function deleteLibraryObject(pathname: string) {
  const bucket = getStorage().bucket(uploadsBucketName());
  const file = bucket.file(pathname);
  const [exists] = await file.exists();
  if (exists) {
    await file.delete({ ignoreNotFound: true });
  }
}

export function toLibraryFileResponse(
  row: LibraryFileRow
): LibraryFileResponse {
  return {
    chatId: row.chatId,
    contentType: row.contentType,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    name: row.name,
    pathname: row.pathname,
    sizeBytes: row.sizeBytes,
    source: row.source,
    url: libraryContentUrl(row.pathname),
  };
}

export async function writeLibraryFile(args: {
  tenantId: string;
  userId: string;
  chatId?: string | null;
  name: string;
  contentType: string;
  body: Buffer;
  source: "upload" | "agent";
}) {
  const { createLibraryFile } = await import("@/core/lib/db/library-queries");
  const safeName = sanitizeLibraryFileName(args.name);
  const fileId = randomUUID();
  const pathname = libraryPathname({
    fileId,
    safeName,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  await putLibraryObject({
    body: args.body,
    contentType: args.contentType,
    pathname,
  });

  const row = await createLibraryFile({
    chatId: args.chatId ?? null,
    contentType: args.contentType,
    id: fileId,
    name: safeName,
    pathname,
    sizeBytes: args.body.byteLength,
    source: args.source,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  return toLibraryFileResponse(row);
}

async function assertLibraryReadSession() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return {
      error: "Unauthorized" as const,
      ok: false as const,
      status: 401 as const,
    };
  }
  if (
    (await assertChatApiAccess({
      userEmail: session.user.email,
      userId: session.user.id,
    })) === "forbidden"
  ) {
    return {
      error: "Forbidden" as const,
      ok: false as const,
      status: 403 as const,
    };
  }
  return { ok: true as const, session };
}

function userCanAccessLibraryFile(args: {
  authUserId: string;
  userId: string;
  email: string;
  file: LibraryFileRow;
}) {
  return canReadLibraryFile({
    authUserId: args.authUserId,
    email: args.email,
    file: args.file,
    tenantUserId: args.userId,
  });
}

export async function readLibraryFileBytes(pathname: string) {
  const object = await readGcsObject(pathname);
  if (!object) {
    return null;
  }
  return object.buffer;
}

export async function readLibraryFileByPathname(pathname: string) {
  const gate = await assertLibraryReadSession();
  if (!gate.ok) {
    return { error: gate.error, status: gate.status };
  }

  const trimmed = pathname.trim();
  if (!(trimmed && isLibraryPathname(trimmed))) {
    return { error: "Forbidden" as const, status: 403 as const };
  }

  const file = await getLibraryFileByPathnameGlobal(trimmed);
  if (!file) {
    return { error: "Not found" as const, status: 404 as const };
  }

  if (
    !(await userCanAccessLibraryFile({
      authUserId: gate.session.user.id,
      email: gate.session.user.email as string,
      file,
      userId: toTenantUserId(gate.session.user.id),
    }))
  ) {
    return { error: "Forbidden" as const, status: 403 as const };
  }

  const object = await readGcsObject(trimmed);
  if (!object) {
    return { error: "Not found" as const, status: 404 as const };
  }

  return {
    contentType: object.contentType,
    fileName: file.name,
    status: 200 as const,
    stream: object.stream,
  };
}

export function isTenantLibraryPathname(
  pathname: string,
  tenantId: string,
  userId: string
) {
  return pathname.startsWith(`library/${tenantId}/${userId}/`);
}
