import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { confirmTopUp, previewTopUp } from "@/core/lib/billing/topup-charge";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import {
  isValidTopUpUsd,
  MAX_TOP_UP_USD,
  MIN_TOP_UP_USD,
} from "@/shared/billing/topup-packs";

const bodySchema = z.object({
  amountUsd: z
    .number()
    .int()
    .refine(isValidTopUpUsd, {
      message: `Enter a whole dollar amount from $${MIN_TOP_UP_USD} to $${MAX_TOP_UP_USD}.`,
    }),
  /** false = quote only; true = charge card on file */
  confirm: z.boolean().default(false),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;

  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `billing:${tenantSlug}:top-up`,
    "admin.billing"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json(
      {
        error: `Enter a whole dollar amount from $${MIN_TOP_UP_USD} to $${MAX_TOP_UP_USD.toLocaleString("en-US")}.`,
      },
      { status: 400 }
    );
  }

  try {
    if (!body.confirm) {
      const preview = await previewTopUp({
        amountUsd: body.amountUsd,
        tenantId: authResult.tenant.id,
      });
      return Response.json({ preview });
    }

    const result = await confirmTopUp({
      amountUsd: body.amountUsd,
      tenantId: authResult.tenant.id,
    });

    await insertSecurityAuditEvent({
      action: "tenant.billing.topup_purchased",
      email: authResult.userEmail,
      ipAddress: authResult.ipAddress,
      metadata: {
        amountPaidCents: result.amountPaidCents,
        amountUsd: result.amountUsd,
        balanceUsdCents: result.balanceUsdCents,
        invoiceId: result.invoiceId,
      },
      resource: `billing:${tenantSlug}:top-up`,
      tenantId: authResult.tenant.id,
      userAgent: request.headers.get("user-agent"),
      userId: authResult.userId,
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not complete top-up.";
    return Response.json({ error: message }, { status: 400 });
  }
}
