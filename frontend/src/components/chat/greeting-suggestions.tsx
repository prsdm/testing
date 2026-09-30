"use client";

import { ArrowUpRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GREETING_SUGGESTION_CATEGORIES } from "@/lib/chat/greeting-suggestion-categories";
import { cn } from "@/shared/utils";
import { focusComposerInput } from "./composer-inject";

export function GreetingSuggestions({
  className,
  disabled = false,
  hidden = false,
  onSelect,
}: {
  className?: string;
  disabled?: boolean;
  hidden?: boolean;
  onSelect: (prompt: string) => void;
}) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (hidden) {
      setActiveCategoryId(null);
    }
  }, [hidden]);

  const activeCategory = GREETING_SUGGESTION_CATEGORIES.find(
    (category) => category.id === activeCategoryId
  );

  const handleCategoryClick = (categoryId: string) => {
    if (disabled || hidden) {
      return;
    }

    setActiveCategoryId((current) =>
      current === categoryId ? null : categoryId
    );
  };

  const handleQueryClick = (query: string) => {
    if (disabled || hidden) {
      return;
    }

    onSelect(query);
    focusComposerInput();
  };

  return (
    <div
      aria-hidden={hidden}
      className={cn(
        "relative px-1",
        hidden && "pointer-events-none opacity-0",
        className
      )}
    >
      <div className="flex min-h-23 flex-wrap content-start items-center justify-center gap-2">
        {GREETING_SUGGESTION_CATEGORIES.map(({ id, label, icon: Icon }) => {
          const isActive = activeCategoryId === id;

          return (
            <Button
              className={cn(
                "h-9 cursor-pointer gap-2 rounded-lg border-border/60 px-3.5 font-normal text-sm shadow-none",
                isActive
                  ? "border-foreground/20 bg-muted text-foreground hover:bg-muted"
                  : "bg-background text-foreground hover:bg-muted/50"
              )}
              disabled={disabled || hidden}
              key={id}
              onClick={() => handleCategoryClick(id)}
              type="button"
              variant="outline"
            >
              <Icon className="size-3.5 text-muted-foreground" />
              {label}
            </Button>
          );
        })}
      </div>

      {activeCategory ? (
        <div className="absolute inset-x-0 top-full z-10 mt-3 bg-background">
          {activeCategory.queries.map((query, index) => (
            <button
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 py-3 text-left text-foreground text-sm transition-colors hover:text-foreground/80 disabled:cursor-not-allowed disabled:opacity-50",
                index > 0 && "border-border/40 border-t"
              )}
              disabled={disabled || hidden}
              key={query}
              onClick={() => handleQueryClick(query)}
              type="button"
            >
              <span className="min-w-0 flex-1 truncate">{query}</span>
              <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
