"use client";

import {
  ArrowLeftRight,
  ChevronDown,
  GlobeIcon,
  SearchIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminListChevronButton } from "@/components/admin/admin-list-chevron-button";
import { AdminListItemLogoFrame } from "@/components/admin/admin-list-item-logo-frame";
import { StatusBanner } from "@/components/admin/status-banner";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type {
  TenantWebSearchAdminView,
  WebSearchProviderView,
} from "@/contracts/admin";
import { isUsingStoredApiKey } from "@/shared/ai/llm-providers";
import { cn } from "@/shared/utils";
import {
  SEARCH_PROVIDERS,
  type WebSearchProviderMetadata,
  type WebSearchProviderType,
} from "@/shared/web-search/providers";

const settingsDropdownRadioItemClassName =
  "rounded-lg pr-3 [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden data-[state=checked]:bg-muted/50 data-[state=checked]:text-foreground data-[state=checked]:focus:bg-muted/50 data-[state=checked]:focus:text-foreground data-[state=checked]:[&_svg]:text-foreground";

function findProvider(
  providers: WebSearchProviderView[],
  providerType: string
): WebSearchProviderView | null {
  return (
    providers.find((provider) => provider.providerType === providerType) ?? null
  );
}

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

function WebProviderLogo({
  providerType,
  className,
}: {
  providerType: string;
  className?: string;
}) {
  if (providerType === "serper") {
    return (
      <Image
        alt=""
        className={cn("size-5 shrink-0 rounded-sm", className)}
        height={20}
        src="https://www.google.com/s2/favicons?domain=serper.dev&sz=64"
        unoptimized
        width={20}
      />
    );
  }

  if (providerType === "tavily") {
    return (
      <Image
        alt=""
        className={cn("size-5 shrink-0 rounded-sm", className)}
        height={20}
        src="https://www.google.com/s2/favicons?domain=tavily.com&sz=64"
        unoptimized
        width={20}
      />
    );
  }

  if (providerType === "exa") {
    return (
      <Image
        alt=""
        className={cn("size-5 shrink-0 rounded-sm", className)}
        height={20}
        src="https://www.google.com/s2/favicons?domain=exa.ai&sz=64"
        unoptimized
        width={20}
      />
    );
  }

  if (providerType === "brave") {
    const isLarge = className?.includes("size-6");
    return (
      <Image
        alt=""
        className={cn(
          "shrink-0 object-contain",
          isLarge ? "h-6 w-auto max-w-6" : "h-5 w-auto max-w-5"
        )}
        height={150}
        src="/logos/brave.png"
        width={128}
      />
    );
  }

  return (
    <GlobeIcon
      aria-hidden="true"
      className={cn("size-5 shrink-0 text-muted-foreground", className)}
    />
  );
}

