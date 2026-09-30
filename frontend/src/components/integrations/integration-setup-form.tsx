"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/admin/settings-card";
import { IntegrationAccessSection } from "@/components/integrations/integration-access-section";
import { IntegrationStatusChip } from "@/components/integrations/integration-status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { IntegrationSetupInitial } from "@/shared/integrations/integration-setup-state";
import { syncFormFromInitial } from "@/shared/integrations/integration-setup-state";
import { cn } from "@/shared/utils";

export type { IntegrationSetupInitial } from "@/shared/integrations/integration-setup-state";

export type IntegrationMemberOption = {
  id: string;
  authUserId: string;
  email: string;
  displayName: string;
  image: string | null;
};

type IntegrationFormErrors = {
  siteUrl?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  access?: string;
  general?: string;
};

function getValidationErrors(args: {
  requiresSiteUrl: boolean;
  credentialMode: "managed" | "own";
  siteUrl: string;
  oauthClientId: string;
  oauthClientSecret: string;
  hasOAuthClientSecret: boolean;
  isEditing: boolean;
  everyone: boolean;
  selectedMemberIds: string[];
}): IntegrationFormErrors {
  const errors: IntegrationFormErrors = {};

  if (args.requiresSiteUrl && !args.isEditing && !args.siteUrl.trim()) {
    errors.siteUrl = "Site URL is required.";
  }
  if (args.credentialMode === "own") {
    if (!args.oauthClientId.trim()) {
      errors.oauthClientId = "OAuth client ID is required.";
    }
    if (!args.oauthClientSecret.trim() && !args.hasOAuthClientSecret) {
      errors.oauthClientSecret = "OAuth client secret is required.";
    }
  }
  if (!args.everyone && args.selectedMemberIds.length === 0) {
    errors.access = "Select at least one member or choose everyone.";
  }

  return errors;
}

