import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { type LibraryFile, libraryFiles } from "@/core/lib/db/tables";
import { ChatbotError } from "@/shared/errors";

export type LibraryFileRow = LibraryFile;

const db = getDb();

export async function createLibraryFile(args: {
  id?: string;
  tenantId: string;
  userId: string;
  chatId?: string | null;
  name: string;
  contentType: string;
  sizeBytes: number;
  pathname: string;
  source: string;
}): Promise<LibraryFileRow> {
  const [created] = await db
    .insert(libraryFiles)
    .values({
      ...(args.id ? { id: args.id } : {}),
      chatId: args.chatId ?? null,
      contentType: args.contentType,
      createdAt: new Date(),
      name: args.name,
      pathname: args.pathname,
      sizeBytes: args.sizeBytes,
      source: args.source,
      tenantId: args.tenantId,
      userId: args.userId,
    })
    .returning();

  if (!created) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create library file"
    );
  }
  return created;
}

export async function getLibraryFileByPathnameGlobal(
  pathname: string
): Promise<LibraryFileRow | null> {
  const [row] = await db
    .select()
    .from(libraryFiles)
    .where(eq(libraryFiles.pathname, pathname))
    .limit(1);
  return row ?? null;
}

export async function getLibraryFileByIdInTenant(args: {
  tenantId: string;
  fileId: string;
}): Promise<LibraryFileRow | null> {
  const [row] = await db
    .select()
    .from(libraryFiles)
    .where(
      and(
        eq(libraryFiles.id, args.fileId),
        eq(libraryFiles.tenantId, args.tenantId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function listLibraryFilesForChannelChat(args: {
  tenantId: string;
  chatId: string;
  limit?: number;
}): Promise<LibraryFileRow[]> {
  return await db
    .select()
    .from(libraryFiles)
    .where(
      and(
        eq(libraryFiles.tenantId, args.tenantId),
        eq(libraryFiles.chatId, args.chatId)
      )
    )
    .orderBy(desc(libraryFiles.createdAt))
    .limit(args.limit ?? 50);
}

export async function getLibraryFileById(args: {
  tenantId: string;
  userId: string;
  fileId: string;
}): Promise<LibraryFileRow | null> {
  const [row] = await db
    .select()
    .from(libraryFiles)
    .where(
      and(
        eq(libraryFiles.id, args.fileId),
        eq(libraryFiles.tenantId, args.tenantId),
        eq(libraryFiles.userId, args.userId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function listLibraryFiles(args: {
  tenantId: string;
  userId: string;
  chatId?: string | null;
  limit?: number;
}): Promise<LibraryFileRow[]> {
  const filters = [
    eq(libraryFiles.tenantId, args.tenantId),
    eq(libraryFiles.userId, args.userId),
  ];
  if (args.chatId) {
    filters.push(eq(libraryFiles.chatId, args.chatId));
  }

  return await db
    .select()
    .from(libraryFiles)
    .where(and(...filters))
    .orderBy(desc(libraryFiles.createdAt))
    .limit(args.limit ?? 50);
}

export async function updateLibraryFileDriveLink(args: {
  tenantId: string;
  userId: string;
  fileId: string;
  driveFileId: string;
  driveWebViewLink: string;
}): Promise<LibraryFileRow | null> {
  const [updated] = await db
    .update(libraryFiles)
    .set({
      driveFileId: args.driveFileId,
      driveWebViewLink: args.driveWebViewLink,
    })
    .where(
      and(
        eq(libraryFiles.id, args.fileId),
        eq(libraryFiles.tenantId, args.tenantId),
        eq(libraryFiles.userId, args.userId)
      )
    )
    .returning();
  return updated ?? null;
}

export async function deleteLibraryFile(args: {
  tenantId: string;
  userId: string;
  fileId: string;
}): Promise<LibraryFileRow | null> {
  const [deleted] = await db
    .delete(libraryFiles)
    .where(
      and(
        eq(libraryFiles.id, args.fileId),
        eq(libraryFiles.tenantId, args.tenantId),
        eq(libraryFiles.userId, args.userId)
      )
    )
    .returning();
  return deleted ?? null;
}
