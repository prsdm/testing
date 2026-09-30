"use client";

import type { ReactNode } from "react";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";

/** Client providers that must outlive chat-route layouts (stream keep-alive). */
export function WorkspaceChatProviders({ children }: { children: ReactNode }) {
  return <DataStreamProvider>{children}</DataStreamProvider>;
}
