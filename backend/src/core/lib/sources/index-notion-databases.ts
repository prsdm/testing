import { notionGetDatabaseLink } from "@/core/lib/connectors/providers/notion/database-link";
import { queryAllNotionDatabaseRows } from "@/core/lib/connectors/providers/notion/query-database-rows";
import { notionGetPageContent } from "@/core/lib/connectors/providers/notion/read";
import { listNotionWorkspaceUsers } from "@/core/lib/connectors/providers/notion/resolve-notion-user";
import {
  extractNotionPageTitleFromProperties,
  type NotionUserLookup,
  propertiesNeedUserLookup,
  serializeNotionPageProperties,
  toNotionUserLookup,
} from "@/core/lib/connectors/providers/notion/serialize-page-properties";
import {
  getTeamKbNotionItemByExternalRef,
  upsertTeamKbNotionItem,
} from "@/core/lib/db/source-queries";
import {
  getMaxIndexedContentBytesForTenant,
  resolveReadableContent,
} from "@/core/lib/sources/index-content-limits";
import { getNotionAccessForUser } from "@/core/lib/sources/notion-access";
import {
  resolveNotionDatabaseSourceExternalAccess,
  resolveNotionPageSourceExternalAccess,
} from "@/core/lib/sources/notion-source-external-access";
import { notionDatabaseIndexRef } from "@/core/lib/sources/notion-source-refs";
import { isResolvableSourceExternalAccess } from "@/core/lib/sources/source-external-access";
import type { NotionShareMode } from "@/shared/sources/notion-share-mode";

const MAX_DATABASES_PER_SYNC = 3;
const MAX_ROWS_PER_DATABASE = 100;

export type NotionDatabaseIndexResult = {
  databaseId: string;
  ok: boolean;
  title?: string;
  rowsIndexed?: number;
  error?: string;
};

function buildDatabaseRowKbContent(input: {
  databaseTitle: string;
  properties: Record<string, unknown>;
  body: string;
  userById?: NotionUserLookup;
}) {
  const propertyText = serializeNotionPageProperties(
    input.properties,
    input.userById
  );
  const lines = [`Database: ${input.databaseTitle}`];
  if (propertyText) {
    lines.push(...propertyText.split("\n"));
  }
  if (input.body.trim()) {
    lines.push(
      ...input.body
        .trim()
        .split("\n")
        .filter((line) => line.trim())
    );
  }
  return lines.join("\n");
}

async function indexOneDatabaseRow(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
  shareMode?: NotionShareMode;
  shareWithEmails?: string[];
  actorIsAdmin?: boolean;
  accessToken: string;
  databaseTitle: string;
  userById?: NotionUserLookup;
  maxContentBytes: number;
  maxContentMb: number;
  row: {
    rowId: string;
    link: string;
    modifiedTime?: string;
    properties: Record<string, unknown>;
  };
}) {
  const rowTitle =
    extractNotionPageTitleFromProperties(args.row.properties) || "Untitled";
  const page = await notionGetPageContent({
    accessToken: args.accessToken,
    maxContentBytes: args.maxContentBytes,
    maxContentMb: args.maxContentMb,
    pageId: args.row.rowId,
  });
  const content = buildDatabaseRowKbContent({
    body: page.content,
    databaseTitle: args.databaseTitle,
    properties: args.row.properties,
    userById: args.userById,
  });
  if (!content.trim()) {
    throw new Error(`No indexable content for row "${rowTitle}".`);
  }

  resolveReadableContent(content, {
    maxContentBytes: args.maxContentBytes,
    maxContentMb: args.maxContentMb,
  });

  const existing = await getTeamKbNotionItemByExternalRef({
    externalRef: args.row.rowId,
    tenantId: args.tenantId,
  });

  const sourceExternalAccess = resolveNotionPageSourceExternalAccess({
    actorIsAdmin: args.actorIsAdmin,
    actorUserId: args.userId,
    existingAccess: existing?.sourceExternalAccess,
    indexerEmail: args.userEmail,
    ownerUserId: existing?.createdByUserId,
    shareMode: args.shareMode,
    shareWithEmails: args.shareWithEmails,
  });

  if (!isResolvableSourceExternalAccess(sourceExternalAccess)) {
    throw new Error(
      `Could not resolve Notion permissions for row "${rowTitle}".`
    );
  }

  await upsertTeamKbNotionItem({
    createdByUserId: args.userId,
    input: {
      content,
      externalRef: args.row.rowId,
      lastIndexedAt: new Date(),
      link: args.row.link,
      sourceExternalAccess,
      sourceType: "notion",
      sourceUpdatedAt: args.row.modifiedTime
        ? new Date(args.row.modifiedTime)
        : new Date(),
      title: `${args.databaseTitle} / ${rowTitle}`,
    },
    tenantId: args.tenantId,
  });
}

