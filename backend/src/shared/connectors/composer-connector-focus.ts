import type { ConnectorProvider } from "@/contracts/connectors";
import type { GoogleAppId } from "@/shared/connectors/providers/google-shared/apps";
import type { WorkSkillId } from "@/shared/sandbox/work-skill-catalog";

export type ComposerConnectorFocus =
  | {
      kind: "work-skill";
      skillId: WorkSkillId;
      name: string;
    }
  | {
      kind: "google-app";
      appId: GoogleAppId;
      name: string;
      provider: ConnectorProvider;
    }
  | {
      kind: "provider";
      provider: ConnectorProvider;
      name: string;
    }
  | {
      kind: "mcp";
      serverId: string;
      name: string;
    };

export function formatConnectorFocusInstruction(
  focus: ComposerConnectorFocus
): string {
  switch (focus.kind) {
    case "work-skill":
      return `The user scoped this turn to the built-in ${focus.name} tool (@ mention). Only sandbox deliverable tools and ${focus.name} work-skill workflows are available — use sandboxExec with the ${focus.name} skill as needed.`;
    case "google-app":
      return `The user scoped this turn to ${focus.name} (@ mention). Only ${focus.name} connector tools are available for this turn.`;
    case "provider":
      return `The user scoped this turn to ${focus.name} (@ mention). Only ${focus.name} connector tools are available for this turn.`;
    case "mcp":
      return `The user scoped this turn to the MCP connector "${focus.name}" (@ mention). Only tools from that MCP server are available for this turn.`;
    default: {
      const _exhaustive: never = focus;
      return _exhaustive;
    }
  }
}
