export function replayCompletedToolExecution<T>(
  entry:
    | {
        toolName: string;
        inputHash: string | null;
        status: string;
        result: unknown;
      }
    | null
    | undefined,
  expected: {
    toolName: string;
    inputHash: string;
  }
): T {
  if (
    entry?.toolName !== expected.toolName ||
    entry.inputHash !== expected.inputHash
  ) {
    throw new Error(
      `Mutating tool ${expected.toolName} was retried with different input`
    );
  }
  if (entry.status === "completed") {
    return entry.result as T;
  }
  throw new Error(
    `Mutating tool ${expected.toolName} has an unresolved prior execution`
  );
}
