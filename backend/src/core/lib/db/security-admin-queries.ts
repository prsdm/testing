import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { ChatbotError } from "@/shared/errors";
import {
  providerLabelById,
  type SupportedSsoProvider,
} from "@/shared/sso/providers";
import { getDb } from "./client";
import {
  securityAuditEvents,
  type Tenant,
  tenantDomains,
  tenantSsoConfigs,
} from "./tables";

const db = getDb();

const DOMAIN_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export type TenantSecurityDomainRow = {
  id: string;
  domain: string;
  isPrimary: boolean;
  verifiedAt: string | null;
  createdAt: string;
};

export type TenantSecurityAdminView = {
  login: {
    methods: Array<{ id: "sso"; label: string; enforced: boolean }>;
    note: string;
  };
  sso: {
    configured: boolean;
    provider: SupportedSsoProvider | null;
    providerLabel: string | null;
    issuerUrl: string | null;
    clientId: string | null;
    status: "pending" | "active" | "disabled" | null;
    updatedAt: string | null;
  };
  domains: TenantSecurityDomainRow[];
  accessPolicy: {
    allowedOrgUnits: string[];
  };
};

function readAllowedOrgUnits(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const directory = (metadata as Record<string, unknown>).directory;
  if (!directory || typeof directory !== "object" || Array.isArray(directory)) {
    return [];
  }
  const allowed = (directory as Record<string, unknown>).allowedOrgUnits;
  if (!Array.isArray(allowed)) {
    return [];
  }
  return allowed
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function normalizeDomainInput(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

export function isValidDomain(value: string) {
  return DOMAIN_PATTERN.test(value) && value.length <= 255;
}

export async function getTenantSecurityAdminView(
  tenant: Tenant
): Promise<TenantSecurityAdminView> {
  try {
    const [[sso], domains] = await Promise.all([
      db
        .select({
          clientId: tenantSsoConfigs.clientId,
          issuerUrl: tenantSsoConfigs.issuerUrl,
          metadata: tenantSsoConfigs.metadata,
          provider: tenantSsoConfigs.provider,
          status: tenantSsoConfigs.status,
          updatedAt: tenantSsoConfigs.updatedAt,
        })
        .from(tenantSsoConfigs)
        .where(eq(tenantSsoConfigs.tenantId, tenant.id))
        .limit(1),
      db
        .select({
          createdAt: tenantDomains.createdAt,
          domain: tenantDomains.domain,
          id: tenantDomains.id,
          verifiedAt: tenantDomains.verifiedAt,
        })
        .from(tenantDomains)
        .where(eq(tenantDomains.tenantId, tenant.id))
        .orderBy(tenantDomains.createdAt),
    ]);

    const provider = (sso?.provider ?? null) as SupportedSsoProvider | null;

    return {
      accessPolicy: {
        allowedOrgUnits: readAllowedOrgUnits(sso?.metadata),
      },
      domains: domains.map((domain) => ({
        createdAt: domain.createdAt.toISOString(),
        domain: domain.domain,
        id: domain.id,
        isPrimary: domain.domain === tenant.primaryDomain,
        verifiedAt: domain.verifiedAt?.toISOString() ?? null,
      })),
      login: {
        methods: [
          {
            enforced: true,
            id: "sso",
            label: "Single sign-on (SSO)",
          },
        ],
        note: "Password login is disabled. Members sign in with your workspace SSO provider.",
      },
      sso: {
        clientId: sso?.clientId ?? null,
        configured: Boolean(sso),
        issuerUrl: sso?.issuerUrl ?? null,
        provider,
        providerLabel: provider ? providerLabelById[provider] : null,
        status: sso?.status ?? null,
        updatedAt: sso?.updatedAt?.toISOString() ?? null,
      },
    };
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to load security settings"
    );
  }
}

export async function addTenantDomain({
  tenantId,
  domain,
}: {
  tenantId: string;
  domain: string;
}) {
  const normalized = normalizeDomainInput(domain);
  if (!isValidDomain(normalized)) {
    throw new ChatbotError("bad_request:api", "Enter a valid domain.");
  }

  try {
    const [created] = await db
      .insert(tenantDomains)
      .values({
        domain: normalized,
        tenantId,
        verifiedAt: new Date(),
      })
      .returning({
        createdAt: tenantDomains.createdAt,
        domain: tenantDomains.domain,
        id: tenantDomains.id,
        verifiedAt: tenantDomains.verifiedAt,
      });

    return created;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("tenant_domain_unique")) {
      throw new ChatbotError(
        "bad_request:api",
        "That domain is already in use."
      );
    }
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to add domain"
    );
  }
}

