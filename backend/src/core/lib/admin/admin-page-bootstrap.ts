import {
  assertTenantAdminConsoleRequest,
  assertTenantCapabilityRequest,
} from "@/core/lib/admin/assert-tenant-admin-request";
import { getTenantGeneralAdminView } from "@/core/lib/admin/general-settings-admin";
import {
  ensureTenantBilling,
  isTenantSubscriptionActive,
} from "@/core/lib/db/billing-queries";
import {
  listMemberCustomRoleIds,
  listTenantCustomRoles,
} from "@/core/lib/db/custom-role-queries";
import { getTenantLlmAdminView } from "@/core/lib/db/llm-provider-queries";
import { listTenantMcpServersForAdmin } from "@/core/lib/db/mcp-queries";
import {
  getTenantPeopleGroupDetail,
  listGroupMemberPickerOptions,
  listTenantPeopleGroups,
} from "@/core/lib/db/people-group-queries";
import { getTenantMembersBySlug } from "@/core/lib/db/queries";
import {
  getTenantSecurityAdminView,
  listSecurityAuditEvents,
} from "@/core/lib/db/security-admin-queries";
import { getTenantSlackIntegrationAdminView } from "@/core/lib/db/slack-integration-queries";
import { listPendingTenantInvites } from "@/core/lib/db/tenant-invite-queries";
import { getTenantUsageMonthSummary } from "@/core/lib/db/usage-queries";
import { getTenantWebSearchAdminView } from "@/core/lib/db/web-search-queries";
import {
  getIntegrationAdminDetail,
  getTenantIntegrationsAdminView,
} from "@/core/lib/integrations/integration-admin";
import {
  ADMIN_BOOTSTRAP_PAGES,
  type AdminBootstrapPage,
} from "@/shared/admin/admin-bootstrap-pages";
import type { CapabilityId } from "@/shared/auth/capabilities";
import {
  getIntegrationCatalogEntry,
  isIntegrationKey,
} from "@/shared/integrations/integration-catalog";
import type { IntegrationSetupInitial } from "@/shared/integrations/integration-setup-state";
import { savedStateKeyFromInitial } from "@/shared/integrations/integration-setup-state";

export type { AdminBootstrapPage } from "@/shared/admin/admin-bootstrap-pages";
export { ADMIN_BOOTSTRAP_PAGES } from "@/shared/admin/admin-bootstrap-pages";

const PAGE_CAPABILITY: Record<
  AdminBootstrapPage,
  CapabilityId | "console" | null
> = {
  analytics: "console",
  audit: "admin.audit",
  billing: "admin.billing",
  general: "admin.general",
  "group-detail": "admin.groups",
  groups: "admin.groups",
  "groups-new": "admin.groups",
  "integration-detail": "admin.integrations",
  integrations: "admin.integrations",
  mcp: "admin.integrations",
  models: "admin.models",
  roles: "admin.roles",
  security: "admin.security",
  "slack-integration": "admin.slack_integration",
  users: "admin.users",
  "web-search": "admin.web_search",
};

export type AdminPageBootstrapQuery = {
  page: AdminBootstrapPage;
  integrationKey?: string;
  groupId?: string;
};

function parseAdminBootstrapQuery(url: URL): AdminPageBootstrapQuery | null {
  const page = url.searchParams.get("page")?.trim();
  if (!page || !ADMIN_BOOTSTRAP_PAGES.includes(page as AdminBootstrapPage)) {
    return null;
  }

  return {
    groupId: url.searchParams.get("groupId")?.trim() || undefined,
    integrationKey: url.searchParams.get("integrationKey")?.trim() || undefined,
    page: page as AdminBootstrapPage,
  };
}

async function assertAdminPageAuth(
  tenantSlug: string,
  request: Request,
  page: AdminBootstrapPage
) {
  const resource = `admin:${tenantSlug}:bootstrap:${page}`;
  const capability = PAGE_CAPABILITY[page];

  if (capability === "console") {
    return await assertTenantAdminConsoleRequest(tenantSlug, request, resource);
  }

  if (!capability) {
    return {
      error: Response.json({ error: "Invalid page" }, { status: 400 }),
    } as const;
  }

  return await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    resource,
    capability
  );
}

