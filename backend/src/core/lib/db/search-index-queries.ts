import { desc, eq } from "drizzle-orm";
import { mergeSearchRuntimeSettings } from "@/core/lib/search/runtime-settings";
import { ChatbotError } from "@/shared/errors";
import { getDb } from "./client";
import { tenantIndexRuns, tenantSearchSettings } from "./tables";

const db = getDb();

export async function ensureTenantSearchSettings(tenantId: string) {
  try {
    const [existing] = await db
      .select()
      .from(tenantSearchSettings)
      .where(eq(tenantSearchSettings.tenantId, tenantId))
      .limit(1);
    if (existing) {
      return existing;
    }
    const [created] = await db
      .insert(tenantSearchSettings)
      .values({ tenantId })
      .onConflictDoNothing({ target: tenantSearchSettings.tenantId })
      .returning();
    if (created) {
      return created;
    }
    const [again] = await db
      .select()
      .from(tenantSearchSettings)
      .where(eq(tenantSearchSettings.tenantId, tenantId))
      .limit(1);
    if (again) {
      return again;
    }
    throw new Error("Failed to ensure tenant search settings");
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to ensure tenant search settings"
    );
  }
}

export async function getTenantSearchRuntimeSettings(tenantId: string) {
  const row = await ensureTenantSearchSettings(tenantId);
  return mergeSearchRuntimeSettings({
    embeddingDimension: row.embeddingDimension,
    embeddingModel: row.embeddingModel,
    embeddingNormalize: row.normalizeEmbeddings,
    embeddingPassagePrefix: row.passagePrefix,
    embeddingQueryPrefix: row.queryPrefix,
    indexingEnabled: row.indexingEnabled,
    maxContextLength: row.maxContextLength,
    maxIndexedContentSizeMb: row.maxIndexedContentSizeMb,
  });
}

export async function updateTenantSearchSettings(
  tenantId: string,
  input: {
    embeddingModel?: string;
    normalizeEmbeddings?: boolean;
    queryPrefix?: string;
    passagePrefix?: string;
    maxContextLength?: number;
    indexingEnabled?: boolean;
    maxIndexedContentSizeMb?: number;
  }
) {
  await ensureTenantSearchSettings(tenantId);
  try {
    const [updated] = await db
      .update(tenantSearchSettings)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(tenantSearchSettings.tenantId, tenantId))
      .returning();
    return updated;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to update tenant search settings"
    );
  }
}

export async function getTenantIndexStatus(tenantId: string) {
  try {
    const [latestRun] = await db
      .select()
      .from(tenantIndexRuns)
      .where(eq(tenantIndexRuns.tenantId, tenantId))
      .orderBy(desc(tenantIndexRuns.startedAt))
      .limit(1);
    const settings = await ensureTenantSearchSettings(tenantId);
    return { latestRun: latestRun ?? null, settings };
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to fetch tenant index status"
    );
  }
}

export async function createIndexRun(tenantId: string) {
  try {
    const [run] = await db
      .insert(tenantIndexRuns)
      .values({
        sourceType: "google_drive",
        status: "running",
        tenantId,
      })
      .returning();
    return run;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to create index run"
    );
  }
}

export async function completeIndexRun(input: {
  runId: string;
  status: "success" | "partial" | "failed";
  documentsIndexed: number;
  chunksIndexed: number;
  errorsCount?: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const [run] = await db
      .update(tenantIndexRuns)
      .set({
        chunksIndexed: input.chunksIndexed,
        completedAt: new Date(),
        documentsIndexed: input.documentsIndexed,
        errorMessage: input.errorMessage ?? null,
        errorsCount: input.errorsCount ?? 0,
        metadata: input.metadata ?? null,
        status: input.status,
      })
      .where(eq(tenantIndexRuns.id, input.runId))
      .returning();
    return run;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to complete index run"
    );
  }
}
