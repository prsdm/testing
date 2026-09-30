import {
  indexNotionDatabasesToKb,
  type NotionDatabaseIndexResult,
} from "@/core/lib/sources/index-notion-databases";
import {
  indexNotionPagesToKb,
  type NotionIndexResult,
} from "@/core/lib/sources/index-notion-pages";

export type NotionKbIndexResult =
  | ({ kind: "page" } & NotionIndexResult)
  | ({ kind: "database" } & NotionDatabaseIndexResult);

import type { NotionShareMode } from "@/shared/sources/notion-share-mode";

export async function indexNotionToKb(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
  pageIds?: string[];
  databaseIds?: string[];
  shareMode?: NotionShareMode;
  shareWithEmails?: string[];
  actorIsAdmin?: boolean;
}): Promise<
  | { ok: false; error: string; results: NotionKbIndexResult[] }
  | { ok: true; results: NotionKbIndexResult[] }
> {
  const pageIds = args.pageIds ?? [];
  const databaseIds = args.databaseIds ?? [];
  if (pageIds.length === 0 && databaseIds.length === 0) {
    return {
      error: "Select at least one Notion page or database.",
      ok: false,
      results: [],
    };
  }

  const results: NotionKbIndexResult[] = [];

  if (pageIds.length > 0) {
    const pageResult = await indexNotionPagesToKb({
      actorIsAdmin: args.actorIsAdmin,
      pageIds,
      shareMode: args.shareMode,
      shareWithEmails: args.shareWithEmails,
      tenantId: args.tenantId,
      userEmail: args.userEmail,
      userId: args.userId,
    });
    results.push(
      ...pageResult.results.map((result) => ({
        kind: "page" as const,
        ...result,
      }))
    );
    if (!pageResult.ok && databaseIds.length === 0) {
      return { error: pageResult.error, ok: false, results };
    }
  }

  if (databaseIds.length > 0) {
    const databaseResult = await indexNotionDatabasesToKb({
      actorIsAdmin: args.actorIsAdmin,
      databaseIds,
      shareMode: args.shareMode,
      shareWithEmails: args.shareWithEmails,
      tenantId: args.tenantId,
      userEmail: args.userEmail,
      userId: args.userId,
    });
    results.push(
      ...databaseResult.results.map((result) => ({
        kind: "database" as const,
        ...result,
      }))
    );
    if (!databaseResult.ok && pageIds.length === 0) {
      return { error: databaseResult.error, ok: false, results };
    }
  }

  const anyOk = results.some((result) => result.ok);
  if (!anyOk) {
    return {
      error: results.at(0)?.error ?? "Could not index selected Notion content.",
      ok: false,
      results,
    };
  }

  return { ok: true, results };
}
