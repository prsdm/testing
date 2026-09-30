"use client";

import { useState } from "react";
import { useActiveChat } from "@/hooks/use-active-chat";
import type { SlackUserLookup } from "@/shared/chat/connector-action-tools";
import type { MessageMetadata } from "@/shared/types";
import { ToolApprovalCard } from "./tool-cards/tool-approval-card";

type InlineToolApprovalStepProps = {
  pending: NonNullable<MessageMetadata["pendingToolApproval"]>;
  slackUserLookup?: SlackUserLookup;
};

/** Inline approval card rendered in the chronological tool stream. */
export function InlineToolApprovalStep({
  pending,
  slackUserLookup,
}: InlineToolApprovalStepProps) {
  const { respondToToolApproval } = useActiveChat();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pending.approvalId) {
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
    <ToolApprovalCard
      args={pending.args}
      busy={busy}
      error={error}
      onApprove={() => respond({ approved: true })}
      onReject={() => respond({ approved: false, reason: "Rejected by user" })}
      slackUserLookup={slackUserLookup}
      toolName={pending.toolName}
    />
  );
}
