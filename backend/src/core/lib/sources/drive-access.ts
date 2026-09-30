import { ensureFreshGoogleDriveAccessToken } from "@/core/lib/connectors/providers/google-drive/credential-token";
import { getDriveActionsEligibility } from "@/core/lib/connectors/providers/google-drive/eligibility";
import { getGoogleDriveConnectorForTenantUser } from "@/core/lib/db/connector-queries";

export async function getDriveAccessForUser(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
}) {
  const eligibility = await getDriveActionsEligibility({
    tenantId: args.tenantId,
    tenantSlug: args.tenantSlug,
    userEmail: args.userEmail,
    userId: args.userId,
  });

  if (!eligibility.canUseRead) {
    return {
      error: eligibility.userConnected
        ? "Drive read is disabled for this organization."
        : "Connect Google Drive on the Connectors page first.",
      ok: false as const,
    };
  }

  const connection = await getGoogleDriveConnectorForTenantUser({
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!connection) {
    return {
      error: "Connect Google Drive on the Connectors page first.",
      ok: false as const,
    };
  }

  const accessToken = await ensureFreshGoogleDriveAccessToken({
    credentialId: connection.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  return { accessToken, ok: true as const };
}

/** Access token for Drive create/upload actions (does not require allowRead). */
export async function getDriveCreateAccessForUser(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
}) {
  const eligibility = await getDriveActionsEligibility({
    tenantId: args.tenantId,
    tenantSlug: args.tenantSlug,
    userEmail: args.userEmail,
    userId: args.userId,
  });

  if (!eligibility.canUseCreate) {
    return {
      error: eligibility.userConnected
        ? "Google Drive actions are not available for this organization."
        : "Connect Google Drive on the Connectors page first.",
      ok: false as const,
    };
  }

  const connection = await getGoogleDriveConnectorForTenantUser({
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!connection) {
    return {
      error: "Connect Google Drive on the Connectors page first.",
      ok: false as const,
    };
  }

  const accessToken = await ensureFreshGoogleDriveAccessToken({
    credentialId: connection.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  return { accessToken, ok: true as const };
}
