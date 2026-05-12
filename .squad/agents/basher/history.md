# Basher — History

## Project Context
- **Project:** MedRequest — hospital patient communication/concierge request app (demo/POC)
- **User:** cleidich
- **Stack:** Node.js backend, Azure SQL (multi-tenant via sharding)
- **APIs:** Patient request submission, request query/pull, outbound integration scaffolds
- **Auth:** Simple header-based authentication for demo
- **Constraints:** Low-cost SKUs, managed identities for Azure resource access

## Learnings

### 2025-07-14 — Project Structure Context
- **API ownership:** Express.js backend in `src/api/`, Azure Functions scaffolds in `src/functions/`
- **Architecture pattern:** `routes → services → db` layering for clean separation
- **Database:** Azure SQL with Row-Level Security (RLS) using `SESSION_CONTEXT` for multi-tenancy
- **Auth:** Header-based (`X-Tenant-Id`, `X-User-Id`, `X-User-Role`) — demo-only, swappable
- **Integration model:** Pull API endpoints + Azure Function scaffold for future push
- **Co-ownership:** DB schema with Livingston (who owns infrastructure)
- **Key context:** Project decision `project-structure-001` documented in `.squad/decisions.md`
- **Reference:** See `docs/PROJECT-STRUCTURE.md` for full directory tree and ownership boundaries

### 2025-07-14 — Backend API & DB Schema Scaffold
- **Schema:** `db/migrations/001-initial-schema.sql` — tenants, users, requests tables with RLS via `fn_tenant_filter` + `SESSION_CONTEXT`
- **Seed data:** `db/seed/demo-data.sql` — 2 hospitals, 7 users, 5 sample requests (disables/re-enables RLS for seeding)
- **Express API:** Full `routes → services → db` stack in `src/api/`
  - `server.js` — Express entry with helmet, cors, JSON parsing, graceful shutdown
  - `config/index.js` — env config with managed identity toggle (`DB_USE_MANAGED_IDENTITY=true`)
  - `db/pool.js` — mssql connection pool, supports `azure-active-directory-default` auth type for managed identity
  - `db/queries.js` — parameterized SQL; `setTenantContext()` called per-query for RLS
  - `middleware/auth.js` — validates X-Tenant-Id (UUID), X-User-Id (UUID), X-User-Role (enum)
  - `middleware/tenantContext.js` — ensures DB pool is reachable, sets req.tenantId
  - `middleware/errorHandler.js` — centralized JSON error responses, detail in non-prod
  - `routes/requests.js` — POST, GET list, GET by id, PATCH status
  - `routes/integration.js` — pull API (GET /api/integration/requests?status=&since=), forward-emr stub, notify stub
  - `routes/health.js` — /api/health (liveness), /api/ready (DB check)
  - `services/requestService.js` — validation + business logic layer
  - `services/integrationService.js` — stub functions for EMR, comms, business office
- **Azure Function:** `src/functions/outbound-notify/` — HTTP-triggered stub, logs "would notify EMR"
- **Key decisions:** UUID primary keys (NEWID()), CHECK constraints instead of ENUM type (Azure SQL), RLS policies on both users and requests tables
- **Linus integration point:** Frontend should set `X-Tenant-Id`, `X-User-Id`, `X-User-Role` headers on all API calls
- **Livingston integration point:** DB infra should run `db/migrations/001-initial-schema.sql` then `db/seed/demo-data.sql` via `infra/scripts/seed-sql.sh`
- **Cross-team note (from Livingston):** SQL Server uses managed identity auth (AAD-only), app identity has SQL Server admin role; use `@azure/identity` library for token acquisition
- **Cross-team note (from Linus):** Frontend API client (`src/frontend/js/api.js`) automatically injects auth headers; confirmed API endpoints match expectations

### 2025-07-14 — Harbor Medical Center Tenant Added
- **Seed data:** Added third demo tenant (Harbor Medical Center, ID `C0000000-0000-0000-0000-000000000003`) to `db/seed/demo-data.sql`
- **Users:** Henry Park (patient), Isabel Chen (concierge), Jack O'Brien (case_manager) — UUIDs starting with `30000000-...`
- **Sample requests:** Two requests from Henry Park (IDs starting with `E0000000-...`) — concierge coffee request and case manager insurance question
- **Pattern notes:** SQL string escaping for apostrophes (e.g., `Jack O''Brien`), UUID prefix convention (tenants: A/B/C, users: 1x/2x/3x, requests: C/D/E per tenant)
- **Cross-team note (from Rusty):** Persona switcher design (`docs/DEMO-AUTH-DESIGN.md`) requires third tenant for complete 9-persona demo grid (3 tenants × 3 roles)

### 2025-01-14 — Harbor Medical Center Now Supports Full Persona Switcher
- **Linus integration:** Frontend persona switcher (`js/personas.js`, `js/views/picker.js`, `js/components/persona-badge.js`) now fully functional with all 9 personas across 3 tenants
- **Demo ready:** Presenters can now use bookmarkable URLs (`/?persona=harbor-patient#patient`, etc.) to switch between Harbor Medical Center personas without DB seeding delays
- **Cross-team note (from Linus):** Frontend query-param approach matches Rusty's design doc exactly; 9-persona registry complete with Harbor personas now seeded and functional
- **Key files:** All persona IDs in `db/seed/demo-data.sql` match those in `src/frontend/js/personas.js` registry

