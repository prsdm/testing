import type { Application } from "express";
import * as artifactsAttachConfluenceRoute from "@/core/server/api/artifacts/[tenantSlug]/attach-from-confluence/route";
import * as artifactsAttachDriveRoute from "@/core/server/api/artifacts/[tenantSlug]/attach-from-drive/route";
import * as artifactsAttachSharepointRoute from "@/core/server/api/artifacts/[tenantSlug]/attach-from-sharepoint/route";
import * as artifactsExportDriveRoute from "@/core/server/api/artifacts/[tenantSlug]/export-to-drive/route";
import * as artifactsImportDriveRoute from "@/core/server/api/artifacts/[tenantSlug]/import-from-drive/route";
import * as artifactsImportUploadRoute from "@/core/server/api/artifacts/[tenantSlug]/import-from-upload/route";
import * as libraryExportDriveRoute from "@/core/server/api/library/[tenantSlug]/[fileId]/export-to-drive/route";
import * as libraryPreviewRoute from "@/core/server/api/library/[tenantSlug]/[fileId]/preview/route";
import * as libraryFileRoute from "@/core/server/api/library/[tenantSlug]/[fileId]/route";
import * as libraryCloudExportRoute from "@/core/server/api/library/[tenantSlug]/cloud-export-status/route";
import * as libraryTenantRoute from "@/core/server/api/library/[tenantSlug]/route";
import { mountAppRoute } from "./mount-app-route";

export function mount(app: Application) {
  mountAppRoute(
    app,
    "/api/library/:tenantSlug/cloud-export-status",
    libraryCloudExportRoute
  );
  mountAppRoute(
    app,
    "/api/library/:tenantSlug/:fileId/preview",
    libraryPreviewRoute
  );
  mountAppRoute(
    app,
    "/api/library/:tenantSlug/:fileId/export-to-drive",
    libraryExportDriveRoute
  );
  mountAppRoute(app, "/api/library/:tenantSlug/:fileId", libraryFileRoute);
  mountAppRoute(app, "/api/library/:tenantSlug", libraryTenantRoute);

  mountAppRoute(
    app,
    "/api/artifacts/:tenantSlug/attach-from-confluence",
    artifactsAttachConfluenceRoute
  );
  mountAppRoute(
    app,
    "/api/artifacts/:tenantSlug/attach-from-drive",
    artifactsAttachDriveRoute
  );
  mountAppRoute(
    app,
    "/api/artifacts/:tenantSlug/attach-from-sharepoint",
    artifactsAttachSharepointRoute
  );
  mountAppRoute(
    app,
    "/api/artifacts/:tenantSlug/export-to-drive",
    artifactsExportDriveRoute
  );
  mountAppRoute(
    app,
    "/api/artifacts/:tenantSlug/import-from-drive",
    artifactsImportDriveRoute
  );
  mountAppRoute(
    app,
    "/api/artifacts/:tenantSlug/import-from-upload",
    artifactsImportUploadRoute
  );
}
