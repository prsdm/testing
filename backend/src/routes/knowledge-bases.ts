import type { Application } from "express";
import * as knowledgeBaseCatalogRoute from "@/core/server/api/knowledge-bases/[tenantSlug]/[knowledgeBaseId]/catalog/route";
import * as knowledgeBaseCatalogStaleRoute from "@/core/server/api/knowledge-bases/[tenantSlug]/[knowledgeBaseId]/catalog/stale/route";
import * as knowledgeBaseDriveRoute from "@/core/server/api/knowledge-bases/[tenantSlug]/[knowledgeBaseId]/drive/route";
import * as knowledgeBaseMembersRoute from "@/core/server/api/knowledge-bases/[tenantSlug]/[knowledgeBaseId]/members/route";
import * as knowledgeBaseRoute from "@/core/server/api/knowledge-bases/[tenantSlug]/[knowledgeBaseId]/route";
import * as knowledgeBaseSearchRoute from "@/core/server/api/knowledge-bases/[tenantSlug]/[knowledgeBaseId]/search/route";
import * as knowledgeBaseSourcesRoute from "@/core/server/api/knowledge-bases/[tenantSlug]/[knowledgeBaseId]/sources/route";
import * as knowledgeBaseUploadRoute from "@/core/server/api/knowledge-bases/[tenantSlug]/[knowledgeBaseId]/upload/route";
import * as knowledgeBasesTenantRoute from "@/core/server/api/knowledge-bases/[tenantSlug]/route";
import { mountAppRoute } from "./mount-app-route";

export function mount(app: Application) {
  mountAppRoute(
    app,
    "/api/knowledge-bases/:tenantSlug/:knowledgeBaseId/catalog/stale",
    knowledgeBaseCatalogStaleRoute
  );
  mountAppRoute(
    app,
    "/api/knowledge-bases/:tenantSlug/:knowledgeBaseId/catalog",
    knowledgeBaseCatalogRoute
  );
  mountAppRoute(
    app,
    "/api/knowledge-bases/:tenantSlug/:knowledgeBaseId/sources",
    knowledgeBaseSourcesRoute
  );
  mountAppRoute(
    app,
    "/api/knowledge-bases/:tenantSlug/:knowledgeBaseId/upload",
    knowledgeBaseUploadRoute
  );
  mountAppRoute(
    app,
    "/api/knowledge-bases/:tenantSlug/:knowledgeBaseId/search",
    knowledgeBaseSearchRoute
  );
  mountAppRoute(
    app,
    "/api/knowledge-bases/:tenantSlug/:knowledgeBaseId/drive",
    knowledgeBaseDriveRoute
  );
  mountAppRoute(
    app,
    "/api/knowledge-bases/:tenantSlug/:knowledgeBaseId/members",
    knowledgeBaseMembersRoute
  );
  mountAppRoute(
    app,
    "/api/knowledge-bases/:tenantSlug/:knowledgeBaseId",
    knowledgeBaseRoute
  );
  mountAppRoute(
    app,
    "/api/knowledge-bases/:tenantSlug",
    knowledgeBasesTenantRoute
  );
}
