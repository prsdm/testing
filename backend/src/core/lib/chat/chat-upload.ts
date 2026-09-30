import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import { decryptSecret } from "@/core/lib/security/crypto";

const CHAT_UPLOAD_PREFIX = "chat-uploads";

type ChatUploadTokenV2 = {
  v: 2;
  userId: string;
  pathname: string;
  contentType: string;
  storage: "gcs";
};

let storageClient: Storage | null = null;

function getStorage() {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

function chatUploadsBucketName() {
  const name =
    process.env.GCS_CHAT_UPLOADS_BUCKET?.trim() ||
    process.env.GCS_BUCKET?.trim();
  if (!name) {
    throw new Error(
      "Set GCS_CHAT_UPLOADS_BUCKET (or GCS_BUCKET) for private chat uploads"
    );
  }
  return name;
}

export function chatUploadPathname(userId: string, safeName: string) {
  return `${CHAT_UPLOAD_PREFIX}/${userId}/${randomUUID()}-${safeName}`;
}

/**
 * Upload a chat attachment to a private GCS bucket and return an app-proxied URL.
 * Browser clients use a pathname query (session-gated) so a sealed token is not
 * embedded in Referer / history. Legacy `?token=` URLs still resolve for v2.
 */
export async function putChatUpload(args: {
  userId: string;
  safeName: string;
  body: ArrayBuffer;
  contentType: string;
}) {
  const pathname = chatUploadPathname(args.userId, args.safeName);
  const bucket = getStorage().bucket(chatUploadsBucketName());
  const file = bucket.file(pathname);

  await file.save(Buffer.from(args.body), {
    contentType: args.contentType,
    metadata: {
      cacheControl: "private, max-age=0",
    },
    resumable: false,
  });

  return {
    contentType: args.contentType,
    pathname,
    url: `/api/files/content?pathname=${encodeURIComponent(pathname)}`,
  };
}

async function readGcsObject(pathname: string) {
  const bucket = getStorage().bucket(chatUploadsBucketName());
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

/**
 * Read chat-upload bytes for the owning user (used when preparing model messages).
 * Bypasses HTTP so private relative `/api/files/content` URLs still reach the LLM.
 */
export async function readChatUploadBytesForUser(args: {
  userId: string;
  pathname: string;
}): Promise<{ bytes: Buffer; contentType: string } | null> {
  const trimmed = args.pathname.trim();
  if (!(trimmed && isOwnedPathname(trimmed, args.userId))) {
    return null;
  }
  const object = await readGcsObject(trimmed);
  if (!object) {
    return null;
  }
  return { bytes: object.buffer, contentType: object.contentType };
}

async function assertUploadSession(): Promise<
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof auth>>> }
  | { ok: false; error: "Unauthorized" | "Forbidden"; status: 401 | 403 }
> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { error: "Unauthorized", ok: false, status: 401 };
  }
  if (
    (await assertChatApiAccess({
      userEmail: session.user.email,
      userId: session.user.id,
    })) === "forbidden"
  ) {
    return { error: "Forbidden", ok: false, status: 403 };
  }
  return { ok: true, session };
}

function isOwnedPathname(pathname: string, userId: string) {
  return pathname.startsWith(`${CHAT_UPLOAD_PREFIX}/${userId}/`);
}

export async function readChatUploadByPathname(pathname: string) {
  const gate = await assertUploadSession();
  if (!gate.ok) {
    return { error: gate.error, status: gate.status };
  }
  const userId = gate.session.user.id;
  const trimmed = pathname.trim();
  if (!(trimmed && isOwnedPathname(trimmed, userId))) {
    return { error: "Forbidden" as const, status: 403 as const };
  }

  const object = await readGcsObject(trimmed);
  if (!object) {
    return { error: "Not found" as const, status: 404 as const };
  }

  return {
    contentType: object.contentType,
    status: 200 as const,
    stream: object.stream,
  };
}

/** Legacy sealed-token URLs still embedded in old message attachments. */
export async function readChatUploadForSession(token: string) {
  const gate = await assertUploadSession();
  if (!gate.ok) {
    return { error: gate.error, status: gate.status };
  }
  const userId = gate.session.user.id;

  let payload: ChatUploadTokenV2;
  try {
    payload = JSON.parse(decryptSecret(token)) as ChatUploadTokenV2;
  } catch {
    return { error: "Invalid token" as const, status: 400 as const };
  }

  if (payload.v !== 2 || payload.storage !== "gcs") {
    // Dropped v1 public Blob proxy (SSRF + public object risk).
    return { error: "Invalid token" as const, status: 400 as const };
  }
  if (payload.userId !== userId || !isOwnedPathname(payload.pathname, userId)) {
    return { error: "Forbidden" as const, status: 403 as const };
  }

  const object = await readGcsObject(payload.pathname);
  if (!object) {
    return { error: "Not found" as const, status: 404 as const };
  }
  return {
    contentType: payload.contentType || object.contentType,
    status: 200 as const,
    stream: object.stream,
  };
}
