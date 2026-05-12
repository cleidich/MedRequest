# Basher — History

## Project Context
- **Project:** MedRequest — hospital patient communication/concierge request app (demo/POC)
- **User:** cleidich
- **Stack:** Node.js backend, Azure SQL (multi-tenant via sharding)
- **APIs:** Patient request submission, request query/pull, outbound integration scaffolds
- **Auth:** Simple header-based authentication for demo
- **Constraints:** Low-cost SKUs, managed identities for Azure resource access

## Learnings

### 2025-07-14 — Project Structure Context
- **API ownership:** Express.js backend in `src/api/`, Azure Functions scaffolds in `src/functions/`
- **Architecture pattern:** `routes → services → db` layering for clean separation
- **Database:** Azure SQL with Row-Level Security (RLS) using `SESSION_CONTEXT` for multi-tenancy
- **Auth:** Header-based (`X-Tenant-Id`, `X-User-Id`, `X-User-Role`) — demo-only, swappable
- **Integration model:** Pull API endpoints + Azure Function scaffold for future push
- **Co-ownership:** DB schema with Livingston (who owns infrastructure)
- **Key context:** Project decision `project-structure-001` documented in `.squad/decisions.md`
- **Reference:** See `docs/PROJECT-STRUCTURE.md` for full directory tree and ownership boundaries

