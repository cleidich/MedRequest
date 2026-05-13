# Rusty — History

## Project Context
- **Project:** MedRequest — hospital patient communication/concierge request app (demo/POC)
- **User:** cleidich
- **Stack:** JavaScript frontend, Node.js backend, Azure SQL (multi-tenant), Bicep IaC, GitHub Actions CI/CD
- **Azure:** App Service, Functions, APIM, App Gateway (WAF), Key Vault, App Insights, Log Analytics
- **Constraints:** Low-cost SKUs (demo/POC), managed identities, private networking where cost-effective

## Learnings

### 2025-07-14 — Project Structure Proposed
- **Monorepo layout** adopted: `src/frontend/`, `src/api/`, `src/functions/`, `infra/`, `db/`
- **Multi-tenancy pattern**: Azure SQL Row-Level Security with `SESSION_CONTEXT` — cheapest approach for POC, avoids elastic pools
- **Auth pattern**: Header-based (`X-Tenant-Id`, `X-User-Id`, `X-User-Role`) — demo-only, designed to be swappable
- **API layering**: `routes → services → db` in Express.js; clean separation for testability
- **Integration model**: Pull API endpoints + Azure Function scaffold for future push notifications
- **Infra**: Modular Bicep (`infra/modules/*.bicep`) composed by `main.bicep`; cost-conscious SKUs (F1/B1, Basic SQL, Consumption APIM/Functions)
- **Networking**: VNet with App Gateway subnet, App Service integration, SQL private endpoint; APIM Consumption stays outside VNet
- **Key files**: `docs/PROJECT-STRUCTURE.md` (full proposal), `docs/INTAKE.md` (requirements)
- **Ownership**: Linus=frontend, Basher=API+Functions+DB schema, Livingston=infra+CI/CD+DB infra, Rusty=architecture+API contract

### 2025-07-14 — README.md Created
- **Created** comprehensive `README.md` at repo root for stakeholders and developers
- **Content**: 12 sections covering project overview, architecture diagram, Azure services, directory structure, prerequisites, local dev setup, deployment steps, API endpoints, user roles, auth model, cost breakdown (~$50–80/month), and disclaimers
- **Key patterns documented**: Multi-tenant RLS approach, header-based auth (demo), pull-based integration, low-cost SKUs (B1 App Service, Basic SQL, Consumption APIM/Functions)
- **Deployment workflow**: Resource group → infrastructure (Bicep) → DB migrations → App Service deployment → Functions deployment
- **File location**: `/home/cleidich/repos/patient-comm-app/README.md`
- **Audience**: Stakeholders (cost/architecture), developers (setup/deployment), architects (patterns/decisions)

### 2025-01-14 — Demo Persona Switcher Design
- **Designed** query param-based persona switching for frontend demos: `/?persona={tenantSlug}-{role}#{view}`
- **Pattern**: Frontend-only implementation preserving existing hash-based routing; no backend changes needed
- **Registry**: 9 curated personas (3 tenants × 3 roles): Mercy General, St. Claire Medical, Harbor Medical Center
- **UX components**: Landing page persona picker (visual tiles), persistent persona badge (tenant + user + role), bookmarkable URLs for presenter convenience
- **Key files**: `docs/DEMO-AUTH-DESIGN.md` (full design spec), `src/frontend/js/personas.js` (registry, to be created), `src/frontend/js/views/picker.js` (picker UI, to be created)
- **Seed data impact**: Requires adding Tenant #3 (Harbor Medical) to `db/seed/demo-data.sql` with 3 users (Henry Park, Isabel Chen, Jack O'Brien)
- **Implementation estimate**: Linus 6-10 hours (4 phases: core switching, picker UI, badge, polish), Basher 1 hour (seed data)
- **Trade-offs**: Rejected path-based routing (conflicts with hash router), rejected hash-only (not composable), rejected localStorage-only (not bookmarkable)
- **Ownership**: Linus=frontend implementation, Basher=seed data for Tenant #3, Rusty=design approval

