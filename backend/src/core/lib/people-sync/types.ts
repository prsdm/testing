import type { SupportedSsoProvider } from "@/shared/sso/providers";

export type PeopleProfile = {
  externalId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  department?: string;
  title?: string;
  managerEmail?: string;
  location?: string;
  status: "active" | "inactive";
  raw?: Record<string, unknown>;
};

export type ProviderDirectoryCredentials = {
  baseUrl?: string;
  /** Okta API Services app client ID (OAuth private-key JWT). */
  oktaOAuthClientId?: string;
  /** RSA private key: PEM, or JSON JWK object string from Okta (starts with `{`). */
  oktaPrivateKey?: string;
  tenantId?: string;
  clientId?: string;
  /**
   * PEM bundle: leaf `-----BEGIN CERTIFICATE-----` plus unencrypted
   * `-----BEGIN PRIVATE KEY-----` (or RSA PRIVATE KEY). Required for Entra
   * directory sync (Graph client credentials with certificate assertion).
   */
  azureClientCertificatePem?: string;
  refreshToken?: string;
  domain?: string;
  delegatedAdminEmail?: string;
  serviceAccountClientEmail?: string;
  serviceAccountPrivateKey?: string;
};

export type TenantProviderConfig = {
  tenantId: string;
  slug: string;
  provider: SupportedSsoProvider;
  metadata: unknown;
};
