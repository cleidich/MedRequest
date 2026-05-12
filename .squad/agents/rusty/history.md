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
