import { createHash } from "node:crypto";
import { replayCompletedToolExecution } from "@/core/lib/ai/tool-execution-replay";
import {
  beginToolExecution,
  completeToolExecution,
  withTenantId,
} from "@/core/lib/db/queries";

function hashInput(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

/**
 * Prevents Workflow retries from applying the same mutating tool call twice.
 * Completed calls return their stored result. An unresolved in-flight entry is
 * failed closed because repeating an external side effect is unsafe.
 */
export async function executeIdempotentTool<T>(args: {
  tenantId: string;
  workflowRunId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
  execute: () => Promise<T>;
}): Promise<T> {
  const inputHash = hashInput(args.input);
  const started = await withTenantId(args.tenantId, () =>
    beginToolExecution({
      inputHash,
      toolCallId: args.toolCallId,
      toolName: args.toolName,
      workflowRunId: args.workflowRunId,
    })
  );

  if (!started.acquired) {
    return replayCompletedToolExecution<T>(started.entry, {
      inputHash,
      toolName: args.toolName,
    });
  }

  try {
    const result = await args.execute();
    await withTenantId(args.tenantId, () =>
      completeToolExecution({
        result,
        toolCallId: args.toolCallId,
        workflowRunId: args.workflowRunId,
      })
    );
    return result;
  } catch (error) {
    await withTenantId(args.tenantId, () =>
      completeToolExecution({
        error: error instanceof Error ? error.message : String(error),
        toolCallId: args.toolCallId,
        workflowRunId: args.workflowRunId,
      })
    );
    throw error;
  }
}
