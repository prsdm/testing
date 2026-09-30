import { confluenceFetch } from "@/core/lib/connectors/providers/confluence/api";
import {
  isResolvableSourceExternalAccess,
  normalizeSourceEmail,
  restrictedSourceExternalAccess,
  type SourceExternalAccess,
} from "@/core/lib/sources/source-external-access";

type ConfluenceRestrictionUser = {
  type?: string;
  email?: string;
  accountId?: string;
};

type ConfluenceRestrictionGroup = {
  type?: string;
  name?: string;
  id?: string;
};

async function fetchPageReadRestrictions(args: {
  cloudId: string;
  accessToken: string;
  pageId: string;
}) {
  const params = new URLSearchParams({
    expand: "restrictions.user,restrictions.group",
  });
  const response = await confluenceFetch({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
    path: `/wiki/rest/api/content/${encodeURIComponent(args.pageId)}/restriction/byOperation/read?${params.toString()}`,
  });
  const payload = (await response.json()) as {
    restrictions?: {
      user?: { results?: ConfluenceRestrictionUser[] };
      group?: { results?: ConfluenceRestrictionGroup[] };
    };
  };
  return payload.restrictions;
}

async function fetchConfluenceUserEmail(args: {
  cloudId: string;
  accessToken: string;
  accountId: string;
}) {
  const response = await confluenceFetch({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
    path: `/wiki/rest/api/user?accountId=${encodeURIComponent(args.accountId)}`,
  }).catch(() => null);
  if (!response) {
    return null;
  }
  const payload = (await response.json()) as { email?: string };
  const email = normalizeSourceEmail(payload.email ?? "");
  return email.length > 0 ? email : null;
}

export async function fetchSpacePermissionAssignments(args: {
  cloudId: string;
  accessToken: string;
  spaceId: string;
}) {
  const userEmails = new Set<string>();
  const groupIds = new Set<string>();
  const unresolvedAccountIds = new Set<string>();
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams({ limit: "100" });
    if (cursor) {
      params.set("cursor", cursor);
    }
    const response = await confluenceFetch({
      accessToken: args.accessToken,
      cloudId: args.cloudId,
      path: `/wiki/api/v2/spaces/${encodeURIComponent(args.spaceId)}/permissions?${params.toString()}`,
    }).catch(() => null);
    if (!response) {
      break;
    }
    const payload = (await response.json()) as {
      results?: Array<{
        principal?: {
          type?: string;
          id?: string;
          displayName?: string;
        };
      }>;
      _links?: { next?: string };
    };
    for (const row of payload.results ?? []) {
      const principal = row.principal;
      if (!principal?.type || !principal.id) {
        continue;
      }
      const principalId = principal.id.trim().toLowerCase();
      if (principal.type === "group") {
        groupIds.add(principalId);
        continue;
      }
      if (principal.type === "user") {
        unresolvedAccountIds.add(principalId);
      }
    }
    const next = payload._links?.next;
    if (!next) {
      break;
    }
    const nextUrl = new URL(next, "https://api.atlassian.com");
    cursor = nextUrl.searchParams.get("cursor") ?? undefined;
    if (!cursor) {
      break;
    }
  }

  for (const accountId of unresolvedAccountIds) {
    const email = await fetchConfluenceUserEmail({
      accessToken: args.accessToken,
      accountId,
      cloudId: args.cloudId,
    });
    if (email) {
      userEmails.add(email);
      continue;
    }
    groupIds.add(`account:${accountId}`);
  }

  return { groupIds, userEmails };
}

export async function resolveConfluencePageSourceExternalAccess(args: {
  cloudId: string;
  accessToken: string;
  pageId: string;
  spaceId?: string;
  indexerEmail: string;
}): Promise<SourceExternalAccess | null> {
  const userEmails = new Set<string>();
  const groupIds = new Set<string>();

  const restrictions = await fetchPageReadRestrictions({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
    pageId: args.pageId,
  }).catch(() => null);

  for (const user of restrictions?.user?.results ?? []) {
    const email = normalizeSourceEmail(user.email ?? "");
    if (email) {
      userEmails.add(email);
    }
  }
  for (const group of restrictions?.group?.results ?? []) {
    const groupId =
      group.id?.trim().toLowerCase() ?? group.name?.trim().toLowerCase();
    if (groupId) {
      groupIds.add(groupId);
    }
  }

  if (userEmails.size === 0 && groupIds.size === 0 && args.spaceId) {
    const spacePermissions = await fetchSpacePermissionAssignments({
      accessToken: args.accessToken,
      cloudId: args.cloudId,
      spaceId: args.spaceId,
    });
    for (const email of spacePermissions.userEmails) {
      userEmails.add(email);
    }
    for (const groupId of spacePermissions.groupIds) {
      groupIds.add(groupId);
    }
    if (groupIds.size === 0 && userEmails.size === 0) {
      groupIds.add(`space:${args.spaceId.trim().toLowerCase()}`);
    }
  }

  const indexerEmail = normalizeSourceEmail(args.indexerEmail);
  if (indexerEmail) {
    userEmails.add(indexerEmail);
  }

  const access = restrictedSourceExternalAccess({
    groupIds,
    userEmails,
  });
  return isResolvableSourceExternalAccess(access) ? access : null;
}
