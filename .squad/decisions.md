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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
