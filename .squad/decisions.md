# Squad Decisions

## Active Decisions

### Decision: MedRequest Project Structure
- **ID:** `project-structure-001`
- **Author:** Rusty
- **Date:** 2025-07-14
- **Status:** Proposed
- **Scope:** Architecture

**Decision:** Adopt a monorepo layout with logical separation across `src/frontend/`, `src/api/`, `src/functions/`, `infra/`, and `db/`. Key patterns include:
1. Multi-tenancy via Azure SQL Row-Level Security (RLS) with `SESSION_CONTEXT`-based tenant filtering
2. Header-based auth for demo (`X-Tenant-Id`, `X-User-Id`, `X-User-Role`)
3. Pull integration API for EMR/comms systems + Azure Function scaffold for future push
4. Cost-conscious defaults (free/Basic/Standard SKUs)
5. Private networking with VNet, App Gateway, App Service integration, SQL private endpoint

**Context:** The team needs an agreed-upon project structure before implementation. INTAKE.md defines JS frontend, Node.js backend, Azure SQL multi-tenant, Bicep IaC, and GitHub Actions CI/CD.

**Alternatives Considered:**
- Separate repos per service (rejected — overhead for POC)
- Elastic pools / DB-per-tenant (rejected — RLS simpler for demo)
- Full OAuth/MSAL (rejected — header-based faster for POC, swappable later)
- Terraform (rejected — intake specifies Bicep)

**Impact:** All team members should reference `docs/PROJECT-STRUCTURE.md` for directory conventions and ownership boundaries.

**Ownership Matrix:**
| Area | Owner | Notes |
|------|-------|-------|
| `src/frontend/` | Linus | All UI, CSS, client-side JS |
| `src/api/` | Basher | Express API, middleware, services |
| `src/functions/` | Basher | Azure Functions scaffolds |
| `db/` | Basher (schema), Livingston (infra) | SQL migrations/seed data |
| `infra/` | Livingston | All Bicep modules, deploy scripts |
| `.github/workflows/` | Livingston | CI/CD pipelines |
| `docs/` | Rusty | Architecture docs |

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
