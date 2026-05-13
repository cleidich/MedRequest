# Decision: Azure Developer CLI (azd) Integration

- **ID:** `azd-integration-001`
- **Author:** Livingston
- **Date:** 2026-07-25
- **Status:** Implemented
- **Scope:** Infrastructure, DevOps, Deployment

## Decision

Adopted Azure Developer CLI (`azd`) to replace 15+ manual deployment steps with a single `azd up` command. Created `azure.yaml` service definition, 3 hook scripts, and added Bicep outputs for azd env var integration.

## What Changed

1. **`azure.yaml`** (new) — azd service definition with `api` service (Node.js, App Service), infra path `./infra`, and 4 hooks
2. **`infra/scripts/preprovision.sh`** (new) — pre-flight soft-delete checks for APIM and Key Vault
3. **`infra/scripts/postprovision.sh`** (new) — SQL firewall, managed identity grant, migrations, seeding (replaces TESTING.md Phase 3)
4. **`infra/scripts/postdeploy.sh`** (new) — startup command fix + health check verification
5. **`infra/main.bicep`** (modified) — added 4 outputs: `AZURE_SQL_SERVER_NAME`, `AZURE_SQL_DATABASE_NAME`, `AZURE_MANAGED_IDENTITY_NAME`, `AZURE_APP_SERVICE_NAME`

## Context

- Deployment previously required ~15 manual CLI steps across 5 phases (30-50 min, error-prone)
- Proposal documented in `docs/DEPLOYMENT-SIMPLIFICATION.md`
- azd preserves existing Bicep modules — it calls `az deployment group create` under the hood
- azd maps Bicep outputs to env vars, making them available in hook scripts

## Alternatives Considered

- **Bicep Deployment Scripts (ACI):** Painful debugging, adds ACI cost, script failures block entire deployment
- **Node.js Startup Migration:** Good complement but doesn't address firewall rules, identity grants, or deployment packaging
- **Keep manual steps:** Rejected — too error-prone and slow for repeated deploys

## Dependencies

- Basher: Creating `infra/scripts/run-migrations.js` and `infra/scripts/run-seed.js` (referenced by postprovision.sh)

## Impact

- **All team members:** Deploy with `azd up` instead of following TESTING.md manual steps
- **Basher:** Must deliver migration/seed Node.js scripts to `infra/scripts/`
- **Chris:** Install azd (`curl -fsSL https://aka.ms/install-azd.sh | bash`), then `azd init` + `azd up`
