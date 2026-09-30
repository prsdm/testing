import type { Application } from "express";
import * as dmsTenantRoute from "@/core/server/api/dms/[tenantSlug]/route";
import { mountAppRoute } from "./mount-app-route";

export function mount(app: Application) {
  mountAppRoute(app, "/api/dms/:tenantSlug", dmsTenantRoute);
}
