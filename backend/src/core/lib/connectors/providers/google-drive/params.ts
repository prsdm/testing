import type { ToolParam } from "@/core/lib/connectors/providers/types";

export const GOOGLE_DRIVE_PARAMS: Record<string, ToolParam[]> = {
  driveCreateFolder: [
    {
      description: 'The name of the new folder. Example: "Project Assets"',
      name: "name",
      required: true,
      type: "string",
    },
    {
      description:
        "Parent folder or shared drive id. Omit to create in My Drive root.",
      name: "parentId",
      required: false,
      type: "string",
    },
  ],
  driveCreateSharedDrive: [
    {
      description: 'The name of the shared drive. Example: "Project Resources"',
      name: "name",
      required: true,
      type: "string",
    },
    {
      description:
        "Optional idempotency key. Omit to auto-generate; repeated requests with the same requestId will not create duplicates.",
      name: "requestId",
      required: false,
      type: "string",
    },
  ],
  driveGetFile: [
    {
      description:
        "File or folder id from a prior Drive tool result (id field) in this chat",
      name: "fileId",
      required: false,
      type: "string",
    },
    {
      description:
        'File or folder name to look up when fileId is omitted. Example: "Finance"',
      name: "fileName",
      required: false,
      type: "string",
    },
    {
      description:
        "When true, include readable text content for supported file types",
      name: "includeContent",
      required: false,
      type: "boolean",
    },
  ],
  driveListFolders: [
    {
      description:
        "Parent folder id to list children of. Omit to list folders from My Drive root and shared drives.",
      name: "parentId",
      required: false,
      type: "string",
    },
    {
      description: "Pagination token from a prior driveListFolders result",
      name: "pageToken",
      required: false,
      type: "string",
    },
    {
      description: "Maximum folders to return (default 20, max 50)",
      name: "limit",
      required: false,
      type: "number",
    },
  ],
  driveMoveFile: [
    {
      description:
        "File or folder id from a prior Drive tool result (id field) in this chat",
      name: "fileId",
      required: false,
      type: "string",
    },
    {
      description:
        'Name of the file or folder to move when fileId is omitted. Example: "openai latest news"',
      name: "fileName",
      required: false,
      type: "string",
    },
    {
      description:
        "Current parent folder id. Omit when using fileName; the current parent is resolved automatically.",
      name: "fromFolderId",
      required: false,
      type: "string",
    },
    {
      description:
        "Destination folder or shared drive id from a prior create-folder result",
      name: "toFolderId",
      required: false,
      type: "string",
    },
    {
      description:
        'Destination folder name when toFolderId is omitted. Example: "marketing team"',
      name: "toFolderName",
      required: false,
      type: "string",
    },
  ],
  driveSearchFiles: [
    {
      description:
        'Name or text to search for. Example: "Legal" or "notes.txt"',
      name: "query",
      required: true,
      type: "string",
    },
    {
      description: "When true, return only folders",
      name: "folderOnly",
      required: false,
      type: "boolean",
    },
    {
      description: "Maximum matches to return (default 20, max 100)",
      name: "limit",
      required: false,
      type: "number",
    },
  ],
  driveUpdateFile: [
    {
      description:
        "File or folder id from a prior Drive tool result (id field) in this chat",
      name: "fileId",
      required: false,
      type: "string",
    },
    {
      description:
        "Current file or folder name to update when fileId is omitted",
      name: "fileName",
      required: false,
      type: "string",
    },
    {
      description: "New file or folder name",
      name: "name",
      required: false,
      type: "string",
    },
    {
      description: "New file description",
      name: "description",
      required: false,
      type: "string",
    },
    {
      description: "Whether the file is starred",
      name: "starred",
      required: false,
      type: "boolean",
    },
    {
      description: "Whether the file is in trash",
      name: "trashed",
      required: false,
      type: "boolean",
    },
  ],
  driveUploadFile: [
    {
      description: "File name including extension",
      name: "name",
      required: true,
      type: "string",
    },
    {
      description: "Plain text or base64-encoded file content",
      name: "content",
      required: true,
      type: "string",
    },
    {
      description: 'MIME type, e.g. "text/plain" or "application/pdf"',
      name: "mimeType",
      required: true,
      type: "string",
    },
    {
      description: "Whether content is base64 encoded",
      name: "isBase64",
      required: false,
      type: "boolean",
    },
    {
      description: "Folder id to upload into; defaults to root",
      name: "folderId",
      required: false,
      type: "string",
    },
    {
      description: "Optional file description",
      name: "description",
      required: false,
      type: "string",
    },
  ],
};
