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

### 2026-05-12 — Full Azure Deployment Completed
- **Status:** All resources deployed successfully to `rg-medrequest-demo` (Central US)
- **App URL:** https://app-medrequest-demo.azurewebsites.net
- **Bicep fixes:** Fixed 6 bugs — WAF SKU, WAF config migration, Key Vault purge protection, SQL principal type, env var naming, Node 22 runtime
- **App fix:** Removed `@read_only` from `sp_set_session_context` in `src/api/db/queries.js` to fix cross-tenant queries with connection pooling
- **Frontend integration:** Added `express.static` middleware; frontend served from App Service root path; index.html paths updated to root-relative
- **Cross-team:** Livingston completed deployment; Basher should review the `@read_only` removal; Linus confirmed frontend integration points; Rusty noted APIM needs API definitions
- **Next:** Basher to review session context isolation; Rusty to finalize API contract for APIM import; all demo personas operational (9 total across 3 hospitals)

### 2026-05-12 — Backend Gap Fixes for Demo Readiness
- **Type mapping:** Added `normalizeType()` in `requestService.js` that maps form-friendly types (`comfort`→`feedback`, `service`→`concierge`, `staff`→`case_manager`) before validation. Both form names and internal names are accepted. Mapping happens before the `VALID_TYPES` check.
- **Integration endpoints wired up:** Rewrote `integrationService.js` from stubs to real service functions. Each function now: (1) validates request exists via `queries.getRequestById` with tenant RLS, (2) updates request status to `forwarded` via `queries.updateRequestStatus`, (3) logs the action, (4) returns structured response with previous/current status. Added `POST /forward-business-office` route. All three endpoints (`forward-emr`, `forward-business-office`, `notify`) validate `requestId` in the route handler before calling the service.
- **Status constraint note:** Used existing `forwarded` status (allowed by DB CHECK constraint) rather than introducing new statuses like `forwarded_emr` — avoids schema migration for POC.
- **Harbor Medical seed data:** Added 2 new sample requests (feedback + concierge) for Henry Park, bringing Harbor Medical from 2 to 4 requests — matching the density of Mercy General and St. Claire.
- **@read_only review (completed):** Confirmed Livingston's removal of `@read_only` from `sp_set_session_context` is correct. With connection pooling, `@read_only=1` makes the session variable immutable for the connection's lifetime — meaning reused connections can't reset tenant context, causing cross-tenant data leaks. Without `@read_only`, each query call properly resets the tenant context. The per-query `setTenantContext()` pattern already provides adequate isolation. No further changes needed.
- **Key pattern:** Integration service functions now take `(tenantId, requestId)` instead of a pre-fetched request object — keeps validation and RLS enforcement inside the service layer, not the route.
- **Cross-team coordination (from Linus):** Linus flagged that frontend uses `acknowledged` and `closed` statuses not in DB CHECK constraint. Coordinator fixed constraint in live DB (via Livingston). Frontend type mapping now compatible with form submission.
- **Deployment note (from Livingston):** All fixes redeployed to `app-medrequest-demo`; Harbor seed data verified in live environment.

### 2026-05-12 — OpenAPI 3.0 Specification Created
- **File:** `src/api/openapi.yaml` — complete OpenAPI 3.0.3 spec for APIM import
- **Coverage:** 8 paths, 10 operations (2 health, 4 request CRUD, 4 integration)
- **Security:** Three `apiKey` security schemes for `X-Tenant-Id`, `X-User-Id`, `X-User-Role` headers
- **Schemas:** 13 component schemas covering all request/response shapes, including type aliases (comfort→feedback etc.)
- **Tags:** Health (unauthenticated), Requests, Integration
- **Servers:** Both production (`app-medrequest-demo.azurewebsites.net`) and local dev (`localhost:3000`)
- **Purpose:** Enables APIM import to demonstrate API gateway securing and managing backend calls
- **Cross-team:** Rusty can use this for APIM policy configuration; Livingston can import into APIM Consumption tier

### 2026-05-13 — Debug SQL Explorer Endpoint for RLS Demo
- **File:** `src/api/routes/debug.js` — POST `/api/debug/explore` endpoint
- **Purpose:** "Behind the Scenes" demo tool that runs allowlisted SQL queries through the same auth + tenant context middleware, proving RLS filters data transparently
- **Query allowlist (5 keys):** `my_requests` (requests table), `all_users` (users table), `request_count` (COUNT(*)), `tenant_info` (current tenant lookup), `cross_tenant_proof` (JOIN across requests+tenants — RLS still filters)
- **Response shape:** `{ queryKey, sql, tenantId, rowCount, rows, rlsNote }` — includes raw SQL text and human-readable RLS explanation with resolved tenant name
- **Security:** No arbitrary SQL — only catalog keys execute. Auth middleware validates headers before reaching this endpoint.
- **Registration:** `app.use('/api/debug', auth, tenantContext, debugRoutes)` in `server.js` — same middleware chain as all other authenticated routes
- **Pattern note:** Reuses `setTenantContext()` from `db/queries.js` + `getPool()` from `db/pool.js` — no new DB patterns introduced
- **Cross-team:** Linus can build a frontend "Behind the Scenes" panel that posts `{ queryKey }` and displays the SQL + results; Rusty should note this in demo script

