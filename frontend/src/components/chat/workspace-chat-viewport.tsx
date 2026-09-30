"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { ChatDocumentTitle } from "@/components/chat/chat-document-title";
import { ChatShell } from "@/components/chat/shell";
import { isChatAreaPath } from "@/shared/chat/routes";

/**
 * Keeps ChatShell mounted across workspace navigations (Connectors, Knowledge,
 * etc.) so an in-flight generation stays visible as live "processing" when you
 * return — instead of unmounting and remounting into a blank/completed dump.
 *
 * Uses `hidden` (not conditional render) so React does not tear down the tree.
 */
export function WorkspaceChatViewport({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showChat = isChatAreaPath(pathname);

  return (
    <>
      <ChatDocumentTitle />
      <div
        className={showChat ? "min-h-0 flex-1" : "hidden"}
        inert={showChat ? undefined : true}
      >
        <Suspense fallback={<div className="flex h-dvh" />}>
          <ChatShell />
        </Suspense>
      </div>
      {showChat ? null : children}
    </>
  );
}
