export type ProviderTool = {
  id: string;
  name: string;
  description: string;
};

export type AuthType = "API_KEY" | "OAUTH2";

export type Provider = {
  id: string;
  name: string;
  description: string;
  auth: AuthType[];
  authType: AuthType;
  category: string;
  logoUrl?: string;
  docsUrl?: string;
  iconColor?: string;
  tools: ProviderTool[];
  scopes: string[];
};

export type ToolParam = {
  name: string;
  required: boolean;
  type?: string;
  description: string;
};
