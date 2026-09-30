const WRITE_VERBS = [
  "create",
  "update",
  "delete",
  "send",
  "post",
  "put",
  "patch",
  "remove",
  "upload",
  "invite",
  "share",
  "move",
  "rename",
  "transition",
  "add",
  "reply",
] as const;

const WRITE_VERB_ALT = WRITE_VERBS.join("|");
const WRITE_SNAKE_PATTERN = new RegExp(`(^|_)(${WRITE_VERB_ALT})(_|$)`, "i");
const WRITE_CAMEL_PATTERN = new RegExp(
  `(?:^|[a-z0-9])(${WRITE_VERBS.map(
    (verb) => verb.charAt(0).toUpperCase() + verb.slice(1)
  ).join("|")})(?:[A-Z0-9_]|$)`
);
const WRITE_CAMEL_START_PATTERN = new RegExp(
  `^(${WRITE_VERB_ALT})[A-Z0-9_]`,
  "i"
);

function bareToolName(toolName: string): string {
  return toolName.includes("__")
    ? (toolName.split("__").at(-1) ?? toolName)
    : toolName;
}

export function isWriteToolName(toolName: string): boolean {
  const bare = bareToolName(toolName);
  return (
    WRITE_SNAKE_PATTERN.test(bare) ||
    WRITE_CAMEL_PATTERN.test(bare) ||
    WRITE_CAMEL_START_PATTERN.test(bare)
  );
}

export function toolRequiresApproval(args: { toolName: string }): boolean {
  return isWriteToolName(args.toolName);
}

function toolNameFromPartType(type: string): string | undefined {
  if (!type.startsWith("tool-")) {
    return undefined;
  }
  const toolName = type.slice("tool-".length);
  return toolName.length > 0 ? toolName : undefined;
}

export type UserRejectedApprovalAttempt = {
  toolName: string;
  inputKey: string;
};

export const USER_REJECTED_APPROVAL_RETRY_REASON =
  "This exact action was already rejected. Mark the step skipped in todoWrite and continue with the next pending step.";

function stableToolInputKey(input: unknown): string {
  if (input === null || input === undefined) {
    return "";
  }
  if (typeof input !== "object") {
    return JSON.stringify(input);
  }
  if (Array.isArray(input)) {
    return `[${input.map((entry) => stableToolInputKey(entry)).join(",")}]`;
  }
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableToolInputKey(record[key])}`)
    .join(",")}}`;
}

function fingerprintString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function hashToolApprovalInput(input: unknown): string {
  return fingerprintString(stableToolInputKey(input));
}

export function isUserRejectedApprovalPart(part: {
  type: string;
  state?: string;
  output?: unknown;
}): boolean {
  if (!part.type.startsWith("tool-") || part.state !== "output-denied") {
    return false;
  }
  if (!part.output || typeof part.output !== "object") {
    return false;
  }
  return (part.output as { type?: string }).type === "execution-denied";
}

/** Tool names the user explicitly rejected via approval in this assistant turn. */
export function collectUserRejectedApprovalToolNames(
  parts: Array<{ type: string; state?: string; output?: unknown }>
): string[] {
  const names = new Set<string>();
  for (const part of parts) {
    if (!isUserRejectedApprovalPart(part)) {
      continue;
    }
    const toolName = toolNameFromPartType(part.type);
    if (toolName) {
      names.add(toolName);
    }
  }
  return [...names];
}

/** Exact tool + input pairs the user rejected via approval in this assistant turn. */
export function collectUserRejectedApprovalAttempts(
  parts: Array<{
    type: string;
    state?: string;
    output?: unknown;
    input?: unknown;
  }>
): UserRejectedApprovalAttempt[] {
  const attempts: UserRejectedApprovalAttempt[] = [];
  for (const part of parts) {
    if (!isUserRejectedApprovalPart(part)) {
      continue;
    }
    const toolName = toolNameFromPartType(part.type);
    if (!toolName) {
      continue;
    }
    attempts.push({
      inputKey: hashToolApprovalInput("input" in part ? part.input : undefined),
      toolName,
    });
  }
  return attempts;
}

export function isUserRejectedApprovalRetry(args: {
  toolName: string;
  input: unknown;
  attempts: readonly UserRejectedApprovalAttempt[];
}): boolean {
  const inputKey = hashToolApprovalInput(args.input);
  return args.attempts.some(
    (attempt) =>
      attempt.toolName === args.toolName && attempt.inputKey === inputKey
  );
}

/** @deprecated Use {@link collectUserRejectedApprovalToolNames}. */
export function assistantTurnHasUserRejectedWrite(
  parts: Array<{ type: string; state?: string; output?: unknown }>
): boolean {
  return collectUserRejectedApprovalToolNames(parts).length > 0;
}

export function resolveApprovalToolGateForTurn(args: {
  writeToolsBlocked?: boolean;
  blockedApprovalToolNames?: readonly string[];
  assistantParts: Array<{
    type: string;
    state?: string;
    output?: unknown;
    input?: unknown;
  }>;
}): {
  writeToolsBlocked: boolean;
  blockedApprovalToolNames: string[];
  userRejectedApprovalAttempts: UserRejectedApprovalAttempt[];
} {
  // Keep the tool available for different inputs (e.g. three driveCreateFolder
  // calls with different names). Exact rejected tool+input retries are blocked
  // separately via userRejectedApprovalAttempts.
  return {
    blockedApprovalToolNames: [...new Set(args.blockedApprovalToolNames ?? [])],
    userRejectedApprovalAttempts: collectUserRejectedApprovalAttempts(
      args.assistantParts
    ),
    writeToolsBlocked: args.writeToolsBlocked === true,
  };
}

/** @deprecated Use {@link resolveApprovalToolGateForTurn}. */
export function resolveWriteToolsBlockedForTurn(args: {
  writeToolsBlocked?: boolean;
  assistantParts: Array<{ type: string; state?: string; output?: unknown }>;
}): boolean {
  return (
    resolveApprovalToolGateForTurn(args).writeToolsBlocked ||
    resolveApprovalToolGateForTurn(args).blockedApprovalToolNames.length > 0
  );
}

export function toolAllowedForTurn(args: {
  toolName: string;
  writeToolsBlocked?: boolean;
  blockedApprovalToolNames?: readonly string[];
}): boolean {
  if (!toolRequiresApproval({ toolName: args.toolName })) {
    return true;
  }
  if (args.writeToolsBlocked) {
    return false;
  }
  return !args.blockedApprovalToolNames?.includes(args.toolName);
}
