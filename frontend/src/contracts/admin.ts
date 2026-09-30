export type GroupMemberPickerOption = {
  memberId: string;
  personId: string | null;
  email: string;
  displayName: string;
  image: string | null;
};

export type SecurityAuditEventRow = {
  id: string;
  createdAt: string;
  action: string;
  email: string | null;
  resource: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
};

export type SupportedSsoProvider = "google_workspace" | "okta" | "azure_ad";

export type TenantSecurityDomainRow = {
  id: string;
  domain: string;
  isPrimary: boolean;
  verifiedAt: string | null;
  createdAt: string;
};

export type TenantSecurityAdminView = {
  login: {
    methods: Array<{ id: "sso"; label: string; enforced: boolean }>;
    note: string;
  };
  sso: {
    configured: boolean;
    provider: SupportedSsoProvider | null;
    providerLabel: string | null;
    issuerUrl: string | null;
    clientId: string | null;
    status: "pending" | "active" | "disabled" | null;
    updatedAt: string | null;
  };
  domains: TenantSecurityDomainRow[];
  accessPolicy: {
    allowedOrgUnits: string[];
  };
};

export type TenantSlackIntegrationAdminView = {
  enabled: boolean;
  dmsEnabled: boolean;
  deliverablesEnabled: boolean;
  allowedChannelIds: string[];
  credentialMode: "managed" | "own";
  oauthClientId: string | null;
  hasOAuthClientSecret: boolean;
  hasSigningSecret: boolean;
  oauthConfigured: boolean;
  managedOAuthAvailable: boolean;
  installed: boolean;
  slackTeamId: string | null;
  slackTeamName: string | null;
  botUserId: string | null;
  installedAt: string | null;
  eventsRequestUrl: string;
  interactionsRequestUrl: string;
  oauthRedirectUri: string;
  botScopeLines: string;
};

export type WellKnownLlmProvider = "openai" | "anthropic" | "google";

export type ChatModel = {
  id: string;
  name: string;
  provider: WellKnownLlmProvider;
  description: string;
  reasoningEffort?:
    | "none"
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | "max";
};

export type TenantLlmProviderView = {
  id: string;
  provider: WellKnownLlmProvider;
  configured: boolean;
  keyHint: string | null;
  models: Array<{
    id: string;
    modelId: string;
    displayName: string;
    isVisible: boolean;
  }>;
};

export type TenantLlmAdminView = {
  providers: TenantLlmProviderView[];
  defaults: {
    defaultChatModelId: string | null;
    defaultChatReasoningEffort: string | null;
    defaultTitleModelId: string | null;
  };
  wellKnownProviders: WellKnownLlmProvider[];
  availableChatModels: ChatModel[];
};

export type WorkSkillId = "slides" | "xlsx" | "docs" | "pdf";
export type SandboxWorkSkillsEnabled = Record<WorkSkillId, boolean>;

export type TenantGeneralSettingsView = {
  workspacePrompt: string | null;
  logoUrl: string | null;
  maximumChatRetentionDays: number | null;
  sandboxEnabled: boolean;
  sandboxWorkSkillsEnabled: SandboxWorkSkillsEnabled;
};

export type TenantGeneralAdminView = {
  workspace: {
    companyName: string;
    slug: string;
    primaryDomain: string;
    status: "pending_setup" | "active" | "suspended";
    createdAt: string;
  };
  settings: TenantGeneralSettingsView;
  knowledge: {
    indexingEnabled: boolean;
    maxIndexedContentSizeMb: number;
    envAllowsIndexing: boolean;
  };
  models: {
    defaultChatModelId: string | null;
    defaultChatReasoningEffort: string | null;
    availableChatModels: ChatModel[];
  };
  sandbox: {
    enabled: boolean;
    envConfigured: boolean;
    workSkillsEnabled: SandboxWorkSkillsEnabled;
  };
  webSearch: {
    maxAutoReadPages: WebSearchAutoReadLimit;
  };
};

export type WebSearchProviderCategory = "search" | "content";
export type WebSearchProviderType = "serper" | "tavily" | "exa" | "brave";
export type WebContentProviderType = "builtin_crawler" | "firecrawl";
export type WebSearchAutoReadLimit = 3 | 5 | 10;

export type WebSearchProviderMetadata = {
  type: WebSearchProviderType;
  label: string;
  subtitle: string;
  helper: string;
  apiKeyUrl?: string;
  requiresApiKey: boolean;
};

export type WebContentProviderMetadata = {
  type: WebContentProviderType;
  label: string;
  subtitle: string;
  helper: string;
  apiKeyUrl?: string;
  requiresApiKey: boolean;
  builtin: boolean;
};

export type WebSearchProviderView = {
  id: string;
  category: WebSearchProviderCategory;
  providerType: string;
  configured: boolean;
  isActive: boolean;
  keyHint: string | null;
  config: Record<string, string>;
};

export type TenantWebSearchAdminView = {
  searchProviders: WebSearchProviderView[];
  contentProviders: WebSearchProviderView[];
  availableSearchProviders: WebSearchProviderMetadata[];
  availableContentProviders: WebContentProviderMetadata[];
  defaultContentProviderType: WebContentProviderType;
  maxAutoReadPages: WebSearchAutoReadLimit;
};
