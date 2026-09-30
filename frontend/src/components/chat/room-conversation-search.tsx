"use client";

import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatMessageTime } from "@/components/chat/message-timestamp";
import { Input } from "@/components/ui/input";
import type { RoomMessageSearchHit } from "@/contracts/room-message-search";
import { useRoomMessageSearch } from "@/hooks/use-room-message-search";
import { cn } from "@/shared/utils";

export const ROOM_MESSAGE_SEARCH_INPUT_ID = "room-message-search-input";

export function useRoomConversationSearch({
  chatId,
  enabled,
  rootRef,
}: {
  chatId: string;
  enabled: boolean;
  rootRef: RefObject<HTMLElement | HTMLDivElement | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeHitIndex, setActiveHitIndex] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: clear query when switching rooms
  useEffect(() => {
    setQuery("");
  }, [chatId]);

  const { hits, isLoading, trimmed } = useRoomMessageSearch(
    chatId,
    query,
    enabled
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    inputRef.current?.blur();
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || query.length === 0) {
        return;
      }
      event.preventDefault();
      clearSearch();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSearch, enabled, query.length]);

  useEffect(() => {
    if (!enabled || query.length === 0) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef.current?.contains(target)) {
        return;
      }
      clearSearch();
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [clearSearch, enabled, query.length, rootRef]);

  const showHint = trimmed.length > 0 && trimmed.length < 2;
  const showEmpty = trimmed.length >= 2 && !isLoading && hits.length === 0;
  const showResults = trimmed.length >= 2 && hits.length > 0;
  const showPanel =
    trimmed.length > 0 && (showHint || isLoading || showEmpty || showResults);

  const searchResultsKey = useMemo(
    () => `${trimmed}\0${hits.map((hit) => hit.messageId).join("\0")}`,
    [hits, trimmed]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when encoded result set changes
  useEffect(() => {
    setActiveHitIndex(0);
  }, [searchResultsKey]);

  const handleInputKeyDown = useCallback(
    (
      event: ReactKeyboardEvent<HTMLInputElement>,
      onSelectHit: (hit: RoomMessageSearchHit) => void
    ) => {
      if (!showResults || hits.length === 0) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveHitIndex((index) => Math.min(index + 1, hits.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveHitIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        const hit = hits[activeHitIndex];
        if (!hit) {
          return;
        }
        event.preventDefault();
        onSelectHit(hit);
      }
    },
    [activeHitIndex, hits, showResults]
  );

  return {
    activeHitIndex,
    clearSearch,
    handleInputKeyDown,
    hits,
    inputRef,
    isLoading,
    query,
    setQuery,
    showEmpty,
    showHint,
    showPanel,
    showResults,
    trimmed,
  };
}

const searchHitActiveClassName = "bg-blue-50 dark:bg-blue-950/40";

export function RoomConversationSearchField({
  className,
  dense = false,
  inbox = false,
  inputRef,
  onClear,
  onKeyDown,
  onQueryChange,
  placeholder = "Search messages",
  query,
}: {
  className?: string;
  dense?: boolean;
  /** Full-width bordered field under an inbox-style header. */
  inbox?: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <SearchIcon
        className={cn(
          "pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-muted-foreground",
          inbox || !dense ? "left-3 size-4" : "left-2 size-3.5"
        )}
      />
      <Input
        aria-label="Search messages"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className={cn(
          "rounded-lg focus-visible:border-input focus-visible:ring-0",
          inbox
            ? "h-9 border border-input bg-background pr-9 pl-9 text-sm shadow-none"
            : cn(
                "bg-transparent",
                dense ? "h-7 pr-7 pl-7 text-xs" : "h-8 pr-9 pl-9"
              )
        )}
        data-1p-ignore
        data-form-type="other"
        data-lpignore="true"
        id={ROOM_MESSAGE_SEARCH_INPUT_ID}
        name="channel-message-search"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        ref={inputRef as Ref<HTMLInputElement>}
        role="searchbox"
        spellCheck={false}
        type="text"
        value={query}
      />
      {query.length > 0 ? (
        <button
          aria-label="Clear search"
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          onClick={onClear}
          type="button"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function RoomConversationSearchResultsPanel({
  activeHitIndex = 0,
  hits,
  isLoading,
  onSelectHit,
  showEmpty,
  showHint,
  showResults,
  trimmed,
}: {
  activeHitIndex?: number;
  hits: RoomMessageSearchHit[];
  isLoading: boolean;
  showHint: boolean;
  showEmpty: boolean;
  showResults: boolean;
  trimmed: string;
  onSelectHit: (hit: RoomMessageSearchHit) => void;
}) {
  const hitButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    hitButtonRefs.current[activeHitIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [activeHitIndex]);

  return (
    <div
      className={cn(
        "absolute top-[calc(100%+6px)] right-0 left-0 z-50 overflow-hidden rounded-md bg-background py-1 shadow-[0_4px_24px_rgba(0,0,0,0.12)]",
        "max-h-[min(360px,45dvh)] overflow-y-auto overscroll-contain",
        "no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      )}
    >
      {showHint ? (
        <p className="px-3 py-2 text-muted-foreground text-sm">
          Type at least 2 characters.
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          Searching…
        </div>
      ) : null}

      {showEmpty ? (
        <p className="px-3 py-2 text-muted-foreground text-sm">
          No messages match &ldquo;{trimmed}&rdquo;.
        </p>
      ) : null}

      {showResults ? (
        <div
          aria-label="Search results"
          className="flex flex-col gap-0.5 px-1"
          role="listbox"
        >
          {hits.map((hit, index) => {
            const timeLabel = formatMessageTime(hit.createdAt);
            const authorName =
              hit.authorDisplayName ??
              (hit.role === "user" ? "Member" : "Kimiro");
            const isActive = index === activeHitIndex;
            return (
              <div key={hit.messageId} role="presentation">
                <button
                  aria-selected={isActive}
                  className={cn(
                    "flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-blue-50 focus-visible:outline-none dark:hover:bg-blue-950/40",
                    isActive && searchHitActiveClassName
                  )}
                  onClick={() => onSelectHit(hit)}
                  ref={(element) => {
                    hitButtonRefs.current[index] = element;
                  }}
                  role="option"
                  type="button"
                >
                  <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                    <span className="font-bold text-[15px] text-foreground leading-tight">
                      {authorName}
                    </span>
                    {timeLabel ? (
                      <span className="text-[13px] text-muted-foreground leading-tight">
                        {timeLabel}
                      </span>
                    ) : null}
                    {hit.threadRootMessageId ? (
                      <span className="text-[13px] text-muted-foreground leading-tight">
                        Thread
                      </span>
                    ) : null}
                  </span>
                  <span className="line-clamp-2 text-[15px] text-foreground/90 leading-snug">
                    {hit.snippet}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function RoomConversationSearchControl({
  className,
  dense = false,
  inbox = false,
  onSelectHit,
  placeholder,
  search,
}: {
  className?: string;
  dense?: boolean;
  inbox?: boolean;
  search: ReturnType<typeof useRoomConversationSearch>;
  onSelectHit: (hit: RoomMessageSearchHit) => void;
  placeholder?: string;
}) {
  return (
    <div className={cn("relative z-30 min-w-0 w-full", className)}>
      <RoomConversationSearchField
        dense={dense}
        inbox={inbox}
        inputRef={search.inputRef}
        onClear={search.clearSearch}
        onKeyDown={(event) => search.handleInputKeyDown(event, onSelectHit)}
        onQueryChange={search.setQuery}
        placeholder={placeholder}
        query={search.query}
      />
      {search.showPanel ? (
        <RoomConversationSearchResultsPanel
          activeHitIndex={search.activeHitIndex}
          hits={search.hits}
          isLoading={search.isLoading}
          onSelectHit={onSelectHit}
          showEmpty={search.showEmpty}
          showHint={search.showHint}
          showResults={search.showResults}
          trimmed={search.trimmed}
        />
      ) : null}
    </div>
  );
}
