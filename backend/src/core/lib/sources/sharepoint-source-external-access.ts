import { graphFetch } from "@/core/lib/connectors/providers/sharepoint/api";
import {
  isResolvableSourceExternalAccess,
  normalizeSourceEmail,
  restrictedSourceExternalAccess,
  type SourceExternalAccess,
  tenantPublicSourceExternalAccess,
} from "@/core/lib/sources/source-external-access";

type GraphPermission = {
  grantedToIdentitiesV2?: Array<{
    user?: { email?: string };
    group?: { id?: string; displayName?: string };
  }>;
  link?: { scope?: string };
};

function parseGraphPermissions(permissions: GraphPermission[]) {
  const userEmails = new Set<string>();
  const groupIds = new Set<string>();
  let isTenantPublic = false;

  for (const permission of permissions) {
    if (permission.link?.scope === "anonymous") {
      isTenantPublic = true;
    }
    for (const identity of permission.grantedToIdentitiesV2 ?? []) {
      const email = normalizeSourceEmail(identity.user?.email ?? "");
      if (email) {
        userEmails.add(email);
      }
      const groupId =
        identity.group?.id?.trim().toLowerCase() ??
        identity.group?.displayName?.trim().toLowerCase();
      if (groupId) {
        groupIds.add(groupId);
      }
    }
  }

  if (isTenantPublic) {
    return tenantPublicSourceExternalAccess();
  }

  return restrictedSourceExternalAccess({ groupIds, userEmails });
}

async function fetchSharePointGraphPermissions(args: {
  accessToken: string;
  path: string;
}) {
  const response = await graphFetch({
    accessToken: args.accessToken,
    path: args.path,
  }).catch(() => null);
  if (!response?.ok) {
    return null;
  }
  const payload = (await response.json()) as {
    value?: GraphPermission[];
  };
  const access = parseGraphPermissions(payload.value ?? []);
  return isResolvableSourceExternalAccess(access) ? access : null;
}

export async function resolveSharePointPageSourceExternalAccess(args: {
  accessToken: string;
  siteId: string;
  pageId: string;
  indexerEmail: string;
}): Promise<SourceExternalAccess | null> {
  const pageAccess = await fetchSharePointGraphPermissions({
    accessToken: args.accessToken,
    path: `/sites/${encodeURIComponent(args.siteId)}/pages/${encodeURIComponent(args.pageId)}/microsoft.graph.sitePage/permissions`,
  });
  if (pageAccess) {
    return pageAccess;
  }

  const siteAccess = await fetchSharePointGraphPermissions({
    accessToken: args.accessToken,
    path: `/sites/${encodeURIComponent(args.siteId)}/permissions`,
  });
  if (siteAccess) {
    return siteAccess;
  }

  const indexerEmail = normalizeSourceEmail(args.indexerEmail);
  if (!indexerEmail) {
    return null;
  }
  const access = restrictedSourceExternalAccess({ userEmails: [indexerEmail] });
  return isResolvableSourceExternalAccess(access) ? access : null;
}
