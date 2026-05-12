# MedRequest — Testing & Deployment Guide

## Overview

This document provides comprehensive instructions for deploying the MedRequest POC to Azure for testing and demonstration purposes. It includes step-by-step deployment commands, verification procedures, and troubleshooting guidance.

**Target audience:** Development team, QA engineers, stakeholders performing demo deployments

**Scope:** Manual deployment to a test/demo Azure environment

---

## Target Environment

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Resource Group** | `rg-medrequest-demo` | Demo environment resource group |
| **Region** | `centralus` (Central US) | Primary Azure region |
| **Subscription** | `<YOUR_SUBSCRIPTION_ID>` | ⚠️ **Replace with actual subscription ID** |
| **Environment Name** | `demo` | Used for resource naming |
| **Naming Pattern** | `{resource}-medrequest-demo` | e.g., `app-medrequest-demo` |

---

## Prerequisites Checklist

Before deploying, ensure you have the following tools and permissions:

### Required Tools

- [ ] **Azure CLI** (version 2.50+)
  ```bash
  az version
  az login
  ```

- [ ] **Bicep CLI** (bundled with Azure CLI)
  ```bash
  az bicep version
  # Should be 0.20.0 or higher
  ```

- [ ] **Node.js** (version 18+ LTS)
  ```bash
  node --version
  npm --version
  ```

- [ ] **SQL Server command-line tools** (sqlcmd)
  ```bash
  # Install via: https://learn.microsoft.com/sql/tools/sqlcmd-utility
  sqlcmd -?
  ```

- [ ] **GitHub CLI** (optional, for CI/CD secrets setup)
  ```bash
  gh --version
  gh auth login
  ```

### Required Azure Permissions

- [ ] **Contributor** role on the target subscription (to create/manage resources)
- [ ] **User Access Administrator** or **Owner** (to assign RBAC roles to managed identity)
- [ ] Ability to create **Microsoft Entra ID** (Azure AD) service principals (for CI/CD OIDC)

### Required Configuration Values

Before deploying, gather these values:

- [ ] **Azure Subscription ID**: `az account show --query id -o tsv`
- [ ] **Azure Tenant ID**: `az account show --query tenantId -o tsv`
- [ ] **Your User Object ID** (for SQL AAD admin): `az ad signed-in-user show --query id -o tsv`
- [ ] **APIM Publisher Email**: Your email address for API Management notifications

---

## Deployment Steps

### Step 1: Authenticate to Azure

```bash
# Login to Azure (opens browser for authentication)
az login

# Set the correct subscription (if you have multiple)
az account set --subscription <YOUR_SUBSCRIPTION_ID>

# Verify you're in the right subscription
az account show --query '{name:name, id:id}' -o table
```

### Step 2: Create Resource Group

```bash
az group create \
  --name rg-medrequest-demo \
  --location centralus \
  --tags project=medrequest environment=demo managedBy=bicep
```

### Step 3: Deploy Infrastructure (Bicep)

This step provisions all Azure resources: App Service, Azure SQL, Key Vault, App Gateway, APIM, Functions, Storage, VNet, Monitoring.

**⚠️ Important:** Replace `<YOUR_EMAIL>` and `<YOUR_AAD_OBJECT_ID>` with actual values.

```bash
# Get your Azure AD object ID for SQL admin
YOUR_AAD_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)

# Deploy infrastructure
az deployment group create \
  --resource-group rg-medrequest-demo \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  --parameters environment=demo \
  --parameters location=centralus \
  --parameters apimPublisherEmail=<YOUR_EMAIL> \
  --parameters sqlAadAdminObjectId=$YOUR_AAD_OBJECT_ID \
  --parameters appServicePlanSku=B1 \
  --parameters wafMode=Detection \
  --query 'properties.outputs' -o json
```

**Expected duration:** 8-12 minutes (App Gateway takes the longest)

**Capture outputs:** Save the output JSON — it contains the deployed resource names and endpoints.

