import {
  isResolvableSourceExternalAccess,
  normalizeSourceEmail,
  parseSourceExternalAccess,
  restrictedSourceExternalAccess,
  type SourceExternalAccess,
} from "@/core/lib/sources/source-external-access";
import type { NotionShareMode } from "@/shared/sources/notion-share-mode";
import { resolveNotionShareMode } from "@/shared/sources/notion-share-mode";

/**
 * Notion has no native page ACL API. Access for indexed Notion content is
 * declared via Kimiro share-mode (indexers / selected / workspace), not
 * synced from Notion permissions.
 */
function uniqueEmails(emails: Iterable<string>) {
  return [
    ...new Set(
      [...emails].map((email) => normalizeSourceEmail(email)).filter(Boolean)
    ),
  ];
}

function mergeIndexerEmails(args: {
  indexerEmail: string;
  existingAccess: SourceExternalAccess | null;
}) {
  const merged = new Set<string>(
    args.existingAccess?.isTenantPublic
      ? args.existingAccess.userEmails
      : (args.existingAccess?.userEmails ?? [])
  );
  merged.add(args.indexerEmail);
  return [...merged];
}

function actorCanManageAccess(args: {
  actorUserId: string;
  ownerUserId?: string | null;
  actorIsAdmin?: boolean;
}) {
  return args.actorUserId === args.ownerUserId || args.actorIsAdmin === true;
}

function buildSelectedUserEmails(args: {
  indexerEmail: string;
  shareWithEmails: string[];
  existingAccess: SourceExternalAccess | null;
  actorUserId: string;
  ownerUserId?: string | null;
  actorIsAdmin?: boolean;
}) {
  const normalizedSelected = uniqueEmails(args.shareWithEmails);
  if (
    actorCanManageAccess({
      actorIsAdmin: args.actorIsAdmin,
      actorUserId: args.actorUserId,
      ownerUserId: args.ownerUserId,
    })
  ) {
    return uniqueEmails([args.indexerEmail, ...normalizedSelected]);
  }
  const existingEmails =
    args.existingAccess && !args.existingAccess.isTenantPublic
      ? args.existingAccess.userEmails
      : [];
  return uniqueEmails([
    args.indexerEmail,
    ...existingEmails,
    ...normalizedSelected,
  ]);
}

export function resolveNotionSourceExternalAccess(args: {
  indexerEmail: string;
  shareMode?: NotionShareMode;
  shareWithEmails?: string[];
  shareWithTeam?: boolean;
  existingAccess?: unknown;
  ownerUserId?: string | null;
  actorUserId: string;
  actorIsAdmin?: boolean;
}): SourceExternalAccess | null {
  const indexerEmail = normalizeSourceEmail(args.indexerEmail);
  if (!indexerEmail) {
    return null;
  }

  const existing = parseSourceExternalAccess(args.existingAccess);
  const shareMode = resolveNotionShareMode({
    shareMode: args.shareMode,
    shareWithTeam: args.shareWithTeam,
  });

  if (shareMode === "workspace") {
    if (!args.actorIsAdmin) {
      return existing?.isTenantPublic ? existing : null;
    }
    const access: SourceExternalAccess = {
      groupIds: existing?.groupIds ?? [],
      isTenantPublic: true,
      userEmails: mergeIndexerEmails({
        existingAccess: existing,
        indexerEmail,
      }),
    };
    return isResolvableSourceExternalAccess(access) ? access : null;
  }

  if (existing?.isTenantPublic) {
    const canUnpublish = actorCanManageAccess({
      actorIsAdmin: args.actorIsAdmin,
      actorUserId: args.actorUserId,
      ownerUserId: args.ownerUserId,
    });
    if (!canUnpublish) {
      return existing;
    }
  }

  if (shareMode === "selected") {
    const access = restrictedSourceExternalAccess({
      groupIds: existing?.isTenantPublic ? [] : (existing?.groupIds ?? []),
      userEmails: buildSelectedUserEmails({
        actorIsAdmin: args.actorIsAdmin,
        actorUserId: args.actorUserId,
        existingAccess: existing,
        indexerEmail,
        ownerUserId: args.ownerUserId,
        shareWithEmails: args.shareWithEmails ?? [],
      }),
    });
    return isResolvableSourceExternalAccess(access) ? access : null;
  }

  const access = restrictedSourceExternalAccess({
    groupIds: existing?.isTenantPublic ? [] : (existing?.groupIds ?? []),
    userEmails: mergeIndexerEmails({ existingAccess: existing, indexerEmail }),
  });
  return isResolvableSourceExternalAccess(access) ? access : null;
}

export function resolveNotionPageSourceExternalAccess(args: {
  indexerEmail: string;
  shareMode?: NotionShareMode;
  shareWithEmails?: string[];
  shareWithTeam?: boolean;
  existingAccess?: unknown;
  ownerUserId?: string | null;
  actorUserId: string;
  actorIsAdmin?: boolean;
}): SourceExternalAccess | null {
  return resolveNotionSourceExternalAccess(args);
}

export function resolveNotionDatabaseSourceExternalAccess(args: {
  indexerEmail: string;
  shareMode?: NotionShareMode;
  shareWithEmails?: string[];
  shareWithTeam?: boolean;
  existingAccess?: unknown;
  ownerUserId?: string | null;
  actorUserId: string;
  actorIsAdmin?: boolean;
}): SourceExternalAccess | null {
  return resolveNotionSourceExternalAccess(args);
}
