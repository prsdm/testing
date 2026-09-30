import { getTenantGeneralAdminView } from "@/core/lib/admin/general-settings-admin";
import {
  isWorkspaceLogoPathname,
  readWorkspaceLogo,
} from "@/core/lib/admin/workspace-logo-storage";
import { ApiResponse } from "@/core/lib/http/api-response";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const view = await getTenantGeneralAdminView(authResult.tenant);
  const pathname = view.settings.logoUrl;
  if (!(pathname && isWorkspaceLogoPathname(pathname, authResult.tenant.id))) {
    return ApiResponse.json({ error: "Not found" }, { status: 404 });
  }

  let object: Awaited<ReturnType<typeof readWorkspaceLogo>>;
  try {
    object = await readWorkspaceLogo(pathname);
  } catch {
    return ApiResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!object) {
    return ApiResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(object.stream, {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Type": object.contentType,
      "Referrer-Policy": "no-referrer",
    },
    status: 200,
  });
}
