import { z } from "zod";
import {
  completeTenantSetup,
  getSetupTokenTenant,
} from "@/core/lib/db/queries";
import { checkSetupIpRateLimit } from "@/core/lib/ratelimit";
import { getClientIpFromHeaders } from "@/core/lib/security/sensitive-session";
import { getDefaultIssuer } from "@/shared/sso/providers";

const setupBodySchema = z.object({
  adminEmails: z.array(z.string().email()).min(1),
  clientId: z.string().min(3),
  clientSecret: z.string().min(3),
  directory: z
    .object({
      allowedOrgUnits: z.array(z.string()).optional(),
      azureClientCertificatePem: z.string().optional(),
      baseUrl: z.string().url().optional(),
      clientId: z.string().optional(),
      delegatedAdminEmail: z.string().email().optional(),
      domain: z.string().optional(),
      oktaOAuthClientId: z.string().optional(),
      oktaPrivateKey: z.string().optional(),
      serviceAccountClientEmail: z.string().email().optional(),
      serviceAccountPrivateKey: z.string().optional(),
      tenantId: z.string().optional(),
    })
    .optional(),
  issuerUrl: z.string().url().optional(),
  provider: z.enum(["google_workspace", "okta", "azure_ad"]),
  token: z.string().min(32),
});

async function enforceSetupRateLimit(request: Request) {
  try {
    await checkSetupIpRateLimit(
      getClientIpFromHeaders(request.headers) ?? undefined
    );
    return null;
  } catch {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
}

export async function GET(request: Request) {
  const limited = await enforceSetupRateLimit(request);
  if (limited) {
    return limited;
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) {
    return Response.json({ valid: false }, { status: 400 });
  }

  const tenant = await getSetupTokenTenant({ token });
  if (!tenant) {
    return Response.json({ valid: false }, { status: 404 });
  }

  return Response.json({
    tenant: {
      companyName: tenant.companyName,
      primaryDomain: tenant.primaryDomain,
      slug: tenant.slug,
    },
    valid: true,
  });
}

export async function POST(request: Request) {
  const limited = await enforceSetupRateLimit(request);
  if (limited) {
    return limited;
  }

  let body: z.infer<typeof setupBodySchema>;
  try {
    body = setupBodySchema.parse(await request.json());
  } catch (_error) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const issuer = body.issuerUrl ?? getDefaultIssuer(body.provider);
    await completeTenantSetup({
      adminEmails: body.adminEmails,
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      directoryConfig: body.directory,
      issuerUrl: issuer,
      provider: body.provider,
      token: body.token,
    });

    return Response.json({ ok: true });
  } catch (error) {
    const message =
      (error instanceof Error &&
        typeof error.cause === "string" &&
        error.cause.trim()) ||
      (error instanceof Error ? error.message : null) ||
      "Unable to save setup details";
    return Response.json({ error: message }, { status: 400 });
  }
}
