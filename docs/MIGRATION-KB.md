# Sources Architecture (Current)

Kimiro uses **Vespa only** for search indexing and retrieval. Postgres stores Sources metadata and content; Vespa stores searchable chunks.

## What is live

- `sourceSearch` reads Sources content from Vespa (`team_source` chunks; legacy `team_kb` still accepted on read).
- Workspace Drive indexing (`pnpm --dir backend index:drive`) writes `google_drive` chunks to the same Vespa app.
- Team Sources create/sync/update/delete paths index or delete Vespa chunks.
- ACL is enforced in Vespa query filters (`user:<id>`, `tenant:<tenantId>` tokens for Sources; Drive ACL tokens for workspace index).
- Runtime source checks remain in place for provider-specific visibility verification.

## Core paths

- Sources search tool: `backend/src/core/lib/ai/tools/source-search.ts`
- Sources search execution: `backend/src/core/lib/sources/source-search.ts`
- Sources Vespa integration: `backend/src/core/lib/sources/source-chunk-index.ts`
- Sources reindex (Postgres → Vespa): `backend/src/core/lib/sources/reindex-source-search.ts`
- Sources DB writes + Vespa hooks: `backend/src/core/lib/db/source-queries.ts`
- Vespa schema and index/search logic:
  - `backend/vespa/application/schemas/kimi_chunk.sd`
  - `backend/src/core/lib/search/vespa/indexer.ts`
  - `backend/src/core/lib/search/vespa/search.ts`
  - `backend/src/core/lib/search/chunk-index.ts` (facade)

## After Vespa deploy or volume reset

Postgres Sources rows survive, but Vespa chunks do not. **`pnpm --dir backend vespa:deploy` reindexes all Sources items automatically** (all tenants). Requires `indexing_model_server` on port 9001.

To reindex one tenant only, or if deploy used `--skip-sources-reindex`:

```bash
pnpm --dir backend sources:reindex              # all tenants
pnpm --dir backend sources:reindex <tenantSlug> # one tenant
```

Or use **Sync now** on the Sources page (reindexes all source items for that tenant into Vespa).

## Local reset

```bash
pnpm --dir backend local:reset -- --yes
```

`local:reset` deploys Vespa with `--skip-sources-reindex` (empty DB). After you add Sources content:

```bash
docker compose -f backend/docker-compose.yml up -d model_server indexing_model_server
pnpm --dir backend sources:reindex   # or pnpm --dir backend vespa:deploy to redeploy + reindex
pnpm dev:backend
pnpm dev:frontend
```
