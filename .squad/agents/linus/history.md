# Linus — History

## Project Context
- **Project:** MedRequest — hospital patient communication/concierge request app (demo/POC)
- **User:** cleidich
- **Stack:** JavaScript frontend (lightweight framework optional), responsive design for phone/tablet
- **Roles:** Patient (submit requests), Concierge (triage), Case Manager (coordinate care)
- **Auth:** Simple header-based authentication for demo
- **API access:** Via Azure APIM

## Learnings

### 2025-07-14 — Project Structure Context
- **Monorepo layout:** `src/frontend/`, `src/api/`, `src/functions/`, `infra/`, `db/`
- **Frontend ownership:** Vanilla JS SPA (no heavy framework), mobile-first CSS, role-based views
- **Tech stack:** JavaScript, responsive design for phone/tablet, header-based auth
- **Integration:** API via Azure APIM, no OAuth/MSAL for POC
- **Key context:** Project decision `project-structure-001` documented in `.squad/decisions.md`
- **Reference:** See `docs/PROJECT-STRUCTURE.md` for full directory tree and ownership boundaries

