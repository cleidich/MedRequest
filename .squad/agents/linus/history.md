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

### 2025-07-14 — Frontend Scaffold Created
- **Architecture:** IIFE module pattern (Auth, Api, PatientView, ConciergeView, CaseManagerView, App) — no build step needed.
- **Router:** Hash-based (`#patient`, `#concierge`, `#casemanager`); `hashchange` event drives view rendering.
- **Auth:** `Auth` module in `js/auth.js` stores `tenantId`/`userId`/`role` in localStorage; auto-switches userId per role.
- **API client:** `Api` module in `js/api.js` wraps `fetch`, injects `X-Tenant-Id`/`X-User-Id`/`X-User-Role` headers. Base URL defaults to `/api`.
- **CSS:** Mobile-first with breakpoints at 600px (tablet) and 900px (desktop). CSS custom properties for theming. Healthcare color scheme (blues).
- **Status badges:** `.badge-new`, `.badge-in_progress`, `.badge-resolved`, `.badge-forwarded`.
- **Case Manager stubs:** "Forward to Record" and "Forward to Business Office" send PATCH with `forwarded_to` field.
- **Key files:** `src/frontend/public/index.html`, `css/styles.css`, `js/app.js`, `js/api.js`, `js/auth.js`, `js/views/{patient,concierge,casemanager}.js`.
- **Dev server:** `npm start` runs `http-server` on port 3000.
- **Cross-team note (from Basher):** API endpoints confirm with frontend expectations: POST/GET/GET/:id/PATCH `/api/requests`, GET `/api/integration/requests`, POST `/api/integration/forward-emr`, POST `/api/integration/notify`
- **Cross-team note (from Livingston):** Frontend served from App Service static content path `/` (SPA entry point is `index.html`); no additional server-side routing needed

