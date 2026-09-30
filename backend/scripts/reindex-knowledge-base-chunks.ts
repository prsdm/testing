import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import {
  knowledgeBaseSources,
  sourceChunks,
  teamSources,
} from "@/core/lib/db/tables";
import { indexTeamSourceInKnowledgeBase } from "@/core/lib/knowledge-bases/knowledge-base-queries";

async function main() {
  const db = getDb();
  const rows = await db
    .select({
      knowledgeBaseSource: knowledgeBaseSources,
      source: teamSources,
    })
    .from(knowledgeBaseSources)
    .innerJoin(
      teamSources,
      eq(knowledgeBaseSources.sourceItemId, teamSources.id)
    );

  process.stdout.write(`Linked sources: ${rows.length}\n`);
  for (const row of rows) {
    process.stdout.write(
      `Indexing "${row.source.title}" (${row.source.content?.length ?? 0} chars)...\n`
    );
    await indexTeamSourceInKnowledgeBase({
      item: row.source,
      knowledgeBaseId: row.knowledgeBaseSource.knowledgeBaseId,
    });
    process.stdout.write("  ok\n");
  }

  const result = await db.execute(
    sql`SELECT count(*)::int AS count FROM ${sourceChunks}`
  );
  const count = (result as unknown as Array<{ count: number }>).at(0)?.count;
  process.stdout.write(`SourceChunk rows: ${count ?? "?"}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
