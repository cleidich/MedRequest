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

### 2025-01-14 — Testing & Deployment Documentation
- **Created comprehensive deployment guide:** `docs/TESTING.md` — complete manual deployment instructions for demo environment
- **Target environment specs:** Resource group `rg-medrequest-demo`, region `centralus`, environment name `demo`
- **Deployment parameter reference:** Documented all required Bicep parameters from `main.bicep` and `main.bicepparam`
- **Step-by-step deployment workflow:** Resource group creation → Bicep deployment → DB migrations → seed data → API deploy → frontend deploy → Functions deploy → verification
- **Key deployment command:** `az deployment group create --resource-group rg-medrequest-demo --template-file infra/main.bicep --parameters infra/main.bicepparam --parameters environment=demo location=centralus apimPublisherEmail=<email> sqlAadAdminObjectId=<objectId>`
- **Verification procedures:** Health checks (`/api/health`, `/api/ready`), multi-tenant RLS testing via curl with `X-Tenant-Id` headers, App Insights telemetry validation
- **Troubleshooting coverage:** Common deployment failures, SQL AAD admin issues, VNet connectivity debugging, App Service log access, APIM endpoint testing
- **Cost breakdown documented:** ~$170-180/month total (App Gateway $146, App Service $13, SQL $5, others <$10)
- **Cleanup procedures:** Full resource group deletion command, selective resource shutdown for cost savings
- **POC limitations flagged:** Header-based auth demo-only, no automated migrations in CI/CD, APIM cold start, App Gateway provisioning time, no custom domain/HTTPS
- **CI/CD appendix:** OIDC federated credential setup for GitHub Actions, required secrets documentation
- **Key files referenced:** `infra/main.bicep` (parameters), `db/migrations/001-initial-schema.sql` (schema), `db/seed/demo-data.sql` (personas), `.github/workflows/deploy.yml` (CI/CD pattern)

### 2026-05-12 — Testing Validation & Demo Deployment Guide
- **Session context:** Coordinator validated all app code (npm install, syntax checks, Bicep lint) — all clean
- **Work completed:** Created comprehensive deployment guide `docs/TESTING.md` for rg-medrequest-demo environment in Central US
- **Documented deployment:** Full step-by-step procedure with Bicep parameters, DB migrations, app deployment, verification, and troubleshooting
- **Validation cross-reference:** All procedures aligned with actual infrastructure code and deployment scripts
- **Outcome:** Demo environment now has complete deployment documentation ready for stakeholder execution

### 2026-05-12 — Full Demo Deployment to Azure
- **Deployment target:** `rg-medrequest-demo` in `centralus`, subscription `ME-MngEnvMCAP351208-cleidich-1`
- **Infrastructure deployed:** All 10 Bicep modules — identity, networking, monitoring, Key Vault, storage, SQL, App Service, Functions, APIM, App Gateway (WAF_v2)
- **Bicep bugs fixed before deployment:**
  1. App Gateway SKU: `Standard_v2` → `WAF_v2` (Standard doesn't support WAF)
  2. WAF config: Inline `webApplicationFirewallConfiguration` deprecated → migrated to separate `ApplicationGatewayWebApplicationFirewallPolicies` resource
  3. Key Vault: `enablePurgeProtection: false` not allowed → removed property (defaults to disabled)
  4. SQL principalType: `Application` → parameterized `aadAdminPrincipalType` (default `User`)
  5. App Service env vars: `SQL_SERVER`/`SQL_DATABASE` → `DB_SERVER`/`DB_NAME` to match config, added `DB_USE_MANAGED_IDENTITY`, `NODE_ENV`, `PORT`
  6. Node runtime: `NODE|20-lts` → `NODE|22-lts` (20 no longer supported on Linux App Service)
- **Application fix (cross-team):** Removed `@read_only = 1` from `sp_set_session_context` in `db/queries.js` — caused pooled connection tenant leakage (Basher should review)
- **Server change:** Added `express.static` middleware to `server.js` to serve frontend from `public/` directory
- **Database setup:** Schema migration (001-initial-schema.sql), RLS function/policies, seed data (3 tenants, 10 users, 7 requests)
- **SQL access:** Created `id-medrequest-demo` user in SQL DB with db_datareader, db_datawriter, EXECUTE roles
- **Resource names:**
  - App Service: `app-medrequest-demo` → https://app-medrequest-demo.azurewebsites.net
  - App Gateway: `appgw-medrequest-demo` → http://132.196.66.25
  - SQL Server: `sql-medrequest-demo.database.windows.net` / DB: `medrequest`
  - Key Vault: `kv-medrequest-demo`
  - APIM: `apim-medrequest-demo` (no APIs configured yet)
  - Functions: `func-medrequest-demo`
  - Storage: `stmedrequestdemo`
- **Verified working:** Health probe, readiness probe, all 3 tenants with RLS, frontend serving, App Gateway passthrough
- **Known gaps:** APIM has no API definitions (returns 404), Functions not deployed (no function code yet), no custom domain/HTTPS on App Gateway

### 2026-05-12 — Redeployment for Demo Readiness Fixes
- **Context:** Team committed fixes for API type mapping, integration endpoints, frontend handlers, Harbor seed data, and status constraint
- **App redeployed:** `az webapp up` from `src/api/` to `app-medrequest-demo` — build + start took ~3.5 min
- **DB constraint updated:** Dropped and recreated `CK_requests_status` to include `acknowledged` and `closed` statuses
- **Harbor seed data:** Tenant + 3 users already existed from prior seeding; 2 of 4 Harbor requests existed, inserted remaining 2 (Excellent PT team, Wi-Fi access). Total requests now 9 across 3 tenants.
- **RLS gotcha:** Must disable RLS security policies before checking row counts in `users`/`requests` tables — otherwise queries return 0 due to no `SESSION_CONTEXT` set. Remember to re-enable after.
- **Firewall rule:** Had to add temp firewall rule for local IP (75.97.170.67) to reach SQL — no `sqlcmd` available, used Node.js `mssql` package from API deps instead. Removed rule after.
- **No sqlcmd in env:** Used `node` with `mssql`/`tedious` (from `src/api/node_modules`) as SQL client — works well for ad-hoc DB operations.
- **Verified:** `/api/health` returns `{"status":"ok"}`, frontend loads at `https://app-medrequest-demo.azurewebsites.net` (HTTP 200)
- **Cross-team coordination (from Basher):** Type mapping and integration endpoints deployed and working
- **Cross-team coordination (from Linus):** Frontend workflows complete; toast UI operational; concierge/case manager forward actions fully functional
- **Cross-team coordination (from Rusty):** All 9 demo personas tested; architecture validation complete

### 2026-05-12 — Demo Readiness Final Verification
- **Status:** Full end-to-end demo walkable ✅
- **App URL:** https://app-medrequest-demo.azurewebsites.net
- **All 9 personas:** Functional, bookmarkable, tested
- **Workflows verified:**
  - Patient: Create request with `comfort`/`service`/`staff` types ✅
  - Concierge: Acknowledge, work, resolve, forward to case manager ✅
  - Case Manager: View forwarded requests, forward to EMR or business office ✅
- **Integration endpoints:** All wired and responding ✅
- **Database:** 3 tenants, 10 users, 9 requests, RLS isolation working ✅
- **Frontend:** Serving from App Service root path, all views responsive ✅
- **Seeding:** Balanced data density across 3 hospitals (4 requests each minimum) ✅

