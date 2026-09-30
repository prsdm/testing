import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { getTenantGeneralAdminView } from "@/core/lib/admin/general-settings-admin";
import {
  deleteWorkspaceLogo,
  isAllowedWorkspaceLogoSize,
  isAllowedWorkspaceLogoType,
  isWorkspaceLogoPathname,
  putWorkspaceLogo,
} from "@/core/lib/admin/workspace-logo-storage";
import { updateTenantGeneralSettings } from "@/core/lib/db/general-settings-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import { ApiResponse } from "@/core/lib/http/api-response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:general:logo`,
    "admin.general"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return ApiResponse.json(
      { error: "Expected multipart form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return ApiResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  if (!isAllowedWorkspaceLogoType(file.type)) {
    return ApiResponse.json(
      { error: "Logo must be JPEG, PNG, WebP, or SVG." },
      { status: 400 }
    );
  }

  if (!isAllowedWorkspaceLogoSize(file.size)) {
    return ApiResponse.json(
      { error: "Logo must be 2 MB or smaller." },
      { status: 400 }
    );
  }

  const tenant = authResult.tenant;
  const view = await getTenantGeneralAdminView(tenant);
  const previousPath = view.settings.logoUrl;

  let pathname: string;
  try {
    pathname = await putWorkspaceLogo({
      body: await file.arrayBuffer(),
      contentType: file.type,
      tenantId: tenant.id,
    });
  } catch {
    return ApiResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  await updateTenantGeneralSettings(tenant.id, { logoUrl: pathname });

  if (
    previousPath &&
    previousPath !== pathname &&
    isWorkspaceLogoPathname(previousPath, tenant.id)
  ) {
    await deleteWorkspaceLogo(previousPath).catch(() => null);
  }

  await insertSecurityAuditEvent({
    action: "tenant.general.logo.updated",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    resource: `admin:${tenantSlug}:general:logo`,
    tenantId: tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const nextView = await getTenantGeneralAdminView(tenant);
  return ApiResponse.json(nextView);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:general:logo`,
    "admin.general"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const tenant = authResult.tenant;
  const view = await getTenantGeneralAdminView(tenant);
  const previousPath = view.settings.logoUrl;

  await updateTenantGeneralSettings(tenant.id, { logoUrl: null });

  if (previousPath && isWorkspaceLogoPathname(previousPath, tenant.id)) {
    await deleteWorkspaceLogo(previousPath).catch(() => null);
  }

  await insertSecurityAuditEvent({
    action: "tenant.general.logo.removed",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    resource: `admin:${tenantSlug}:general:logo`,
    tenantId: tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const nextView = await getTenantGeneralAdminView(tenant);
  return ApiResponse.json(nextView);
}
