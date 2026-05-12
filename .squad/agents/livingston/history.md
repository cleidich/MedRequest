# Livingston — History

## Project Context
- **Project:** MedRequest — hospital patient communication/concierge request app (demo/POC)
- **User:** cleidich
- **Stack:** Bicep IaC, GitHub Actions CI/CD, single "dev" environment
- **Azure resources:** App Service, Functions, APIM, App Gateway (WAF), Azure SQL, Key Vault, App Insights, Log Analytics, Blob Storage
- **Security:** Managed identities everywhere, RBAC for Key Vault, private networking where cost-effective
- **Constraints:** Free/low-cost SKUs (Basic/Standard, not Premium), flag cost increases for private networking

## Learnings

### 2025-07-14 — Project Structure Context
- **Infrastructure ownership:** Modular Bicep in `infra/` with per-service modules
- **Networking:** VNet with App Gateway subnet, App Service integration, SQL private endpoint
- **Compute:** App Service (F1/B1), APIM (Consumption), Functions (Consumption), App Gateway (Standard_v2)
- **Database:** Azure SQL (Basic/5 DTU), RLS-based multi-tenancy, private endpoint
- **Observability:** Single Log Analytics Workspace, App Insights, all resources have diagnostic settings
- **Cost strategy:** Free/Basic/Standard SKUs throughout, private networking justified by cost
- **CI/CD ownership:** GitHub Actions workflows in `.github/workflows/`
- **Co-ownership:** DB infrastructure with Basher (who owns schema and queries)
- **Key context:** Project decision `project-structure-001` documented in `.squad/decisions.md`
- **Reference:** See `docs/PROJECT-STRUCTURE.md` for full directory tree and ownership boundaries