```bash
# Extract key outputs for later use
DEPLOYMENT_OUTPUT=$(az deployment group show \
  --resource-group rg-medrequest-demo \
  --name main \
  --query 'properties.outputs' -o json)

WEB_APP_HOSTNAME=$(echo $DEPLOYMENT_OUTPUT | jq -r '.webAppHostname.value')
FUNCTION_APP_HOSTNAME=$(echo $DEPLOYMENT_OUTPUT | jq -r '.functionAppHostname.value')
SQL_SERVER_FQDN=$(echo $DEPLOYMENT_OUTPUT | jq -r '.sqlServerFqdn.value')
KEY_VAULT_URI=$(echo $DEPLOYMENT_OUTPUT | jq -r '.keyVaultUri.value')
APIM_GATEWAY_URL=$(echo $DEPLOYMENT_OUTPUT | jq -r '.apimGatewayUrl.value')

echo "Web App: $WEB_APP_HOSTNAME"
echo "SQL Server: $SQL_SERVER_FQDN"
echo "Key Vault: $KEY_VAULT_URI"
```

### Step 4: Run Database Migrations

Apply the initial schema to the Azure SQL database using AAD authentication.

**⚠️ Note:** Ensure you have SQL admin rights (granted via `sqlAadAdminObjectId` parameter).

```bash
# Install Azure AD authentication for sqlcmd (if not already installed)
# See: https://learn.microsoft.com/sql/connect/odbc/linux-mac/installing-the-microsoft-odbc-driver-for-sql-server

# Get an Azure AD access token for SQL
ACCESS_TOKEN=$(az account get-access-token --resource https://database.windows.net/ --query accessToken -o tsv)

# Run schema migration
sqlcmd -S $SQL_SERVER_FQDN \
  -d medrequest-dev \
  -G \
  -P "$ACCESS_TOKEN" \
  -i db/migrations/001-initial-schema.sql

# Verify schema was created
sqlcmd -S $SQL_SERVER_FQDN \
  -d medrequest-dev \
  -G \
  -P "$ACCESS_TOKEN" \
  -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'"
```

**Expected output:** Should list `tenants`, `users`, `requests` tables.

### Step 5: Seed Demo Data

Load sample hospital tenants, users, and requests for testing.

```bash
# Seed demo data
sqlcmd -S $SQL_SERVER_FQDN \
  -d medrequest-dev \
  -G \
  -P "$ACCESS_TOKEN" \
  -i db/seed/demo-data.sql

# Verify data was seeded
sqlcmd -S $SQL_SERVER_FQDN \
  -d medrequest-dev \
  -G \
  -P "$ACCESS_TOKEN" \
  -Q "SELECT name FROM tenants"
```

**Expected output:** Should list 3 tenants:
- Mercy General Hospital
- St. Claire Medical Center
- Harbor Medical Center

### Step 6: Deploy API to App Service

Build and deploy the Node.js Express API.

```bash
# Navigate to API directory
cd src/api

# Install production dependencies
npm ci --production

# Deploy to App Service
az webapp deploy \
  --resource-group rg-medrequest-demo \
  --name app-medrequest-demo \
  --src-path . \
  --type zip \
  --async false

# Alternative: use az webapp up (creates zip and deploys)
az webapp up \
  --resource-group rg-medrequest-demo \
  --name app-medrequest-demo \
  --runtime "NODE:20-lts" \
  --os-type Linux

cd ../..
```

**Expected duration:** 2-3 minutes

### Step 7: Deploy Frontend (Static Files)

The frontend is served from the same App Service as the API (static content at `/`).

```bash
# Copy frontend files to App Service wwwroot
az webapp deploy \
  --resource-group rg-medrequest-demo \
  --name app-medrequest-demo \
  --src-path src/frontend \
  --type static \
  --target-path /home/site/wwwroot/public

# Or use FTP/FTPS to upload frontend files to /home/site/wwwroot/public
# (App Service configuration in Bicep maps / to /public)
```

**Note:** The App Service Bicep module configures the default static content path to serve the frontend from `/public`.

### Step 8: Deploy Azure Functions

Deploy the outbound integration Functions (currently scaffolded, no active code yet).

