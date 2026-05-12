### Decision: Backend API Gap Fixes for Demo Readiness
- **ID:** `api-gaps-001`
- **Author:** Basher
- **Date:** 2026-05-12
- **Status:** Implemented
- **Scope:** Backend API, Database Seed Data

**Decision:** Fixed four backend gaps blocking demo readiness:

1. **Request type mapping:** Added a normalization layer in `requestService.js` that maps patient-form types (`comfort`, `service`, `staff`) to internal DB types (`feedback`, `concierge`, `case_manager`) before validation. Both naming conventions are accepted.

2. **Integration endpoints wired:** Replaced stub integration service with real functions that validate request existence (with RLS), update status to `forwarded` in the database, and log actions. Added missing `POST /forward-business-office` route. Actual EMR/notification delivery remains mocked (POC scope).

3. **Harbor Medical seed data:** Added 2 additional sample requests (feedback, concierge) bringing Harbor Medical to 4 total — matching other tenants' data density for balanced demos.

4. **@read_only review confirmed:** Livingston's removal of `@read_only=1` from `sp_set_session_context` is correct and required. With connection pooling, `@read_only=1` prevents tenant context from being reset on reused connections, which would cause cross-tenant query failures. The per-query `setTenantContext()` call pattern provides sufficient isolation.

**Key Design Choice:** Integration endpoints use the existing `forwarded` status value (already in the DB CHECK constraint) rather than adding new values like `forwarded_emr`/`forwarded_business_office`. This avoids a schema migration. The destination is captured in the response payload and server logs.

**Impact:**
- **Linus:** Patient form can now submit with `comfort`/`service`/`staff` types — API will accept them
- **Rusty:** Integration API contract is now functional for APIM import
- **Livingston:** Harbor Medical seed data needs re-run (`db/seed/demo-data.sql`) — or just the new INSERT statements for the 2 additional requests
