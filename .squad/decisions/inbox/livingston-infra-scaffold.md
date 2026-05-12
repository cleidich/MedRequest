# Decision: Infrastructure Scaffolding Patterns

- **ID:** `infra-scaffold-001`
- **Author:** Livingston
- **Date:** 2025-07-14
- **Status:** Implemented
- **Scope:** Infrastructure

## Decision

Established the full Bicep infrastructure scaffolding with these key patterns:

1. **Single user-assigned managed identity** shared across App Service and Functions, granted RBAC roles on Key Vault (Secrets User) and Storage (Blob Data Contributor). SQL Server uses this identity as AAD admin.

2. **B1 App Service SKU** (not F1) because VNet integration requires at least Basic tier. This is a cost tradeoff documented in `app-service.bicep`.

3. **APIM Consumption tier runs outside VNet** — no VNet injection capability. Traffic path is: Internet → App Gateway → App Service. APIM is available as a separate gateway endpoint.

4. **App Gateway Standard_v2 with WAF** is the single biggest cost (~$146/mo). Autoscale set to 0-2 instances to minimize when idle. Team should decide if this is acceptable for POC budget.

5. **AAD-only auth on SQL Server** — no SQL passwords anywhere. Connection strings use managed identity tokens.

6. **CI/CD uses OIDC federated credentials** (no stored secrets for Azure auth). Required GitHub secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `SQL_AAD_ADMIN_OBJECT_ID`.

## Impact

- Basher: SQL connection in `src/api/db/pool.js` must use `@azure/identity` for token-based auth (no password in connection string)
- Linus: No direct impact — frontend is served from App Service
- Rusty: Architecture matches the proposed structure; App Gateway cost needs team sign-off

## Open Items

- [ ] Team to confirm App Gateway cost is acceptable for POC
- [ ] `SQL_AAD_ADMIN_OBJECT_ID` secret needs to be set in GitHub repo settings
- [ ] APIM API definitions and policies to be added once API contract is finalized
