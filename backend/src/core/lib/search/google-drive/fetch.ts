import type { ProviderDirectoryCredentials } from "@/core/lib/people-sync/types";
import type {
  DriveFileForAccess,
  DrivePermission,
} from "@/core/lib/search/google-drive/external-access";
import { getDriveAccessTokenForUser } from "./drive-auth";
import { extractDriveFileText } from "./extract-file-text";
import { extractGoogleDocText } from "./extract-google-doc";
import { listAllWorkspaceUserEmails } from "./workspace-users";

export type DriveFileToIndex = DriveFileForAccess & {
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
  retrieverUserEmail?: string;
};

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

const EXPORTABLE_GOOGLE_MIME: Record<string, string> = {
  [GOOGLE_DOC_MIME]: "text/plain",
  "application/vnd.google-apps.presentation": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
};
const MAX_USER_FAILURE_RATE = 0.5;

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
    throw new Error(
      `Google Drive API ${path} failed (${response.status}): ${body.slice(0, 300)}`
    );
  }
  return response;
}

export async function listDriveFiles(
  accessToken: string,
  options?: { pageToken?: string }
) {
  const params = new URLSearchParams({
    corpora: "allDrives",
    fields:
      "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,size,permissions,permissionIds,owners,driveId)",
    includeItemsFromAllDrives: "true",
    pageSize: "100",
    q: [
      "trashed = false",
      "mimeType != 'application/vnd.google-apps.folder'",
      "mimeType != 'application/vnd.google-apps.shortcut'",
    ].join(" and "),
    supportsAllDrives: "true",
    ...(options?.pageToken ? { pageToken: options.pageToken } : {}),
  });

  const response = await driveFetch(`/files?${params.toString()}`, accessToken);
  const payload = (await response.json()) as {
    files?: DriveFileToIndex[];
    nextPageToken?: string;
  };

  const files = payload.files ?? [];
  return { files, nextPageToken: payload.nextPageToken };
}

export async function listDriveFilesForWorkspace(input: {
  credentials: ProviderDirectoryCredentials;
  googleDomain: string;
}) {
  const userEmails = await listAllWorkspaceUserEmails({
    credentials: input.credentials,
    googleDomain: input.googleDomain,
  });

  const byFileId = new Map<string, DriveFileToIndex>();
  let failedUsers = 0;
  for (const userEmail of userEmails) {
    try {
      const accessToken = await getDriveAccessTokenForUser(
        input.credentials,
        userEmail
      );
      let pageToken: string | undefined;
      do {
        const page = await listDriveFiles(accessToken, {
          pageToken,
        });
        for (const file of page.files) {
          if (!byFileId.has(file.id)) {
            byFileId.set(file.id, { ...file, retrieverUserEmail: userEmail });
          }
        }
        pageToken = page.nextPageToken;
      } while (pageToken);
    } catch {
      failedUsers += 1;
    }
  }

  if (
    userEmails.length > 0 &&
    failedUsers > MAX_USER_FAILURE_RATE * userEmails.length
  ) {
    throw new Error(
      `Too many Drive file listing failures (${failedUsers}/${userEmails.length})`
    );
  }

  return [...byFileId.values()];
}

export async function downloadDriveFileText(
  file: DriveFileToIndex,
  accessToken: string
): Promise<string | null> {
  // Google Docs: use the Docs API first (plain export is unreliable).
  // The Drive text/plain export silently drops tables, smart chips, and rich
  // links — the Docs API returns the full document JSON so nothing is lost.
  if (file.mimeType === GOOGLE_DOC_MIME) {
    const docsText = await extractGoogleDocText(file.id, accessToken);
    if (docsText) {
      return docsText;
    }
    // Fall through to Drive export below if Docs API returned nothing.
  }

  const exportMime = EXPORTABLE_GOOGLE_MIME[file.mimeType];

  if (exportMime) {
    const response = await driveFetch(
      `/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exportMime)}`,
      accessToken
    );
    const raw = Buffer.from(await response.arrayBuffer());
    // Exported Google Workspace bytes are always text (CSV or plain text).
    // We cannot use extractDriveFileText here because file.mimeType is still
    // the native google-apps.* type which has no handler there.
    const text = raw.toString("utf8").trim();
    return text.length > 0 ? text : null;
  }

  const response = await driveFetch(
    `/files/${encodeURIComponent(file.id)}?alt=media`,
    accessToken
  );
  const raw = Buffer.from(await response.arrayBuffer());
  return extractDriveFileText({ file, raw });
}

export function normalizeDrivePermissions(
  permissions: unknown
): DrivePermission[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return permissions.flatMap((permission) => {
    if (!permission || typeof permission !== "object") {
      return [];
    }
    const record = permission as Record<string, unknown>;
    const type = record.type;
    if (
      type !== "user" &&
      type !== "group" &&
      type !== "domain" &&
      type !== "anyone"
    ) {
      return [];
    }
    return [
      {
        allowFileDiscovery:
          typeof record.allowFileDiscovery === "boolean"
            ? record.allowFileDiscovery
            : undefined,
        domain: typeof record.domain === "string" ? record.domain : undefined,
        emailAddress:
          typeof record.emailAddress === "string"
            ? record.emailAddress
            : undefined,
        id: String(record.id ?? ""),
        permissionDetails: Array.isArray(record.permissionDetails)
          ? (record.permissionDetails as DrivePermission["permissionDetails"])
          : undefined,
        type,
      },
    ];
  });
}
