# Local Setup Guide

Local stack mirrors a per-customer data plane: **Postgres (pgvector)**, **Redis** (in-stack cache), and embeddings for indexing knowledge base chunks.

Chunk search for **knowledge bases** lives in Postgres via **pgvector** (hybrid vector + BM25/`tsvector`). Vespa is legacy and is **not** required for local development.

**Embeddings** default to **OpenAI** (`EMBEDDING_PROVIDER=openai`, `text-embedding-3-small` shortened to **768** dims so the existing `vector(768)` column stays valid). Set `EMBEDDING_PROVIDER=tei` to use local TEI model servers instead. Reindex after switching providers (`pnpm --dir backend knowledge-bases:reindex`).

Redis runs in Docker next to Postgres — **not** a shared cloud Redis (Upstash/Vercel) per customer. Omit `REDIS_URL` only if you want the app to fall back to in-process rate limits and skip session cache / resumable streams.

There is no separate permissions graph — ACL is Postgres stored `accessControlList` (+ pgvector chunk ACL filters for knowledge base search).

## Quick start (recommended)

One command resets Postgres + Redis, applies migrations (including pgvector), and creates a tenant:

```bash
pnpm --dir backend local:reset:pg -- --yes
pnpm dev:backend
pnpm dev:frontend
```

App listens on **http://localhost:5173** (see `BETTER_AUTH_URL` in `.env`).

Open the **Setup URL** printed at the end of `local:reset:pg`, finish SSO, then sign in.

### Required `.env` (local)

```bash
POSTGRES_URL=postgresql://postgres:password@localhost:5433/kimi
REDIS_URL=redis://localhost:6379

# Preferred: OpenAI embeddings (no local TEI containers)
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=768
OPENAI_API_KEY=sk-...

# Only needed when EMBEDDING_PROVIDER=tei
# MODEL_SERVER_URL=http://localhost:9000
# INDEXING_MODEL_SERVER_URL=http://localhost:9001
```

`VESPA_URL` / `VESPA_CONFIG_URL` are unused on the pgvector path and can be omitted.

## 1. Start Docker (manual)

```bash
docker compose -f backend/docker-compose.yml up -d relational_db cache
```

| Service | Role | Ports |
|---|---|---|
| `relational_db` | Postgres + pgvector (tenants, auth, KB, ACL, chat, knowledge base chunks) | `5433` → 5432 |
| `cache` | Redis (session cache, rate limits, resumable chat streams) | `6379` |

Check health:

```bash
docker compose -f backend/docker-compose.yml ps
docker compose -f backend/docker-compose.yml exec cache redis-cli ping   # expect PONG
docker compose -f backend/docker-compose.yml exec relational_db psql -U postgres -d kimi -c 'CREATE EXTENSION IF NOT EXISTS vector; SELECT extversion FROM pg_extension WHERE extname = $$vector$$;'
```

Optional **local TEI** embeddings (only if `EMBEDDING_PROVIDER=tei`):

```bash
docker compose -f backend/docker-compose.yml up -d model_server indexing_model_server
```

| Service | Role | Ports |
|---|---|---|
| `model_server` | Query-time embeddings | `9000` |
| `indexing_model_server` | Bulk indexing embeddings | `9001` |

> First boot of TEI can take a few minutes while they download and warm `BAAI/bge-base-en-v1.5` (768-dim).

## 2. Database migration *(first time on this Postgres volume)*

```bash
pnpm --dir backend migrate
```

Single Postgres database for everything (tenants, auth, sources, chat, knowledge base chunk vectors). On GCP: one Cloud SQL instance per customer deployment with the `vector` extension (Redis stays in that same customer stack).

## 3. Create tenant + schema

```bash
pnpm --dir backend sso:onboard --slug company --name "Company" --domain company.com --provider google
```

> Or use `pnpm --dir backend local:reset:pg -- --yes`, which migrates and creates a fresh tenant.

## 4. Finish SSO in browser

Open the **Setup URL** from step 3 and fill in:

| Field | Value |
|---|---|
| Provider | Google / Okta / Azure *(changeable in the form)* |
| Client ID | From your IdP |
| Client Secret | From your IdP |
| Admin Emails | Real `@company.com` addresses |

> **Save** → then sign in using your domain.

## 5. Run the app

```bash
pnpm dev:backend
pnpm dev:frontend
```

| Page | URL |
|---|---|
| Login | http://localhost:5173/login |
| Chat | http://localhost:5173/ |
| Connectors *(admins)* | http://localhost:5173/connectors |
| Sources *(admins)* | http://localhost:5173/sources |
| Admin | http://localhost:5173/admin |

## 6. Index content & test search

Knowledge base hybrid search uses **pgvector** (`SourceChunk.contentEmbedding`) + Postgres `tsvector` (`search_text`), merged with RRF.

1. Ensure embeddings work: `OPENAI_API_KEY` with `EMBEDDING_PROVIDER=openai`, **or** start TEI (`model_server` / `indexing_model_server`) with `EMBEDDING_PROVIDER=tei`.
2. **Connectors** — connect Drive (or another source).
3. **Sources** — add sources; chunks are stored in Postgres. **Knowledge bases** scope indexed files for chat search.
4. After switching embedding providers (or fixing a failed index), rebuild knowledge base chunks: `pnpm --dir backend knowledge-bases:reindex`.
5. In **chat**, ask something only your docs would answer; you should see citations.

ACL refresh helpers still apply to stored source ACL:

```bash
pnpm --dir backend sources:acl:refresh
pnpm --dir backend sources:acl:refresh <tenantSlug> 200
pnpm --dir backend sources:acl:repair <tenantSlug>
```

### GCP: schedule ACL refresh

Production is **GCP** (not Vercel). Keep Postgres + Redis as services in the customer stack; schedule ACL refresh with **Cloud Scheduler** hitting the app:

1. Set `CRON_SECRET` in the app environment.
2. Create an HTTP job (e.g. every 6 hours) that `GET`s:

   `https://<your-app-host>/api/cron/sources-acl-refresh`

   with header `Authorization: Bearer <CRON_SECRET>`.

   Optional: `?batchSize=200`.

Same pattern works for chat retention: `GET /api/cron/chat-retention`.

Locally you can also curl while the frontend and backend dev servers are
running:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:5173/api/cron/sources-acl-refresh"
```

---

## Reset everything (pgvector)

Wipe Postgres + Redis and re-onboard (stops legacy Vespa containers):

```bash
pnpm --dir backend local:reset:pg -- --yes
```

Then finish SSO from the printed Setup URL and start both dev servers.

### Manual reset

```bash
docker compose -f backend/docker-compose.yml down -v relational_db cache
docker compose -f backend/docker-compose.yml up -d relational_db cache
pnpm --dir backend migrate
```

Then repeat tenant onboarding (step 3–5).

### Legacy Vespa stack

`backend/docker-compose.yml` still defines `vespa` / TEI services for older
flows (`pnpm --dir backend local:reset`,
`pnpm --dir backend vespa:deploy`). Prefer `local:reset:pg` for day-to-day
local work.
