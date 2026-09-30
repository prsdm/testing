"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { UserMessageInlineBody } from "@/components/chat/user-message-inline-body";
import { UserMessageText } from "@/components/chat/user-message-text";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import {
  inlineBodyHasConnectorSegments,
  messageHasStoredComposerDisplay,
  resolveMessageInlineBody,
} from "@/lib/chat/composer-inline-body";
import { buildConnectorMentionTargets } from "@/lib/connectors/connector-mention-targets";
import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";
import type { ConnectorPanelItem } from "@/shared/connectors/connectors-panel-types";
import type { ChatMessage } from "@/shared/types";
import { fetcher } from "@/shared/utils";

export function UserMessageConnectorBody({
  className,
  metadata,
  text,
  visibleText,
}: {
  text: string;
  visibleText?: string;
  metadata?: ChatMessage["metadata"];
  className?: string;
}) {
  const tenantSlug = useTenantSlug();
  const storedDisplay = messageHasStoredComposerDisplay(metadata);
  const bootstrapKey =
    storedDisplay || !tenantSlug
      ? null
      : `${process.env.KIMIRO_BASE_PATH ?? ""}/api/connectors/${tenantSlug}/bootstrap`;
  const { data: bootstrap } = useSWR<{ items: ConnectorPanelItem[] }>(
    bootstrapKey,
    fetcher,
    { revalidateOnFocus: false }
  );
  const mentionTargets = useMemo(
    () => buildConnectorMentionTargets(bootstrap?.items ?? []),
    [bootstrap?.items]
  );
  const inlineBody = useMemo(
    () =>
      resolveMessageInlineBody({
        focuses: (metadata?.composerConnectorFocuses?.length
          ? metadata.composerConnectorFocuses
          : metadata?.composerConnectorFocus
            ? [metadata.composerConnectorFocus]
            : undefined) as ComposerConnectorFocus[] | undefined,
        mentionTargets: storedDisplay ? [] : mentionTargets,
        storedInlineBody: metadata?.composerInlineBody,
        wireText: text,
      }),
    [metadata, mentionTargets, storedDisplay, text]
  );

  if (inlineBodyHasConnectorSegments(inlineBody) && inlineBody) {
    return <UserMessageInlineBody body={inlineBody} className={className} />;
  }
  return <UserMessageText className={className} text={visibleText ?? text} />;
}
