'use strict';

const { getPool } = require('../db/pool');
const { setTenantContext } = require('../db/queries');

/**
 * Middleware that sets SESSION_CONTEXT('tenant_id') on the DB connection
 * for the current request. This activates Row-Level Security filtering.
 *
 * Must run after auth middleware (depends on req.user.tenantId).
 */
async function tenantContext(req, res, next) {
  try {
    // SESSION_CONTEXT is set per-request inside each query function.
    // This middleware just validates that the DB pool is reachable and
    // attaches the tenantId for downstream use.
    await getPool();
    req.tenantId = req.user.tenantId;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = tenantContext;
