# MedRequest — Deployment Simplification Proposal

> **Author:** Rusty (Lead/Architect) · **Date:** 2026-05-13 · **Status:** Proposal  
> **Audience:** Chris Leidich (PM/Architect)

---

## 1. Executive Summary

MedRequest's current deployment requires ~15 manual steps across 5 phases, takes 30–50 minutes,
and has multiple gotchas that cost Chris 70+ minutes debugging on first deploy. The primary pain
points are: sqlcmd dependency for database setup, fragile `az webapp up` behavior, post-deploy
ordering sensitivity, and no single-command path from clone to running app.

**Recommended approach:** Adopt **Azure Developer CLI (`azd`)** with **shell-based hooks** for
post-provision tasks (SQL setup, firewall rules, managed identity grants), plus a **Node.js
startup migration** fallback for database schema. This gives us `azd up` as a single command that
handles infra + app deploy + database hydration, while preserving our existing Bicep modules.

Estimated effort: **Medium (8–12 hours)** for Livingston, with minor Basher contributions.

---

## 2. Current State — Pain Points

Reference: [`docs/TESTING.md`](./TESTING.md) — our 450-line deployment runbook.

| # | Pain Point | Impact |
|---|-----------|--------|
| 1 | **sqlcmd for migrations/seeding** | Requires installing sqlcmd, AAD token management, knowing server FQDN, running SQL files manually in order |
| 2 | **15+ manual `az` CLI commands** post-deploy | Firewall rules, managed identity SQL grants, Key Vault access, startup command fixes |
| 3 | **`az webapp up` gotchas** | Resets startup command, Oryx remote build hangs, requires frontend→public sync |
| 4 | **Ordering sensitivity** | Phase 3a–3f must execute sequentially; out-of-order causes cascading failures |
| 5 | **No single command** | Clone → running app requires ~15 steps across 5 phases, 30–50 min wall clock |
| 6 | **Frontend sync** | `cp -r src/frontend/* src/api/public/` before every deploy — easy to forget |
| 7 | **Soft-delete landmines** | APIM and Key Vault soft-deletes cause cryptic failures on re-deploy |

**Goal:** `git clone → one command → working app` in under 20 minutes (mostly waiting on APIM).

---

## 3. Option Analysis

### Option A: Azure Developer CLI (`azd`) — ⭐ RECOMMENDED

**How it works:**  
`azd` is a developer-oriented CLI that wraps the full lifecycle: `azd init` → `azd provision`
(runs Bicep) → `azd deploy` (packages + deploys app code) → all orchestrated by `azd up`. It
supports **hooks** (preprovision, postprovision, predeploy, postdeploy) that run custom scripts
at each lifecycle phase.

**What our `azure.yaml` would look like:**

```yaml
# azure.yaml
name: medrequest
metadata:
  template: medrequest@1.0.0
services:
  api:
    project: ./src/api
    language: js
    host: appservice
hooks:
  # Sync frontend into api/public before packaging
  prepackage:
    posix:
      shell: sh
      run: cp -r src/frontend/* src/api/public/
  # Pre-flight: purge soft-deleted resources
  preprovision:
    posix:
      shell: sh
      run: ./infra/scripts/preprovision.sh
  # Post-infra: firewall, managed identity SQL grant, migrations, seed
  postprovision:
    posix:
      shell: sh
      run: ./infra/scripts/postprovision.sh
  # Fix startup command after deploy
  postdeploy:
    posix:
      shell: sh
      run: |
        az webapp config set \
          --name app-medrequest-${AZURE_ENV_NAME} \
          --resource-group rg-medrequest-${AZURE_ENV_NAME} \
          --startup-file "node server.js"
```

**What `postprovision.sh` handles (replaces Phase 3 manual steps):**

