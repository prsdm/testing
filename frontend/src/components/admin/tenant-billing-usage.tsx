"use client";

import { ArrowLeftRight, CreditCardIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/admin/settings-card";
import { SidebarAppLogo } from "@/components/chat/sidebar-app-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  SEAT_PRICE_MONTHLY_USD,
  SEAT_PRICE_YEARLY_MONTHLY_USD,
  SEAT_PRICE_YEARLY_USD,
} from "@/lib/billing/seat-pricing";
import { MIN_TOP_UP_USD } from "@/shared/billing/topup-packs";
import { cn } from "@/shared/utils";

export type MemberBillingUsageView = {
  authUserId: string;
  email: string;
  displayName: string | null;
  usedUsd: number;
  quotaUsdCents: number;
  isCustomQuota: boolean;
  percentUsed: number;
  softWarn: boolean;
  atLimit: boolean;
};

export type TenantSubscriptionView = {
  status: string;
  interval: "month" | "year" | null;
  seatQuantity: number;
  isActive: boolean;
  currentPeriodEnd: string | null;
};

export type TenantBillingUsageView = {
  percentUsed: number;
  allowanceUsdCents: number;
  perSeatAllowanceUsdCents: number;
  seatCount: number;
  allocatedQuotaUsdCents: number;
  usedUsd: number;
  overageUsd: number;
  topUpBalanceUsdCents: number;
  topUpBalanceUsd: number;
  softWarn: boolean;
  atLimit: boolean;
  inputTokens: number;
  outputTokens: number;
  webSearchCount: number;
  imageGenerationCount: number;
  sandboxExecCount: number;
  sandboxExecDurationMs: number;
  eventCount: number;
  periodEnd: string;
  members: MemberBillingUsageView[];
  tenantSlug: string;
  subscription: TenantSubscriptionView;
};

function formatUsd(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}

type SeatPurchasePreview = {
  quantity: number;
  addCount: number;
  currentSeatQuantity: number;
  currency: string;
  amountDueCents: number;
  subtotalCents: number;
  taxCents: number;
  card: { brand: string; last4: string } | null;
};

type TopUpPurchasePreview = {
  amountUsd: number;
  amountUsdCents: number;
  currency: string;
  amountDueCents: number;
  subtotalCents: number;
  taxCents: number;
  card: { brand: string; last4: string } | null;
  currentBalanceUsdCents: number;
};

function CardBrandMark({ brand }: { brand: string }) {
  const normalized = brand.toLowerCase();
  if (normalized === "visa") {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-5 min-w-10 items-center justify-center rounded bg-[#1A1F71] px-1.5 font-bold text-[10px] text-white tracking-wide"
      >
        VISA
      </span>
    );
  }
  if (normalized === "mastercard") {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-5 items-center gap-[-2px] px-0.5"
      >
        <span className="size-3.5 rounded-full bg-[#EB001B]" />
        <span className="-ml-1.5 size-3.5 rounded-full bg-[#F79E1B]/80" />
      </span>
    );
  }
  if (normalized === "amex" || normalized === "american express") {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-5 min-w-10 items-center justify-center rounded bg-[#2E77BC] px-1.5 font-bold text-[9px] text-white tracking-wide"
      >
        AMEX
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 min-w-10 items-center justify-center rounded bg-foreground/80 px-1.5 font-medium text-[9px] text-background uppercase tracking-wide"
    >
      {brand.slice(0, 4) || "CARD"}
    </span>
  );
}

