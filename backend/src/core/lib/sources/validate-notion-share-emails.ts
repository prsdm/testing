import { getTenantMembersBySlug } from "@/core/lib/db/queries";
import { normalizeSourceEmail } from "@/core/lib/sources/source-external-access";

export async function filterNotionShareEmailsForTenant(args: {
  tenantSlug: string;
  indexerEmail: string;
  shareWithEmails: string[];
}) {
  const members = await getTenantMembersBySlug(args.tenantSlug);
  const allowed = new Set(
    members
      .filter((member) => member.isActive)
      .map((member) => normalizeSourceEmail(member.email))
      .filter(Boolean)
  );

  const indexerEmail = normalizeSourceEmail(args.indexerEmail);
  const filtered = [
    ...new Set(
      args.shareWithEmails
        .map((email) => normalizeSourceEmail(email))
        .filter((email) => email.length > 0 && allowed.has(email))
    ),
  ];

  if (indexerEmail && !filtered.includes(indexerEmail)) {
    filtered.unshift(indexerEmail);
  }

  return filtered;
}
