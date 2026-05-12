# Demo Authentication Design

**Author:** Rusty  
**Date:** 2025-01-14  
**Status:** Proposed  
**Scope:** Frontend demo/presentation UX  

## Executive Summary

This design adds a **persona switcher** to the MedRequest frontend that allows demo presenters to instantly switch between different users (patients, concierges, case managers) across multiple hospital tenants **without authentication prompts**. The approach uses query parameters combined with the existing hash-based routing and localStorage-backed auth system. A **landing page** provides a visual persona picker, while **bookmarkable URLs** enable presenters to pre-load browser tabs.

---

## Problem Statement

The current frontend supports role-switching via the navigation menu (`#patient`, `#concierge`, `#casemanager`), but:
1. **All users share the same tenant** — cannot demonstrate multi-tenancy
2. **Role switching is manual** — requires clicking navigation links during live demos
3. **No clear starting point** — presenters land on the patient view by default
4. **No visual tenant/persona context** — unclear which hospital/user is active

For effective demos, we need:
- **9 distinct personas** (3 tenants × 3 roles)
- **Zero friction switching** (no prompts, instant)
- **Bookmarkable state** (pre-load tabs for "Alice at Mercy General", "Eve at St. Claire", etc.)
- **Visual indicators** (current tenant, current user, current role)

---

## Recommended Approach

### URL Scheme: Query Parameter + Hash

**Format:** `/?persona={tenantSlug}-{role}#{view}`

**Examples:**
- `/?persona=mercy-patient#patient` → Alice Johnson (patient at Mercy General)
- `/?persona=stclaire-concierge#concierge` → Frank Lee (concierge at St. Claire)
- `/?persona=harbor-casemanager#casemanager` → Case manager at Harbor Medical

**Rationale:**
- **Query params preserve the existing hash router** — no conflicts with `#patient`, `#concierge`, `#casemanager`
- **Bookmarkable** — entire state (tenant + role + view) in one URL
- **Default behavior unchanged** — if no `?persona=...`, use localStorage defaults (backward compatible)
- **Auto-syncing** — when persona query param is present, it overrides localStorage and sets the hash to the matching role view

**Edge cases:**
- `/?persona=mercy-patient` with no hash → auto-redirect to `/?persona=mercy-patient#patient`
- `/?persona=mercy-patient#concierge` → **intentional mismatch** allowed for flexibility (presenter might want to see concierge view as a patient user for testing)
- No persona param → fall back to localStorage or defaults (same as current behavior)

---

## Persona Registry

### Three Hospital Tenants

We'll add **Tenant #3** to the existing seed data. The three tenants:

| Tenant ID | Display Name | Slug | Seed Data Status |
|-----------|-------------|------|-----------------|
| `A0000000-0000-0000-0000-000000000001` | Mercy General Hospital | `mercy` | ✅ Exists |
| `B0000000-0000-0000-0000-000000000002` | St. Claire Medical Center | `stclaire` | ✅ Exists |
| `C0000000-0000-0000-0000-000000000003` | Harbor Medical Center | `harbor` | ⚠️ Needs seeding |

### Nine Demo Personas

| Persona Slug | Display Name | Tenant | Tenant ID | User ID | Role | Seed Status |
|-------------|-------------|---------|-----------|---------|------|------------|
| `mercy-patient` | Alice Johnson | Mercy General | `A0000000-0000-0000-0000-000000000001` | `10000000-0000-0000-0000-000000000001` | patient | ✅ Exists |
| `mercy-concierge` | Carol Davis | Mercy General | `A0000000-0000-0000-0000-000000000001` | `10000000-0000-0000-0000-000000000003` | concierge | ✅ Exists |
| `mercy-casemanager` | Dan Martinez | Mercy General | `A0000000-0000-0000-0000-000000000001` | `10000000-0000-0000-0000-000000000004` | case_manager | ✅ Exists |
| `stclaire-patient` | Eve Thompson | St. Claire | `B0000000-0000-0000-0000-000000000002` | `20000000-0000-0000-0000-000000000001` | patient | ✅ Exists |
| `stclaire-concierge` | Frank Lee | St. Claire | `B0000000-0000-0000-0000-000000000002` | `20000000-0000-0000-0000-000000000002` | concierge | ✅ Exists |
| `stclaire-casemanager` | Grace Kim | St. Claire | `B0000000-0000-0000-0000-000000000002` | `20000000-0000-0000-0000-000000000003` | case_manager | ✅ Exists |
| `harbor-patient` | Henry Park | Harbor Medical | `C0000000-0000-0000-0000-000000000003` | `30000000-0000-0000-0000-000000000001` | patient | ❌ Add to seed |
| `harbor-concierge` | Isabel Chen | Harbor Medical | `C0000000-0000-0000-0000-000000000003` | `30000000-0000-0000-0000-000000000002` | concierge | ❌ Add to seed |
| `harbor-casemanager` | Jack O'Brien | Harbor Medical | `C0000000-0000-0000-0000-000000000003` | `30000000-0000-0000-0000-000000000003` | case_manager | ❌ Add to seed |