```bash
#!/usr/bin/env bash
set -euo pipefail

RG="rg-medrequest-${AZURE_ENV_NAME}"
SQL_SERVER="sql-medrequest-${AZURE_ENV_NAME}"
SQL_DB="medrequest-dev"
MI_NAME="id-medrequest-${AZURE_ENV_NAME}"

# 3c. Add deployer's IP to SQL firewall
MY_IP=$(curl -s ifconfig.me)
az sql server firewall-rule create \
  --resource-group "$RG" --server "$SQL_SERVER" \
  --name allow-deploy-ip \
  --start-ip-address "$MY_IP" --end-ip-address "$MY_IP"

# 3d. Grant managed identity SQL access
ACCESS_TOKEN=$(az account get-access-token \
  --resource https://database.windows.net/ --query accessToken -o tsv)

# Use node + mssql instead of sqlcmd (no sqlcmd dependency!)
node -e "
const sql = require('mssql');
const config = {
  server: '${SQL_SERVER}.database.windows.net',
  database: '${SQL_DB}',
  authentication: { type: 'azure-active-directory-access-token', options: { token: '${ACCESS_TOKEN}' } },
  options: { encrypt: true, trustServerCertificate: false }
};
(async () => {
  const pool = await sql.connect(config);
  await pool.request().query(\`
    IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = '${MI_NAME}')
    BEGIN
      CREATE USER [${MI_NAME}] FROM EXTERNAL PROVIDER;
      ALTER ROLE db_datareader ADD MEMBER [${MI_NAME}];
      ALTER ROLE db_datawriter ADD MEMBER [${MI_NAME}];
    END
  \`);
  pool.close();
})();
"

# 3e. Run migrations
node infra/scripts/run-migrations.js

# 3f. Seed demo data
node infra/scripts/run-seed.js

echo "✅ Post-provision complete"
```

**Pros:**
- Single `azd up` command covers the full lifecycle
- Hooks replace all manual Phase 3 steps
- `azd` injects environment variables (`AZURE_ENV_NAME`, outputs from Bicep) into hooks automatically
- Preserves our existing Bicep modules — `azd` just calls `az deployment group create` under the hood
- Built-in `azd pipeline config` generates GitHub Actions workflow
- `azd env` supports multiple named environments (dev, demo, staging)
- `azd down` tears down everything cleanly
- Incremental adoption: can wrap existing Bicep without rewriting
- Azure Samples ecosystem provides proven patterns (see Section 6)