```bash
# Navigate to Functions directory
cd src/functions

# Install production dependencies
npm ci --production

# Deploy to Function App
func azure functionapp publish func-medrequest-demo

# Alternative: use Azure CLI
az functionapp deployment source config-zip \
  --resource-group rg-medrequest-demo \
  --name func-medrequest-demo \
  --src functions.zip

cd ../..
```

**Expected duration:** 1-2 minutes

### Step 9: Verify Deployment

Run health checks and smoke tests to confirm everything is working.

#### 9.1 Check App Service Health

```bash
# Health check (liveness)
curl https://$WEB_APP_HOSTNAME/api/health

# Expected output: {"status":"ok"}
```

#### 9.2 Check Database Connectivity

```bash
# Readiness check (tests DB connection)
curl https://$WEB_APP_HOSTNAME/api/ready

# Expected output: {"status":"ok","database":"connected"}
```

#### 9.3 Test API with Demo Personas

Test the API using header-based authentication for each demo persona.

**Persona 1: Alice Johnson (Patient at Mercy General)**

```bash
curl -X GET https://$WEB_APP_HOSTNAME/api/requests \
  -H "X-Tenant-Id: A0000000-0000-0000-0000-000000000001" \
  -H "X-User-Id: 10000000-0000-0000-0000-000000000001" \
  -H "X-User-Role: patient"

# Expected: Returns requests for Alice (tenant A, user 10000...)
```

**Persona 2: Frank Lee (Concierge at St. Claire)**

```bash
curl -X GET https://$WEB_APP_HOSTNAME/api/requests \
  -H "X-Tenant-Id: B0000000-0000-0000-0000-000000000002" \
  -H "X-User-Id: 20000000-0000-0000-0000-000000000002" \
  -H "X-User-Role: concierge"

# Expected: Returns requests for tenant B (different tenant from Alice)
```

**Persona 3: Jack O'Brien (Case Manager at Harbor Medical)**

```bash
curl -X GET https://$WEB_APP_HOSTNAME/api/requests \
  -H "X-Tenant-Id: C0000000-0000-0000-0000-000000000003" \
  -H "X-User-Id: 30000000-0000-0000-0000-000000000003" \
  -H "X-User-Role: case_manager"

# Expected: Returns requests for tenant C
```

#### 9.4 Verify RLS Isolation

Confirm that Tenant A cannot see Tenant B's data.

```bash
# Request as Tenant A (Mercy General)
curl -X GET https://$WEB_APP_HOSTNAME/api/requests \
  -H "X-Tenant-Id: A0000000-0000-0000-0000-000000000001" \
  -H "X-User-Id: 10000000-0000-0000-0000-000000000001" \
  -H "X-User-Role: patient" \
  | jq '.[] | .tenant_id' | sort | uniq

# Expected: Only shows tenant A's GUID (A0000000-0000-0000-0000-000000000001)
# Should NOT see tenant B or C data
```

#### 9.5 Test Frontend

```bash
# Open frontend in browser
open https://$WEB_APP_HOSTNAME

# Or use curl to verify HTML is served
curl https://$WEB_APP_HOSTNAME

# Expected: Returns index.html with demo persona picker
```

#### 9.6 Check APIM Gateway (Optional)

```bash
# Test APIM gateway endpoint (if configured with API definitions)
curl https://$APIM_GATEWAY_URL/api/health

# Note: APIM is scaffolded but may not have API definitions yet
```

---

## Post-Deployment Verification

### Application Insights Telemetry

Verify that telemetry is flowing to Application Insights.

```bash
# Get App Insights name
APP_INSIGHTS_NAME=$(az monitor app-insights component list \
  --resource-group rg-medrequest-demo \
  --query '[0].name' -o tsv)

# Query recent requests
az monitor app-insights query \
  --app $APP_INSIGHTS_NAME \
  --analytics-query "requests | where timestamp > ago(10m) | project timestamp, name, resultCode, duration | order by timestamp desc" \
  --offset 10m

# Expected: Shows recent HTTP requests to the API
```

### Log Analytics Workspace

Check logs from all resources.

