# Decision: Node.js Migration Runner Replaces sqlcmd

- **ID:** `node-migrations-001`
- **Author:** Basher
- **Date:** 2026-05-13
- **Status:** Implemented
- **Scope:** Backend, Database, Deployment

## Decision

Replaced the `sqlcmd`-based migration/seed workflow with pure Node.js scripts that use the existing `mssql` npm package. Migrations and seeding now run two ways:

1. **At app startup** — `server.js` calls `runMigrations(pool)` → `runSeed(pool)` before `app.listen()`, using the app's existing DB pool.
2. **Standalone from azd hooks** — `infra/scripts/run-migrations.js` and `infra/scripts/run-seed.js` create their own pool with AAD token auth (via `az account get-access-token`).

## Context

The previous workflow required `sqlcmd` to be installed in the deployment environment (CI runners, azd hooks). This added a system-level dependency and complicated the deployment pipeline. Since the app already uses the `mssql` npm package, running migrations in Node.js eliminates the external dependency.

## Key Technical Choices

- **GO batch splitting:** Azure SQL requires DDL statements like `CREATE FUNCTION` and `CREATE SECURITY POLICY` in separate batches. A `splitBatches()` helper splits SQL files on `GO` lines before executing each batch.
- **_migrations tracking table:** Idempotent — records applied migrations by filename so re-runs skip already-applied files.
- **Non-fatal startup:** Migration/seed errors are logged but don't crash the server, preserving health endpoint availability.
- **Conditional seeding:** Only seeds if `tenants` table is empty — safe for repeated deployments.

## Files

| File | Purpose |
|------|---------|
| `src/api/db/migrate.js` | Migration runner (exported `runMigrations(pool)`) |
| `src/api/db/seed.js` | Conditional seeder (exported `runSeed(pool)`) |
| `src/api/server.js` | Updated startup sequence |
| `infra/scripts/run-migrations.js` | Standalone hook script (AAD token auth) |
| `infra/scripts/run-seed.js` | Standalone hook script (AAD token auth) |

## Impact

- **Livingston:** Can replace `sqlcmd` calls in azd hooks with `node infra/scripts/run-migrations.js` and `node infra/scripts/run-seed.js`. Env vars: `SQL_SERVER` + `SQL_DATABASE` (or `DB_SERVER` + `DB_NAME`).
- **CI/CD:** No longer needs `sqlcmd` installed — only Node.js required.
- **Future migrations:** Add new `.sql` files to `db/migrations/` with sequential prefixes (e.g., `002-add-column.sql`). They'll be picked up automatically.