**Cons:**
- Adds `azd` as a required tool (but it's a single `curl | bash` install)
- Learning curve for hook lifecycle (but well-documented)
- APIM Consumption provisioning is still 15–30 min (azd can't speed this up)
- `azd deploy` uses `az webapp deploy` (zip deploy) not `az webapp up` — different mechanism, but actually more reliable

**Effort:** Medium (8–12 hours)
- Livingston: Create `azure.yaml`, write hook scripts, adapt Bicep outputs for `azd` env vars
- Basher: Write Node.js migration/seed scripts (replace sqlcmd dependency)
- Testing: 2–3 full deploy cycles to validate

**Key docs:**
- [azd hooks documentation](https://learn.microsoft.com/azure/developer/azure-developer-cli/azd-extensibility)
- [azd environment variables](https://learn.microsoft.com/azure/developer/azure-developer-cli/manage-environment-variables)
- [azure.yaml schema reference](https://learn.microsoft.com/azure/developer/azure-developer-cli/azd-schema)

---

### Option B: Bicep Deployment Scripts (`Microsoft.Resources/deploymentScripts`)

**How it works:**  
Bicep supports a `deploymentScripts` resource that runs arbitrary Azure CLI or PowerShell scripts
inside an Azure Container Instance during deployment. We could embed our post-provision steps
(SQL firewall, managed identity grant, migrations, seeding) directly in the Bicep template.

```bicep
resource sqlSetup 'Microsoft.Resources/deploymentScripts@2023-08-01' = {
  name: 'sql-setup-${baseName}'
  location: location
  kind: 'AzureCLI'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${managedIdentity.id}': {} }
  }
  properties: {
    azCliVersion: '2.52.0'
    retentionInterval: 'PT1H'
    timeout: 'PT30M'
    scriptContent: loadTextContent('scripts/postprovision.sh')
    environmentVariables: [
      { name: 'SQL_SERVER', value: sqlServer.properties.fullyQualifiedDomainName }
      { name: 'SQL_DATABASE', value: sqlDatabase.name }
    ]
  }
  dependsOn: [ sqlServer, sqlDatabase, managedIdentity ]
}
```

**Pros:**
- Everything stays in Bicep — no new CLI tool needed
- Runs as part of `az deployment group create` — truly single-command
- Azure manages the container lifecycle
- Script has access to managed identity for AAD SQL auth

**Cons:**
- **Debugging is painful** — script runs in a transient ACI container; logs are hard to access
- Adds cost: ACI + storage account created per execution (small, but not free)
- **sqlcmd may not be available** in the default ACI image — must use Azure CLI image or install it
- Script failures can block the entire Bicep deployment (no partial rollback)
- Slow feedback loop — each test requires a full deployment cycle
- Not idempotent by default — re-deploying re-runs the script unless you use `runOnce` (but then changes aren't applied)
- Doesn't help with the `az webapp up` gotchas (app deploy is separate)

**Effort:** Medium (6–10 hours)

**Verdict:** Good for simple post-provision tasks, but poor DX for debugging. Best used as a
**complement** to `azd`, not a replacement.

---

### Option C: Node.js Startup Migration (App Runs Migrations On Boot)

**How it works:**  
The Node.js app checks database state on startup and runs pending migrations before accepting
traffic. Similar to Flyway/Liquibase patterns in Java.

```javascript
// src/api/db/migrate.js
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

async function runMigrations(pool) {
  // Create tracking table if not exists
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                   WHERE TABLE_NAME = '_migrations')
    CREATE TABLE _migrations (
      name NVARCHAR(255) PRIMARY KEY,
      applied_at DATETIME2 DEFAULT GETDATE()
    )
  `);

  const migrationsDir = path.join(__dirname, '../../db/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const applied = await pool.request()
      .input('name', file)
      .query('SELECT 1 FROM _migrations WHERE name = @name');

    if (applied.recordset.length === 0) {
      const script = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await pool.request().batch(script);
      await pool.request()
        .input('name', file)
        .query('INSERT INTO _migrations (name) VALUES (@name)');
      console.log(`✅ Applied migration: ${file}`);
    }
  }
}
```

**Pros:**
- **Eliminates sqlcmd entirely** — Node.js + mssql handles everything
- Migrations are idempotent (tracking table prevents re-application)
- Works in any environment (local dev, CI/CD, Azure) with no extra tools
- Pattern is well-understood (Flyway, Prisma, Knex all work this way)
- Fast developer feedback — change SQL, restart app, migration runs

**Cons:**
- App startup takes longer (but migrations are fast for our 3-table schema)
- First pod in a multi-instance deployment could race with others (solvable with advisory locks, but overkill for POC)
- Seed data shouldn't run on every startup — needs conditional logic ("only seed if tables are empty")
- App needs permission to CREATE TABLE (we already grant `db_datawriter`, may need `db_ddladmin` for DDL)

**Effort:** Low (3–5 hours)
- Basher: Write `migrate.js`, integrate into `server.js` startup

**Verdict:** Excellent complement to `azd`. Use startup migrations as the **primary database
hydration strategy**, and reserve `azd` hooks for one-time infra tasks (firewall, identity grants).

---

### Option D: Azure Functions for Migration

**How it works:**  
An HTTP-triggered Function runs migrations on demand (e.g., called from a hook or manually).

**Pros:**
- Serverless, runs only when needed
- Could be triggered by azd postprovision hook

**Cons:**
- **Over-engineered for this use case** — adds a deployment dependency (must deploy Function before calling it)
- Chicken-and-egg: Function needs DB access, but DB setup is what the Function does
- Our Functions app is scaffolded but not yet deployed for production use
- Adds deployment ordering complexity (the thing we're trying to eliminate)

**Effort:** Medium (4–6 hours)

**Verdict:** ❌ Not recommended. Startup migration (Option C) is simpler and doesn't require
deploying a separate service first.

---

### Option E: GitHub Actions Workflow

**How it works:**  
A comprehensive GitHub Actions workflow that runs all phases sequentially.

```yaml
# .github/workflows/deploy.yml
name: Deploy MedRequest
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        default: 'demo'
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - name: Deploy infrastructure
        run: az deployment group create ...
      - name: Post-provision setup
        run: ./infra/scripts/postprovision.sh
      - name: Deploy app
        run: az webapp deploy ...
```

**Pros:**
- Automated, repeatable, auditable
- OIDC auth already designed (Livingston's infra-scaffold-001 decision)
- No local tool installation beyond `git` and a browser

**Cons:**
- **Not a local experience** — developers can't run it on their machine
- Slow feedback loop for iteration (commit → push → wait for CI)
- Debugging failed deployments requires reading GH Actions logs
- Doesn't solve "clone → running app" for new developers

**Effort:** Medium (4–6 hours)

**Verdict:** Valuable as a **CI/CD pipeline** but not a replacement for local `azd up`. Build
this **after** the azd adoption — `azd pipeline config` can generate it automatically.

---

### Option F: Dev Container

**How it works:**  
A `.devcontainer/devcontainer.json` pre-installs all required tools (Azure CLI, azd, Node.js,
sqlcmd, jq) so developers start with a working environment.

```json
{
  "name": "MedRequest Dev",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:22",
  "features": {
    "ghcr.io/devcontainers/features/azure-cli:1": {},
    "ghcr.io/azure/azure-dev/azd:0": {}
  },
  "postCreateCommand": "npm ci --prefix src/api",
  "customizations": {
    "vscode": {
      "extensions": ["ms-azuretools.azure-dev"]
    }
  }
}
```

**Pros:**
- Zero local setup — open in Codespace or VS Code Dev Container, everything works
- Eliminates "works on my machine" for tool versions
- Particularly helpful for sqlcmd (which is annoying to install on macOS/Windows)

**Cons:**
- Doesn't solve the deployment steps problem (still need to run the same commands)
- Requires Docker or Codespaces
- Adds maintenance burden for image versions

**Effort:** Low (1–2 hours)

**Verdict:** Nice-to-have complement. Do this **last** — it makes the tooling story cleaner
but doesn't reduce the number of deployment steps.

---

### Option G: Makefile / Task Runner

**How it works:**  
A `Makefile` or `package.json` scripts block wraps the multi-step process.

```makefile
.PHONY: deploy
deploy: sync-frontend provision post-provision deploy-app verify

sync-frontend:
	cp -r src/frontend/* src/api/public/

provision:
	az deployment group create --template-file infra/main.bicep ...

post-provision:
	./infra/scripts/postprovision.sh

deploy-app:
	cd src/api && az webapp up ...
```

**Pros:**
- Simple, no new tools
- Documents the steps as code

**Cons:**
- `make` is not universally available (Windows)
- Reinvents what `azd` already does (lifecycle hooks, env management)
- No environment management — must pass variables manually
- Error handling is primitive compared to `azd`

**Effort:** Low (2–3 hours)

**Verdict:** ❌ Superseded by `azd`. If we're going to script the lifecycle, use the tool
designed for it.

---

## 4. Recommended Approach

### **Primary: `azd` + Node.js Startup Migrations (Options A + C)**

This combination addresses every pain point:

| Pain Point | Solution |
|-----------|----------|
| sqlcmd dependency | Node.js startup migrations — zero external tools |
| Manual `az` CLI commands | `azd` postprovision hooks automate everything |
| `az webapp up` gotchas | `azd deploy` uses zip deploy — no Oryx, no startup command resets |
| Ordering sensitivity | Hook lifecycle enforces correct order automatically |
| No single command | `azd up` = provision + deploy + hooks |
| Frontend sync | `prepackage` hook runs `cp -r` automatically |
| Soft-delete landmines | `preprovision` hook purges soft-deletes |

**The developer experience becomes:**

```bash
# One-time setup
curl -fsSL https://aka.ms/install-azd.sh | bash
azd auth login

# Clone and deploy
git clone <repo>
cd patient-comm-app
azd up
# → Prompts for environment name, subscription, location
# → Provisions all infra (Bicep)
# → Runs postprovision hook (firewall, identity, migrations, seed)
# → Deploys app code (zip deploy)
# → Runs postdeploy hook (verify health)
# Done. App is live.
```

### **Secondary additions (in order):**
1. GitHub Actions via `azd pipeline config` (CI/CD)
2. Dev Container for Codespaces (zero-setup DX)

---

## 5. Implementation Roadmap

### Phase 1: Eliminate sqlcmd — Node.js Migrations (3–5 hours)
**Owner:** Basher  
**Deliverables:**
- `src/api/db/migrate.js` — startup migration runner with tracking table
- `src/api/db/seed.js` — conditional seeder (only seeds if tables empty)
- Integration into `server.js` startup sequence (migrate → seed → listen)
- Update `db_datawriter` role to `db_ddladmin` in managed identity grant (DDL support)
- Standalone `infra/scripts/run-migrations.js` for use in hooks (uses AAD token auth)

### Phase 2: Adopt `azd` (5–8 hours)
**Owner:** Livingston  
**Deliverables:**
- `azure.yaml` — service definition + hook configuration
- `infra/scripts/preprovision.sh` — soft-delete purge checks
- `infra/scripts/postprovision.sh` — firewall, managed identity SQL grant (via Node.js, not sqlcmd)
- Update Bicep outputs to set `azd` environment variables
- Validate `azd provision` → `azd deploy` → `azd up` end-to-end
- Update `docs/TESTING.md` to reflect new single-command flow

### Phase 3: CI/CD Pipeline (2–3 hours)
**Owner:** Livingston  
**Deliverables:**
- Run `azd pipeline config` to generate GitHub Actions workflow
- Configure OIDC secrets (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`)
- Test push-to-deploy flow

### Phase 4: Dev Container (1–2 hours)
**Owner:** Livingston  
**Deliverables:**
- `.devcontainer/devcontainer.json` with azd, Azure CLI, Node.js 22
- Test in GitHub Codespaces
- Update README.md with "Open in Codespace" badge

**Total estimated effort:** 11–18 hours across the team.

---

## 6. Azure Samples References

| Repository | Stars | What We Learn |
|-----------|-------|---------------|
| [Azure-Samples/todo-nodejs-mongo](https://github.com/Azure-Samples/todo-nodejs-mongo) | 46 | **Primary reference.** Node.js + azd + App Service + hooks. Shows `azure.yaml` with `prepackage` hooks for frontend build, `postdeploy` hooks for cleanup. Closest pattern to our app. |
| [Azure-Samples/todo-nodejs-mongo-aca](https://github.com/Azure-Samples/todo-nodejs-mongo-aca) | 24 | Same app on Container Apps — shows azd flexibility across hosting targets. |
| [Azure-Samples/msdocs-app-service-sqldb-dotnetcore](https://github.com/Azure-Samples/msdocs-app-service-sqldb-dotnetcore) | — | **Key reference for SQL + azd.** Shows `prepackage` hook for EF Core migration bundles, `postprovision` hook for displaying connection strings. Proves azd can orchestrate SQL setup. |
| [Azure-Samples/dotnet-app-service-sqldb-infra](https://github.com/Azure-Samples/dotnet-app-service-sqldb-infra) | 2 | Secure App Service + SQL architecture with azd. Shows Bicep modules + azd composition pattern. |
| [Azure-Samples/functions-quickstart-dotnet-azd-sql](https://github.com/Azure-Samples/functions-quickstart-dotnet-azd-sql) | — | Functions + Azure SQL + azd. Shows SQL trigger pattern — not our use case, but validates azd + SQL integration. |
| [Azure-Samples/nodejs-app-service-cosmos-redis-infra](https://github.com/Azure-Samples/nodejs-app-service-cosmos-redis-infra) | 0 | Node.js + App Service + azd infra template. Shows Node.js-specific azd patterns. |
| [Azure-Samples/laravel-tasks](https://github.com/Azure-Samples/laravel-tasks) | — | App Service + SQL + azd. Shows `postprovision` with database setup hooks in a non-.NET context. |
| [Azure-Samples/nlp-sql-in-a-box](https://github.com/Azure-Samples/nlp-sql-in-a-box) | — | Azure SQL + azd with `postprovision` hooks. Shows database-heavy azd integration. |

### Key patterns observed across samples:

1. **`prepackage` hooks** for build steps (compile, bundle, sync files) — maps to our frontend sync
2. **`postprovision` hooks** for database setup — maps to our migration/seed needs
3. **`postdeploy` hooks** for verification — maps to our health check step
4. **Bicep outputs → azd env vars** — infrastructure values flow into hooks automatically
5. **`azd deploy` uses zip deploy** — avoids all `az webapp up` issues (no Oryx, no startup command resets)

### Key Microsoft Learn references:

- [azd hooks (extensibility)](https://learn.microsoft.com/azure/developer/azure-developer-cli/azd-extensibility)
- [azd environment variables](https://learn.microsoft.com/azure/developer/azure-developer-cli/manage-environment-variables)
- [azure.yaml schema reference](https://learn.microsoft.com/azure/developer/azure-developer-cli/azd-schema)
- [Bicep deploymentScripts](https://learn.microsoft.com/azure/azure-resource-manager/bicep/deployment-script-bicep)
- [azd pipeline config](https://learn.microsoft.com/azure/developer/azure-developer-cli/configure-devops-pipeline)

---

## 7. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| APIM provisioning still takes 15–30 min | Can't speed this up; document in azd output. Consider dropping APIM for initial deploy and adding later. |
| `azd deploy` uses zip deploy — different from `az webapp up` | Zip deploy is actually more reliable. Test early. |
| Node.js migration runner needs DDL permissions | Grant `db_ddladmin` instead of just `db_datawriter` to managed identity. |
| Hook scripts need AAD token for SQL | `az account get-access-token` works in hooks since deployer is logged in. |
| Multi-environment drift | `azd env` handles multiple environments by name — enforces isolation. |

---

## 8. Decision

**Adopt `azd` + Node.js startup migrations as the deployment strategy for MedRequest.**

This reduces deployment from ~15 manual steps to a single `azd up` command, eliminates the
sqlcmd dependency, automates post-provision setup, and provides a CI/CD path via
`azd pipeline config`. The approach preserves all existing Bicep modules and requires no
architecture changes.

Next step: Chris approves → Basher starts Phase 1 (migrations) → Livingston starts Phase 2 (azd).
