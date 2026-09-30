import { desc, eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import type {
  SourceConnectorType,
  TeamSourceListRow,
} from "@/core/lib/db/source-queries";
import {
  authUser,
  knowledgeBaseSources,
  teamSources,
} from "@/core/lib/db/tables";
import type {
  KbCatalogResponse,
  KbCatalogRow,
} from "@/shared/sources/source-catalog-types";

function toIso(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function catalogRefKey(sourceType: SourceConnectorType, externalRef: string) {
  return `${sourceType}:${externalRef}`;
}

function kbItemToCatalogRow(item: TeamSourceListRow): KbCatalogRow | null {
  const externalRef = item.externalRef?.trim();
  if (
    !externalRef &&
    item.sourceType !== "manual" &&
    item.sourceType !== "upload"
  ) {
    return null;
  }

  const ref = externalRef ?? item.id;
  return {
    createdAt: toIso(item.createdAt),
    createdByUserId: item.createdByUserId,
    externalRef: ref,
    indexedByEmail: item.indexedByEmail,
    indexedByName: item.indexedByName,
    kbItemId: item.id,
    lastIndexedAt: toIso(item.lastIndexedAt) ?? toIso(item.updatedAt),
    link: item.link,
    modifiedAt: toIso(item.sourceUpdatedAt) ?? toIso(item.updatedAt),
    rowKey: catalogRefKey(item.sourceType, ref),
    sourceType: item.sourceType,
    status: "indexed",
    title: item.title,
  };
}

export async function loadKnowledgeBaseIndexedSources(args: {
  knowledgeBaseId: string;
}) {
  const db = getDb();
  const rows = await db
    .select({
      indexedByEmail: authUser.email,
      indexedByName: authUser.name,
      source: teamSources,
    })
    .from(knowledgeBaseSources)
    .innerJoin(
      teamSources,
      eq(knowledgeBaseSources.sourceItemId, teamSources.id)
    )
    .leftJoin(authUser, eq(teamSources.createdByUserId, authUser.id))
    .where(eq(knowledgeBaseSources.knowledgeBaseId, args.knowledgeBaseId))
    .orderBy(desc(knowledgeBaseSources.addedAt));

  const items: TeamSourceListRow[] = [];
  for (const row of rows) {
    const externalRef = row.source.externalRef?.trim();
    if (
      !externalRef &&
      row.source.sourceType !== "manual" &&
      row.source.sourceType !== "upload"
    ) {
      continue;
    }

    items.push({
      accessControlList: row.source.accessControlList,
      createdAt: row.source.createdAt,
      createdByUserId: row.source.createdByUserId,
      externalRef: row.source.externalRef,
      id: row.source.id,
      indexedByEmail: row.indexedByEmail ?? null,
      indexedByName: row.indexedByName ?? null,
      lastIndexedAt: row.source.lastIndexedAt,
      link: row.source.link,
      sourceExternalAccess: row.source.sourceExternalAccess,
      sourceType: row.source.sourceType,
      sourceUpdatedAt: row.source.sourceUpdatedAt,
      tenantId: row.source.tenantId,
      title: row.source.title,
      updatedAt: row.source.updatedAt,
      visibility: row.source.visibility,
    });
  }

  return items;
}

export async function buildKnowledgeBaseCatalog(args: {
  knowledgeBaseId: string;
}): Promise<KbCatalogResponse> {
  const indexedSources = await loadKnowledgeBaseIndexedSources({
    knowledgeBaseId: args.knowledgeBaseId,
  });

  const rows: KbCatalogRow[] = [];
  for (const item of indexedSources) {
    const row = kbItemToCatalogRow(item);
    if (row) {
      rows.push(row);
    }
  }

  return {
    connectors: {
      confluencePinEnabled: false,
      drivePinEnabled: false,
      notionPinEnabled: false,
      sharePointPinEnabled: false,
      slackPinEnabled: false,
    },
    rows,
  };
}
