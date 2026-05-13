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

### 2026-05-12 — APIM Wired to App Service Backend
- **Context:** Imported OpenAPI spec into APIM and configured as API gateway layer for demo
- **API imported:** `medrequest-api` at path `/medrequest` on `apim-medrequest-demo`
- **Backend:** Uses the existing `medrequest-backend` named backend (from Bicep) pointing to `https://app-medrequest-demo.azurewebsites.net`
- **Policies configured:**
  - Rate limiting: 100 calls/minute per subscription (demonstrates throttling)
  - CORS: App Service origin + localhost allowed, credentials enabled
  - Header forwarding: X-Tenant-Id, X-User-Id, X-User-Role pass through to backend
  - Backend service set to named backend `medrequest-backend`
- **Subscription created:** `medrequest-demo-sub` scoped to the MedRequest API
- **Primary key:** `70cee38f45ec4aeaaffc2eb7aa62f1ca`
- **Secondary key:** `2836fb5f5541483d9a5126581fa74c52`
- **Gateway URL:** `https://apim-medrequest-demo.azure-api.net`
- **API base path:** `https://apim-medrequest-demo.azure-api.net/medrequest/api/...`
- **Verified:** Health probe and authenticated requests endpoint both return 200 through APIM
- **CLI note:** `az apim api policy` and `az apim subscription` commands not available in this CLI version — used `az rest` with ARM REST API directly
- **Conversion note:** OpenAPI YAML → JSON conversion required for APIM import CLI
- **Cross-team (Linus):** Frontend can optionally route API calls through APIM by setting base URL to `https://apim-medrequest-demo.azure-api.net/medrequest` and adding `Ocp-Apim-Subscription-Key` header

### 2026-05-12 — APIM Secrets Stored in Key Vault with App Service References
- **Context:** Security requirement — no hard-coded secrets or URLs in app code; retrieve from Key Vault at runtime
- **Secrets stored in `kv-medrequest-demo`:**
  - `apim-gateway-url` → `https://apim-medrequest-demo.azure-api.net/medrequest/api`
  - `apim-subscription-key` → `70cee38f45ec4aeaaffc2eb7aa62f1ca`
- **RBAC grants:**
  - Current user (`58d93bbd-...`) granted `Key Vault Secrets Officer` (to write secrets)
  - App Service managed identity (`id-medrequest-demo`, principal `5e8003ea-...`) granted `Key Vault Secrets User` (to read secrets at runtime)
- **App Service config:**
  - `APIM_GATEWAY_URL` → `@Microsoft.KeyVault(SecretUri=https://kv-medrequest-demo.vault.azure.net/secrets/apim-gateway-url/)`
  - `APIM_SUBSCRIPTION_KEY` → `@Microsoft.KeyVault(SecretUri=https://kv-medrequest-demo.vault.azure.net/secrets/apim-subscription-key/)`
  - `keyVaultReferenceIdentity` set to user-assigned identity `id-medrequest-demo` (required because App Service uses user-assigned, not system-assigned identity)
- **Verified:** App restarted, health probe returns OK, settings resolve via Key Vault references
- **Key Vault reference gotcha:** When App Service uses a user-assigned managed identity (not system-assigned), you must explicitly set `keyVaultReferenceIdentity` to the identity resource ID — otherwise Key Vault references fail silently
- **Cross-team (Basher):** Backend can now read `process.env.APIM_GATEWAY_URL` and `process.env.APIM_SUBSCRIPTION_KEY` — values are resolved from Key Vault at startup, no secrets in code


### 2026-05-12 — Key Vault Config Pattern Documented
- **Context:** Three-agent integration of secret storage + config endpoint + frontend runtime fetch
- **Pattern established:** All secrets (APIM keys, gateway URLs) stored in Key Vault, referenced via App Service app settings using Key Vault reference syntax
- **Key learning:** When App Service uses user-assigned managed identity, explicitly set `keyVaultReferenceIdentity` in app settings — otherwise references fail silently
- **Handoff:** Pattern documented in orchestration log and decisions.md (decision `keyvault-refs-001`). All future secret handling should follow this model.

### 2026-07-25 — Bicep Synced with Live APIM, Key Vault, and App Service Config
- **Context:** APIM API, Key Vault secrets, and App Service Key Vault references were configured manually via CLI but missing from Bicep — fresh IaC deploy wouldn't reproduce the live state
- **APIM (`infra/modules/apim.bicep`):**
  - Added `medrequest-api` API resource with path `medrequest`, HTTPS only, backend pointing to App Service
  - Added all 11 operations matching live config: health, ready, list/get/create/update requests, integration endpoints, debug explorer
  - Added API-level policy: rate limiting (100 calls/60s), CORS (all origins), auth header passthrough (X-Tenant-Id, X-User-Id, X-User-Role), set-backend-service to named backend
- **Key Vault (`infra/modules/key-vault.bicep`):**
  - Added `APIM-GATEWAY-URL` secret (composed from APIM gateway URL + `/medrequest` path)
  - Added `APIM-SUBSCRIPTION-KEY` secret with `@secure()` param (empty default — user provides at deploy time or post-deploy)
  - New params: `apimGatewayUrl`, `apimSubscriptionKey`
- **App Service (`infra/modules/app-service.bicep`):**
  - Added `APIM_GATEWAY_URL` and `APIM_SUBSCRIPTION_KEY` app settings as Key Vault references
  - Added `keyVaultReferenceIdentity` pointing to the user-assigned managed identity (required for Key Vault refs with user-assigned identity)
  - New param: `keyVaultName`