```bash
# Get Log Analytics workspace name
LAW_NAME=$(az monitor log-analytics workspace list \
  --resource-group rg-medrequest-demo \
  --query '[0].name' -o tsv)

# Query App Service logs
az monitor log-analytics query \
  --workspace $LAW_NAME \
  --analytics-query "AppServiceConsoleLogs | where TimeGenerated > ago(10m) | project TimeGenerated, ResultDescription" \
  --timespan P1D
```

### SQL Server Connectivity Test

Verify managed identity authentication is working.

```bash
# Check if managed identity can access SQL
az sql db show \
  --resource-group rg-medrequest-demo \
  --server sql-medrequest-demo \
  --name medrequest-dev \
  --query '{name:name, status:status, collation:collation}' -o table
```

---

## Environment Variables / App Settings

The following environment variables are configured automatically by Bicep via App Service application settings:

| Variable | Value | Source |
|----------|-------|--------|
| `DB_SERVER` | `sql-medrequest-demo.database.windows.net` | Bicep output from SQL module |
| `DB_NAME` | `medrequest-dev` | Hardcoded in Bicep |
| `DB_USE_MANAGED_IDENTITY` | `true` | Enables AAD auth for SQL |
| `AZURE_CLIENT_ID` | (managed identity client ID) | Bicep output from identity module |
| `KEY_VAULT_URI` | `https://kv-medrequest-demo.vault.azure.net/` | Bicep output from Key Vault module |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | (App Insights connection string) | Bicep output from monitoring module |
| `NODE_ENV` | `production` | Hardcoded in Bicep |

### Manual Configuration (If Needed)

If you need to add secrets (e.g., third-party API keys):

```bash
# Add secret to Key Vault
az keyvault secret set \
  --vault-name kv-medrequest-demo \
  --name "ThirdPartyApiKey" \
  --value "your-secret-value"

# Reference secret in App Service using Key Vault reference syntax
az webapp config appsettings set \
  --resource-group rg-medrequest-demo \
  --name app-medrequest-demo \
  --settings THIRD_PARTY_API_KEY="@Microsoft.KeyVault(VaultName=kv-medrequest-demo;SecretName=ThirdPartyApiKey)"
```

### Connection String Format (For Reference)

The API uses managed identity authentication, so no password is needed:

```
Server=sql-medrequest-demo.database.windows.net;
Database=medrequest-dev;
Authentication=Active Directory Default;
Encrypt=true;
```

**Note:** The `@azure/identity` library (`DefaultAzureCredential`) handles token retrieval automatically.

---

## Troubleshooting

### Common Deployment Failures

#### 1. Bicep Deployment Timeout

**Symptom:** `az deployment group create` times out or hangs.

**Cause:** App Gateway provisioning takes 5-10 minutes.

**Fix:** Increase timeout or run in async mode:

```bash
az deployment group create \
  --resource-group rg-medrequest-demo \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  --no-wait

# Check deployment status
az deployment group show \
  --resource-group rg-medrequest-demo \
  --name main \
  --query 'properties.provisioningState' -o tsv
```

#### 2. SQL Server AAD Admin Not Set

**Symptom:** `sqlcmd` fails with "Login failed for user" or "Cannot open server".

**Cause:** SQL Server AAD admin was not configured during deployment.

**Fix:** Manually set AAD admin:

```bash
YOUR_AAD_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)

az sql server ad-admin create \
  --resource-group rg-medrequest-demo \
  --server sql-medrequest-demo \
  --display-name "SQL Admin" \
  --object-id $YOUR_AAD_OBJECT_ID
```

#### 3. App Service Health Check Failing

**Symptom:** `/api/health` returns 503 or times out.

**Cause:** App Service may not have finished starting, or managed identity permissions are missing.

**Fix:** Check App Service logs:

```bash
az webapp log tail \
  --resource-group rg-medrequest-demo \
  --name app-medrequest-demo

# Or download logs
az webapp log download \
  --resource-group rg-medrequest-demo \
  --name app-medrequest-demo \
  --log-file app-logs.zip
```

#### 4. Database Connection Errors

**Symptom:** `/api/ready` returns `{"status":"error","database":"disconnected"}`.