function hasValidationErrors(errors: IntegrationFormErrors) {
  return Boolean(
    errors.siteUrl ||
      errors.oauthClientId ||
      errors.oauthClientSecret ||
      errors.access
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-destructive text-sm">{message}</p>;
}

function credentialsSectionCopy(initial: IntegrationSetupInitial) {
  if (initial.requiresSiteUrl) {
    return {
      description: `Enter your organization's ${initial.name} site URL and choose how members authenticate.`,
      title: "Credentials",
    };
  }

  return {
    description: "Use Kimiro managed OAuth or bring your own app credentials.",
    title: "Credentials",
  };
}

function credentialChipKind(args: {
  isEditing: boolean;
  mode: "managed" | "own";
  savedMode: "managed" | "own";
}) {
  if (args.isEditing) {
    if (args.mode === args.savedMode) {
      return "active";
    }
    return null;
  }
  if (args.mode === "managed") {
    return "recommended";
  }
  return null;
}

function CredentialsFields({
  initial,
  isEditing,
  credentialMode,
  siteUrl,
  oauthClientId,
  oauthClientSecret,
  onCredentialModeChange,
  onSiteUrlChange,
  onOauthClientIdChange,
  onOauthClientSecretChange,
  siteUrlError,
  oauthClientIdError,
  oauthClientSecretError,
}: {
  initial: IntegrationSetupInitial;
  isEditing: boolean;
  credentialMode: "managed" | "own";
  siteUrl: string;
  oauthClientId: string;
  oauthClientSecret: string;
  onCredentialModeChange: (mode: "managed" | "own") => void;
  onSiteUrlChange: (value: string) => void;
  onOauthClientIdChange: (value: string) => void;
  onOauthClientSecretChange: (value: string) => void;
  siteUrlError?: string;
  oauthClientIdError?: string;
  oauthClientSecretError?: string;
}) {
  const managedChip = credentialChipKind({
    isEditing,
    mode: "managed",
    savedMode: initial.credentials.credentialMode,
  });
  const ownChip = credentialChipKind({
    isEditing,
    mode: "own",
    savedMode: initial.credentials.credentialMode,
  });

  return (
    <div className="flex flex-col gap-3">
      {initial.requiresSiteUrl ? (
        <div className="flex flex-col gap-1.5">
          <FieldError message={siteUrlError} />
          <Input
            className="rounded-lg"
            id="integration-site-url"
            onChange={(event) => onSiteUrlChange(event.target.value)}
            placeholder="https://yourcompany.atlassian.net"
            readOnly={isEditing}
            value={siteUrl}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
            credentialMode === "managed"
              ? "bg-muted/50 text-foreground"
              : "text-foreground hover:bg-muted/20"
          )}
        >
          <input
            checked={credentialMode === "managed"}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground"
            name="integration-credential-mode"
            onChange={() => onCredentialModeChange("managed")}
            type="radio"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Kimiro managed</span>
              {managedChip ? (
                <IntegrationStatusChip
                  label={
                    managedChip === "recommended" ? "Recommended" : "Active"
                  }
                />
              ) : null}
            </div>
            <p className="text-[13px] text-muted-foreground">
              Use Kimiro&apos;s managed OAuth app for faster setup.
            </p>
          </div>
        </label>
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
            credentialMode === "own"
              ? "bg-muted/50 text-foreground"
              : "text-foreground hover:bg-muted/20"
          )}
        >
          <input
            checked={credentialMode === "own"}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground"
            name="integration-credential-mode"
            onChange={() => onCredentialModeChange("own")}
            type="radio"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Your own credentials</span>
              {ownChip ? (
                <IntegrationStatusChip
                  label={ownChip === "recommended" ? "Recommended" : "Active"}
                />
              ) : null}
            </div>
            <p className="text-[13px] text-muted-foreground">
              Use your own OAuth app credentials.
            </p>
          </div>
        </label>
      </div>

      {credentialMode === "own" ? (
        <div className="flex flex-col gap-3">
          {(oauthClientIdError ?? oauthClientSecretError) ? (
            <div className="flex flex-col gap-1">
              <FieldError message={oauthClientIdError} />
              <FieldError message={oauthClientSecretError} />
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              className="rounded-lg"
              id="integration-oauth-client-id"
              onChange={(event) => onOauthClientIdChange(event.target.value)}
              placeholder="OAuth client ID"
              value={oauthClientId}
            />
            <Input
              className="rounded-lg"
              id="integration-oauth-client-secret"
              onChange={(event) =>
                onOauthClientSecretChange(event.target.value)
              }
              placeholder={
                initial.credentials.hasOAuthClientSecret
                  ? "Leave blank to keep existing secret"
                  : "OAuth client secret"
              }
              type="password"
              value={oauthClientSecret}
            />
          </div>
          {initial.credentials.redirectUri ? (
            <Input
              aria-label="Redirect URI"
              className="rounded-lg"
              id="integration-redirect-uri"
              readOnly
              value={initial.credentials.redirectUri}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function IntegrationSetupForm({
  tenantSlug,
  companyName,
  members,
  initial,
  currentUserId,
  onRemoveIntegration,
  isRemovingIntegration = false,
  backLink,
}: {
  tenantSlug: string;
  companyName: string;
  members: IntegrationMemberOption[];
  initial: IntegrationSetupInitial;
  currentUserId: string | null;
  onRemoveIntegration?: () => void;
  isRemovingIntegration?: boolean;
  backLink?: ReactNode;
}) {
  const router = useRouter();
  const isEditing = initial.availability.isEnabled;

  const [credentialMode, setCredentialMode] = useState<"managed" | "own">(
    initial.credentials.credentialMode
  );
  const [siteUrl, setSiteUrl] = useState(initial.credentials.siteUrl ?? "");
  const [oauthClientId, setOauthClientId] = useState(
    initial.credentials.oauthClientId ?? ""
  );
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [everyone, setEveryone] = useState(
    !initial.availability.isEnabled ||
      initial.availability.availabilityMode === "everyone"
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState(
    initial.availability.memberIds
  );

  const [formErrors, setFormErrors] = useState<IntegrationFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const synced = syncFormFromInitial(initial);
    setCredentialMode(synced.credentialMode);
    setSiteUrl(synced.siteUrl);
    setOauthClientId(synced.oauthClientId);
    setOauthClientSecret(synced.oauthClientSecret);
    setEveryone(synced.everyone);
    setSelectedMemberIds(synced.selectedMemberIds);
    setFormErrors({});
  }, [initial]);

  const credentialsCopy = credentialsSectionCopy(initial);

  const hasPendingChanges = useMemo(() => {
    if (!isEditing) {
      return true;
    }

    const initialEveryone =
      initial.availability.availabilityMode === "everyone";
    const selectedMemberIdsChanged =
      !everyone &&
      (selectedMemberIds.length !== initial.availability.memberIds.length ||
        selectedMemberIds.some(
          (memberId) => !initial.availability.memberIds.includes(memberId)
        ));
    const credentialModeChanged =
      credentialMode !== initial.credentials.credentialMode;

    return (
      credentialModeChanged ||
      oauthClientId !== (initial.credentials.oauthClientId ?? "") ||
      oauthClientSecret.trim().length > 0 ||
      everyone !== initialEveryone ||
      selectedMemberIdsChanged
    );
  }, [
    credentialMode,
    everyone,
    initial,
    isEditing,
    oauthClientId,
    oauthClientSecret,
    selectedMemberIds,
  ]);

  function setAccessEveryone(nextEveryone: boolean) {
    setEveryone(nextEveryone);
    setFormErrors((current) => ({ ...current, access: undefined }));
    if (nextEveryone) {
      setSelectedMemberIds([]);
    }
  }

  function addMemberAccess(memberId: string) {
    if (everyone) {
      return;
    }
    if (selectedMemberIds.includes(memberId)) {
      return;
    }
    setFormErrors((current) => ({ ...current, access: undefined }));
    setSelectedMemberIds((current) => [...current, memberId]);
  }

  function removeMemberAccess(memberId: string) {
    setFormErrors((current) => ({ ...current, access: undefined }));
    if (everyone) {
      setEveryone(false);
      setSelectedMemberIds(
        members
          .filter((member) => member.id !== memberId)
          .map((member) => member.id)
      );
      return;
    }

    setSelectedMemberIds((current) => current.filter((id) => id !== memberId));
  }

  async function onSave() {
    const validationErrors = getValidationErrors({
      credentialMode,
      everyone,
      hasOAuthClientSecret: initial.credentials.hasOAuthClientSecret,
      isEditing,
      oauthClientId,
      oauthClientSecret,
      requiresSiteUrl: initial.requiresSiteUrl,
      selectedMemberIds,
      siteUrl,
    });
    if (hasValidationErrors(validationErrors)) {
      setFormErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    setFormErrors({});

    const payload = {
      credentialMode,
      siteUrl:
        (isEditing ? initial.credentials.siteUrl : siteUrl.trim()) || undefined,
      ...(credentialMode === "own"
        ? { oauthClientId: oauthClientId.trim() }
        : {}),
      ...(oauthClientSecret.trim()
        ? { oauthClientSecret: oauthClientSecret.trim() }
        : {}),
      availabilityMode: everyone ? "everyone" : "selected",
      memberIds: everyone ? [] : selectedMemberIds,
    };

    const response = await fetch(
      `/api/integrations/${tenantSlug}/apps/${initial.key}`,
      {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method: "PUT",
      }
    );

    if (!response.ok) {
      const responsePayload = (await response.json().catch(() => null)) as {
        code?: string;
        error?: string;
      } | null;
      if (responsePayload?.code === "REAUTH_REQUIRED") {
        window.location.assign("/login?reason=reauth");
        setIsSaving(false);
        return;
      }
      setFormErrors({
        general: responsePayload?.error ?? "Failed to save integration.",
      });
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    toast.success(isEditing ? "Integration updated." : "Integration enabled.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5 [&_a]:cursor-pointer [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <SettingsCard
        collapsible
        defaultOpen
        description={credentialsCopy.description}
        title={credentialsCopy.title}
      >
        <CredentialsFields
          credentialMode={credentialMode}
          initial={initial}
          isEditing={isEditing}
          oauthClientId={oauthClientId}
          oauthClientIdError={formErrors.oauthClientId}
          oauthClientSecret={oauthClientSecret}
          oauthClientSecretError={formErrors.oauthClientSecret}
          onCredentialModeChange={(mode) => {
            setCredentialMode(mode);
            setFormErrors((current) => ({
              ...current,
              oauthClientId: undefined,
              oauthClientSecret: undefined,
            }));
          }}
          onOauthClientIdChange={(value) => {
            setOauthClientId(value);
            setFormErrors((current) => ({
              ...current,
              oauthClientId: undefined,
            }));
          }}
          onOauthClientSecretChange={(value) => {
            setOauthClientSecret(value);
            setFormErrors((current) => ({
              ...current,
              oauthClientSecret: undefined,
            }));
          }}
          onSiteUrlChange={(value) => {
            setSiteUrl(value);
            setFormErrors((current) => ({ ...current, siteUrl: undefined }));
          }}
          siteUrl={siteUrl}
          siteUrlError={formErrors.siteUrl}
        />
      </SettingsCard>

      <IntegrationAccessSection
        accessError={formErrors.access}
        companyName={companyName}
        currentUserId={currentUserId}
        everyone={everyone}
        members={members}
        onAddMember={addMemberAccess}
        onEveryoneChange={setAccessEveryone}
        onRemoveMember={removeMemberAccess}
        selectedMemberIds={selectedMemberIds}
      />

      {formErrors.general ? <FieldError message={formErrors.general} /> : null}

      <div className="flex items-center justify-between gap-4 pt-6">
        <div className="flex items-center gap-3">
          {backLink}
          <Button
            disabled={isSaving || (isEditing && !hasPendingChanges)}
            onClick={onSave}
            size="sm"
            type="button"
          >
            {isSaving
              ? "Saving…"
              : isEditing
                ? "Save changes"
                : "Enable integration"}
          </Button>
        </div>
        {onRemoveIntegration ? (
          <Button
            disabled={isRemovingIntegration || isSaving}
            onClick={onRemoveIntegration}
            size="sm"
            type="button"
            variant="outline"
          >
            Remove integration
          </Button>
        ) : null}
      </div>
    </div>
  );
}
