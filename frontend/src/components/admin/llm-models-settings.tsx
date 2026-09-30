"use client";

import { ArrowLeftRight, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { AdminListChevronButton } from "@/components/admin/admin-list-chevron-button";
import { AdminListItemLogoFrame } from "@/components/admin/admin-list-item-logo-frame";
import { StatusBanner } from "@/components/admin/status-banner";
import { ModelSelectorLogo } from "@/components/ai-elements/model-selector";
import { SidebarAppLogo } from "@/components/chat/sidebar-app-logo";
import {
  IntegrationStatusChip,
  NotConfiguredStatusChip,
} from "@/components/integrations/integration-status-chip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { TenantUsersPagination } from "@/components/users/tenant-users-pagination";
import type { TenantLlmAdminView } from "@/contracts/admin";
import { chatModelsApiUrl } from "@/lib/ai/chat-models-api";
import {
  catalogModelsForProvider,
  formatProviderModelName,
  isUsingStoredApiKey,
  LLM_PROVIDER_CATALOG,
  WELL_KNOWN_LLM_PROVIDERS,
  type WellKnownLlmProvider,
} from "@/shared/ai/llm-providers";
import { titleModel } from "@/shared/ai/models";
import { cn } from "@/shared/utils";

const PROVIDERS_PAGE_SIZE = 6;

type ProviderRow = TenantLlmAdminView["providers"][number];

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 12"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Show API key</title>
      <path
        d="M1 6.00088C1 6.00088 3.54545 0.909973 8 0.909973C12.4545 0.909973 15 6.00088 15 6.00088C15 6.00088 12.4545 11.0918 8 11.0918C3.54545 11.0918 1 6.00088 1 6.00088Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
      <path
        d="M8 7.90997C9.05436 7.90997 9.90909 7.05524 9.90909 6.00088C9.90909 4.94652 9.05436 4.09179 8 4.09179C6.94564 4.09179 6.09091 4.94652 6.09091 6.00088C6.09091 7.05524 6.94564 7.90997 8 7.90997Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function EyeClosedIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 10"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Hide API key</title>
      <path
        d="M1 1.5C1 1.5 1.69706 2.89413 3 4.22328M15 1.5C15 1.5 14.3029 2.89413 13 4.22328M3 4.22328C3.78612 5.02522 4.7928 5.80351 6 6.23767M3 4.22328L1 6.22328M6 6.23767C6.61544 6.45901 7.28299 6.59091 8 6.59091C8.71701 6.59091 9.38456 6.45901 10 6.23767M6 6.23767L5 8.99908M10 6.23767C11.2072 5.80351 12.2139 5.02522 13 4.22328M10 6.23767L11 8.99908M13 4.22328L15 6.22328"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </svg>
  );
}

type ProviderModelOption = {
  configurationId?: string;
  modelId: string;
  label: string;
};

function buildProviderModelOptions(
  provider: WellKnownLlmProvider,
  initial: ProviderRow | null
): ProviderModelOption[] {
  const configuredModels = new Map(
    (initial?.models ?? []).map((model) => [model.modelId, model] as const)
  );

  return catalogModelsForProvider(provider)
    .filter((model) => model.id !== titleModel.id)
    .map((model) => {
      const configured = configuredModels.get(model.id);
      return {
        configurationId: configured?.id,
        label: formatProviderModelName(
          provider,
          configured?.displayName ?? model.name
        ),
        modelId: model.id,
      };
    });
}

