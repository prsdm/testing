"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { openConnectorChat } from "@/lib/connectors/open-connector-chat";
import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";

export function useOpenConnectorChat() {
  const router = useRouter();
  return useCallback(
    (focus: ComposerConnectorFocus) => {
      openConnectorChat(router, focus);
    },
    [router]
  );
}
