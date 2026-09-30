import { OAuth2Client } from "google-auth-library";
import { deleteAllGoogleAppConnectionsForTenantUser } from "@/core/lib/connectors/providers/google-shared/queries";
import {
  getCredentialRowByIdForTenant,
  updateCredentialSecret,
} from "@/core/lib/db/connector-queries";
import { getTenantDriveActionsOAuthCredentials } from "@/core/lib/db/drive-actions-queries";
import { getAuthUserEmailById } from "@/core/lib/db/queries";
import { decryptSecret } from "@/core/lib/security/crypto";
import { mergeGoogleOAuthScopeStrings } from "@/shared/connectors/providers/google-shared/apps";
import { assertGoogleAccountMatchesUserEmail } from "./auth";
import { DriveNotConnectedError } from "./errors";
import { getGoogleDriveOAuthRedirectUri } from "./oauth";

type OAuthSecretPayload = {
  access_token?: string;
  refresh_token?: string | null;
  token_type?: string;
  scope?: string;
  expires_at?: number | null;
  user_email?: string;
  google_account_email?: string;
};

function parseOAuthSecret(secretEncrypted: string): OAuthSecretPayload {
  try {
    return JSON.parse(decryptSecret(secretEncrypted)) as OAuthSecretPayload;
  } catch {
    return {};
  }
}

function isExpired(expiresAt: number | null | undefined) {
  if (expiresAt === undefined || expiresAt === null) {
    return false;
  }
  return Date.now() >= expiresAt - 60_000;
}

async function enforceGoogleAccountEmailMatch(args: {
  tenantId: string;
  userId: string;
  sessionEmail: string;
  payload: OAuthSecretPayload;
}) {
  const googleAccountEmail = args.payload.google_account_email
    ?.trim()
    .toLowerCase();
  if (!googleAccountEmail) {
    await deleteAllGoogleAppConnectionsForTenantUser({
      tenantId: args.tenantId,
      userId: args.userId,
    });
    throw new DriveNotConnectedError();
  }
  try {
    assertGoogleAccountMatchesUserEmail({
      googleAccountEmail,
      userEmail: args.sessionEmail,
    });
  } catch {
    await deleteAllGoogleAppConnectionsForTenantUser({
      tenantId: args.tenantId,
      userId: args.userId,
    });
    throw new DriveNotConnectedError();
  }
}

export async function ensureFreshGoogleDriveAccessToken(args: {
  credentialId: string;
  tenantId: string;
  userId: string;
}): Promise<string> {
  const credential = await getCredentialRowByIdForTenant({
    id: args.credentialId,
    requireOwned: true,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!credential?.enabled) {
    throw new Error("Google Drive credential not found.");
  }

  const sessionEmail = (await getAuthUserEmailById(args.userId))
    ?.trim()
    .toLowerCase();
  if (!sessionEmail) {
    throw new DriveNotConnectedError();
  }

  const payload = parseOAuthSecret(credential.secretEncrypted);
  if (!payload.access_token) {
    throw new Error("Google Drive access token missing.");
  }

  await enforceGoogleAccountEmailMatch({
    payload,
    sessionEmail,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  if (!isExpired(payload.expires_at)) {
    return payload.access_token;
  }
  if (!payload.refresh_token) {
    throw new DriveNotConnectedError();
  }

  const oauthCredentials = await getTenantDriveActionsOAuthCredentials(
    args.tenantId
  );
  if (!oauthCredentials) {
    throw new Error("Drive actions are not configured for this organization.");
  }

  const client = new OAuth2Client({
    clientId: oauthCredentials.clientId,
    clientSecret: oauthCredentials.clientSecret,
    redirectUri: getGoogleDriveOAuthRedirectUri(),
  });
  client.setCredentials({ refresh_token: payload.refresh_token });
  const { credentials: refreshed } = await client.refreshAccessToken();
  if (!refreshed.access_token) {
    throw new DriveNotConnectedError();
  }

  const nextPayload: OAuthSecretPayload = {
    ...payload,
    access_token: refreshed.access_token,
    expires_at: refreshed.expiry_date ?? null,
    refresh_token: refreshed.refresh_token ?? payload.refresh_token,
    // Google often returns a partial scope list on refresh. Never shrink the
    // stored union — shared Workspace credentials rely on it for reconnect UX.
    scope: mergeGoogleOAuthScopeStrings(
      payload.scope ?? "",
      refreshed.scope ?? ""
    ).join(" "),
    token_type: refreshed.token_type ?? payload.token_type ?? "Bearer",
  };

  await updateCredentialSecret({
    id: args.credentialId,
    plainSecret: JSON.stringify(nextPayload),
    tenantId: args.tenantId,
    userId: args.userId,
  });

  return refreshed.access_token;
}
