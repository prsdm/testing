import { and, eq } from "drizzle-orm";
import { confluenceGetPageMetadata } from "@/core/lib/connectors/providers/confluence/api";
import { getDb } from "@/core/lib/db/client";
import { updateTeamKbItemSourceExternalAccess } from "@/core/lib/db/source-queries";
import { type TeamSource, tenantMembers } from "@/core/lib/db/tables";
import { getConfluenceAccessForUser } from "@/core/lib/sources/confluence-access";
import { syncConfluenceSpaceMemberships } from "@/core/lib/sources/confluence-membership-sync";
import { resolveConfluencePageSourceExternalAccess } from "@/core/lib/sources/confluence-source-external-access";
import { getDriveAccessForUser } from "@/core/lib/sources/drive-access";
import { resolveDriveKbSourceExternalAccess } from "@/core/lib/sources/drive-source-external-access";
import { getSharePointAccessForUser } from "@/core/lib/sources/sharepoint-access";
import { resolveSharePointPageSourceExternalAccess } from "@/core/lib/sources/sharepoint-source-external-access";
import {
  isResolvableSourceExternalAccess,
  parseSourceExternalAccess,
  type SourceExternalAccess,
  sourceExternalAccessEqual,
} from "@/core/lib/sources/source-external-access";

const db = getDb();

export type RefreshTeamKbItemAclResult =
  | "updated"
  | "unchanged"
  | "skipped"
  | "failed";

async function getIndexerEmail(args: { tenantId: string; userId: string }) {
  const [member] = await db
    .select({ email: tenantMembers.email })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        eq(tenantMembers.authUserId, args.userId)
      )
    )
    .limit(1);
  return member?.email?.trim().toLowerCase() ?? "";
}

function parseSharePointPageRef(externalRef: string) {
  const [siteId, pageId] = externalRef.split("::");
  if (!siteId || !pageId) {
    return null;
  }
  return { pageId, siteId };
}

async function resolveItemSourceExternalAccess(args: {
  item: TeamSource;
  tenantSlug: string;
  indexerUserId: string;
  indexerEmail: string;
}): Promise<SourceExternalAccess | null> {
  const externalRef = args.item.externalRef?.trim();
  if (!externalRef) {
    return null;
  }

  if (args.item.sourceType === "drive") {
    const access = await getDriveAccessForUser({
      tenantId: args.item.tenantId,
      tenantSlug: args.tenantSlug,
      userEmail: args.indexerEmail,
      userId: args.indexerUserId,
    });
    if (!access.ok) {
      return null;
    }
    return resolveDriveKbSourceExternalAccess({
      accessToken: access.accessToken,
      fileId: externalRef,
      tenantId: args.item.tenantId,
      tenantSlug: args.tenantSlug,
      userEmail: args.indexerEmail,
    }).catch(() => null);
  }

  if (args.item.sourceType === "confluence") {
    const access = await getConfluenceAccessForUser({
      tenantId: args.item.tenantId,
      userId: args.indexerUserId,
    });
    if (!access.ok) {
      return null;
    }
    const pageMetadata = await confluenceGetPageMetadata({
      accessToken: access.accessToken,
      cloudId: access.cloudId,
      pageId: externalRef,
    }).catch(() => ({ spaceId: undefined }));
    const sourceExternalAccess =
      await resolveConfluencePageSourceExternalAccess({
        accessToken: access.accessToken,
        cloudId: access.cloudId,
        indexerEmail: args.indexerEmail,
        pageId: externalRef,
        spaceId: pageMetadata.spaceId,
      }).catch(() => null);
    if (pageMetadata.spaceId && sourceExternalAccess) {
      await syncConfluenceSpaceMemberships({
        accessToken: access.accessToken,
        cloudId: access.cloudId,
        spaceId: pageMetadata.spaceId,
        tenantId: args.item.tenantId,
      }).catch(() => undefined);
    }
    return sourceExternalAccess;
  }

  if (args.item.sourceType === "sharepoint") {
    const pageRef = parseSharePointPageRef(externalRef);
    if (!pageRef) {
      return null;
    }
    const access = await getSharePointAccessForUser({
      tenantId: args.item.tenantId,
      userId: args.indexerUserId,
    });
    if (!access.ok) {
      return null;
    }
    return resolveSharePointPageSourceExternalAccess({
      accessToken: access.accessToken,
      indexerEmail: args.indexerEmail,
      pageId: pageRef.pageId,
      siteId: pageRef.siteId,
    }).catch(() => null);
  }

  return null;
}

/**
 * Re-resolve source access for Drive/Confluence/SharePoint from their APIs.
 * Notion is intentionally skipped — Notion has no ACL API; Kimiro share-mode
 * is the access policy and is set at index time.
 */
export async function refreshTeamKbItemSourceExternalAccess(args: {
  item: TeamSource;
  tenantSlug: string;
}): Promise<RefreshTeamKbItemAclResult> {
  const indexerUserId = args.item.createdByUserId?.trim();
  if (!indexerUserId) {
    return "skipped";
  }

  const indexerEmail = await getIndexerEmail({
    tenantId: args.item.tenantId,
    userId: indexerUserId,
  });
  if (!indexerEmail) {
    return "skipped";
  }

  const resolvedAccess = await resolveItemSourceExternalAccess({
    indexerEmail,
    indexerUserId,
    item: args.item,
    tenantSlug: args.tenantSlug,
  });
  if (!isResolvableSourceExternalAccess(resolvedAccess)) {
    return "failed";
  }

  const aclChanged = !sourceExternalAccessEqual(
    parseSourceExternalAccess(args.item.sourceExternalAccess),
    resolvedAccess
  );

  await updateTeamKbItemSourceExternalAccess({
    aclChanged,
    itemId: args.item.id,
    sourceExternalAccess: resolvedAccess,
    tenantId: args.item.tenantId,
  });

  return aclChanged ? "updated" : "unchanged";
}
