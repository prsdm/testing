"use client";

import Link from "next/link";
import useSWR from "swr";
import { useHasCapability } from "@/components/providers/tenant-provider";
import { fetcher } from "@/shared/utils";

export const FREE_TRIAL_API_URL = `${process.env.KIMIRO_BASE_PATH ?? ""}/api/free-trial`;

export type FreeTrialStatusResponse =
  | { active: false }
  | {
      active: true;
      used: number;
      remaining: number;
      limit: number;
      exhausted: boolean;
    };

export function FreeTrialQueryCounter() {
  const canManageBilling = useHasCapability("admin.billing");
  const { data } = useSWR<FreeTrialStatusResponse>(
    FREE_TRIAL_API_URL,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  if (!data?.active) {
    return null;
  }

  const subscribeLink = canManageBilling ? (
    <>
      {" · "}
      <Link
        className="underline decoration-foreground/30 underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground/60"
        href="/admin/billing"
      >
        Subscribe
      </Link>
    </>
  ) : null;

  if (data.exhausted) {
    return (
      <p className="mb-2 text-center text-muted-foreground text-xs">
        Free trial ended — {data.limit} of {data.limit} queries used
        {subscribeLink}
      </p>
    );
  }

  const queryLabel = data.remaining === 1 ? "query" : "queries";

  return (
    <p className="mb-2 text-center text-muted-foreground text-xs">
      Free trial · {data.remaining} of {data.limit} {queryLabel} left
      {subscribeLink}
    </p>
  );
}
