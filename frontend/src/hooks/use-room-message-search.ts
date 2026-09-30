"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import type { RoomMessageSearchResponse } from "@/contracts/room-message-search";
import { roomMessageSearchSwrKey } from "@/lib/chat/room-message-search-api";
import { fetcher } from "@/shared/utils";

export function useRoomMessageSearch(
  chatId: string,
  query: string,
  enabled: boolean
) {
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const next = query.trim();
    if (next.length === 0) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!enabled) {
      setDebouncedQuery("");
    }
  }, [enabled]);

  const trimmed = query.trim();
  const searchKey =
    enabled && chatId ? roomMessageSearchSwrKey(chatId, debouncedQuery) : null;

  const { data, isLoading } = useSWR<RoomMessageSearchResponse>(
    searchKey,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    hits: trimmed.length >= 2 ? (data?.hits ?? []) : [],
    isLoading: trimmed.length >= 2 && isLoading,
    trimmed,
  };
}
