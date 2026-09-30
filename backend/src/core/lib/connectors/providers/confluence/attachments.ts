import { confluenceFetch } from "@/core/lib/connectors/providers/confluence/api";
import { assertConfluenceActionAllowed } from "@/core/lib/connectors/providers/confluence/auth";
import {
  isChatAttachableMime,
  MAX_CHAT_ATTACH_BYTES,
} from "@/shared/artifacts/drive-import";

export type ConfluenceAttachmentSummary = {
  fileId: string;
  title: string;
  mimeType: string;
  link: string;
  modifiedTime?: string;
};

export type ConfluenceChatAttachmentDownload = {
  fileId: string;
  title: string;
  mimeType: string;
  bytes: Buffer;
};

type ConfluenceSearchResult = {
  content?: {
    id?: string;
    title?: string;
    type?: string;
    extensions?: {
      mediaType?: string;
      fileSize?: number;
    };
    _links?: {
      webui?: string;
      download?: string;
      self?: string;
    };
    version?: { when?: string };
  };
  title?: string;
};

const CONFLUENCE_ATTACH_MEDIA_CQL = `(mediaType="image/jpeg" OR mediaType="image/png" OR mediaType="application/pdf" OR mediaType="text/plain" OR mediaType="text/markdown" OR mediaType="application/vnd.openxmlformats-officedocument.wordprocessingml.document" OR mediaType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")`;

/**
 * Browse attachable Confluence attachments via content search (CQL).
 */
export async function confluenceBrowseAttachableAttachments(args: {
  tenantId: string;
  cloudId: string;
  accessToken: string;
  query?: string;
  start?: number;
  limit?: number;
}): Promise<{ files: ConfluenceAttachmentSummary[]; nextStart?: number }> {
  await assertConfluenceActionAllowed({
    action: "read",
    tenantId: args.tenantId,
  });

  const limit = Math.min(args.limit ?? 20, 50);
  const start = Math.max(args.start ?? 0, 0);
  const trimmed = args.query?.trim() ?? "";
  const titleClause = trimmed
    ? ` AND title ~ "${trimmed.replaceAll('"', '\\"')}"`
    : "";
  const cql = `type=attachment AND ${CONFLUENCE_ATTACH_MEDIA_CQL}${titleClause}`;

  const params = new URLSearchParams({
    cql,
    expand: "content.extensions,content.version,content._links",
    limit: String(limit),
    start: String(start),
  });

  const response = await confluenceFetch({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
    path: `/wiki/rest/api/content/search?${params.toString()}`,
  });
  const payload = (await response.json()) as {
    results?: ConfluenceSearchResult[];
    size?: number;
    totalSize?: number;
  };

  const files: ConfluenceAttachmentSummary[] = [];
  for (const result of payload.results ?? []) {
    const content = result.content;
    const fileId = content?.id;
    const mimeType = content?.extensions?.mediaType ?? "";
    if (!(fileId && isChatAttachableMime(mimeType))) {
      continue;
    }
    files.push({
      fileId,
      link: content._links?.webui ?? content._links?.self ?? "",
      mimeType,
      modifiedTime: content.version?.when,
      title: (content.title ?? result.title ?? "Untitled").trim() || "Untitled",
    });
  }

  const total = payload.totalSize ?? 0;
  const nextStart = start + limit < total ? start + limit : undefined;
  return { files, nextStart };
}

export async function confluenceDownloadAttachmentForChat(args: {
  tenantId: string;
  cloudId: string;
  accessToken: string;
  fileId: string;
}): Promise<ConfluenceChatAttachmentDownload> {
  await assertConfluenceActionAllowed({
    action: "read",
    tenantId: args.tenantId,
  });

  const fileId = args.fileId.trim();
  if (!fileId) {
    throw new Error("Invalid Confluence attachment id.");
  }

  const metaResponse = await confluenceFetch({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
    path: `/wiki/rest/api/content/${encodeURIComponent(fileId)}?expand=version,extensions`,
  });
  const meta = (await metaResponse.json()) as {
    id?: string;
    title?: string;
    type?: string;
    extensions?: { mediaType?: string; fileSize?: number };
    _links?: { download?: string };
  };

  if (meta.type !== "attachment") {
    throw new Error("Selected Confluence item is not an attachment.");
  }
  const mimeType = meta.extensions?.mediaType ?? "application/octet-stream";
  if (!isChatAttachableMime(mimeType)) {
    throw new Error(
      "Only images, PDFs, and Office docs/sheets can be attached from Confluence."
    );
  }
  if (
    typeof meta.extensions?.fileSize === "number" &&
    meta.extensions.fileSize > MAX_CHAT_ATTACH_BYTES
  ) {
    throw new Error("File size should be less than 5MB.");
  }

  const downloadPath = meta._links?.download;
  if (!downloadPath) {
    throw new Error("Confluence attachment has no download link.");
  }
  const path = downloadPath.startsWith("/wiki/")
    ? downloadPath
    : downloadPath.startsWith("/")
      ? `/wiki${downloadPath}`
      : `/wiki/${downloadPath}`;

  const contentResponse = await fetch(
    `https://api.atlassian.com/ex/confluence/${encodeURIComponent(args.cloudId)}${path}`,
    {
      cache: "no-store",
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${args.accessToken}`,
      },
    }
  );
  if (!contentResponse.ok) {
    const body = await contentResponse.text().catch(() => "");
    throw new Error(
      `Confluence attachment download failed (${contentResponse.status}): ${body.slice(0, 300)}`
    );
  }
  const bytes = Buffer.from(await contentResponse.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("Confluence attachment is empty.");
  }
  if (bytes.byteLength > MAX_CHAT_ATTACH_BYTES) {
    throw new Error("File size should be less than 5MB.");
  }

  return {
    bytes,
    fileId,
    mimeType,
    title: (meta.title ?? "Untitled").trim() || "Untitled",
  };
}
