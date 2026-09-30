"use client";

import { LibraryPanel } from "@/components/library/library-panel";
import { workspaceContentWidthClassName } from "@/components/workspace/workspace-page-layout";
import { cn } from "@/shared/utils";

export function ChannelLibraryPanel({
  chatId,
  tenantSlug,
}: {
  tenantSlug: string;
  chatId: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        className={cn(
          workspaceContentWidthClassName,
          "flex flex-col py-4 pb-8"
        )}
      >
        <LibraryPanel chatId={chatId} scope="room" tenantSlug={tenantSlug} />
      </div>
    </div>
  );
}