async function indexOneNotionDatabase(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
  shareMode?: NotionShareMode;
  shareWithEmails?: string[];
  actorIsAdmin?: boolean;
  accessToken: string;
  databaseId: string;
  maxContentBytes: number;
  maxContentMb: number;
}): Promise<NotionDatabaseIndexResult> {
  try {
    const { databaseTitle, rows } = await queryAllNotionDatabaseRows({
      accessToken: args.accessToken,
      databaseId: args.databaseId,
      maxRows: MAX_ROWS_PER_DATABASE,
    });
    if (rows.length === 0) {
      return {
        databaseId: args.databaseId,
        error: "Database has no rows to index.",
        ok: false,
        title: databaseTitle,
      };
    }

    const needsUsers = rows.some((row) =>
      propertiesNeedUserLookup(row.properties)
    );
    const userById = needsUsers
      ? toNotionUserLookup(
          await listNotionWorkspaceUsers(args.accessToken).catch(() => [])
        )
      : undefined;

    let rowsIndexed = 0;
    let firstError: string | undefined;
    for (const row of rows) {
      try {
        await indexOneDatabaseRow({
          accessToken: args.accessToken,
          actorIsAdmin: args.actorIsAdmin,
          databaseTitle,
          maxContentBytes: args.maxContentBytes,
          maxContentMb: args.maxContentMb,
          row,
          shareMode: args.shareMode,
          shareWithEmails: args.shareWithEmails,
          tenantId: args.tenantId,
          userById,
          userEmail: args.userEmail,
          userId: args.userId,
        });
        rowsIndexed += 1;
      } catch (error) {
        firstError =
          error instanceof Error ? error.message : "Row index failed.";
      }
    }

    if (rowsIndexed === 0) {
      return {
        databaseId: args.databaseId,
        error: firstError ?? "Could not index any database rows.",
        ok: false,
        title: databaseTitle,
      };
    }

    const databaseExternalRef = notionDatabaseIndexRef(args.databaseId);
    const existingDatabase = await getTeamKbNotionItemByExternalRef({
      externalRef: databaseExternalRef,
      tenantId: args.tenantId,
    });

    const databaseSourceExternalAccess =
      resolveNotionDatabaseSourceExternalAccess({
        actorIsAdmin: args.actorIsAdmin,
        actorUserId: args.userId,
        existingAccess: existingDatabase?.sourceExternalAccess,
        indexerEmail: args.userEmail,
        ownerUserId: existingDatabase?.createdByUserId,
        shareMode: args.shareMode,
        shareWithEmails: args.shareWithEmails,
      });

    if (!isResolvableSourceExternalAccess(databaseSourceExternalAccess)) {
      return {
        databaseId: args.databaseId,
        error: "Could not resolve Notion permissions for this database.",
        ok: false,
        title: databaseTitle,
      };
    }

    await upsertTeamKbNotionItem({
      createdByUserId: args.userId,
      input: {
        content: `Indexed ${rowsIndexed} row(s) from Notion database "${databaseTitle}".`,
        externalRef: notionDatabaseIndexRef(args.databaseId),
        lastIndexedAt: new Date(),
        link: await notionGetDatabaseLink({
          accessToken: args.accessToken,
          databaseId: args.databaseId,
        }),
        sourceExternalAccess: databaseSourceExternalAccess,
        sourceType: "notion",
        sourceUpdatedAt: new Date(),
        title: `${databaseTitle} (database)`,
      },
      tenantId: args.tenantId,
    });

    return {
      databaseId: args.databaseId,
      ok: true,
      rowsIndexed,
      title: databaseTitle,
    };
  } catch (error) {
    return {
      databaseId: args.databaseId,
      error: error instanceof Error ? error.message : "Database index failed.",
      ok: false,
    };
  }
}

export async function indexNotionDatabasesToKb(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
  databaseIds: string[];
  shareMode?: NotionShareMode;
  shareWithEmails?: string[];
  actorIsAdmin?: boolean;
}): Promise<
  | { ok: false; error: string; results: NotionDatabaseIndexResult[] }
  | { ok: true; results: NotionDatabaseIndexResult[] }
> {
  const uniqueIds = [
    ...new Set(args.databaseIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) {
    return { error: "Select at least one database.", ok: false, results: [] };
  }
  if (uniqueIds.length > MAX_DATABASES_PER_SYNC) {
    return {
      error: `Index up to ${MAX_DATABASES_PER_SYNC} databases at a time.`,
      ok: false,
      results: [],
    };
  }

  const access = await getNotionAccessForUser({
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!access.ok) {
    return { error: access.error, ok: false, results: [] };
  }

  const { maxBytes, maxMb } = await getMaxIndexedContentBytesForTenant(
    args.tenantId
  );

  const results = await Promise.all(
    uniqueIds.map((databaseId) =>
      indexOneNotionDatabase({
        accessToken: access.accessToken,
        actorIsAdmin: args.actorIsAdmin,
        databaseId,
        maxContentBytes: maxBytes,
        maxContentMb: maxMb,
        shareMode: args.shareMode,
        shareWithEmails: args.shareWithEmails,
        tenantId: args.tenantId,
        userEmail: args.userEmail,
        userId: args.userId,
      })
    )
  );
  const anyOk = results.some((result) => result.ok);
  if (!anyOk) {
    return {
      error: results.at(0)?.error ?? "Could not index selected databases.",
      ok: false,
      results,
    };
  }
  return { ok: true, results };
}