**Note:** Seed data currently has only 2 tenants. **Basher** must add Harbor Medical Center to `db/seed/demo-data.sql`.

---

## UX Design

### 1. Landing Page (Persona Picker)

When the user navigates to the root `/` with **no persona query param**, show a **persona picker page**:

```
╔════════════════════════════════════════════════════════════╗
║  MedRequest Demo — Select a Persona                        ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Choose a hospital and role to start the demo:            ║
║                                                            ║
║  ┌─────────────────────────────────────────────────────┐  ║
║  │ Mercy General Hospital                              │  ║
║  ├─────────────────────────────────────────────────────┤  ║
║  │  🧑‍⚕️ Patient       Alice Johnson                    │  ║
║  │  🛎️ Concierge      Carol Davis                      │  ║
║  │  📋 Case Manager   Dan Martinez                     │  ║
║  └─────────────────────────────────────────────────────┘  ║
║                                                            ║
║  ┌─────────────────────────────────────────────────────┐  ║
║  │ St. Claire Medical Center                           │  ║
║  ├─────────────────────────────────────────────────────┤  ║
║  │  🧑‍⚕️ Patient       Eve Thompson                     │  ║
║  │  🛎️ Concierge      Frank Lee                        │  ║
║  │  📋 Case Manager   Grace Kim                        │  ║
║  └─────────────────────────────────────────────────────┘  ║
║                                                            ║
║  ┌─────────────────────────────────────────────────────┐  ║
║  │ Harbor Medical Center                                │  ║
║  ├─────────────────────────────────────────────────────┤  ║
║  │  🧑‍⚕️ Patient       Henry Park                       │  ║
║  │  🛎️ Concierge      Isabel Chen                      │  ║
║  │  📋 Case Manager   Jack O'Brien                     │  ║
║  └─────────────────────────────────────────────────────┘  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

**Interaction:**
- Clicking any persona navigates to `/?persona={slug}#role` (e.g., `/?persona=mercy-patient#patient`)
- Each persona tile is a **single button** with icon, role, and name
- Mobile-responsive grid (stacks vertically on narrow screens)
- Visually distinct cards per tenant (color-coded borders? tenant logo placeholder?)

**When to show:**
- On page load, if `window.location.search` has no `persona=` param
- Optionally: add a "Change Persona" link in the header that navigates back to `/` (clearing params)

### 2. Persona Indicator (Context Badge)

When a persona is active, display a **floating context badge** in the top-right corner of the app (above/beside the header):

```
┌──────────────────────────────────────┐
│ 🏥 Mercy General                     │
│ 🧑‍⚕️ Alice Johnson (Patient)          │
│ [Switch Persona]                     │
└──────────────────────────────────────┘
```

**Details:**
- **Always visible** (unless on the picker page)
- Compact on mobile (icon + abbreviated name?)
- "Switch Persona" button navigates back to `/` for re-selection
- CSS positioned as a fixed element (top-right, non-intrusive)

### 3. Bookmarkable URLs for Presenters

Presenters can pre-load browser tabs with bookmarkable links:

- **Tab 1:** Mercy General Patient → `/?persona=mercy-patient#patient`
- **Tab 2:** St. Claire Concierge → `/?persona=stclaire-concierge#concierge`
- **Tab 3:** Harbor Case Manager → `/?persona=harbor-casemanager#casemanager`

Simply switching tabs during the demo instantly shows the persona's view. **No clicks required.**

