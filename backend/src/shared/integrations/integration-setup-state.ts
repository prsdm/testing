import type { IntegrationCatalogEntry } from "@/shared/integrations/integration-catalog";

export type IntegrationSetupInitial = {
  key: string;
  name: string;
  provider: IntegrationCatalogEntry["provider"];
  requiresSiteUrl: boolean;
  credentials: {
    credentialMode: "managed" | "own";
    oauthClientId: string | null;
    hasOAuthClientSecret: boolean;
    siteUrl: string | null;
    redirectUri: string | null;
  };
  availability: {
    isEnabled: boolean;
    availabilityMode: "everyone" | "selected";
    memberIds: string[];
  };
};

export function syncFormFromInitial(initial: IntegrationSetupInitial) {
  return {
    credentialMode: initial.credentials.credentialMode,
    everyone:
      !initial.availability.isEnabled ||
      initial.availability.availabilityMode === "everyone",
    oauthClientId: initial.credentials.oauthClientId ?? "",
    oauthClientSecret: "",
    selectedMemberIds: initial.availability.memberIds,
    siteUrl: initial.credentials.siteUrl ?? "",
  };
}

export function savedStateKeyFromInitial(initial: IntegrationSetupInitial) {
  return [
    initial.key,
    String(initial.availability.isEnabled),
    initial.credentials.credentialMode,
    initial.credentials.oauthClientId ?? "",
    initial.credentials.siteUrl ?? "",
    initial.availability.availabilityMode,
    initial.availability.memberIds.join(","),
  ].join("|");
}