export function ProviderSetupDialog({
  tenantSlug,
  provider,
  initial,
  open,
  onOpenChange,
  onUpdated,
  onRemove,
}: {
  tenantSlug: string;
  provider: WellKnownLlmProvider;
  initial: ProviderRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (view: TenantLlmAdminView) => void;
  onRemove?: () => void;
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const catalog = LLM_PROVIDER_CATALOG[provider];
  const modelOptions = useMemo(
    () => buildProviderModelOptions(provider, initial),
    [initial, provider]
  );
  const storedKeyHint = initial?.keyHint ?? null;
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelVisibility, setModelVisibility] = useState<
    Record<string, boolean>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(storedKeyHint ?? "");
    setShowApiKey(false);
    setConnectError(null);
    setError(null);
  }, [storedKeyHint]);

  const initialModelVisibility = useMemo(
    () =>
      Object.fromEntries(
        modelOptions.map((model) => [
          model.modelId,
          initial?.models.find((entry) => entry.modelId === model.modelId)
            ?.isVisible ?? true,
        ])
      ),
    [initial, modelOptions]
  );

  useEffect(() => {
    setModelVisibility(initialModelVisibility);
  }, [initialModelVisibility]);

  const allModelsSelected = modelOptions.every(
    (model) => modelVisibility[model.modelId] !== false
  );

  const isEditing = Boolean(initial?.configured);
  const keepStoredKey = isUsingStoredApiKey(apiKey, isEditing, storedKeyHint);
  const hasModelVisibilityChanges = modelOptions.some((model) => {
    const nextVisible = modelVisibility[model.modelId] !== false;
    const initialVisible = initialModelVisibility[model.modelId] !== false;
    return nextVisible !== initialVisible;
  });
  const hasPendingChanges = isEditing
    ? !keepStoredKey || hasModelVisibilityChanges
    : Boolean(apiKey.trim());
  const isPrimaryActionDisabled = isSaving || !hasPendingChanges;

  async function applyModelVisibility(
    view: TenantLlmAdminView,
    visibilityByModelId: Record<string, boolean>
  ) {
    const providerRow = view.providers.find(
      (entry) => entry.provider === provider
    );
    if (!providerRow) {
      return view;
    }

    const updates = providerRow.models
      .filter((model) => model.modelId !== titleModel.id)
      .filter((model) => {
        const nextVisible = visibilityByModelId[model.modelId] !== false;
        return model.isVisible !== nextVisible;
      })
      .map((model) => ({
        configurationId: model.id,
        isVisible: visibilityByModelId[model.modelId] !== false,
      }));

    if (updates.length === 0) {
      return view;
    }

    const response = await fetch(`/api/admin/${tenantSlug}/models`, {
      body: JSON.stringify({ modelVisibility: updates }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    if (!response.ok) {
      return view;
    }

    const nextView = (await response.json()) as TenantLlmAdminView;
    await mutate(chatModelsApiUrl(tenantSlug));
    return nextView;
  }

  async function saveProvider() {
    const trimmedApiKey = apiKey.trim();
    const keepStoredKey = isUsingStoredApiKey(
      apiKey,
      Boolean(initial?.configured),
      storedKeyHint
    );

    if (!trimmedApiKey && !initial?.configured) {
      setError("API key is required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setConnectError(null);

    const response = await fetch(
      `/api/admin/${tenantSlug}/models/providers/${provider}`,
      {
        body: JSON.stringify({
          ...(keepStoredKey ? {} : { apiKey: trimmedApiKey }),
          testConnection: true,
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
        error?: string;
      } | null;
      if (payload?.code === "REAUTH_REQUIRED") {
        window.location.assign("/login?reason=reauth");
        setIsSaving(false);
        return;
      }
      if (response.status === 400) {
        setConnectError("Please check your API key.");
      } else {
        setError(payload?.error ?? "Failed to save provider settings.");
      }
      setIsSaving(false);
      return;
    }

    let view = (await response.json()) as TenantLlmAdminView;
    view = await applyModelVisibility(view, modelVisibility);

    await mutate(chatModelsApiUrl(tenantSlug));
    onUpdated(view);
    setApiKey("");
    setIsSaving(false);
    onOpenChange(false);
    router.refresh();
  }

  function toggleAllModels(nextValue: boolean) {
    setModelVisibility(
      Object.fromEntries(
        modelOptions.map((model) => [model.modelId, nextValue])
      )
    );
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-lg p-0 sm:max-w-xl [&_button]:cursor-pointer"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="px-6 py-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ModelSelectorLogo
                className="size-6 shrink-0"
                provider={provider}
              />
              <ArrowLeftRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <SidebarAppLogo className="size-6! text-foreground" />
            </div>
            <div className="flex flex-col gap-0.5">
              <DialogTitle className="font-medium text-base leading-normal">
                {isEditing
                  ? `Update ${catalog.productName}`
                  : `Set up ${catalog.productName}`}
              </DialogTitle>
              <DialogDescription className="text-[13px] text-muted-foreground">
                {isEditing
                  ? `Update ${catalog.companyName} key for your ${catalog.productName} models.`
                  : `Connect to ${catalog.companyName} and set up your ${catalog.productName} models.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="mx-6 h-px bg-border/60" />

        <div className="flex flex-col px-6 py-6">
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="font-medium text-sm">API Key</h3>
              <p className="text-[13px] text-muted-foreground">
                Paste your API key from {catalog.companyName} to access your
                models.
              </p>
            </div>
            <div className="relative">
              <Input
                autoComplete="off"
                className="rounded-lg pr-10"
                id={`${provider}-api-key`}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setConnectError(null);
                }}
                type={showApiKey ? "text" : "password"}
                value={apiKey}
              />
              {apiKey ? (
                <Button
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                  className={cn(
                    "absolute top-1/2 right-1 size-8 -translate-y-1/2 active:-translate-y-1/2",
                    showApiKey
                      ? "text-foreground hover:text-foreground/80"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setShowApiKey((current) => !current)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <span className="flex size-4 items-center justify-center">
                    {showApiKey ? (
                      <EyeIcon className="size-4" />
                    ) : (
                      <EyeClosedIcon className="size-4" />
                    )}
                  </span>
                </Button>
              ) : null}
            </div>
          </section>

          {modelOptions.length > 0 ? (
            <>
              <div className="my-8 h-px bg-border/60" />
              <section className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-medium text-sm">Models</h3>
                    <Button
                      className="h-auto shrink-0 px-0 text-muted-foreground text-sm hover:bg-transparent hover:text-muted-foreground dark:hover:bg-transparent"
                      disabled={isSaving}
                      onClick={() => toggleAllModels(!allModelsSelected)}
                      type="button"
                      variant="ghost"
                    >
                      {allModelsSelected ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    Select models to make available for your organization.
                  </p>
                </div>
                <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                  {modelOptions.map((model) => {
                    const isSelected = modelVisibility[model.modelId] !== false;

                    return (
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                          isSelected
                            ? "bg-muted/50 text-foreground"
                            : "text-foreground hover:bg-background/70"
                        )}
                        key={model.modelId}
                      >
                        <input
                          checked={isSelected}
                          className="size-4 shrink-0 cursor-pointer rounded border-border accent-foreground disabled:cursor-not-allowed"
                          disabled={isSaving}
                          onChange={(event) => {
                            const isVisible = event.target.checked;
                            setModelVisibility((current) => ({
                              ...current,
                              [model.modelId]: isVisible,
                            }));
                          }}
                          type="checkbox"
                        />
                        <span className="font-medium text-foreground text-sm">
                          {model.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            </>
          ) : null}

          {connectError ? (
            <div className="mt-8">
              <StatusBanner variant="error">{connectError}</StatusBanner>
            </div>
          ) : null}

          {error ? (
            <p className="mt-8 text-destructive text-sm">{error}</p>
          ) : null}
        </div>

        <div className="mx-6 h-px bg-border/60" />
        <DialogFooter className="gap-2 px-6 py-4 sm:justify-between">
          <div className="flex gap-2">
            <Button
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isPrimaryActionDisabled}
              onClick={saveProvider}
              type="button"
            >
              {isSaving
                ? isEditing
                  ? "Updating..."
                  : "Connecting..."
                : isEditing
                  ? "Update"
                  : "Connect"}
            </Button>
          </div>
          {isEditing && onRemove ? (
            <Button
              className="bg-transparent hover:bg-muted/50"
              disabled={isSaving}
              onClick={onRemove}
              type="button"
              variant="outline"
            >
              Remove provider
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DefaultStatusChip() {
  return (
    <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-[10px] text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
      Default
    </span>
  );
}

function providerEnabledModelCounts(row: ProviderRow) {
  const chatModels = row.models.filter(
    (model) => model.modelId !== titleModel.id
  );
  return {
    enabled: chatModels.filter((model) => model.isVisible).length,
    total: chatModels.length,
  };
}

function getProviderEnabledModelCounts(
  provider: WellKnownLlmProvider,
  row?: ProviderRow | null
) {
  const catalogTotal = catalogModelsForProvider(provider).filter(
    (model) => model.id !== titleModel.id
  ).length;

  if (row?.configured && row.models.length > 0) {
    return providerEnabledModelCounts(row);
  }

  return { enabled: 0, total: catalogTotal };
}

function ProviderEnabledCountBadge({
  enabled,
  total,
}: {
  enabled: number;
  total: number;
}) {
  return (
    <span className="shrink-0 rounded-md bg-muted/60 px-2 py-0.5 text-[12px] text-muted-foreground">
      {enabled}/{total} enabled
    </span>
  );
}

function ProviderListRow({
  provider,
  row,
  isDefault = false,
  onClick,
}: {
  provider: WellKnownLlmProvider;
  row?: ProviderRow | null;
  isDefault?: boolean;
  onClick: () => void;
}) {
  const catalog = LLM_PROVIDER_CATALOG[provider];
  const label = catalog.productName;
  const description = catalog.description;
  const enabledCounts = getProviderEnabledModelCounts(provider, row);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <AdminListItemLogoFrame>
          <ModelSelectorLogo
            className="size-full max-h-6 max-w-6 shrink-0 object-contain"
            provider={provider}
          />
        </AdminListItemLogoFrame>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{label}</span>
            {row?.configured ? (
              isDefault ? (
                <DefaultStatusChip />
              ) : (
                <IntegrationStatusChip label="Active" />
              )
            ) : (
              <NotConfiguredStatusChip />
            )}
          </span>
          <span className="block truncate text-[13px] text-muted-foreground leading-snug">
            {description}
          </span>
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        <ProviderEnabledCountBadge
          enabled={enabledCounts.enabled}
          total={enabledCounts.total}
        />
        <AdminListChevronButton
          label={`Configure ${label}`}
          onClick={onClick}
        />
      </span>
    </div>
  );
}

export function LlmModelsSettings({
  tenantSlug,
  initialView,
}: {
  tenantSlug: string;
  initialView: TenantLlmAdminView;
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [view, setView] = useState(initialView);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [removeAllOpen, setRemoveAllOpen] = useState(false);
  const [isRemovingAll, setIsRemovingAll] = useState(false);
  const [activeProvider, setActiveProvider] =
    useState<WellKnownLlmProvider | null>(null);
  const [providerToRemove, setProviderToRemove] =
    useState<WellKnownLlmProvider | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const providerMap = useMemo(() => {
    const map = new Map<WellKnownLlmProvider, ProviderRow>();
    for (const provider of view.providers) {
      map.set(provider.provider, provider);
    }
    return map;
  }, [view.providers]);

  const configuredProviders = useMemo(
    () =>
      WELL_KNOWN_LLM_PROVIDERS.filter(
        (provider) => providerMap.get(provider)?.configured
      ),
    [providerMap]
  );

  const filteredProviders = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return [...WELL_KNOWN_LLM_PROVIDERS];
    }
    return WELL_KNOWN_LLM_PROVIDERS.filter((provider) => {
      const catalog = LLM_PROVIDER_CATALOG[provider];
      const haystack = [
        catalog.productName,
        catalog.companyName,
        catalog.description,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProviders.length / PROVIDERS_PAGE_SIZE)
  );
  const showPagination = filteredProviders.length > PROVIDERS_PAGE_SIZE;

  const paginatedProviders = useMemo(() => {
    if (!showPagination) {
      return filteredProviders;
    }
    const start = (page - 1) * PROVIDERS_PAGE_SIZE;
    return filteredProviders.slice(start, start + PROVIDERS_PAGE_SIZE);
  }, [filteredProviders, page, showPagination]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const defaultModels = view.availableChatModels;

  const effectiveDefaultModelId = defaultModels.some(
    (model) => model.id === view.defaults.defaultChatModelId
  )
    ? (view.defaults.defaultChatModelId ?? "")
    : (defaultModels[0]?.id ?? "");

  const defaultProvider = defaultModels.find(
    (model) => model.id === effectiveDefaultModelId
  )?.provider;

  async function removeProvider(provider: WellKnownLlmProvider) {
    setIsRemoving(true);

    const response = await fetch(
      `/api/admin/${tenantSlug}/models/providers/${provider}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      setIsRemoving(false);
      setProviderToRemove(null);
      return;
    }

    const nextView = (await response.json()) as TenantLlmAdminView;
    setView(nextView);
    setIsRemoving(false);
    setProviderToRemove(null);
    await mutate(chatModelsApiUrl(tenantSlug));
    router.refresh();
  }

  async function removeAllProviders() {
    if (configuredProviders.length === 0) {
      return;
    }

    setIsRemovingAll(true);
    const results = await Promise.all(
      configuredProviders.map(async (provider) => {
        const response = await fetch(
          `/api/admin/${tenantSlug}/models/providers/${provider}`,
          { method: "DELETE" }
        );
        return { ok: response.ok, provider };
      })
    );

    const failed = results.filter((result) => !result.ok);
    if (failed.length > 0) {
      toast.error("Some providers could not be removed.");
      setIsRemovingAll(false);
      return;
    }

    const response = await fetch(`/api/admin/${tenantSlug}/models`);
    if (response.ok) {
      setView((await response.json()) as TenantLlmAdminView);
    }
    setRemoveAllOpen(false);
    setIsRemovingAll(false);
    await mutate(chatModelsApiUrl(tenantSlug));
    toast.success("All providers removed.");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 rounded-lg bg-transparent pl-9"
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search providers…"
              value={searchQuery}
            />
          </div>
          {configuredProviders.length > 0 ? (
            <Button
              className="cursor-pointer bg-transparent hover:bg-muted/50"
              disabled={isRemovingAll}
              onClick={() => setRemoveAllOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              Remove all
            </Button>
          ) : null}
        </div>

        {filteredProviders.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            No providers match your search.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60">
            {paginatedProviders.map((provider, index) => {
              const row = providerMap.get(provider);

              return (
                <div
                  className={cn(index > 0 && "border-border/60 border-t")}
                  key={provider}
                >
                  <ProviderListRow
                    isDefault={
                      Boolean(row?.configured) && defaultProvider === provider
                    }
                    onClick={() => setActiveProvider(provider)}
                    provider={provider}
                    row={row}
                  />
                </div>
              );
            })}
          </div>
        )}

        {showPagination ? (
          <TenantUsersPagination
            align="center"
            currentPage={page}
            onPageChange={setPage}
            totalPages={totalPages}
          />
        ) : null}
      </div>

      {activeProvider ? (
        <ProviderSetupDialog
          initial={providerMap.get(activeProvider) ?? null}
          key={activeProvider}
          onOpenChange={(open) => {
            if (!open) {
              setActiveProvider(null);
            }
          }}
          onRemove={
            providerMap.get(activeProvider)?.configured
              ? () => {
                  setProviderToRemove(activeProvider);
                  setActiveProvider(null);
                }
              : undefined
          }
          onUpdated={(nextView) => {
            setView(nextView);
            setActiveProvider(null);
          }}
          open
          provider={activeProvider}
          tenantSlug={tenantSlug}
        />
      ) : null}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setProviderToRemove(null);
          }
        }}
        open={providerToRemove !== null}
      >
        <AlertDialogContent className="[&_button]:cursor-pointer">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove{" "}
              {providerToRemove
                ? LLM_PROVIDER_CATALOG[providerToRemove].productName
                : "provider"}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Models from this provider will no longer be available for chat.
              Chat history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRemoving || providerToRemove === null}
              onClick={(event) => {
                event.preventDefault();
                if (providerToRemove) {
                  removeProvider(providerToRemove).catch(() => undefined);
                }
              }}
              type="button"
            >
              {isRemoving ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog onOpenChange={setRemoveAllOpen} open={removeAllOpen}>
        <AlertDialogContent className="[&_button]:cursor-pointer">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove all providers?</AlertDialogTitle>
            <AlertDialogDescription>
              Models from every provider will no longer be available for chat.
              Chat history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingAll} type="button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isRemovingAll}
              onClick={(event) => {
                event.preventDefault();
                removeAllProviders().catch(() => undefined);
              }}
              type="button"
            >
              {isRemovingAll ? "Removing…" : "Remove all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
