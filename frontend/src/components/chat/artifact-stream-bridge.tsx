"use client";

import { useEffect } from "react";
import { setArtifactStreamListener } from "@/lib/chat/artifact-stream-bridge";
import type { CustomUIDataTypes, DataUIPart } from "@/shared/types";
import { useDataStream } from "./data-stream-provider";

/** Routes durable artifact parts into the active chat data stream. */
export function ArtifactStreamBridge({ chatId }: { chatId: string }) {
  const { appendDataPart, setActiveChatId } = useDataStream();

  useEffect(() => {
    setActiveChatId(chatId);
    return () => setActiveChatId(null);
  }, [chatId, setActiveChatId]);

  useEffect(() => {
    setArtifactStreamListener(
      (id: string, part: DataUIPart<CustomUIDataTypes>) => {
        if (id === chatId) {
          appendDataPart(id, part);
        }
      }
    );
    return () => setArtifactStreamListener(null);
  }, [chatId, appendDataPart]);

  return null;
}
