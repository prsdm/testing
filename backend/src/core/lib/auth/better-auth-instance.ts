import { sso } from "@better-auth/sso";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import { sealAuthSsoOidcSecretsInDb } from "@/core/lib/auth/oidc-config-seal";
import { sendAuthEmail } from "@/core/lib/auth/send-auth-email";
import {
  sessionPolicyExpiresInSec,
  sessionPolicyFreshAgeSec,
  sessionPolicyUpdateAgeSec,
} from "@/core/lib/auth/session-policy";
import { withUnsealedSsoOidcAdapter } from "@/core/lib/auth/sso-oidc-adapter";
import { getPostgresClient } from "@/core/lib/db/client";
import {
  getAuthUserEmailById,
  insertSecurityAuditEvent,
  upsertTenantMemberOnLogin,
} from "@/core/lib/db/queries";
import {
  createSelfServeWorkspace,
  getOwnedTenantForAuthUserId,
  hasAnyTenantMembershipForAuthUserId,
  listActiveTenantsForAuthUserId,
} from "@/core/lib/db/self-serve-workspace";
import {
  authAccount,
  authSession,
  authSsoProvider,
  authUser,
  authVerification,
} from "@/core/lib/db/tables";
import { acceptPendingInvitesForUser } from "@/core/lib/db/tenant-invite-queries";

const client = getPostgresClient();
const authSchema = {
  account: authAccount,
  session: authSession,
  ssoProvider: authSsoProvider,
  user: authUser,
  verification: authVerification,
};
const db = drizzle(client, { schema: authSchema });

const extraTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const localWebOrigins = [
  process.env.KIMIRO_WEB_ORIGIN?.trim(),
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.BETTER_AUTH_URL?.trim(),
].filter(Boolean) as string[];

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const microsoftClientId = process.env.MICROSOFT_CLIENT_ID?.trim();
const microsoftClientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();

async function ensureWorkspaceMembershipOnLogin({
  authUserId,
  email,
}: {
  authUserId: string;
  email: string;
}) {
  await acceptPendingInvitesForUser({ authUserId, email });

  const memberships = await listActiveTenantsForAuthUserId(authUserId);
  if (memberships.length > 0) {
    await upsertTenantMemberOnLogin({ authUserId, email });
    return;
  }

  const joined = await upsertTenantMemberOnLogin({ authUserId, email });
  if (joined?.isActive) {
    return;
  }

  const owned = await getOwnedTenantForAuthUserId(authUserId);
  if (owned) {
    return;
  }

  if (await hasAnyTenantMembershipForAuthUserId(authUserId)) {
    return;
  }

  await createSelfServeWorkspace({
    authUserId,
    email,
  });
}

export const authInstance = betterAuth({
  account: {
    accountLinking: {
      trustedProviders: ["google", "microsoft", "magic-link"],
    },
  },
  baseURL: process.env.BETTER_AUTH_URL,
  database: withUnsealedSsoOidcAdapter(
    drizzleAdapter(db, {
      provider: "pg",
      schema: authSchema,
    })
  ),
  databaseHooks: {
    session: {
      create: {
        after: async (sessionRecord) => {
          const email = await getAuthUserEmailById(sessionRecord.userId);
          await insertSecurityAuditEvent({
            action: "auth.session.created",
            email,
            ipAddress: sessionRecord.ipAddress ?? null,
            metadata: null,
            resource: "auth/session",
            userAgent: sessionRecord.userAgent ?? null,
            userId: sessionRecord.userId,
          });
          if (email) {
            await ensureWorkspaceMembershipOnLogin({
              authUserId: sessionRecord.userId,
              email,
            });
          }
        },
      },
      delete: {
        after: async (sessionRecord) => {
          const email = await getAuthUserEmailById(sessionRecord.userId);
          await insertSecurityAuditEvent({
            action: "auth.session.deleted",
            email,
            ipAddress: sessionRecord.ipAddress ?? null,
            metadata: null,
            resource: "auth/session",
            userAgent: sessionRecord.userAgent ?? null,
            userId: sessionRecord.userId,
          });
        },
      },
    },
  },
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 10,
      sendMagicLink: async ({ email, url }) => {
        await sendAuthEmail({
          subject: "Sign in to Kimiro",
          text: `Click this link to sign in to Kimiro:\n\n${url}\n\nThis link expires in 10 minutes.`,
          to: email,
        });
      },
    }),
    sso({
      trustEmailVerified: true,
    }),
  ],
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET,
  session: {
    expiresIn: sessionPolicyExpiresInSec,
    freshAge: sessionPolicyFreshAgeSec,
    updateAge: sessionPolicyUpdateAgeSec,
  },
  socialProviders: {
    ...(googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {}),
    ...(microsoftClientId && microsoftClientSecret
      ? {
          microsoft: {
            clientId: microsoftClientId,
            clientSecret: microsoftClientSecret,
            tenantId:
              process.env.MICROSOFT_TENANT_ID?.trim() || "organizations",
          },
        }
      : {}),
  },
  trustedOrigins: [
    "https://accounts.google.com",
    "https://*.googleapis.com",
    "https://login.microsoftonline.com",
    "https://graph.microsoft.com",
    "https://*.okta.com",
    ...localWebOrigins,
    ...extraTrustedOrigins,
  ],
});

sealAuthSsoOidcSecretsInDb().catch(() => undefined);
