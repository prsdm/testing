import { Storage } from "@google-cloud/storage";

const WORKSPACE_LOGO_PREFIX = "workspace-logos";
const ALLOWED_LOGO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

let storageClient: Storage | null = null;

function getStorage() {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

function uploadsBucketName() {
  const name =
    process.env.GCS_CHAT_UPLOADS_BUCKET?.trim() ||
    process.env.GCS_BUCKET?.trim();
  if (!name) {
    throw new Error(
      "Set GCS_CHAT_UPLOADS_BUCKET (or GCS_BUCKET) for workspace logos"
    );
  }
  return name;
}

function extensionForContentType(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
}

export function isAllowedWorkspaceLogoType(contentType: string) {
  return ALLOWED_LOGO_TYPES.has(contentType);
}

export function isAllowedWorkspaceLogoSize(size: number) {
  return size > 0 && size <= MAX_LOGO_BYTES;
}

export function workspaceLogoPathname(tenantId: string, contentType: string) {
  const ext = extensionForContentType(contentType);
  return `${WORKSPACE_LOGO_PREFIX}/${tenantId}/logo.${ext}`;
}

export function isWorkspaceLogoPathname(pathname: string, tenantId: string) {
  const prefix = `${WORKSPACE_LOGO_PREFIX}/${tenantId}/`;
  return pathname.startsWith(prefix) && !pathname.includes("..");
}

export async function putWorkspaceLogo(args: {
  tenantId: string;
  body: ArrayBuffer;
  contentType: string;
}) {
  const pathname = workspaceLogoPathname(args.tenantId, args.contentType);
  const bucket = getStorage().bucket(uploadsBucketName());
  const file = bucket.file(pathname);

  await file.save(Buffer.from(args.body), {
    contentType: args.contentType,
    metadata: {
      cacheControl: "private, max-age=0",
    },
    resumable: false,
  });

  return pathname;
}

export async function readWorkspaceLogo(pathname: string) {
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

export async function deleteWorkspaceLogo(pathname: string) {
  const bucket = getStorage().bucket(uploadsBucketName());
  const file = bucket.file(pathname);
  await file.delete({ ignoreNotFound: true });
}
