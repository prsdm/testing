import { z } from "zod";
import {
  ensureAuthSsoProviderForDomain,
  getTenantActiveSsoProvider,
  getTenantByDomain,
} from "@/core/lib/db/queries";
import { safeAppReturnTo } from "@/core/lib/tenant/safe-return-to";
import { CHAT_HOME } from "@/shared/chat/routes";
import { ChatbotError } from "@/shared/errors";

const startBodySchema = z.object({
  callbackURL: z.string().optional(),
  email: z.string().email(),
});

export async function handleSsoStartRequest(
  request: Request
): Promise<Response> {
  let body: z.infer<typeof startBodySchema>;
  try {
    body = startBodySchema.parse(await request.json());
  } catch (_error) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  const domain = body.email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return Response.json({ error: "Invalid email domain" }, { status: 400 });
  }

  let tenant: Awaited<ReturnType<typeof getTenantByDomain>> = null;
  try {
    tenant = await getTenantByDomain(domain);
  } catch (error) {
    if (error instanceof ChatbotError) {
      return Response.json(
        {
          error:
            "SSO is not configured yet. Ask your admin to complete tenant onboarding.",
        },
        { status: 404 }
      );
    }

    return Response.json(
      { error: "Unable to start SSO right now. Please try again later." },
      { status: 500 }
    );
  }

  if (tenant?.status !== "active") {
    return Response.json(
      {
        error:
          "No active SSO configuration found for this domain. Ask your admin to complete onboarding.",
      },
      { status: 404 }
    );
  }

  const synced = await ensureAuthSsoProviderForDomain(domain);
  if (!synced) {
    return Response.json(
      {
        error:
          "SSO is not ready for this domain yet. Finish the tenant setup wizard (Client ID, secret, issuer) so Microsoft sign-in can be registered, then try again.",
      },
      { status: 503 }
    );
  }

  const callbackURL = safeAppReturnTo(
    body.callbackURL ?? CHAT_HOME,
    "",
    CHAT_HOME
  );

  const activeProvider = await getTenantActiveSsoProvider(tenant.id);

  return Response.json({
    callbackURL,
    ok: true,
    ...(activeProvider === "google_workspace"
      ? { googleHostedDomain: domain }
      : {}),
  });
}
