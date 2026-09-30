import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeTodoItems,
  todoProgressLabel,
  todosAllSettled,
} from "./todo-types";

test("normalizes skipped todos and reports settled progress", () => {
  const todos = normalizeTodoItems([
    {
      activeForm: "Creating Finance folder",
      content: "Create Finance folder",
      status: "skipped",
    },
    {
      activeForm: "Creating Legal folder",
      content: "Create Legal folder",
      status: "completed",
    },
  ]);

  assert.equal(todos[0]?.status, "skipped");
  assert.equal(todoProgressLabel(todos), "1/2 completed · 1 skipped");
  assert.equal(todosAllSettled(todos), true);
});

test("pending todos are not settled", () => {
  assert.equal(
    todosAllSettled([
      {
        activeForm: "Creating HR folder",
        content: "Create HR folder",
        status: "pending",
      },
    ]),
    false
  );
});
