import type { Application } from "express";
import * as channelMembersRoute from "@/core/server/api/channels/[tenantSlug]/[channelId]/members/route";
import * as channelRoute from "@/core/server/api/channels/[tenantSlug]/[channelId]/route";
import * as channelsTenantRoute from "@/core/server/api/channels/[tenantSlug]/route";
import { mountAppRoute } from "./mount-app-route";

export function mount(app: Application) {
  mountAppRoute(
    app,
    "/api/channels/:tenantSlug/:channelId/members",
    channelMembersRoute
  );
  mountAppRoute(app, "/api/channels/:tenantSlug/:channelId", channelRoute);
  mountAppRoute(app, "/api/channels/:tenantSlug", channelsTenantRoute);
}
