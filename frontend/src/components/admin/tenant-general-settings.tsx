"use client";

import { AlignJustify, ArrowLeftRight, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { DefaultModelSelector } from "@/components/admin/default-model-selector";
import { IndexingSizeControl } from "@/components/admin/indexing-size-control";
import { SettingsCard } from "@/components/admin/settings-card";
import { WebSearchAutoReadLimitSelector } from "@/components/admin/web-search-auto-read-limit-selector";
import { WorkspaceIconControl } from "@/components/admin/workspace-logo-upload";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  TenantGeneralAdminView,
  WebSearchAutoReadLimit,
} from "@/contracts/admin";
import type { WorkspaceResponse } from "@/hooks/use-workspace";
import { chatModelsApiUrl } from "@/lib/ai/chat-models-api";
import {
  isReasoningEffortLevel,
  type ReasoningEffortLevel,
} from "@/shared/ai/reasoning-effort";

const CHAT_RETENTION_OPTIONS = [
  { label: "Forever", value: "forever" },
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "60 days", value: "60" },
  { label: "90 days", value: "90" },
  { label: "365 days", value: "365" },
] as const;

const retentionRadioItemClassName =
  "rounded-lg pr-3 [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden data-[state=checked]:bg-muted/50 data-[state=checked]:text-foreground data-[state=checked]:focus:bg-muted/50 data-[state=checked]:focus:text-foreground data-[state=checked]:[&_svg]:text-foreground";

function retentionValueFromDays(days: number | null | undefined) {
  if (days === null || days === undefined) {
    return "forever";
  }
  const asString = days.toString();
  const supported = CHAT_RETENTION_OPTIONS.some(
    (option) => option.value === asString
  );
  return supported ? asString : "forever";
}

function retentionDaysFromValue(value: string) {
  if (value === "forever") {
    return null;
  }
  return Number.parseInt(value, 10);
}

function retentionOption(value: string) {
  return (
    CHAT_RETENTION_OPTIONS.find((option) => option.value === value) ??
    CHAT_RETENTION_OPTIONS[0]
  );
}

