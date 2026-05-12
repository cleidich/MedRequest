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

### 2025-01-14 — Demo Persona Switcher Implementation
- **Architecture:** Query param-based persona detection (`?persona={slug}#{view}`) with visual picker and badge
- **New modules:**
  - `js/personas.js` — IIFE registry with 9 personas (3 tenants × 3 roles); `getFromUrl()`, `getAll()`, `getByTenant()` helpers
  - `js/views/picker.js` — Persona picker view with 3 tenant cards, 9 persona buttons total
  - `js/components/persona-badge.js` — Fixed-position badge showing current tenant/user/role with "DEMO MODE" label
- **Modified files:**
  - `js/app.js` — Added persona detection on init; shows picker if no persona param and no hash; renders badge when persona active
  - `public/index.html` — Added script tags for personas.js, picker.js, persona-badge.js in correct load order
  - `css/styles.css` — Added picker card grid (mobile-responsive), tenant color coding, badge styles (fixed top-right, compact on mobile)
- **URL scheme:** `/?persona=mercy-patient#patient` → sets tenant/user/role via Auth.set(), renders badge, shows view
- **Persona IDs:** Match exact IDs from `docs/DEMO-AUTH-DESIGN.md` registry table (A0000000/B0000000/C0000000 tenant prefixes)
- **UX patterns:**
  - No persona param + no hash → show picker
  - Persona param present → set auth, show badge, route to view
  - "Switch Persona" button → navigate to `/` (clears params, returns to picker)
- **Styling:** Tenant-specific left borders (Mercy=blue, St.Claire=green, Harbor=orange), hover states, mobile-first grid
- **Dependencies:** Basher must seed Harbor Medical Center (Tenant #3) before harbor-* personas work
- **Key insight:** Auth.set() already accepted { tenantId, userId, role } — no changes needed to auth.js
- **Cross-team update (from Basher):** Harbor Medical Center (Tenant #3) now seeded with 3 users (Henry Park, Isabel Chen, Jack O'Brien) and 2 sample requests. All harbor-* personas are now functional and ready for demos.

### 2026-05-12 — Frontend Handlers Completed for Demo Readiness
- **api.js:** Added `forwardToEmr(id)`, `forwardToBusinessOffice(id)`, and `notify(data)` methods for integration endpoints (`POST /api/integration/forward-emr`, `POST /api/integration/forward-business-office`, `POST /api/integration/notify`).
- **concierge.js:** Replaced minimal "Start Working" / "Resolve" buttons with full workflow: Acknowledge → In Progress → Resolve → Forward to Case Manager. Replaced `alert()` with inline `.card-alert` toasts. Forward to CM sets `status: 'forwarded', forwarded_to: 'case_manager'`.
- **casemanager.js:** Wired "Forward to Medical Record" to `Api.forwardToEmr()` and "Forward to Business Office" to `Api.forwardToBusinessOffice()` — these call the actual integration endpoints before updating status. Added Acknowledge and Close buttons. Replaced all `alert()` calls with inline card-level toasts.
- **patient.js:** Added `acknowledged` and `closed` to status label map so patients see meaningful status text.
- **styles.css:** Added `.badge-acknowledged`, `.badge-closed`, `.btn-secondary`, `.card-alert` styles.
- **Pattern:** All action handlers follow the same shape — `_handleAction(id, action, btnEl)` with `switch` on action, inline success/error alerts in the card, and list refresh after completion. Brief `setTimeout` delay on forward actions so user sees the success toast before the list refreshes.
- **Key insight:** Case Manager forward actions call the integration API endpoint first, THEN update the request status — this ensures the integration system receives the data before we mark the request as forwarded.
- **Cross-team coordination (from Basher):** Type mapping added to accept `comfort`/`service`/`staff` form types — frontend form can now submit successfully.
- **Cross-team coordination (from Livingston):** Frontend redeployed to `app-medrequest-demo`; served from App Service root path; all workflows tested end-to-end.
- **Status constraint note:** Flagged that `acknowledged` and `closed` statuses were missing from DB CHECK constraint. Coordinator fixed via Livingston's DB update. All 8 status values now supported.

### 2026-05-12 — Explorer "Behind the Scenes" View
- **New view:** `src/frontend/js/views/explorer.js` — `ExplorerView` IIFE module, follows existing view pattern
- **Route:** `#explorer` added to `app.js` VIEWS map; nav tab added after Case Manager with 🔬 icon
- **Query cards:** 5 pre-built cards (My Requests, All Users, Request Count, Tenant Info, Cross-Tenant Proof) — each shows description, Run Query button, SQL output, row count, results table, and RLS explanation note
- **API method:** `Api.runExplorerQuery(queryKey)` added — POSTs to `/api/debug/explore` with `{ queryKey }`
- **UX:** Prominent banner explaining RLS demo, persona-aware tenant bar with color coding (Mercy=blue, St.Claire=green, Harbor=orange), zebra-striped results table with monospace IDs
- **CSS:** Explorer styles added to `styles.css` — dark code blocks, responsive card grid (single column mobile, auto-fit grid on tablet+), table with horizontal scroll
- **Sync:** All modified files copied to `src/api/public/` with root-relative paths (learned from deploy-demo-001 bug)
- **Depends on Basher:** Backend `POST /api/debug/explore` endpoint must exist and return `{ sql, rows, rlsNote }` — see `.squad/decisions/inbox/basher-sql-explorer.md` for contract

### 2026-05-12 — Runtime Config Fetch (No Hardcoded Secrets)
- **Problem:** `api.js` had hardcoded APIM URL and subscription key — security risk and breaks across environments.
- **Solution:** Added `Api.init()` that fetches `GET /api/config` at startup. Backend returns `{ apim: { enabled, baseUrl, subscriptionKey } }`.
- **api.js changes:** Removed `APIM_BASE` and `APIM_KEY` constants. Added `init()` method, `apimBaseUrl`/`apimKey` state vars. `setApimEnabled()` now toggles between fetched APIM URL and `/api` (not hardcoded). Subscription key header only sent when APIM mode active and key exists. Graceful fallback to direct `/api` if config fetch fails.
- **app.js changes:** `init()` is now `async`, calls `await Api.init()` before persona detection or rendering. `DOMContentLoaded` handler wraps in arrow function to handle the returned promise.
- **Sync:** Both files synced to `src/api/public/js/`.
- **Depends on Basher:** `GET /api/config` endpoint must exist and return the expected shape. See `.squad/decisions/inbox/basher-config-endpoint.md`.
- **Directive:** Per team directive — never hardcode secrets or environment-specific URLs in source code.


### 2026-05-12 — Key Vault Config Pattern Integration (Orchestration Summary)
- **Part of:** Three-agent integration (Livingston storing secrets, Basher serving config, Linus fetching at startup)
- **Frontend's role:** Call `/api/config` at app initialization, use returned APIM settings to route subsequent API calls
- **Behavior:** If config returns `apim.enabled=true`, route through APIM with subscription key header. Otherwise, fall back to direct `/api` calls. Toggle still available for demo flexibility.
- **Eliminates secret exposure:** No APIM URLs or keys hardcoded in source code; all environment-specific config fetched at runtime
- **Documented:** Decision `frontend-config-001` in squad/decisions.md
