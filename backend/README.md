# Kimiro backend

This directory is a standalone Node.js package. It can be copied outside the
repository and installed, tested, built, migrated, and run without any other
repository files.

## Development

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm dev
```

The API listens on port `3002` by default. `GET /ping` is the lightweight
health endpoint.

## Production

```sh
pnpm build
pnpm migration:check
pnpm migrate:start
pnpm start
```

`pnpm migrate` loads `.env` for local use. `pnpm migrate:start` expects the
environment to be injected by the runtime. Both commands use
`backend/migrations` regardless of the current working directory.

Drizzle operations are available as `db:generate`, `db:studio`, `db:push`,
`db:pull`, `db:check`, and `db:up`.

## Operations

Operational scripts live in `scripts/` and use only this package's source,
configuration, dependencies, compose files, migrations, and Vespa schema.
Useful commands include `local:reset`, `local:reset:pg`, `local:fresh-setup`,
`sso:onboard`, `people:sync`, `sources:reindex`, `sources:acl:repair`,
`knowledge-bases:reindex`, `index:drive`, `index:slack`, and `vespa:deploy`.

Reset and migration commands change local data; review their prompts and
environment before running them.

## Containers

Use this directory as the build context:

```sh
docker build -f Dockerfile -t kimiro-api .
docker build -f Dockerfile.migrate -t kimiro-migrate .
```
