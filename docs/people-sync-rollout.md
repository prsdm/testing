# People Sync Rollout Checklist

## Staged rollout

1. Enable schema + API routes in staging.
2. Onboard one internal tenant with directory credentials.
3. Validate first pull sync counts against IdP admin console.
4. Enable for pilot customer tenants.
5. Rollout globally after 7-day error-rate review.

## Backfill validation

- Run `pnpm people:sync` in staging and production.
- Compare `TenantPerson` count to IdP source count per tenant.
- Investigate and resolve entries in `/api/people/[tenantSlug]/issues`.
- Confirm latest run status is `success` or acceptable `partial`.

## Monitoring

- Track failed sync runs in `TenantPeopleSyncRun`.
- Track unresolved records in `TenantPeopleSyncIssue`.
- Alert on repeated failures by tenant/provider.
