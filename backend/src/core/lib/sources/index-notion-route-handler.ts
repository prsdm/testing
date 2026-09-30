import { isTenantAdminEmail } from "@/core/lib/db/queries";
import type { indexNotionBodySchema } from "@/core/lib/sources/index-notion-body-schema";
import { indexNotionToKb } from "@/core/lib/sources/index-notion-to-source";
import { filterNotionShareEmailsForTenant } from "@/core/lib/sources/validate-notion-share-emails";
import { resolveNotionShareMode } from "@/shared/sources/notion-share-mode";

export async function handleIndexNotionRequest(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  body: ReturnType<typeof indexNotionBodySchema.parse>;
}) {
  const actorIsAdmin = await isTenantAdminEmail({
    email: args.userEmail,
    tenantId: args.tenantId,
  });

  const shareMode = resolveNotionShareMode({
    shareMode: args.body.shareMode,
    shareWithTeam: args.body.shareWithTeam,
  });

  if (shareMode === "workspace" && !actorIsAdmin) {
    return Response.json(
      {
        error: "Only workspace admins can share Notion content with everyone.",
      },
      { status: 403 }
    );
  }

  const shareWithEmails =
    shareMode === "selected"
      ? await filterNotionShareEmailsForTenant({
          indexerEmail: args.userEmail,
          shareWithEmails: args.body.shareWithEmails ?? [],
          tenantSlug: args.tenantSlug,
        })
      : [];

  if (
    shareMode === "selected" &&
    shareWithEmails.filter((email) => email !== args.userEmail.toLowerCase())
      .length === 0 &&
    (args.body.shareWithEmails?.length ?? 0) > 0
  ) {
    return Response.json(
      { error: "Selected teammates must belong to this workspace." },
      { status: 400 }
    );
  }

  const result = await indexNotionToKb({
    actorIsAdmin,
    databaseIds: args.body.databaseIds,
    pageIds: args.body.pageIds,
    shareMode,
    shareWithEmails,
    tenantId: args.tenantId,
    userEmail: args.userEmail,
    userId: args.userId,
  });
  if (!result.ok) {
    return Response.json(
      { error: result.error, results: result.results },
      { status: 400 }
    );
  }

  return Response.json({ results: result.results });
}
