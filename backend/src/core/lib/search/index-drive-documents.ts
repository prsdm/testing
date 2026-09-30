import {
  deleteTenantDriveIndexedFiles,
  driveFileNeedsReindex,
  getTenantDriveIndexStateMap,
  upsertTenantDriveIndexedFile,
} from "@/core/lib/db/drive-index-state-queries";
import {
  bulkIndexChunks,
  deleteChunksForDocuments,
} from "@/core/lib/search/chunk-index";
import { chunkText } from "@/core/lib/search/chunker";
import { getTenantIndexName } from "@/core/lib/search/config";
import type { DriveFileForAccess } from "@/core/lib/search/google-drive/external-access";
import type { SearchRuntimeSettings } from "@/core/lib/search/runtime-settings";
import {
  contentExceedsMaxBytes,
  mbToBytes,
} from "@/core/lib/sources/index-content-limits";
import type { IndexChunkInput } from "@/shared/search/types";
import { getExternalAccessAclForDriveFileWithRetry } from "./google-drive/document-access";
import {
  type DriveFileToIndex,
  downloadDriveFileText,
} from "./google-drive/fetch";

type DriveSkipReason =
  | "unchanged"
  | "token_error"
  | "download_error"
  | "no_extractable_text"
  | "file_too_large"
  | "acl_error";

type SkippedDriveFile = {
  fileId: string;
  fileName: string;
  mimeType: string;
  reason: DriveSkipReason;
  detail?: string;
};

