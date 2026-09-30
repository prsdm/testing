import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { purgeExpiredChatsForTenant } from "@/core/lib/admin/chat-retention";
import { getTenantGeneralAdminView } from "@/core/lib/admin/general-settings-admin";
import {
  updateTenantCompanyName,
  updateTenantGeneralSettings,
} from "@/core/lib/db/general-settings-queries";
import {
  listTenantAvailableChatModels,
  updateTenantLlmDefaults,
} from "@/core/lib/db/llm-provider-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import { updateTenantSearchSettings } from "@/core/lib/db/search-index-queries";
import { updateTenantWebSearchSettings } from "@/core/lib/db/web-search-queries";
import { runInBackground } from "@/core/lib/runtime/background";
import { getCapabilities } from "@/shared/ai/models";
import {
  normalizeReasoningEffortForModel,
  REASONING_EFFORT_LEVELS,
} from "@/shared/ai/reasoning-effort";
import { DEFAULT_SANDBOX_WORK_SKILLS_ENABLED } from "@/shared/sandbox/work-skill-catalog";
import { WEB_SEARCH_AUTO_READ_LIMITS } from "@/shared/web-search/settings";

const patchSchema = z.object({
  companyName: z.string().trim().min(1).max(200).optional(),
  defaultChatModelId: z.string().nullable().optional(),
  defaultChatReasoningEffort: z
    .enum(REASONING_EFFORT_LEVELS)
    .nullable()
    .optional(),
  indexingEnabled: z.boolean().optional(),
  maxIndexedContentSizeMb: z.number().int().min(1).max(250).optional(),
  maximumChatRetentionDays: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .nullable()
    .optional(),
  sandboxEnabled: z.boolean().optional(),
  workspacePrompt: z.string().max(8000).nullable().optional(),
  maxAutoReadPages: z
    .union([
      z.literal(WEB_SEARCH_AUTO_READ_LIMITS[0]),
      z.literal(WEB_SEARCH_AUTO_READ_LIMITS[1]),
      z.literal(WEB_SEARCH_AUTO_READ_LIMITS[2]),
    ])
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
    `admin:${tenantSlug}:general`,
    "admin.general"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const view = await getTenantGeneralAdminView(authResult.tenant);
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
    `admin:${tenantSlug}:general`,
    "admin.general"
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

  const tenant = authResult.tenant;
  const retentionChanged = body.maximumChatRetentionDays !== undefined;

  if (body.companyName) {
    await updateTenantCompanyName(tenant.id, body.companyName);
  }

  const settingsPatch: Parameters<typeof updateTenantGeneralSettings>[1] = {};
  if (body.workspacePrompt !== undefined) {
    settingsPatch.workspacePrompt = body.workspacePrompt;
  }
  if (body.maximumChatRetentionDays !== undefined) {
    settingsPatch.maximumChatRetentionDays = body.maximumChatRetentionDays;
  }
  if (body.sandboxEnabled !== undefined) {
    settingsPatch.sandboxEnabled = body.sandboxEnabled;
    if (body.sandboxEnabled) {
      settingsPatch.sandboxWorkSkillsEnabled =
        DEFAULT_SANDBOX_WORK_SKILLS_ENABLED;
    }
  }

  if (Object.keys(settingsPatch).length > 0) {
    await updateTenantGeneralSettings(tenant.id, settingsPatch);
  }

  const searchPatch: Parameters<typeof updateTenantSearchSettings>[1] = {};
  if (body.indexingEnabled !== undefined) {
    searchPatch.indexingEnabled = body.indexingEnabled;
  }
  if (body.maxIndexedContentSizeMb !== undefined) {
    searchPatch.maxIndexedContentSizeMb = body.maxIndexedContentSizeMb;
  }
  if (Object.keys(searchPatch).length > 0) {
    await updateTenantSearchSettings(tenant.id, searchPatch);
  }

  if (body.maxAutoReadPages !== undefined) {
    await updateTenantWebSearchSettings(tenant.id, {
      maxAutoReadPages: body.maxAutoReadPages,
    });
  }

  if (
    body.defaultChatModelId !== undefined ||
    body.defaultChatReasoningEffort !== undefined
  ) {
    const available = await listTenantAvailableChatModels(tenant.id);
    const availableIds = new Set(available.map((model) => model.id));

    if (body.defaultChatModelId && !availableIds.has(body.defaultChatModelId)) {
      return Response.json(
        { error: "Selected default model is not available." },
        { status: 400 }
      );
    }

    let defaultChatReasoningEffort = body.defaultChatReasoningEffort;
    if (
      defaultChatReasoningEffort !== undefined &&
      defaultChatReasoningEffort !== null &&
      body.defaultChatModelId
    ) {
      const supportsReasoning =
        getCapabilities()[body.defaultChatModelId]?.reasoning === true;
      defaultChatReasoningEffort = normalizeReasoningEffortForModel({
        effort: defaultChatReasoningEffort,
        modelId: body.defaultChatModelId,
        supportsReasoning,
      });
    }

    await updateTenantLlmDefaults(tenant.id, {
      ...(body.defaultChatModelId === undefined
        ? {}
        : { defaultChatModelId: body.defaultChatModelId }),
      ...(body.defaultChatReasoningEffort === undefined
        ? {}
        : { defaultChatReasoningEffort }),
    });
  }

  await insertSecurityAuditEvent({
    action: "tenant.general.updated",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    resource: `admin:${tenantSlug}:general`,
    tenantId: tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  if (retentionChanged && body.maximumChatRetentionDays) {
    runInBackground(async () => {
      await purgeExpiredChatsForTenant({
        retentionDays: body.maximumChatRetentionDays as number,
        tenantId: tenant.id,
      });
    });
  }

  const view = await getTenantGeneralAdminView({
    ...tenant,
    companyName: body.companyName ?? tenant.companyName,
  });
  return Response.json(view);
}
