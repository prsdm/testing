"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  type ConnectorProvider,
  ConnectorProviderIcon,
} from "@/components/connectors/connector-provider-icon";
import {
  type IntegrationMemberOption,
  IntegrationSetupForm,
  type IntegrationSetupInitial,
} from "@/components/integrations/integration-setup-form";
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
import {
  WorkspacePageBackButton,
  WorkspacePageHeader,
  workspacePageHeaderIconClassName,
} from "@/components/workspace/workspace-page-layout";

export function IntegrationDetailView({
  tenantSlug,
  companyName,
  members,
  initial,
  description,
  currentUserId,
}: {
  tenantSlug: string;
  companyName: string;
  members: IntegrationMemberOption[];
  initial: IntegrationSetupInitial;
  description: string;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [removeOpen, setRemoveOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const isEnabled = initial.availability.isEnabled;

  async function removeIntegration() {
    setIsRemoving(true);
    try {
      const response = await fetch(
        `/api/integrations/${tenantSlug}/apps/${initial.key}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          code?: string;
          error?: string;
        } | null;
        if (payload?.code === "REAUTH_REQUIRED") {
          window.location.assign("/login?reason=reauth");
          return;
        }
        toast.error(payload?.error ?? "Failed to remove integration.");
        return;
      }

      setRemoveOpen(false);
      setIsRemoving(false);
      toast.success(`${initial.name} removed.`);
      router.push("/admin/integrations");
      router.refresh();
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <>
      <WorkspacePageHeader
        description={description}
        icon={
          <ConnectorProviderIcon
            className={workspacePageHeaderIconClassName}
            provider={initial.provider as ConnectorProvider}
          />
        }
        title={initial.name}
      />

      <IntegrationSetupForm
        backLink={
          <WorkspacePageBackButton href="/admin/integrations" label="Back" />
        }
        companyName={companyName}
        currentUserId={currentUserId}
        initial={initial}
        isRemovingIntegration={isRemoving}
        members={members}
        onRemoveIntegration={isEnabled ? () => setRemoveOpen(true) : undefined}
        tenantSlug={tenantSlug}
      />

      <AlertDialog
        onOpenChange={(open) => {
          setRemoveOpen(open);
          if (!open) {
            setIsRemoving(false);
          }
        }}
        open={removeOpen}
      >
        <AlertDialogContent className="[&_button]:cursor-pointer">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {initial.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This turns {initial.name} off, clears its admin setup, and
              disconnects everyone who connected it. You&apos;ll need to set it
              up again from the start to reactivate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving} type="button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isRemoving}
              onClick={(event) => {
                event.preventDefault();
                removeIntegration().catch(() => undefined);
              }}
              type="button"
            >
              {isRemoving ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