function blurbFromContent(content: string, maxLength = 240) {
  const trimmed = content.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}…`;
}

function driveDocumentId(fileId: string) {
  return `google_drive:${fileId}`;
}

function driveModifiedKey(file: DriveFileToIndex) {
  return file.modifiedTime?.trim() || "";
}

export async function indexDriveFilesForTenant(input: {
  tenantId: string;
  tenantSlug: string;
  companyDomain: string;
  getAccessTokenForFile: (file: DriveFileToIndex) => Promise<string>;
  fallbackUserEmail: string;
  files: DriveFileToIndex[];
  settings: SearchRuntimeSettings;
}) {
  const indexName = getTenantIndexName(input.tenantId);
  const listedFiles = input.files;
  const maxContentBytes = mbToBytes(input.settings.maxIndexedContentSizeMb);
  const maxContentMb = input.settings.maxIndexedContentSizeMb;
  const listedFileIds = new Set(listedFiles.map((file) => file.id));
  const priorState = await getTenantDriveIndexStateMap(input.tenantId);

  const chunks: IndexChunkInput[] = [];
  const skippedFiles: SkippedDriveFile[] = [];
  const unchangedDocumentIds = new Set<string>();
  const indexedDocumentIds = new Set<string>();

  for (const file of listedFiles) {
    const documentId = driveDocumentId(file.id);
    const prior = priorState.get(file.id);
    const modifiedKey = driveModifiedKey(file);

    if (
      !driveFileNeedsReindex({
        fileId: file.id,
        modifiedTime: modifiedKey,
        prior,
      })
    ) {
      unchangedDocumentIds.add(documentId);
      continue;
    }

    const reportedSize = file.size ? Number(file.size) : Number.NaN;
    if (Number.isFinite(reportedSize) && reportedSize > maxContentBytes) {
      skippedFiles.push({
        detail: `File size ${reportedSize} bytes exceeds ${maxContentMb} MB limit`,
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
        reason: "file_too_large",
      });
      if (modifiedKey) {
        await upsertTenantDriveIndexedFile({
          documentId,
          driveFileId: file.id,
          driveModifiedTime: modifiedKey,
          lastStatus: "failed",
          tenantId: input.tenantId,
        });
      }
      continue;
    }

    let accessToken = "";
    try {
      accessToken = await input.getAccessTokenForFile(file);
    } catch (error) {
      skippedFiles.push({
        detail:
          error instanceof Error ? error.message : "Token resolution failed",
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
        reason: "token_error",
      });
      if (modifiedKey) {
        await upsertTenantDriveIndexedFile({
          documentId,
          driveFileId: file.id,
          driveModifiedTime: modifiedKey,
          lastStatus: "failed",
          tenantId: input.tenantId,
        });
      }
      continue;
    }

    let content: string | null = null;
    try {
      content = await downloadDriveFileText(file, accessToken);
    } catch (error) {
      skippedFiles.push({
        detail:
          error instanceof Error ? error.message : "Download or parse failed",
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
        reason: "download_error",
      });
      if (modifiedKey) {
        await upsertTenantDriveIndexedFile({
          documentId,
          driveFileId: file.id,
          driveModifiedTime: modifiedKey,
          lastStatus: "failed",
          tenantId: input.tenantId,
        });
      }
      continue;
    }

    if (!content) {
      skippedFiles.push({
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
        reason: "no_extractable_text",
      });
      if (modifiedKey) {
        await upsertTenantDriveIndexedFile({
          documentId,
          driveFileId: file.id,
          driveModifiedTime: modifiedKey,
          lastStatus: "failed",
          tenantId: input.tenantId,
        });
      }
      continue;
    }

    if (contentExceedsMaxBytes(content, maxContentBytes)) {
      skippedFiles.push({
        detail: `Extracted content exceeds ${maxContentMb} MB limit`,
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
        reason: "file_too_large",
      });
      if (modifiedKey) {
        await upsertTenantDriveIndexedFile({
          documentId,
          driveFileId: file.id,
          driveModifiedTime: modifiedKey,
          lastStatus: "failed",
          tenantId: input.tenantId,
        });
      }
      continue;
    }

    const accessFile: DriveFileForAccess = {
      driveId: file.driveId,
      id: file.id,
      owners: file.owners,
      permissionIds: file.permissionIds,
      permissions: file.permissions,
    };
    let accessControlList: string[] = [];
    try {
      accessControlList = await getExternalAccessAclForDriveFileWithRetry({
        accessToken,
        companyDomain: input.companyDomain,
        fallbackUserEmail: input.fallbackUserEmail,
        file: accessFile,
      });
    } catch (error) {
      skippedFiles.push({
        detail:
          error instanceof Error ? error.message : "ACL resolution failed",
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
        reason: "acl_error",
      });
      if (modifiedKey) {
        await upsertTenantDriveIndexedFile({
          documentId,
          driveFileId: file.id,
          driveModifiedTime: modifiedKey,
          lastStatus: "failed",
          tenantId: input.tenantId,
        });
      }
      continue;
    }

    const textChunks = chunkText(content);
    const updatedAt = file.modifiedTime
      ? new Date(file.modifiedTime)
      : new Date();

    for (const [chunkIndex, chunkContent] of textChunks.entries()) {
      chunks.push({
        accessControlList,
        blurb: blurbFromContent(chunkContent),
        chunkIndex,
        content: chunkContent,
        documentId,
        link:
          file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
        sourceType: "google_drive",
        tenantId: input.tenantId,
        title: file.name,
        updatedAt,
      });
    }
  }

  let indexedChunks = 0;

  if (chunks.length > 0) {
    // Group chunks by documentId so we can delete-then-replace per document.
    // Deleting all docs upfront risks search-empty windows if indexing fails
    // partway through — per-document delete limits blast radius to already-
    // processed docs only.
    const chunksByDoc = new Map<string, IndexChunkInput[]>();
    for (const chunk of chunks) {
      const existing = chunksByDoc.get(chunk.documentId);
      if (existing) {
        existing.push(chunk);
      } else {
        chunksByDoc.set(chunk.documentId, [chunk]);
      }
    }

    const batchSize = 32;
    const docChunks = [...chunksByDoc.entries()];
    for (const [documentId, docBatch] of docChunks) {
      // Delete stale chunks for this document before writing new ones.
      await deleteChunksForDocuments({
        documentIds: [documentId],
        indexName,
        sourceType: "google_drive",
        tenantId: input.tenantId,
      });

      for (let offset = 0; offset < docBatch.length; offset += batchSize) {
        const batch = docBatch.slice(offset, offset + batchSize);
        const result = await bulkIndexChunks(indexName, batch, input.settings);
        indexedChunks += result.indexed;
      }
      indexedDocumentIds.add(documentId);
    }
  }

  for (const file of listedFiles) {
    const documentId = driveDocumentId(file.id);
    if (!indexedDocumentIds.has(documentId)) {
      continue;
    }
    const modifiedKey = driveModifiedKey(file);
    if (!modifiedKey) {
      continue;
    }
    await upsertTenantDriveIndexedFile({
      documentId,
      driveFileId: file.id,
      driveModifiedTime: modifiedKey,
      lastStatus: "indexed",
      tenantId: input.tenantId,
    });
  }

  // Only prune chunks for docs that genuinely have no extractable text.
  // Transient failures (token, download, ACL errors) leave existing chunks
  // intact so they stay searchable until the next successful reindex.
  const failedDocumentIds = new Set(
    skippedFiles
      .filter((entry) =>
        ["no_extractable_text", "file_too_large"].includes(entry.reason)
      )
      .map((entry) => driveDocumentId(entry.fileId))
  );

  const removedDriveFileIds = [...priorState.keys()].filter(
    (fileId) => !listedFileIds.has(fileId)
  );
  const removedDocumentIds = removedDriveFileIds.map((fileId) =>
    driveDocumentId(fileId)
  );

  const pruneDocumentIds = [
    ...new Set([...failedDocumentIds, ...removedDocumentIds]),
  ];

  const { deleted: prunedStaleDocuments } = await deleteChunksForDocuments({
    documentIds: pruneDocumentIds,
    indexName,
    sourceType: "google_drive",
    tenantId: input.tenantId,
  });

  await deleteTenantDriveIndexedFiles({
    driveFileIds: removedDriveFileIds,
    tenantId: input.tenantId,
  });

  const skipSamples = skippedFiles.slice(0, 10).map((entry) => ({
    detail: entry.detail?.slice(0, 180),
    fileId: entry.fileId,
    fileName: entry.fileName,
    mimeType: entry.mimeType,
    reason: entry.reason,
  }));

  return {
    indexedChunks,
    indexedDocuments: indexedDocumentIds.size,
    listedFiles: listedFiles.length,
    prunedStaleDocuments,
    removedFiles: removedDriveFileIds.length,
    skippedFiles: skippedFiles.length,
    skippedSamples: skipSamples,
    unchangedFiles: unchangedDocumentIds.size,
  };
}
