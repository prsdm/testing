# Production deployment: frontend, backend, and migrations

Production has three independently built units: the static Vite frontend, the
Express backend, and a one-shot backend migration image.

## Build and verify

Each project has its own lockfile and must be installed independently:

```bash
pnpm --dir frontend install --frozen-lockfile
pnpm --dir backend install --frozen-lockfile
pnpm --dir frontend check
pnpm --dir backend check
```

No install, check, or build command connects to Postgres or runs migrations.

Build containers from the standalone project contexts:

```bash
docker build -t kimiro-frontend frontend
docker build -t kimiro-api backend
docker build -f backend/Dockerfile.migrate -t kimiro-migrate backend
```

The API image starts `node dist/server.js`. The migration image starts
`node dist/migrate.js --no-env` and includes `backend/migrations`.

## Runtime environment

The backend requires `POSTGRES_URL`, `BETTER_AUTH_URL`, and either
`BETTER_AUTH_SECRET` or `AUTH_SECRET`. Set `KIMIRO_WEB_ORIGIN` to the public
browser origin. `KIMIRO_API_PORT` defaults to `3002`; `REDIS_URL` and provider
credentials are feature-specific.

Run migrations once before releasing the corresponding API:

```bash
POSTGRES_URL=... pnpm --dir backend migrate:start
```

Never run the migration image as a long-lived service or API startup hook.

The frontend container uses `API_UPSTREAM` as its internal API URL (default
`http://api:3002`). This is a runtime routing value, not a browser credential.

## One public origin

The frontend edge must proxy `/api/*`, `/ping`, and `/ping/*` to the backend,
serve static assets, and return `index.html` for unmatched SPA routes.
`frontend/Caddyfile` implements that contract. Keep `BETTER_AUTH_URL` and
`KIMIRO_WEB_ORIGIN` equal to the public origin.

`vercel.json` installs and builds `frontend/` only. Configure API routes at the
platform edge ahead of the SPA fallback.

## Compose template

`deploy/compose.production.yml` builds directly from `frontend/` and
`backend/`. Validate interpolation without starting services:

```bash
POSTGRES_URL=postgresql://example.invalid/db \
BETTER_AUTH_SECRET=configuration-check-only \
BETTER_AUTH_URL=https://app.example.invalid \
KIMIRO_WEB_ORIGIN=https://app.example.invalid \
docker compose -f deploy/compose.production.yml config
```

Do not use `docker compose up` only to validate the file: it would run the
migration job against the configured database.

## Rollout and rollback

1. Build frontend, API, and migration images from the same revision.
2. Back up the database according to operator policy.
3. Run the migration image once and require a successful exit.
4. Roll out the API and verify `GET /ping` or `GET /api/health`.
5. Roll out the frontend and verify a deep link plus proxied health paths.

Prefer forward-compatible migrations. Rolling back images does not reverse a
database migration.
