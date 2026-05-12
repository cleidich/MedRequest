'use strict';

/**
 * ============================================================================
 * DEBUG / DEMO ENDPOINT — SQL Explorer for Row-Level Security demonstration
 * ============================================================================
 *
 * ⚠️  DEMO ONLY — Not for production use.
 *
 * This endpoint lets the frontend run pre-defined (allowlisted) SQL queries
 * against the database through the SAME auth + tenant context middleware as
 * every other API route. Because SESSION_CONTEXT is set before the query
 * executes, RLS transparently filters results to the authenticated tenant.
 *
 * The response includes the raw SQL text so the presenter can show:
 *   "Here's the query — it touches the FULL table — but RLS only returned
 *    YOUR tenant's data."
 */

const express = require('express');
const { getPool } = require('../db/pool');
const { setTenantContext } = require('../db/queries');

const router = express.Router();

// ---------------------------------------------------------------------------
// Query allowlist — only these named queries can be executed
// ---------------------------------------------------------------------------
const QUERY_CATALOG = {
  my_requests: {
    sql: 'SELECT id, subject, type, status, created_at FROM requests',
    rlsNote:
      'This query selects from the full requests table with no WHERE clause, but Row-Level Security filtered results to only show {tenantName} data.',
  },

  all_users: {
    sql: 'SELECT id, name, role FROM users',
    rlsNote:
      'This query selects every user in the system, but RLS ensures only {tenantName} users are returned.',
  },

  request_count: {
    sql: 'SELECT COUNT(*) AS total FROM requests',
    rlsNote:
      'A simple COUNT(*) over the entire requests table — RLS makes the count tenant-specific without any WHERE clause.',
  },

  tenant_info: {
    sql: "SELECT id, name FROM tenants WHERE id = @tenantId",
    useTenantParam: true,
    rlsNote:
      'This query looks up the current tenant by ID. The tenants table is not RLS-protected, so the parameter filter is explicit.',
  },

  cross_tenant_proof: {
    sql: `SELECT t.name AS tenant_name, COUNT(r.id) AS request_count
FROM requests r
JOIN tenants t ON r.tenant_id = t.id
GROUP BY t.name`,
    rlsNote:
      'This query JOINs requests to tenants and groups by tenant name — attempting to see ALL tenants. RLS ensures only {tenantName} data appears in the result.',
  },
};

// ---------------------------------------------------------------------------
// POST /api/debug/explore
// ---------------------------------------------------------------------------
router.post('/explore', async (req, res, next) => {
  try {
    const { queryKey } = req.body || {};

    if (!queryKey) {
      return res.status(400).json({
        error: 'Missing required field: queryKey',
        availableKeys: Object.keys(QUERY_CATALOG),
      });
    }

    const entry = QUERY_CATALOG[queryKey];
    if (!entry) {
      return res.status(400).json({
        error: `Unknown queryKey: "${queryKey}"`,
        availableKeys: Object.keys(QUERY_CATALOG),
      });
    }

    const tenantId = req.tenantId;

    // Acquire a connection and set tenant context — the same flow every
    // other endpoint uses, which is what makes this demo meaningful.
    const pool = await getPool();
    const request = pool.request();
    await setTenantContext(request, tenantId);

    // Bind the tenant param if the query needs it
    if (entry.useTenantParam) {
      const sql = require('mssql');
      request.input('tenantId', sql.UniqueIdentifier, tenantId);
    }

    const result = await request.query(entry.sql);
    const rows = result.recordset;

    // Resolve tenant name for the rlsNote (best-effort)
    let tenantName = tenantId;
    try {
      const nameReq = pool.request();
      await setTenantContext(nameReq, tenantId);
      const sql = require('mssql');
      nameReq.input('tid', sql.UniqueIdentifier, tenantId);
      const nameResult = await nameReq.query(
        'SELECT name FROM tenants WHERE id = @tid'
      );
      if (nameResult.recordset.length > 0) {
        tenantName = nameResult.recordset[0].name;
      }
    } catch (_) {
      // non-critical — fall back to raw tenant ID in the note
    }

    res.json({
      queryKey,
      sql: entry.sql,
      tenantId,
      rowCount: rows.length,
      rows,
      rlsNote: entry.rlsNote.replace(/\{tenantName\}/g, tenantName),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
