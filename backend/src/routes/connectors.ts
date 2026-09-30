import type { Application } from "express";
import * as connectorsBootstrapRoute from "@/core/server/api/connectors/[tenantSlug]/bootstrap/route";
import * as connectorsMcpConnectRoute from "@/core/server/api/connectors/[tenantSlug]/mcp/[serverId]/connect/route";
import * as connectorsMcpDisconnectRoute from "@/core/server/api/connectors/[tenantSlug]/mcp/[serverId]/disconnect/route";
import * as connectorsOauthConfluenceCallback from "@/core/server/api/connectors/oauth/confluence/callback/route";
import * as connectorsOauthConfluence from "@/core/server/api/connectors/oauth/confluence/route";
import * as connectorsOauthGoogleCallback from "@/core/server/api/connectors/oauth/google-drive/callback/route";
import * as connectorsOauthGoogle from "@/core/server/api/connectors/oauth/google-drive/route";
import * as connectorsOauthJiraCallback from "@/core/server/api/connectors/oauth/jira/callback/route";
import * as connectorsOauthJira from "@/core/server/api/connectors/oauth/jira/route";
import * as connectorsOauthNotionCallback from "@/core/server/api/connectors/oauth/notion/callback/route";
import * as connectorsOauthNotion from "@/core/server/api/connectors/oauth/notion/route";
import * as connectorsOauthSharepointCallback from "@/core/server/api/connectors/oauth/sharepoint/callback/route";
import * as connectorsOauthSharepoint from "@/core/server/api/connectors/oauth/sharepoint/route";
import * as connectorsOauthSlackCallback from "@/core/server/api/connectors/oauth/slack/callback/route";
import * as connectorsOauthSlack from "@/core/server/api/connectors/oauth/slack/route";
import * as integrationsTenantAppsConnections from "@/core/server/api/integrations/[tenantSlug]/apps/[integrationKey]/connections/route";
import * as integrationsTenantAppsKey from "@/core/server/api/integrations/[tenantSlug]/apps/[integrationKey]/route";
import * as integrationsTenantCanIndex from "@/core/server/api/integrations/[tenantSlug]/can-index/route";
import * as integrationsTenantCatalog from "@/core/server/api/integrations/[tenantSlug]/catalog/route";
import * as integrationsTenantConfluenceActions from "@/core/server/api/integrations/[tenantSlug]/confluence-actions/route";
import * as integrationsTenantDriveActions from "@/core/server/api/integrations/[tenantSlug]/drive-actions/route";
import * as integrationsTenantIndex from "@/core/server/api/integrations/[tenantSlug]/index/route";
import * as integrationsTenantJiraActions from "@/core/server/api/integrations/[tenantSlug]/jira-actions/route";
import * as integrationsTenantNotionActions from "@/core/server/api/integrations/[tenantSlug]/notion-actions/route";
import * as integrationsTenantRoute from "@/core/server/api/integrations/[tenantSlug]/route";
import * as integrationsTenantSettings from "@/core/server/api/integrations/[tenantSlug]/settings/route";
import * as integrationsTenantSettingsKey from "@/core/server/api/integrations/[tenantSlug]/settings/service-account-key/route";
import * as integrationsTenantSharepointActions from "@/core/server/api/integrations/[tenantSlug]/sharepoint-actions/route";
import * as integrationsTenantSlackActions from "@/core/server/api/integrations/[tenantSlug]/slack-actions/route";
import * as integrationsTenantSync from "@/core/server/api/integrations/[tenantSlug]/sync-memberships/route";
import * as integrationsConfluenceDisconnect from "@/core/server/api/integrations/confluence/disconnect/route";
import * as integrationsGoogleAppDisconnect from "@/core/server/api/integrations/google-app/disconnect/route";
import * as integrationsGoogleDriveDisconnect from "@/core/server/api/integrations/google-drive/disconnect/route";
import * as integrationsJiraDisconnect from "@/core/server/api/integrations/jira/disconnect/route";
import * as integrationsNotionDisconnect from "@/core/server/api/integrations/notion/disconnect/route";
import * as integrationsSharepointDisconnect from "@/core/server/api/integrations/sharepoint/disconnect/route";
import * as integrationsSlackDisconnect from "@/core/server/api/integrations/slack/disconnect/route";
import * as sourcesBootstrapRoute from "@/core/server/api/sources/[tenantSlug]/bootstrap/route";
import * as sourcesCatalog from "@/core/server/api/sources/[tenantSlug]/catalog/route";
import * as sourcesConfluenceAttachments from "@/core/server/api/sources/[tenantSlug]/confluence/attachments/route";
import * as sourcesConfluencePages from "@/core/server/api/sources/[tenantSlug]/confluence/pages/route";
import * as sourcesConfluenceSpaces from "@/core/server/api/sources/[tenantSlug]/confluence/spaces/route";
import * as sourcesDriveFiles from "@/core/server/api/sources/[tenantSlug]/drive/files/route";
import * as sourcesIndexNow from "@/core/server/api/sources/[tenantSlug]/index-now/route";
import * as sourcesNotionDatabases from "@/core/server/api/sources/[tenantSlug]/notion/databases/route";
import * as sourcesNotionPages from "@/core/server/api/sources/[tenantSlug]/notion/pages/route";
import * as sourcesPersonalIndexConfluence from "@/core/server/api/sources/[tenantSlug]/personal/index-confluence/route";
import * as sourcesPersonalIndexDrive from "@/core/server/api/sources/[tenantSlug]/personal/index-drive/route";
import * as sourcesPersonalIndexNotion from "@/core/server/api/sources/[tenantSlug]/personal/index-notion/route";
import * as sourcesPersonalIndexSharepoint from "@/core/server/api/sources/[tenantSlug]/personal/index-sharepoint/route";
import * as sourcesPersonalIndexSlack from "@/core/server/api/sources/[tenantSlug]/personal/index-slack/route";
import * as sourcesPersonalPinDrive from "@/core/server/api/sources/[tenantSlug]/personal/pin-drive/route";
import * as sourcesPersonal from "@/core/server/api/sources/[tenantSlug]/personal/route";
import * as sourcesPersonalUpload from "@/core/server/api/sources/[tenantSlug]/personal/upload/route";
import * as sourcesSharepointFiles from "@/core/server/api/sources/[tenantSlug]/sharepoint/files/route";
import * as sourcesSharepointPages from "@/core/server/api/sources/[tenantSlug]/sharepoint/pages/route";
import * as sourcesTeamIndexConfluence from "@/core/server/api/sources/[tenantSlug]/team/index-confluence/route";
import * as sourcesTeamIndexDrive from "@/core/server/api/sources/[tenantSlug]/team/index-drive/route";
import * as sourcesTeamIndexNotion from "@/core/server/api/sources/[tenantSlug]/team/index-notion/route";
import * as sourcesTeamIndexSharepoint from "@/core/server/api/sources/[tenantSlug]/team/index-sharepoint/route";
import * as sourcesTeamIndexSlack from "@/core/server/api/sources/[tenantSlug]/team/index-slack/route";
import * as sourcesTeamPinDrive from "@/core/server/api/sources/[tenantSlug]/team/pin-drive/route";
import * as sourcesTeam from "@/core/server/api/sources/[tenantSlug]/team/route";
import * as sourcesTeamUpload from "@/core/server/api/sources/[tenantSlug]/team/upload/route";
import { mountAppRoute } from "./mount-app-route";

