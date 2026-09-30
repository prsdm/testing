import { loadAgentInstructions } from "@/core/lib/ai/load-agent-instructions";
import { formatChatSessionContext } from "@/core/lib/ai/prompts";
import { formatWorkspacePrompt } from "@/core/lib/ai/workspace-prompt";

const CHAT_SESSION_PLACEHOLDER = "{{CHAT_SESSION}}";

export function buildChatInstructions(args: {
  workspacePrompt?: string | null;
  roomKimiroContext?: string | null;
  connectorFocusInstruction?: string | null;
  userEmail?: string;
  userName?: string | null;
  preferredName?: string | null;
}): string {
  const session = formatChatSessionContext({
    preferredName: args.preferredName,
    userEmail: args.userEmail,
    userName: args.userName,
  });
  const agent = loadAgentInstructions().replace(
    CHAT_SESSION_PLACEHOLDER,
    session
  );
  const workspace = formatWorkspacePrompt(args.workspacePrompt ?? null);
  const room = args.roomKimiroContext?.trim();
  const connectorFocus = args.connectorFocusInstruction?.trim();

  const sections = [agent, workspace, connectorFocus, room].filter(Boolean);
  return sections.join("\n\n");
}
