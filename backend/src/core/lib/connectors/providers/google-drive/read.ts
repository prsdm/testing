import { materializeXlsxFormulas } from "@/core/lib/artifacts/sheet-xlsx-exceljs";
import type { DriveFileForAccess } from "@/core/lib/search/google-drive/external-access";
import type { DriveFileToIndex } from "@/core/lib/search/google-drive/fetch";
import { downloadDriveFileText } from "@/core/lib/search/google-drive/fetch";
import { resolveReadableContent } from "@/core/lib/sources/index-content-limits";
import {
  type DriveImportKind,
  ensureChatAttachFileName,
  GOOGLE_SHEET_MIME,
  MAX_CHAT_ATTACH_BYTES,
  MAX_DRIVE_IMPORT_BYTES,
  resolveChatAttachPlan,
  resolveDriveImportPlan,
  wrapDriveBytesAsArtifactContent,
} from "@/shared/artifacts/drive-import";
import { encodeWorkbook } from "@/shared/artifacts/sheet-xlsx";
import { assertDriveActionAllowed } from "./auth";
import { fetchGoogleSheetAsWorkbookSheets } from "./sheets-values";
import type { DriveFileSummary, DriveGetFileResult } from "./types";

async function driveFetch(
  path: string,
  accessToken: string,
  init?: RequestInit
) {
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const lower = body.toLowerCase();
    if (
      response.status === 403 &&
      (lower.includes("insufficient") ||
        lower.includes("access_not_configured") ||
        lower.includes("permission"))
    ) {
      throw new Error(
        "Google Drive permissions need updating. Open Google Drive once from Connectors if this keeps happening."
      );
    }
    throw new Error(
      `Google Drive API ${path} failed (${response.status}): ${body.slice(0, 300)}`
    );
  }
  return response;
}

export async function driveGetFileMetadata(input: {
  tenantId: string;
  fileId: string;
  accessToken: string;
}) {
  await assertDriveActionAllowed({ action: "read", tenantId: input.tenantId });
  const response = await driveFetch(
    `/files/${encodeURIComponent(input.fileId)}?fields=id,name,mimeType,webViewLink,modifiedTime,trashed&supportsAllDrives=true`,
    input.accessToken
  );
  return (await response.json()) as {
    id?: string;
    name?: string;
    mimeType?: string;
    webViewLink?: string;
    modifiedTime?: string;
    trashed?: boolean;
  };
}

export async function driveGetFileForAccess(input: {
  tenantId: string;
  fileId: string;
  accessToken: string;
}): Promise<DriveFileForAccess> {
  await assertDriveActionAllowed({ action: "read", tenantId: input.tenantId });
  const response = await driveFetch(
    `/files/${encodeURIComponent(input.fileId.trim())}?fields=id,name,owners,permissions,permissionIds,driveId&supportsAllDrives=true`,
    input.accessToken
  );
  return (await response.json()) as DriveFileForAccess;
}

export async function driveGetFileContent(input: {
  tenantId: string;
  userEmail: string;
  fileId: string;
  accessToken: string;
  maxContentBytes?: number;
  maxContentMb?: number;
}): Promise<DriveGetFileResult> {
  await assertDriveActionAllowed({ action: "read", tenantId: input.tenantId });
  const metadata = await driveGetFileMetadata({
    accessToken: input.accessToken,
    fileId: input.fileId.trim(),
    tenantId: input.tenantId,
  });
  const fileId = metadata.id ?? input.fileId.trim();
  const title = metadata.name ?? "Untitled";
  const mimeType = metadata.mimeType ?? "application/octet-stream";
  const link =
    metadata.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;

  const fileForDownload: DriveFileToIndex = {
    id: fileId,
    mimeType,
    modifiedTime: metadata.modifiedTime,
    name: title,
    permissionIds: [],
    permissions: [],
    webViewLink: link,
  };

  const rawContent = await downloadDriveFileText(
    fileForDownload,
    input.accessToken
  );
  const content = rawContent ?? "";
  const { content: resolvedContent, truncated } = resolveReadableContent(
    content,
    input.maxContentBytes === undefined
      ? undefined
      : {
          maxContentBytes: input.maxContentBytes,
          maxContentMb: input.maxContentMb,
        }
  );

  return {
    content: resolvedContent,
    fileId,
    link,
    mimeType,
    modifiedTime: metadata.modifiedTime,
    title,
    truncated,
  };
}

