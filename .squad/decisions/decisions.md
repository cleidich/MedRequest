# Decisions — MedRequest Project

**Latest Update:** 2026-05-15  
**Status:** Active tracking of approved and implemented decisions across all teams

---

## Active Decisions

### Decision: APIM tier changed from Consumption to Basic v2

- **ID:** `apim-basicv2-tier-001`
- **Author:** Livingston (Infra/DevOps)
- **Date:** 2025-07-16
- **Status:** ✅ Implemented
- **Scope:** Infrastructure, Reliability, Cost
- **Commit:** 9c270b0

#### Context
APIM Consumption tier had a race condition where ARM reported deployment success before the gateway was actually ready. This caused `PreconditionFailedException` on API policy deployments — observed at least twice. The workaround was to re-run `azd provision`.

#### Decision
Switch to Basic v2 (`Basicv2`, capacity 1). All APIM Bicep resources updated to API version `2024-05-01`.

#### Consequences
- **Cost:** ~$150/month increase (Consumption was ~$1-5/month). Total infra estimate now ~$320-330/month.
- **Reliability:** Eliminates cold-start race condition and provisioning failures. Includes SLA.
- **Performance:** No cold starts on first request (Consumption had 10-20s cold start after idle).
- **Deploy time:** ~5 min provisioning (down from 15-30 min).
- **No re-run workaround needed** — single `azd provision` should deploy cleanly.

#### Team Impact
- **Basher:** No API/schema changes needed — all existing endpoints and policies work unchanged.
- **Rusty:** Architecture unchanged — APIM still sits between App Gateway and App Service, still outside VNet.
- **All:** Monthly cost increased; flagging per project constraints.

---

### Decision: Azure Developer CLI (azd) Integration

- **ID:** `azd-integration-001`
- **Author:** Livingston (Infra/DevOps)
- **Date:** 2026-07-25
- **Status:** ✅ Implemented
- **Scope:** Infrastructure, DevOps, Deployment, Developer Experience
- **References:** `docs/DEPLOYMENT-SIMPLIFICATION.md`

#### Decision
Adopted Azure Developer CLI (`azd`) to replace 15+ manual deployment steps with a single `azd up` command. Created `azure.yaml` service definition, 3 hook scripts, and added Bicep outputs for azd env var integration.

#### What Changed
1. **`azure.yaml`** (new) — azd service definition with `api` service (Node.js, App Service), infra path `./infra`, and 4 hooks
2. **`infra/scripts/preprovision.sh`** (new) — pre-flight soft-delete checks for APIM and Key Vault
3. **`infra/scripts/postprovision.sh`** (new) — SQL firewall, managed identity grant, migrations, seeding
4. **`infra/scripts/postdeploy.sh`** (new) — startup command fix + health check verification
5. **`infra/main.bicep`** (modified) — added 4 outputs: `AZURE_SQL_SERVER_NAME`, `AZURE_SQL_DATABASE_NAME`, `AZURE_MANAGED_IDENTITY_NAME`, `AZURE_APP_SERVICE_NAME`

#### Context
- Deployment previously required ~15 manual CLI steps across 5 phases (30-50 min, error-prone)
- azd preserves existing Bicep modules — it calls `az deployment group create` under the hood
- azd maps Bicep outputs to env vars, making them available in hook scripts

#### Alternatives Considered
- **Bicep Deployment Scripts (ACI):** Painful debugging, adds ACI cost, script failures block entire deployment
- **Node.js Startup Migration:** Good complement but doesn't address firewall rules, identity grants, or deployment packaging
- **Keep manual steps:** Rejected — too error-prone and slow for repeated deploys

#### Impact
- **All team members:** Deploy with `azd up` instead of following TESTING.md manual steps
- **Basher:** Must deliver migration/seed Node.js scripts to `infra/scripts/`
- **Chris:** Install azd (`curl -fsSL https://aka.ms/install-azd.sh | bash`), then `azd init` + `azd up`

---

### Decision: Node.js Migration Runner Replaces sqlcmd

- **ID:** `node-migrations-001`
- **Author:** Basher (Backend)
- **Date:** 2026-05-13
- **Status:** ✅ Implemented
- **Scope:** Backend, Database, Deployment

#### Decision
Replaced the `sqlcmd`-based migration/seed workflow with pure Node.js scripts that use the existing `mssql` npm package. Migrations and seeding now run two ways:

