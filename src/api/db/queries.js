'use strict';

const { getPool, sql } = require('./pool');

/**
 * Set SESSION_CONTEXT for the current connection so RLS filters by tenant.
 * Must be called on each request's DB connection/transaction.
 * @param {import('mssql').Request} request - mssql Request object
 * @param {string} tenantId - Tenant UUID
 */
async function setTenantContext(request, tenantId) {
  await request.query(
    `EXEC sp_set_session_context @key = N'tenant_id', @value = '${tenantId}', @read_only = 1`
  );
  // Note: sp_set_session_context does not support parameterized @value for the
  // session value itself, but tenant_id is validated as a UUID in middleware
  // before reaching here.
}

/**
 * Create a new patient request.
 * @param {object} data - { tenantId, patientId, type, subject, body }
 * @returns {Promise<object>} The created request record
 */
async function createRequest({ tenantId, patientId, type, subject, body }) {
  const pool = await getPool();
  const request = pool.request();

  await setTenantContext(request, tenantId);

  const result = await request
    .input('tenant_id',  sql.UniqueIdentifier, tenantId)
    .input('patient_id', sql.UniqueIdentifier, patientId)
    .input('type',       sql.NVarChar(20),     type)
    .input('subject',    sql.NVarChar(500),    subject)
    .input('body',       sql.NVarChar(sql.MAX), body || null)
    .query(`
      INSERT INTO requests (tenant_id, patient_id, type, subject, body)
      OUTPUT INSERTED.*
      VALUES (@tenant_id, @patient_id, @type, @subject, @body)
    `);

  return result.recordset[0];
}

/**
 * Get all requests for the current tenant, with optional status filter.
 * @param {string} tenantId
 * @param {object} [filters] - { status, patientId }
 * @returns {Promise<object[]>}
 */
async function getRequests(tenantId, filters = {}) {
  const pool = await getPool();
  const request = pool.request();

  await setTenantContext(request, tenantId);

  let query = 'SELECT * FROM requests WHERE 1=1';

  if (filters.status) {
    request.input('status', sql.NVarChar(20), filters.status);
    query += ' AND status = @status';
  }

  if (filters.patientId) {
    request.input('patient_id', sql.UniqueIdentifier, filters.patientId);
    query += ' AND patient_id = @patient_id';
  }

  query += ' ORDER BY created_at DESC';

  const result = await request.query(query);
  return result.recordset;
}

/**
 * Get a single request by ID (tenant-scoped via RLS).
 * @param {string} tenantId
 * @param {string} requestId
 * @returns {Promise<object|null>}
 */
async function getRequestById(tenantId, requestId) {
  const pool = await getPool();
  const request = pool.request();

  await setTenantContext(request, tenantId);

  const result = await request
    .input('id', sql.UniqueIdentifier, requestId)
    .query('SELECT * FROM requests WHERE id = @id');

  return result.recordset[0] || null;
}

/**
 * Update a request's status.
 * @param {string} tenantId
 * @param {string} requestId
 * @param {string} status - new status value
 * @returns {Promise<object|null>} Updated record or null if not found
 */
async function updateRequestStatus(tenantId, requestId, status) {
  const pool = await getPool();
  const request = pool.request();

  await setTenantContext(request, tenantId);

  const result = await request
    .input('id',     sql.UniqueIdentifier, requestId)
    .input('status', sql.NVarChar(20),     status)
    .query(`
      UPDATE requests
      SET status = @status, updated_at = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE id = @id
    `);

  return result.recordset[0] || null;
}

/**
 * Pull requests for integration consumers.
 * Returns requests matching a status, optionally filtered by a "since" timestamp.
 * @param {string} tenantId
 * @param {object} filters - { status, since }
 * @returns {Promise<object[]>}
 */
async function getRequestsForIntegration(tenantId, { status, since }) {
  const pool = await getPool();
  const request = pool.request();

  await setTenantContext(request, tenantId);

  let query = 'SELECT * FROM requests WHERE 1=1';

  if (status) {
    request.input('status', sql.NVarChar(20), status);
    query += ' AND status = @status';
  }

  if (since) {
    request.input('since', sql.DateTime2, new Date(since));
    query += ' AND created_at >= @since';
  }

  query += ' ORDER BY created_at ASC';

  const result = await request.query(query);
  return result.recordset;
}

module.exports = {
  setTenantContext,
  createRequest,
  getRequests,
  getRequestById,
  updateRequestStatus,
  getRequestsForIntegration,
};