function mapDriveApiFiles(
  files:
    | Array<{
        id?: string;
        name?: string;
        mimeType?: string;
        webViewLink?: string;
        modifiedTime?: string;
        driveId?: string;
      }>
    | undefined
): DriveFileSummary[] {
  return (files ?? []).flatMap((file) => {
    if (!file.id) {
      return [];
    }
    return [
      {
        driveId: file.driveId,
        fileId: file.id,
        link:
          file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
        mimeType: file.mimeType ?? "application/octet-stream",
        modifiedTime: file.modifiedTime,
        title: file.name ?? "Untitled",
      },
    ];
  });
}

export async function driveBrowseFiles(input: {
  tenantId: string;
  query?: string;
  pageToken?: string;
  limit?: number;
  accessToken: string;
}): Promise<{ files: DriveFileSummary[]; nextPageToken?: string }> {
  await assertDriveActionAllowed({ action: "read", tenantId: input.tenantId });
  const accessToken = input.accessToken;
  const trimmed = input.query?.trim() ?? "";
  const pageSize = Math.min(input.limit ?? 20, 50);

  const qParts = [
    "trashed = false",
    "mimeType != 'application/vnd.google-apps.folder'",
  ];
  if (trimmed) {
    const escaped = trimmed.replaceAll("'", "\\'");
    qParts.push(
      `(name contains '${escaped}' or fullText contains '${escaped}')`
    );
  }

  const params = new URLSearchParams({
    corpora: "allDrives",
    fields:
      "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,driveId)",
    includeItemsFromAllDrives: "true",
    orderBy: "modifiedTime desc",
    pageSize: String(pageSize),
    q: qParts.join(" and "),
    supportsAllDrives: "true",
  });
  if (input.pageToken) {
    params.set("pageToken", input.pageToken);
  }

  const response = await driveFetch(`/files?${params.toString()}`, accessToken);
  const payload = (await response.json()) as {
    nextPageToken?: string;
    files?: Array<{
      id?: string;
      name?: string;
      mimeType?: string;
      webViewLink?: string;
      modifiedTime?: string;
      driveId?: string;
    }>;
  };

  return {
    files: mapDriveApiFiles(payload.files),
    nextPageToken: payload.nextPageToken,
  };
}

export async function driveCanAccessFile(input: {
  tenantId: string;
  fileId: string;
  accessToken: string;
}): Promise<boolean> {
  const status = await driveGetFileAccessStatus(input);
  return status === "accessible";
}

export async function driveGetFileAccessStatus(input: {
  tenantId: string;
  fileId: string;
  accessToken: string;
}): Promise<"accessible" | "not_found" | "forbidden" | "unknown_error"> {
  await assertDriveActionAllowed({ action: "read", tenantId: input.tenantId });
  const fileId = input.fileId.trim();
  if (!fileId) {
    return "not_found";
  }
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
        },
      }
    );
    if (response.ok) {
      return "accessible";
    }
    if (response.status === 404) {
      return "not_found";
    }
    if (response.status === 403) {
      return "forbidden";
    }
    return "unknown_error";
  } catch {
    return "unknown_error";
  }
}

export type DriveArtifactDownload = {
  fileId: string;
  title: string;
  mimeType: string;
  link: string;
  kind: DriveImportKind;
  content: string;
  modifiedTime?: string;
};

