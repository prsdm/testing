# Kimiro frontend

This directory is a standalone Vite application. It can be copied outside the
monorepo and installed, tested, built, and run without any repository files.

## Local development

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

Vite serves the app on port `5173` by default. Browser requests to `/api` and
`/ping` stay same-origin and are proxied during development to
`KIMIRO_API_URL` (default `http://127.0.0.1:3002`).

## Verify and build

```sh
pnpm check
pnpm preview
```

`pnpm lint` runs Biome checks. `pnpm lint:fix` applies safe fixes.
`pnpm check` runs lint, TypeScript checks, unit tests, and the production build. The
build output is written to `dist/`. Static UI assets such as connector and
library icons live in `public/logos/` and are copied into `dist/logos/`.

For production, serve `dist/` as an SPA and reverse-proxy `/api/*` and `/ping`
to the API. The included Dockerfile and Caddyfile do this; build with this
directory as the Docker context:

```sh
docker build -t kimiro-frontend .
docker run --rm -p 8080:8080 -e API_UPSTREAM=http://host.docker.internal:3002 kimiro-frontend
```

`VITE_KIMIRO_BASE_PATH` and `VITE_IS_DEMO` are build-time browser settings.
Do not put secrets in `VITE_*` variables.
