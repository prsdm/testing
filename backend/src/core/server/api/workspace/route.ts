import { auth } from "@/core/lib/auth/server-session";
import { getWorkspacePlanLabelForUser } from "@/core/lib/billing/workspace-plan-label";
import {
  getWorkspaceLogoUrlsByTenantIds,
  getWorkspaceView,
} from "@/core/lib/db/general-settings-queries";
import {
  clearTenantIdCacheForUser,
  getTenantAccessContextByEmail,
  getTenantBySlug,
  isTenantMemberAccessAllowed,
} from "@/core/lib/db/queries";
import { listActiveTenantsForAuthUserId } from "@/core/lib/db/self-serve-workspace";
import { ApiResponse } from "@/core/lib/http/api-response";
import { evaluateTenantAccess } from "@/core/lib/tenant/access-gate";
import {
  ACTIVE_TENANT_COOKIE,
  ACTIVE_TENANT_COOKIE_OPTIONS,
} from "@/core/lib/tenant/active-tenant";
import { resolveTenantForUser } from "@/core/lib/tenant/resolve-tenant-for-user";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !session.user.id) {
    return ApiResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await resolveTenantForUser({
    authUserId: session.user.id,
    email: session.user.email,
  });
  if (!tenant) {
    return ApiResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [memberAllowed, accessContext, workspaces] = await Promise.all([
    isTenantMemberAccessAllowed({
      authUserId: session.user.id,
      tenantId: tenant.id,
    }),
    getTenantAccessContextByEmail(session.user.email),
    listActiveTenantsForAuthUserId(session.user.id),
  ]);
  const denial = evaluateTenantAccess({
    allowedOrgUnits: accessContext?.allowedOrgUnits ?? [],
    memberAllowed,
    personOrgUnit: accessContext?.personOrgUnit ?? null,
    personStatus: accessContext?.personStatus,
  });
  if (denial) {
    return ApiResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [workspace, logoByTenantId, planLabel] = await Promise.all([
    getWorkspaceView(tenant.id),
    getWorkspaceLogoUrlsByTenantIds(workspaces.map((item) => item.id)),
    getWorkspacePlanLabelForUser({
      authUserId: session.user.id,
      tenantId: tenant.id,
    }),
  ]);
  if (!workspace) {
    return ApiResponse.json({ error: "Not found" }, { status: 404 });
  }

  const response = ApiResponse.json({
    ...workspace,
    activeTenantSlug: tenant.slug,
    planLabel,
    workspaces: workspaces.map((item) => ({
      companyName: item.companyName,
      id: item.id,
      logoUrl: logoByTenantId.get(item.id) ?? null,
      primaryDomain: item.primaryDomain,
      slug: item.slug,
    })),
  });
  response.cookies.set(
    ACTIVE_TENANT_COOKIE,
    tenant.slug,
    ACTIVE_TENANT_COOKIE_OPTIONS
  );
  return response;
}

/** Switch active workspace. Body: { slug: string } */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !session.user.id) {
    return ApiResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let slug: string | undefined;
  try {
    const body = (await request.json()) as { slug?: unknown };
    slug = typeof body.slug === "string" ? body.slug.trim() : undefined;
  } catch {
    return ApiResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!slug) {
    return ApiResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const tenant = await getTenantBySlug(slug);
  if (tenant?.status !== "active") {
    return ApiResponse.json({ error: "Not found" }, { status: 404 });
  }

  const memberAllowed = await isTenantMemberAccessAllowed({
    authUserId: session.user.id,
    tenantId: tenant.id,
  });
  if (!memberAllowed) {
    return ApiResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  clearTenantIdCacheForUser(session.user.id);

  const response = ApiResponse.json({
    companyName: tenant.companyName,
    ok: true,
    tenantSlug: tenant.slug,
  });
  response.cookies.set(
    ACTIVE_TENANT_COOKIE,
    tenant.slug,
    ACTIVE_TENANT_COOKIE_OPTIONS
  );
  return response;
}
