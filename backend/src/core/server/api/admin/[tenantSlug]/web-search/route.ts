import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import {
  deleteTenantWebSearchProvider,
  getTenantWebSearchAdminView,
  getTenantWebSearchProviderApiKey,
  updateTenantWebSearchSettings,
  upsertTenantWebSearchProvider,
} from "@/core/lib/db/web-search-queries";
import { testWebSearchProviderConnection } from "@/core/lib/web-search/test-connection";
import {
  isWebContentProviderType,
  isWebSearchProviderType,
} from "@/shared/web-search/providers";
import { WEB_SEARCH_AUTO_READ_LIMITS } from "@/shared/web-search/settings";

const putSchema = z.object({
  activate: z.boolean().optional(),
  apiKey: z.string().optional(),
  category: z.enum(["search", "content"]),
  clearApiKey: z.boolean().optional(),
  config: z.record(z.string(), z.string()).optional(),
  providerType: z.string().min(1).max(64),
  testConnection: z.boolean().optional(),
});

const deleteSchema = z.object({
  providerId: z.string().uuid(),
});

const patchSchema = z.object({
  maxAutoReadPages: z.union([
    z.literal(WEB_SEARCH_AUTO_READ_LIMITS[0]),
    z.literal(WEB_SEARCH_AUTO_READ_LIMITS[1]),
    z.literal(WEB_SEARCH_AUTO_READ_LIMITS[2]),
  ]),
});

function isValidProviderType(category: "search" | "content", type: string) {
  return category === "search"
    ? isWebSearchProviderType(type)
    : isWebContentProviderType(type);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:web-search`,
    "admin.web_search"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const view = await getTenantWebSearchAdminView(authResult.tenant.id);
  return Response.json(view);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:web-search`,
    "admin.web_search"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof putSchema>;
  try {
    body = putSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isValidProviderType(body.category, body.providerType)) {
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  }

  if (body.activate && !body.apiKey?.trim()) {
    const existingKey = await getTenantWebSearchProviderApiKey(
      authResult.tenant.id,
      body.category,
      body.providerType
    );
    if (!existingKey) {
      return Response.json(
        { error: "Provider must be configured before activation" },
        { status: 400 }
      );
    }
  }

  if (body.testConnection) {
    const candidateKey =
      body.apiKey?.trim() ||
      (await getTenantWebSearchProviderApiKey(
        authResult.tenant.id,
        body.category,
        body.providerType
      ));
    if (!candidateKey) {
      return Response.json(
        { error: "API key is required to test" },
        { status: 400 }
      );
    }
    try {
      await testWebSearchProviderConnection({
        apiKey: candidateKey,
        category: body.category,
        providerType: body.providerType,
      });
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error ? error.message : "Connection test failed",
        },
        { status: 400 }
      );
    }
  }

  await upsertTenantWebSearchProvider(authResult.tenant.id, {
    activate: body.activate,
    apiKey: body.apiKey,
    category: body.category,
    clearApiKey: body.clearApiKey,
    config: body.config,
    providerType: body.providerType,
  });

  await insertSecurityAuditEvent({
    action: "tenant.admin.web_search.updated",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    resource: `admin:${tenantSlug}:web-search:${body.category}:${body.providerType}`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const view = await getTenantWebSearchAdminView(authResult.tenant.id);
  return Response.json(view);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:web-search`,
    "admin.web_search"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof deleteSchema>;
  try {
    body = deleteSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  await deleteTenantWebSearchProvider(authResult.tenant.id, body.providerId);

  await insertSecurityAuditEvent({
    action: "tenant.admin.web_search.deleted",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    resource: `admin:${tenantSlug}:web-search`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const view = await getTenantWebSearchAdminView(authResult.tenant.id);
  return Response.json(view);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:web-search`,
    "admin.web_search"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  await updateTenantWebSearchSettings(authResult.tenant.id, {
    maxAutoReadPages: body.maxAutoReadPages,
  });

  await insertSecurityAuditEvent({
    action: "tenant.admin.web_search.updated",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    resource: `admin:${tenantSlug}:web-search:settings`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const view = await getTenantWebSearchAdminView(authResult.tenant.id);
  return Response.json(view);
}