### 2026-05-12 — Demo Deployment Complete — App Live
- **Status**: Full Azure deployment of MedRequest to `rg-medrequest-demo` (Central US) completed successfully
- **App URL**: https://app-medrequest-demo.azurewebsites.net
- **Livingston delivered:** Bicep fixes (WAF SKU, config migration, KV purge protection, SQL principal type, env vars, Node 22 runtime), frontend integration via express.static, deployment scripts
- **Basher coordination:** All 9 demo personas (3 hospitals × 3 roles) seeded in Azure SQL and operational via Harbor Medical center addition from previous session
- **Linus coordination:** Frontend query-param persona switcher fully integrated; being served from App Service root path; no separate static site needed
- **Deployment notes:** All Azure resources operational (App Service, SQL, App Gateway WAF, Key Vault, App Insights, Log Analytics, Storage). APIM provisioned but no API definitions yet — waiting on Rusty's finalized contract
- **⚠️ Review item:** Basher to review `@read_only` removal from `sp_set_session_context` — Livingston notes it was necessary for correct multi-tenant behavior with connection pooling but suggests considering alternatives
- **Architecture validation:** Confirms project structure adopted in earlier decisions; cost baseline approved; all 9 personas bookmarkable and testable

### 2026-05-12 — SQL RLS Demo Strategy Approved
- **Strategy Analysis:** Evaluated three approaches for live RLS demonstration in customer demos:
  1. **Option A (Bastion + SSMS):** External SQL tooling, $25/mo cost, security risk, operational overhead — rejected
  2. **Option B (SQL Explorer tab):** Built-in app feature, $0 cost, live demonstration, highest demo impact — **recommended and user-approved**
  3. **Option C (Third-party monitoring):** External vendor, licensing complexity — rejected
- **Recommendation Rationale:** SQL Explorer tab demonstrates RLS isolation without additional infrastructure cost or security risk. Demo script shows: same query (e.g., "list all patients") returns different results for different tenants — proof that RLS is enforcing tenant isolation at the database layer.
- **Implementation scope:**
  - **Basher:** Build `/api/sql-explorer` backend routes with parameterized queries; results filtered by persona's `SESSION_CONTEXT('tenant_id')`
  - **Linus:** Add SQL Explorer UI tab to case manager view (read-only, admin-level)
  - **Livingston:** No infra changes required; existing DB supports parameterized queries
- **Demo impact:** Visual proof of multi-tenancy isolation; supports narrative "You see only YOUR hospital's data"
- **Decision ID:** `sql-explorer-strategy-001` documented in `.squad/decisions.md`

### 2026-05-13 — Demo Readiness Gap Analysis
- **Goal:** Identify what's needed to make MedRequest a working, walkable demo
- **Method:** Code review of all API routes, services, middleware, DB queries, frontend views, and integration
- **Current State:** **50% functional** — core architecture and persona switcher work, but 3 critical business logic gaps prevent end-to-end workflows
- **Critical Issues Found:**
  1. **Request Type Mismatch** (BLOCKING patient workflow): Patient form sends `comfort`, `service`, `staff` but API only accepts `feedback`, `concierge`, `case_manager`. Frontend form validation fails at API submission.
  2. **Concierge Forward Actions Missing** (BLOCKING concierge workflow): Concierge view renders "Start Working" and "Resolve" buttons but lacks "Forward" actions. No cross-role handoff UI wired.
  3. **Case Manager Forward Actions Incomplete** (BLOCKING case manager workflow): Case manager view has button definitions for `forward-record` and `forward-bizoffice` but handler (_handleAction) is stubbed—no API integration endpoint called.
- **Secondary Issues:**
  1. Harbor Medical sample requests missing from seed data (empty demo lists for Harbor users)
  2. Integration service endpoints exist but are mock stubs (acceptable for POC, intentional scaffolding)
  3. Error handling and loading UX are minimal but functional
- **Root Cause Analysis:**
  - Type mismatch: Frontend and API contract diverged (API follows schema CHECK constraint, form uses patient-friendly labels)
  - Action handling: Basher completed API scaffolding but Linus's frontend implementation incomplete (buttons exist, handlers missing)
  - Seeding: Harbor Medical tenant created but no sample requests inserted
