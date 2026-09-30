import { tool } from "ai";
import { z } from "zod";
import {
  normalizeTodoItems,
  type TodoWriteOutput,
} from "@/shared/chat/todo-types";

const todoItemSchema = z.object({
  activeForm: z
    .string()
    .min(1)
    .describe(
      "Present-tense label while working (e.g. 'Inspecting attached files')"
    ),
  content: z
    .string()
    .min(1)
    .describe("Task description (imperative, e.g. 'Inspect attached files')"),
  status: z
    .enum(["pending", "in_progress", "completed", "skipped"])
    .describe("Current status of this task"),
});

export const todoWriteInputSchema = z.object({
  todos: z
    .array(todoItemSchema)
    .min(1)
    .max(20)
    .describe("Full task list — include every task on each update"),
});

export type TodoWriteToolInput = z.infer<typeof todoWriteInputSchema>;

/** Cursor/Onyx-style task planning — no side effects; drives the Tasks UI. */
export function todoWrite() {
  return tool({
    description:
      "Create or update the visible task plan for multi-step work. Call at the start of non-trivial requests with all planned steps (status pending). Re-call with the full list as you start (in_progress) and finish (completed) each step. At most one step may be in_progress at a time. Mark rejected, failed, or intentionally bypassed steps as skipped, then continue with the next pending step unless the user cancels the whole task. When the user rejects an approval, mark only that step skipped and continue — do not retry the same action. After a failed execution (not a user rejection), retry the same tool and intent without switching APIs. Never mark a succeeded step as skipped. Always send the complete todos array on every call.",
    execute: ({ todos }) => {
      const normalized = normalizeTodoItems(todos);
      return Promise.resolve({ todos: normalized } satisfies TodoWriteOutput);
    },
    inputSchema: todoWriteInputSchema,
  });
}
