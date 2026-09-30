"use client";

import { ChannelMembersSection } from "@/components/channels/channel-members-section";
import { workspaceContentWidthClassName } from "@/components/workspace/workspace-page-layout";
import { cn } from "@/shared/utils";

export function ChannelSettingsPanel({
  tenantSlug,
  channelId,
  channelTitle,
  onMembersChanged,
}: {
  tenantSlug: string;
  channelId: string;
  channelTitle: string;
  onMembersChanged?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        className={cn(
          workspaceContentWidthClassName,
          "flex flex-col gap-6 py-4 pb-8"
        )}
      >
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-base">Channel settings</h2>
          <p className="text-muted-foreground text-sm">
            Manage who can access #{channelTitle}.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-medium text-sm">Members</p>
          <ChannelMembersSection
            channelId={channelId}
            onMembersChanged={onMembersChanged}
            tenantSlug={tenantSlug}
          />
        </div>
      </div>
    </div>
  );
}
