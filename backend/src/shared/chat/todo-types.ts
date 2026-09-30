export type TodoStatus = "pending" | "in_progress" | "completed" | "skipped";

export type TodoItem = {
  /** Task description shown when pending or completed. */
  content: string;
  status: TodoStatus;
  /** Present-tense label while in progress (e.g. "Inspecting attachments"). */
  activeForm: string;
};

export type TodoWriteInput = {
  todos: TodoItem[];
};

export type TodoWriteOutput = {
  todos: TodoItem[];
};

export function normalizeTodoItems(raw: unknown): TodoItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const items: TodoItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const content =
      typeof record.content === "string" ? record.content.trim() : "";
    if (!content) {
      continue;
    }
    const status =
      record.status === "pending" ||
      record.status === "in_progress" ||
      record.status === "completed" ||
      record.status === "skipped"
        ? record.status
        : "pending";
    const activeForm =
      typeof record.activeForm === "string" && record.activeForm.trim()
        ? record.activeForm.trim()
        : content;
    items.push({ activeForm, content, status });
  }
  return items;
}

export function extractTodosFromToolPayload(payload: {
  input?: unknown;
  output?: unknown;
}): TodoItem[] {
  if (payload.output && typeof payload.output === "object") {
    const output = payload.output as Record<string, unknown>;
    const fromOutput = normalizeTodoItems(output.todos);
    if (fromOutput.length > 0) {
      return fromOutput;
    }
  }
  if (payload.input && typeof payload.input === "object") {
    const input = payload.input as Record<string, unknown>;
    return normalizeTodoItems(input.todos);
  }
  return [];
}

export function todoProgressLabel(todos: TodoItem[]) {
  const total = todos.length;
  const completed = todos.filter((todo) => todo.status === "completed").length;
  const skipped = todos.filter((todo) => todo.status === "skipped").length;
  const completedLabel = `${completed}/${total} completed`;
  return skipped > 0
    ? `${completedLabel} · ${skipped} skipped`
    : completedLabel;
}

export function todosAllCompleted(todos: TodoItem[]) {
  return todos.length > 0 && todos.every((todo) => todo.status === "completed");
}

export function todosAllSettled(todos: TodoItem[]) {
  return (
    todos.length > 0 &&
    todos.every(
      (todo) => todo.status === "completed" || todo.status === "skipped"
    )
  );
}
