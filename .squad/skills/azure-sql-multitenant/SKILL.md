---
name: "azure-sql-multitenant"
description: "Multi-tenant Azure SQL pattern using Row-Level Security with SESSION_CONTEXT for tenant isolation"
domain: "api-design, database, multi-tenant"
confidence: "high"
source: "manual"
---

## Context
When building multi-tenant apps on Azure SQL at POC/small scale, where separate databases or elastic pools are overkill.

## Patterns
1. Add `tenant_id` column to every tenant-scoped table.
2. Create a security policy with a filter predicate that reads `SESSION_CONTEXT('tenant_id')`.
3. In the API middleware, call `sp_set_session_context @key=N'tenant_id', @value=<id>` on each connection before executing queries.
4. Extract tenant ID from auth headers (or JWT claims in production).

## Examples
```sql
-- RLS setup
CREATE FUNCTION dbo.fn_tenant_filter(@tenant_id NVARCHAR(128))
RETURNS TABLE WITH SCHEMABINDING
AS RETURN SELECT 1 AS result WHERE @tenant_id = CAST(SESSION_CONTEXT(N'tenant_id') AS NVARCHAR(128));

CREATE SECURITY POLICY dbo.TenantPolicy
  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.Requests;
```

```javascript
// Middleware: set tenant context on each request
async function tenantContext(req, res, next) {
  const pool = await getPool();
  const request = pool.request();
  await request.query(`EXEC sp_set_session_context @key=N'tenant_id', @value='${req.tenantId}'`);
  req.dbRequest = request;
  next();
}
```

## Anti-Patterns
- Do NOT use string interpolation for tenant IDs in SQL — always use parameterized `sp_set_session_context`.
- Do NOT skip RLS for "admin" queries without a clear bypass mechanism.
- Avoid per-tenant connection pools at POC scale — one pool with session context is sufficient.
