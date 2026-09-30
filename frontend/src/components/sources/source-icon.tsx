"use client";

import { FileTextIcon, FileUpIcon } from "lucide-react";
import {
  type ConnectorProvider,
  ConnectorProviderIcon,
} from "@/components/connectors/connector-provider-icon";
import type { SourceConnectorType } from "@/contracts/sources";

const KB_SOURCE_PROVIDER: Partial<
  Record<SourceConnectorType, ConnectorProvider>
> = {
  confluence: "confluence",
  drive: "google-drive",
  notion: "notion",
  sharepoint: "sharepoint",
  slack: "slack",
};

export function KbSourceIcon({
  sourceType,
  className,
}: {
  sourceType: SourceConnectorType;
  className?: string;
}) {
  const provider = KB_SOURCE_PROVIDER[sourceType];
  if (provider) {
    return <ConnectorProviderIcon className={className} provider={provider} />;
  }

  if (sourceType === "upload") {
    return <FileUpIcon aria-hidden className={className} strokeWidth={1.75} />;
  }

  return <FileTextIcon aria-hidden className={className} strokeWidth={1.75} />;
}
