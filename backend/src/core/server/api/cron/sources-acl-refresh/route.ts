import { refreshKnowledgeAclsForAllTenants } from "@/core/lib/sources/acl-refresh-orchestrator";

/** ACL refresh walks memberships + a batch of KB items (Cloud Run / long request). */
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batchSizeParam = new URL(request.url).searchParams.get("batchSize");
  const parsedBatchSize = batchSizeParam
    ? Number.parseInt(batchSizeParam, 10)
    : undefined;
  const batchSize =
    parsedBatchSize && parsedBatchSize > 0 ? parsedBatchSize : undefined;

  const results = await refreshKnowledgeAclsForAllTenants({ batchSize });
  return Response.json({
    results,
    tenantsProcessed: results.length,
  });
}
