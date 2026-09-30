import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import {
  confirmSeatIncrease,
  previewSeatIncrease,
} from "@/core/lib/billing/seat-sync";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";

const bodySchema = z.object({
  /** false = quote only; true = charge card on file */
  confirm: z.boolean().default(false),
  quantity: z.number().int().min(1).max(1000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;

  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `billing:${tenantSlug}:seats`,
    "admin.billing"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    if (!body.confirm) {
      const preview = await previewSeatIncrease({
        quantity: body.quantity,
        tenantId: authResult.tenant.id,
      });
      return Response.json({ preview });
    }

    const result = await confirmSeatIncrease({
      quantity: body.quantity,
      tenantId: authResult.tenant.id,
    });

    await insertSecurityAuditEvent({
      action: "tenant.billing.seats_increased",
      email: authResult.userEmail,
      ipAddress: authResult.ipAddress,
      metadata: {
        addCount: result.addCount,
        amountPaidCents: result.amountPaidCents,
        invoiceId: result.invoiceId,
        seatQuantity: result.seatQuantity,
      },
      resource: `billing:${tenantSlug}:seats`,
      tenantId: authResult.tenant.id,
      userAgent: request.headers.get("user-agent"),
      userId: authResult.userId,
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update seats.";
    return Response.json({ error: message }, { status: 400 });
  }
}
