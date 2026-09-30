"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/admin/settings-card";
import { StatusBanner } from "@/components/admin/status-banner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { TenantSlackIntegrationAdminView } from "@/contracts/admin";

function channelIdsFromText(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    ),
  ];
}

function channelIdsToText(channelIds: string[]) {
  return channelIds.join("\n");
}

export function SlackIntegrationSettings({
  tenantSlug,
  initialView,
  installNotice,
  installError,
}: {
  tenantSlug: string;
  initialView: TenantSlackIntegrationAdminView;
  installNotice?: string | null;
  installError?: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [enabled, setEnabled] = useState(initialView.enabled);
  const [dmsEnabled, setDmsEnabled] = useState(initialView.dmsEnabled);
  const [deliverablesEnabled, setDeliverablesEnabled] = useState(
    initialView.deliverablesEnabled
  );
  const [allowedChannelIdsText, setAllowedChannelIdsText] = useState(
    channelIdsToText(initialView.allowedChannelIds)
  );
  const [credentialMode, setCredentialMode] = useState<
    TenantSlackIntegrationAdminView["credentialMode"]
  >(initialView.credentialMode);
  const [oauthClientId, setOauthClientId] = useState(
    initialView.oauthClientId ?? ""
  );
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [showOwnCredentials, setShowOwnCredentials] = useState(
    initialView.credentialMode === "own"
  );
  const usesManagedApp = credentialMode === "managed";

  useEffect(() => {
    if (installNotice) {
      toast.success(installNotice);
    }
    if (installError) {
      toast.error(installError);
    }
  }, [installError, installNotice]);

  const installUrl = useMemo(() => {
    const params = new URLSearchParams({
      returnTo: "/admin/slack-integration",
      tenantSlug,
    });
    return `/api/slack/oauth/install?${params.toString()}`;
  }, [tenantSlug]);

  const isDirty =
    enabled !== view.enabled ||
    dmsEnabled !== view.dmsEnabled ||
    deliverablesEnabled !== view.deliverablesEnabled ||
    channelIdsFromText(allowedChannelIdsText).join(",") !==
      view.allowedChannelIds.join(",") ||
    credentialMode !== view.credentialMode ||
    (credentialMode === "own" &&
      oauthClientId.trim() !== (view.oauthClientId ?? "")) ||
    oauthClientSecret.trim().length > 0 ||
    signingSecret.trim().length > 0;

  async function patchSettings(body: Record<string, unknown>) {
    const response = await fetch(`/api/admin/${tenantSlug}/slack-integration`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
        error?: string;
      } | null;
      if (payload?.code === "REAUTH_REQUIRED") {
        window.location.assign("/login?reason=reauth");
        return null;
      }
      throw new Error(
        payload?.error ?? "Failed to save Slack integration settings."
      );
    }
    return (await response.json()) as TenantSlackIntegrationAdminView;
  }

  async function onSave() {
    setIsSaving(true);
    try {
      const next = await patchSettings({
        allowedChannelIds: channelIdsFromText(allowedChannelIdsText),
        credentialMode,
        deliverablesEnabled,
        dmsEnabled,
        enabled,
        ...(credentialMode === "own"
          ? { oauthClientId: oauthClientId.trim() }
          : {}),
        ...(oauthClientSecret.trim()
          ? { oauthClientSecret: oauthClientSecret.trim() }
          : {}),
        ...(signingSecret.trim()
          ? { signingSecret: signingSecret.trim() }
          : {}),
      });
      if (!next) {
        return;
      }
      setView(next);
      setOauthClientSecret("");
      setSigningSecret("");
      toast.success("Slack integration settings saved.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save Slack integration settings."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function onDisconnect() {
    setIsSaving(true);
    try {
      const next = await patchSettings({ disconnect: true });
      if (!next) {
        return;
      }
      setView(next);
      setEnabled(false);
      toast.success("Slack integration disconnected.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to disconnect Slack integration."
      );
    } finally {
      setIsSaving(false);
      setDisconnectOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {installError ? (
        <StatusBanner variant="error">{installError}</StatusBanner>
      ) : null}
      {installNotice ? (
        <StatusBanner variant="info">{installNotice}</StatusBanner>
      ) : null}

      <SettingsCard
        action={
          view.installed ? (
            <IntegrationStatusChip label="Active" />
          ) : (
            <NotConfiguredStatusChip />
          )
        }
        description="Install Kimiro in your Slack workspace. Members trigger it with @mention in allowed channels or DMs."
        title="Slack workspace"
      >
        {view.installed ? (
          <div className="flex flex-col gap-3 text-[13px]">
            <p className="text-muted-foreground">
              Connected to{" "}
              <span className="font-medium text-foreground">
                {view.slackTeamName ?? view.slackTeamId}
              </span>
              {view.botUserId ? (
                <>
                  {" "}
                  · bot user{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                    {view.botUserId}
                  </code>
                </>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isSaving}
                onClick={() => setDisconnectOpen(true)}
                type="button"
                variant="outline"
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-muted-foreground">
              {usesManagedApp
                ? "Install Kimiro’s shared Slack app into your workspace. Admins do not need to create a Slack app."
                : "Save your Slack app credentials below, then install the integration."}
            </p>
            <div>
              <Button
                asChild
                disabled={!view.oauthConfigured || isSaving}
                type="button"
              >
                <a href={installUrl}>Install to Slack</a>
              </Button>
            </div>
          </div>
        )}
      </SettingsCard>

      {usesManagedApp && !view.managedOAuthAvailable ? (
        <StatusBanner variant="error">
          Kimiro’s managed Slack app is not configured on this deployment yet.
          Your platform operator must set{" "}
          <code className="rounded bg-red-100/80 px-1 py-0.5 text-[11px] dark:bg-red-950/50">
            KIMIRO_MANAGED_SLACK_BOT_CLIENT_ID
          </code>
          ,{" "}
          <code className="rounded bg-red-100/80 px-1 py-0.5 text-[11px] dark:bg-red-950/50">
            KIMIRO_MANAGED_SLACK_BOT_CLIENT_SECRET
          </code>
          , and{" "}
          <code className="rounded bg-red-100/80 px-1 py-0.5 text-[11px] dark:bg-red-950/50">
            KIMIRO_MANAGED_SLACK_BOT_SIGNING_SECRET
          </code>
          .
        </StatusBanner>
      ) : null}

      <SettingsCard
        description={
          usesManagedApp
            ? "Workspaces use Kimiro’s shared Slack app. No per-tenant Slack app setup is required."
            : "OAuth credentials from your own Slack app."
        }
        title={usesManagedApp ? "Kimiro Slack app" : "Your Slack app"}
      >
        <div className="flex flex-col gap-4">
          {usesManagedApp ? (
            <>
              <div className="flex items-center gap-2 text-[13px]">
                <IntegrationStatusChip label="Recommended" />
                <span className="text-muted-foreground">
                  Managed by Kimiro — tenants only click Install to Slack.
                </span>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-[13px]">
                <p className="font-medium text-foreground">
                  Slack app checklist (fixes “Invalid permissions requested”)
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
                  <li>
                    Use a <strong className="text-foreground">dedicated</strong>{" "}
                    Slack app for this integration (not the connector app).
                  </li>
                  <li>
                    <strong className="text-foreground">
                      User Token Scopes
                    </strong>{" "}
                    must be empty — remove{" "}
                    <code className="text-[11px]">identity.*</code>,{" "}
                    <code className="text-[11px]">openid</code>, etc.
                  </li>
                  <li>
                    Add only these under{" "}
                    <strong className="text-foreground">
                      Bot Token Scopes
                    </strong>
                    :
                  </li>
                </ol>
                <pre className="mt-2 overflow-x-auto rounded bg-muted px-2 py-2 font-mono text-[11px] leading-relaxed">
                  {view.botScopeLines}
                </pre>
                <p className="mt-2 text-muted-foreground">
                  Client ID in <code className="text-[11px]">.env</code> must
                  match this Slack app.
                </p>
              </div>
            </>
          ) : null}

          {usesManagedApp && !showOwnCredentials ? (
            <button
              className="self-start text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={() => {
                setShowOwnCredentials(true);
                setCredentialMode("own");
              }}
              type="button"
            >
              Use your own Slack app instead (advanced)
            </button>
          ) : null}

          {credentialMode === "own" ? (
            <>
              <p className="text-[13px] text-muted-foreground">
                For enterprises that must run a dedicated Slack app in their own
                Slack developer account.
              </p>
              <Button
                onClick={() => {
                  setCredentialMode("managed");
                  setShowOwnCredentials(false);
                }}
                type="button"
                variant="outline"
              >
                Use Kimiro managed app instead
              </Button>
            </>
          ) : null}

          {credentialMode === "own" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="slack-integration-oauth-client-id">
                  OAuth client ID
                </Label>
                <Input
                  id="slack-integration-oauth-client-id"
                  onChange={(event) => setOauthClientId(event.target.value)}
                  placeholder="Slack app client ID"
                  value={oauthClientId}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="slack-integration-oauth-client-secret">
                  OAuth client secret
                </Label>
                <Input
                  id="slack-integration-oauth-client-secret"
                  onChange={(event) => setOauthClientSecret(event.target.value)}
                  placeholder={
                    view.hasOAuthClientSecret
                      ? "Leave blank to keep existing secret"
                      : "Slack app client secret"
                  }
                  type="password"
                  value={oauthClientSecret}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="slack-integration-signing-secret">
                  Signing secret
                </Label>
                <Input
                  id="slack-integration-signing-secret"
                  onChange={(event) => setSigningSecret(event.target.value)}
                  placeholder={
                    view.hasSigningSecret
                      ? "Leave blank to keep existing signing secret"
                      : "Slack app signing secret"
                  }
                  type="password"
                  value={signingSecret}
                />
              </div>
            </div>
          ) : null}

          {credentialMode === "own" ? (
            <div className="flex flex-col gap-1 text-[13px] text-muted-foreground">
              <p>
                OAuth redirect URI:{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  {view.oauthRedirectUri}
                </code>
              </p>
            </div>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard
        description="Control where Kimiro responds in Slack and what it can do once the agent bridge is enabled."
        title="Behavior"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium text-sm">Integration enabled</div>
              <p className="text-[13px] text-muted-foreground">
                Accept @mentions when installed.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium text-sm">Direct messages</div>
              <p className="text-[13px] text-muted-foreground">
                Allow @mention-style use in DMs with Kimiro.
              </p>
            </div>
            <Switch checked={dmsEnabled} onCheckedChange={setDmsEnabled} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium text-sm">Deliverables to Slack</div>
              <p className="text-[13px] text-muted-foreground">
                Upload generated files back to the Slack thread (Phase 3).
              </p>
            </div>
            <Switch
              checked={deliverablesEnabled}
              onCheckedChange={setDeliverablesEnabled}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slack-integration-allowed-channels">
              Allowed channel IDs
            </Label>
            <Textarea
              className="min-h-28 font-mono text-[13px]"
              id="slack-integration-allowed-channels"
              onChange={(event) => setAllowedChannelIdsText(event.target.value)}
              placeholder={"C0123456789\nC9876543210"}
              value={allowedChannelIdsText}
            />
            <p className="text-[13px] text-muted-foreground">
              One Slack channel ID per line. Leave empty to block all channels
              (DMs still follow the toggle above).
            </p>
          </div>
        </div>
      </SettingsCard>

      <div className="flex justify-end">
        <Button disabled={!isDirty || isSaving} onClick={onSave} type="button">
          {isSaving ? "Saving…" : "Save settings"}
        </Button>
      </div>

      <AlertDialog onOpenChange={setDisconnectOpen} open={disconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Slack integration?</AlertDialogTitle>
            <AlertDialogDescription>
              Kimiro will stop responding in Slack until you install again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isSaving} onClick={onDisconnect}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
