"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { CustomUIDataTypes, DataUIPart } from "@/shared/types";

type DataStreamContextValue = {
  /** Parts for the active chat only — background chats stay isolated. */
  dataStream: DataUIPart<CustomUIDataTypes>[];
  activeChatId: string | null;
  setActiveChatId: (chatId: string | null) => void;
  appendDataPart: (chatId: string, part: DataUIPart<CustomUIDataTypes>) => void;
  clearActiveDataStream: () => void;
};

const DataStreamContext = createContext<DataStreamContextValue | null>(null);

export function DataStreamProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [streamsByChatId, setStreamsByChatId] = useState<
    Record<string, DataUIPart<CustomUIDataTypes>[]>
  >({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const appendDataPart = useCallback(
    (chatId: string, part: DataUIPart<CustomUIDataTypes>) => {
      setStreamsByChatId((previous) => ({
        ...previous,
        [chatId]: [...(previous[chatId] ?? []), part],
      }));
    },
    []
  );

  const clearActiveDataStream = useCallback(() => {
    setStreamsByChatId((previous) => {
      if (!(activeChatId && previous[activeChatId]?.length)) {
        return previous;
      }
      const next = { ...previous };
      delete next[activeChatId];
      return next;
    });
  }, [activeChatId]);

  const dataStream = activeChatId ? (streamsByChatId[activeChatId] ?? []) : [];

  const value = useMemo(
    () => ({
      activeChatId,
      appendDataPart,
      clearActiveDataStream,
      dataStream,
      setActiveChatId,
    }),
    [activeChatId, appendDataPart, clearActiveDataStream, dataStream]
  );

  return (
    <DataStreamContext.Provider value={value}>
      {children}
    </DataStreamContext.Provider>
  );
}

export function useDataStream() {
  const context = useContext(DataStreamContext);
  if (!context) {
    throw new Error("useDataStream must be used within a DataStreamProvider");
  }
  return context;
}
