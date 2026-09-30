import { getLibraryFileById } from "@/core/lib/db/library-queries";
import { readLibraryFileBytes } from "@/core/lib/library/library-storage";

export async function slackIntegrationUploadLibraryFile(args: {
  botToken: string;
  channelId: string;
  threadTs?: string | null;
  tenantId: string;
  tenantUserId: string;
  libraryFileId: string;
}) {
  const file = await getLibraryFileById({
    fileId: args.libraryFileId,
    tenantId: args.tenantId,
    userId: args.tenantUserId,
  });
  if (!file) {
    return null;
  }

  const bytes = await readLibraryFileBytes(file.pathname);
  if (!bytes) {
    return null;
  }
  const form = new FormData();
  form.append("channels", args.channelId);
  const replyThreadTs = args.threadTs?.trim();
  if (replyThreadTs) {
    form.append("thread_ts", replyThreadTs);
  }
  form.append("filename", file.name);
  form.append("file", new Blob([bytes], { type: file.contentType }), file.name);
  if (file.name) {
    form.append("title", file.name);
  }

  const response = await fetch("https://slack.com/api/files.upload", {
    body: form,
    headers: {
      Authorization: `Bearer ${args.botToken}`,
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Slack file upload failed (${response.status}).`);
  }
  const payload = (await response.json()) as { ok?: boolean; error?: string };
  if (!payload.ok) {
    throw new Error(payload.error ?? "Slack file upload failed.");
  }
  return file;
}

export async function slackIntegrationUploadDeliverables(args: {
  botToken: string;
  channelId: string;
  threadTs?: string | null;
  tenantId: string;
  tenantUserId: string;
  libraryFileIds: string[];
}) {
  const uploaded: string[] = [];
  for (const libraryFileId of args.libraryFileIds) {
    try {
      const file = await slackIntegrationUploadLibraryFile({
        ...args,
        libraryFileId,
      });
      if (file) {
        uploaded.push(file.name);
      }
    } catch (error) {
      console.error("[slack-integration] deliverable upload failed", {
        error,
        libraryFileId,
      });
    }
  }
  return uploaded;
}