### 2026-05-13 — Frontend Config Endpoint for APIM Integration
- **File:** `src/api/routes/config.js` — GET `/api/config` endpoint
- **Purpose:** Serves APIM gateway configuration to the frontend from environment variables (`APIM_GATEWAY_URL`, `APIM_SUBSCRIPTION_KEY`) — no secrets hardcoded
- **Behavior:** If `APIM_GATEWAY_URL` is set, returns `{ apim: { enabled: true, baseUrl, subscriptionKey } }`. If unset (local dev), returns `{ apim: { enabled: false } }` so frontend falls back to direct `/api` calls.
- **Auth:** Public endpoint — no auth middleware. Registered alongside health routes in `server.js`. The subscription key is a client-side API key (APIM expects it in request headers), not a user secret.
- **Pattern note:** Reads `process.env` directly at request time — no caching, keeps it simple for POC
- **Cross-team:** Linus should fetch `/api/config` on app init to decide whether to route API calls through APIM or direct; Livingston has already wired the env vars via Key Vault references in App Service settings


### 2026-05-13 — Key Vault Config Pattern Integration (Orchestration Summary)
- **Part of:** Three-agent integration (Livingston storing secrets, Basher serving config, Linus fetching at startup)
- **Backend's role:** Expose environment-resolved secrets via public `/api/config` endpoint
- **Config endpoint pattern:** Read process.env variables (resolved from Key Vault by App Service) and return to frontend as JSON. Public because subscription key is client-side, same exposure as any SPA calling a gateway.
- **Graceful degradation:** Return `enabled: false` when APIM env vars not set (supports local dev without APIM configuration)
- **Documented:** Decision `config-endpoint-001` in squad/decisions.md

### 2026-05-13 — Role Normalization + APIM Server-Side Proxy
- **Role normalization fix:** Auth middleware (`src/api/middleware/auth.js`) now accepts `casemanager` (no underscore) and normalizes to `case_manager` before validation. Added `ROLE_ALIASES` map — frontend can send either form, downstream code always sees canonical `case_manager`.
- **APIM proxy route:** Created `src/api/routes/proxy.js` — server-side proxy to eliminate CORS issues. Route pattern: `ALL /api/proxy/*` strips `/proxy` prefix and forwards to `APIM_GATEWAY_URL` with same method, body, auth headers (`X-Tenant-Id`, `X-User-Id`, `X-User-Role`), plus `Ocp-Apim-Subscription-Key`.
- **Proxy behavior:** Uses Node.js built-in `fetch` (Node 22 feature, no new deps). Returns 503 if APIM env vars not set, 502 if fetch fails, otherwise forwards APIM response status + body. Handles GET, POST, PATCH, DELETE with JSON body serialization.
- **Registration:** Mounted at `/api/proxy` in `server.js` BEFORE auth middleware — no auth middleware on this route because it passes headers through to APIM which validates them.
- **Error handling:** Graceful degradation when APIM not configured (local dev), clear error messages for gateway unreachable vs not configured.
- **Pattern note:** Proxy handles its own auth forwarding — doesn't rely on Express auth middleware because it's a transparent passthrough. Auth validation happens at APIM.
- **Cross-team:** Linus can now route frontend API calls to `/api/proxy/*` when APIM is enabled (from `/api/config` response), eliminating browser CORS preflight issues.

### 2026-05-13 — Cross-Tenant Proof Query Key Fix
- **Bug:** Frontend explorer sent `cross_tenant` as the query key, but the backend debug endpoint (`routes/debug.js`) expects `cross_tenant_proof`. This caused a 400 error on the "Cross-Tenant Proof" button.
- **Fix:** Changed `key: 'cross_tenant'` to `key: 'cross_tenant_proof'` in both `src/frontend/js/views/explorer.js` and `src/api/public/js/views/explorer.js` (the Express static copy).
- **Pattern note:** Frontend query keys must exactly match the backend allowlist in `routes/debug.js`. When adding new explorer queries, always verify the key string matches both sides.
- **Reminder:** Express serves static files from `src/api/public/` — any frontend change in `src/frontend/` must be copied to the corresponding path under `src/api/public/` for production. Consider a build step or symlink to avoid this drift.
- **Verified:** Deployed to Azure, confirmed RLS correctly filters cross-tenant query to show only the authenticated tenant's data (Mercy General Hospital, 3 requests).
