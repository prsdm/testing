import { and, eq } from "drizzle-orm";
import { driveGetFileContent } from "@/core/lib/connectors/providers/google-drive/read";
import { getDb } from "@/core/lib/db/client";
import { createTeamKbItem } from "@/core/lib/db/source-queries";
import { teamSources } from "@/core/lib/db/tables";
import {
  type KnowledgeBaseSourceWithItem,
  linkSourceToKnowledgeBase,
} from "@/core/lib/knowledge-bases/knowledge-base-queries";
import { getDriveAccessForUser } from "@/core/lib/sources/drive-access";
import { resolveDriveKbSourceExternalAccess } from "@/core/lib/sources/drive-source-external-access";
import { getMaxIndexedContentBytesForTenant } from "@/core/lib/sources/index-content-limits";
import {
  isResolvableSourceExternalAccess,
  type SourceExternalAccess,
} from "@/core/lib/sources/source-external-access";
import { ChatbotError } from "@/shared/errors";

const MAX_FILES_PER_ADD = 10;

export type KnowledgeBaseDriveAddResult = {
  fileId: string;
  ok: boolean;
  title?: string;
  error?: string;
  source?: KnowledgeBaseSourceWithItem;
};

async function upsertKnowledgeBaseDriveSource(args: {
  tenantId: string;
  knowledgeBaseId: string;
  userId: string;
  title: string;
  content: string;
  fileId: string;
  link: string;
  modifiedTime?: string;
  sourceExternalAccess?: SourceExternalAccess | null;
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(teamSources)
    .where(
      and(
        eq(teamSources.tenantId, args.tenantId),
        eq(teamSources.knowledgeBaseId, args.knowledgeBaseId),
        eq(teamSources.externalRef, args.fileId),
        eq(teamSources.sourceType, "drive")
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(teamSources)
      .set({
        content: args.content.trim(),
        lastIndexedAt: new Date(),
        link: args.link,
        sourceUpdatedAt: args.modifiedTime
          ? new Date(args.modifiedTime)
          : new Date(),
        title: args.title.trim(),
        updatedAt: new Date(),
        ...(args.sourceExternalAccess === undefined
          ? {}
          : { sourceExternalAccess: args.sourceExternalAccess }),
      })
      .where(eq(teamSources.id, existing.id))
      .returning();
    if (!updated) {
      throw new ChatbotError(
        "bad_request:database",
        "Failed to update Drive file"
      );
    }
    return updated;
  }

  return createTeamKbItem({
    createdByUserId: args.userId,
    input: {
      content: args.content,
      externalRef: args.fileId,
      knowledgeBaseId: args.knowledgeBaseId,
      lastIndexedAt: new Date(),
      link: args.link,
      sourceType: "drive",
      sourceUpdatedAt: args.modifiedTime
        ? new Date(args.modifiedTime)
        : new Date(),
      title: args.title,
      visibility: "private",
      ...(args.sourceExternalAccess === undefined
        ? {}
        : { sourceExternalAccess: args.sourceExternalAccess }),
    },
    skipSearchIndex: true,
    tenantId: args.tenantId,
  });
}

async function addOneDriveFileToKnowledgeBase(args: {
  tenantId: string;
  tenantSlug: string;
  knowledgeBaseId: string;
  userId: string;
  userEmail: string;
  fileId: string;
  accessToken: string;
  maxContentBytes: number;
  maxContentMb: number;
}): Promise<KnowledgeBaseDriveAddResult> {
  try {
    const file = await driveGetFileContent({
      accessToken: args.accessToken,
      fileId: args.fileId,
      maxContentBytes: args.maxContentBytes,
      maxContentMb: args.maxContentMb,
      tenantId: args.tenantId,
      userEmail: args.userEmail,
    });

    if (!file.content.trim()) {
      return {
        error: "No extractable text in this file.",
        fileId: args.fileId,
        ok: false,
        title: file.title,
      };
    }

    const sourceExternalAccess = await resolveDriveKbSourceExternalAccess({
      accessToken: args.accessToken,
      fileId: args.fileId,
      tenantId: args.tenantId,
      tenantSlug: args.tenantSlug,
      userEmail: args.userEmail,
    }).catch(() => null);

    if (!isResolvableSourceExternalAccess(sourceExternalAccess)) {
      return {
        error: "Could not resolve Drive permissions for this file.",
        fileId: args.fileId,
        ok: false,
        title: file.title,
      };
    }

    const item = await upsertKnowledgeBaseDriveSource({
      content: file.content,
      fileId: args.fileId,
      knowledgeBaseId: args.knowledgeBaseId,
      link: file.link,
      modifiedTime: file.modifiedTime,
      sourceExternalAccess,
      tenantId: args.tenantId,
      title: file.title,
      userId: args.userId,
    });

    const linked = await linkSourceToKnowledgeBase({
      addedByUserId: args.userId,
      knowledgeBaseId: args.knowledgeBaseId,
      sourceItemId: item.id,
      tenantId: args.tenantId,
      userEmail: args.userEmail,
    });

    return {
      fileId: args.fileId,
      ok: true,
      source: linked,
      title: file.title,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to add file.",
      fileId: args.fileId,
      ok: false,
    };
  }
}

export async function addDriveFilesToKnowledgeBase(args: {
  tenantId: string;
  tenantSlug: string;
  knowledgeBaseId: string;
  userId: string;
  userEmail: string;
  fileIds: string[];
}): Promise<
  | { ok: false; error: string; results: KnowledgeBaseDriveAddResult[] }
  | { ok: true; results: KnowledgeBaseDriveAddResult[] }
> {
  const uniqueIds = [
    ...new Set(args.fileIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) {
    return { error: "Select at least one file.", ok: false, results: [] };
  }
  if (uniqueIds.length > MAX_FILES_PER_ADD) {
    return {
      error: `Add up to ${MAX_FILES_PER_ADD} files at a time.`,
      ok: false,
      results: [],
    };
  }

  const access = await getDriveAccessForUser({
    tenantId: args.tenantId,
    tenantSlug: args.tenantSlug,
    userEmail: args.userEmail,
    userId: args.userId,
  });
  if (!access.ok) {
    return { error: access.error, ok: false, results: [] };
  }

  const { maxBytes, maxMb } = await getMaxIndexedContentBytesForTenant(
    args.tenantId
  );

  const results: KnowledgeBaseDriveAddResult[] = [];
  for (const fileId of uniqueIds) {
    results.push(
      await addOneDriveFileToKnowledgeBase({
        accessToken: access.accessToken,
        fileId,
        knowledgeBaseId: args.knowledgeBaseId,
        maxContentBytes: maxBytes,
        maxContentMb: maxMb,
        tenantId: args.tenantId,
        tenantSlug: args.tenantSlug,
        userEmail: args.userEmail,
        userId: args.userId,
      })
    );
  }

  const anyOk = results.some((result) => result.ok);
  if (!anyOk) {
    return {
      error: results.at(0)?.error ?? "Could not add selected files.",
      ok: false,
      results,
    };
  }

  return { ok: true, results };
}
