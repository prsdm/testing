import type { Provider } from "@/shared/connectors/provider-types";
import { DEFAULT_GOOGLE_DRIVE_OAUTH_SCOPES } from "./scopes";

export const GOOGLE_DRIVE_PROVIDER_ID = "google-drive";

export const googleDriveProvider: Provider = {
  auth: ["OAUTH2"],
  authType: "OAUTH2",
  category: "Productivity",
  description:
    "Connect your Google Drive account to manage files and folders from chat.",
  iconColor: "bg-blue-500",
  id: GOOGLE_DRIVE_PROVIDER_ID,
  name: "Google Drive",
  scopes: [...DEFAULT_GOOGLE_DRIVE_OAUTH_SCOPES],
  tools: [
    {
      description:
        "List folders in Google Drive. Optionally pass parentId to list a folder's children. Returns id, name, mimeType, and resourceType for each folder.",
      id: "driveListFolders",
      name: "List Drive folders",
    },
    {
      description:
        "Search Google Drive files and folders by name. Set folderOnly to true to find folders only. Returns id, name, mimeType, and resourceType.",
      id: "driveSearchFiles",
      name: "Search Drive",
    },
    {
      description:
        "Get metadata for a Drive file or folder by id or name. Optionally include readable content. Returns mimeType and resourceType so you can verify folder vs file.",
      id: "driveGetFile",
      name: "Get Drive file",
    },
    {
      description:
        "Create a new folder in Google Drive or inside a shared drive. Optionally set parentId to a folder or shared drive id; omit for My Drive root.",
      id: "driveCreateFolder",
      name: "Create Drive folder",
    },
    {
      description:
        "Create a new Google shared drive (team drive). Requires a Google Workspace account with permission to create shared drives.",
      id: "driveCreateSharedDrive",
      name: "Create shared drive",
    },
    {
      description:
        "Upload plain text or base64 file content up to 5 MB into Drive.",
      id: "driveUploadFile",
      name: "Upload Drive file",
    },
    {
      description:
        "Move a file or folder to a different parent folder or shared drive. Pass fileId/toFolderId from prior tool results, or fileName/toFolderName to resolve by name. fromFolderId is optional when using fileName.",
      id: "driveMoveFile",
      name: "Move Drive file",
    },
    {
      description:
        "Update file or folder metadata: rename, description, star, or trash. Pass fileId or fileName. Does not change file content.",
      id: "driveUpdateFile",
      name: "Update Drive file",
    },
  ],
};
