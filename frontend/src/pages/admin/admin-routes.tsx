import {
  BarChart3Icon,
  CpuIcon,
  CreditCardIcon,
  GlobeIcon,
  KeyRoundIcon,
  SettingsIcon,
  ShieldIcon,
  UnplugIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { LlmModelsSettings } from "@/components/admin/llm-models-settings";
import { SlackIntegrationSettings } from "@/components/admin/slack-integration-settings";
import { TenantAnalyticsActivity } from "@/components/admin/tenant-analytics-activity";
import {
  TenantAnalyticsUsageSummary,
  type TenantAnalyticsUsageSummary as TenantAnalyticsUsageSummaryData,
} from "@/components/admin/tenant-analytics-usage-summary";
import { TenantBillingUsage } from "@/components/admin/tenant-billing-usage";
import { TenantGeneralSettings } from "@/components/admin/tenant-general-settings";
import { TenantMcpServersAdmin } from "@/components/admin/tenant-mcp-servers-admin";
import { TenantSecuritySettings } from "@/components/admin/tenant-security-settings";
import { WebSearchSettings } from "@/components/admin/web-search-settings";
import { GroupDetailView } from "@/components/groups/group-detail-view";
import { TenantGroupsList } from "@/components/groups/tenant-groups-list";
import { McpIcon } from "@/components/icons/mcp-icon";
import { SlackMarkIcon } from "@/components/icons/slack-mark-icon";
import { IntegrationDetailView } from "@/components/integrations/integration-detail-view";
import { TenantIntegrationsList } from "@/components/integrations/tenant-integrations-list";
import { useHasCapability } from "@/components/providers/tenant-provider";
import { TenantRolesList } from "@/components/roles/tenant-roles-list";
import { TenantUsersTable } from "@/components/users/tenant-users-table";
import {
  WorkspacePageHeader,
  WorkspacePageMain,
  workspacePageHeaderIconClassName,
} from "@/components/workspace/workspace-page-layout";
import { cn } from "@/shared/utils";
import { useAdminPageBootstrap } from "../../hooks/use-admin-page-bootstrap";

function AdminAnalyticsTabs({
  activeTab,
}: {
  activeTab: "activity" | "usage";
}) {
  const tabs = [
    { id: "activity" as const, label: "Activity" },
    { id: "usage" as const, label: "Usage" },
  ];

  return (
    <div className="flex gap-1 rounded-lg border border-border/60 p-1">
      {tabs.map((tab) => (
        <Link
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            activeTab === tab.id
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          key={tab.id}
          to={`/admin/analytics?tab=${tab.id}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function AdminPageLoading() {
  return <WorkspacePageMain />;
}

function AdminPageError() {
  return (
    <WorkspacePageMain>
      <p className="text-muted-foreground text-sm">Unable to load this page.</p>
    </WorkspacePageMain>
  );
}

export function AdminGeneralPage() {
  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    view: Parameters<typeof TenantGeneralSettings>[0]["initial"];
  }>({ page: "general" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description="Organization-wide settings for workspace identity, models, sources, and retention."
        icon={<SettingsIcon className={workspacePageHeaderIconClassName} />}
        title="General"
      />
      <TenantGeneralSettings initial={data.view} tenantSlug={data.tenantSlug} />
    </WorkspacePageMain>
  );
}

export function AdminIntegrationsPage() {
  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    integrations: Parameters<
      typeof TenantIntegrationsList
    >[0]["initialIntegrations"];
  }>({ page: "integrations" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description="Manage what integrations your users can use. Members connect accounts under Connectors."
        icon={<UnplugIcon className={workspacePageHeaderIconClassName} />}
        title="Integrations"
      />
      <TenantIntegrationsList
        initialIntegrations={data.integrations}
        tenantSlug={data.tenantSlug}
      />
    </WorkspacePageMain>
  );
}

export function AdminMcpPage() {
  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    servers: Parameters<typeof TenantMcpServersAdmin>[0]["initialServers"];
  }>({ page: "mcp" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description="Register MCP servers for the workspace. Members connect them under Connectors."
        icon={<McpIcon className={workspacePageHeaderIconClassName} />}
        title="MCP servers"
      />
      <TenantMcpServersAdmin
        initialServers={data.servers}
        tenantSlug={data.tenantSlug}
      />
    </WorkspacePageMain>
  );
}

export function AdminIntegrationDetailPage({
  integrationKey,
}: {
  integrationKey: string;
}) {
  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    companyName: string;
    currentUserId: string;
    catalogDescription: string;
    initial: Parameters<typeof IntegrationDetailView>[0]["initial"];
    setupKey: string;
    members: Parameters<typeof IntegrationDetailView>[0]["members"];
  }>({ integrationKey, page: "integration-detail" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <IntegrationDetailView
        companyName={data.companyName}
        currentUserId={data.currentUserId}
        description={data.catalogDescription}
        initial={data.initial}
        key={data.setupKey}
        members={data.members}
        tenantSlug={data.tenantSlug}
      />
    </WorkspacePageMain>
  );
}

export function AdminSlackIntegrationPage() {
  const [searchParams] = useSearchParams();
  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    companyName: string;
    initialView: Parameters<typeof SlackIntegrationSettings>[0]["initialView"];
  }>({ page: "slack-integration" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  const installNotice =
    searchParams.get("slackIntegrationInstalled") === "1"
      ? "Slack integration installed successfully."
      : null;
  const installError = searchParams.get("slackIntegrationError");

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description={
          <>
            Install and configure the Kimiro Slack integration for{" "}
            {data.companyName}. Members trigger it with @mention in allowed
            channels or DMs.
          </>
        }
        icon={<SlackMarkIcon className={workspacePageHeaderIconClassName} />}
        title="Slack integration"
      />
      <SlackIntegrationSettings
        initialView={data.initialView}
        installError={installError}
        installNotice={installNotice}
        tenantSlug={data.tenantSlug}
      />
    </WorkspacePageMain>
  );
}

export function AdminModelsPage() {
  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    initialView: Parameters<typeof LlmModelsSettings>[0]["initialView"];
  }>({ page: "models" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description="Connect language model providers with your organization's API keys."
        icon={<CpuIcon className={workspacePageHeaderIconClassName} />}
        title="Models"
      />
      <LlmModelsSettings
        initialView={data.initialView}
        tenantSlug={data.tenantSlug}
      />
    </WorkspacePageMain>
  );
}

export function AdminWebSearchPage() {
  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    companyName: string;
    initialView: Parameters<typeof WebSearchSettings>[0]["initialView"];
  }>({ page: "web-search" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description={
          <>
            Configure a web search provider and crawler so Kimiro can search the
            internet for {data.companyName}.
          </>
        }
        icon={<GlobeIcon className={workspacePageHeaderIconClassName} />}
        title="Web Search"
      />
      <WebSearchSettings
        initialView={data.initialView}
        tenantSlug={data.tenantSlug}
      />
    </WorkspacePageMain>
  );
}

export function AdminUsersPage() {
  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    currentUserId: string;
    customRoles: Parameters<typeof TenantUsersTable>[0]["customRoles"];
    members: Parameters<typeof TenantUsersTable>[0]["initialMembers"];
    invites: Parameters<typeof TenantUsersTable>[0]["initialInvites"];
  }>({ page: "users" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description="Manage workspace members, roles, and access."
        icon={<UserIcon className={workspacePageHeaderIconClassName} />}
        title="Users"
      />
      <TenantUsersTable
        currentUserId={data.currentUserId}
        customRoles={data.customRoles}
        initialInvites={data.invites}
        initialMembers={data.members}
        tenantSlug={data.tenantSlug}
      />
    </WorkspacePageMain>
  );
}

export function AdminGroupsPage() {
  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    groups: Parameters<typeof TenantGroupsList>[0]["initialGroups"];
  }>({ page: "groups" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description="Create groups to organize members and manage access."
        icon={<UsersIcon className={workspacePageHeaderIconClassName} />}
        title="Groups"
      />
      <TenantGroupsList
        initialGroups={data.groups}
        tenantSlug={data.tenantSlug}
      />
    </WorkspacePageMain>
  );
}

export function AdminNewGroupPage() {
  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    pickerOptions: Parameters<typeof GroupDetailView>[0]["pickerOptions"];
  }>({ page: "groups-new" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <GroupDetailView
        mode="create"
        pickerOptions={data.pickerOptions}
        tenantSlug={data.tenantSlug}
      />
    </WorkspacePageMain>
  );
}

export function AdminGroupDetailPage({ groupId }: { groupId: string }) {
  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    group: NonNullable<Parameters<typeof GroupDetailView>[0]["initial"]>;
    pickerOptions: Parameters<typeof GroupDetailView>[0]["pickerOptions"];
  }>({ groupId, page: "group-detail" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <GroupDetailView
        initial={data.group}
        mode="edit"
        pickerOptions={data.pickerOptions}
        tenantSlug={data.tenantSlug}
      />
    </WorkspacePageMain>
  );
}

export function AdminRolesPage() {
  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    adminMemberCount: number;
    basicMemberCount: number;
    roles: Parameters<typeof TenantRolesList>[0]["initialRoles"];
  }>({ page: "roles" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description="Create custom roles and choose what members can do."
        icon={<ShieldIcon className={workspacePageHeaderIconClassName} />}
        title="Roles"
      />
      <TenantRolesList
        adminMemberCount={data.adminMemberCount}
        basicMemberCount={data.basicMemberCount}
        initialRoles={data.roles}
        tenantSlug={data.tenantSlug}
      />
    </WorkspacePageMain>
  );
}

export function AdminSecurityPage() {
  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    view: Parameters<typeof TenantSecuritySettings>[0]["initial"];
  }>({ page: "security" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description="Login methods, SSO status, domains, and access policy."
        icon={<KeyRoundIcon className={workspacePageHeaderIconClassName} />}
        title="Security"
      />
      <TenantSecuritySettings
        initial={data.view}
        tenantSlug={data.tenantSlug}
      />
    </WorkspacePageMain>
  );
}

export function AdminAuditPage() {
  return <Navigate replace to="/admin/analytics?tab=activity" />;
}

export function AdminAnalyticsPage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "usage" ? "usage" : "activity";
  const canViewAudit = useHasCapability("admin.audit");
  const canViewBilling = useHasCapability("admin.billing");

  const { data, isReady, error } = useAdminPageBootstrap<{
    tenantSlug: string;
    usageSummary: TenantAnalyticsUsageSummaryData;
  }>({ page: "analytics" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description="Workspace activity, security events, and AI usage for the current billing period."
        icon={<BarChart3Icon className={workspacePageHeaderIconClassName} />}
        title="Analytics"
      />
      <div className="flex flex-col gap-6">
        <AdminAnalyticsTabs activeTab={activeTab} />
        {activeTab === "activity" ? (
          canViewAudit ? (
            <TenantAnalyticsActivity tenantSlug={data.tenantSlug} />
          ) : (
            <p className="text-muted-foreground text-sm">
              You don&apos;t have permission to view the activity log.
            </p>
          )
        ) : (
          <TenantAnalyticsUsageSummary
            canViewBilling={canViewBilling}
            usage={data.usageSummary}
          />
        )}
      </div>
    </WorkspacePageMain>
  );
}

export function AdminBillingPage() {
  const { data, isReady, error } = useAdminPageBootstrap<{
    usage: Parameters<typeof TenantBillingUsage>[0]["usage"];
  }>({ page: "billing" });

  if (!isReady) {
    return error ? <AdminPageError /> : <AdminPageLoading />;
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description="Plan, seats, top-ups, and estimated AI usage for this workspace."
        icon={<CreditCardIcon className={workspacePageHeaderIconClassName} />}
        title="Billing"
      />
      <TenantBillingUsage usage={data.usage} />
    </WorkspacePageMain>
  );
}