### 4. Switching Personas Without Reloading

**Optional enhancement (v2):**
- If the presenter clicks "Switch Persona" or changes the URL query param, the app **updates localStorage and re-renders** without a full page reload
- Hash changes already trigger re-renders (existing `hashchange` listener in `app.js`)
- Query param changes can be detected via `popstate` or manual URL monitoring

**v1 approach (simpler):** Full page reload on persona change (acceptable for demos). Clicking "Switch Persona" navigates to `/`, which reloads the picker.

---

## Implementation Approach

### Frontend-Only (No Backend Changes)

**Key insight:** The backend already accepts `X-Tenant-Id`, `X-User-Id`, `X-User-Role` headers from the frontend. We just need to:
1. Parse the `?persona=` query param on page load
2. Look up the persona in a hardcoded registry
3. Call `Auth.set({ tenantId, userId, role })` before rendering the app
4. Optionally inject a persona badge and picker UI

**No backend changes required.** The API doesn't care how the frontend determines which headers to send.

### File Changes

#### New Files (Linus to create)

1. **`src/frontend/js/personas.js`**
   - Exports a `PERSONAS` registry object mapping slugs → `{ tenantId, userId, role, displayName, tenantName }`
   - Example structure:
     ```js
     const PERSONAS = {
       'mercy-patient': {
         slug: 'mercy-patient',
         tenantId: 'A0000000-0000-0000-0000-000000000001',
         tenantName: 'Mercy General Hospital',
         userId: '10000000-0000-0000-0000-000000000001',
         role: 'patient',
         displayName: 'Alice Johnson',
       },
       // ... 8 more entries
     };
     ```
   - Helper function: `getPersonaFromUrl()` → parses `window.location.search` and returns persona object or `null`

2. **`src/frontend/js/views/picker.js`**
   - IIFE module: `PickerView`
   - `render(container)` method builds the persona picker UI (3 tenant cards, 3 buttons each)
   - Each button navigates to `/?persona={slug}#{role}`

3. **`src/frontend/public/picker.html`** (optional)
   - Dedicated landing page for the picker view
   - OR: reuse `index.html` and render the picker view into `#app` (simpler)

4. **`src/frontend/css/picker.css`** (optional)
   - Styles for persona cards, tenant groupings, button tiles
   - OR: add to `styles.css` (simpler)

5. **`src/frontend/js/components/persona-badge.js`** (optional)
   - IIFE module: `PersonaBadge`
   - `render()` injects a fixed-position badge showing current tenant + user + role
   - `PersonaBadge.update(persona)` refreshes the badge text
   - OR: inline in `app.js` (simpler)

#### Modified Files (Linus to edit)

1. **`src/frontend/js/app.js`**
   - **On init:** Call `getPersonaFromUrl()`. If a persona is found, call `Auth.set(persona)`.
   - **Routing logic:** If no persona param, check if we should show the picker (new logic).
   - **Picker integration:** If `window.location.search === ''` and `window.location.hash === ''`, render `PickerView` instead of the default patient view.
   - **Badge integration:** After setting persona, render the `PersonaBadge` (if implemented).

2. **`src/frontend/js/auth.js`**
   - **Minor change:** Ensure `Auth.set()` accepts the full persona object (already supports `{ tenantId, userId, role }`).
   - **No breaking changes:** Existing code continues to work.

3. **`src/frontend/public/index.html`**
   - **Add script tags:**
     ```html
     <script src="../js/personas.js"></script>
     <script src="../js/views/picker.js"></script>
     <!-- optional: persona-badge.js -->
     ```
   - **Optional:** Add a "Switch Persona" link/button in the header (could be dynamically injected by `PersonaBadge`).

#### Backend Changes (Basher)

1. **`db/seed/demo-data.sql`**
   - **Add Tenant #3:** Harbor Medical Center
     ```sql
     ('C0000000-0000-0000-0000-000000000003', 'Harbor Medical Center')
     ```
   - **Add 3 users for Harbor:**
     ```sql
     ('30000000-0000-0000-0000-000000000001', 'C0000000-0000-0000-0000-000000000003', 'Henry Park', 'patient'),
     ('30000000-0000-0000-0000-000000000002', 'C0000000-0000-0000-0000-000000000003', 'Isabel Chen', 'concierge'),
     ('30000000-0000-0000-0000-000000000003', 'C0000000-0000-0000-0000-000000000003', 'Jack O'Brien', 'case_manager')
     ```
   - **Add sample requests for Harbor** (optional, for realism):
     - 1-2 requests from Henry Park (patient)