function SearchProviderSetupDialog({
  tenantSlug,
  provider,
  initial,
  open,
  onOpenChange,
  onUpdated,
  onRemove,
}: {
  tenantSlug: string;
  provider: WebSearchProviderType;
  initial: WebSearchProviderView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (view: TenantWebSearchAdminView) => void;
  onRemove?: () => void;
}) {
  const router = useRouter();
  const catalog = SEARCH_PROVIDERS.find((entry) => entry.type === provider);
  const storedKeyHint = initial?.keyHint ?? null;
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(storedKeyHint ?? "");
    setShowApiKey(false);
    setConnectError(null);
    setError(null);
  }, [storedKeyHint]);

  const isEditing = Boolean(initial?.configured);
  const keepStoredKey = isUsingStoredApiKey(apiKey, isEditing, storedKeyHint);
  const hasPendingChanges = isEditing ? !keepStoredKey : Boolean(apiKey.trim());
  const isPrimaryActionDisabled = isSaving || !hasPendingChanges;

  async function saveProvider() {
    const trimmedApiKey = apiKey.trim();
    const keepStored = isUsingStoredApiKey(
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

    const response = await fetch(`/api/admin/${tenantSlug}/web-search`, {
      body: JSON.stringify({
        category: "search",
        providerType: provider,
        ...(keepStored ? {} : { apiKey: trimmedApiKey }),
        activate: true,
        testConnection: true,
      }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (response.status === 400) {
        setConnectError("Please check your API key.");
      } else {
        setError(payload?.error ?? "Failed to save provider settings.");
      }
      setIsSaving(false);
      return;
    }

    const nextView = (await response.json()) as TenantWebSearchAdminView;
    onUpdated(nextView);
    setApiKey("");
    setIsSaving(false);
    onOpenChange(false);
    router.refresh();
    toast.success(
      isEditing ? "Search provider updated." : "Search provider connected."
    );
  }

  if (!catalog) {
    return null;
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
              <WebProviderLogo className="size-6!" providerType={provider} />
              <ArrowLeftRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <SidebarAppLogo className="size-6! text-foreground" />
            </div>
            <div className="flex flex-col gap-0">
              <DialogTitle className="font-medium text-base leading-normal">
                {isEditing
                  ? `Update ${catalog.label}`
                  : `Set up ${catalog.label}`}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground">
                {isEditing
                  ? `Update your ${catalog.subtitle} API key for web search.`
                  : `Connect ${catalog.subtitle} so Kimiro can search the web.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="mx-6 h-px bg-border/60" />

        <div className="flex flex-col px-6 py-6">
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-0">
              <h3 className="font-medium text-sm">API Key</h3>
              <p className="text-[12px] text-muted-foreground">
                Paste your API key from {catalog.subtitle}. It is stored
                encrypted and never shown again.
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
            {catalog.apiKeyUrl ? (
              <a
                className="text-[12px] text-muted-foreground underline"
                href={catalog.apiKeyUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Get a {catalog.label} API key
              </a>
            ) : null}
          </section>

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

function DefaultSearchEngineSelector({
  providers,
  value,
  disabled = false,
  onChange,
}: {
  providers: { type: WebSearchProviderType; label: string }[];
  value: string;
  disabled?: boolean;
  onChange: (providerType: WebSearchProviderType) => void;
}) {
  if (providers.length === 0 || !value) {
    return null;
  }

  const selected = providers.find((provider) => provider.type === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="bg-transparent hover:bg-muted/50 aria-expanded:bg-muted/50"
          disabled={disabled}
          size="sm"
          type="button"
          variant="outline"
        >
          {selected ? (
            <span className="flex items-center gap-2">
              <WebProviderLogo providerType={selected.type} />
              {selected.label}
            </span>
          ) : null}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-32 **:data-[slot=dropdown-menu-radio-item]:cursor-pointer"
      >
        <DropdownMenuRadioGroup
          onValueChange={(nextValue) => {
            onChange(nextValue as WebSearchProviderType);
          }}
          value={value}
        >
          {providers.map((provider) => (
            <DropdownMenuRadioItem
              className={settingsDropdownRadioItemClassName}
              key={provider.type}
              value={provider.type}
            >
              <span className="flex items-center gap-2">
                <WebProviderLogo providerType={provider.type} />
                {provider.label}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DefaultStatusChip() {
  return (
    <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-[10px] text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
      Default
    </span>
  );
}

function WebSearchSettingsRow({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium text-sm">{title}</span>
        <p className="text-[13px] text-muted-foreground leading-snug">
          {description}
        </p>
      </div>
      <div className="shrink-0 [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed **:data-[slot=dropdown-menu-radio-item]:cursor-pointer">
        {action}
      </div>
    </div>
  );
}

function SearchProviderListRow({
  catalog,
  row,
  isDefault = false,
  onClick,
}: {
  catalog: WebSearchProviderMetadata;
  row?: WebSearchProviderView | null;
  isDefault?: boolean;
  onClick: () => void;
}) {
  const isConfigured = Boolean(row?.configured);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <AdminListItemLogoFrame>
          <WebProviderLogo
            className="size-full max-h-6 max-w-6 object-contain"
            providerType={catalog.type}
          />
        </AdminListItemLogoFrame>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{catalog.label}</span>
            {isConfigured ? (
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
            {catalog.helper}
          </span>
        </span>
      </span>

      <AdminListChevronButton
        label={`Configure ${catalog.label}`}
        onClick={onClick}
      />
    </div>
  );
}

export function WebSearchSettings({
  initialView,
  tenantSlug,
}: {
  initialView: TenantWebSearchAdminView;
  tenantSlug: string;
}) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [defaultSearchEngineType, setDefaultSearchEngineType] = useState(
    () =>
      initialView.searchProviders.find(
        (provider) => provider.configured && provider.isActive
      )?.providerType ?? ""
  );
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const [activeSearchProvider, setActiveSearchProvider] =
    useState<WebSearchProviderType | null>(null);
  const [providerToRemove, setProviderToRemove] =
    useState<WebSearchProviderView | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [removeAllOpen, setRemoveAllOpen] = useState(false);
  const [isRemovingAll, setIsRemovingAll] = useState(false);

  const configuredSearchProviders = useMemo(
    () => view.searchProviders.filter((provider) => provider.configured),
    [view.searchProviders]
  );

  const defaultSearchEngineOptions = useMemo(
    () =>
      configuredSearchProviders.map((row) => {
        const catalog = SEARCH_PROVIDERS.find(
          (entry) => entry.type === row.providerType
        );
        return {
          label: catalog?.label ?? row.providerType,
          type: row.providerType as WebSearchProviderType,
        };
      }),
    [configuredSearchProviders]
  );

  const effectiveDefaultSearchEngineType = defaultSearchEngineOptions.some(
    (option) => option.type === defaultSearchEngineType
  )
    ? defaultSearchEngineType
    : (defaultSearchEngineOptions[0]?.type ?? "");

  const filteredSearchProviders = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return SEARCH_PROVIDERS;
    }
    return SEARCH_PROVIDERS.filter((catalog) => {
      const haystack = [catalog.label, catalog.subtitle, catalog.helper]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [searchQuery]);

  async function saveDefaultSearchEngine(
    nextProviderType: WebSearchProviderType
  ) {
    if (nextProviderType === effectiveDefaultSearchEngineType) {
      return;
    }

    const previousProviderType = effectiveDefaultSearchEngineType;
    setDefaultSearchEngineType(nextProviderType);
    setIsSavingDefault(true);

    const response = await fetch(`/api/admin/${tenantSlug}/web-search`, {
      body: JSON.stringify({
        activate: true,
        category: "search",
        providerType: nextProviderType,
      }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setDefaultSearchEngineType(previousProviderType);
      toast.error(payload?.error ?? "Failed to save default search engine.");
      setIsSavingDefault(false);
      return;
    }

    const nextView = (await response.json()) as TenantWebSearchAdminView;
    setView(nextView);
    setDefaultSearchEngineType(
      nextView.searchProviders.find(
        (provider) => provider.configured && provider.isActive
      )?.providerType ?? ""
    );
    setIsSavingDefault(false);
    router.refresh();
    toast.success("Default search engine updated.");
  }

  async function removeProvider(provider: WebSearchProviderView) {
    setIsRemoving(true);

    const response = await fetch(`/api/admin/${tenantSlug}/web-search`, {
      body: JSON.stringify({ providerId: provider.id }),
      headers: { "content-type": "application/json" },
      method: "DELETE",
    });

    if (!response.ok) {
      toast.error("Failed to remove provider.");
      setIsRemoving(false);
      setProviderToRemove(null);
      return;
    }

    const nextView = (await response.json()) as TenantWebSearchAdminView;
    setView(nextView);
    setDefaultSearchEngineType(
      nextView.searchProviders.find(
        (provider) => provider.configured && provider.isActive
      )?.providerType ?? ""
    );
    setIsRemoving(false);
    setProviderToRemove(null);
    router.refresh();
    toast.success("Search provider removed.");
  }

  async function removeAllSearchProviders() {
    if (configuredSearchProviders.length === 0) {
      return;
    }

    setIsRemovingAll(true);
    const results = await Promise.all(
      configuredSearchProviders.map(async (provider) => {
        const response = await fetch(`/api/admin/${tenantSlug}/web-search`, {
          body: JSON.stringify({ providerId: provider.id }),
          headers: { "content-type": "application/json" },
          method: "DELETE",
        });
        return { ok: response.ok, provider };
      })
    );

    const failed = results.filter((result) => !result.ok);
    if (failed.length > 0) {
      toast.error("Some search providers could not be removed.");
      setIsRemovingAll(false);
      return;
    }

    const response = await fetch(`/api/admin/${tenantSlug}/web-search`);
    if (response.ok) {
      const nextView = (await response.json()) as TenantWebSearchAdminView;
      setView(nextView);
      setDefaultSearchEngineType(
        nextView.searchProviders.find(
          (provider) => provider.configured && provider.isActive
        )?.providerType ?? ""
      );
    }
    setRemoveAllOpen(false);
    setIsRemovingAll(false);
    router.refresh();
    toast.success("All search providers removed.");
  }

  const providerToRemoveCatalog = providerToRemove
    ? SEARCH_PROVIDERS.find(
        (entry) => entry.type === providerToRemove.providerType
      )
    : null;

  const showDefaultEngineRow = configuredSearchProviders.length > 1;

  return (
    <div className="flex flex-col gap-5 [&_a]:cursor-pointer [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 rounded-lg bg-transparent pl-9"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search providers…"
            value={searchQuery}
          />
        </div>
        {configuredSearchProviders.length > 0 ? (
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

      {filteredSearchProviders.length === 0 && !showDefaultEngineRow ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          No providers match your search.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          {configuredSearchProviders.length > 1 ? (
            <div
              className={cn(
                filteredSearchProviders.length > 0
                  ? "border-border/60 border-b"
                  : undefined
              )}
            >
              <WebSearchSettingsRow
                action={
                  <DefaultSearchEngineSelector
                    disabled={isSavingDefault}
                    onChange={(providerType) => {
                      saveDefaultSearchEngine(providerType).catch(
                        () => undefined
                      );
                    }}
                    providers={defaultSearchEngineOptions}
                    value={effectiveDefaultSearchEngineType}
                  />
                }
                description="This search engine will be used when Kimiro searches the web in chat."
                title="Default search engine"
              />
            </div>
          ) : null}

          {filteredSearchProviders.map((catalog, index) => {
            const row = findProvider(view.searchProviders, catalog.type);

            return (
              <div
                className={cn(index > 0 && "border-border/60 border-t")}
                key={catalog.type}
              >
                <SearchProviderListRow
                  catalog={catalog}
                  isDefault={
                    Boolean(row?.configured) &&
                    effectiveDefaultSearchEngineType === catalog.type
                  }
                  onClick={() => setActiveSearchProvider(catalog.type)}
                  row={row}
                />
              </div>
            );
          })}
        </div>
      )}

      {activeSearchProvider ? (
        <SearchProviderSetupDialog
          initial={findProvider(view.searchProviders, activeSearchProvider)}
          key={activeSearchProvider}
          onOpenChange={(open) => {
            if (!open) {
              setActiveSearchProvider(null);
            }
          }}
          onRemove={
            findProvider(view.searchProviders, activeSearchProvider)?.configured
              ? () => {
                  const row = findProvider(
                    view.searchProviders,
                    activeSearchProvider
                  );
                  if (row) {
                    setProviderToRemove(row);
                  }
                  setActiveSearchProvider(null);
                }
              : undefined
          }
          onUpdated={(nextView) => {
            setView(nextView);
            setDefaultSearchEngineType(
              nextView.searchProviders.find(
                (provider) => provider.configured && provider.isActive
              )?.providerType ?? ""
            );
            setActiveSearchProvider(null);
          }}
          open
          provider={activeSearchProvider}
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
              Remove {providerToRemoveCatalog?.label ?? "provider"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Web search will be disabled in chat until you connect a search
              provider again.
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
            <AlertDialogTitle>Remove all search providers?</AlertDialogTitle>
            <AlertDialogDescription>
              Web search will be disabled in chat until you connect a search
              provider again.
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
                removeAllSearchProviders().catch(() => undefined);
              }}
              type="button"
            >
              {isRemovingAll ? "Removing…" : "Remove all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
