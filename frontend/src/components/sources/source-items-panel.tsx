"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NotionShareMemberOption } from "@/components/sources/notion-share-controls";
import { KbCatalogTable } from "@/components/sources/source-catalog-table";

type KbScope = "personal" | "team";

export function KbItemsPanel({
  tenantSlug,
  scope,
  viewerUserId,
  viewerEmail,
  notionShareMembers,
  canPublishToWorkspace,
  canWrite,
}: {
  tenantSlug: string;
  scope: KbScope;
  viewerUserId: string;
  viewerEmail: string;
  notionShareMembers: NotionShareMemberOption[];
  canPublishToWorkspace: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [catalogRefreshToken, setCatalogRefreshToken] = useState(0);

  function refreshCatalog() {
    setCatalogRefreshToken((current) => current + 1);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {canWrite ? null : (
        <p className="text-muted-foreground text-sm">
          You can browse workspace knowledge here.
        </p>
      )}

      <KbCatalogTable
        canPublishToWorkspace={canPublishToWorkspace}
        canWrite={canWrite}
        notionShareMembers={notionShareMembers}
        onIndexed={refreshCatalog}
        refreshToken={catalogRefreshToken}
        scope={scope}
        tenantSlug={tenantSlug}
        viewerEmail={viewerEmail}
        viewerUserId={viewerUserId}
      />
    </div>
  );
}

export type { KbItemView } from "@/lib/sources/source-item-view";
