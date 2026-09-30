/** Max raw bytes for a library file (upload or agent save). */
export const MAX_LIBRARY_FILE_BYTES = 15 * 1024 * 1024;

export const LIBRARY_FILE_PREFIX = "library";

export { PPTX_LIBRARY_MIME } from "@/shared/library/content-type";

export const LIBRARY_ALLOWED_CONTENT_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type LibraryFileSource = "upload" | "agent";

export function sanitizeLibraryFileName(name: string): string {
  const trimmed = name.trim().replace(/[/\\]+/g, "_");
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.length > 0 ? safe.slice(0, 180) : "file";
}

export function libraryContentUrl(pathname: string): string {
  return `/api/files/content?pathname=${encodeURIComponent(pathname)}`;
}

export function isLibraryPathname(pathname: string): boolean {
  return pathname.startsWith(`${LIBRARY_FILE_PREFIX}/`);
}

export function libraryPathname(args: {
  tenantId: string;
  userId: string;
  fileId: string;
  safeName: string;
}): string {
  return `${LIBRARY_FILE_PREFIX}/${args.tenantId}/${args.userId}/${args.fileId}/${args.safeName}`;
}

/** True when the pathname belongs to the signed-in user's library prefix. */
export function isUserLibraryPathname(
  pathname: string,
  userId: string
): boolean {
  const parts = pathname.split("/");
  return parts[0] === LIBRARY_FILE_PREFIX && parts[2] === userId;
}
