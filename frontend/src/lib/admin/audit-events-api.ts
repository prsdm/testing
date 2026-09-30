import type { SecurityAuditEventRow } from "@/contracts/admin";
import type { AuditEventCategoryId } from "@/shared/admin/audit-event-categories";

export type AuditEventsQuery = {
  q?: string;
  category?: AuditEventCategoryId;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type AuditEventsResponse = {
  events: SecurityAuditEventRow[];
  total: number;
  limit: number;
  offset: number;
};

export function auditEventsApiUrl(
  tenantSlug: string,
  query: AuditEventsQuery
): string {
  const search = new URLSearchParams();
  if (query.q?.trim()) {
    search.set("q", query.q.trim());
  }
  if (query.category && query.category !== "all") {
    search.set("category", query.category);
  }
  if (query.from?.trim()) {
    search.set("from", query.from.trim());
  }
  if (query.to?.trim()) {
    search.set("to", query.to.trim());
  }
  if (query.limit != null) {
    search.set("limit", String(query.limit));
  }
  if (query.offset != null) {
    search.set("offset", String(query.offset));
  }
  const suffix = search.toString();
  return `/api/admin/${tenantSlug}/audit-events${suffix ? `?${suffix}` : ""}`;
}

export async function fetchAuditEvents(
  tenantSlug: string,
  query: AuditEventsQuery
): Promise<AuditEventsResponse> {
  const response = await fetch(auditEventsApiUrl(tenantSlug, query), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to load audit events (${response.status})`);
  }
  return response.json();
}
