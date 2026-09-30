import { channelApiUrl, readChannelApiError } from "@/lib/channels/channel-api";
import type { ThreadTag } from "@/shared/chat/thread-tags";

export async function updateChannelThreadTagCatalog({
  tenantSlug,
  channelId,
  threadTagCatalog,
}: {
  tenantSlug: string;
  channelId: string;
  threadTagCatalog: ThreadTag[];
}) {
  const response = await fetch(channelApiUrl(tenantSlug, channelId), {
    body: JSON.stringify({ threadTagCatalog }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(
      await readChannelApiError(response, "Could not update channel tags")
    );
  }

  return (await response.json()) as {
    channel: { id: string; threadTagCatalog: ThreadTag[] };
  };
}
