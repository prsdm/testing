"use client";

import { MessageSquare, MinusCircle, MoreHorizontal, Plus } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/shared/utils";

const connectorOutlineButtonClassName = "bg-transparent hover:bg-muted/50";

type ConnectorOutlineButtonProps = ComponentProps<typeof Button>;

export function ConnectorDisconnectButton({
  className,
  ...props
}: ConnectorOutlineButtonProps) {
  return (
    <Button
      className={cn(connectorOutlineButtonClassName, className)}
      size="sm"
      type="button"
      variant="outline"
      {...props}
    />
  );
}

/** Solid primary — used in chat tool cards, not the connectors directory list. */
export function ConnectorConnectButton({
  className,
  ...props
}: ConnectorOutlineButtonProps) {
  return <Button className={className} size="sm" type="button" {...props} />;
}

export function ConnectorAddButton({
  href,
  onClick,
  disabled,
  "aria-label": ariaLabel = "Connect",
  className,
}: {
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}) {
  const sharedProps = {
    className: cn(connectorOutlineButtonClassName, className),
    disabled,
    size: "icon-sm" as const,
    type: "button" as const,
    variant: "outline" as const,
  };

  if (href && !disabled) {
    return (
      <Button
        asChild
        className={sharedProps.className}
        size="icon-sm"
        variant="outline"
      >
        <a aria-label={ariaLabel} href={href}>
          <Plus className="size-4" />
        </a>
      </Button>
    );
  }

  return (
    <Button {...sharedProps} aria-label={ariaLabel} onClick={onClick}>
      <Plus className="size-4" />
    </Button>
  );
}

export function ConnectorActionsMenu({
  itemLabel,
  onChat,
  onDisconnect,
  disconnectDisabled = false,
  disconnectLabel = "Disconnect",
}: {
  itemLabel: string;
  onChat?: () => void;
  onDisconnect?: () => void;
  disconnectDisabled?: boolean;
  disconnectLabel?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={connectorOutlineButtonClassName}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Actions for {itemLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-40 **[data-slot=dropdown-menu-item]:cursor-pointer"
      >
        {onChat ? (
          <DropdownMenuItem
            onClick={() => {
              onChat();
            }}
          >
            <MessageSquare className="size-4" />
            Chat
          </DropdownMenuItem>
        ) : null}
        {onChat && onDisconnect ? <DropdownMenuSeparator /> : null}
        {onDisconnect ? (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            disabled={disconnectDisabled}
            onClick={onDisconnect}
            variant="destructive"
          >
            <MinusCircle className="size-4" />
            {disconnectLabel}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ConnectorConnectAction({
  itemLabel,
  connected,
  connectHref,
  onConnect,
  connectDisabled = false,
  connectBusy = false,
  onChat,
  onDisconnect,
  disconnectDisabled = false,
  disconnectBusy = false,
}: {
  itemLabel: string;
  connected: boolean;
  connectHref?: string;
  onConnect?: () => void;
  connectDisabled?: boolean;
  connectBusy?: boolean;
  onChat?: () => void;
  onDisconnect: () => void;
  disconnectDisabled?: boolean;
  disconnectBusy?: boolean;
}) {
  if (connected) {
    return (
      <ConnectorActionsMenu
        disconnectDisabled={disconnectDisabled || disconnectBusy}
        disconnectLabel={disconnectBusy ? "Disconnecting…" : "Disconnect"}
        itemLabel={itemLabel}
        onChat={onChat}
        onDisconnect={onDisconnect}
      />
    );
  }

  if (connectHref) {
    return (
      <ConnectorAddButton
        aria-label={`Connect ${itemLabel}`}
        disabled={connectDisabled || connectBusy}
        href={connectHref}
      />
    );
  }

  if (onConnect) {
    return (
      <ConnectorAddButton
        aria-label={`Connect ${itemLabel}`}
        disabled={connectDisabled || connectBusy}
        onClick={onConnect}
      />
    );
  }

  return null;
}
