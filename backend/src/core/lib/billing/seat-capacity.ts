/**
 * Pure seat-capacity helpers (no DB). Safe for unit tests.
 */

export type SeatCapacityDenialCode = "not_subscribed" | "at_capacity";

export type SeatCapacityEvaluation =
  | { ok: true }
  | {
      ok: false;
      code: SeatCapacityDenialCode;
      message: string;
    };

/**
 * Pure capacity check.
 * `pendingInvites` counts open invites that will consume a seat on accept.
 */
export function evaluateSeatCapacity(args: {
  subscribed: boolean;
  seatQuantity: number;
  activeSeats: number;
  pendingInvites?: number;
  /** When true, reserve one more seat (invite or activate). */
  reserveOne?: boolean;
}): SeatCapacityEvaluation {
  if (!args.subscribed) {
    return {
      code: "not_subscribed",
      message:
        "Subscribe to a plan before adding teammates. Go to Admin → Billing.",
      ok: false,
    };
  }

  const paidSeats = Math.max(0, Math.floor(args.seatQuantity));
  const active = Math.max(0, Math.floor(args.activeSeats));
  const pending = Math.max(0, Math.floor(args.pendingInvites ?? 0));
  const used = active + pending;
  const needed = args.reserveOne === false ? used : used + 1;

  if (needed > paidSeats) {
    return {
      code: "at_capacity",
      message:
        paidSeats <= 0
          ? "This workspace has no paid seats. Buy seats in Admin → Billing before adding teammates."
          : `All ${paidSeats} paid seat${paidSeats === 1 ? "" : "s"} ${
              pending > 0
                ? "are used or reserved by pending invites"
                : "are in use"
            }. Buy more seats in Admin → Billing first.`,
      ok: false,
    };
  }

  return { ok: true };
}

/** Paid seats for AI pool when subscribed; otherwise active member seats. */
export function resolveBillableSeatCount(args: {
  subscribed: boolean;
  paidSeatQuantity: number;
  activeSeatCount: number;
}) {
  if (args.subscribed && args.paidSeatQuantity > 0) {
    return args.paidSeatQuantity;
  }
  return Math.max(1, args.activeSeatCount);
}
