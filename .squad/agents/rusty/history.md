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
