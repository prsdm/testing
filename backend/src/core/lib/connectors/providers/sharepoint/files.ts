import { assertSharePointActionAllowed } from "@/core/lib/connectors/providers/sharepoint/auth";
import {
  isChatAttachableMime,
  MAX_CHAT_ATTACH_BYTES,
} from "@/shared/artifacts/drive-import";

export type SharePointFileSummary = {
  fileId: string;
  title: string;
  mimeType: string;
  link: string;
  modifiedTime?: string;
};

export type SharePointChatAttachmentDownload = {
  fileId: string;
  title: string;
  mimeType: string;
  bytes: Buffer;
};

function encodeSharePointFileId(driveId: string, itemId: string) {
  return `${driveId}::${itemId}`;
}

export function parseSharePointFileId(fileId: string): {
  driveId: string;
  itemId: string;
} {
  const separator = fileId.indexOf("::");
  if (separator <= 0 || separator === fileId.length - 2) {
    throw new Error("Invalid SharePoint file id.");
  }
  return {
    driveId: fileId.slice(0, separator),
    itemId: fileId.slice(separator + 2),
  };
}

type GraphSearchHit = {
  hitId?: string;
  resource?: {
    id?: string;
    name?: string;
    webUrl?: string;
    lastModifiedDateTime?: string;
    file?: { mimeType?: string };
    parentReference?: { driveId?: string };
  };
};

const SHAREPOINT_ATTACH_FILETYPES =
  "(fileType:jpg OR fileType:jpeg OR fileType:png OR fileType:pdf OR fileType:docx OR fileType:xlsx OR fileType:txt OR fileType:md)";

/**
 * Browse attachable files across SharePoint / OneDrive for Business via Graph search.
 */
export async function sharePointBrowseAttachableFiles(args: {
  tenantId: string;
  accessToken: string;
  query?: string;
  from?: number;
  limit?: number;
}): Promise<{ files: SharePointFileSummary[]; nextFrom?: number }> {
  await assertSharePointActionAllowed({
    action: "read",
    tenantId: args.tenantId,
  });

  const limit = Math.min(args.limit ?? 20, 50);
  const from = Math.max(args.from ?? 0, 0);
  const trimmed = args.query?.trim() ?? "";
  const queryString = trimmed
    ? `${trimmed} ${SHAREPOINT_ATTACH_FILETYPES}`
    : SHAREPOINT_ATTACH_FILETYPES;

  const response = await fetch(
    "https://graph.microsoft.com/v1.0/search/query",
    {
      body: JSON.stringify({
        requests: [
          {
            entityTypes: ["driveItem"],
            fields: [
              "id",
              "name",
              "webUrl",
              "lastModifiedDateTime",
              "parentReference",
              "file",
            ],
            from,
            query: { queryString },
            size: limit,
          },
        ],
      }),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `SharePoint search failed (${response.status}): ${body.slice(0, 300)}`
    );
  }

  const payload = (await response.json()) as {
    value?: Array<{
      hitsContainers?: Array<{
        hits?: GraphSearchHit[];
        moreResultsAvailable?: boolean;
      }>;
    }>;
  };

  const hits =
    payload.value?.flatMap((entry) =>
      (entry.hitsContainers ?? []).flatMap((container) => container.hits ?? [])
    ) ?? [];

  const files: SharePointFileSummary[] = [];
  for (const hit of hits) {
    const resource = hit.resource;
    const driveId = resource?.parentReference?.driveId;
    const itemId = resource?.id;
    const mimeType = resource?.file?.mimeType ?? "";
    if (!(driveId && itemId && isChatAttachableMime(mimeType))) {
      continue;
    }
    files.push({
      fileId: encodeSharePointFileId(driveId, itemId),
      link: resource.webUrl ?? "",
      mimeType,
      modifiedTime: resource.lastModifiedDateTime,
      title: (resource.name ?? "Untitled").trim() || "Untitled",
    });
  }

  const more =
    payload.value?.some((entry) =>
      (entry.hitsContainers ?? []).some(
        (container) => container.moreResultsAvailable
      )
    ) ?? false;

  return {
    files,
    nextFrom: more ? from + limit : undefined,
  };
}

export async function sharePointDownloadFileForChatAttachment(args: {
  tenantId: string;
  accessToken: string;
  fileId: string;
}): Promise<SharePointChatAttachmentDownload> {
  await assertSharePointActionAllowed({
    action: "read",
    tenantId: args.tenantId,
  });

  const { driveId, itemId } = parseSharePointFileId(args.fileId.trim());

  const metaResponse = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=id,name,file,size`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${args.accessToken}`,
      },
    }
  );
  if (!metaResponse.ok) {
    const body = await metaResponse.text().catch(() => "");
    throw new Error(
      `SharePoint file metadata failed (${metaResponse.status}): ${body.slice(0, 300)}`
    );
  }
  const meta = (await metaResponse.json()) as {
    id?: string;
    name?: string;
    size?: number;
    file?: { mimeType?: string };
  };
  const mimeType = meta.file?.mimeType ?? "application/octet-stream";
  if (!isChatAttachableMime(mimeType)) {
    throw new Error(
      "Only images, PDFs, and Office docs/sheets can be attached from SharePoint."
    );
  }
  if (typeof meta.size === "number" && meta.size > MAX_CHAT_ATTACH_BYTES) {
    throw new Error("File size should be less than 5MB.");
  }

  const contentResponse = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${args.accessToken}` },
      redirect: "follow",
    }
  );
  if (!contentResponse.ok) {
    const body = await contentResponse.text().catch(() => "");
    throw new Error(
      `SharePoint file download failed (${contentResponse.status}): ${body.slice(0, 300)}`
    );
  }

  const bytes = Buffer.from(await contentResponse.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("SharePoint file is empty.");
  }
  if (bytes.byteLength > MAX_CHAT_ATTACH_BYTES) {
    throw new Error("File size should be less than 5MB.");
  }

  return {
    bytes,
    fileId: args.fileId.trim(),
    mimeType,
    title: (meta.name ?? "Untitled").trim() || "Untitled",
  };
}
