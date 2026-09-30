import type { ToolApprovalStatus } from "ai";
import {
  isUserRejectedApprovalRetry,
  isWriteToolName,
  type UserRejectedApprovalAttempt,
} from "@/shared/ai/tool-approvals";

export const SERIAL_WRITE_LIMIT_REASON =
  "Only one mutating tool may run per step. Finish the first write (including approval if required), then call the next mutating tool in a follow-up step.";

export type SerialWriteStepTracker = {
  resetForStep: () => void;
  tryClaimMutatingTool: (toolName: string) => boolean;
};

export function createSerialWriteStepTracker(): SerialWriteStepTracker {
  let writeClaimed = false;

  return {
    resetForStep() {
      writeClaimed = false;
    },
    tryClaimMutatingTool(toolName: string) {
      if (!isWriteToolName(toolName)) {
        return true;
      }
      if (writeClaimed) {
        return false;
      }
      writeClaimed = true;
      return true;
    },
  };
}

export function resolveMutatingToolNeedsApproval(args: {
  toolName: string;
  input: unknown;
  attempts: readonly UserRejectedApprovalAttempt[];
}): boolean {
  if (!isWriteToolName(args.toolName)) {
    return false;
  }
  if (
    isUserRejectedApprovalRetry({
      attempts: args.attempts,
      input: args.input,
      toolName: args.toolName,
    })
  ) {
    return false;
  }
  return true;
}

export function resolveSerialWriteToolApproval(args: {
  toolName: string;
  input: unknown;
  tracker: SerialWriteStepTracker;
  userRejectedApprovalAttempts: readonly UserRejectedApprovalAttempt[];
}): ToolApprovalStatus {
  if (!isWriteToolName(args.toolName)) {
    return "not-applicable";
  }

  if (!args.tracker.tryClaimMutatingTool(args.toolName)) {
    return { reason: SERIAL_WRITE_LIMIT_REASON, type: "denied" };
  }

  if (
    isUserRejectedApprovalRetry({
      attempts: args.userRejectedApprovalAttempts,
      input: args.input,
      toolName: args.toolName,
    })
  ) {
    return "not-applicable";
  }

  return "user-approval";
}

export function createSerialWriteToolApproval(args: {
  tracker: SerialWriteStepTracker;
  userRejectedApprovalAttempts: readonly UserRejectedApprovalAttempt[];
}) {
  return async ({
    toolCall,
  }: {
    toolCall: { toolName: string; input: unknown };
  }) =>
    resolveSerialWriteToolApproval({
      input: toolCall.input,
      toolName: toolCall.toolName,
      tracker: args.tracker,
      userRejectedApprovalAttempts: args.userRejectedApprovalAttempts,
    });
}
