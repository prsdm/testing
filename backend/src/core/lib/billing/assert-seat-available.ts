import { evaluateSeatCapacity } from "@/core/lib/billing/seat-capacity";
import {
  getTenantBilling,
  isTenantSubscriptionActive,
} from "@/core/lib/db/billing-queries";
import {
  countPendingTenantInvites,
  countRawActiveTenantSeats,
} from "@/core/lib/db/usage-queries";
import { ChatbotError } from "@/shared/errors";

function throwSeatCapacityDenial(
  result: Extract<ReturnType<typeof evaluateSeatCapacity>, { ok: false }>
) {
  throw new ChatbotError("bad_request:api", result.message);
}

/** Before creating an invite — counts active members + pending invites. */
export async function assertSeatAvailableForInvite(tenantId: string) {
  const billing = await getTenantBilling(tenantId);
  const activeSeats = await countRawActiveTenantSeats(tenantId);
  const pendingInvites = await countPendingTenantInvites(tenantId);
  const result = evaluateSeatCapacity({
    activeSeats,
    pendingInvites,
    reserveOne: true,
    seatQuantity: billing?.seatQuantity ?? 0,
    subscribed: isTenantSubscriptionActive(billing),
  });
  if (!result.ok) {
    throwSeatCapacityDenial(result);
  }
}

/**
 * Before accepting an invite or reactivating a member —
 * only active seats count (invite is not yet accepted).
 */
export async function assertSeatAvailableForMember(tenantId: string) {
  const billing = await getTenantBilling(tenantId);
  const activeSeats = await countRawActiveTenantSeats(tenantId);
  const result = evaluateSeatCapacity({
    activeSeats,
    pendingInvites: 0,
    reserveOne: true,
    seatQuantity: billing?.seatQuantity ?? 0,
    subscribed: isTenantSubscriptionActive(billing),
  });
  if (!result.ok) {
    throwSeatCapacityDenial(result);
  }
}
