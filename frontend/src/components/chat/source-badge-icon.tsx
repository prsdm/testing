"use client";

import { DatabaseIcon } from "lucide-react";
import Image from "next/image";
import { ConnectorProviderIcon } from "@/components/connectors/connector-provider-icon";
import {
  getSourceFaviconUrl,
  resolveConnectorProvider,
  type SourceBadgeInput,
} from "@/lib/chat/source-provider";
import { cn } from "@/shared/utils";

export function SourceBadgeIcon({
  source,
  className,
  imageClassName,
}: {
  source: SourceBadgeInput;
  className?: string;
  imageClassName?: string;
}) {
  const provider = resolveConnectorProvider(source);
  if (provider) {
    return (
      <ConnectorProviderIcon
        className={cn("shrink-0", className)}
        provider={provider}
      />
    );
  }

  const faviconUrl = getSourceFaviconUrl(source);
  if (faviconUrl) {
    return (
      <Image
        alt=""
        className={cn("shrink-0 rounded-full", className, imageClassName)}
        height={16}
        referrerPolicy="no-referrer"
        src={faviconUrl}
        unoptimized
        width={16}
      />
    );
  }

  return (
    <DatabaseIcon
      className={cn("shrink-0 text-muted-foreground/80", className)}
    />
  );
}
