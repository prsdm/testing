import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { testLlmProviderConnection } from "@/core/lib/ai/test-llm-connection";
import { getTenantLlmProviderApiKey } from "@/core/lib/db/llm-provider-queries";
import {
  isWellKnownLlmProvider,
  type WellKnownLlmProvider,
} from "@/shared/ai/llm-providers";

const postSchema = z.object({
  apiBase: z.string().nullable().optional(),
  apiKey: z.string().optional(),
  provider: z.string(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:models:test`,
    "admin.models"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isWellKnownLlmProvider(body.provider)) {
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  }
  const provider = body.provider as WellKnownLlmProvider;

  const candidateKey =
    body.apiKey?.trim() ||
    (await getTenantLlmProviderApiKey(authResult.tenant.id, provider));
  if (!candidateKey) {
    return Response.json(
      { error: "API key is required to test" },
      { status: 400 }
    );
  }

  try {
    await testLlmProviderConnection({
      apiBase: body.apiBase,
      apiKey: candidateKey,
      provider,
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

  return Response.json({ ok: true });
}
