import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import {
  getTenantLlmAdminView,
  listTenantAvailableChatModels,
  updateTenantLlmDefaults,
  updateTenantLlmModelVisibility,
} from "@/core/lib/db/llm-provider-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";

const patchSchema = z.object({
  defaultChatModelId: z.string().nullable().optional(),
  defaultTitleModelId: z.string().nullable().optional(),
  modelVisibility: z
    .array(
      z.object({
        configurationId: z.string().uuid(),
        isVisible: z.boolean(),
      })
    )
    .optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:models`,
    "admin.models"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const view = await getTenantLlmAdminView(authResult.tenant.id);
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
    `admin:${tenantSlug}:models`,
    "admin.models"
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

  if (
    body.defaultChatModelId !== undefined ||
    body.defaultTitleModelId !== undefined
  ) {
    if (body.defaultChatModelId) {
      const available = await listTenantAvailableChatModels(
        authResult.tenant.id
      );
      const availableIds = new Set(available.map((model) => model.id));
      if (!availableIds.has(body.defaultChatModelId)) {
        return Response.json(
          { error: "Selected default model is not available." },
          { status: 400 }
        );
      }
    }

    await updateTenantLlmDefaults(authResult.tenant.id, {
      defaultChatModelId: body.defaultChatModelId,
      defaultTitleModelId: body.defaultTitleModelId,
    });
  }

  if (body.modelVisibility?.length) {
    await updateTenantLlmModelVisibility(
      authResult.tenant.id,
      body.modelVisibility
    );
  }

  await insertSecurityAuditEvent({
    action: "tenant.admin.models.updated",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    resource: `admin:${tenantSlug}:models`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const view = await getTenantLlmAdminView(authResult.tenant.id);
  return Response.json(view);
}
