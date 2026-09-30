"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import type { ChannelDetails } from "@/contracts/channels";
import { channelApiUrl } from "@/lib/channels/channel-api";
import { updateChannelThreadTagCatalog } from "@/lib/channels/update-channel-thread-tag-catalog-client";
import {
  normalizeChannelThreadTagCatalog,
  parseChannelThreadTagCatalog,
  type ThreadTag,
} from "@/shared/chat/thread-tags";
import { fetcher } from "@/shared/utils";

export function useChannelThreadTagCatalog(channelId: string | null) {
  const tenantSlug = useTenantSlug();
  const key =
    tenantSlug && channelId ? channelApiUrl(tenantSlug, channelId) : null;

  const { data, mutate, isLoading } = useSWR<{ channel: ChannelDetails }>(
    key,
    fetcher,
    { revalidateOnFocus: true }
  );

  const catalog = useMemo(
    () => parseChannelThreadTagCatalog(data?.channel?.threadTagCatalog),
    [data?.channel?.threadTagCatalog]
  );

  const saveCatalog = useCallback(
    async (nextCatalog: ThreadTag[]) => {
      if (!tenantSlug || !channelId) {
        throw new Error("Channel is not available");
      }
      const normalized = normalizeChannelThreadTagCatalog(nextCatalog);

      await mutate(
        async (current) => {
          const payload = await updateChannelThreadTagCatalog({
            channelId,
            tenantSlug,
            threadTagCatalog: normalized,
          });
          return {
            channel: {
              ...(current?.channel ?? {
                createdAt: "",
                createdByName: "",
                id: channelId,
                knowledgeBaseId: null,
                title: "",
              }),
              ...payload.channel,
            },
          };
        },
        {
          optimisticData: (current) => ({
            channel: {
              ...(current?.channel ?? {
                createdAt: "",
                createdByName: "",
                id: channelId,
                knowledgeBaseId: null,
                title: "",
              }),
              threadTagCatalog: normalized,
            },
          }),
          populateCache: true,
          revalidate: true,
          rollbackOnError: true,
        }
      );
    },
    [channelId, mutate, tenantSlug]
  );

  return {
    catalog,
    isLoading,
    mutate,
    saveCatalog,
  };
}
