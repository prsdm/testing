import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { authUser, tenantMembers, tenantPeople } from "@/core/lib/db/tables";
import { ChatbotError } from "@/shared/errors";

export type PeopleSearchHit = {
  name: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
};

const MAX_RESULTS = 20;
const SQL_FETCH_LIMIT = 200;

function escapeIlikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function resolveMemberOrPersonField(
  memberValue: string | null,
  personValue: string | null
) {
  if (memberValue !== null) {
    const trimmed = memberValue.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return personValue?.trim() || null;
}

function scoreHit(hit: PeopleSearchHit, query: string) {
  const normalizedQuery = query.toLowerCase();
  const name = hit.name.toLowerCase();
  const email = hit.email.toLowerCase();
  const jobTitle = hit.jobTitle?.toLowerCase() ?? "";
  const department = hit.department?.toLowerCase() ?? "";

  if (name === normalizedQuery || email === normalizedQuery) {
    return 0;
  }
  if (
    name.startsWith(normalizedQuery) ||
    email.startsWith(normalizedQuery) ||
    department === normalizedQuery ||
    jobTitle === normalizedQuery
  ) {
    return 1;
  }
  if (
    name.includes(normalizedQuery) ||
    email.includes(normalizedQuery) ||
    department.includes(normalizedQuery) ||
    jobTitle.includes(normalizedQuery)
  ) {
    return 2;
  }
  return 3;
}

function orgUnitPrefixFilter(allowedOrgUnits: string[]) {
  if (allowedOrgUnits.length === 0) {
    return;
  }

  return or(
    ...allowedOrgUnits.map(
      (prefix) =>
        sql`lower(${tenantPeople.location}) like ${`${escapeIlikePattern(prefix)}%`}`
    )
  );
}

export async function searchTenantMembers(args: {
  tenantId: string;
  query: string;
  allowedOrgUnits?: string[];
}): Promise<PeopleSearchHit[]> {
  const query = args.query.trim();
  if (!query) {
    return [];
  }

  const pattern = `%${escapeIlikePattern(query)}%`;
  const allowedOrgUnits = (args.allowedOrgUnits ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  const db = getDb();

  try {
    const rows = await db
      .select({
        displayName: tenantPeople.displayName,
        email: tenantMembers.email,
        firstName: tenantPeople.firstName,
        lastName: tenantPeople.lastName,
        memberDepartment: tenantMembers.department,
        memberJobTitle: tenantMembers.jobTitle,
        personDepartment: tenantPeople.department,
        personTitle: tenantPeople.title,
        userName: authUser.name,
      })
      .from(tenantMembers)
      .innerJoin(authUser, eq(tenantMembers.authUserId, authUser.id))
      .leftJoin(tenantPeople, eq(tenantMembers.personId, tenantPeople.id))
      .where(
        and(
          eq(tenantMembers.tenantId, args.tenantId),
          eq(tenantMembers.isActive, true),
          or(isNull(tenantMembers.personId), eq(tenantPeople.status, "active")),
          orgUnitPrefixFilter(allowedOrgUnits),
          or(
            ilike(authUser.name, pattern),
            ilike(tenantMembers.email, pattern),
            ilike(tenantMembers.jobTitle, pattern),
            ilike(tenantMembers.department, pattern),
            ilike(tenantPeople.displayName, pattern),
            ilike(tenantPeople.firstName, pattern),
            ilike(tenantPeople.lastName, pattern),
            ilike(tenantPeople.title, pattern),
            ilike(tenantPeople.department, pattern)
          )
        )
      )
      .orderBy(asc(tenantMembers.email))
      .limit(SQL_FETCH_LIMIT);

    const hits: PeopleSearchHit[] = rows.map((row) => {
      const name =
        row.userName?.trim() ||
        row.displayName?.trim() ||
        `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() ||
        row.email.split("@")[0] ||
        row.email;

      return {
        department: resolveMemberOrPersonField(
          row.memberDepartment,
          row.personDepartment
        ),
        email: row.email,
        jobTitle: resolveMemberOrPersonField(
          row.memberJobTitle,
          row.personTitle
        ),
        name,
      };
    });

    return hits
      .sort((a, b) => {
        const scoreDiff = scoreHit(a, query) - scoreHit(b, query);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, MAX_RESULTS);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to search people"
    );
  }
}
