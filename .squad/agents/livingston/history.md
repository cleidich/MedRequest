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

### 2025-07-14 — Infrastructure Scaffolding Complete
- **Created 10 Bicep modules** in `infra/modules/`: managed-identity, networking, monitoring, key-vault, storage, sql, app-service, functions, apim, app-gateway
- **Orchestrator:** `infra/main.bicep` composes all modules with dependency ordering; `infra/main.bicepparam` for dev defaults
- **Naming convention:** `{resource-prefix}-{projectName}-{environment}` (e.g., `app-medrequest-dev`)
- **Identity:** Single user-assigned managed identity shared by App Service, Functions; granted Key Vault Secrets User + Storage Blob Data Contributor
- **SQL:** AAD-only auth, private endpoint with private DNS zone, managed identity as admin
- **Key Vault:** RBAC-enabled (no access policies), soft delete with 7-day retention, purge allowed for POC cleanup
- **Networking:** VNet with 3 subnets (appgw, appsvc delegation, private endpoints), NSGs per subnet
- **App Service:** B1 SKU (required for VNet integration), Linux/Node 20, wired to App Insights + Key Vault + SQL
- **Functions:** Consumption (Y1) with dedicated storage account, Linux/Node 20
- **APIM:** Consumption tier (no VNet injection — runs outside VNet), backend set to App Service hostname
- **App Gateway:** Standard_v2 with WAF (OWASP 3.2, Detection mode), autoscale 0-2 instances
- **Diagnostics:** Every resource sends logs/metrics to the shared Log Analytics Workspace
- **CI/CD:** `.github/workflows/ci.yml` (Bicep lint + Node tests on PR), `deploy.yml` (infra + app deploy on push to main, OIDC auth)
- **Cost flags:** App Gateway ~$146/mo is biggest cost; APIM Consumption is pay-per-call; B1 over F1 needed for VNet integration
- **Bicep validates clean** via `az bicep build`
- **Seed script:** `infra/scripts/seed-sql.sh` for bootstrapping DB schema via sqlcmd with AAD auth
- **Cross-team note (from Basher):** Pool must use `@azure/identity` for managed identity tokens; SQL schema bootstrap via seed script runs migrations + seed
- **Cross-team note (from Linus):** Frontend served from App Service static content path `/`; APIM optional for API gateway layer (traffic can bypass to App Service directly)