**No API changes.** The existing endpoints already accept tenant/user/role headers.

---

## Alignment with Seed Data

### Existing Tenants (from `demo-data.sql`)

✅ **Tenant 1:** Mercy General Hospital (`A0000000-0000-0000-0000-000000000001`)
- Alice Johnson (patient)
- Bob Williams (patient) — not a demo persona, but exists
- Carol Davis (concierge)
- Dan Martinez (case_manager)

✅ **Tenant 2:** St. Claire Medical Center (`B0000000-0000-0000-0000-000000000002`)
- Eve Thompson (patient)
- Frank Lee (concierge)
- Grace Kim (case_manager)

### To Be Added

❌ **Tenant 3:** Harbor Medical Center (`C0000000-0000-0000-0000-000000000003`)
- Henry Park (patient)
- Isabel Chen (concierge)
- Jack O'Brien (case_manager)

**Recommendation:** Use sequential GUID patterns for Harbor:
- Tenant ID: `C0000000-0000-0000-0000-000000000003`
- User IDs: `30000000-0000-0000-0000-00000000000{1,2,3}`
- Request IDs: `E0000000-0000-0000-0000-00000000000{1,2,...}` (if seeding sample requests)

This matches the existing pattern (`A0000...` → Mercy, `B0000...` → St. Claire, `C0000...` → Harbor).

---

## Security Considerations

**CRITICAL:** This is a **demo-only pattern**. The `?persona=` query param and frontend persona registry are **NOT SECURE** and must never be used in production.

**Guardrails:**
1. **Document prominently** (README, code comments) that this is demo auth only
2. **Environment gating (optional):** Add a `DEMO_MODE` flag to `src/api/middleware/auth.js`. If `false`, reject all requests with `X-Tenant-Id` headers (force real auth). Default to `true` for POC.
3. **Visual indicator:** The persona badge should include a "DEMO MODE" label or banner to remind stakeholders this is not production-ready auth.

**Production migration path:**
- Replace query param picker with OAuth/MSAL login
- Remove `personas.js` registry
- Backend validates tokens instead of trusting headers
- Frontend calls `/api/auth/me` to fetch tenant/user/role instead of setting them locally

---

## Trade-Offs & Alternatives Considered

### Alternative 1: Path-Based Routing (`/mercy/patient`)

**Example:** `/{tenant}/{role}` → `/mercy/patient`, `/stclaire/concierge`

**Pros:**
- Clean, human-readable URLs
- RESTful feel

