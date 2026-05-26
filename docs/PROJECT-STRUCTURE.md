# MedRequest — Proposed Project Structure

> **Author:** Rusty (Lead) | **Date:** 2025-07-14 | **Status:** Proposed

## Directory Tree

```
patient-comm-app/
├── docs/                           # Project documentation
│   ├── INTAKE.md                   # Original intake/requirements
│   ├── PROJECT-STRUCTURE.md        # This file
│   └── api/                        # API documentation & examples
│
├── src/
│   ├── frontend/                   # 🔵 Owner: Linus
│   │   ├── public/
│   │   │   ├── index.html          # SPA entry point
│   │   │   ├── favicon.ico
│   │   │   └── assets/             # Static images, icons
│   │   ├── css/
│   │   │   └── styles.css          # Mobile-first responsive styles
│   │   ├── js/
│   │   │   ├── app.js              # App bootstrap & router
│   │   │   ├── api.js              # API client (fetch wrapper)
│   │   │   ├── auth.js             # Header-based auth helper
│   │   │   └── views/
│   │   │       ├── patient.js      # Patient request form
│   │   │       ├── concierge.js    # Concierge dashboard
│   │   │       └── casemanager.js  # Case Manager dashboard
│   │   └── package.json            # Dev dependencies (optional bundler/linter)
│   │
│   ├── api/                        # 🟢 Owner: Basher
│   │   ├── package.json
│   │   ├── server.js               # Express entry point
│   │   ├── middleware/
│   │   │   ├── auth.js             # Header-based tenant/user auth
│   │   │   ├── tenantContext.js    # Extract tenant ID, set DB context
│   │   │   └── errorHandler.js     # Centralized error handling
│   │   ├── routes/
│   │   │   ├── requests.js         # CRUD for patient requests
│   │   │   ├── integration.js      # Pull API for EMR/comms systems
│   │   │   └── health.js           # Health/readiness probes
│   │   ├── services/
│   │   │   ├── requestService.js   # Business logic for requests
│   │   │   └── integrationService.js # Outbound integration scaffold
│   │   ├── db/
│   │   │   ├── pool.js             # Azure SQL connection pool (mssql)
│   │   │   └── queries.js          # Parameterized SQL queries
│   │   └── config/
│   │       └── index.js            # Environment config (Key Vault refs)
│   │
│   └── functions/                  # 🟢 Owner: Basher
│       ├── package.json
│       ├── host.json
│       ├── local.settings.json     # (gitignored)
│       └── outbound-notify/        # Azure Function: outbound integration scaffold
│           ├── index.js
│           └── function.json
│
├── infra/                          # 🟠 Owner: Livingston
│   ├── main.bicep                  # Orchestrator — deploys all modules
│   ├── main.bicepparam             # Parameter file (dev environment)
│   ├── modules/
│   │   ├── app-service.bicep       # App Service Plan + Web App
│   │   ├── functions.bicep         # Function App + Storage
│   │   ├── sql.bicep               # Azure SQL Server + Database
│   │   ├── apim.bicep              # API Management instance
│   │   ├── key-vault.bicep         # Key Vault + access policies
│   │   ├── monitoring.bicep        # App Insights + Log Analytics
│   │   ├── storage.bicep           # Blob Storage account
│   │   ├── networking.bicep        # VNet, subnets, NSGs
│   │   └── managed-identity.bicep  # User-assigned managed identity
│   └── scripts/
│       └── seed-sql.sh             # DB schema bootstrap script
│
├── db/                             # 🟢 Owner: Basher (schema) / 🟠 Livingston (infra)
│   ├── migrations/
│   │   └── 001-initial-schema.sql  # Tables, indexes, RLS policies
│   └── seed/
│       └── demo-data.sql           # Sample multi-tenant demo data
│
├── .github/                        # 🟠 Owner: Livingston
│   └── workflows/
│       ├── ci.yml                  # Lint, test, build on PR
│       └── deploy.yml              # Deploy infra + app to dev
│
├── .gitignore
├── README.md
└── package.json                    # Root workspace (optional npm workspaces)
```