**Cause:** Managed identity may not have access to SQL, or private endpoint DNS is not resolving.

**Fix:** Grant managed identity permissions to SQL:

```bash
# Get managed identity object ID
MI_OBJECT_ID=$(az identity show \
  --resource-group rg-medrequest-demo \
  --name id-medrequest-demo \
  --query principalId -o tsv)

# Grant SQL db_datareader, db_datawriter roles via SQL
sqlcmd -S $SQL_SERVER_FQDN \
  -d medrequest-dev \
  -G \
  -P "$ACCESS_TOKEN" \
  -Q "CREATE USER [id-medrequest-demo] FROM EXTERNAL PROVIDER; ALTER ROLE db_datareader ADD MEMBER [id-medrequest-demo]; ALTER ROLE db_datawriter ADD MEMBER [id-medrequest-demo];"
```

#### 5. VNet Integration Issues

**Symptom:** App Service cannot reach SQL private endpoint.

**Cause:** VNet integration may not be properly configured, or private DNS zone is missing.

**Fix:** Verify VNet integration:

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

### How to Check App Service Logs

```bash
# Stream logs in real-time
az webapp log tail \
  --resource-group rg-medrequest-demo \
  --name app-medrequest-demo \
  --provider application

# Enable Application Logging (if not already enabled)
az webapp log config \
  --resource-group rg-medrequest-demo \
  --name app-medrequest-demo \
  --application-logging filesystem \
  --level verbose
```

### How to Verify VNet Connectivity

```bash
# Use Kudu console to test connectivity from App Service
az webapp ssh \
  --resource-group rg-medrequest-demo \
  --name app-medrequest-demo

# Inside the SSH session, test SQL connectivity
curl -v telnet://$SQL_SERVER_FQDN:1433

# Test DNS resolution
nslookup $SQL_SERVER_FQDN
```

### How to Test APIM Endpoints

```bash
# List APIM APIs (if configured)
az apim api list \
  --resource-group rg-medrequest-demo \
  --service-name apim-medrequest-demo \
  --query '[].{name:name, path:path}' -o table

# Test APIM gateway with subscription key (if required)
APIM_SUBSCRIPTION_KEY=$(az apim subscription list \
  --resource-group rg-medrequest-demo \
  --service-name apim-medrequest-demo \
  --query '[0].primaryKey' -o tsv)

curl -H "Ocp-Apim-Subscription-Key: $APIM_SUBSCRIPTION_KEY" \
  https://$APIM_GATEWAY_URL/api/health
```

---

## Cleanup

⚠️ **WARNING:** This will delete ALL resources in the demo environment and cannot be undone.

### Full Environment Teardown

```bash
# Delete the entire resource group (includes all resources)
az group delete \
  --name rg-medrequest-demo \
  --yes \
  --no-wait

# Check deletion status
az group exists --name rg-medrequest-demo
# Should return: false (after a few minutes)
```

**Expected duration:** 3-5 minutes

### Selective Resource Cleanup

If you only want to delete specific resources:

```bash
# Stop App Service (to reduce costs, keep resource for later)
az webapp stop \
  --resource-group rg-medrequest-demo \
  --name app-medrequest-demo

# Delete App Gateway (largest cost component ~$146/mo)
az network application-gateway delete \
  --resource-group rg-medrequest-demo \
  --name appgw-medrequest-demo
```

### Cost Considerations

Leaving the demo environment running will incur these approximate monthly costs:

| Resource | SKU/Tier | Estimated Cost (USD/month) |
|----------|----------|----------------------------|
| App Gateway Standard_v2 | 2 instances autoscale | ~$146 |
| App Service | B1 (Basic) | ~$13 |
| Azure SQL | Basic (5 DTU) | ~$5 |
| APIM | Consumption (pay-per-call) | ~$1-5 (low traffic) |
| Functions | Consumption | ~$0-2 (low invocations) |
| Storage | Standard LRS | ~$1-2 |
| Log Analytics | Pay-as-you-go | ~$2-5 |
| Key Vault | Standard | ~$0.03 per 10k operations |
| **Total** | | **~$170-180/month** |

