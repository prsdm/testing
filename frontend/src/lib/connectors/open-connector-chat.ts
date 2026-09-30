import { CHAT_HOME } from "@/shared/chat/routes";
import {
  type ComposerConnectorFocus,
  stashPendingConnectorFocus,
} from "@/shared/connectors/composer-connector-focus";

export const CONNECTOR_CHAT_FOCUS_EVENT = "kimiro:connector-chat-focus";

export function openConnectorChat(
  router: { push: (href: string) => void },
  focus: ComposerConnectorFocus
) {
  stashPendingConnectorFocus(focus);
  router.push(CHAT_HOME);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CONNECTOR_CHAT_FOCUS_EVENT));
  }
}
