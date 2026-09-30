import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Center column shared by chat, workspace pages, and channel files. */
export const workspaceContentWidthClassName =
  "mx-auto w-full max-w-3xl px-2 md:px-4";

/** Channel topic feed — inbox list column. */
export const channelTopicTimelineWidthClassName =
  "mx-auto w-full max-w-3xl min-w-0 px-0 md:px-0";

/** In-card topic header avatars (compact; thread pane stays size-6). */
export const channelTopicAvatarClassName = "size-6 shrink-0 rounded-[5px]";

/** Inbox list row header — slightly smaller than card avatars. */
export const channelTopicInboxAvatarClassName = "size-5 shrink-0 rounded-[4px]";

/** Thread reply face stack on channel topic cards (~70% of header tile). */
/** ~67% of header tile (`size-6`) — matches Figma thread face stack. */
export const channelTopicThreadReplyAvatarClassName =
  "size-4 shrink-0 rounded-[3px]";

export const workspacePageMainClassName = cn(
  workspaceContentWidthClassName,
  "flex flex-col gap-6 pb-6 pt-16"
);

export const workspacePageHeaderClassName = "flex flex-col pb-6";

export const workspacePageHeaderIconClassName = "mb-1 size-7";

export const workspacePageTitleClassName =
  "font-semibold text-2xl tracking-tight";

export const workspacePageDescriptionClassName =
  "text-muted-foreground text-sm";

/** Borderless fields that match page title and description typography. */
export const workspacePageInlineFieldClassName =
  "agent-inline-field w-full rounded-none border-0 bg-transparent px-0 py-0 shadow-none outline-none focus-visible:ring-0 placeholder:text-muted-foreground/40";

/** Editable page title field — overrides Textarea base `md:text-sm`. */
export const workspacePageInlineTitleFieldClassName = cn(
  workspacePageInlineFieldClassName,
  workspacePageTitleClassName,
  "leading-tight text-foreground md:text-2xl"
);

export const workspacePageBackLinkClassName =
  "mb-4 inline-flex w-fit items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground";

export function WorkspacePageBackLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link className={cn(workspacePageBackLinkClassName, className)} href={href}>
      <ArrowLeftIcon className="size-4" />
      {label}
    </Link>
  );
}

export function WorkspacePageBackButton({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Button
      asChild
      className={cn("bg-transparent hover:bg-muted/50", className)}
      size="sm"
      variant="outline"
    >
      <Link href={href}>
        <ArrowLeftIcon />
        {label}
      </Link>
    </Button>
  );
}

export function WorkspacePageMain({
  children = null,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn(workspacePageMainClassName, className)}>
      {children}
    </main>
  );
}

export function WorkspacePageHeader({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(workspacePageHeaderClassName, className)}>
      {children ?? (
        <>
          {icon}
          {title ? (
            <h1 className={workspacePageTitleClassName}>{title}</h1>
          ) : null}
          {description ? (
            <p className={workspacePageDescriptionClassName}>{description}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
