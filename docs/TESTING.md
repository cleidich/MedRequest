# MedRequest — Deployment Runbook

> **This is the definitive deployment guide.** Someone with zero context should be able to deploy
> MedRequest from scratch using only this document.
>
> **Recommended path:** Use `azd up` (see [Quick Deploy with azd](#quick-deploy-with-azd-recommended) below) for a single-command deployment. The manual phases are preserved for reference and troubleshooting.

## Target Environment

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Resource Group** | `rg-medrequest-demo` | Demo environment |
| **Region** | `centralus` | Central US |
| **Environment Name** | `demo` | Used in resource naming |
| **Naming Pattern** | `{type}-medrequest-demo` | e.g., `app-medrequest-demo`, `kv-medrequest-demo` |
| **App URL** | `https://app-medrequest-demo.azurewebsites.net` | After deployment |

---

## Phase 0 — Prerequisites

### Required Tools

| Tool | Minimum Version | Check Command | Install |
|------|----------------|---------------|---------|
| Azure CLI | 2.50+ | `az version` | [Install](https://learn.microsoft.com/cli/azure/install-azure-cli) |
| Azure Developer CLI (azd) | 1.5+ | `azd version` | [Install](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd) |
| Bicep CLI | 0.20+ (bundled) | `az bicep version` | Bundled with Azure CLI |
| Node.js | 18+ LTS | `node --version` | [Install](https://nodejs.org/) |
| jq | Any | `jq --version` | `brew install jq` / `apt install jq` |
| curl | Any | `curl --version` | Pre-installed on most systems |
| GitHub CLI | (optional) | `gh --version` | [Install](https://cli.github.com/) |

### Required Azure Permissions

- **Contributor** on the target subscription (create/manage resources)
- **User Access Administrator** or **Owner** (assign RBAC roles to managed identity)
- Ability to create **Microsoft Entra ID** service principals (for CI/CD OIDC)

### Authenticate & Verify Identity

```bash
az login
az account set --subscription <YOUR_SUBSCRIPTION_ID>
az account show --query '{name:name, id:id, user:user.name}' -o table
```

### Gather Required Values

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
YOUR_AAD_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)

echo "Subscription: $SUBSCRIPTION_ID"
echo "Tenant:       $TENANT_ID"
echo "Your AAD ID:  $YOUR_AAD_OBJECT_ID"
```

You will also need your **email address** for the `apimPublisherEmail` parameter.

---

## Quick Deploy with azd (Recommended)

> **This is the fastest path from clone to running app.** `azd up` handles infrastructure
> provisioning, database setup, migrations, seeding, app deployment, and health verification
> in a single command. The manual phases below are preserved for reference and troubleshooting.

### Step 1: Authenticate

```bash
az login
azd auth login
```

### Step 2: Create an Environment

```bash
azd env new demo
azd env set AZURE_LOCATION centralus
```

> Replace `demo` with any environment name (e.g., `dev`, `staging`). This name flows into
> resource naming: `rg-medrequest-demo`, `app-medrequest-demo`, etc.

### Step 3: Deploy Everything

```bash
azd up
```

### What Happens During `azd up`

| Phase | Hook / Stage | What It Does |
|-------|-------------|-------------|
| **preprovision** | `infra/scripts/preprovision.sh` | Checks for soft-deleted APIM and Key Vault resources that would block provisioning |
| **provision** | Bicep (`infra/main.bicep`) | Creates all Azure resources: App Service, SQL, APIM, Key Vault, App Gateway, VNet, monitoring (~15–30 min for APIM) |
| **postprovision** | `infra/scripts/postprovision.sh` | Adds deployer IP to SQL firewall, grants managed identity SQL access, runs database migrations, seeds demo data |
| **prepackage** | (inline in `azure.yaml`) | Syncs `src/frontend/*` → `src/api/public/` |
| **deploy** | azd zip deploy | Packages and deploys `src/api` to App Service |
| **postdeploy** | `infra/scripts/postdeploy.sh` | Sets `node server.js` startup command, restarts app, runs health check |

> ⏱ **Total time:** ~20–40 minutes on first deploy (APIM provisioning dominates). Subsequent
> `azd deploy` (code-only) takes 2–5 minutes.

### Step 4: Access the App

After `azd up` completes, the postdeploy hook prints the app URL:

```
🎉 Deployment complete!
   App URL: https://app-medrequest-demo.azurewebsites.net
   Health:  https://app-medrequest-demo.azurewebsites.net/api/health
   Ready:   https://app-medrequest-demo.azurewebsites.net/api/ready
```

Open the App URL in a browser to see the persona picker with 9 demo personas (3 hospitals × 3 roles).

### Redeploying Code Changes

To redeploy just the application code (without re-provisioning infrastructure):

```bash
azd deploy
```

This runs prepackage (frontend sync) → zip deploy → postdeploy (startup command + health check).

### Managing Multiple Environments

```bash
azd env list                  # List all environments
azd env select staging        # Switch to a different environment
azd env new staging           # Create a new environment
azd env set AZURE_LOCATION eastus  # Set a variable for the current environment
```

### Tearing Down Resources

```bash
azd down                      # Destroy all resources in the current environment
```

> ⚠️ This deletes everything in the resource group. Use `azd down --purge` to also purge
> soft-deleted APIM and Key Vault resources (prevents conflicts on re-deploy).

---

## Manual Deployment Phases (Reference)

> The phases below document the individual steps that `azd up` automates. Use them for
> **troubleshooting**, **understanding what azd does under the hood**, or if you need to
> run specific steps manually.

---

## Phase 1 — Pre-Deployment Checks

> ℹ️ **If you used `azd up`, these checks were handled automatically by the `preprovision` hook.**
> The manual steps below are for reference or troubleshooting.

> ⚠️ **Do not skip this.** Azure soft-deletes certain resources. If a previous deployment was
> torn down, leftover soft-deleted resources will cause naming conflicts and cryptic errors.

### 1a. Check for Soft-Deleted APIM Instances

```bash
az apim deletedservice list -o table
```

If you see `apim-medrequest-demo` in the output, purge it:

```bash
az apim deletedservice purge \
  --service-name apim-medrequest-demo \
  --location centralus
```

### 1b. Check for Soft-Deleted Key Vaults

```bash
az keyvault list-deleted -o table
```

If you see `kv-medrequest-demo` in the output, purge it:

```bash
az keyvault purge --name kv-medrequest-demo
```

### 1c. Create Resource Group (if it doesn't exist)

```bash
az group create \
  --name rg-medrequest-demo \
  --location centralus \
  --tags project=medrequest environment=demo managedBy=bicep
```

---

## Phase 2 — Infrastructure Deployment (Bicep)

> ℹ️ **If you used `azd up`, infrastructure was provisioned automatically.** The `azd provision`
> step runs this Bicep deployment for you, and Bicep outputs are captured as azd environment
> variables. The manual steps below are for reference or troubleshooting.

This provisions ALL Azure resources: App Service, Azure SQL, Key Vault, APIM, App Gateway (WAF),
Functions, Storage, VNet, Monitoring (App Insights + Log Analytics), and a user-assigned managed
identity.

### Complete Deployment Command

```bash
YOUR_AAD_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)

az deployment group create \
  --resource-group rg-medrequest-demo \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  --parameters environment=demo location=centralus \
  --parameters apimPublisherEmail=<your-email> \
  --parameters sqlAadAdminObjectId=$YOUR_AAD_OBJECT_ID \
  --parameters appServicePlanSku=B1 wafMode=Detection
```

### Bicep Parameter Reference

| Parameter | Required | Default | Notes |
|-----------|----------|---------|-------|
| `location` | No | `resourceGroup().location` | Use `centralus` |
| `environment` | No | `dev` | Use `demo` |
| `projectName` | No | `medrequest` | Base name for all resources |
| `apimPublisherEmail` | **Yes** | — | Your email for APIM notifications |
| `sqlAadAdminObjectId` | No | Managed identity | Your AAD object ID for SQL admin |
| `wafMode` | No | `Detection` | `Detection` or `Prevention` |
| `appServicePlanSku` | No | `B1` | `B1` minimum for VNet integration |
| `tags` | No | Auto-generated | `project`, `environment`, `managedBy` |

### ⏱ Timing Expectations

| Resource | Provisioning Time |
|----------|-------------------|
| APIM (Basic v2 tier) | **~5 minutes** |
| App Gateway (WAF Standard_v2) | **5–15 minutes** |
| Everything else | 2–5 minutes |

> The deployment CLI will appear to hang while APIM and App Gateway provision. This is normal.
> Total wall-clock time: **10–25 minutes** for a fresh deployment.

### Capture Deployment Outputs

```bash
DEPLOYMENT_OUTPUT=$(az deployment group show \
  --resource-group rg-medrequest-demo \
  --name main \
  --query 'properties.outputs' -o json)

WEB_APP_HOSTNAME=$(echo $DEPLOYMENT_OUTPUT | jq -r '.webAppHostname.value')
SQL_SERVER_FQDN=$(echo $DEPLOYMENT_OUTPUT | jq -r '.sqlServerFqdn.value')
APIM_GATEWAY_URL=$(echo $DEPLOYMENT_OUTPUT | jq -r '.apimGatewayUrl.value')

echo "Web App:    https://$WEB_APP_HOSTNAME"
echo "SQL Server: $SQL_SERVER_FQDN"
echo "APIM:       $APIM_GATEWAY_URL"
```

---

## Phase 3 — Post-Infrastructure Setup

> ℹ️ **If you used `azd up`, these steps were handled automatically by the `postprovision` hook**
> (`infra/scripts/postprovision.sh`). The hook uses Node.js + mssql instead of sqlcmd for all
> database operations. The manual steps below are for reference or troubleshooting.

These steps MUST be done **in order** after Bicep completes.

### 3a. APIM Subscription Key in Key Vault (Automated)

> **No manual step required.** The Bicep deployment automatically retrieves the APIM built-in
> subscription key via `listSecrets()` and stores it in Key Vault as `APIM-SUBSCRIPTION-KEY`.
> The App Service reads it at runtime via a Key Vault reference (`@Microsoft.KeyVault(...)` in
> app settings).

### 3b. Grant Your User Key Vault Access (if needed for manual secret operations)

If you need to manually update Key Vault secrets, you need the **Key Vault Secrets Officer** role:

```bash
az role assignment create \
  --assignee $(az ad signed-in-user show --query id -o tsv) \
  --role "Key Vault Secrets Officer" \
  --scope /subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-medrequest-demo/providers/Microsoft.KeyVault/vaults/kv-medrequest-demo
```

### 3c. Add SQL Firewall Rule for Your IP

```bash
MY_IP=$(curl -s ifconfig.me)

az sql server firewall-rule create \
  --resource-group rg-medrequest-demo \
  --server sql-medrequest-demo \
  --name allow-deploy-ip \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP
```

### 3d. Grant Managed Identity SQL Access

The user-assigned managed identity (`id-medrequest-demo`) needs `db_datareader` and `db_datawriter`
roles in the SQL database so the app can read/write data.

> **Note:** The `postprovision` hook handles this automatically using Node.js + mssql (no sqlcmd
> required). The manual sqlcmd approach below is preserved for reference.

```bash
ACCESS_TOKEN=$(az account get-access-token --resource https://database.windows.net/ --query accessToken -o tsv)

# Using Node.js (recommended — no sqlcmd dependency):
node -e "
const sql = require('./src/api/node_modules/mssql');
const config = {
  server: 'sql-medrequest-demo.database.windows.net',
  database: 'medrequest-dev',
  authentication: {
    type: 'azure-active-directory-access-token',
    options: { token: process.env.ACCESS_TOKEN }
  },
  options: { encrypt: true, trustServerCertificate: false }
};
(async () => {
  const pool = await sql.connect(config);
  await pool.request().query(\`
    IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'id-medrequest-demo')
    BEGIN
      CREATE USER [id-medrequest-demo] FROM EXTERNAL PROVIDER;
      ALTER ROLE db_datareader ADD MEMBER [id-medrequest-demo];
      ALTER ROLE db_datawriter ADD MEMBER [id-medrequest-demo];
      GRANT EXECUTE TO [id-medrequest-demo];
    END
  \`);
  await pool.close();
  console.log('✅ Managed identity SQL access granted');
})();
"
```

### 3e. Run Database Migrations

> **Note:** Migrations now run automatically at app startup via `src/api/db/migrate.js` and during
> `azd up` via `infra/scripts/run-migrations.js`. The Node.js migration runner tracks applied
> migrations in a `_migrations` table and handles GO batch separators. Manual execution is only
> needed for troubleshooting.

```bash
# Automated approach (recommended):
cd src/api && npm install && cd ../..
node infra/scripts/run-migrations.js

# Verify schema
ACCESS_TOKEN=$(az account get-access-token --resource https://database.windows.net/ --query accessToken -o tsv)
```

**Expected output:** `tenants`, `users`, `requests` tables.

### 3f. Seed Demo Data

> **Note:** Seeding now runs automatically during `azd up` (via `infra/scripts/run-seed.js`) and
> at app startup (via `src/api/db/seed.js`). The seeder is conditional — it only inserts data when
> the `tenants` table is empty.

```bash
# Automated approach (recommended):
node infra/scripts/run-seed.js
```

**Expected:** After seeding, the tenants table should contain: Mercy General Hospital, St. Claire Medical Center, Harbor Medical Center.

---

## Phase 4 — Application Deployment

> ℹ️ **If you used `azd up` or `azd deploy`, application deployment was handled automatically.**
> `azd` uses zip deploy (more reliable than `az webapp up`), syncs frontend files via the
> `prepackage` hook, and fixes the startup command via the `postdeploy` hook. The manual steps
> below are for reference or troubleshooting.

> ⚠️ **THIS IS THE MOST FAILURE-PRONE STEP (when done manually).** Read this entire section before running anything.

### 4a. Sync Frontend Files

The Express server serves static files from `src/api/public/`. Any changes made in `src/frontend/`
**MUST** be copied to `src/api/public/` before deploying:

```bash
# From the repo root
cp -r src/frontend/* src/api/public/
```

> 🔴 **Every frontend file change** requires this copy. If you skip it, the live app will serve
> stale frontend code.

### 4b. Deploy with `az webapp up`

```bash
cd src/api

az webapp up \
  --name app-medrequest-demo \
  --resource-group rg-medrequest-demo \
  --runtime "NODE:22-lts"
```

### ⚠️ Known Issues with `az webapp up`

**Issue 1: Slow first deploy (5–15+ minutes)**

On a fresh App Service instance, Oryx (the build system) runs `npm install` remotely when
`SCM_DO_BUILD_DURING_DEPLOYMENT=true`. This is extremely slow compared to a local build. The CLI
may appear stuck at *"Starting the site..."* — wait at least 10 minutes before considering it stuck.

**Issue 2: Startup command gets reset**

`az webapp up` can overwrite the App Service startup command. The app entrypoint is `server.js`
(not `index.js`, not `npm start`). If the startup command is wrong, the container will crash-loop.

After every deploy, verify and fix:

```bash
# Check current startup command
az webapp config show \
  --name app-medrequest-demo \
  --resource-group rg-medrequest-demo \
  --query appCommandLine -o tsv

# If it is NOT "node server.js", fix it:
az webapp config set \
  --name app-medrequest-demo \
  --resource-group rg-medrequest-demo \
  --startup-file "node server.js"
```

**Issue 3: App stuck / crash-looping after deploy**

If `az webapp up` hangs at *"Starting the site..."* for more than 5 minutes, or the app returns
502/504 after deploy, the container is likely crash-looping.

**Recovery:**

```bash
az webapp stop  --name app-medrequest-demo --resource-group rg-medrequest-demo
az webapp start --name app-medrequest-demo --resource-group rg-medrequest-demo
```

If it's still broken after restart, check logs (see Troubleshooting below), then verify:
1. Startup command is `node server.js`
2. Key Vault references are resolving (check app settings in Azure Portal)
3. SQL firewall allows the App Service subnet

### 4c. Restart After Deploy

It's good practice to restart after the first deploy to ensure clean state:

```bash
az webapp restart \
  --name app-medrequest-demo \
  --resource-group rg-medrequest-demo
```

### 4d. Deploy Azure Functions (Optional)

The Functions app is scaffolded but not required for the core demo flow.

```bash
cd src/functions
npm ci --production
func azure functionapp publish func-medrequest-demo
cd ../..
```

---

## Phase 5 — Verification Checklist

> ℹ️ **If you used `azd up`, the `postdeploy` hook automatically runs a health check and prints
> the app URL.** The checks below are useful for manual verification or troubleshooting.

Run these checks **in order** after deploying. Every check must pass before the deployment is
considered successful.

### 5a. Health Check

```bash
curl -s https://app-medrequest-demo.azurewebsites.net/api/health | jq .
# Expected: {"status":"ok"}
```

### 5b. Config Endpoint (Verify APIM Integration)

```bash
curl -s https://app-medrequest-demo.azurewebsites.net/api/config | jq .
# Expected: JSON with apimEnabled: true (Key Vault refs resolved)
```

If `apimEnabled` is `false` or the Key Vault values show as `KeyVaultReferenceNotResolved`, see
Troubleshooting.

### 5c. Direct API — Requests Endpoint

```bash
# Patient at Mercy General
curl -s https://app-medrequest-demo.azurewebsites.net/api/requests \
  -H "X-Tenant-Id: A0000000-0000-0000-0000-000000000001" \
  -H "X-User-Id: 10000000-0000-0000-0000-000000000001" \
  -H "X-User-Role: patient" | jq .

# Concierge at St. Claire
curl -s https://app-medrequest-demo.azurewebsites.net/api/requests \
  -H "X-Tenant-Id: B0000000-0000-0000-0000-000000000002" \
  -H "X-User-Id: 20000000-0000-0000-0000-000000000002" \
  -H "X-User-Role: concierge" | jq .

# Case Manager at Harbor Medical
curl -s https://app-medrequest-demo.azurewebsites.net/api/requests \
  -H "X-Tenant-Id: C0000000-0000-0000-0000-000000000003" \
  -H "X-User-Id: 30000000-0000-0000-0000-000000000003" \
  -H "X-User-Role: case_manager" | jq .
```

Each persona should return **only their own tenant's data** (RLS isolation).

### 5d. APIM Proxy Health

```bash
curl -s https://app-medrequest-demo.azurewebsites.net/api/proxy/health | jq .
# Expected: proxied health response from APIM
```

### 5e. Behind-the-Scenes Debug Endpoint

```bash
curl -s -X POST https://app-medrequest-demo.azurewebsites.net/api/proxy/debug/explore \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

### 5f. Frontend

Open in a browser: `https://app-medrequest-demo.azurewebsites.net`

You should see the persona picker with 9 demo personas (3 hospitals × 3 roles).

---

## Troubleshooting

### App Returns 502/504 or `curl` Times Out

The App Service container is likely crash-looping or stuck.

```bash
# Stop and start (not just restart — this forces a fresh container)
az webapp stop  --name app-medrequest-demo --resource-group rg-medrequest-demo
az webapp start --name app-medrequest-demo --resource-group rg-medrequest-demo
```

Then check logs to find the root cause.

### How to Check App Service Logs

```bash
# Enable Docker container logging (required once)
az webapp log config \
  --name app-medrequest-demo \
  --resource-group rg-medrequest-demo \
  --docker-container-logging filesystem

# Download logs
az webapp log download \
  --name app-medrequest-demo \
  --resource-group rg-medrequest-demo \
  --log-file webapp-logs.zip

# Or stream live
az webapp log tail \
  --name app-medrequest-demo \
  --resource-group rg-medrequest-demo
```

### APIM Proxy Returns 503

The APIM subscription key is likely not in Key Vault, or the Key Vault reference isn't resolving.

1. Verify the Key Vault secret exists: `az keyvault secret show --vault-name kv-medrequest-demo --name APIM-SUBSCRIPTION-KEY`
2. If missing, go back to Phase 3a.
3. If the secret exists, check the app setting resolution in Azure Portal → App Service → Configuration → look for a green checkmark on `APIM_SUBSCRIPTION_KEY`.

### Key Vault References Show "KeyVaultReferenceNotResolved"

The managed identity doesn't have the right role on Key Vault.

```bash
# Verify the managed identity has Key Vault Secrets User role
az role assignment list \
  --assignee $(az identity show --resource-group rg-medrequest-demo --name id-medrequest-demo --query principalId -o tsv) \
  --scope /subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-medrequest-demo/providers/Microsoft.KeyVault/vaults/kv-medrequest-demo \
  -o table
```

If empty, the Bicep deployment may have failed to assign the role. Re-run the Bicep deployment or
manually assign:

```bash
MI_PRINCIPAL=$(az identity show --resource-group rg-medrequest-demo --name id-medrequest-demo --query principalId -o tsv)

az role assignment create \
  --assignee $MI_PRINCIPAL \
  --role "Key Vault Secrets User" \
  --scope /subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-medrequest-demo/providers/Microsoft.KeyVault/vaults/kv-medrequest-demo
```

After fixing, restart the app: `az webapp restart --name app-medrequest-demo --resource-group rg-medrequest-demo`

### Multiple Overlapping Deploys

**Never** start a second `az webapp up` while the first is still running. Overlapping deploys
corrupt the deployment and cause unpredictable behavior.

If you accidentally did this:

```bash
# Stop the app
az webapp stop --name app-medrequest-demo --resource-group rg-medrequest-demo

# Wait 30 seconds, then start
az webapp start --name app-medrequest-demo --resource-group rg-medrequest-demo

# If still broken, redeploy from scratch (Phase 4)
```

### Soft-Delete Conflicts on Re-Deployment

If Bicep fails with a naming conflict for APIM or Key Vault, a previous deployment's soft-deleted
resource is blocking creation. Purge it:

```bash
# APIM
az apim deletedservice purge --service-name apim-medrequest-demo --location centralus

# Key Vault
az keyvault purge --name kv-medrequest-demo
```

Then re-run the Bicep deployment (Phase 2).

### SQL Server AAD Admin Not Set

**Symptom:** Node.js migration scripts or SQL operations fail with "Login failed for user".

```bash
YOUR_AAD_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)

az sql server ad-admin create \
  --resource-group rg-medrequest-demo \
  --server sql-medrequest-demo \
  --display-name "SQL Admin" \
  --object-id $YOUR_AAD_OBJECT_ID
```

### Database Connection Errors (`/api/ready` fails)

Managed identity may not have SQL access. Re-run Phase 3d, or re-run `azd up` which will
re-execute the postprovision hook.

### VNet Integration Issues (App Can't Reach SQL)

```bash
az webapp vnet-integration list \
  --resource-group rg-medrequest-demo \
  --name app-medrequest-demo

# If empty, manually integrate
az webapp vnet-integration add \
  --resource-group rg-medrequest-demo \
  --name app-medrequest-demo \
  --vnet vnet-medrequest-demo \
  --subnet appsvc-subnet
```

---

## Environment Variables / App Settings

These are configured automatically by Bicep. Do not set them manually unless troubleshooting.

| Variable | Value | Source |
|----------|-------|--------|
| `DB_SERVER` | `sql-medrequest-demo.database.windows.net` | Bicep (SQL module) |
| `DB_NAME` | `medrequest-dev` | Bicep |
| `DB_USE_MANAGED_IDENTITY` | `true` | Enables AAD auth for SQL |
| `AZURE_CLIENT_ID` | *(managed identity client ID)* | Bicep (identity module) |
| `KEY_VAULT_URI` | `https://kv-medrequest-demo.vault.azure.net/` | Bicep (Key Vault module) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | *(connection string)* | Bicep (monitoring module) |
| `NODE_ENV` | `production` | Bicep |
| `PORT` | `8080` | Bicep |
| `APIM_GATEWAY_URL` | `@Microsoft.KeyVault(...)` | Key Vault reference |
| `APIM_SUBSCRIPTION_KEY` | `@Microsoft.KeyVault(...)` | Key Vault reference |

### Connection String (Reference)

The API uses managed identity — no password in the connection string:

```
Server=sql-medrequest-demo.database.windows.net;
Database=medrequest-dev;
Authentication=Active Directory Default;
Encrypt=true;
```

---

## Cleanup

⚠️ **WARNING:** This deletes ALL resources and cannot be undone.

### Using azd (Recommended)

```bash
azd down              # Destroys all resources in the current environment
azd down --purge      # Also purges soft-deleted APIM and Key Vault resources
```

### Using Azure CLI (Manual)

```bash
az group delete --name rg-medrequest-demo --yes --no-wait
az group exists --name rg-medrequest-demo
# Returns "false" after a few minutes
```

### Selective Cleanup (Cost Reduction)

```bash
# Stop App Service (keep resource, stop billing compute)
az webapp stop --name app-medrequest-demo --resource-group rg-medrequest-demo

# Delete App Gateway (biggest cost: ~$146/mo)
az network application-gateway delete --resource-group rg-medrequest-demo --name appgw-medrequest-demo
```

### Cost Breakdown

| Resource | SKU | ~USD/month |
|----------|-----|-----------|
| App Gateway Standard_v2 | 0-2 instances | ~$146 |
| App Service | B1 | ~$13 |
| Azure SQL | Basic (5 DTU) | ~$5 |
| APIM | Basic v2 | ~$150 |
| Functions | Consumption | ~$0-2 |
| Storage | Standard LRS | ~$1-2 |
| Log Analytics | Pay-as-you-go | ~$2-5 |
| Key Vault | Standard | ~$0 |
| **Total** | | **~$320-330** |

---

## Known Limitations (POC)

1. **Header-based auth is demo-only** — no token validation, easily spoofed. Production: OAuth/MSAL + JWT.
2. **APIM Basic v2** — dedicated compute (~$150/month), no cold starts or provisioning race conditions. Includes SLA.
3. **App Gateway provisioning** — 5-15 minutes, ~$146/mo. Required for WAF.
4. **No CI/CD secrets pre-configured** — see Appendix for GitHub Actions OIDC setup.
5. **No custom domain** — uses `*.azurewebsites.net`. SSL provided by Azure.
6. **B1 App Service** — no deployment slots, limited autoscale.
7. **RLS set per-query** — `SESSION_CONTEXT` reset per query (not per connection) for pool safety. ~1ms overhead.
8. **Startup command sensitivity** — must be `node server.js`. The `postdeploy` hook sets this automatically when using `azd`.
9. **Database migrations at startup** — the Node.js migration runner (`src/api/db/migrate.js`) runs on every app start. This is fast for our small schema but adds a few seconds to cold starts.

---

## Appendix: CI/CD Setup (GitHub Actions)

```bash
# 1. Create AAD App Registration for OIDC
az ad app create --display-name "MedRequest GitHub Actions" --query appId -o tsv
APP_ID=$(az ad app list --display-name "MedRequest GitHub Actions" --query '[0].appId' -o tsv)
az ad sp create --id $APP_ID

# 2. Assign Contributor role
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
az role assignment create \
  --assignee $APP_ID \
  --role Contributor \
  --scope /subscriptions/$SUBSCRIPTION_ID

# 3. Configure federated credentials
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "medrequest-github-actions",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:YOUR_GITHUB_ORG/patient-comm-app:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# 4. Set GitHub secrets
gh secret set AZURE_CLIENT_ID --body "$APP_ID"
gh secret set AZURE_TENANT_ID --body "$(az account show --query tenantId -o tsv)"
gh secret set AZURE_SUBSCRIPTION_ID --body "$SUBSCRIPTION_ID"
gh secret set SQL_AAD_ADMIN_OBJECT_ID --body "$(az ad signed-in-user show --query id -o tsv)"
```

---

**Last Updated:** 2026-05-14
**Maintained By:** Rusty (Architecture), Livingston (Infra/DevOps)
**Related Docs:** `README.md`, `DEPLOYMENT-SIMPLIFICATION.md`, `MULTI-TENANT-ARCHITECTURE.md`, `infra/main.bicep`, `azure.yaml`