**Recommendation:** Delete the resource group when testing is complete to avoid charges.

---

## Known Limitations (POC)

This is a proof-of-concept deployment with the following limitations:

1. **Header-based authentication is demo-only**
   - Not secure for production
   - No token validation
   - Easily spoofed
   - **Production requirement:** Replace with OAuth/MSAL + JWT validation

2. **No automated DB migrations in CI/CD**
   - Migrations must be run manually via `sqlcmd`
   - No migration version tracking
   - **Future enhancement:** Add migration tooling (e.g., `node-pg-migrate`, Flyway)

3. **APIM Consumption tier cold start**
   - First request after idle period may take 10-20 seconds
   - No VNet integration capability
   - **If latency is critical:** Upgrade to Developer or Premium tier

4. **App Gateway provisioning time**
   - Takes 5-10 minutes to create
   - Cannot be skipped (WAF requirement)
   - **Cost tradeoff:** ~$146/mo for WAF protection

5. **No CI/CD secrets configured**
   - GitHub Actions workflow requires manual secret setup
   - See `.github/workflows/deploy.yml` for required secrets:
     - `AZURE_CLIENT_ID`
     - `AZURE_TENANT_ID`
     - `AZURE_SUBSCRIPTION_ID`
     - `SQL_AAD_ADMIN_OBJECT_ID`

6. **No HTTPS custom domain**
   - Using default `*.azurewebsites.net` domain
   - SSL/TLS is provided by Azure
   - **For custom domain:** Add to App Service and App Gateway

7. **Basic tier App Service**
   - No deployment slots (cannot do blue/green deploys)
   - Limited autoscale capability
   - **For production:** Upgrade to Standard tier

8. **Row-Level Security (RLS) set per-query**
   - `SESSION_CONTEXT` is reset per query, not per connection
   - Ensures tenant isolation in connection pooling scenarios
   - **Performance note:** Adds ~1ms overhead per query

---

## Appendix: CI/CD Setup

To enable automated deployments via GitHub Actions, configure the following secrets in your GitHub repository:

```bash
# 1. Create Azure AD App Registration for OIDC
az ad app create --display-name "MedRequest GitHub Actions" \
  --query appId -o tsv

# 2. Create Service Principal
APP_ID=$(az ad app list --display-name "MedRequest GitHub Actions" --query '[0].appId' -o tsv)
az ad sp create --id $APP_ID

# 3. Assign Contributor role
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
az role assignment create \
  --assignee $APP_ID \
  --role Contributor \
  --scope /subscriptions/$SUBSCRIPTION_ID

# 4. Configure federated credentials for GitHub Actions
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "medrequest-github-actions",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:YOUR_GITHUB_ORG/patient-comm-app:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# 5. Set GitHub repository secrets
gh secret set AZURE_CLIENT_ID --body "$APP_ID"
gh secret set AZURE_TENANT_ID --body "$(az account show --query tenantId -o tsv)"
gh secret set AZURE_SUBSCRIPTION_ID --body "$SUBSCRIPTION_ID"
gh secret set SQL_AAD_ADMIN_OBJECT_ID --body "$(az ad signed-in-user show --query id -o tsv)"
```

Once configured, every push to `main` will trigger automatic deployment via `.github/workflows/deploy.yml`.

---

## Quick Reference: Sample Deployment Command

**Complete deployment in one command:**

```bash
# Replace placeholders and run
az deployment group create \
  --resource-group rg-medrequest-demo \
  --template-file infra/main.bicep \
  --parameters environment=demo \
  --parameters location=centralus \
  --parameters projectName=medrequest \
  --parameters apimPublisherEmail=your-email@example.com \
  --parameters sqlAadAdminObjectId=$(az ad signed-in-user show --query id -o tsv) \
  --parameters appServicePlanSku=B1 \
  --parameters wafMode=Detection
```

---

**Last Updated:** 2025-01-14  
**Maintained By:** Livingston (Infra/DevOps)  
**Related Docs:** `PROJECT-STRUCTURE.md`, `DEMO-AUTH-DESIGN.md`, `infra/main.bicep`
