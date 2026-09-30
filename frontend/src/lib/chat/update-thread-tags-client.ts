import {
  normalizeThreadTags,
  normalizeThreadTitle,
  type ThreadTag,
} from "@/shared/chat/thread-tags";

export async function updateThreadRootMetadata(args: {
  chatId: string;
  messageId: string;
  threadTitle?: string | null;
  threadTags?: ThreadTag[];
}) {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const body: Record<string, unknown> = {
    chatId: args.chatId,
    messageId: args.messageId,
  };
  if (args.threadTags !== undefined) {
    body.threadTags = normalizeThreadTags(args.threadTags);
  }
  if (args.threadTitle !== undefined) {
    body.threadTitle =
      args.threadTitle === null ? null : normalizeThreadTitle(args.threadTitle);
  }

  const response = await fetch(`${basePath}/api/thread-tags`, {
    body: JSON.stringify(body),
    credentials: "include",
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      payload?.error ?? `Failed to update thread metadata (${response.status})`
    );
  }

  return (await response.json()) as {
    ok: true;
    threadTitle?: string | null;
    threadTags?: ThreadTag[];
  };
}

/** @deprecated Use updateThreadRootMetadata */
export async function updateThreadTags(args: {
  chatId: string;
  messageId: string;
  threadTags: ThreadTag[];
}) {
  const result = await updateThreadRootMetadata(args);
  return { threadTags: result.threadTags ?? args.threadTags } as const;
}
