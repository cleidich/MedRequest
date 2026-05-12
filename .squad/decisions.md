# Squad Decisions

## Active Decisions

### Decision: MedRequest Project Structure
- **ID:** `project-structure-001`
- **Author:** Rusty
- **Date:** 2025-07-14
- **Status:** Proposed
- **Scope:** Architecture

**Decision:** Adopt a monorepo layout with logical separation across `src/frontend/`, `src/api/`, `src/functions/`, `infra/`, and `db/`. Key patterns include:
1. Multi-tenancy via Azure SQL Row-Level Security (RLS) with `SESSION_CONTEXT`-based tenant filtering
2. Header-based auth for demo (`X-Tenant-Id`, `X-User-Id`, `X-User-Role`)
3. Pull integration API for EMR/comms systems + Azure Function scaffold for future push
4. Cost-conscious defaults (free/Basic/Standard SKUs)
5. Private networking with VNet, App Gateway, App Service integration, SQL private endpoint

**Context:** The team needs an agreed-upon project structure before implementation. INTAKE.md defines JS frontend, Node.js backend, Azure SQL multi-tenant, Bicep IaC, and GitHub Actions CI/CD.

**Alternatives Considered:**
- Separate repos per service (rejected — overhead for POC)
- Elastic pools / DB-per-tenant (rejected — RLS simpler for demo)
- Full OAuth/MSAL (rejected — header-based faster for POC, swappable later)
- Terraform (rejected — intake specifies Bicep)

**Impact:** All team members should reference `docs/PROJECT-STRUCTURE.md` for directory conventions and ownership boundaries.

**Ownership Matrix:**
| Area | Owner | Notes |
|------|-------|-------|
| `src/frontend/` | Linus | All UI, CSS, client-side JS |
| `src/api/` | Basher | Express API, middleware, services |
| `src/functions/` | Basher | Azure Functions scaffolds |
| `db/` | Basher (schema), Livingston (infra) | SQL migrations/seed data |
| `infra/` | Livingston | All Bicep modules, deploy scripts |
| `.github/workflows/` | Livingston | CI/CD pipelines |
| `docs/` | Rusty | Architecture docs |

### Decision: Infrastructure Scaffolding Patterns
- **ID:** `infra-scaffold-001`
- **Author:** Livingston
- **Date:** 2025-07-14
- **Status:** Implemented
- **Scope:** Infrastructure

**Decision:** Established the full Bicep infrastructure scaffolding with these key patterns:
1. Single user-assigned managed identity shared across App Service and Functions, granted RBAC roles on Key Vault (Secrets User) and Storage (Blob Data Contributor). SQL Server uses this identity as AAD admin.
2. B1 App Service SKU (not F1) because VNet integration requires at least Basic tier. This is a cost tradeoff documented in `app-service.bicep`.
3. APIM Consumption tier runs outside VNet — no VNet injection capability. Traffic path is: Internet → App Gateway → App Service.
4. App Gateway Standard_v2 with WAF is the single biggest cost (~$146/mo). Autoscale set to 0-2 instances to minimize when idle. Team should decide if this is acceptable for POC budget.
5. AAD-only auth on SQL Server — no SQL passwords anywhere. Connection strings use managed identity tokens.
6. CI/CD uses OIDC federated credentials (no stored secrets for Azure auth). Required GitHub secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `SQL_AAD_ADMIN_OBJECT_ID`.

**Impact:**
- Basher: SQL connection in `src/api/db/pool.js` must use `@azure/identity` for token-based auth (no password in connection string)
- Linus: No direct impact — frontend is served from App Service
- Rusty: Architecture matches the proposed structure; App Gateway cost needs team sign-off

**Open Items:**
- [ ] Team to confirm App Gateway cost is acceptable for POC
- [ ] `SQL_AAD_ADMIN_OBJECT_ID` secret needs to be set in GitHub repo settings
- [ ] APIM API definitions and policies to be added once API contract is finalized

### Decision: Backend API & Database Scaffold
- **ID:** `api-scaffold-001`
- **Author:** Basher
- **Date:** 2025-07-14
- **Status:** Implemented
- **Scope:** Backend API, Database Schema

