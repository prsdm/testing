import {
  completePeopleSyncRun,
  createPeopleSyncIssue,
  createPeopleSyncRun,
  getTenantById,
  getTenantPeopleProviderConfigBySlug,
  linkTenantMembersPersonIdByEmail,
  upsertTenantPerson,
} from "@/core/lib/db/queries";
import { ChatbotError } from "@/shared/errors";
import { fetchProviderPeople } from "./connectors";

export async function runTenantPeopleSyncBySlug(slug: string) {
  const providerConfig = await getTenantPeopleProviderConfigBySlug(slug);
  if (providerConfig?.status !== "active") {
    throw new ChatbotError(
      "bad_request:api",
      "People sync is not configured for this tenant"
    );
  }

  const metadata =
    providerConfig.metadata &&
    typeof providerConfig.metadata === "object" &&
    !Array.isArray(providerConfig.metadata)
      ? (providerConfig.metadata as {
          peopleSync?: {
            provider?: "google_workspace" | "okta" | "azure_ad";
          };
        })
      : null;
  const peopleProvider =
    metadata?.peopleSync?.provider ?? providerConfig.provider;

  const run = await createPeopleSyncRun({
    provider: peopleProvider,
    source: "idp_pull",
    tenantId: providerConfig.tenantId,
  });

  try {
    const people = await fetchProviderPeople({
      metadata: providerConfig.metadata,
      provider: peopleProvider,
      slug: providerConfig.slug,
      tenantId: providerConfig.tenantId,
    });

    let usersUpserted = 0;
    let usersDeactivated = 0;
    let errorsCount = 0;

    for (const person of people) {
      try {
        await upsertTenantPerson({
          department: person.department,
          displayName: person.displayName,
          email: person.email,
          externalId: person.externalId,
          firstName: person.firstName,
          issuer: peopleProvider,
          lastName: person.lastName,
          location: person.location,
          managerEmail: person.managerEmail,
          provider: peopleProvider,
          source: "idp_pull",
          status: person.status,
          subject: person.externalId,
          tenantId: providerConfig.tenantId,
          title: person.title,
          userData: person.raw,
        });
        usersUpserted += 1;
        if (person.status === "inactive") {
          usersDeactivated += 1;
        }
      } catch (error) {
        errorsCount += 1;
        await createPeopleSyncIssue({
          externalId: person.externalId,
          issueCode: "upsert_failed",
          issueMessage:
            error instanceof Error ? error.message : "Unknown error",
          personEmail: person.email,
          tenantId: providerConfig.tenantId,
        });
      }
    }

    await linkTenantMembersPersonIdByEmail(providerConfig.tenantId);

    await completePeopleSyncRun({
      errorsCount,
      metadata: {
        tenantSlug: slug,
      },
      runId: run.id,
      status: errorsCount > 0 ? "partial" : "success",
      usersDeactivated,
      usersProcessed: people.length,
      usersUpserted,
    });

    return {
      errorsCount,
      runId: run.id,
      usersDeactivated,
      usersProcessed: people.length,
      usersUpserted,
    };
  } catch (error) {
    await completePeopleSyncRun({
      errorsCount: 1,
      metadata: {
        error: error instanceof Error ? error.message : "Unknown sync error",
      },
      runId: run.id,
      status: "failed",
      usersDeactivated: 0,
      usersProcessed: 0,
      usersUpserted: 0,
    });
    throw error;
  }
}

export async function runTenantPeopleSyncById(tenantId: string) {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new ChatbotError("not_found:api", "Tenant not found");
  }
  return runTenantPeopleSyncBySlug(tenant.slug);
}
