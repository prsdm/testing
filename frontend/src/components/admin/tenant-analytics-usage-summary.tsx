"use client";

import Link from "next/link";
import { SettingsCard } from "@/components/admin/settings-card";
import { Button } from "@/components/ui/button";

export type TenantAnalyticsUsageSummary = {
  usedUsd: number;
  percentUsed: number;
  softWarn: boolean;
  atLimit: boolean;
  inputTokens: number;
  outputTokens: number;
  eventCount: number;
  webSearchCount: number;
  imageGenerationCount: number;
  sandboxExecCount: number;
  periodEnd: string;
};

function formatTokenCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat(undefined, {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

export function TenantAnalyticsUsageSummary({
  usage,
  canViewBilling,
}: {
  usage: TenantAnalyticsUsageSummary;
  canViewBilling: boolean;
}) {
  const periodEndLabel = new Date(usage.periodEnd).toLocaleDateString(
    undefined,
    { day: "numeric", month: "short", year: "numeric" }
  );

  const usageDescription = `${formatUsd(usage.usedUsd)} estimated · ${Math.round(usage.percentUsed)}% of allowance · period ends ${periodEndLabel}`;

  return (
    <div className="flex flex-col gap-3">
      <SettingsCard
        action={
          canViewBilling ? (
            <Button
              asChild
              className="cursor-pointer"
              size="sm"
              variant="outline"
            >
              <Link href="/admin/billing">Billing details</Link>
            </Button>
          ) : null
        }
        description={usageDescription}
        title="AI usage (current period)"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Input tokens"
          value={formatTokenCount(usage.inputTokens)}
        />
        <MetricCard
          label="Output tokens"
          value={formatTokenCount(usage.outputTokens)}
        />
        <MetricCard label="Chat events" value={String(usage.eventCount)} />
        <MetricCard label="Web searches" value={String(usage.webSearchCount)} />
        <MetricCard
          label="Image generations"
          value={String(usage.imageGenerationCount)}
        />
        <MetricCard
          label="Sandbox runs"
          value={String(usage.sandboxExecCount)}
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 px-4 py-3">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="font-medium text-lg tabular-nums">{value}</p>
    </div>
  );
}
