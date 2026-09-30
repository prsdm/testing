import { randomUUID } from "node:crypto";
import { assertDriveActionAllowed } from "./auth";
import { resolveDriveFolderName } from "./read-actions";
import { fetchDriveItemById, resolveDriveItemByName } from "./resolve-by-name";
import { enrichDriveRecord } from "./resource-type";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

async function driveJsonRequest(
  url: string,
  accessToken: string,
  init?: RequestInit
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Google Drive API request failed (${response.status}): ${text.slice(0, 300)}`
    );
  }
  return response;
}

export async function driveCreateFolder(input: {
  tenantId: string;
  accessToken: string;
  name: string;
  parentId?: string;
}) {
  await assertDriveActionAllowed({
    action: "create",
    tenantId: input.tenantId,
  });
  const name = input.name.trim();
  if (!name) {
    throw new Error("name is required.");
  }

  const body: Record<string, unknown> = {
    mimeType: "application/vnd.google-apps.folder",
    name,
  };
  if (input.parentId?.trim()) {
    body.parents = [input.parentId.trim()];
  }

  const response = await driveJsonRequest(
    `${DRIVE_API_BASE}/files?fields=id,name,mimeType,createdTime,parents&supportsAllDrives=true`,
    input.accessToken,
    {
      body: JSON.stringify(body),
      method: "POST",
    }
  );
  const file = (await response.json()) as {
    id?: string;
    name?: string;
    mimeType?: string;
    createdTime?: string;
    parents?: string[];
  };

  return enrichDriveRecord({
    createdTime: file.createdTime ?? "",
    id: file.id ?? "",
    link: file.id ? driveFolderLink(file.id) : undefined,
    mimeType: file.mimeType ?? "application/vnd.google-apps.folder",
    name: file.name ?? name,
    parentIds: file.parents ?? [],
  });
}

function driveFolderLink(folderId: string) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

const DRIVE_FILE_FIELDS =
  "id,name,mimeType,description,starred,trashed,parents,createdTime,modifiedTime,webViewLink";

export async function driveMoveFile(input: {
  tenantId: string;
  accessToken: string;
  fileId?: string;
  fileName?: string;
  fromFolderId?: string;
  toFolderId?: string;
  toFolderName?: string;
}) {
  await assertDriveActionAllowed({
    action: "create",
    tenantId: input.tenantId,
  });

  let fileId = input.fileId?.trim() ?? "";
  let fromFolderId = input.fromFolderId?.trim() ?? "";
  let toFolderId = input.toFolderId?.trim() ?? "";
  let toFolderName = input.toFolderName?.trim() ?? "";

  const fileMeta = fileId
    ? await fetchDriveItemById({ accessToken: input.accessToken, fileId })
    : input.fileName?.trim()
      ? await resolveDriveItemByName({
          accessToken: input.accessToken,
          itemLabel: "file",
          name: input.fileName,
        })
      : null;

  if (!fileMeta) {
    throw new Error("fileId or fileName is required.");
  }

  fileId = fileMeta.id;
  if (!fromFolderId) {
    fromFolderId = fileMeta.parentIds.at(0) ?? "";
  }
  if (!fromFolderId) {
    throw new Error(
      "fromFolderId is required when the file has no parent folder."
    );
  }

  if (!toFolderId && toFolderName) {
    const destinationFolder = await resolveDriveItemByName({
      accessToken: input.accessToken,
      folderOnly: true,
      itemLabel: "folder",
      name: toFolderName,
    });
    toFolderId = destinationFolder.id;
    toFolderName = destinationFolder.name;
  } else if (toFolderId && !toFolderName) {
    toFolderName = await resolveDriveFolderName({
      accessToken: input.accessToken,
      folderId: toFolderId,
    });
  }
  if (!toFolderId) {
    throw new Error("toFolderId or toFolderName is required.");
  }

  const params = new URLSearchParams({
    addParents: toFolderId,
    fields: "id,name,mimeType,parents,webViewLink",
    removeParents: fromFolderId,
    supportsAllDrives: "true",
  });
  const response = await driveJsonRequest(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?${params.toString()}`,
    input.accessToken,
    { method: "PATCH" }
  );
  const file = (await response.json()) as {
    id?: string;
    name?: string;
    mimeType?: string;
    parents?: string[];
    webViewLink?: string;
  };

  return enrichDriveRecord({
    fromFolderId,
    id: file.id ?? fileId,
    link: file.webViewLink,
    mimeType: file.mimeType ?? fileMeta.mimeType,
    name: file.name ?? fileMeta.name,
    parentIds: file.parents ?? [toFolderId],
    toFolderId,
    toFolderName,
  });
}

