export type SupportedSsoProvider = "google_workspace" | "okta" | "azure_ad";

export const providerLabelById: Record<SupportedSsoProvider, string> = {
  azure_ad: "Azure AD",
  google_workspace: "Google Workspace",
  okta: "Okta",
};

export const providerRouteIdById: Record<SupportedSsoProvider, string> = {
  azure_ad: "azure",
  google_workspace: "google",
  okta: "okta",
};

export function getDefaultIssuer(provider: SupportedSsoProvider) {
  if (provider === "google_workspace") {
    return "https://accounts.google.com";
  }

  if (provider === "azure_ad") {
    return "https://login.microsoftonline.com/common/v2.0";
  }

  return "";
}

export function getSsoCallbackPath(provider: SupportedSsoProvider) {
  return `/api/auth/sso/callback/${providerRouteIdById[provider]}`;
}
