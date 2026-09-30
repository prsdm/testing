import { assertDriveActionAllowed } from "./auth";
import { driveGetFileContent, driveGetFileMetadata } from "./read";
import {
  fetchDriveItemById,
  resolveDriveItemByName,
  searchDriveItemsByName,
} from "./resolve-by-name";
import { enrichDriveRecord } from "./resource-type";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

async function driveListRequest(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Google Drive API request failed (${response.status}): ${text.slice(0, 300)}`
    );
  }
  return response;
}

export async function driveListFolders(input: {
  tenantId: string;
  accessToken: string;
  parentId?: string;
  pageToken?: string;
  limit?: number;
}) {
  await assertDriveActionAllowed({ action: "read", tenantId: input.tenantId });

  const pageSize = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const qParts = [
    "trashed = false",
    "mimeType = 'application/vnd.google-apps.folder'",
  ];
  if (input.parentId?.trim()) {
    qParts.push(`'${input.parentId.trim()}' in parents`);
  }

  const params = new URLSearchParams({
    corpora: "allDrives",
    fields:
      "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,parents)",
    includeItemsFromAllDrives: "true",
    orderBy: "modifiedTime desc,name",
    pageSize: String(pageSize),
    q: qParts.join(" and "),
    supportsAllDrives: "true",
  });
  if (input.pageToken?.trim()) {
    params.set("pageToken", input.pageToken.trim());
  }

  const response = await driveListRequest(
    `${DRIVE_API_BASE}/files?${params.toString()}`,
    input.accessToken
  );
  const payload = (await response.json()) as {
    nextPageToken?: string;
    files?: Array<{
      id?: string;
      name?: string;
      mimeType?: string;
      webViewLink?: string;
      modifiedTime?: string;
      parents?: string[];
    }>;
  };

  const folders = (payload.files ?? []).flatMap((file) => {
    if (!file.id) {
      return [];
    }
    return [
      enrichDriveRecord({
        id: file.id,
        link:
          file.webViewLink ??
          `https://drive.google.com/drive/folders/${file.id}`,
        mimeType: file.mimeType ?? "application/vnd.google-apps.folder",
        modifiedTime: file.modifiedTime,
        name: file.name ?? "Untitled",
        parentIds: file.parents ?? [],
      }),
    ];
  });

  const countLabel =
    folders.length === 1 ? "1 folder" : `${folders.length} folders`;
  return {
    folders,
    nextPageToken: payload.nextPageToken,
    summary: `Listed ${countLabel}`,
  };
}

export async function driveSearchFiles(input: {
  tenantId: string;
  accessToken: string;
  query: string;
  folderOnly?: boolean;
  limit?: number;
}) {
  await assertDriveActionAllowed({ action: "read", tenantId: input.tenantId });

  const query = input.query.trim();
  if (!query) {
    throw new Error("query is required.");
  }

  const matches = await searchDriveItemsByName({
    accessToken: input.accessToken,
    folderOnly: input.folderOnly === true,
    name: query,
    pageSize: input.limit,
  });

  const items = matches.map((item) =>
    enrichDriveRecord({
      id: item.id,
      link: item.link ?? `https://drive.google.com/file/d/${item.id}/view`,
      mimeType: item.mimeType,
      modifiedTime: item.modifiedTime,
      name: item.name,
      parentIds: item.parentIds,
    })
  );

  return {
    items,
    summary: `Found ${items.length} item${items.length === 1 ? "" : "s"} matching "${query}"`,
  };
}

export async function driveGetFile(input: {
  tenantId: string;
  accessToken: string;
  fileId?: string;
  fileName?: string;
  includeContent?: boolean;
  userEmail?: string;
}) {
  await assertDriveActionAllowed({ action: "read", tenantId: input.tenantId });

  let fileId = input.fileId?.trim() ?? "";
  if (!fileId) {
    if (!input.fileName?.trim()) {
      throw new Error("fileId or fileName is required.");
    }
    const resolved = await resolveDriveItemByName({
      accessToken: input.accessToken,
      itemLabel: "file",
      name: input.fileName,
    });
    fileId = resolved.id;
  }

  const metadata = await driveGetFileMetadata({
    accessToken: input.accessToken,
    fileId,
    tenantId: input.tenantId,
  });

  const base = enrichDriveRecord({
    id: metadata.id ?? fileId,
    link:
      metadata.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
    mimeType: metadata.mimeType ?? "application/octet-stream",
    modifiedTime: metadata.modifiedTime,
    name: metadata.name ?? "Untitled",
    trashed: metadata.trashed ?? false,
  });

  if (input.includeContent !== true) {
    return {
      ...base,
      summary: `Retrieved ${base.resourceType} "${base.name}"`,
    };
  }

  const contentResult = await driveGetFileContent({
    accessToken: input.accessToken,
    fileId,
    tenantId: input.tenantId,
    userEmail: input.userEmail ?? "",
  });

  return {
    ...base,
    content: contentResult.content,
    summary: `Retrieved ${base.resourceType} "${base.name}" with content`,
    truncated: contentResult.truncated,
  };
}

export async function resolveDriveFolderName(input: {
  accessToken: string;
  folderId: string;
}) {
  const folder = await fetchDriveItemById({
    accessToken: input.accessToken,
    fileId: input.folderId,
  });
  return folder.name;
}