/** Download a Drive Doc/Sheet/docx/xlsx as stored chat artifact content. */
export async function driveDownloadFileForArtifact(input: {
  tenantId: string;
  fileId: string;
  accessToken: string;
  maxBytes?: number;
}): Promise<DriveArtifactDownload> {
  await assertDriveActionAllowed({ action: "read", tenantId: input.tenantId });
  const metadata = await driveGetFileMetadata({
    accessToken: input.accessToken,
    fileId: input.fileId.trim(),
    tenantId: input.tenantId,
  });
  const fileId = metadata.id ?? input.fileId.trim();
  const title = metadata.name?.trim() || "Untitled";
  const mimeType = metadata.mimeType ?? "application/octet-stream";
  const link =
    metadata.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;

  const plan = resolveDriveImportPlan(mimeType);
  if (!plan) {
    throw new Error(
      "Only Google Docs, Sheets, .docx, and .xlsx files can be opened in Kimiro."
    );
  }

  const maxBytes = input.maxBytes ?? MAX_DRIVE_IMPORT_BYTES;

  // Native Google Sheets: read calculated values via Sheets API.
  // Do NOT fall back to silent xlsx export — that strips formula results
  // (TOTAL / Annual / % columns go blank).
  if (mimeType === GOOGLE_SHEET_MIME) {
    try {
      const sheets = await fetchGoogleSheetAsWorkbookSheets({
        accessToken: input.accessToken,
        spreadsheetId: fileId,
      });
      return {
        content: encodeWorkbook(sheets),
        fileId,
        kind: "sheet",
        link,
        mimeType,
        modifiedTime: metadata.modifiedTime,
        title,
      };
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Unknown Sheets API error";
      throw new Error(
        `Could not read calculated values from Google Sheets (${detail}). Try Connect Google Drive once on Connectors if this persists.`
      );
    }
  }

  const path = plan.exportMimeType
    ? `/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(plan.exportMimeType)}`
    : `/files/${encodeURIComponent(fileId)}?alt=media`;

  const response = await driveFetch(path, input.accessToken);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("Drive file is empty.");
  }
  if (bytes.byteLength > maxBytes) {
    throw new Error(
      `File is too large to open in Kimiro (max ${Math.floor(maxBytes / (1024 * 1024))}MB).`
    );
  }

  return {
    content:
      plan.kind === "sheet"
        ? await materializeXlsxFormulas(
            wrapDriveBytesAsArtifactContent(plan, bytes)
          )
        : wrapDriveBytesAsArtifactContent(plan, bytes),
    fileId,
    kind: plan.kind,
    link,
    mimeType,
    modifiedTime: metadata.modifiedTime,
    title,
  };
}

export type DriveChatAttachmentDownload = {
  fileId: string;
  title: string;
  mimeType: string;
  bytes: Buffer;
};

/** Download a Drive file for chat (images, PDF, docs; Google Docs → PDF). */
export async function driveDownloadFileForChatAttachment(input: {
  tenantId: string;
  fileId: string;
  accessToken: string;
}): Promise<DriveChatAttachmentDownload> {
  await assertDriveActionAllowed({ action: "read", tenantId: input.tenantId });
  const metadata = await driveGetFileMetadata({
    accessToken: input.accessToken,
    fileId: input.fileId.trim(),
    tenantId: input.tenantId,
  });
  const fileId = metadata.id ?? input.fileId.trim();
  const sourceTitle = metadata.name?.trim() || "Untitled";
  const sourceMime = metadata.mimeType ?? "application/octet-stream";
  const plan = resolveChatAttachPlan(sourceMime);

  if (!plan) {
    throw new Error(
      "Only images, PDFs, documents, and spreadsheets can be attached from Drive."
    );
  }

  const path =
    plan.download === "export" && plan.exportMimeType
      ? `/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(plan.exportMimeType)}`
      : `/files/${encodeURIComponent(fileId)}?alt=media`;

  const response = await driveFetch(path, input.accessToken);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("Drive file is empty.");
  }
  if (bytes.byteLength > MAX_CHAT_ATTACH_BYTES) {
    throw new Error("File size should be less than 5MB.");
  }

  return {
    bytes,
    fileId,
    mimeType: plan.resultMimeType,
    title: ensureChatAttachFileName(sourceTitle, plan),
  };
}
