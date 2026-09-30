/** Tool states that mean the model requested a call but no result arrived yet. */
export function isInFlightToolState(state: string): boolean {
  return state === "input-available" || state === "input-streaming";
}

export function isSuccessfulToolState(state: string): boolean {
  return state === "output-available";
}

/** Stopped or incomplete — not a successful run (show block icon, no expand). */
export function isInterruptedToolForDisplay(args: {
  state: string;
  isMessageStreaming: boolean;
  hasOutput?: boolean;
}): boolean {
  if (args.isMessageStreaming) {
    return false;
  }
  if (isInFlightToolState(args.state)) {
    return true;
  }
  return args.state === "output-available" && args.hasOutput === false;
}

/** Pending UI only while the assistant message is actively streaming. */
export function isToolPartPendingForDisplay(args: {
  state: string;
  isMessageStreaming: boolean;
  hasOutput?: boolean;
}): boolean {
  if (isInterruptedToolForDisplay(args)) {
    return false;
  }
  if (!args.isMessageStreaming) {
    return false;
  }
  if (isInFlightToolState(args.state)) {
    return true;
  }
  if (args.state === "approval-responded") {
    return true;
  }
  if (args.state === "output-available" && args.hasOutput === false) {
    return true;
  }
  return false;
}
