import { googleAppOAuthConnectPath } from "@/shared/connectors/providers/google-shared/connect-url";
import type { IntegrationCatalogEntry } from "@/shared/integrations/integration-catalog";

function connectorsReturnTo() {
  return encodeURIComponent("/connectors");
}

export function oauthConnectPathForIntegration(
  tenantSlug: string,
  entry: IntegrationCatalogEntry
) {
  if (entry.googleAppId) {
    return googleAppOAuthConnectPath(tenantSlug, entry.googleAppId);
  }

  return `/api/connectors/oauth/${entry.key}?tenantSlug=${encodeURIComponent(tenantSlug)}&name=${encodeURIComponent(entry.name)}&returnTo=${connectorsReturnTo()}`;
}
