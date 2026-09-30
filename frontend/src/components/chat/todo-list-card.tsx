"use client";

import { BanIcon, CheckCircle2Icon, ChevronDownIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { TodoItem, TodoStatus } from "@/shared/chat/todo-types";
import {
  todoProgressLabel,
  todosAllCompleted,
  todosAllSettled,
} from "@/shared/chat/todo-types";
import { cn } from "@/shared/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

type TodoListCardProps = {
  todos: TodoItem[];
  defaultOpen?: boolean;
};

function StatusIcon({ status }: { status: TodoStatus }) {
  if (status === "completed") {
    return (
      <CheckCircle2Icon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-500"
      />
    );
  }

  if (status === "in_progress") {
    return (
      <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/50">
        <div className="size-2 rounded-full bg-muted-foreground/60" />
      </div>
    );
  }

  if (status === "skipped") {
    return (
      <BanIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
    );
  }

  return (
    <div className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-muted-foreground/40" />
  );
}

function TodoItemRow({ todo }: { todo: TodoItem }) {
  const label = todo.status === "in_progress" ? todo.activeForm : todo.content;

  return (
    <div className="flex items-start gap-2 py-1">
      <StatusIcon status={todo.status} />
      <span
        className={cn(
          "text-sm leading-snug",
          todo.status === "completed" || todo.status === "skipped"
            ? "text-muted-foreground line-through"
            : "text-foreground/90"
        )}
      >
        {label}
      </span>
    </div>
  );
}

/** Craft-style collapsible Tasks card (3/3 completed). */
export function TodoListCard({ todos, defaultOpen }: TodoListCardProps) {
  const allCompleted = todosAllCompleted(todos);
  const allSettled = todosAllSettled(todos);
  const [isOpen, setIsOpen] = useState(defaultOpen ?? !allSettled);

  useEffect(() => {
    setIsOpen(defaultOpen ?? !allSettled);
  }, [allSettled, defaultOpen]);

  if (todos.length === 0) {
    return null;
  }

  return (
    <Collapsible onOpenChange={setIsOpen} open={isOpen}>
      <div
        className={cn(
          "w-full overflow-hidden rounded-lg border",
          allCompleted
            ? "border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/30"
            : "border-border/70 bg-muted/20"
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/30"
            type="button"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {allCompleted ? (
                <CheckCircle2Icon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500"
                />
              ) : allSettled ? (
                <BanIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
              ) : (
                <div className="flex size-4 shrink-0 items-center justify-center rounded-sm border-2 border-muted-foreground/50">
                  <div className="size-2 rounded-sm bg-muted-foreground/50" />
                </div>
              )}
              <span className="font-medium text-sm">Tasks</span>
              <span className="text-muted-foreground text-sm">
                {todoProgressLabel(todos)}
              </span>
            </div>
            <ChevronDownIcon
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
                !isOpen && "-rotate-90"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-0.5 px-3 pb-3 pt-0">
            {todos.map((todo) => (
              <TodoItemRow
                key={`${todo.content}:${todo.status}:${todo.activeForm}`}
                todo={todo}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
