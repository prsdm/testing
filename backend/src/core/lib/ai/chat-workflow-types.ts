import type { ModelMessage } from "ai";
import type { ResolvedTenantLlmKeys } from "@/core/lib/db/llm-provider-queries";
import type { ResolvedTenantWebSearchConfig } from "@/core/lib/db/web-search-queries";
import type { ReasoningEffortLevel } from "@/shared/ai/reasoning-effort";
import type { UserRejectedApprovalAttempt } from "@/shared/ai/tool-approvals";
import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";
import type { WorkSkillId } from "@/shared/sandbox/work-skill-catalog";

export type ConnectorWorkflowToolDescriptor = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  toolConfigId: string;
  toolId: string;
  providerId: string;
};

export type McpWorkflowToolDescriptor = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
  mcpToolName: string;
};

export type WorkflowToolsConfiguration = {
  connectorTools: ConnectorWorkflowToolDescriptor[];
  mcpTools: McpWorkflowToolDescriptor[];
  webSearchConfig: ResolvedTenantWebSearchConfig | null;
  sandboxEnabled?: boolean;
  sandboxWorkSkillIds?: WorkSkillId[];
};

export type ChatWorkflowInput = {
  chatId: string;
  tenantId: string;
  tenantSlug: string;
  tenantUserId: string;
  authUser: {
    id: string;
    email: string;
    name?: string | null;
    preferredName?: string | null;
  };
  userMessageId: string;
  assistantMessageId: string;
  idempotencyKey: string;
  modelId: string;
  reasoningEffort?: ReasoningEffortLevel;
  /** Optional composer chip selection or per-turn inferred knowledge base hint. */
  knowledgeBaseId?: string | null;
  knowledgeBaseName?: string | null;
  /** Latest user message for this turn (knowledge base intent matching). */
  turnUserMessage?: string;
  /** First @-mention focus (legacy). */
  connectorFocus?: ComposerConnectorFocus | null;
  /** All @-mention scopes; tool filter unions across entries. */
  connectorFocuses?: ComposerConnectorFocus[];
  /** Block every approval-gated tool for this continuation. */
  writeToolsBlocked?: boolean;
  /** Block specific approval-gated tools the user rejected earlier in the turn. */
  blockedApprovalToolNames?: string[];
  /** Exact tool+input pairs the user rejected via approval in this turn. */
  userRejectedApprovalAttempts?: UserRejectedApprovalAttempt[];
  workspacePrompt?: string;
  toolConfiguration: WorkflowToolsConfiguration;
  llmKeys: ResolvedTenantLlmKeys;
  messages: ModelMessage[];
  /** When set, model context is limited to this thread (Slack-style room @Kimiro). */
  roomHistoryThreadRootMessageId?: string;
  /** Member roster + multiplayer rules for channel/DM @Kimiro turns. */
  roomKimiroContext?: string;
};
