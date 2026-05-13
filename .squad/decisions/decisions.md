# Decisions — MedRequest Project

**Latest Update:** 2026-05-13  
**Status:** Active tracking of approved and proposed decisions across all teams

---

## Decision: Adopt azd + Node.js Startup Migrations for Deployment

- **ID:** `deploy-simplification-001`
- **Author:** Rusty
- **Date:** 2026-05-13
- **Status:** Proposed
- **Scope:** Deployment, Infrastructure, Developer Experience

### Decision

Adopt **Azure Developer CLI (`azd`)** with **shell-based lifecycle hooks** and **Node.js startup migrations** as the deployment strategy for MedRequest. This replaces the current ~15-step manual deployment process with a single `azd up` command.

### Context

Current deployment (documented in `docs/TESTING.md`) requires 5 phases, ~15 manual steps, 30–50 minutes, and has multiple gotchas that caused 70+ minutes of debugging. Key pain points: sqlcmd dependency, fragile `az webapp up` behavior, post-deploy ordering sensitivity, and no single-command path from clone to running app.

### Key Changes

1. **`azure.yaml`** — Defines services and hooks for azd lifecycle
2. **Node.js startup migrations** (`src/api/db/migrate.js`) — Eliminates sqlcmd dependency; app runs pending SQL migrations on boot
3. **`postprovision` hook** — Automates firewall rules, managed identity SQL grants, initial migration/seed
4. **`prepackage` hook** — Automates frontend→public sync
5. **`postdeploy` hook** — Fixes startup command, runs health verification
6. **`preprovision` hook** — Purges soft-deleted APIM/Key Vault resources

### Alternatives Considered

- **Bicep deploymentScripts** — Works but poor debugging DX (transient ACI containers). Better as complement, not primary.
- **Azure Functions migration runner** — Over-engineered; creates chicken-and-egg deployment ordering.
- **GitHub Actions only** — Good for CI/CD but doesn't help local developer experience.
- **Makefile** — Reinvents what azd already provides (lifecycle, env management, hooks).

### Impact

- **Livingston:** Create `azure.yaml`, hook scripts, adapt Bicep outputs (5–8 hours)
- **Basher:** Write Node.js migration runner + seed logic (3–5 hours)
- **TESTING.md:** Rewrite to reflect single-command flow
- **New dependency:** `azd` CLI (single install command)
- **Preserves:** All existing Bicep modules, no architecture changes

### References

- Full proposal: `docs/DEPLOYMENT-SIMPLIFICATION.md`
- Primary Azure Sample: [todo-nodejs-mongo](https://github.com/Azure-Samples/todo-nodejs-mongo)
- SQL+azd reference: [msdocs-app-service-sqldb-dotnetcore](https://github.com/Azure-Samples/msdocs-app-service-sqldb-dotnetcore)

### Cross-Team Coordination

- **Livingston:** Phase 1 — azure.yaml creation and hook scripting
- **Basher:** Phase 2 — Node.js migration runner and seed automation
- **Linus:** No direct action — frontend handled via hooks
- **Chris (PM):** Decision checkpoint

### Decision Status

**Awaiting:** Chris review and team approval. Proposal document available at `docs/DEPLOYMENT-SIMPLIFICATION.md`.

---

## Related Historical Decisions

### 2026-05-12 — Multi-Tenant Architecture Documented

- **Status:** ✅ Implemented
- **Content:** Comprehensive multi-tenant RLS pattern documentation at `docs/MULTI-TENANT-ARCHITECTURE.md`
- **Scope:** Row-Level Security, SESSION_CONTEXT isolation, code walkthroughs, pattern comparisons
- **Owner:** Rusty (Architect)

### 2025-07-14 — Project Structure & Multi-Tenancy Pattern

- **Status:** ✅ Implemented
- **Decisions:** Monorepo layout (src/frontend, src/api, src/functions, infra, db), Azure SQL RLS + SESSION_CONTEXT for multi-tenancy, header-based demo auth, modular Bicep IaC
- **Reference:** `docs/PROJECT-STRUCTURE.md`, `docs/INTAKE.md`
- **Owner:** Rusty (Architect)

---

## Decision Tracking

| ID | Decision | Author | Status | Date | Reference |
|----|----|--------|--------|------|-----------|
| deploy-simplification-001 | azd + Node.js startup migrations for deployment | Rusty | Proposed | 2026-05-13 | `docs/DEPLOYMENT-SIMPLIFICATION.md` |
| multi-tenant-rls-001 | Multi-tenant RLS + SESSION_CONTEXT architecture | Rusty | ✅ Implemented | 2026-05-12 | `docs/MULTI-TENANT-ARCHITECTURE.md` |
| project-structure-001 | Monorepo + Bicep IaC + header-based auth demo | Rusty | ✅ Implemented | 2025-07-14 | `docs/PROJECT-STRUCTURE.md` |

---

**Last Updated:** 2026-05-13  
**Next Review:** When decision-001 status changes or new decisions emerge
