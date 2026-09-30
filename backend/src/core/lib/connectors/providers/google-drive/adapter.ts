import {
  type GoogleDriveToolId,
  isGoogleDriveToolId,
} from "@/shared/connectors/providers/google-drive/chat-tools";
import {
  driveCreateFolder,
  driveCreateSharedDrive,
  driveMoveFile,
  driveUpdateFile,
  driveUploadFile,
} from "./actions";
import { ensureFreshGoogleDriveAccessToken } from "./credential-token";
import {
  driveGetFile,
  driveListFolders,
  driveSearchFiles,
} from "./read-actions";
import { toDriveToolErrorOutput } from "./tool-output";

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function optionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export type { GoogleDriveToolId } from "@/shared/connectors/providers/google-drive/chat-tools";
export {
  GOOGLE_DRIVE_ACTION_TOOL_IDS,
  GOOGLE_DRIVE_ALL_TOOL_IDS,
  googleDriveToolIdsForConnector,
  isGoogleDriveToolId,
} from "@/shared/connectors/providers/google-drive/chat-tools";

export async function executeGoogleDrive(
  toolId: GoogleDriveToolId,
  merged: Record<string, unknown>
): Promise<unknown> {
  const tenantId = String(merged.tenantId ?? "");
  const tenantSlug = String(merged.tenantSlug ?? "");
  const credentialId = String(merged.credentialId ?? "");
  const userId = String(merged.userId ?? "");

  if (!tenantId || !tenantSlug || !credentialId || !userId) {
    return { error: "Google Drive connection context is incomplete." };
  }

  if (!isGoogleDriveToolId(toolId)) {
    return { error: `Unsupported Google Drive tool: ${toolId}` };
  }

  try {
    const accessToken = await ensureFreshGoogleDriveAccessToken({
      credentialId,
      tenantId,
      userId,
    });

    if (toolId === "driveListFolders") {
      return driveListFolders({
        accessToken,
        limit: optionalNumber(merged.limit),
        pageToken: optionalString(merged.pageToken),
        parentId: optionalString(merged.parentId),
        tenantId,
      });
    }
    if (toolId === "driveSearchFiles") {
      return driveSearchFiles({
        accessToken,
        folderOnly: optionalBoolean(merged.folderOnly),
        limit: optionalNumber(merged.limit),
        query: String(merged.query ?? ""),
        tenantId,
      });
    }
    if (toolId === "driveGetFile") {
      return driveGetFile({
        accessToken,
        fileId: optionalString(merged.fileId),
        fileName: optionalString(merged.fileName),
        includeContent: optionalBoolean(merged.includeContent),
        tenantId,
        userEmail: optionalString(merged.userEmail),
      });
    }
    if (toolId === "driveCreateFolder") {
      const name = String(merged.name ?? "");
      const parentId =
        typeof merged.parentId === "string" ? merged.parentId : undefined;
      return driveCreateFolder({
        accessToken,
        name,
        parentId,
        tenantId,
      });
    }
    if (toolId === "driveCreateSharedDrive") {
      const name = String(merged.name ?? "");
      const requestId =
        typeof merged.requestId === "string" ? merged.requestId : undefined;
      return driveCreateSharedDrive({
        accessToken,
        name,
        requestId,
        tenantId,
      });
    }
    if (toolId === "driveUploadFile") {
      const name = String(merged.name ?? "");
      const content = String(merged.content ?? "");
      const mimeType = String(merged.mimeType ?? "");
      const folderId =
        typeof merged.folderId === "string" ? merged.folderId : undefined;
      const description =
        typeof merged.description === "string" ? merged.description : undefined;
      const isBase64 = merged.isBase64 === true;
      return driveUploadFile({
        accessToken,
        content,
        description,
        folderId,
        isBase64,
        mimeType,
        name,
        tenantId,
      });
    }
    if (toolId === "driveMoveFile") {
      return driveMoveFile({
        accessToken,
        fileId: typeof merged.fileId === "string" ? merged.fileId : undefined,
        fileName:
          typeof merged.fileName === "string" ? merged.fileName : undefined,
        fromFolderId:
          typeof merged.fromFolderId === "string"
            ? merged.fromFolderId
            : undefined,
        tenantId,
        toFolderId:
          typeof merged.toFolderId === "string" ? merged.toFolderId : undefined,
        toFolderName:
          typeof merged.toFolderName === "string"
            ? merged.toFolderName
            : undefined,
      });
    }
    if (toolId === "driveUpdateFile") {
      return driveUpdateFile({
        accessToken,
        description:
          typeof merged.description === "string"
            ? merged.description
            : undefined,
        fileId: typeof merged.fileId === "string" ? merged.fileId : undefined,
        fileName:
          typeof merged.fileName === "string" ? merged.fileName : undefined,
        name: typeof merged.name === "string" ? merged.name : undefined,
        starred:
          typeof merged.starred === "boolean" ? merged.starred : undefined,
        tenantId,
        trashed:
          typeof merged.trashed === "boolean" ? merged.trashed : undefined,
      });
    }

    return { error: `Unsupported Google Drive tool: ${toolId}` };
  } catch (error) {
    return toDriveToolErrorOutput(error, tenantSlug);
  }
}