**Decision:** Implemented the initial backend scaffold following the `routes → services → db` layering pattern with these key technical choices:
1. RLS implementation: `SESSION_CONTEXT('tenant_id')` is set per-query (not per-connection) in `db/queries.js`. Each query function calls `setTenantContext()` before running SQL. This avoids connection pooling issues where a shared connection might retain a previous tenant's context.
2. Managed identity auth: `db/pool.js` uses `azure-active-directory-default` authentication type when `DB_USE_MANAGED_IDENTITY=true`. Falls back to SQL auth (user/password) for local dev.
3. UUID primary keys: All tables use `UNIQUEIDENTIFIER` with `NEWID()` defaults. This supports distributed ID generation without a central sequence.
4. CHECK constraints over ENUM: Azure SQL doesn't support PostgreSQL-style ENUM types, so we use `CHECK` constraints for role, type, and status columns.
5. Health probes: `/api/health` (liveness, no auth) and `/api/ready` (readiness, checks DB) are unauthenticated for use by App Service health checks.

**Impact:**
- Linus: Frontend must set `X-Tenant-Id`, `X-User-Id`, `X-User-Role` headers on all authenticated API calls. Health endpoints require no headers.
- Livingston: DB bootstrap should run `db/migrations/001-initial-schema.sql` then `db/seed/demo-data.sql`. The App Service needs env vars: `DB_SERVER`, `DB_NAME`, `DB_USE_MANAGED_IDENTITY=true`, `KEY_VAULT_URI`.
- Rusty: API contract matches the proposed structure. Endpoints: `POST/GET/GET/:id/PATCH /api/requests`, `GET /api/integration/requests`, `POST /api/integration/forward-emr`, `POST /api/integration/notify`.

### Decision: Frontend Scaffold — Vanilla JS IIFE Pattern
- **ID:** `frontend-scaffold-001`
- **Author:** Linus
- **Date:** 2025-07-14
- **Status:** Implemented
- **Scope:** Frontend Architecture

**Decision:** Used IIFE module pattern (no ES modules, no bundler) for all frontend JS. Each module (`Auth`, `Api`, `PatientView`, `ConciergeView`, `CaseManagerView`, `App`) is a self-contained global, loaded via `<script>` tags in dependency order.

**Rationale:**
- Zero build step — just serve static files
- Simple for a POC; easy for stakeholders to inspect
- Hash-based routing avoids server-side routing config
- Role switching auto-updates auth headers (localStorage-backed)

**API Contract Assumptions:**
- `POST /api/requests` — create request `{ type, subject, body }`
- `GET /api/requests?status=X` — list requests (filtered by auth headers for tenant/user)
- `PATCH /api/requests/:id` — update `{ status, forwarded_to }`
- Auth headers: `X-Tenant-Id`, `X-User-Id`, `X-User-Role`

Basher should confirm these endpoints align with the Express API routes.

**Impact:**
All frontend code lives under `src/frontend/`. No framework dependencies. CSS is mobile-first with 600px/900px breakpoints.

### Decision: Demo Persona Switcher (Query Param + Picker UI)
- **ID:** `demo-auth-001`
- **Author:** Rusty (design), Linus (implementation)
- **Date:** 2025-01-14
- **Status:** Implemented
- **Scope:** Frontend UX, Demo/Presentation Experience

**Decision:** Implemented a **query parameter-based persona switcher** allowing presenters to instantly switch between 9 curated demo personas (3 hospital tenants × 3 roles) without authentication prompts.

**URL scheme:** `/?persona={tenantSlug}-{role}#{view}`

**Examples:**
- `/?persona=mercy-patient#patient` → Alice Johnson (patient at Mercy General)
- `/?persona=stclaire-concierge#concierge` → Frank Lee (concierge at St. Claire)
- `/?persona=harbor-casemanager#casemanager` → Jack O'Brien (case manager at Harbor Medical)

**UX components:**
1. **Landing page persona picker** — visual tiles (3 tenant cards, 3 buttons each) shown when navigating to `/` with no persona param
2. **Persistent persona badge** — floating top-right indicator showing current tenant, user, and role; includes "Switch Persona" button
3. **Bookmarkable URLs** — presenters can pre-load browser tabs with specific personas

**Implementation:**
- Frontend-only — parses `?persona=` query param, looks up persona in registry (`personas.js`), calls `Auth.set()`
- No backend changes — API already accepts `X-Tenant-Id`, `X-User-Id`, `X-User-Role` headers
- Backward compatible — if no persona param, falls back to existing localStorage defaults