## Key Architectural Decisions

### 1. Monorepo with Logical Separation

The entire POC lives in one repo with clear subdirectories (`src/frontend`, `src/api`, `src/functions`, `infra/`, `db/`). For a demo this avoids multi-repo overhead while keeping ownership boundaries clean. If needed, `npm workspaces` can link `src/api` and `src/functions` for shared utilities.

### 2. Vanilla JavaScript Frontend

Per the intake, the frontend uses plain JavaScript — no heavy framework. A simple SPA pattern with view modules keeps it lightweight and phone/tablet optimized. Mobile-first CSS. Linus owns this entirely.

### 3. Multi-Tenant via Row-Level Security (RLS)

Multi-tenancy is handled at the Azure SQL level using **Row-Level Security** with a `tenant_id` column on all tables. The API middleware (`tenantContext.js`) extracts the tenant ID from the auth header and sets `SESSION_CONTEXT` on each connection, which the RLS policy uses for filtering. This is simpler and cheaper than elastic pools or separate databases for a POC.

### 4. Express API with Clean Layer Separation

The Node.js backend follows `routes → services → db` layering. Routes handle HTTP concerns, services hold business logic, and the `db/` layer manages connection pooling and parameterized queries against Azure SQL. This keeps it testable and easy to extend.

### 5. Pull-Based Integration Architecture

The intake specifies a "pull architecture" for moving requests into EMR/comms systems. The `integration.js` route exposes endpoints that external systems can poll (e.g., `GET /api/integration/requests?status=new&since=<timestamp>`). The Azure Function `outbound-notify` is a scaffold for future push-based notifications.

### 6. Header-Based Auth (Demo)

Authentication uses custom HTTP headers (e.g., `X-Tenant-Id`, `X-User-Id`, `X-User-Role`) — no OAuth/MSAL for the POC. The `auth.js` middleware validates these headers and populates `req.user`. This is fast to implement and easy to swap out later.

### 7. Modular Bicep with Per-Service Files

Infrastructure uses Bicep modules composed by `main.bicep`. Each Azure service gets its own module for clarity and independent iteration. Livingston owns all of `infra/` and the GitHub Actions workflows.

### 8. Cost-Conscious Defaults

All Bicep modules target free/Basic/Standard SKUs:
- App Service: **F1/B1**
- Azure SQL: **Basic** (5 DTU)
- APIM: **Basic v2** tier (~$150/month, dedicated compute)
- Functions: **Consumption** plan

### 9. Private Networking (Scoped)

A VNet with subnets for App Service (VNet integration) and SQL (private endpoint) is included. APIM in Basic v2 tier runs outside the VNet and communicates directly with the backend App Service. Basic v2 provides dedicated compute with no cold starts.

### 10. Observability by Default

A single Log Analytics Workspace feeds App Insights (for the API and Functions) and receives diagnostic logs from all resources via Bicep `diagnosticSettings`. No separate workspace per resource — one workspace keeps it simple for a POC.

## Ownership Matrix

| Area | Owner | Notes |
|------|-------|-------|
| `src/frontend/` | **Linus** | All UI, CSS, client-side JS |
| `src/api/` | **Basher** | Express API, middleware, services |
| `src/functions/` | **Basher** | Azure Functions (outbound scaffolds) |
| `db/` | **Basher** (schema), **Livingston** (infra) | SQL migrations and seed data |
| `infra/` | **Livingston** | All Bicep modules and deploy scripts |
| `.github/workflows/` | **Livingston** | CI/CD pipelines |
| `docs/` | **Rusty** | Architecture docs, reviewed by all |

## Next Steps

1. **Livingston**: Stand up `infra/` scaffolding — `main.bicep` + core modules (networking, monitoring, app-service).
2. **Basher**: Initialize `src/api/` with Express, health route, and DB connection scaffold.
3. **Linus**: Initialize `src/frontend/` with responsive HTML shell and role-based view stubs.
4. **Rusty**: Define API contract (OpenAPI spec) for patient request CRUD + integration endpoints.