export async function loadAdminPageBootstrap(
  tenantSlug: string,
  request: Request
) {
  const query = parseAdminBootstrapQuery(new URL(request.url));
  if (!query) {
    return {
      error: Response.json(
        { error: "Invalid bootstrap page" },
        { status: 400 }
      ),
    } as const;
  }

  const authResult = await assertAdminPageAuth(tenantSlug, request, query.page);
  if ("error" in authResult) {
    return authResult;
  }

  const { tenant, userId } = authResult;

  switch (query.page) {
    case "general": {
      const view = await getTenantGeneralAdminView(tenant);
      return { page: query.page, tenantSlug: tenant.slug, view };
    }
    case "integrations": {
      const integrations = await getTenantIntegrationsAdminView(tenant.id);
      return {
        integrations: integrations.map((integration) => ({
          connectionsCount: integration.connectionsCount,
          isEnabled: integration.isEnabled,
          key: integration.key,
          name: integration.name,
          provider: integration.provider,
        })),
        page: query.page,
        tenantSlug: tenant.slug,
      };
    }
    case "mcp": {
      const servers = await listTenantMcpServersForAdmin(tenant.id);
      return {
        page: query.page,
        servers,
        tenantSlug: tenant.slug,
      };
    }
    case "integration-detail": {
      const integrationKey = query.integrationKey;
      if (!integrationKey || !isIntegrationKey(integrationKey)) {
        return {
          error: Response.json({ error: "Not found" }, { status: 404 }),
        } as const;
      }

      const catalogEntry = getIntegrationCatalogEntry(integrationKey);
      if (!catalogEntry) {
        return {
          error: Response.json({ error: "Not found" }, { status: 404 }),
        } as const;
      }

      const [detail, members] = await Promise.all([
        getIntegrationAdminDetail(tenant.id, integrationKey),
        getTenantMembersBySlug(tenant.slug),
      ]);

      if (!detail) {
        return {
          error: Response.json({ error: "Not found" }, { status: 404 }),
        } as const;
      }

      const memberOptions = members
        .filter((member) => member.isActive)
        .map((member) => ({
          authUserId: member.authUserId,
          displayName:
            member.displayName?.trim() ||
            `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() ||
            member.email.split("@")[0] ||
            member.email,
          email: member.email,
          id: member.id,
          image: member.image,
        }));

      const initial: IntegrationSetupInitial = {
        availability: detail.availability,
        credentials: detail.credentials,
        key: detail.key,
        name: detail.name,
        provider: detail.provider,
        requiresSiteUrl: detail.requiresSiteUrl,
      };

      return {
        catalogDescription: catalogEntry.description,
        companyName: tenant.companyName,
        currentUserId: userId,
        initial,
        integrationKey,
        members: memberOptions,
        page: query.page,
        setupKey: `${integrationKey}-${savedStateKeyFromInitial(initial)}`,
        tenantSlug: tenant.slug,
      };
    }
    case "slack-integration": {
      const initialView = await getTenantSlackIntegrationAdminView(tenant.id);
      return {
        companyName: tenant.companyName,
        initialView,
        page: query.page,
        tenantSlug: tenant.slug,
      };
    }
    case "models": {
      const initialView = await getTenantLlmAdminView(tenant.id);
      return { initialView, page: query.page, tenantSlug: tenant.slug };
    }
    case "web-search": {
      const initialView = await getTenantWebSearchAdminView(tenant.id);
      return {
        companyName: tenant.companyName,
        initialView,
        page: query.page,
        tenantSlug: tenant.slug,
      };
    }
    case "users": {
      const [members, customRoles, pendingInvites] = await Promise.all([
        getTenantMembersBySlug(tenant.slug),
        listTenantCustomRoles(tenant.id),
        listPendingTenantInvites(tenant.id),
      ]);

      const customRoleIdsByMember = await listMemberCustomRoleIds({
        memberIds: members.map((member) => member.id),
        tenantId: tenant.id,
      });

      return {
        currentUserId: userId,
        customRoles: customRoles.map((role) => ({
          id: role.id,
          name: role.name,
        })),
        invites: pendingInvites.map((invite) => ({
          createdAt: invite.createdAt.toISOString(),
          email: invite.email,
          expiresAt: invite.expiresAt.toISOString(),
          id: invite.id,
          role: invite.role,
        })),
        members: members.map((member) => ({
          authUserId: member.authUserId,
          createdAt: member.createdAt.toISOString(),
          customRoleIds: customRoleIdsByMember.get(member.id) ?? [],
          department:
            member.memberDepartment?.trim() ||
            member.personDepartment?.trim() ||
            null,
          displayName:
            member.userName?.trim() ||
            member.displayName?.trim() ||
            `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() ||
            null,
          email: member.email,
          id: member.id,
          isActive: member.isActive,
          jobTitle:
            member.jobTitle?.trim() || member.personTitle?.trim() || null,
          lastLoginAt: member.lastLoginAt?.toISOString() ?? null,
          role: member.role,
        })),
        page: query.page,
        tenantSlug: tenant.slug,
      };
    }
    case "groups": {
      const groups = await listTenantPeopleGroups(tenant.id);
      return {
        groups: groups.map((group) => ({
          createdAt: group.createdAt.toISOString(),
          id: group.id,
          memberCount: group.memberCount,
          name: group.name,
        })),
        page: query.page,
        tenantSlug: tenant.slug,
      };
    }
    case "groups-new": {
      const pickerOptions = await listGroupMemberPickerOptions(tenant.id);
      return {
        page: query.page,
        pickerOptions,
        tenantSlug: tenant.slug,
      };
    }
    case "group-detail": {
      const groupId = query.groupId;
      if (!groupId) {
        return {
          error: Response.json({ error: "groupId required" }, { status: 400 }),
        } as const;
      }

      const [group, pickerOptions] = await Promise.all([
        getTenantPeopleGroupDetail({
          groupId,
          tenantId: tenant.id,
        }),
        listGroupMemberPickerOptions(tenant.id),
      ]);

      if (!group) {
        return {
          error: Response.json({ error: "Not found" }, { status: 404 }),
        } as const;
      }

      return {
        group,
        groupId,
        page: query.page,
        pickerOptions,
        tenantSlug: tenant.slug,
      };
    }
    case "roles": {
      const [roles, members] = await Promise.all([
        listTenantCustomRoles(tenant.id),
        getTenantMembersBySlug(tenant.slug),
      ]);

      const adminMemberCount = members.filter(
        (member) => member.role === "admin" && member.isActive
      ).length;
      const basicMemberCount = members.filter(
        (member) => member.role === "basic" && member.isActive
      ).length;

      return {
        adminMemberCount,
        basicMemberCount,
        page: query.page,
        roles: roles.map((role) => ({
          capabilityIds: role.capabilityIds,
          createdAt: role.createdAt.toISOString(),
          description: role.description,
          id: role.id,
          memberCount: role.memberCount,
          name: role.name,
          updatedAt: role.updatedAt.toISOString(),
        })),
        tenantSlug: tenant.slug,
      };
    }
    case "security": {
      const view = await getTenantSecurityAdminView(tenant);
      return { page: query.page, tenantSlug: tenant.slug, view };
    }
    case "audit": {
      const { events, total } = await listSecurityAuditEvents({
        limit: 200,
        offset: 0,
        tenantId: tenant.id,
      });

      return {
        events,
        page: query.page,
        tenantSlug: tenant.slug,
        total,
      };
    }
    case "analytics": {
      const usage = await getTenantUsageMonthSummary(tenant.id);

      return {
        page: query.page,
        tenantSlug: tenant.slug,
        usageSummary: {
          atLimit: usage.atLimit,
          eventCount: usage.eventCount,
          imageGenerationCount: usage.imageGenerationCount,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          percentUsed: usage.percentUsed,
          periodEnd: usage.periodEnd,
          sandboxExecCount: usage.sandboxExecCount,
          softWarn: usage.softWarn,
          usedUsd: usage.usedUsd,
          webSearchCount: usage.webSearchCount,
        },
      };
    }
    case "billing": {
      const [usage, billing] = await Promise.all([
        getTenantUsageMonthSummary(tenant.id),
        ensureTenantBilling(tenant.id),
      ]);
      const subscriptionActive = isTenantSubscriptionActive(billing);

      return {
        page: query.page,
        tenantSlug: tenant.slug,
        usage: {
          allocatedQuotaUsdCents: usage.allocatedQuotaUsdCents,
          allowanceUsdCents: usage.allowanceUsdCents,
          atLimit: usage.atLimit,
          eventCount: usage.eventCount,
          imageGenerationCount: usage.imageGenerationCount,
          inputTokens: usage.inputTokens,
          members: usage.members.map((member) => ({
            atLimit: member.atLimit,
            authUserId: member.authUserId,
            displayName: member.displayName,
            email: member.email,
            isCustomQuota: member.isCustomQuota,
            percentUsed: member.percentUsed,
            quotaUsdCents: member.quotaUsdCents,
            softWarn: member.softWarn,
            usedUsd: member.usedUsd,
          })),
          outputTokens: usage.outputTokens,
          overageUsd: usage.overageUsd,
          percentUsed: usage.percentUsed,
          periodEnd: usage.periodEnd,
          perSeatAllowanceUsdCents: usage.perSeatAllowanceUsdCents,
          sandboxExecCount: usage.sandboxExecCount,
          sandboxExecDurationMs: usage.sandboxExecDurationMs,
          seatCount: usage.seatCount,
          softWarn: usage.softWarn,
          subscription: {
            currentPeriodEnd: billing.currentPeriodEnd?.toISOString() ?? null,
            interval:
              billing.interval === "year" || billing.interval === "month"
                ? billing.interval
                : null,
            isActive: subscriptionActive,
            seatQuantity: billing.seatQuantity,
            status: billing.status,
          },
          tenantSlug: tenant.slug,
          topUpBalanceUsd: usage.topUpBalanceUsd,
          topUpBalanceUsdCents: usage.topUpBalanceUsdCents,
          usedUsd: usage.usedUsd,
          webSearchCount: usage.webSearchCount,
        },
      };
    }
    default: {
      return {
        error: Response.json({ error: "Invalid page" }, { status: 400 }),
      } as const;
    }
  }
}
