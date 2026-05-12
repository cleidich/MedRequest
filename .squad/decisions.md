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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
