import { buildDriveNameSearchQuery } from "./find-query";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

export type DriveResolvedItem = {
  id: string;
  name: string;
  mimeType: string;
  parentIds: string[];
  link?: string;
};

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

export async function searchDriveItemsByName(input: {
  accessToken: string;
  name: string;
  folderOnly?: boolean;
  pageSize?: number;
}) {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("name is required.");
  }

  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
  const params = new URLSearchParams({
    fields: "files(id,name,mimeType,modifiedTime,parents,webViewLink)",
    includeItemsFromAllDrives: "true",
    orderBy: "modifiedTime desc",
    pageSize: String(pageSize),
    q: buildDriveNameSearchQuery({
      folderOnly: input.folderOnly,
      name: trimmedName,
    }),
    supportsAllDrives: "true",
  });

  const response = await driveListRequest(
    `${DRIVE_API_BASE}/files?${params.toString()}`,
    input.accessToken
  );
  const data = (await response.json()) as {
    files?: Array<{
      id?: string;
      name?: string;
      mimeType?: string;
      modifiedTime?: string;
      parents?: string[];
      webViewLink?: string;
    }>;
  };

  return (data.files ?? []).map((file) => ({
    id: file.id ?? "",
    link: file.webViewLink,
    mimeType: file.mimeType ?? "",
    modifiedTime: file.modifiedTime ?? "",
    name: file.name ?? "",
    parentIds: file.parents ?? [],
  }));
}

function pickBestNameMatch<T extends { name: string }>(
  items: T[],
  searchName: string
) {
  if (items.length === 0) {
    return null;
  }
  if (items.length === 1) {
    return items[0] ?? null;
  }

  const normalizedSearch = searchName.trim().toLowerCase();
  const exactMatches = items.filter(
    (item) => item.name.trim().toLowerCase() === normalizedSearch
  );
  if (exactMatches.length === 1) {
    return exactMatches[0] ?? null;
  }
  if (exactMatches.length > 1) {
    return exactMatches[0] ?? null;
  }

  return items[0] ?? null;
}

export async function resolveDriveItemByName(input: {
  accessToken: string;
  name: string;
  folderOnly?: boolean;
  itemLabel?: string;
}): Promise<DriveResolvedItem> {
  const trimmedName = input.name.trim();
  const label = input.itemLabel ?? (input.folderOnly ? "folder" : "file");
  const matches = await searchDriveItemsByName({
    accessToken: input.accessToken,
    folderOnly: input.folderOnly,
    name: trimmedName,
  });

  if (matches.length === 0) {
    throw new Error(`No Drive ${label} matched "${trimmedName}".`);
  }

  const match = pickBestNameMatch(matches, trimmedName);
  if (!match?.id) {
    throw new Error(`No Drive ${label} matched "${trimmedName}".`);
  }

  const nearMatches = matches
    .slice(0, 5)
    .map((item) => item.name)
    .filter(Boolean);
  const hasExactMatch = matches.some(
    (item) => item.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (matches.length > 1 && !hasExactMatch) {
    throw new Error(
      `Multiple Drive ${label}s matched "${trimmedName}": ${nearMatches.join(", ")}. Use a more specific name or pass fileId.`
    );
  }

  return {
    id: match.id,
    link: match.link,
    mimeType: match.mimeType,
    name: match.name,
    parentIds: match.parentIds,
  };
}

export async function fetchDriveItemById(input: {
  accessToken: string;
  fileId: string;
}) {
  const fileId = input.fileId.trim();
  if (!fileId) {
    throw new Error("fileId is required.");
  }

  const params = new URLSearchParams({
    fields: "id,name,mimeType,parents,webViewLink",
    supportsAllDrives: "true",
  });
  const response = await driveListRequest(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?${params.toString()}`,
    input.accessToken
  );
  const file = (await response.json()) as {
    id?: string;
    name?: string;
    mimeType?: string;
    parents?: string[];
    webViewLink?: string;
  };

  return {
    id: file.id ?? fileId,
    link: file.webViewLink,
    mimeType: file.mimeType ?? "",
    name: file.name ?? "",
    parentIds: file.parents ?? [],
  };
}
