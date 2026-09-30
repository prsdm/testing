import { and, eq } from "drizzle-orm";
import { getDb } from "./client";
import { tenantDriveIndexedFiles } from "./tables";

const db = getDb();

export type DriveIndexFileState = {
  driveFileId: string;
  driveModifiedTime: string;
  documentId: string;
  lastStatus: string;
};

export async function getTenantDriveIndexStateMap(tenantId: string) {
  const rows = await db
    .select({
      documentId: tenantDriveIndexedFiles.documentId,
      driveFileId: tenantDriveIndexedFiles.driveFileId,
      driveModifiedTime: tenantDriveIndexedFiles.driveModifiedTime,
      lastStatus: tenantDriveIndexedFiles.lastStatus,
    })
    .from(tenantDriveIndexedFiles)
    .where(eq(tenantDriveIndexedFiles.tenantId, tenantId));

  return new Map(
    rows.map((row) => [
      row.driveFileId,
      {
        documentId: row.documentId,
        driveFileId: row.driveFileId,
        driveModifiedTime: row.driveModifiedTime,
        lastStatus: row.lastStatus,
      },
    ])
  );
}

export function driveFileNeedsReindex(input: {
  fileId: string;
  modifiedTime?: string;
  prior?: DriveIndexFileState;
}) {
  if (!input.prior) {
    return true;
  }
  if (input.prior.lastStatus !== "indexed") {
    return true;
  }
  const currentModified = input.modifiedTime?.trim();
  if (!currentModified) {
    return true;
  }
  return input.prior.driveModifiedTime !== currentModified;
}

export async function upsertTenantDriveIndexedFile(input: {
  tenantId: string;
  driveFileId: string;
  driveModifiedTime: string;
  documentId: string;
  lastStatus: "indexed" | "failed";
}) {
  await db
    .insert(tenantDriveIndexedFiles)
    .values({
      documentId: input.documentId,
      driveFileId: input.driveFileId,
      driveModifiedTime: input.driveModifiedTime,
      lastIndexedAt: new Date(),
      lastStatus: input.lastStatus,
      tenantId: input.tenantId,
    })
    .onConflictDoUpdate({
      set: {
        documentId: input.documentId,
        driveModifiedTime: input.driveModifiedTime,
        lastIndexedAt: new Date(),
        lastStatus: input.lastStatus,
      },
      target: [
        tenantDriveIndexedFiles.tenantId,
        tenantDriveIndexedFiles.driveFileId,
      ],
    });
}

export async function deleteTenantDriveIndexedFiles(input: {
  tenantId: string;
  driveFileIds: string[];
}) {
  if (input.driveFileIds.length === 0) {
    return;
  }
  for (const driveFileId of input.driveFileIds) {
    await db
      .delete(tenantDriveIndexedFiles)
      .where(
        and(
          eq(tenantDriveIndexedFiles.tenantId, input.tenantId),
          eq(tenantDriveIndexedFiles.driveFileId, driveFileId)
        )
      );
  }
}