function formatResetDate(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function memberLabel(member: MemberBillingUsageView) {
  return member.displayName?.trim() || member.email;
}

function statusLabel(status: string) {
  if (status === "none") {
    return "Not subscribed";
  }
  return status.replaceAll("_", " ");
}

function MemberQuotaEditor({
  member,
  tenantSlug,
}: {
  member: MemberBillingUsageView;
  tenantSlug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dollars, setDollars] = useState(
    String(Math.round(member.quotaUsdCents / 100))
  );
  const [pending, setPending] = useState(false);

  const save = async (nextCents: number) => {
    setPending(true);
    const response = await fetch(`/api/billing/${tenantSlug}/member-quota`, {
      body: JSON.stringify({
        authUserId: member.authUserId,
        monthlyQuotaUsdCents: nextCents,
      }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    setPending(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(payload?.error ?? "Could not update quota.");
      return;
    }
    toast.success("Quota updated.");
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <Button
        className="h-7 px-2 text-xs"
        disabled={pending}
        onClick={() => {
          setDollars(String(Math.round(member.quotaUsdCents / 100)));
          setOpen(true);
        }}
        type="button"
        variant="ghost"
      >
        Edit
      </Button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Input
        aria-label={`Quota for ${memberLabel(member)}`}
        className="h-7 w-20 text-xs"
        disabled={pending}
        inputMode="numeric"
        min={0}
        onChange={(event) => setDollars(event.target.value)}
        step={1}
        type="number"
        value={dollars}
      />
      <Button
        className="h-7 px-2 text-xs"
        disabled={pending}
        onClick={() => {
          const parsed = Number.parseInt(dollars, 10);
          if (!Number.isFinite(parsed) || parsed < 0) {
            toast.error("Enter a whole dollar amount.");
            return;
          }
          save(parsed * 100).catch(() => {
            toast.error("Could not update quota.");
          });
        }}
        type="button"
        variant="secondary"
      >
        Save
      </Button>
      <Button
        className="h-7 px-2 text-xs"
        disabled={pending}
        onClick={() => setOpen(false)}
        type="button"
        variant="ghost"
      >
        Cancel
      </Button>
    </span>
  );
}

export function TenantBillingUsage({
  usage,
}: {
  usage: TenantBillingUsageView;
}) {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState<
    "month" | "year" | null
  >(null);
  const [portalPending, setPortalPending] = useState(false);
  const [topUpDialogOpen, setTopUpDialogOpen] = useState(false);
  const [dialogTopUpDollars, setDialogTopUpDollars] = useState("50");
  const [topUpPreview, setTopUpPreview] = useState<TopUpPurchasePreview | null>(
    null
  );
  const [topUpPreviewPending, setTopUpPreviewPending] = useState(false);
  const [topUpPreviewError, setTopUpPreviewError] = useState<string | null>(
    null
  );
  const [topUpConfirmPending, setTopUpConfirmPending] = useState(false);
  const [seatDialogOpen, setSeatDialogOpen] = useState(false);
  const [dialogSeatsToAdd, setDialogSeatsToAdd] = useState("1");
  const [seatPreview, setSeatPreview] = useState<SeatPurchasePreview | null>(
    null
  );
  const [seatPreviewPending, setSeatPreviewPending] = useState(false);
  const [seatPreviewError, setSeatPreviewError] = useState<string | null>(null);
  const [seatConfirmPending, setSeatConfirmPending] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "success") {
      toast.success("Subscription checkout completed.");
    } else if (checkout === "cancel") {
      toast.message("Checkout canceled.");
    } else {
      return;
    }
    params.delete("seats");
    params.delete("topup");
    params.delete("checkout");
    const next = params.toString();
    window.history.replaceState(
      null,
      "",
      next ? `${window.location.pathname}?${next}` : window.location.pathname
    );
    router.refresh();
  }, [router]);

  const allowanceUsd = usage.allowanceUsdCents / 100;
  const perSeatUsd = usage.perSeatAllowanceUsdCents / 100;
  const allocatedFromMembers = usage.members.reduce(
    (sum, member) => sum + member.quotaUsdCents,
    0
  );
  const allocatedCents = Number.isFinite(usage.allocatedQuotaUsdCents)
    ? usage.allocatedQuotaUsdCents
    : allocatedFromMembers;
  const allocatedUsd = allocatedCents / 100;
  const overAllocated = allocatedCents > usage.allowanceUsdCents;
  const hasCustomQuotas = usage.members.some((member) => member.isCustomQuota);
  const barWidth = `${Math.min(100, Math.max(0, usage.percentUsed))}%`;
  const subscription = usage.subscription;
  const billedSeats = subscription.isActive
    ? subscription.seatQuantity || usage.seatCount
    : usage.seatCount;
  const topUpTrackedUsd = usage.overageUsd + usage.topUpBalanceUsd;
  const topUpPercentUsed =
    topUpTrackedUsd > 0
      ? Math.min(100, Math.round((usage.overageUsd / topUpTrackedUsd) * 100))
      : 0;
  const topUpBarWidth = `${topUpPercentUsed}%`;
  const topUpSoftWarn = topUpPercentUsed >= 80;
  const topUpAtLimit = usage.topUpBalanceUsdCents <= 0 && usage.overageUsd > 0;

  const startCheckout = async (interval: "month" | "year") => {
    setCheckoutPending(interval);
    const response = await fetch(`/api/billing/${usage.tenantSlug}/checkout`, {
      body: JSON.stringify({ interval }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setCheckoutPending(null);
    const payload = (await response.json().catch(() => null)) as {
      url?: string;
      error?: string;
    } | null;
    if (!(response.ok && payload?.url)) {
      toast.error(payload?.error ?? "Could not start checkout.");
      return;
    }
    window.location.href = payload.url;
  };

  const openPortal = async (flow?: "payment_method_update") => {
    setPortalPending(true);
    const response = await fetch(`/api/billing/${usage.tenantSlug}/portal`, {
      body: JSON.stringify(flow ? { flow } : {}),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setPortalPending(false);
    const payload = (await response.json().catch(() => null)) as {
      url?: string;
      error?: string;
    } | null;
    if (!(response.ok && payload?.url)) {
      toast.error(payload?.error ?? "Could not open billing portal.");
      return;
    }
    window.location.href = payload.url;
  };

  useEffect(() => {
    if (!seatDialogOpen) {
      return;
    }

    const addCount = Number.parseInt(dialogSeatsToAdd, 10);
    if (!Number.isFinite(addCount) || addCount < 1) {
      setSeatPreview(null);
      setSeatPreviewError("Enter at least 1 seat.");
      setSeatPreviewPending(false);
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      const quantity = billedSeats + addCount;
      setSeatPreviewPending(true);
      setSeatPreviewError(null);
      fetch(`/api/billing/${usage.tenantSlug}/seats`, {
        body: JSON.stringify({ confirm: false, quantity }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
            preview?: SeatPurchasePreview;
          } | null;
          if (cancelled) {
            return;
          }
          setSeatPreviewPending(false);
          if (!(response.ok && payload?.preview)) {
            setSeatPreview(null);
            setSeatPreviewError(payload?.error ?? "Could not estimate charge.");
            return;
          }
          setSeatPreview(payload.preview);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setSeatPreviewPending(false);
          setSeatPreview(null);
          setSeatPreviewError("Could not estimate charge.");
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [seatDialogOpen, dialogSeatsToAdd, billedSeats, usage.tenantSlug]);

  const openSeatDialog = () => {
    setDialogSeatsToAdd("1");
    setSeatPreview(null);
    setSeatPreviewError(null);
    setSeatDialogOpen(true);
  };

  const confirmBuySeats = async () => {
    if (!seatPreview) {
      return;
    }
    setSeatConfirmPending(true);
    const response = await fetch(`/api/billing/${usage.tenantSlug}/seats`, {
      body: JSON.stringify({ confirm: true, quantity: seatPreview.quantity }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setSeatConfirmPending(false);
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      result?: {
        addCount: number;
        seatQuantity: number;
        amountPaidCents: number;
        currency: string;
      };
    } | null;
    if (!response.ok) {
      toast.error(payload?.error ?? "Payment failed — seats were not added.");
      return;
    }
    const paid = payload?.result;
    toast.success(
      paid
        ? `Added ${paid.addCount} seat${paid.addCount === 1 ? "" : "s"} · charged ${formatCents(paid.amountPaidCents, paid.currency)}. Now ${paid.seatQuantity} paid seats.`
        : "Seats added and charged to your card on file."
    );
    setSeatDialogOpen(false);
    setSeatPreview(null);
    setDialogSeatsToAdd("1");
    router.refresh();
  };

  useEffect(() => {
    if (!topUpDialogOpen) {
      return;
    }

    const amountUsd = Number.parseInt(dialogTopUpDollars, 10);
    if (!Number.isFinite(amountUsd) || amountUsd < MIN_TOP_UP_USD) {
      setTopUpPreview(null);
      setTopUpPreviewError(
        `Enter a whole dollar amount of at least $${MIN_TOP_UP_USD}.`
      );
      setTopUpPreviewPending(false);
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      setTopUpPreviewPending(true);
      setTopUpPreviewError(null);
      fetch(`/api/billing/${usage.tenantSlug}/top-up`, {
        body: JSON.stringify({ amountUsd, confirm: false }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
            preview?: TopUpPurchasePreview;
          } | null;
          if (cancelled) {
            return;
          }
          setTopUpPreviewPending(false);
          if (!(response.ok && payload?.preview)) {
            setTopUpPreview(null);
            setTopUpPreviewError(
              payload?.error ?? "Could not estimate charge."
            );
            return;
          }
          setTopUpPreview(payload.preview);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setTopUpPreviewPending(false);
          setTopUpPreview(null);
          setTopUpPreviewError("Could not estimate charge.");
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [topUpDialogOpen, dialogTopUpDollars, usage.tenantSlug]);

  const openTopUpDialog = () => {
    setDialogTopUpDollars("50");
    setTopUpPreview(null);
    setTopUpPreviewError(null);
    setTopUpDialogOpen(true);
  };

  const confirmBuyTopUp = async () => {
    if (!topUpPreview) {
      return;
    }
    setTopUpConfirmPending(true);
    const response = await fetch(`/api/billing/${usage.tenantSlug}/top-up`, {
      body: JSON.stringify({
        amountUsd: topUpPreview.amountUsd,
        confirm: true,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setTopUpConfirmPending(false);
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      result?: {
        amountUsd: number;
        amountPaidCents: number;
        currency: string;
        balanceUsdCents: number;
      };
    } | null;
    if (!response.ok) {
      toast.error(payload?.error ?? "Payment failed — top-up was not added.");
      return;
    }
    const paid = payload?.result;
    toast.success(
      paid
        ? `Added $${paid.amountUsd} top-up · charged ${formatCents(paid.amountPaidCents, paid.currency)}. Balance ${formatUsd(paid.balanceUsdCents / 100)}.`
        : "Top-up added and charged to your card on file."
    );
    setTopUpDialogOpen(false);
    setTopUpPreview(null);
    setDialogTopUpDollars("50");
    router.refresh();
  };

  const resetAllQuotas = async () => {
    setResetting(true);
    const response = await fetch(
      `/api/billing/${usage.tenantSlug}/member-quota`,
      {
        body: JSON.stringify({ resetAll: true }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }
    );
    setResetting(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(payload?.error ?? "Could not reset quotas.");
      return;
    }
    toast.success("All quotas reset to seat defaults.");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <SettingsCard
        description={`$${SEAT_PRICE_MONTHLY_USD}/seat monthly or $${SEAT_PRICE_YEARLY_MONTHLY_USD}/seat when billed yearly ($${SEAT_PRICE_YEARLY_USD}/year). Includes $${perSeatUsd.toFixed(0)} AI + web per seat.`}
        title="Plan"
      >
        <div className="flex flex-col gap-3 px-1 pb-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-[15px] text-foreground capitalize">
                {statusLabel(subscription.status)}
              </p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {subscription.isActive
                  ? `${billedSeats} billed seat${
                      billedSeats === 1 ? "" : "s"
                    } · ${
                      subscription.interval === "year"
                        ? `$${SEAT_PRICE_YEARLY_MONTHLY_USD}/seat/mo yearly`
                        : `$${SEAT_PRICE_MONTHLY_USD}/seat/mo`
                    }${
                      subscription.currentPeriodEnd
                        ? ` · renews ${formatResetDate(subscription.currentPeriodEnd)}`
                        : ""
                    }`
                  : "AI is locked until you subscribe. Buy seats, then invite teammates."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {subscription.isActive ? (
                <Button
                  disabled={portalPending}
                  onClick={() => {
                    openPortal().catch(() => {
                      toast.error("Could not open billing portal.");
                    });
                  }}
                  type="button"
                  variant="outline"
                >
                  Manage billing
                </Button>
              ) : (
                <>
                  <Button
                    disabled={checkoutPending !== null}
                    onClick={() => {
                      startCheckout("month").catch(() => {
                        toast.error("Could not start checkout.");
                      });
                    }}
                    type="button"
                  >
                    {checkoutPending === "month"
                      ? "Redirecting…"
                      : `Subscribe monthly · $${SEAT_PRICE_MONTHLY_USD}`}
                  </Button>
                  <Button
                    disabled={checkoutPending !== null}
                    onClick={() => {
                      startCheckout("year").catch(() => {
                        toast.error("Could not start checkout.");
                      });
                    }}
                    type="button"
                    variant="outline"
                  >
                    {checkoutPending === "year"
                      ? "Redirecting…"
                      : `Subscribe yearly · $${SEAT_PRICE_YEARLY_MONTHLY_USD}/mo`}
                  </Button>
                </>
              )}
            </div>
          </div>
          {subscription.isActive ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-border/60 border-t pt-3">
              <p className="text-muted-foreground text-xs">
                You have {billedSeats} paid seat
                {billedSeats === 1 ? "" : "s"}. Add more anytime — confirm in
                the app, charge the card on file.
              </p>
              <Button
                disabled={seatConfirmPending}
                onClick={openSeatDialog}
                type="button"
              >
                Add seats
              </Button>
            </div>
          ) : null}
        </div>
      </SettingsCard>

      <Dialog
        onOpenChange={(open) => {
          if (seatConfirmPending) {
            return;
          }
          setSeatDialogOpen(open);
          if (!open) {
            setSeatPreview(null);
            setSeatPreviewError(null);
          }
        }}
        open={seatDialogOpen}
      >
        <DialogContent
          className="gap-0 overflow-hidden rounded-lg p-0 sm:max-w-xl [&_button]:cursor-pointer"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader className="px-6 py-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <CreditCardIcon
                  aria-hidden="true"
                  className="size-6 shrink-0 text-foreground"
                />
                <ArrowLeftRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <SidebarAppLogo className="size-6! text-foreground" />
              </div>
              <div className="flex flex-col gap-0.5">
                <DialogTitle className="font-medium text-base leading-normal">
                  Add seats
                </DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground">
                  Extra seats are prorated for this billing period, then renew
                  at your plan rate.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="mx-6 h-px bg-border/60" />

          <div className="flex flex-col gap-5 px-6 py-6">
            <section className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="font-medium text-sm">Seats to add</h3>
                <p className="text-[13px] text-muted-foreground leading-snug">
                  {seatPreview
                    ? `${seatPreview.currentSeatQuantity} → ${seatPreview.quantity} paid seats`
                    : `Currently ${billedSeats} paid seat${billedSeats === 1 ? "" : "s"}`}
                </p>
              </div>
              <Input
                aria-label="Seats to add"
                className="h-8 w-24 shrink-0 rounded-lg"
                disabled={seatConfirmPending}
                id="dialog-seats-to-add"
                inputMode="numeric"
                min={1}
                onChange={(event) => {
                  setDialogSeatsToAdd(event.target.value);
                }}
                type="number"
                value={dialogSeatsToAdd}
              />
            </section>

            <section className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="font-medium text-sm">Payment method</h3>
                <button
                  className="inline-flex w-fit items-center gap-1 text-[13px] text-muted-foreground leading-snug underline-offset-2 hover:text-foreground hover:underline"
                  disabled={portalPending || seatConfirmPending}
                  onClick={() => {
                    openPortal("payment_method_update").catch(() => {
                      toast.error("Could not open payment methods.");
                    });
                  }}
                  type="button"
                >
                  <PlusIcon className="size-3.5" />
                  Add payment method
                </button>
              </div>
              <div className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 text-sm">
                {seatPreviewPending && !seatPreview ? (
                  <span className="text-muted-foreground">…</span>
                ) : seatPreview?.card ? (
                  <>
                    <CardBrandMark brand={seatPreview.card.brand} />
                    <span className="tabular-nums tracking-wide">
                      ···· {seatPreview.card.last4}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Card on file</span>
                )}
              </div>
            </section>

            <section className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="font-medium text-sm">Due today</h3>
                <p
                  className={cn(
                    "text-[13px] leading-snug",
                    seatPreviewError
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {seatPreviewError
                    ? seatPreviewError
                    : seatPreview && seatPreview.taxCents > 0
                      ? `Includes ${formatCents(seatPreview.taxCents, seatPreview.currency)} tax`
                      : "Prorated for the rest of this billing period."}
                </p>
              </div>
              <div className="shrink-0 font-medium text-sm tabular-nums">
                {seatPreviewPending
                  ? "…"
                  : seatPreview
                    ? formatCents(
                        seatPreview.amountDueCents,
                        seatPreview.currency
                      )
                    : "—"}
              </div>
            </section>
          </div>

          <div className="mx-6 h-px bg-border/60" />
          <DialogFooter className="gap-2 px-6 py-4 sm:justify-between">
            <div className="flex gap-2">
              <Button
                disabled={seatConfirmPending}
                onClick={() => setSeatDialogOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  seatConfirmPending ||
                  seatPreviewPending ||
                  !seatPreview ||
                  Boolean(seatPreviewError)
                }
                onClick={() => {
                  confirmBuySeats().catch(() => {
                    toast.error("Payment failed — seats were not added.");
                  });
                }}
                type="button"
              >
                {seatConfirmPending ? "Charging…" : "Continue"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (topUpConfirmPending) {
            return;
          }
          setTopUpDialogOpen(open);
          if (!open) {
            setTopUpPreview(null);
            setTopUpPreviewError(null);
          }
        }}
        open={topUpDialogOpen}
      >
        <DialogContent
          className="gap-0 overflow-hidden rounded-lg p-0 sm:max-w-xl [&_button]:cursor-pointer"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader className="px-6 py-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <CreditCardIcon
                  aria-hidden="true"
                  className="size-6 shrink-0 text-foreground"
                />
                <ArrowLeftRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <SidebarAppLogo className="size-6! text-foreground" />
              </div>
              <div className="flex flex-col gap-0.5">
                <DialogTitle className="font-medium text-base leading-normal">
                  Buy top-up
                </DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground">
                  Prepaid AI credits used after your included seat pool is
                  exhausted.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="mx-6 h-px bg-border/60" />

          <div className="flex flex-col gap-5 px-6 py-6">
            <section className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="font-medium text-sm">Amount to add</h3>
                <p className="text-[13px] text-muted-foreground leading-snug">
                  Whole dollars from ${MIN_TOP_UP_USD}. Current balance{" "}
                  {formatUsd(usage.topUpBalanceUsd)}.
                </p>
              </div>
              <Input
                aria-label="Top-up amount in dollars"
                className="h-8 w-28 shrink-0 rounded-lg"
                disabled={topUpConfirmPending}
                id="dialog-topup-amount"
                inputMode="numeric"
                min={MIN_TOP_UP_USD}
                onChange={(event) => {
                  setDialogTopUpDollars(event.target.value);
                }}
                type="number"
                value={dialogTopUpDollars}
              />
            </section>

            <section className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="font-medium text-sm">Payment method</h3>
                <button
                  className="inline-flex w-fit items-center gap-1 text-[13px] text-muted-foreground leading-snug underline-offset-2 hover:text-foreground hover:underline"
                  disabled={portalPending || topUpConfirmPending}
                  onClick={() => {
                    openPortal("payment_method_update").catch(() => {
                      toast.error("Could not open payment methods.");
                    });
                  }}
                  type="button"
                >
                  <PlusIcon className="size-3.5" />
                  Add payment method
                </button>
              </div>
              <div className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 text-sm">
                {topUpPreviewPending && !topUpPreview ? (
                  <span className="text-muted-foreground">…</span>
                ) : topUpPreview?.card ? (
                  <>
                    <CardBrandMark brand={topUpPreview.card.brand} />
                    <span className="tabular-nums tracking-wide">
                      ···· {topUpPreview.card.last4}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Card on file</span>
                )}
              </div>
            </section>

            <section className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="font-medium text-sm">Total</h3>
                <p
                  className={cn(
                    "text-[13px] leading-snug",
                    topUpPreviewError
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {topUpPreviewError
                    ? topUpPreviewError
                    : topUpPreview && topUpPreview.taxCents > 0
                      ? `Includes ${formatCents(topUpPreview.taxCents, topUpPreview.currency)} tax`
                      : `Adds $${dialogTopUpDollars || "0"} to prepaid balance.`}
                </p>
              </div>
              <div className="shrink-0 font-medium text-sm tabular-nums">
                {topUpPreviewPending
                  ? "…"
                  : topUpPreview
                    ? formatCents(
                        topUpPreview.amountDueCents,
                        topUpPreview.currency
                      )
                    : "—"}
              </div>
            </section>
          </div>

          <div className="mx-6 h-px bg-border/60" />
          <DialogFooter className="gap-2 px-6 py-4 sm:justify-between">
            <div className="flex gap-2">
              <Button
                disabled={topUpConfirmPending}
                onClick={() => setTopUpDialogOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  topUpConfirmPending ||
                  topUpPreviewPending ||
                  !topUpPreview ||
                  Boolean(topUpPreviewError)
                }
                onClick={() => {
                  confirmBuyTopUp().catch(() => {
                    toast.error("Payment failed — top-up was not added.");
                  });
                }}
                type="button"
              >
                {topUpConfirmPending ? "Charging…" : "Continue"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SettingsCard
        description="Included usage scales with paid seats. Admins can raise or lower a member’s personal quota."
        title="Included usage"
      >
        <div className="flex flex-col gap-3 px-1 pb-1">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="font-medium text-[15px] text-foreground">
                AI & web search
              </p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {usage.seatCount} paid seat{usage.seatCount === 1 ? "" : "s"} ×{" "}
                {formatUsd(perSeatUsd)} = {formatUsd(allowanceUsd)} workspace
                pool this period.
              </p>
            </div>
            <p
              className={cn(
                "shrink-0 font-medium text-sm tabular-nums",
                usage.atLimit
                  ? "text-destructive"
                  : usage.softWarn
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground"
              )}
            >
              {usage.percentUsed}% used
            </p>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                usage.atLimit
                  ? "bg-destructive"
                  : usage.softWarn
                    ? "bg-amber-500"
                    : "bg-foreground/80"
              )}
              style={{ width: barWidth }}
            />
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            {formatUsd(usage.usedUsd)} of {formatUsd(allowanceUsd)} estimated
            API usage this period. Resets {formatResetDate(usage.periodEnd)}.
            {usage.softWarn && !usage.atLimit
              ? " You’re nearing this period’s included limit."
              : null}
            {usage.atLimit && usage.topUpBalanceUsdCents <= 0
              ? " Included usage is exhausted — buy a top-up or wait for the next period."
              : null}
            {usage.atLimit && usage.topUpBalanceUsdCents > 0
              ? " Included usage is exhausted — further spend draws from your top-up balance."
              : null}
            {!usage.atLimit && usage.topUpBalanceUsdCents > 0
              ? ` Top-up backup: ${formatUsd(usage.topUpBalanceUsd)} ready when this pool runs out.`
              : null}
          </p>
        </div>
      </SettingsCard>

      <SettingsCard
        action={
          <Button
            disabled={!subscription.isActive || topUpConfirmPending}
            onClick={openTopUpDialog}
            size="sm"
            type="button"
          >
            Buy top-up
          </Button>
        }
        description={`Prepaid credits used after the included seat pool is exhausted. From $${MIN_TOP_UP_USD}.`}
        title="Top-up balance"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="font-medium text-sm">Prepaid AI credits</p>
              <p className="text-[13px] text-muted-foreground leading-snug tabular-nums">
                {formatUsd(usage.topUpBalanceUsd)} remaining ·{" "}
                {formatUsd(usage.overageUsd)} used this period
                {subscription.isActive
                  ? ""
                  : " · subscribe before buying a top-up"}
              </p>
            </div>
            <p
              className={cn(
                "shrink-0 font-medium text-sm tabular-nums",
                topUpAtLimit
                  ? "text-destructive"
                  : topUpSoftWarn
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground"
              )}
            >
              {topUpPercentUsed}% used
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                topUpAtLimit
                  ? "bg-destructive"
                  : topUpSoftWarn
                    ? "bg-amber-500"
                    : "bg-foreground/80"
              )}
              style={{ width: topUpBarWidth }}
            />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        description="Default quota is the per-seat amount. Custom quotas must stay within the workspace pool — raise one member only if you lower another."
        title="Per-seat quotas"
      >
        <div className="flex flex-col gap-2 px-1 pb-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              className={cn(
                "text-xs tabular-nums",
                overAllocated ? "text-destructive" : "text-muted-foreground"
              )}
            >
              Allocated {formatUsd(allocatedUsd)} of {formatUsd(allowanceUsd)}{" "}
              pool
              {overAllocated
                ? " — over allocated. Reset all to seat defaults."
                : "."}
            </p>
            {hasCustomQuotas ? (
              <Button
                className="h-7 px-2 text-xs"
                disabled={resetting}
                onClick={() => {
                  resetAllQuotas().catch(() => {
                    toast.error("Could not reset quotas.");
                  });
                }}
                type="button"
                variant="outline"
              >
                Reset all to defaults
              </Button>
            ) : null}
          </div>
          <ul className="flex flex-col gap-2">
            {usage.members.map((member) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2"
                key={member.authUserId}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">
                    {memberLabel(member)}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatUsd(member.usedUsd)} of{" "}
                    {formatUsd(member.quotaUsdCents / 100)}
                    {member.isCustomQuota ? " · custom" : " · seat default"}
                    {" · "}
                    {member.percentUsed}%
                  </p>
                </div>
                <MemberQuotaEditor
                  member={member}
                  tenantSlug={usage.tenantSlug}
                />
              </li>
            ))}
          </ul>
        </div>
      </SettingsCard>

      <SettingsCard
        description="Raw metering for the current billing period."
        title="This period"
      >
        <dl className="grid grid-cols-2 gap-3 px-1 pb-1 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <dt className="text-muted-foreground text-xs">Events</dt>
            <dd className="font-medium text-sm tabular-nums">
              {usage.eventCount}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Input tokens</dt>
            <dd className="font-medium text-sm tabular-nums">
              {usage.inputTokens.toLocaleString("en-US")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Output tokens</dt>
            <dd className="font-medium text-sm tabular-nums">
              {usage.outputTokens.toLocaleString("en-US")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Web searches</dt>
            <dd className="font-medium text-sm tabular-nums">
              {usage.webSearchCount.toLocaleString("en-US")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Images generated</dt>
            <dd className="font-medium text-sm tabular-nums">
              {usage.imageGenerationCount.toLocaleString("en-US")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Sandbox runs</dt>
            <dd className="font-medium text-sm tabular-nums">
              {usage.sandboxExecCount.toLocaleString("en-US")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Sandbox runtime</dt>
            <dd className="font-medium text-sm tabular-nums">
              {(usage.sandboxExecDurationMs / 1000).toLocaleString("en-US", {
                maximumFractionDigits: 1,
              })}
              s
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Top-up remaining</dt>
            <dd className="font-medium text-sm tabular-nums">
              {formatUsd(usage.topUpBalanceUsd)}
            </dd>
          </div>
        </dl>
      </SettingsCard>
    </div>
  );
}