**Cons:**
- **Conflicts with existing hash routing.** The app uses `#patient`, `#concierge`, `#casemanager` for view switching. Adding path-based tenant/role routing would require:
  - Express.js server-side routing (can't serve static files anymore)
  - OR complex client-side path parsing and history API
- **Hash-based routing would still be needed** for role views within a tenant
- **More invasive changes** to `app.js` routing logic
- **Breaks backward compatibility** with the current URL scheme

**Decision:** ❌ Rejected. Query params preserve the existing hash router.

### Alternative 2: Hash-Based Persona (`#mercy-patient`)

**Example:** `/#mercy-patient` or `/#mercy/patient`

**Pros:**
- No query param parsing
- Works with static file serving

**Cons:**
- **Conflicts with existing view routing.** Currently, `#patient` means "show the patient view". Using `#mercy-patient` is ambiguous — is `mercy-patient` a view or a persona+view combo?
- **Can't compose persona + view separately.** Query params allow `?persona=mercy-patient#concierge` (show concierge view as a patient user for testing). Hash-only routing would make this awkward.
- **Less bookmarkable** — hash state is less standardized than query params for multi-param state

**Decision:** ❌ Rejected. Query params are more composable.

### Alternative 3: LocalStorage-Only (No URL State)

**Example:** User sets persona via a dropdown widget; it's saved to localStorage; URLs stay clean (`/#patient`).

**Pros:**
- Clean URLs
- Simple implementation

**Cons:**
- **Not bookmarkable.** Presenters can't pre-load tabs with personas.
- **Not shareable.** Can't send a link to a colleague saying "open this as the Mercy General patient."
- **Harder to debug.** If a presenter's demo is broken, we can't inspect the URL to see which persona is active.

**Decision:** ❌ Rejected. Bookmarkability is critical for demos.

### Alternative 4: Dedicated Picker Subdomain (`picker.medrequest.com`)

**Example:** Host the persona picker at a separate URL; clicking a persona redirects to the app with query params.

**Pros:**
- Clean separation of "demo setup" vs "app"

**Cons:**
- **Infrastructure overhead** (extra App Service or static site)
- **Subdomain setup** (DNS, SSL certs)
- **Overkill for a POC**

**Decision:** ❌ Rejected. Single-domain solution is simpler.

---

## Open Questions

1. **Should the persona badge be dismissible?**
   - Pro: Cleaner UI during demos if the presenter wants to hide it.
   - Con: Easy to forget which persona is active.
   - **Recommendation:** Not dismissible. Always visible for clarity.

2. **Should we log persona switches in the backend?**
   - Pro: Useful for demo analytics (which personas are used most?)
   - Con: Adds backend work; requires a logging endpoint.
   - **Recommendation:** Defer to v2. Not critical for POC.

3. **Should the picker page replace the default landing behavior, or be opt-in?**
   - Option A: Always show picker if no persona is set (new default)
   - Option B: Show picker only if you navigate to `/?picker` or `/picker.html`
   - **Recommendation:** Option A. Better first-run experience.

4. **Should we allow custom personas via URL?**
   - Example: `/?tenantId=X&userId=Y&role=Z` (freeform, not in the registry)
   - Pro: Flexibility for advanced testing
   - Con: Bypasses the "9 curated personas" UX; error-prone
   - **Recommendation:** No. Keep it constrained to the registry for demo quality.

---

## Implementation Notes

### For Linus (Frontend Lead)

**Phase 1: Core Persona Switching (MVP)**
1. Create `personas.js` with the 9-persona registry
2. Add `getPersonaFromUrl()` helper to parse `?persona=` query param
3. Update `app.js` init to call `Auth.set()` if a persona is detected
4. **Test:** Navigate to `/?persona=mercy-patient#patient` and verify `X-Tenant-Id`, `X-User-Id`, `X-User-Role` headers are set correctly (inspect via DevTools network tab)

**Phase 2: Picker UI**
1. Create `PickerView.render()` module
2. Update `app.js` routing: if no persona param and no hash, render `PickerView`
3. Style the picker (3 tenant cards, 9 buttons total)
4. **Test:** Navigate to `/` and verify the picker appears; click a persona and verify it navigates to the correct URL

**Phase 3: Persona Badge**
1. Create `PersonaBadge` module (or inline in `app.js`)
2. Inject badge into DOM on app init (if persona is active)
3. Add "Switch Persona" button that navigates to `/`
4. Style as a fixed top-right element
5. **Test:** Load `/?persona=stclaire-concierge#concierge` and verify the badge shows "St. Claire Medical Center | Frank Lee (Concierge)"

**Phase 4: Polish**
- Mobile-responsive picker grid
- Tenant color-coding or icons
- Badge compact view on mobile
- Accessibility: ARIA labels, keyboard navigation

**Dependencies:**
- Basher must seed Harbor Medical Center (Tenant #3) before testing `harbor-*` personas
- No API changes needed

### For Basher (Backend Lead)

**Task:** Add Tenant #3 to `db/seed/demo-data.sql`

**Details:**
1. Add Harbor Medical Center tenant:
   ```sql
   ('C0000000-0000-0000-0000-000000000003', 'Harbor Medical Center')
   ```

2. Add 3 users:
   ```sql
   ('30000000-0000-0000-0000-000000000001', 'C0000000-0000-0000-0000-000000000003', 'Henry Park', 'patient'),
   ('30000000-0000-0000-0000-000000000002', 'C0000000-0000-0000-0000-000000000003', 'Isabel Chen', 'concierge'),
   ('30000000-0000-0000-0000-000000000003', 'C0000000-0000-0000-0000-000000000003', 'Jack O'Brien', 'case_manager')
   ```

3. (Optional) Add 1-2 sample requests from Henry Park for realism

**No other backend changes needed.** The API already handles tenant/user/role headers.

---

## Success Criteria

✅ **Presenter can:**
1. Open `/` and see a visual persona picker
2. Click any of 9 personas and land on the correct view with correct headers
3. Bookmark 3 URLs (one per tenant) and switch between them via browser tabs
4. See a persistent badge showing current tenant + user + role
5. Click "Switch Persona" to return to the picker

✅ **App behavior:**
1. Requests are filtered by tenant (RLS enforced by backend)
2. Patient view shows only that patient's requests
3. Concierge/Case Manager views show all tenant requests (existing API behavior)
4. No authentication prompts or popups

✅ **Code quality:**
1. No breaking changes to existing app behavior (backward compatible)
2. Frontend-only implementation (no API changes)
3. Seed data includes all 9 personas
4. Mobile-responsive UI

---

## Timeline Estimate

**Linus (Frontend):**
- Phase 1: 2-3 hours (personas.js, URL parsing, Auth.set integration)
- Phase 2: 2-3 hours (picker UI, routing logic)
- Phase 3: 1-2 hours (badge component)
- Phase 4: 1-2 hours (polish, mobile, accessibility)
- **Total:** ~6-10 hours

**Basher (Backend):**
- Add Tenant #3 to seed data: 0.5 hours
- Test multi-tenant RLS with 3 tenants: 0.5 hours
- **Total:** ~1 hour

**Integration Testing:**
- Linus + Basher pair on smoke testing: 1 hour

**Grand Total:** ~8-12 hours (1-1.5 days)

---

## Conclusion

**Recommended:** Use **query parameter-based persona switching** (`?persona={slug}#{view}`) with a **visual picker landing page** and a **persistent persona badge**. This approach:
- ✅ Preserves the existing hash-based routing
- ✅ Enables bookmarkable URLs for presenter convenience
- ✅ Requires no backend changes (frontend-only)
- ✅ Provides clear visual context during demos
- ✅ Supports 9 curated personas across 3 hospital tenants

**Next Steps:**
1. **Rusty:** Review and approve this design (or request revisions)
2. **Basher:** Add Harbor Medical Center to seed data (`db/seed/demo-data.sql`)
3. **Linus:** Implement phases 1-4 as outlined above
4. **Team:** Integrate and smoke test with all 9 personas

**Risks:**
- Low. This is an additive feature with no breaking changes. Worst case: the picker doesn't work and we fall back to the existing manual role-switching behavior.

---

**Appendix: Persona Registry (Reference)**

| Persona Slug | Tenant | Display Name | Role | Tenant ID | User ID |
|-------------|--------|-------------|------|-----------|---------|
| `mercy-patient` | Mercy General | Alice Johnson | patient | `A0000000-0000-0000-0000-000000000001` | `10000000-0000-0000-0000-000000000001` |
| `mercy-concierge` | Mercy General | Carol Davis | concierge | `A0000000-0000-0000-0000-000000000001` | `10000000-0000-0000-0000-000000000003` |
| `mercy-casemanager` | Mercy General | Dan Martinez | case_manager | `A0000000-0000-0000-0000-000000000001` | `10000000-0000-0000-0000-000000000004` |
| `stclaire-patient` | St. Claire | Eve Thompson | patient | `B0000000-0000-0000-0000-000000000002` | `20000000-0000-0000-0000-000000000001` |
| `stclaire-concierge` | St. Claire | Frank Lee | concierge | `B0000000-0000-0000-0000-000000000002` | `20000000-0000-0000-0000-000000000002` |
| `stclaire-casemanager` | St. Claire | Grace Kim | case_manager | `B0000000-0000-0000-0000-000000000002` | `20000000-0000-0000-0000-000000000003` |
| `harbor-patient` | Harbor Medical | Henry Park | patient | `C0000000-0000-0000-0000-000000000003` | `30000000-0000-0000-0000-000000000001` |
| `harbor-concierge` | Harbor Medical | Isabel Chen | concierge | `C0000000-0000-0000-0000-000000000003` | `30000000-0000-0000-0000-000000000002` |
| `harbor-casemanager` | Harbor Medical | Jack O'Brien | case_manager | `C0000000-0000-0000-0000-000000000003` | `30000000-0000-0000-0000-000000000003` |
