"use client";

import { useState } from "react";
import { useActiveChat } from "@/hooks/use-active-chat";
import { buildSlackUserLookupFromParts } from "@/shared/chat/connector-action-tools";
import type { ChatMessage } from "@/shared/types";
import { cn } from "@/shared/utils";
import { ToolApprovalCard } from "./tool-cards/tool-approval-card";

export function WorkflowRunActions({
  message,
  className,
}: {
  message: ChatMessage;
  className?: string;
}) {
  const { respondToToolApproval } = useActiveChat();
  const pending = message.metadata?.pendingToolApproval;
  const slackUserLookup = buildSlackUserLookupFromParts(message.parts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pending?.approvalId) {
    return null;
  }

  const respond = async (args: { approved: boolean; reason?: string }) => {
    setBusy(true);
    setError(null);
    try {
      await respondToToolApproval({
        approvalId: pending.approvalId as string,
        approved: args.approved,
        reason: args.reason,
      });
    } catch (responseError) {
      setError(
        responseError instanceof Error
          ? responseError.message
          : "Tool approval failed"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("mt-1 w-full min-w-0", className)}>
      <ToolApprovalCard
        args={pending.args}
        busy={busy}
        error={error}
        onApprove={() => respond({ approved: true })}
        onReject={() =>
          respond({ approved: false, reason: "Rejected by user" })
        }
        slackUserLookup={slackUserLookup}
        toolName={pending.toolName}
      />
    </div>
  );
}
