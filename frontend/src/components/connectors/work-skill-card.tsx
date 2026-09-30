"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { AdminListItemLogoFrame } from "@/components/admin/admin-list-item-logo-frame";
import { ConnectorActionsMenu } from "@/components/connectors/connector-action-buttons";
import { ConnectorCard } from "@/components/connectors/connector-card-layout";
import { useOpenConnectorChat } from "@/lib/connectors/use-open-connector-chat";
import {
  type WorkSkillId,
  workSkillLogoUrl,
} from "@/shared/sandbox/work-skill-catalog";
import { cn } from "@/shared/utils";

export function WorkSkillIcon({
  skillId,
  className,
  compact = false,
}: {
  skillId: WorkSkillId;
  className?: string;
  compact?: boolean;
}) {
  const pixelSize = compact ? 16 : 24;

  return (
    <Image
      alt=""
      aria-hidden
      className={cn(
        "shrink-0 object-contain",
        compact ? "size-4" : "size-6",
        className
      )}
      height={pixelSize}
      src={workSkillLogoUrl(skillId)}
      unoptimized
      width={pixelSize}
    />
  );
}

export function WorkSkillCard({
  name,
  description,
  skillId,
  banner,
}: {
  name: string;
  description: string;
  skillId: WorkSkillId;
  banner?: ReactNode;
}) {
  const openConnectorChat = useOpenConnectorChat();

  return (
    <ConnectorCard
      action={
        <ConnectorActionsMenu
          itemLabel={name}
          onChat={() => {
            openConnectorChat({
              kind: "work-skill",
              name,
              skillId,
            });
          }}
        />
      }
      banner={banner}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <AdminListItemLogoFrame>
          <WorkSkillIcon
            className="size-full max-h-6 max-w-6 object-contain"
            skillId={skillId}
          />
        </AdminListItemLogoFrame>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-medium text-sm">{name}</h2>
          <p className="truncate text-[13px] text-muted-foreground leading-snug">
            {description}
          </p>
        </div>
      </div>
    </ConnectorCard>
  );
}