export async function removeTenantDomain({
  tenantId,
  domainId,
  primaryDomain,
}: {
  tenantId: string;
  domainId: string;
  primaryDomain: string;
}) {
  try {
    const [existing] = await db
      .select({
        domain: tenantDomains.domain,
        id: tenantDomains.id,
      })
      .from(tenantDomains)
      .where(
        and(
          eq(tenantDomains.tenantId, tenantId),
          eq(tenantDomains.id, domainId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new ChatbotError("bad_request:api", "Domain not found.");
    }

    if (existing.domain === primaryDomain) {
      throw new ChatbotError(
        "bad_request:api",
        "The primary domain can’t be removed."
      );
    }

    await db
      .delete(tenantDomains)
      .where(
        and(
          eq(tenantDomains.tenantId, tenantId),
          eq(tenantDomains.id, domainId)
        )
      );

    return existing;
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to remove domain"
    );
  }
}

export type SecurityAuditEventRow = {
  id: string;
  createdAt: string;
  action: string;
  email: string | null;
  resource: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
};

export async function listSecurityAuditEvents({
  tenantId,
  query,
  actionPrefix,
  from,
  to,
  limit = 50,
  offset = 0,
}: {
  tenantId: string;
  query?: string;
  actionPrefix?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ events: SecurityAuditEventRow[]; total: number }> {
  const normalizedQuery = query?.trim() ?? "";
  const normalizedPrefix = actionPrefix?.trim() ?? "";
  const filters = [eq(securityAuditEvents.tenantId, tenantId)];

  if (normalizedPrefix) {
    filters.push(ilike(securityAuditEvents.action, `${normalizedPrefix}%`));
  }

  if (from) {
    filters.push(gte(securityAuditEvents.createdAt, from));
  }

  if (to) {
    filters.push(lte(securityAuditEvents.createdAt, to));
  }

  if (normalizedQuery) {
    const pattern = `%${normalizedQuery}%`;
    const searchFilter = or(
      ilike(securityAuditEvents.action, pattern),
      ilike(securityAuditEvents.email, pattern),
      ilike(securityAuditEvents.resource, pattern)
    );
    if (searchFilter) {
      filters.push(searchFilter);
    }
  }

  try {
    const whereClause = and(...filters);
    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(securityAuditEvents)
      .where(whereClause);

    const rows = await db
      .select({
        action: securityAuditEvents.action,
        createdAt: securityAuditEvents.createdAt,
        email: securityAuditEvents.email,
        id: securityAuditEvents.id,
        ipAddress: securityAuditEvents.ipAddress,
        metadata: securityAuditEvents.metadata,
        resource: securityAuditEvents.resource,
      })
      .from(securityAuditEvents)
      .where(whereClause)
      .orderBy(desc(securityAuditEvents.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100))
      .offset(Math.max(offset, 0));

    return {
      events: rows.map((row) => ({
        action: row.action,
        createdAt: row.createdAt.toISOString(),
        email: row.email,
        id: row.id,
        ipAddress: row.ipAddress,
        metadata:
          row.metadata &&
          typeof row.metadata === "object" &&
          !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : null,
        resource: row.resource,
      })),
      total: countRow?.total ?? 0,
    };
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to list security audit events"
    );
  }
}
