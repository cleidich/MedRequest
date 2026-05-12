# Decision: Frontend Scaffold — Vanilla JS IIFE Pattern

- **ID:** `frontend-scaffold-001`
- **Author:** Linus
- **Date:** 2025-07-14
- **Status:** Implemented
- **Scope:** Frontend Architecture

## Decision
Used IIFE module pattern (no ES modules, no bundler) for all frontend JS. Each module (`Auth`, `Api`, `PatientView`, `ConciergeView`, `CaseManagerView`, `App`) is a self-contained global, loaded via `<script>` tags in dependency order.

## Rationale
- Zero build step — just serve static files
- Simple for a POC; easy for stakeholders to inspect
- Hash-based routing avoids server-side routing config
- Role switching auto-updates auth headers (localStorage-backed)

## API Contract Assumptions
- `POST /api/requests` — create request `{ type, subject, body }`
- `GET /api/requests?status=X` — list requests (filtered by auth headers for tenant/user)
- `PATCH /api/requests/:id` — update `{ status, forwarded_to }`
- Auth headers: `X-Tenant-Id`, `X-User-Id`, `X-User-Role`

Basher should confirm these endpoints align with the Express API routes.

## Impact
All frontend code lives under `src/frontend/`. No framework dependencies. CSS is mobile-first with 600px/900px breakpoints.