export async function driveUpdateFile(input: {
  tenantId: string;
  accessToken: string;
  fileId?: string;
  fileName?: string;
  name?: string;
  description?: string;
  starred?: boolean;
  trashed?: boolean;
}) {
  await assertDriveActionAllowed({
    action: "create",
    tenantId: input.tenantId,
  });

  let fileId = input.fileId?.trim() ?? "";
  if (!fileId) {
    if (!input.fileName?.trim()) {
      throw new Error("fileId or fileName is required.");
    }
    const file = await resolveDriveItemByName({
      accessToken: input.accessToken,
      itemLabel: "file",
      name: input.fileName,
    });
    fileId = file.id;
  }

  const body: Record<string, unknown> = {};
  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (name) {
      body.name = name;
    }
  }
  if (typeof input.description === "string") {
    body.description = input.description.trim();
  }
  if (typeof input.starred === "boolean") {
    body.starred = input.starred;
  }
  if (typeof input.trashed === "boolean") {
    body.trashed = input.trashed;
  }
  if (Object.keys(body).length === 0) {
    throw new Error(
      "At least one of name, description, starred, or trashed is required."
    );
  }

  const params = new URLSearchParams({
    fields: DRIVE_FILE_FIELDS,
    supportsAllDrives: "true",
  });
  const response = await driveJsonRequest(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?${params.toString()}`,
    input.accessToken,
    {
      body: JSON.stringify(body),
      method: "PATCH",
    }
  );
  const file = (await response.json()) as {
    id?: string;
    name?: string;
    mimeType?: string;
    description?: string;
    starred?: boolean;
    trashed?: boolean;
    parents?: string[];
    createdTime?: string;
    modifiedTime?: string;
    webViewLink?: string;
  };

  return enrichDriveRecord({
    createdTime: file.createdTime,
    description: file.description,
    id: file.id ?? fileId,
    link: file.webViewLink,
    mimeType: file.mimeType ?? "application/octet-stream",
    modifiedTime: file.modifiedTime,
    name: file.name ?? "",
    parentIds: file.parents ?? [],
    starred: file.starred ?? false,
    trashed: file.trashed ?? false,
  });
}

export async function driveCreateSharedDrive(input: {
  tenantId: string;
  accessToken: string;
  name: string;
  requestId?: string;
}) {
  await assertDriveActionAllowed({
    action: "create",
    tenantId: input.tenantId,
  });
  const name = input.name.trim();
  if (!name) {
    throw new Error("name is required.");
  }

  const requestId = input.requestId?.trim() || randomUUID();
  const response = await driveJsonRequest(
    `${DRIVE_API_BASE}/drives?requestId=${encodeURIComponent(requestId)}&fields=id,name,kind,createdTime,hidden`,
    input.accessToken,
    {
      body: JSON.stringify({ name }),
      method: "POST",
    }
  );
  const drive = (await response.json()) as {
    id?: string;
    name?: string;
    kind?: string;
    createdTime?: string;
    hidden?: boolean;
  };

  const id = drive.id ?? "";
  return enrichDriveRecord({
    createdTime: drive.createdTime ?? "",
    hidden: drive.hidden ?? false,
    id,
    kind: drive.kind ?? "drive#drive",
    link: id ? driveFolderLink(id) : undefined,
    name: drive.name ?? name,
  });
}

export async function driveUploadLibraryFile(input: {
  tenantId: string;
  accessToken: string;
  name: string;
  sourceMimeType: string;
  content: Buffer;
  targetGoogleAppsMime?: string | null;
  description?: string;
  folderId?: string;
}) {
  await assertDriveActionAllowed({
    action: "create",
    tenantId: input.tenantId,
  });

  const name = input.name.trim();
  const sourceMimeType = input.sourceMimeType.trim();
  if (!name) {
    throw new Error("name is required.");
  }
  if (!sourceMimeType) {
    throw new Error("sourceMimeType is required.");
  }
  if (!input.content.byteLength) {
    throw new Error("content is required.");
  }

  const metadata: Record<string, unknown> = {
    mimeType: input.targetGoogleAppsMime?.trim() || sourceMimeType,
    name,
  };
  if (input.description?.trim()) {
    metadata.description = input.description.trim();
  }
  if (input.folderId?.trim()) {
    metadata.parents = [input.folderId.trim()];
  }

  const boundary = `kimiro_${randomUUID()}`;
  const metadataPart = JSON.stringify(metadata);
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n`
    ),
    Buffer.from(`--${boundary}\r\nContent-Type: ${sourceMimeType}\r\n\r\n`),
    input.content,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const uploadResponse = await fetch(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink&supportsAllDrives=true`,
    {
      body,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      method: "POST",
    }
  );
  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => "");
    throw new Error(
      `Failed to upload file to Google Drive (${uploadResponse.status}): ${text.slice(0, 300)}`
    );
  }

  const file = (await uploadResponse.json()) as {
    id?: string;
    name?: string;
    mimeType?: string;
    webViewLink?: string;
    webContentLink?: string;
  };

  if (!file.id) {
    throw new Error("Google Drive upload returned no file id.");
  }

  return enrichDriveRecord({
    id: file.id,
    link: file.webViewLink,
    mimeType: file.mimeType ?? metadata.mimeType?.toString(),
    name: file.name ?? name,
    webContentLink: file.webContentLink,
    webViewLink: file.webViewLink,
  });
}

export async function driveUploadFile(input: {
  tenantId: string;
  accessToken: string;
  name: string;
  content: string;
  mimeType: string;
  isBase64?: boolean;
  folderId?: string;
  description?: string;
}) {
  await assertDriveActionAllowed({
    action: "create",
    tenantId: input.tenantId,
  });
  const name = input.name.trim();
  const mimeType = input.mimeType.trim();
  if (!name) {
    throw new Error("name is required.");
  }
  if (!mimeType) {
    throw new Error("mimeType is required.");
  }
  if (!input.content) {
    throw new Error("content is required.");
  }

  const metadataBody: Record<string, unknown> = { mimeType, name };
  if (input.description?.trim()) {
    metadataBody.description = input.description.trim();
  }
  if (input.folderId?.trim()) {
    metadataBody.parents = [input.folderId.trim()];
  }

  const createResponse = await driveJsonRequest(
    `${DRIVE_API_BASE}/files?fields=id,name,mimeType,webViewLink,webContentLink&supportsAllDrives=true`,
    input.accessToken,
    {
      body: JSON.stringify(metadataBody),
      method: "POST",
    }
  );
  const created = (await createResponse.json()) as { id?: string };
  const fileId = created.id;
  if (!fileId) {
    throw new Error("Failed to create file metadata in Google Drive.");
  }

  const fileContent = input.isBase64
    ? Buffer.from(input.content, "base64")
    : input.content;

  const uploadResponse = await fetch(
    `${DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,mimeType,webViewLink,webContentLink&supportsAllDrives=true`,
    {
      body: fileContent,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": mimeType,
      },
      method: "PATCH",
    }
  );
  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => "");
    throw new Error(
      `Failed to upload file content (${uploadResponse.status}): ${text.slice(0, 300)}`
    );
  }

  const file = (await uploadResponse.json()) as {
    id?: string;
    name?: string;
    mimeType?: string;
    webViewLink?: string;
    webContentLink?: string;
  };

  return enrichDriveRecord({
    id: file.id ?? fileId,
    link: file.webViewLink,
    mimeType: file.mimeType ?? mimeType,
    name: file.name ?? name,
    webContentLink: file.webContentLink,
    webViewLink: file.webViewLink,
  });
}