1. **At app startup** — `server.js` calls `runMigrations(pool)` → `runSeed(pool)` before `app.listen()`, using the app's existing DB pool.
2. **Standalone from azd hooks** — `infra/scripts/run-migrations.js` and `infra/scripts/run-seed.js` create their own pool with AAD token auth (via `az account get-access-token`).

#### Context
The previous workflow required `sqlcmd` to be installed in the deployment environment. Since the app already uses the `mssql` npm package, running migrations in Node.js eliminates the external dependency.

#### Key Technical Choices
- **GO batch splitting:** Azure SQL requires DDL statements like `CREATE FUNCTION` and `CREATE SECURITY POLICY` in separate batches. A `splitBatches()` helper splits SQL files on `GO` lines.
- **_migrations tracking table:** Idempotent — records applied migrations by filename so re-runs skip already-applied files.
- **Non-fatal startup:** Migration/seed errors are logged but don't crash the server.
- **Conditional seeding:** Only seeds if `tenants` table is empty — safe for repeated deployments.

#### Files
| File | Purpose |
|------|---------|
| `src/api/db/migrate.js` | Migration runner (exported `runMigrations(pool)`) |
| `src/api/db/seed.js` | Conditional seeder (exported `runSeed(pool)`) |
| `src/api/server.js` | Updated startup sequence |
| `infra/scripts/run-migrations.js` | Standalone hook script (AAD token auth) |
| `infra/scripts/run-seed.js` | Standalone hook script (AAD token auth) |

#### Impact
- **Livingston:** Can replace `sqlcmd` calls in azd hooks with `node infra/scripts/run-migrations.js` and `node infra/scripts/run-seed.js`.
- **CI/CD:** No longer needs `sqlcmd` installed — only Node.js required.
- **Future migrations:** Add new `.sql` files to `db/migrations/` with sequential prefixes.

---

### Decision: Adopt azd + Node.js Startup Migrations for Deployment

- **ID:** `deploy-simplification-001`
- **Author:** Rusty (Architect)
- **Date:** 2026-05-13
- **Status:** ✅ Implemented
- **Scope:** Deployment, Infrastructure, Developer Experience
- **Reference:** `docs/DEPLOYMENT-SIMPLIFICATION.md`

**Adopted Azure Developer CLI (`azd`) with shell-based lifecycle hooks and Node.js startup migrations. This replaced the ~15-step manual deployment process with a single `azd up` command.**

Key implementation updates:
- Livingston: Delivered azd integration (Decision `azd-integration-001`)
- Basher: Delivered Node.js migration runner (Decision `node-migrations-001`)
- Status updated to ✅ Implemented on 2026-05-15

---

## Historical Decisions

### 2026-05-12 — Multi-Tenant Architecture Documented

- **Status:** ✅ Implemented
- **Content:** Comprehensive multi-tenant RLS pattern documentation at `docs/MULTI-TENANT-ARCHITECTURE.md`
- **Scope:** Row-Level Security, SESSION_CONTEXT isolation, code walkthroughs, pattern comparisons
- **Owner:** Rusty (Architect)

---

### 2025-07-14 — Project Structure & Multi-Tenancy Pattern

- **Status:** ✅ Implemented
- **Decisions:** Monorepo layout (src/frontend, src/api, src/functions, infra, db), Azure SQL RLS + SESSION_CONTEXT for multi-tenancy, header-based demo auth, modular Bicep IaC
- **Reference:** `docs/PROJECT-STRUCTURE.md`, `docs/INTAKE.md`
- **Owner:** Rusty (Architect)

---

## Decision Tracking Summary

| ID | Decision | Author | Status | Date |
|----|----------|--------|--------|------|
| apim-basicv2-tier-001 | APIM Consumption → Basic v2 for reliability | Livingston | ✅ Implemented | 2025-07-16 |
| azd-integration-001 | Azure Developer CLI integration | Livingston | ✅ Implemented | 2026-07-25 |
| node-migrations-001 | Node.js migration runner replaces sqlcmd | Basher | ✅ Implemented | 2026-05-13 |
| deploy-simplification-001 | azd + Node.js startup migrations strategy | Rusty | ✅ Implemented | 2026-05-13 |
| multi-tenant-rls-001 | Multi-tenant RLS + SESSION_CONTEXT | Rusty | ✅ Implemented | 2026-05-12 |
| project-structure-001 | Monorepo + Bicep IaC + header-based auth | Rusty | ✅ Implemented | 2025-07-14 |

---

**Last Updated:** 2026-05-15  
**Next Review:** When new decisions emerge or status changes