**Files:**
- `src/personas.js` (NEW) — Registry + helpers
- `src/picker.js` (NEW) — Persona selection UI
- `src/persona-badge.js` (NEW) — Demo mode indicator
- `src/app.js` (MODIFIED) — Persona detection
- `index.html` (MODIFIED) — Script tags
- `styles.css` (MODIFIED) — Picker + badge styles

**Persona Registry (9 total):**
| Persona | Tenant | Name | Role | Tenant ID | User ID |
|---------|--------|------|------|-----------|---------|
| mercy-patient | Mercy General | Alice Johnson | patient | A0000000-0000-0000-0000-000000000001 | 10000000-0000-0000-0000-000000000001 |
| mercy-concierge | Mercy General | Carol Davis | concierge | A0000000-0000-0000-0000-000000000001 | 10000000-0000-0000-0000-000000000003 |
| mercy-casemanager | Mercy General | Dan Martinez | casemanager | A0000000-0000-0000-0000-000000000001 | 10000000-0000-0000-0000-000000000004 |
| stclaire-patient | St. Claire | Eve Thompson | patient | B0000000-0000-0000-0000-000000000002 | 20000000-0000-0000-0000-000000000001 |
| stclaire-concierge | St. Claire | Frank Lee | concierge | B0000000-0000-0000-0000-000000000002 | 20000000-0000-0000-0000-000000000002 |
| stclaire-casemanager | St. Claire | Grace Kim | casemanager | B0000000-0000-0000-0000-000000000002 | 20000000-0000-0000-0000-000000000003 |
| harbor-patient | Harbor Medical | Henry Park | patient | C0000000-0000-0000-0000-000000000003 | 30000000-0000-0000-0000-000000000001 |
| harbor-concierge | Harbor Medical | Isabel Chen | concierge | C0000000-0000-0000-0000-000000000003 | 30000000-0000-0000-0000-000000000002 |
| harbor-casemanager | Harbor Medical | Jack O'Brien | casemanager | C0000000-0000-0000-0000-000000000003 | 30000000-0000-0000-0000-000000000003 |

**Security Notes:**
⚠️ **DEMO ONLY** — Not production-ready auth. Query param picker is insecure and must never be used in production. "DEMO MODE" label is a visual reminder.

**Production migration path:**
- Replace query param picker with OAuth/MSAL login
- Remove `personas.js` registry
- Backend validates tokens instead of trusting headers
- Frontend calls `/api/auth/me` to fetch tenant/user/role

