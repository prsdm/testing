"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/admin/settings-card";
import {
  IntegrationStatusChip,
  NotConfiguredStatusChip,
} from "@/components/integrations/integration-status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TenantSecurityAdminView } from "@/contracts/admin";

function SsoStatusChip({
  status,
}: {
  status: TenantSecurityAdminView["sso"]["status"];
}) {
  if (status === "active") {
    return <IntegrationStatusChip label="Active" />;
  }
  if (status === "disabled") {
    return (
      <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-[10px] text-red-700 dark:bg-red-500/10 dark:text-red-400">
        Disabled
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-[10px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
        Pending
      </span>
    );
  }
  return <NotConfiguredStatusChip />;
}

function PrimaryDomainChip() {
  return (
    <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-[10px] text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
      Primary
    </span>
  );
}

export function TenantSecuritySettings({
  tenantSlug,
  initial,
}: {
  tenantSlug: string;
  initial: TenantSecurityAdminView;
}) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [domainDraft, setDomainDraft] = useState("");
  const [orgUnitsDraft, setOrgUnitsDraft] = useState(
    initial.accessPolicy.allowedOrgUnits.join("\n")
  );
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [removingDomainId, setRemovingDomainId] = useState<string | null>(null);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);

  useEffect(() => {
    setView(initial);
    setOrgUnitsDraft(initial.accessPolicy.allowedOrgUnits.join("\n"));
  }, [initial]);

  const policyDirty =
    orgUnitsDraft
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n") !== view.accessPolicy.allowedOrgUnits.join("\n");

  async function addDomain() {
    const domain = domainDraft.trim();
    if (!domain) {
      toast.error("Enter a domain.");
      return;
    }

    setIsAddingDomain(true);
    const response = await fetch(`/api/admin/${tenantSlug}/security/domains`, {
      body: JSON.stringify({ domain }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setIsAddingDomain(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(payload?.error ?? "Failed to add domain.");
      return;
    }

    setDomainDraft("");
    toast.success("Domain added.");
    router.refresh();
  }

  async function removeDomain(domainId: string) {
    setRemovingDomainId(domainId);
    const response = await fetch(
      `/api/admin/${tenantSlug}/security/domains/${domainId}`,
      { method: "DELETE" }
    );
    setRemovingDomainId(null);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(payload?.error ?? "Failed to remove domain.");
      return;
    }

    toast.success("Domain removed.");
    router.refresh();
  }

  async function saveAccessPolicy() {
    const allowedOrgUnits = orgUnitsDraft
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    setIsSavingPolicy(true);
    const response = await fetch(
      `/api/admin/${tenantSlug}/security/access-policy`,
      {
        body: JSON.stringify({ allowedOrgUnits }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }
    );
    setIsSavingPolicy(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(payload?.error ?? "Failed to save access policy.");
      return;
    }

    toast.success("Access policy saved.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard description={view.login.note} title="Login methods">
        <ul className="flex flex-col gap-2">
          {view.login.methods.map((method) => (
            <li
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5"
              key={method.id}
            >
              <span className="font-medium text-sm">{method.label}</span>
              {method.enforced ? (
                <IntegrationStatusChip label="Active" />
              ) : (
                <NotConfiguredStatusChip />
              )}
            </li>
          ))}
        </ul>
      </SettingsCard>

      <SettingsCard
        description="Identity provider used for workspace sign-in."
        title="SSO"
      >
        {view.sso.configured ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm">
                {view.sso.providerLabel ?? "SSO provider"}
              </span>
              <SsoStatusChip status={view.sso.status} />
            </div>
            <dl className="grid gap-2 text-[13px]">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="w-28 shrink-0 text-muted-foreground">Issuer</dt>
                <dd className="min-w-0 break-all">{view.sso.issuerUrl}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="w-28 shrink-0 text-muted-foreground">
                  Client ID
                </dt>
                <dd className="min-w-0 break-all">{view.sso.clientId}</dd>
              </div>
            </dl>
            <p className="text-[13px] text-muted-foreground">
              To rotate SSO credentials, run workspace setup again with a new
              setup token.
            </p>
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            SSO is not configured for this workspace yet.
          </p>
        )}
      </SettingsCard>

      <SettingsCard
        description="Email domains that can sign in to this workspace."
        title="Login domains"
      >
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {view.domains.map((domain) => (
              <li
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                key={domain.id}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-sm">
                    {domain.domain}
                  </span>
                  {domain.isPrimary ? <PrimaryDomainChip /> : null}
                </span>
                {domain.isPrimary ? null : (
                  <Button
                    disabled={removingDomainId === domain.id}
                    onClick={() => {
                      removeDomain(domain.id).catch(() => undefined);
                    }}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2Icon />
                    <span className="sr-only">Remove {domain.domain}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              className="rounded-lg"
              onChange={(event) => setDomainDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addDomain().catch(() => undefined);
                }
              }}
              placeholder="example.com"
              value={domainDraft}
            />
            <Button
              disabled={isAddingDomain || !domainDraft.trim()}
              onClick={() => {
                addDomain().catch(() => undefined);
              }}
              type="button"
            >
              <PlusIcon />
              {isAddingDomain ? "Adding…" : "Add domain"}
            </Button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        action={
          <Button
            disabled={!policyDirty || isSavingPolicy || !view.sso.configured}
            onClick={() => {
              saveAccessPolicy().catch(() => undefined);
            }}
            size="sm"
            type="button"
          >
            {isSavingPolicy ? "Saving…" : "Save"}
          </Button>
        }
        description="Optional org-unit prefixes. Leave empty to allow all synced people. One prefix per line."
        title="Access policy"
      >
        <Textarea
          className="min-h-28 rounded-lg"
          disabled={!view.sso.configured}
          onChange={(event) => setOrgUnitsDraft(event.target.value)}
          placeholder={"/Engineering\n/Sales"}
          value={orgUnitsDraft}
        />
      </SettingsCard>
    </div>
  );
}