- **API Assessment:** All CRUD endpoints real and database-backed; RLS with SESSION_CONTEXT working; auth middleware validated; 6 query functions fully implemented with parameterized inputs
- **Frontend Assessment:** Auth, API client, personas, picker, all views render; persona detection works; problem is in view handler completeness and form field alignment
- **Database Assessment:** Schema correct, RLS policies active, 3 tenants + 7 users seeded, but only 2 tenants have sample requests
- **Recommended Priority Fix List:**
  - **Linus (1–2 hours):** Fix patient form types, complete concierge/case manager forward action handlers
  - **Basher (1–2 hours):** Align request types (decide: update API or form), wire forward endpoints, seed Harbor requests
  - **Total effort to demo-ready: 3–4 hours**
- **Demo Flow Options:**
  - **Without fixes:** Show persona switcher and request listing (works); skip patient submission and forwarding
  - **With fixes:** Full end-to-end workflow — patient submits request → concierge works it → case manager forwards to EMR

### 2026-05-12 — Demo Readiness Fixes Completed by Team
- **Status:** All 4 critical gaps fixed; demo now walkable end-to-end ✅
- **Basher's contributions:** Type mapping via `normalizeType()`, integration endpoints fully wired, Harbor Medical seed data (2 additional requests), @read_only removal validated
- **Linus's contributions:** Concierge full workflow (Acknowledge → In Progress → Resolve → Forward), case manager forward actions wired to integration endpoints, toast UI replaces all alerts, statuses `acknowledged` and `closed` supported in UI
- **Livingston's contributions:** App redeployed to `app-medrequest-demo`, DB constraint updated to include new statuses, Harbor seed data verified in live environment
- **Coordinator's contributions:** DB constraint fix coordination
- **Outcomes:**
  - Patient workflow: ✅ Form types normalized, API accepts `comfort`/`service`/`staff`
  - Concierge workflow: ✅ Full state machine (Acknowledge → In Progress → Resolve → Forward to Case Manager)
  - Case manager workflow: ✅ Forward to EMR/Business Office wired to integration endpoints
  - Integration: ✅ All endpoints functional (EMR/comms mocked for POC)
  - Seeding: ✅ 3 tenants, 10 users, 9 requests balanced across all hospitals
  - All 9 personas: ✅ Functional, bookmarkable, tested end-to-end
- **Live app:** https://app-medrequest-demo.azurewebsites.net — full walkable demo operational
- **Architecture validation:** Project structure confirmed; multi-tenant RLS working; all ownership boundaries respected

### 2026-05-13 — TESTING.md Rewritten as Definitive Deployment Runbook
- **Trigger:** Chris spent 70+ minutes debugging a deployment due to undocumented gotchas
- **Scope:** Complete rewrite of `docs/TESTING.md` — restructured from a loose guide into a phased runbook (Phase 0–5) that a zero-context deployer can follow end-to-end
- **Key learnings captured:**
  1. **Soft-delete conflicts:** APIM and Key Vault soft-deletes cause cryptic naming errors on re-deploy. Added Phase 1 pre-flight purge checks (`az apim deletedservice list`, `az keyvault list-deleted`).
  2. **APIM provisioning time:** Consumption tier takes 15–30 minutes — CLI appears hung. Documented explicitly so deployers don't abort.
  3. **Post-infra ordering matters:** APIM key → Key Vault → SQL firewall → managed identity SQL grant → migrations → seed. Out-of-order causes cascading failures.
  4. **`az webapp up` gotchas:** Resets startup command silently; Oryx remote `npm install` is extremely slow on fresh instances; can leave container crash-looping. Added mandatory post-deploy verification and recovery steps.
  5. **Startup command sensitivity:** Must be `node server.js` (the actual entrypoint in `src/api/server.js`), not `npm start` or anything else. `az webapp up` may overwrite this.
  6. **Frontend sync requirement:** `src/frontend/` must be copied to `src/api/public/` before every deploy — Express serves from `public/`.
  7. **Key Vault reference resolution:** `APIM_SUBSCRIPTION_KEY` and `APIM_GATEWAY_URL` are Key Vault references in app settings — if the secret doesn't exist or the managed identity lacks `Key Vault Secrets User`, the app shows `KeyVaultReferenceNotResolved`.
- **Document structure:** Prerequisites → Pre-deploy checks → Bicep deploy → Post-infra setup (ordered) → App deploy with gotchas → Verification checklist → Troubleshooting → Cleanup → CI/CD appendix
- **Bicep parameter table:** Added complete reference with all 8 parameters, defaults, and notes
- **File:** `docs/TESTING.md` — now ~450 lines, fully self-contained