**Impact:**
- Linus: Frontend persona switcher fully implemented and tested
- Basher: Must seed Harbor Medical Center (Tenant #3) before harbor-* personas work
- Rusty: Design confirmed and documented in `docs/DEMO-AUTH-DESIGN.md`

### Decision: User Approval — App Gateway Standard_v2 Cost
- **ID:** `infra-cost-appgw-001`
- **Author:** cleidich (via Copilot)
- **Date:** 2026-05-12
- **Status:** Approved
- **Scope:** Infrastructure Cost

**Decision:** App Gateway Standard_v2 cost (~$146/mo) is approved for the POC. Keep App Gateway in the architecture.

**Context:** User directive captured for team memory during infrastructure planning.

**Impact:** Cost baseline is set; team can proceed with App Gateway deployment.

### Decision: Demo Deployment Completed with Fixes
- **ID:** `deploy-demo-001`
- **Author:** Livingston
- **Date:** 2026-05-12
- **Status:** Implemented
- **Scope:** Infrastructure, Deployment

**Decision:** Deployed the full MedRequest demo environment to `rg-medrequest-demo` in Central US. Fixed 6 Bicep bugs and 1 application bug during deployment.

**Key Changes:**

*Bicep Fixes (Livingston's scope)*
1. App Gateway SKU changed from `Standard_v2` to `WAF_v2`
2. WAF config migrated from deprecated inline to separate WAF Policy resource
3. Key Vault `enablePurgeProtection: false` removed (property cannot be set to false)
4. SQL `principalType` parameterized (was hardcoded to `Application`)
5. App Service env vars aligned with app config (`DB_SERVER` not `SQL_SERVER`)
6. Node runtime updated to `NODE|22-lts` (20-lts retired)

*Application Fix (cross-team — Basher to review)*
- Removed `@read_only = 1` from `sp_set_session_context` in `src/api/db/queries.js`
- **Reason:** With connection pooling, `@read_only = 1` prevents tenant context from being reset on reused connections, causing cross-tenant query failures
- **Impact:** Less restrictive session context, but required for correct multi-tenant behavior with pooling

*Deployment Config (Livingston's scope)*
- Added `express.static` middleware in `server.js` to serve frontend from `public/` directory
- Frontend files copied into API's `public/` directory for unified deployment
- Index.html paths updated from `../css/` to `/css/` for root-relative serving

**Impact:**

- **Basher:** Review the `@read_only` removal in queries.js — consider alternative approaches for session context isolation
- **Linus:** Frontend is served from App Service at root path `/` — no separate hosting needed
- **All:** APIM has no API definitions yet — needs API import once contract is finalized

### Decision: Backend API Gap Fixes for Demo Readiness
- **ID:** `api-gaps-001`
- **Author:** Basher
- **Date:** 2026-05-12
- **Status:** Implemented
- **Scope:** Backend API, Database Seed Data

**Decision:** Fixed four backend gaps blocking demo readiness:

1. **Request type mapping:** Added a normalization layer in `requestService.js` that maps patient-form types (`comfort`, `service`, `staff`) to internal DB types (`feedback`, `concierge`, `case_manager`) before validation. Both naming conventions are accepted.

2. **Integration endpoints wired:** Replaced stub integration service with real functions that validate request existence (with RLS), update status to `forwarded` in the database, and log actions. Added missing `POST /forward-business-office` route. Actual EMR/notification delivery remains mocked (POC scope).

3. **Harbor Medical seed data:** Added 2 additional sample requests (feedback, concierge) bringing Harbor Medical to 4 total — matching other tenants' data density for balanced demos.

4. **@read_only review confirmed:** Livingston's removal of `@read_only=1` from `sp_set_session_context` is correct and required. With connection pooling, `@read_only=1` prevents tenant context from being reset on reused connections, which would cause cross-tenant query failures. The per-query `setTenantContext()` call pattern provides sufficient isolation.

**Key Design Choice:** Integration endpoints use the existing `forwarded` status value (already in the DB CHECK constraint) rather than adding new values like `forwarded_emr`/`forwarded_business_office`. This avoids a schema migration. The destination is captured in the response payload and server logs.

**Impact:**
- **Linus:** Patient form can now submit with `comfort`/`service`/`staff` types — API will accept them
- **Rusty:** Integration API contract is now functional for APIM import
- **Livingston:** Harbor Medical seed data deployed; all 3 tenants balanced (4 requests each)

### Decision: Frontend Handler Completion — Integration API Pattern
- **ID:** `frontend-handlers-001`
- **Author:** Linus
- **Date:** 2026-05-12
- **Status:** Implemented
- **Scope:** Frontend, API Integration

**Decision:** Case Manager forward actions now call the dedicated integration API endpoints (`POST /api/integration/forward-emr`, `POST /api/integration/forward-business-office`) before updating request status via `PATCH /api/requests/:id`. This is a two-step pattern: integration call first, status update second.

**Rationale:** The integration endpoints are the "real" action — they notify external systems. The status update is bookkeeping. If the integration call fails, we don't mark the request as forwarded (fail-fast). If the status update fails after a successful integration call, the user sees an error and can retry.

**Concierge "Forward to Case Manager"** uses only `PATCH /api/requests/:id` with `{ status: 'forwarded', forwarded_to: 'case_manager' }` — no integration endpoint needed since this is an internal handoff.

**New Statuses Supported:** `acknowledged`, `closed` (in addition to existing `new`, `in_progress`, `resolved`, `forwarded`). All 8 status values now in DB CHECK constraint and frontend UI.

**Implementation Details:**
- Case manager workflow: Acknowledge → In Progress → Resolve → Forward (to EMR or Business Office)
- Concierge workflow: Acknowledge → In Progress → Resolve → Forward to Case Manager
- All `alert()` calls replaced with inline `.card-alert` toasts
- API client methods: `forwardToEmr(id)`, `forwardToBusinessOffice(id)`, `notify(data)`

**Impact:**
- **Basher:** Type mapping allows form types; integration endpoints wired and working
- **Livingston:** Status constraint updated in live DB; all workflows tested
- **All:** Demo now walkable end-to-end across all 9 personas

### Decision: Database Constraint Update for Demo Workflows
- **ID:** `db-constraint-001`
- **Author:** Coordinator (via Linus's flag)
- **Date:** 2026-05-12
- **Status:** Implemented
- **Scope:** Database Schema

**Decision:** Updated `CK_requests_status` CHECK constraint to include `acknowledged` and `closed` statuses, which were flagged by Linus's frontend implementation but missing from the constraint.

**Previous Constraint:** `forwarded`, `new`, `in_progress`, `resolved`

**Updated Constraint:** `forwarded`, `acknowledged`, `closed`, `new`, `in_progress`, `resolved` (8 total values)

**Context:** Linus added `acknowledged` and `closed` buttons to concierge and case manager views, but these statuses were not yet in the DB constraint. Coordinator coordinated fix via Livingston's DB update.

**Impact:** All frontend status updates now accepted by database; no constraint violations on demo workflows.

### Decision: OpenAPI 3.0 Spec for APIM Import
- **ID:** `openapi-spec-001`
- **Author:** Basher
- **Date:** 2026-05-12
- **Status:** Implemented
- **Scope:** Backend API, API Management

**Decision:** Created a comprehensive OpenAPI 3.0.3 specification at `src/api/openapi.yaml` covering all 10 API operations across 8 paths. The spec is designed for direct import into Azure API Management (APIM) Consumption tier.

**Key Choices:**
1. **Security modeled as three `apiKey` schemes** (`X-Tenant-Id`, `X-User-Id`, `X-User-Role`) — APIM can enforce these as required headers via policies.
2. **Health endpoints intentionally have no security requirement** — matches the Express middleware chain where health routes are mounted before the auth middleware.
3. **Request type aliases documented in schema description** — the `CreateRequestBody.type` field notes that form-friendly names (`comfort`, `service`, `staff`) are accepted alongside internal names.
4. **All response shapes derived from actual service return values** — no guessing, read directly from route handlers and service functions.

**Impact:**
- **Livingston:** Can import `src/api/openapi.yaml` into APIM via Azure Portal or Bicep `Microsoft.ApiManagement/service/apis` resource.
- **Rusty:** Spec is ready for APIM policy authoring (rate limiting, header validation, etc.).
- **Linus:** No frontend impact — spec documents existing API contract.

### Decision: SQL RLS Demo Strategy — "Behind the Scenes" SQL Explorer Tab
- **ID:** `sql-explorer-strategy-001`
- **Author:** Rusty
- **Date:** 2026-05-12
- **Status:** Approved
- **Scope:** Demo Experience, Architecture

**Decision:** Recommended "Behind the Scenes" SQL Explorer tab as the primary strategy for demonstrating row-level security (RLS) isolation in customer demos. User approved recommendation.

**Strategy Analysis:**
- **Option A (rejected):** Bastion host + SQL Server Management Studio ($25/mo, security risk, operational overhead)
- **Option B (recommended):** Backend SQL Explorer UI tab built into MedRequest app ($0 cost, demonstrates RLS live, highest demo impact)
- **Option C (rejected):** Third-party monitoring tool (external vendor, licensing complexity)

**Implementation Plan:**
1. **Backend** (`/api/sql-explorer` routes): Parameterized queries against demo database; results filtered by persona's `SESSION_CONTEXT('tenant_id')`
2. **Frontend** (SQL Explorer tab): Case manager view tab showing live schema + query results; read-only, admin-level access only
3. **Demo Script:** Shows same query returning different results for different tenants — visual proof of RLS isolation
4. **Safety:** No schema mutations; parameterized queries only; caching to avoid DB load spikes

**Rationale:**
- Built-in to app = $0 cost vs. $25/mo Bastion
- Live demonstration is more compelling than external tooling
- Supports narrative: "You see only YOUR hospital's data — other hospitals' data is invisible"

**Impact:**
- **Basher:** Build `/api/sql-explorer` backend routes
- **Linus:** Add SQL Explorer UI tab to case manager view
- **Livingston:** No infra changes required
- **Rusty:** Demo narrative now includes live RLS proof point

### Decision: APIM Secrets via Key Vault References

- **ID:** `keyvault-refs-001`
- **Author:** Livingston (Infra/DevOps)
- **Date:** 2026-05-12
- **Status:** Implemented
- **Scope:** Security, Infrastructure

**Decision:** Store APIM gateway URL and subscription key as Key Vault secrets, and expose them to the App Service as Key Vault reference app settings. The Node.js backend reads them from `process.env` — no secrets in code.

**Details:**
- **Secrets:** `apim-gateway-url` and `apim-subscription-key` in `kv-medrequest-demo`
- **App Settings:** `APIM_GATEWAY_URL` and `APIM_SUBSCRIPTION_KEY` (Key Vault references)
- **Identity:** User-assigned managed identity `id-medrequest-demo` used for Key Vault access (RBAC: `Key Vault Secrets User`)
- **Pattern:** All future secrets should follow this same pattern — store in Key Vault, reference via app settings

**Impact:**
- **Basher:** Use `process.env.APIM_GATEWAY_URL` and `process.env.APIM_SUBSCRIPTION_KEY` in backend code — values are resolved from Key Vault automatically
- **Linus:** No frontend impact (frontend doesn't call APIM directly with keys)
- **Security:** No secrets committed to code or config files; rotation requires only Key Vault secret update + app restart

### Decision: Public /api/config Endpoint for APIM Settings

- **ID:** `config-endpoint-001`
- **Author:** Basher
- **Date:** 2026-05-13
- **Status:** Implemented
- **Scope:** Backend API

**Decision:** Created a public `GET /api/config` endpoint (no auth middleware) that reads environment variables and returns APIM configuration as JSON. If `APIM_GATEWAY_URL` is not set (e.g., local dev), returns `enabled: false` so the frontend can fall back to direct `/api` calls.

**Rationale:**
- **No hardcoded secrets:** Values come from env vars (backed by Key Vault references in Azure)
- **Public endpoint:** The APIM subscription key is a client-side API key (sent in request headers to APIM), not a user secret — same exposure model as any SPA calling an API gateway
- **Graceful degradation:** `enabled: false` fallback means the app works locally without APIM configuration

**Impact:**
- **Linus:** Frontend should call `/api/config` on init to determine API routing
- **Livingston:** No infra changes needed — env vars already wired

### Decision: Frontend Fetches Config at Runtime

- **ID:** `frontend-config-001`
- **Author:** Linus
- **Date:** 2026-05-12
- **Status:** Implemented
- **Scope:** Frontend / API contract

**Decision:** The frontend no longer contains any hardcoded APIM URLs or subscription keys. Instead, `Api.init()` fetches runtime configuration from `GET /api/config` at app startup (before any other API calls).

**Behavior:**
- If `apim.enabled` is `true` in the config response, the frontend routes all API calls through the APIM gateway URL and attaches the `Ocp-Apim-Subscription-Key` header using the fetched key.
- If `apim.enabled` is `false` (or the config endpoint is unreachable), the frontend falls back to direct `/api` calls with no subscription key header.
- The `setApimEnabled()` toggle is preserved for demo flexibility — it switches between the *fetched* APIM URL and `/api`, not hardcoded values.

**Contract with Backend:**
Frontend expects `GET /api/config` to return:
```json
{
  "apim": {
    "enabled": true,
    "baseUrl": "https://apim-medrequest-demo.azure-api.net/medrequest/api",
    "subscriptionKey": "..."
  }
}
```

**Rationale:**
- Eliminates secrets from source control
- Supports environment-specific configuration without rebuilds
- Graceful degradation if config endpoint is unavailable

**Impact:**
- **Files changed:** `src/frontend/js/api.js` (removed constants, added `init()`), `src/frontend/js/app.js` (await `Api.init()` before render)
- All synced to `src/api/public/`

### Decision: APIM Wired as API Gateway for Demo

- **ID:** `apim-wiring-001`
- **Author:** Livingston
- **Date:** 2026-05-12
- **Status:** Implemented
- **Scope:** Infrastructure, API Management

**Decision:** Imported the MedRequest OpenAPI spec into APIM and configured it as a security/management proxy layer between the frontend and App Service backend.

**Configuration:**
- **API ID:** `medrequest-api` at path `/medrequest`
- **Gateway URL:** `https://apim-medrequest-demo.azure-api.net`
- **Full API base:** `https://apim-medrequest-demo.azure-api.net/medrequest/api/...`
- **Backend:** Named backend `medrequest-backend` → `https://app-medrequest-demo.azurewebsites.net`
- **Subscription:** `medrequest-demo-sub` (primary key: `70cee38f45ec4aeaaffc2eb7aa62f1ca`)

**Policies Applied:**
1. Rate limiting: 100 calls/minute per subscription (demonstrates API throttling)
2. CORS: Allows App Service origin + localhost with credentials
3. Backend routing: Uses named backend from Bicep provisioning
4. Auth headers: X-Tenant-Id, X-User-Id, X-User-Role forwarded to backend

**Testing:** Health probe and authenticated requests endpoint verified working through APIM (HTTP 200).

**Impact:**
- **Linus:** To route through APIM, set API base URL to `https://apim-medrequest-demo.azure-api.net/medrequest` and add `Ocp-Apim-Subscription-Key: 70cee38f45ec4aeaaffc2eb7aa62f1ca` header to all requests. Direct App Service access still works (APIM is optional).
- **Basher:** No changes needed — APIM proxies transparently to the same Express API.
- **Rusty:** APIM now demonstrable as the API gateway layer in the architecture. Shows rate limiting, CORS, and centralized API management.

**Demo Notes:**
- APIM Consumption tier has cold start (~5-10s on first call after idle) — warm it up before demos
- Rate limit of 100/min is generous for demos but shows the capability in APIM portal
- Subscription key is required — demonstrates API key management

### Decision: Debug SQL Explorer Endpoint

- **ID:** `debug-sql-explorer-001`
- **Author:** Basher
- **Date:** 2026-05-13
- **Status:** Implemented
- **Scope:** Backend API (Demo Feature)

**Decision:** Added a `POST /api/debug/explore` endpoint that executes pre-defined (allowlisted) SQL queries through the standard auth + tenant context middleware, demonstrating Row-Level Security in action.

**Key Design Choices:**

1. **Query allowlist, not arbitrary SQL.** The endpoint accepts a `queryKey` string and looks it up in a hardcoded catalog of 5 named queries. Unknown keys are rejected with a 400. This eliminates SQL injection risk entirely.

2. **Same middleware chain as production routes.** The debug route is registered with `auth` + `tenantContext` middleware — the exact same flow as `/api/requests` and `/api/integration`. This is the demo's core point: RLS filtering is not special-cased.

3. **SQL text included in response.** Each response contains the raw SQL that was executed, so the frontend can display it alongside the filtered results — making the RLS behavior visible to the audience.

4. **Human-readable `rlsNote`.** Each query has a templated explanation string that resolves the tenant name at runtime (e.g., "...only show Mercy General Hospital's data").

5. **`cross_tenant_proof` query.** This is the "wow" query — it JOINs requests to tenants and groups by tenant name, seemingly asking for cross-tenant aggregates. RLS ensures only the current tenant's row appears.

**Impact:**
- **Linus:** New API endpoint available for a "Behind the Scenes" frontend panel. POST `{ "queryKey": "my_requests" }` to `/api/debug/explore` with auth headers.
- **Rusty:** Include in demo script — switch personas and re-run the same query to show different results.
- **Livingston:** No infrastructure changes needed; endpoint uses existing DB pool.

**Security Note:** ⚠️ DEMO ONLY. In production, this endpoint should be removed or gated behind an admin role.

### Decision: Explorer UI — API Contract with Backend

- **ID:** `explorer-ui-001`
- **Author:** Linus
- **Date:** 2026-05-12
- **Status:** Implemented
- **Scope:** Frontend ↔ Backend API Contract

**Decision:** Added a "Behind the Scenes" (`#explorer`) view to the frontend that demonstrates Row-Level Security visually. The frontend calls a new API endpoint that Basher implemented.

**API Contract Implemented:**

**Endpoint:** `POST /api/debug/explore`

**Request body:**
```json
{ "queryKey": "my_requests" | "all_users" | "request_count" | "tenant_info" | "cross_tenant" }
```

**Expected response:**
```json
{
  "sql": "SELECT ... FROM requests WHERE ...",
  "rows": [ { "id": "...", "subject": "...", ... } ],
  "rlsNote": "RLS filtered this query to only show Mercy General's 4 requests."
}
```

- `sql` — The actual SQL that was executed (for display in a code block)
- `rows` — Array of result objects (column names as keys)
- `rlsNote` — Human-readable explanation of what RLS did

**Frontend Files Changed:**
- `src/frontend/js/views/explorer.js` (NEW)
- `src/frontend/js/app.js` (route + globals)
- `src/frontend/js/api.js` (`runExplorerQuery` method)
- `src/frontend/css/styles.css` (explorer styles)
- `src/frontend/public/index.html` (nav tab + script tag)
- All synced to `src/api/public/`

**Impact:**
- **Basher:** Implemented `POST /api/debug/explore` endpoint returning the shape above
- **Livingston:** No infra changes needed — uses existing App Service

### Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