- **main.bicep:**
  - Added `apimSubscriptionKey` secure param
  - Computed `keyVaultName` and `apimGatewayUrl` as vars from `baseName` to avoid circular dependency (APIM→App Service→Key Vault→APIM)
  - Wired new params to key-vault and app-service modules
- **Circular dependency gotcha:** APIM needs App Service hostname, Key Vault needs APIM gateway URL, App Service needs Key Vault name — broke the cycle by computing deterministic resource names from `baseName` instead of cross-module output references
- **Validated:** `az bicep build --file infra/main.bicep` passes clean (only pre-existing storage warning)

### 2026-05-13 — Fresh Azure Deployment from Scratch
- **Context:** Chris deleted resource group after laptop shutdown mid-deploy. Full clean-slate redeploy.
- **Pre-deploy cleanup:** Purged soft-deleted APIM (`apim-medrequest-demo`) and Key Vault (`kv-medrequest-demo`) — both were in soft-delete from prior RG deletion. APIM purge took ~2 min, Key Vault purge took ~10 min.
- **Bicep deployment:** All 10 modules deployed successfully in ~15 min. No Bicep changes needed this time — prior fixes from 2026-05-12 all held.
- **APIM subscription key:** `az apim subscription` CLI not available — used `az rest` with ARM REST API (`listSecrets` on `/subscriptions/master`) to retrieve built-in key.
- **Key Vault RBAC:** Had to manually grant current user `Key Vault Secrets Officer` role — Bicep only grants `Key Vault Secrets User` to the managed identity, not to the deployer. RBAC propagation takes ~15s.
- **Database setup gotcha:** No `sqlcmd` in environment. Used Node.js `tedious` driver directly (not `mssql` wrapper) because `mssql`'s `.query()` and `.batch()` methods both interpret `@` as parameter markers, breaking `CREATE FUNCTION` statements with `@tenant_id` parameters. With raw tedious `execSqlBatch()`, the SQL executes correctly.
- **Database name:** Bicep creates DB as `medrequest` (not `sqldb-medrequest-demo`). Must use correct name in connection strings.
- **App deployment critical issue:** `az webapp up` creates zip that excludes or doesn't properly install `node_modules`. Three approaches failed:
  1. Default `az webapp up` — express module not found
  2. `SCM_DO_BUILD_DURING_DEPLOYMENT=true` with Oryx — build reports success but npm install doesn't run
  3. `ENABLE_ORYX_BUILD=true` — same result
- **Solution:** Set custom startup command `npm install --production && node server.js` — this runs npm install on every cold start. Works but adds ~30s to startup time.
- **Startup command reset:** `az webapp up` resets `appCommandLine` to `node server.js`. After any `az webapp up`, must re-set the custom startup command.
- **Key Vault references:** Require `keyVaultReferenceIdentity` set to user-assigned managed identity resource ID. Without it, KV references return literal `@Microsoft.KeyVault(...)` strings. Must also grant MI `Key Vault Secrets User` role separately (Bicep handles this but RBAC propagation may delay).
- **APIM gateway URL:** Stored as `https://apim-medrequest-demo.azure-api.net/medrequest/api` (with `/api` suffix) so proxy routes correctly. Previous Bicep default was `/medrequest` without `/api`.
- **Verified working:**
  - Health: `GET /api/health` → 200 ✅
  - Config: APIM enabled, KV references resolved ✅
  - Direct API: 3 Mercy General requests with RLS isolation ✅
  - APIM Proxy Health: 200 via gateway ✅
  - APIM Proxy Requests: Data flows through APIM ✅
  - Behind the Scenes Explorer: SQL introspection working ✅
  - Frontend: HTTP 200 ✅
- **App URL:** https://app-medrequest-demo.azurewebsites.net
- **Cold start:** ~2-3 min after stop/start due to npm install in startup command
- **Cleanup:** Removed temp SQL firewall rule after DB setup

### 2026-07-25 — Automated APIM Subscription Key Retrieval in Bicep
- **Context:** Manual post-deploy step (retrieve APIM key via CLI, store in Key Vault) eliminated — Bicep now handles it end-to-end
- **Approach:** Use `existing` resource reference to APIM's built-in `master` subscription in `main.bicep`, call `listSecrets().primaryKey`, write directly to Key Vault secret
- **Key Bicep pattern:** Can't use module output names with `existing` resources (BCP307) — must use deterministic name strings (e.g., `'apim-${baseName}'`) instead of `apim.outputs.apimServiceName`
- **Dependency chain fix:** Moved `APIM-SUBSCRIPTION-KEY` secret out of `key-vault.bicep` module into `main.bicep` as a standalone resource — this avoids circular dependency (Key Vault → APIM) while preserving APIM → App Service → Key Vault ordering
- **Security:** Key never exposed as a module output or deployment parameter — stays in-memory via `listSecrets()` and goes directly to Key Vault
- **Removed:** `@secure() param apimSubscriptionKey` from `main.bicep` and `key-vault.bicep` — no longer needed as an input
- **Docs updated:** `docs/TESTING.md` step 3a now marked as automated; removed manual CLI commands
- **Validated:** `az bicep build --file infra/main.bicep` passes clean (only pre-existing storage warning)
