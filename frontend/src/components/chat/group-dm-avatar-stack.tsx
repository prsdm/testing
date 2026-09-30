"use client";

import { UserAvatar } from "@/components/chat/user-avatar";
import type { DmMemberSummary } from "@/contracts/dms";
import { cn } from "@/shared/utils";

export function GroupDmAvatarStack({
  members,
  className,
  maxVisible = 3,
}: {
  members: DmMemberSummary[];
  className?: string;
  maxVisible?: number;
}) {
  const visible = members.slice(0, maxVisible);
  const overflow = members.length - visible.length;

  if (visible.length === 0) {
    return (
      <div
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground",
          className
        )}
      >
        G
      </div>
    );
  }

  return (
    <div className={cn("relative h-4 w-4 shrink-0", className)}>
      {visible.map((member, index) => (
        <UserAvatar
          className={cn(
            "absolute top-0 size-3 ring-0",
            index === 0 && "left-0 z-[3]",
            index === 1 && "left-1 z-[2]",
            index === 2 && "left-2 z-[1]"
          )}
          email={member.email}
          image={member.image}
          key={member.userId}
          name={member.displayName}
          size="sm"
          userId={member.userId}
        />
      ))}
      {overflow > 0 ? (
        <span className="sr-only">{overflow} more members</span>
      ) : null}
    </div>
  );
}
