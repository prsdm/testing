import { auth } from "@/core/lib/auth/server-session";
import {
  getTenantAvailableCapabilities,
  listTenantAvailableChatModels,
  resolveTenantDefaultChatTurnSettings,
} from "@/core/lib/db/llm-provider-queries";
import {
  getTenantAccessContextByEmail,
  isTenantMemberAccessAllowed,
} from "@/core/lib/db/queries";
import { isTenantWebSearchConfigured } from "@/core/lib/db/web-search-queries";
import { evaluateTenantAccess } from "@/core/lib/tenant/access-gate";
import { resolveTenantForUser } from "@/core/lib/tenant/resolve-tenant-for-user";
import { DEFAULT_CHAT_MODEL } from "@/shared/ai/models";

const emptyModelsResponse = {
  capabilities: {},
  defaultChatModelId: DEFAULT_CHAT_MODEL,
  models: [],
  webSearchConfigured: false,
};

export async function GET() {
  const session = await auth();
  const headers = {
    "Cache-Control": "private, no-store",
  };

  const email = session?.user?.email;
  const userId = session?.user?.id;
  if (!(email && userId)) {
    return Response.json(emptyModelsResponse, { headers });
  }

  const tenant = await resolveTenantForUser({
    authUserId: userId,
    email,
  });
  if (!tenant) {
    return Response.json(emptyModelsResponse, { headers });
  }

  const [memberAllowed, accessContext] = await Promise.all([
    isTenantMemberAccessAllowed({
      authUserId: userId,
      tenantId: tenant.id,
    }),
    getTenantAccessContextByEmail(email),
  ]);
  const denial = evaluateTenantAccess({
    allowedOrgUnits: accessContext?.allowedOrgUnits ?? [],
    memberAllowed,
    personOrgUnit: accessContext?.personOrgUnit ?? null,
    personStatus: accessContext?.personStatus,
  });
  if (denial) {
    return Response.json(emptyModelsResponse, { headers, status: 403 });
  }

  const [models, defaults, webSearchConfigured] = await Promise.all([
    listTenantAvailableChatModels(tenant.id),
    resolveTenantDefaultChatTurnSettings(tenant.id),
    isTenantWebSearchConfigured(tenant.id),
  ]);

  return Response.json(
    {
      capabilities: getTenantAvailableCapabilities(models),
      defaultChatModelId: defaults.modelId,
      defaultChatReasoningEffort: defaults.reasoningEffort,
      models,
      webSearchConfigured,
    },
    { headers }
  );
}