export function mount(app: Application) {
  mountAppRoute(
    app,
    "/api/connectors/:tenantSlug/bootstrap",
    connectorsBootstrapRoute
  );
  mountAppRoute(
    app,
    "/api/connectors/:tenantSlug/mcp/:serverId/connect",
    connectorsMcpConnectRoute
  );
  mountAppRoute(
    app,
    "/api/connectors/:tenantSlug/mcp/:serverId/disconnect",
    connectorsMcpDisconnectRoute
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/bootstrap",
    sourcesBootstrapRoute
  );

  mountAppRoute(
    app,
    "/api/connectors/oauth/google-drive/callback",
    connectorsOauthGoogleCallback
  );
  mountAppRoute(
    app,
    "/api/connectors/oauth/google-drive",
    connectorsOauthGoogle
  );
  mountAppRoute(
    app,
    "/api/connectors/oauth/notion/callback",
    connectorsOauthNotionCallback
  );
  mountAppRoute(app, "/api/connectors/oauth/notion", connectorsOauthNotion);
  mountAppRoute(
    app,
    "/api/connectors/oauth/confluence/callback",
    connectorsOauthConfluenceCallback
  );
  mountAppRoute(
    app,
    "/api/connectors/oauth/confluence",
    connectorsOauthConfluence
  );
  mountAppRoute(
    app,
    "/api/connectors/oauth/sharepoint/callback",
    connectorsOauthSharepointCallback
  );
  mountAppRoute(
    app,
    "/api/connectors/oauth/sharepoint",
    connectorsOauthSharepoint
  );
  mountAppRoute(
    app,
    "/api/connectors/oauth/slack/callback",
    connectorsOauthSlackCallback
  );
  mountAppRoute(app, "/api/connectors/oauth/slack", connectorsOauthSlack);
  mountAppRoute(
    app,
    "/api/connectors/oauth/jira/callback",
    connectorsOauthJiraCallback
  );
  mountAppRoute(app, "/api/connectors/oauth/jira", connectorsOauthJira);

  mountAppRoute(
    app,
    "/api/integrations/google-drive/disconnect",
    integrationsGoogleDriveDisconnect
  );
  mountAppRoute(
    app,
    "/api/integrations/google-app/disconnect",
    integrationsGoogleAppDisconnect
  );
  mountAppRoute(
    app,
    "/api/integrations/notion/disconnect",
    integrationsNotionDisconnect
  );
  mountAppRoute(
    app,
    "/api/integrations/confluence/disconnect",
    integrationsConfluenceDisconnect
  );
  mountAppRoute(
    app,
    "/api/integrations/sharepoint/disconnect",
    integrationsSharepointDisconnect
  );
  mountAppRoute(
    app,
    "/api/integrations/slack/disconnect",
    integrationsSlackDisconnect
  );
  mountAppRoute(
    app,
    "/api/integrations/jira/disconnect",
    integrationsJiraDisconnect
  );

  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/apps/:integrationKey/connections",
    integrationsTenantAppsConnections
  );
  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/apps/:integrationKey",
    integrationsTenantAppsKey
  );
  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/settings/service-account-key",
    integrationsTenantSettingsKey
  );
  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/confluence-actions",
    integrationsTenantConfluenceActions
  );
  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/sharepoint-actions",
    integrationsTenantSharepointActions
  );
  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/notion-actions",
    integrationsTenantNotionActions
  );
  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/drive-actions",
    integrationsTenantDriveActions
  );
  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/jira-actions",
    integrationsTenantJiraActions
  );
  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/slack-actions",
    integrationsTenantSlackActions
  );
  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/sync-memberships",
    integrationsTenantSync
  );
  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/can-index",
    integrationsTenantCanIndex
  );
  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/catalog",
    integrationsTenantCatalog
  );
  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/index",
    integrationsTenantIndex
  );
  mountAppRoute(
    app,
    "/api/integrations/:tenantSlug/settings",
    integrationsTenantSettings
  );
  mountAppRoute(app, "/api/integrations/:tenantSlug", integrationsTenantRoute);

  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/personal/index-confluence",
    sourcesPersonalIndexConfluence
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/personal/index-sharepoint",
    sourcesPersonalIndexSharepoint
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/personal/index-notion",
    sourcesPersonalIndexNotion
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/personal/index-drive",
    sourcesPersonalIndexDrive
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/personal/index-slack",
    sourcesPersonalIndexSlack
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/personal/pin-drive",
    sourcesPersonalPinDrive
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/personal/upload",
    sourcesPersonalUpload
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/team/index-confluence",
    sourcesTeamIndexConfluence
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/team/index-sharepoint",
    sourcesTeamIndexSharepoint
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/team/index-notion",
    sourcesTeamIndexNotion
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/team/index-drive",
    sourcesTeamIndexDrive
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/team/index-slack",
    sourcesTeamIndexSlack
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/team/pin-drive",
    sourcesTeamPinDrive
  );
  mountAppRoute(app, "/api/sources/:tenantSlug/team/upload", sourcesTeamUpload);
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/confluence/attachments",
    sourcesConfluenceAttachments
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/confluence/pages",
    sourcesConfluencePages
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/confluence/spaces",
    sourcesConfluenceSpaces
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/sharepoint/pages",
    sourcesSharepointPages
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/sharepoint/files",
    sourcesSharepointFiles
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/notion/databases",
    sourcesNotionDatabases
  );
  mountAppRoute(
    app,
    "/api/sources/:tenantSlug/notion/pages",
    sourcesNotionPages
  );
  mountAppRoute(app, "/api/sources/:tenantSlug/drive/files", sourcesDriveFiles);
  mountAppRoute(app, "/api/sources/:tenantSlug/index-now", sourcesIndexNow);
  mountAppRoute(app, "/api/sources/:tenantSlug/catalog", sourcesCatalog);
  mountAppRoute(app, "/api/sources/:tenantSlug/personal", sourcesPersonal);
  mountAppRoute(app, "/api/sources/:tenantSlug/team", sourcesTeam);
}
