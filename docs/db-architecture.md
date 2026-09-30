# Database architecture

Kimiro uses **one Postgres database** per deployment. All tables live in the `public` schema.

## What lives in Postgres

| Area | Examples |
|------|----------|
| Tenants & SSO | `Tenant`, `TenantDomain`, `TenantSSOConfig`, Better Auth tables |
| Sources & connectors | `TeamSource`, Drive/Notion/Confluence settings |
| Chat | `Chat`, `Message_v2`, `User` (chat-scoped), `Document`, artifacts |

Chat rows include `tenantId` on `Chat` for retention and multi-tenant safety on a shared DB.

## GCP (isolated per customer)

Deploy **one stack per customer**:

- Cloud SQL (or AlloyDB) — one database
- Set `POSTGRES_URL`
- Run `pnpm --dir backend migrate` on deploy
- One tenant row via `pnpm --dir backend sso:onboard`

## Env

```env
POSTGRES_URL=postgresql://...
```
