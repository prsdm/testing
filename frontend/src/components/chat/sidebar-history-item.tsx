"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { ChatSummary } from "@/contracts/chat";
import { chatConversationPath } from "@/shared/chat/routes";
import { cn } from "@/shared/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { LoaderIcon, MoreHorizontalIcon } from "./icons";

const chatHistoryMenuItemClassName =
  "cursor-pointer rounded-lg pr-3 hover:bg-muted/50 focus:bg-muted/50 focus:text-foreground";

const PureChatItem = ({
  chat,
  isActive,
  isStreaming = false,
  onDelete,
  onRename,
  setOpenMobile,
}: {
  chat: ChatSummary;
  isActive: boolean;
  isStreaming?: boolean;
  onDelete: (chatId: string) => void;
  onRename: (args: { chatId: string; title: string }) => Promise<void>;
  setOpenMobile: (open: boolean) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(chat.title);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(chat.title);
    }
  }, [chat.title, isEditing]);

  useEffect(() => {
    if (!isEditing || !inputRef.current) {
      return;
    }
    inputRef.current.focus();
    inputRef.current.select();
  }, [isEditing]);

  const commitRename = async () => {
    if (isSaving) {
      return;
    }

    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) {
      setDraftTitle(chat.title);
      setIsEditing(false);
      return;
    }

    if (trimmedTitle === chat.title) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onRename({ chatId: chat.id, title: trimmedTitle });
      setIsEditing(false);
    } catch {
      setDraftTitle(chat.title);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelRename = () => {
    setDraftTitle(chat.title);
    setIsEditing(false);
  };

  return (
    <SidebarMenuItem>
      {isEditing ? (
        <SidebarMenuButton
          className="h-8 rounded-[0.625rem] p-0 text-[14px] hover:bg-transparent data-[active=true]:bg-transparent"
          isActive={isActive}
        >
          <Input
            className="h-8 w-full rounded-[0.625rem] border-0 bg-transparent px-2.5 text-[14px] shadow-none focus-visible:border-0 focus-visible:ring-0"
            disabled={isSaving}
            maxLength={200}
            onBlur={() => {
              commitRename().catch(() => undefined);
            }}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitRename().catch(() => undefined);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelRename();
              }
            }}
            ref={inputRef}
            value={draftTitle}
          />
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          asChild
          className={cn(
            "h-8 text-[14px] transition-colors duration-150",
            isActive
              ? "bg-sidebar-accent font-medium text-sidebar-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:font-medium hover:text-sidebar-foreground"
          )}
          isActive={isActive}
        >
          <Link
            className="flex w-full min-w-0 items-center gap-2"
            href={chatConversationPath(chat.id)}
            onClick={() => setOpenMobile(false)}
          >
            <span className="min-w-0 flex-1 truncate">{chat.title}</span>
            {isStreaming ? (
              <span className="ml-auto shrink-0 animate-spin text-sidebar-foreground/50">
                <LoaderIcon size={14} />
                <span className="sr-only">Generating</span>
              </span>
            ) : null}
          </Link>
        </SidebarMenuButton>
      )}

      {isEditing ? null : (
        <DropdownMenu modal={true}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              className="mr-0.5 cursor-pointer rounded-md bg-transparent text-sidebar-foreground/50 ring-0 transition-colors duration-150 focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-transparent! hover:text-sidebar-foreground data-[state=open]:bg-transparent! data-[state=open]:text-sidebar-foreground"
              showOnHover={!isActive}
            >
              <MoreHorizontalIcon />
              <span className="sr-only">More</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            className="min-w-32 **:data-[slot=dropdown-menu-item]:cursor-pointer"
            side="bottom"
          >
            <DropdownMenuItem
              className={chatHistoryMenuItemClassName}
              onSelect={() => {
                setIsEditing(true);
                setDraftTitle(chat.title);
              }}
            >
              <PencilIcon className="size-4" />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className={chatHistoryMenuItemClassName}
              onSelect={() => onDelete(chat.id)}
            >
              <Trash2Icon className="size-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem);
