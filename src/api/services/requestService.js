'use strict';

const queries = require('../db/queries');

// Map user-friendly form types to internal API types.
// The patient form sends comfort/service/staff; the DB stores feedback/concierge/case_manager.
const TYPE_MAP = {
  comfort: 'feedback',
  service: 'concierge',
  staff:   'case_manager',
};

const VALID_TYPES    = ['feedback', 'concierge', 'case_manager'];
const VALID_STATUSES = ['new', 'acknowledged', 'in_progress', 'resolved', 'forwarded', 'closed'];

/**
 * Normalize a request type — accepts both form-friendly and internal names.
 * @param {string} type
 * @returns {string} Internal type name
 */
function normalizeType(type) {
  if (!type) return type;
  const mapped = TYPE_MAP[type.toLowerCase()];
  return mapped || type;
}

/**
 * Create a new patient request.
 * @param {object} params - { tenantId, patientId, type, subject, body }
 * @returns {Promise<object>} Created request record
 * @throws {Error} On validation failure
 */
async function createRequest({ tenantId, patientId, type, subject, body }) {
  type = normalizeType(type);

  if (!VALID_TYPES.includes(type)) {
    const err = new Error(`Invalid request type. Must be one of: ${VALID_TYPES.join(', ')} (or: ${Object.keys(TYPE_MAP).join(', ')})`);
    err.statusCode = 400;
    err.expose = true;
    throw err;
  }

  if (!subject || subject.trim().length === 0) {
    const err = new Error('Subject is required');
    err.statusCode = 400;
    err.expose = true;
    throw err;
  }

  return queries.createRequest({ tenantId, patientId, type, subject, body });
}

/**
 * List requests for the current tenant.
 * @param {string} tenantId
 * @param {object} [filters] - { status, patientId }
 * @returns {Promise<object[]>}
 */
async function listRequests(tenantId, filters = {}) {
  if (filters.status && !VALID_STATUSES.includes(filters.status)) {
    const err = new Error(`Invalid status filter. Must be one of: ${VALID_STATUSES.join(', ')}`);
    err.statusCode = 400;
    err.expose = true;
    throw err;
  }

  return queries.getRequests(tenantId, filters);
}

/**
 * Get a single request by ID.
 * @param {string} tenantId
 * @param {string} requestId
 * @returns {Promise<object>}
 * @throws {Error} If not found
 */
async function getRequest(tenantId, requestId) {
  const record = await queries.getRequestById(tenantId, requestId);
  if (!record) {
    const err = new Error('Request not found');
    err.statusCode = 404;
    err.expose = true;
    throw err;
  }
  return record;
}

/**
 * Update request status.
 * @param {string} tenantId
 * @param {string} requestId
 * @param {string} status
 * @returns {Promise<object>}
 * @throws {Error} If not found or invalid status
 */
async function updateStatus(tenantId, requestId, status) {
  if (!VALID_STATUSES.includes(status)) {
    const err = new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    err.statusCode = 400;
    err.expose = true;
    throw err;
  }

  const record = await queries.updateRequestStatus(tenantId, requestId, status);
  if (!record) {
    const err = new Error('Request not found');
    err.statusCode = 404;
    err.expose = true;
    throw err;
  }
  return record;
}

module.exports = { createRequest, listRequests, getRequest, updateStatus };