function WorkspacePromptDialog({
  open,
  onOpenChange,
  value,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSave: (nextValue: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  const isDraftDirty = draft !== value;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-lg p-0 sm:max-w-xl [&_button]:cursor-pointer"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="px-6 py-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AlignJustify
                aria-hidden="true"
                className="size-6 shrink-0 text-foreground"
              />
              <ArrowLeftRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <SidebarAppLogo className="size-6! text-foreground" />
            </div>
            <div className="flex flex-col gap-0">
              <DialogTitle className="font-medium text-base leading-normal">
                Workspace prompt
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground">
                Default instructions applied to chat across your organization.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="mx-6 h-px bg-border/60" />
        <div className="px-6 py-6">
          <Textarea
            className="min-h-48 rounded-lg"
            maxLength={8000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Describe your company, terminology, and how Kimiro should help your team."
            rows={10}
            value={draft}
          />
        </div>
        <div className="mx-6 h-px bg-border/60" />
        <DialogFooter className="gap-2 px-6 py-4 sm:justify-between">
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!isDraftDirty}
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
            type="button"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function syncFormFromView(view: TenantGeneralAdminView) {
  return {
    companyName: view.workspace.companyName,
    defaultChatModelId: view.models.defaultChatModelId ?? "",
    defaultChatReasoningEffort: parseSavedReasoningEffort(
      view.models.defaultChatReasoningEffort
    ),
    maxIndexedContentSizeMb: view.knowledge.maxIndexedContentSizeMb.toString(),
    retentionValue: retentionValueFromDays(
      view.settings.maximumChatRetentionDays
    ),
    sandboxEnabled: view.sandbox.enabled,
    workspacePrompt: view.settings.workspacePrompt ?? "",
    maxAutoReadPages: view.webSearch.maxAutoReadPages,
  };
}

function parseSavedReasoningEffort(
  value: string | null | undefined
): ReasoningEffortLevel {
  if (value && isReasoningEffortLevel(value)) {
    return value;
  }
  return "off";
}

export function TenantGeneralSettings({
  tenantSlug,
  initial,
}: {
  tenantSlug: string;
  initial: TenantGeneralAdminView;
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [view, setView] = useState(initial);
  const [companyName, setCompanyName] = useState(initial.workspace.companyName);
  const [workspacePrompt, setWorkspacePrompt] = useState(
    initial.settings.workspacePrompt ?? ""
  );
  const [retentionValue, setRetentionValue] = useState(
    retentionValueFromDays(initial.settings.maximumChatRetentionDays)
  );
  const [maxIndexedContentSizeMb, setMaxIndexedContentSizeMb] = useState(
    initial.knowledge.maxIndexedContentSizeMb.toString()
  );
  const [defaultChatModelId, setDefaultChatModelId] = useState(
    initial.models.defaultChatModelId ?? ""
  );
  const [defaultChatReasoningEffort, setDefaultChatReasoningEffort] =
    useState<ReasoningEffortLevel>(
      parseSavedReasoningEffort(initial.models.defaultChatReasoningEffort)
    );
  const [sandboxEnabled, setSandboxEnabled] = useState(initial.sandbox.enabled);
  const [maxAutoReadPages, setMaxAutoReadPages] =
    useState<WebSearchAutoReadLimit>(initial.webSearch.maxAutoReadPages);
  const [isSaving, setIsSaving] = useState(false);
  const [isWorkspacePromptDialogOpen, setIsWorkspacePromptDialogOpen] =
    useState(false);

  const availableChatModels = view.models.availableChatModels;
  const effectiveDefaultModelId = useMemo(() => {
    if (availableChatModels.some((model) => model.id === defaultChatModelId)) {
      return defaultChatModelId;
    }
    return availableChatModels[0]?.id ?? "";
  }, [availableChatModels, defaultChatModelId]);

  const showDefaultModel =
    availableChatModels.length > 0 && Boolean(effectiveDefaultModelId);

  const isDirty =
    companyName !== view.workspace.companyName ||
    workspacePrompt !== (view.settings.workspacePrompt ?? "") ||
    retentionValue !==
      retentionValueFromDays(view.settings.maximumChatRetentionDays) ||
    maxIndexedContentSizeMb !==
      view.knowledge.maxIndexedContentSizeMb.toString() ||
    defaultChatModelId !== (view.models.defaultChatModelId ?? "") ||
    defaultChatReasoningEffort !==
      parseSavedReasoningEffort(view.models.defaultChatReasoningEffort) ||
    sandboxEnabled !== view.sandbox.enabled ||
    maxAutoReadPages !== view.webSearch.maxAutoReadPages;

  const retentionChanged =
    retentionValue !==
    retentionValueFromDays(view.settings.maximumChatRetentionDays);

  const defaultModelChanged =
    defaultChatModelId !== (view.models.defaultChatModelId ?? "") ||
    defaultChatReasoningEffort !==
      parseSavedReasoningEffort(view.models.defaultChatReasoningEffort);

  async function onSaveChanges() {
    const trimmedName = companyName.trim();
    if (!trimmedName) {
      toast.error("Workspace name is required.");
      return;
    }

    const maxSizeMb = Number.parseInt(maxIndexedContentSizeMb, 10);
    if (!Number.isFinite(maxSizeMb) || maxSizeMb < 1 || maxSizeMb > 250) {
      toast.error("Enter a valid file size limit between 1 and 250 MB.");
      return;
    }

    const maximumChatRetentionDays = retentionDaysFromValue(retentionValue);

    setIsSaving(true);

    const patch: Record<string, unknown> = {
      companyName: trimmedName,
      indexingEnabled: true,
      maxIndexedContentSizeMb: maxSizeMb,
      maximumChatRetentionDays,
      sandboxEnabled,
      workspacePrompt: workspacePrompt.trim() || null,
      maxAutoReadPages,
    };

    if (showDefaultModel) {
      patch.defaultChatModelId = effectiveDefaultModelId || null;
      patch.defaultChatReasoningEffort = defaultChatReasoningEffort;
    }

    const response = await fetch(`/api/admin/${tenantSlug}/general`, {
      body: JSON.stringify(patch),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    setIsSaving(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(payload?.error ?? "Failed to save settings.");
      return;
    }

    const next = (await response.json()) as TenantGeneralAdminView;
    setView(next);
    const synced = syncFormFromView(next);
    setCompanyName(synced.companyName);
    setWorkspacePrompt(synced.workspacePrompt);
    setRetentionValue(synced.retentionValue);
    setMaxIndexedContentSizeMb(synced.maxIndexedContentSizeMb);
    setDefaultChatModelId(synced.defaultChatModelId);
    setDefaultChatReasoningEffort(synced.defaultChatReasoningEffort);
    setSandboxEnabled(synced.sandboxEnabled);
    setMaxAutoReadPages(synced.maxAutoReadPages);
    if (defaultModelChanged) {
      await mutate(chatModelsApiUrl(tenantSlug));
    }
    await mutate(
      "/api/workspace",
      (current: WorkspaceResponse | null | undefined) =>
        current
          ? {
              ...current,
              companyName: next.workspace.companyName,
            }
          : current,
      { revalidate: true }
    );
    toast.success("Changes saved.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 [&_a]:cursor-pointer [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <div className="flex flex-col gap-5">
        <SettingsCard
          action={
            <Input
              aria-label="Workspace name"
              className="h-8 w-36 rounded-lg"
              id="workspace-name"
              onChange={(event) => setCompanyName(event.target.value)}
              value={companyName}
            />
          }
          description="Display name shown across admin, chat, and integrations."
          title="Workspace name"
        />

        <SettingsCard
          action={
            <WorkspaceIconControl
              hasLogo={Boolean(view.settings.logoUrl)}
              logoVersion={view.settings.logoUrl}
              onLogoChange={(next) => {
                setView(next);
                mutate(
                  "/api/workspace",
                  (current: WorkspaceResponse | null | undefined) =>
                    current
                      ? {
                          ...current,
                          logoUrl: next.settings.logoUrl,
                        }
                      : current,
                  { revalidate: true }
                ).catch(() => undefined);
                router.refresh();
              }}
              tenantSlug={tenantSlug}
            />
          }
          description="Click the icon to upload. JPEG, PNG, WebP, or SVG. Max 2 MB."
          title="Workspace icon"
        />

        <SettingsCard
          action={
            <Button
              className="bg-transparent hover:bg-muted/50"
              onClick={() => setIsWorkspacePromptDialogOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              {workspacePrompt.trim() ? "Edit prompt" : "Add prompt"}
            </Button>
          }
          description="Default instructions applied to chat across your organization."
          title="Workspace prompt"
        />

        <WorkspacePromptDialog
          onOpenChange={setIsWorkspacePromptDialogOpen}
          onSave={setWorkspacePrompt}
          open={isWorkspacePromptDialogOpen}
          value={workspacePrompt}
        />

        {showDefaultModel ? (
          <SettingsCard
            action={
              <DefaultModelSelector
                disabled={isSaving}
                models={availableChatModels}
                onChange={setDefaultChatModelId}
                onReasoningEffortChange={setDefaultChatReasoningEffort}
                savedReasoningEffort={defaultChatReasoningEffort}
                value={effectiveDefaultModelId}
              />
            }
            description="This model will be shown default in your users chats."
            title="Default model"
          />
        ) : null}

        <SettingsCard
          action={
            <Switch
              checked={sandboxEnabled}
              disabled={isSaving || !view.sandbox.envConfigured}
              onCheckedChange={setSandboxEnabled}
            />
          }
          banner={
            view.sandbox.envConfigured ? null : (
              <p className="mb-3 text-amber-600 text-xs">
                Sandbox is not configured on this deployment. Set{" "}
                <code className="text-xs">SANDBOX_ENABLED</code> and{" "}
                <code className="text-xs">SANDBOX_EXECUTOR_URL</code> on the
                server first.
              </p>
            )
          }
          description="Allow the agent to run Python and bash in an isolated per-chat workspace."
          title="Agent sandbox"
        />

        <SettingsCard
          action={
            <IndexingSizeControl
              onChange={setMaxIndexedContentSizeMb}
              value={maxIndexedContentSizeMb}
            />
          }
          banner={
            view.knowledge.envAllowsIndexing ? null : (
              <p className="mb-3 text-amber-600 text-xs">
                Indexing is disabled globally via environment configuration.
              </p>
            )
          }
          description="Control how much content is indexed from connected sources."
          title="Sources indexing"
        />

        <SettingsCard
          action={
            <WebSearchAutoReadLimitSelector
              disabled={isSaving}
              onChange={setMaxAutoReadPages}
              value={maxAutoReadPages}
            />
          }
          description="How many top web search results Kimiro fetches and reads as full pages."
          title="Web page reading"
        />

        <SettingsCard
          action={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="bg-transparent hover:bg-muted/50 aria-expanded:bg-muted/50"
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {retentionOption(retentionValue).label}
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-32 **:data-[slot=dropdown-menu-radio-item]:cursor-pointer"
              >
                <DropdownMenuRadioGroup
                  onValueChange={setRetentionValue}
                  value={retentionValue}
                >
                  {CHAT_RETENTION_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem
                      className={retentionRadioItemClassName}
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          }
          description="Delete chats older than the selected period. Choose Forever to keep all history."
          footer={
            retentionChanged ? (
              <p className="text-muted-foreground text-xs">
                Saving will apply the new retention policy to existing chats.
              </p>
            ) : null
          }
          title="Chat retention"
        />
      </div>

      <div className="pt-6">
        <Button
          disabled={!isDirty || isSaving}
          onClick={onSaveChanges}
          size="sm"
          type="button"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
