# Kimiro

This repository contains two independent source projects:

- `frontend/`: Vite SPA with its own manifest, lockfile, environment example,
  Dockerfile, and Caddy configuration.
- `backend/`: Express API and migration/operations tooling with its own
  manifest, lockfile, environment example, Dockerfiles, compose files,
  migrations, Vespa schema, and scripts.

Either folder can be copied elsewhere and installed, checked, built, and run
without the repository root or the other folder.

## Install and run locally

```bash
pnpm --dir backend install --frozen-lockfile
pnpm --dir frontend install --frozen-lockfile

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

pnpm dev:backend
pnpm dev:frontend
```

The frontend runs on `http://localhost:5173` and proxies API requests to the
backend on `http://127.0.0.1:3002`.

The root `package.json` is only an optional command orchestrator. It has no
dependencies and this repository is not a pnpm workspace. Use commands in each
project's README when working from a copied standalone folder.

## Verify

```bash
pnpm check
# or independently:
pnpm --dir frontend check
pnpm --dir backend check
```

Checks and builds do not run database migrations. Migration and operational
commands live under `backend/`; see `backend/README.md`.

## Deploy

See [the SPA/API deployment guide](docs/deploy-spa-api.md). The production
compose template builds each local Dockerfile from its standalone project
context. `vercel.json` builds only the frontend.
