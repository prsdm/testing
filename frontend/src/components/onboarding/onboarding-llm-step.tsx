"use client";

import { useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { ProviderSetupDialog } from "@/components/admin/llm-models-settings";
import { ModelSelectorLogo } from "@/components/ai-elements/model-selector";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import { Button } from "@/components/ui/button";
import type { TenantLlmAdminView } from "@/contracts/admin";
import { chatModelsApiUrl } from "@/lib/ai/chat-models-api";
import {
  LLM_PROVIDER_CATALOG,
  WELL_KNOWN_LLM_PROVIDERS,
  type WellKnownLlmProvider,
} from "@/shared/ai/llm-providers";

export function OnboardingLlmStep({
  active,
  onProvidersUpdated,
}: {
  active: boolean;
  onProvidersUpdated: () => void;
}) {
  const tenantSlug = useTenantSlug();
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const { mutate } = useSWRConfig();
  const [activeProvider, setActiveProvider] =
    useState<WellKnownLlmProvider | null>(null);

  const { data: adminView, mutate: mutateAdminView } =
    useSWR<TenantLlmAdminView>(
      active ? `${basePath}/api/admin/${tenantSlug}/models` : null,
      (url: string) => fetch(url).then((response) => response.json())
    );

  const providerMap = useMemo(() => {
    const map = new Map<
      WellKnownLlmProvider,
      TenantLlmAdminView["providers"][number]
    >();
    for (const provider of adminView?.providers ?? []) {
      map.set(provider.provider, provider);
    }
    return map;
  }, [adminView?.providers]);

  if (!active) {
    return null;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {WELL_KNOWN_LLM_PROVIDERS.map((provider) => {
          const row = providerMap.get(provider);
          const catalog = LLM_PROVIDER_CATALOG[provider];
          const configured = row?.configured ?? false;

          return (
            <div
              className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/80 px-2.5 py-2"
              key={provider}
            >
              <div className="flex min-w-0 items-center gap-2">
                <ModelSelectorLogo
                  className="size-4 shrink-0"
                  provider={provider}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm leading-tight">
                    {catalog.productName}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {catalog.companyName}
                    {configured ? " · Connected" : ""}
                  </p>
                </div>
              </div>
              <Button
                className="h-7 shrink-0 px-2.5 text-xs"
                onClick={() => setActiveProvider(provider)}
                size="sm"
                type="button"
                variant={configured ? "outline" : "default"}
              >
                {configured ? "Update" : "Connect"}
              </Button>
            </div>
          );
        })}
      </div>

      {activeProvider ? (
        <ProviderSetupDialog
          initial={providerMap.get(activeProvider) ?? null}
          onOpenChange={(open) => {
            if (!open) {
              setActiveProvider(null);
            }
          }}
          onUpdated={async (view) => {
            await mutateAdminView(view, false);
            await mutate(chatModelsApiUrl(tenantSlug));
            onProvidersUpdated();
            setActiveProvider(null);
          }}
          open
          provider={activeProvider}
          tenantSlug={tenantSlug}
        />
      ) : null}
    </>
  );
}
