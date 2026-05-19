# MedRequest

**MedRequest** is a hospital patient communication platform that enables inpatients to send feedback and request concierge-type services directly from their smartphones. Patients can request non-urgent comfort items, service assistance, or case manager support—improving patient satisfaction and reducing staff burden.

> **Note:** This is a **proof-of-concept (POC) / demo application** designed to showcase Azure architectural patterns, multi-tenant database design, and secure API gateway integration. Additional features like production EMR integration and advanced compliance hardening are out of scope for this phase.

---

## Table of Contents

1. [Features](#features)
2. [Architecture Overview](#architecture-overview)
3. [Azure Infrastructure](#azure-infrastructure)
4. [Repository Structure](#repository-structure)
5. [Prerequisites](#prerequisites)
6. [Local Development](#local-development)
7. [Deployment](#deployment)
8. [API Overview](#api-overview)
9. [User Roles](#user-roles)
10. [Authentication](#authentication)
11. [Cost Considerations](#cost-considerations)
12. [Disclaimer](#disclaimer)

---

## Features

- **Responsive Web Frontend** — Mobile and tablet optimized interface built with vanilla JavaScript
- **Secure Backend API** — Node.js/Express with multi-tenant support via Row-Level Security (RLS)
- **Pull-Based Integration** — APIs for external systems (EMR, communications platforms) to query and process requests
- **Azure Security Patterns** — API Gateway with WAF, APIM, managed identities, Key Vault, private networking
- **Multi-Tenant Operations** — Azure SQL with row-level security for tenant isolation and data segregation
- **Full Observability** — Application Insights and Log Analytics for metrics, logs, and diagnostics

---

## Architecture Overview

MedRequest follows a three-tier architecture deployed on Azure:

```
┌──────────────────────────────────────────────────────────────┐
│                   Azure App Gateway (WAF)                    │
│                      Public entry point                      │
└────────────────────────────┬─────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         │                                       │
    ┌────▼─────────┐                  ┌────────▼────────┐
    │   APIM        │                  │  App Service    │
    │  (Basic v2)│                  │  (Frontend+API) │
    └────┬─────────┘                  └────────┬────────┘
         │                                    │
         └────────────────┬───────────────────┘
                          │
        ┌─────────────────┴──────────────────┐
        │                                    │
    ┌───▼────────────┐              ┌──────▼──────────┐
    │  Azure SQL     │              │ Azure Functions │
    │  (Multi-tenant)│              │  (Outbound)     │
    └────────────────┘              └─────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla JavaScript, responsive CSS, mobile-first |
| **Backend API** | Node.js 18+, Express.js |
| **Database** | Azure SQL Database with Row-Level Security (RLS) for multi-tenancy |
| **Integration Functions** | Azure Functions (Node.js) with Consumption plan |
| **Security** | Azure API Management (APIM), Application Gateway (WAF), Key Vault, Managed Identities |
| **Observability** | Application Insights, Log Analytics Workspace |

---

## Azure Infrastructure

The MedRequest POC uses the following Azure services:

### Compute & Hosting
- **App Service** (B1/F1 tier) — hosts frontend SPA and Node.js backend API
- **Azure Functions** (Consumption plan) — outbound integration and background tasks

### Data & Storage
- **Azure SQL Database** (Basic tier, 5 DTU) — patient requests, users, multi-tenant data with RLS
- **Blob Storage** (Standard-LRS) — application resources and logs

### Security & Identity
- **Application Gateway with WAF** (Standard_v2) — DDoS protection, WAF rules, SSL termination
- **API Management** (Basic v2 tier) — API versioning, rate limiting, developer portal
- **Key Vault** (Standard) — secrets, certificates, connection strings
- **Managed Identities** — passwordless authentication for all service-to-service communication

### Networking
- **Virtual Network (VNet)** with subnets for App Gateway, App Service (VNet integration), and SQL (private endpoints)
- **Network Security Groups (NSGs)** — least-privilege inbound/outbound rules
- **Private Endpoints** — for Azure SQL and Key Vault

### Observability
- **Application Insights** — APM, telemetry, performance monitoring
- **Log Analytics Workspace** — centralized logging, KQL queries, alerts

---

## Repository Structure

```
patient-comm-app/
├── docs/
│   ├── INTAKE.md                    # Requirements and business context
│   ├── PROJECT-STRUCTURE.md         # Full project design proposal
│   └── api/                         # API documentation & examples
│
├── src/
│   ├── frontend/                    # 🔵 Linus (owner)
│   │   ├── public/
│   │   │   ├── index.html           # SPA entry point
│   │   │   ├── favicon.ico
│   │   │   └── assets/              # Images, icons
│   │   ├── css/
│   │   │   └── styles.css           # Mobile-first responsive styles
│   │   ├── js/
│   │   │   ├── app.js               # App bootstrap & router
│   │   │   ├── api.js               # API client (fetch wrapper)
│   │   │   ├── auth.js              # Header-based auth helper
│   │   │   └── views/               # Role-based view modules
│   │   │       ├── patient.js
│   │   │       ├── concierge.js
│   │   │       └── casemanager.js
│   │   └── package.json
│   │
│   ├── api/                         # 🟢 Basher (owner)
│   │   ├── package.json
│   │   ├── server.js                # Express entry point
│   │   ├── middleware/
│   │   │   ├── auth.js              # Header validation
│   │   │   ├── tenantContext.js     # Tenant ID extraction & DB context
│   │   │   └── errorHandler.js      # Centralized error handling
│   │   ├── routes/
│   │   │   ├── requests.js          # Patient request CRUD
│   │   │   ├── integration.js       # EMR/comms system pull API
│   │   │   └── health.js            # Liveness/readiness probes
│   │   ├── services/
│   │   │   ├── requestService.js    # Business logic
│   │   │   └── integrationService.js
│   ├── db/
│   │   │   ├── pool.js              # Azure SQL connection pool
│   │   │   ├── queries.js           # Parameterized SQL queries
│   │   │   ├── migrate.js           # Node.js migration runner (tracks via _migrations table)
│   │   │   └── seed.js              # Conditional demo data seeder
│   │   └── config/
│   │       └── index.js             # Environment config (Key Vault)
│   │
│   └── functions/                   # 🟢 Basher (owner)
│       ├── package.json
│       ├── host.json
│       ├── local.settings.json      # (gitignored)
│       └── outbound-notify/
│           ├── index.js
│           └── function.json
│
├── infra/                           # 🟠 Livingston (owner)
│   ├── main.bicep                   # Orchestrator — deploys all modules
│   ├── main.bicepparam              # Parameter file (dev environment)
│   ├── modules/
│   │   ├── app-service.bicep
│   │   ├── functions.bicep
│   │   ├── sql.bicep
│   │   ├── apim.bicep
│   │   ├── app-gateway.bicep
│   │   ├── key-vault.bicep
│   │   ├── monitoring.bicep
│   │   ├── storage.bicep
│   │   ├── networking.bicep
│   │   └── managed-identity.bicep
│   └── scripts/
│       ├── preprovision.sh          # Pre-flight: soft-delete checks
│       ├── postprovision.sh         # SQL firewall, identity grant, migrations, seed
│       ├── postdeploy.sh            # Startup command fix + health check
│       ├── run-migrations.js        # Standalone migration runner (AAD token auth)
│       └── run-seed.js              # Standalone seed runner (AAD token auth)
│
├── db/
│   ├── migrations/
│   │   └── 001-initial-schema.sql   # Tables, indexes, RLS policies
│   └── seed/
│       └── demo-data.sql            # Sample multi-tenant data
│
├── .github/workflows/
│   ├── ci.yml                       # Lint, test, build
│   └── deploy.yml                   # Deploy infra + app
│
├── .gitignore
├── azure.yaml                       # azd service definition + lifecycle hooks
├── README.md                        # This file
└── package.json                     # Root workspace (optional)
```

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ and npm
- **Azure CLI** (`az` command)
- **Azure Developer CLI** (`azd` command) — [Install](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd)
- **Bicep CLI** (typically included with Azure CLI v2.26+)
- **GitHub CLI** (`gh` command) — for managing secrets
- **Azure Subscription** with Owner or Contributor role
- **Git** for version control

### Install Prerequisites (macOS/Linux)

```bash
# Node.js
brew install node

# Azure CLI
brew install azure-cli

# Azure Developer CLI (azd)
curl -fsSL https://aka.ms/install-azd.sh | bash

# Bicep (if not included)
az bicep install

# GitHub CLI
brew install gh

# Verify installations
node --version
az --version
azd version
gh --version
```

---

## Local Development

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/patient-comm-app.git
cd patient-comm-app
```

### 2. Set Up Environment

```bash
# Create .env file in each service directory
# Use .env.example as template or configure manually
```

### 3. Frontend (Vanilla JavaScript)

```bash
cd src/frontend

# Install dependencies (if using a bundler like Parcel or Webpack)
npm install

# Start dev server (if configured)
npm start

# Or simply open public/index.html in your browser
# Frontend will call http://localhost:3000 for API
```

The frontend should be available at `http://localhost:5000` (or per your dev server config).

### 4. Backend API (Node.js/Express)

```bash
cd src/api

# Install dependencies
npm install

# Set environment variables (or create .env)
export NODE_ENV=development
export PORT=3000
export ASPNETCORE_URLS=http://localhost:3000
export DATABASE_URL="Server=localhost;User Id=sa;Password=YourPassword;Database=medrequest;"

# Run the Express server
npm start
# Or use nodemon for auto-reload
npm run dev
```

The API will be available at `http://localhost:3000`. Example endpoints:
- `GET /health` — Liveness probe
- `POST /api/requests` — Create a new patient request
- `GET /api/requests` — List requests (filtered by tenant)

### 5. Database (Local Development)

For local development, you can use:

- **SQL Server Express LocalDB** (Windows) or
- **Docker container** with SQL Server Express

```bash
# Docker example
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourPassword123!" \
  -p 1433:1433 --name mssql \
  mcr.microsoft.com/mssql/server:2019-latest

# Then run migrations (handled automatically on app startup)
cd src/api && npm install && npm start
# Migrations run automatically via src/api/db/migrate.js when the server starts
```

---

## Deployment

MedRequest uses the **Azure Developer CLI (`azd`)** for streamlined deployment. A single `azd up`
command provisions all Azure infrastructure, configures the database, runs migrations, seeds demo
data, deploys the application, and verifies it's healthy.

### Quick Start (azd)

```bash
# Install azd (if not already installed)
curl -fsSL https://aka.ms/install-azd.sh | bash

# Authenticate
az login
azd auth login

# Create environment and deploy
azd env new demo
azd env set AZURE_LOCATION centralus
azd up
```

After `azd up` completes (~20–40 min on first deploy, mostly APIM provisioning), the app URL is
printed to the console. Open it in a browser to see the demo.

### Common azd Commands

| Command | Description |
|---------|------------|
| `azd up` | Provision infrastructure + deploy app (full lifecycle) |
| `azd deploy` | Redeploy app code only (no infrastructure changes) |
| `azd down` | Tear down all Azure resources |
| `azd env list` | List all environments |
| `azd env select <name>` | Switch between environments |

> 📖 **For the complete deployment runbook** (prerequisites, manual steps, troubleshooting),
> see [`docs/TESTING.md`](docs/TESTING.md).

### Manual Deployment

Manual deployment via `az deployment group create` and `az webapp up` is still supported.
See the [manual phases in TESTING.md](docs/TESTING.md#manual-deployment-phases-reference) for
step-by-step instructions.

### Database Migrations

Database schema management is fully automated:

- **Migrations run automatically** at app startup (`src/api/db/migrate.js`) and during `azd`
  provisioning (via `infra/scripts/run-migrations.js`)
- **Migration files** live in `db/migrations/` as numbered `.sql` files (e.g., `001-initial-schema.sql`)
- **Tracking** — Applied migrations are recorded in the `_migrations` table to prevent re-application
- **GO batch separators** in SQL files are handled automatically by the Node.js runner
- **Seed data** in `db/seed/demo-data.sql` is applied conditionally (only when the `tenants` table
  is empty), both at app startup and during `azd` provisioning

### 1. Authenticate with Azure

```bash
az login
az account set --subscription "<your-subscription-id>"
```

### 2. Create Resource Group

```bash
az group create \
  --name rg-medrequest-dev \
  --location eastus
```

### 3. Deploy Infrastructure (Bicep)

```bash
cd infra

# Validate template
az deployment group validate \
  --resource-group rg-medrequest-dev \
  --template-file main.bicep \
  --parameters main.bicepparam

# Deploy infrastructure
az deployment group create \
  --resource-group rg-medrequest-dev \
  --template-file main.bicep \
  --parameters main.bicepparam \
  --name medrequest-deploy
```

This creates:
- Azure SQL Database with initial schema
- App Service Plan and Web App
- Function App with Consumption plan
- APIM instance (API Management)
- Application Gateway with WAF
- Key Vault, Storage, Monitoring resources
- VNet with private endpoints

### 4. Retrieve Connection Strings

```bash
# Get SQL connection string from Key Vault
az keyvault secret show \
  --vault-name kvmedreqdev \
  --name "sqlConnectionString" \
  --query "value" -o tsv

# Get API key from Key Vault (for testing)
az keyvault secret show \
  --vault-name kvmedreqdev \
  --name "apimSubscriptionKey" \
  --query "value" -o tsv
```

### 5. Run Database Migrations

```bash
cd db

# Migrations run automatically at app startup. To run manually:
cd src/api && npm install && cd ../..
node infra/scripts/run-migrations.js

# (Alternatively, the app runs migrations on startup via src/api/db/migrate.js)
```

### 6. Deploy API to App Service

```bash
cd src/api

# Build the app
npm install
npm run build  # If applicable

# Deploy via Azure CLI (App Service)
az webapp up \
  --resource-group rg-medrequest-dev \
  --name app-medrequest-dev \
  --runtime "node|18-lts" \
  --sku B1

# Set environment variables in App Service
az webapp config appsettings set \
  --resource-group rg-medrequest-dev \
  --name app-medrequest-dev \
  --settings \
    DATABASE_URL="@Microsoft.KeyVault(VaultName=kvmedreqdev;SecretName=sqlConnectionString)" \
    APIM_KEY="@Microsoft.KeyVault(VaultName=kvmedreqdev;SecretName=apimSubscriptionKey)"
```

### 7. Deploy Frontend to App Service (Static Content)

```bash
cd src/frontend

# App Service can serve static files from /public
# Deploy via GitHub Actions or direct push
az webapp deployment source config-zip \
  --resource-group rg-medrequest-dev \
  --name app-medrequest-dev \
  --src frontend.zip
```

### 8. Deploy Azure Functions

```bash
cd src/functions

npm install

# Deploy to Function App
func azure functionapp publish func-medrequest-dev --build remote
```

### 9. Verify Deployment

```bash
# Test the health endpoint
curl https://app-medrequest-dev.azurewebsites.net/health

# Create a test request
curl -X POST https://app-medrequest-dev.azurewebsites.net/api/requests \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: tenant-001" \
  -H "X-User-Id: patient-001" \
  -H "X-User-Role: patient" \
  -d '{"requestType": "comfort", "description": "Extra pillow"}'
```

---

## API Overview

The MedRequest API provides three main endpoint groups:

### Patient Requests (CRUD)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/requests` | Create a new request | Patient, Concierge |
| `GET` | `/api/requests` | List requests (RLS-filtered by tenant) | Any role |
| `GET` | `/api/requests/:id` | Get request details | Any role |
| `PUT` | `/api/requests/:id` | Update request status | Concierge, Case Manager |
| `DELETE` | `/api/requests/:id` | Delete request (soft-delete) | Case Manager only |

### Integration API (Pull Architecture)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/integration/requests` | Pull requests by status (for EMR/comms systems) |
| `POST` | `/api/integration/requests/:id/acknowledge` | Acknowledge receipt |
| `POST` | `/api/integration/requests/:id/complete` | Mark as completed |

### Health & Diagnostics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Liveness probe (k8s/App Service) |
| `GET` | `/ready` | Readiness probe (database connectivity check) |

### Example Requests

```bash
# Create a patient request
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: hospital-001" \
  -H "X-User-Id: patient-42" \
  -H "X-User-Role: patient" \
  -d '{
    "requestType": "comfort",
    "category": "bedding",
    "description": "Extra blanket",
    "urgency": "low"
  }'

# List all requests (tenant-filtered by RLS)
curl -X GET http://localhost:3000/api/requests \
  -H "X-Tenant-Id: hospital-001" \
  -H "X-User-Id: concierge-10" \
  -H "X-User-Role: concierge"

# Integration pull
curl -X GET "http://localhost:3000/api/integration/requests?status=new&since=2025-07-14T00:00:00Z" \
  -H "X-Tenant-Id: hospital-001" \
  -H "X-User-Id: ehr-system" \
  -H "X-User-Role: integration"
```

---

## User Roles

MedRequest supports three primary user roles:

### 1. **Patient** (Inpatient)
- **Capabilities:**
  - Submit new service requests (comfort items, staff assistance)
  - View personal request history and status updates
  - Cancel own requests
- **Example:** A patient requests an extra pillow or asks to speak with the case manager

### 2. **Concierge** (Hospital Staff)
- **Capabilities:**
  - View all active requests from assigned patients
  - Update request status (acknowledged, in-progress, completed)
  - Add notes to requests
  - Escalate to case manager if needed
- **Example:** Concierge sees a comfort request and arranges for housekeeping

### 3. **Case Manager** (Hospital Care Coordinator)
- **Capabilities:**
  - View all requests (all patients)
  - Approve/reject requests outside normal scope
  - Forward requests to patient record (EMR integration)
  - Forward administrative requests to business office
  - Generate reports
- **Example:** Case manager reviews a request for early discharge coordination

---

## Authentication

MedRequest uses **header-based authentication** for the POC phase. This approach is:
- ✅ Fast to implement
- ✅ Easy to test (curl, Postman)
- ❌ **Not suitable for production** — should be replaced with OAuth 2.0 / MSAL

### Required Headers

Every API request must include:

```
X-Tenant-Id: <tenant-identifier>
X-User-Id: <user-identifier>
X-User-Role: <patient|concierge|casemanager|integration>
```

### Example

```bash
curl -X GET http://localhost:3000/api/requests \
  -H "X-Tenant-Id: hospital-001" \
  -H "X-User-Id: user-42" \
  -H "X-User-Role: patient"
```

### Middleware Processing

The `src/api/middleware/auth.js` middleware:
1. Validates header presence
2. Extracts tenant ID and user context
3. Sets `req.user` and `req.tenant`
4. **Passes to Azure SQL as `SESSION_CONTEXT`** for Row-Level Security (RLS) enforcement

This ensures that queries in the database automatically filter results by tenant — even if an attacker somehow bypasses application logic, RLS prevents data leakage.

### Future: OAuth 2.0 / Microsoft Entra ID

For production, replace header-based auth with:
- Microsoft Entra ID (Azure AD) via MSAL
- OAuth 2.0 flow with APIM as token validator
- Managed identities for service-to-service auth

---

## Cost Considerations

This POC intentionally uses **low-cost Azure SKUs** to minimize spend while demonstrating architectural patterns:

| Resource | SKU | Monthly Estimate | Notes |
|----------|-----|------------------|-------|
| App Service Plan | B1 | $12 | 1 core, 1.75 GB RAM; can handle light traffic |
| Azure SQL Database | Basic (5 DTU) | $5–$10 | 2 GB storage, row-level security included |
| Azure Functions | Consumption | $0–$5 | Pay per execution; free tier includes 1M calls/month |
| API Management | Basic v2 | ~$150 | Dedicated compute; no cold starts, includes SLA |
| Application Gateway | Standard_v2 | ~$146 | Fixed hourly cost; cheapest WAF-capable SKU |
| Key Vault | Standard | $0.60/month | Per-transaction pricing (~$2–5 total) |
| Storage Account | Standard-LRS | $0–$2 | Minimal usage for logs/assets |
| Log Analytics | Pay-as-you-go | $0–$10 | ~1 GB/day ingestion |
| **Total** | | **~$320–$330/month** | APIM Basic v2 is the primary cost driver alongside App Gateway |

### Cost Optimization Tips

1. **Auto-scale App Service** — Use B1 for baseline; scale up only if needed
2. **SQL Reserved Capacity** — Consider 1-year reservations for production (not needed for POC)
3. **Spot VMs for Functions** — If horizontal scaling becomes necessary
4. **Monitor and Alert** — Set Azure Cost Management alerts to catch overages
5. **Clean Up Unused Resources** — Daily snapshot exports, old backups, unused storage accounts

### Scaling Path (Future)

- App Service: B1 → S1/S2 (standard tier) → P1V2 (premium) with auto-scaling
- SQL: Basic → Standard (S0/S1) with more DTUs
- APIM: Basic v2 → Standard v2 (higher capacity, more policies)

---

## Disclaimer

**This is a proof-of-concept and demo application.** It is provided "as-is" for demonstration of Azure architectural patterns and multi-tenant design only.

### Out of Scope

- Production-grade HIPAA/compliance features (encryption at rest, audit trails, etc.)
- Advanced EMR integration (scaffolded but not fully implemented)
- Load testing and performance tuning
- Disaster recovery and backup strategy
- Mobile app (web-only)

### Security Notes

- **Header-based auth is demo-only** — replace with OAuth 2.0 / MSAL for production
- **Row-Level Security (RLS)** is enabled but should be tested thoroughly before production use
- **Application Gateway + WAF** provides basic DDoS protection, but real-world deployments need additional hardening
- **Secrets in Key Vault** are best-practice, but consider rotating credentials regularly
- **Managed Identities** eliminate most secret management, but audit trail is important

### Testing Before Production

Before deploying to a real hospital environment:

1. ✅ Conduct security penetration testing (especially auth bypass scenarios)
2. ✅ Perform HIPAA compliance audit
3. ✅ Load test at expected patient capacity
4. ✅ Validate RLS policies with multiple tenants
5. ✅ Backup and disaster recovery drills
6. ✅ HITRUST or SOC 2 Type II certification

---

## Support & Questions

For questions or issues:

1. **Check existing issues** — https://github.com/your-org/patient-comm-app/issues
2. **Ask in team Slack** — #medrequest-dev
3. **Review docs** — Start with `docs/INTAKE.md` and `docs/PROJECT-STRUCTURE.md`

---

**Created:** 2025-07-14  
**POC Status:** In Development  
**Architecture Lead:** Rusty  
**Last Updated:** 2026-05-14
