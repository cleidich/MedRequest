'use strict';

const queries = require('../db/queries');

/**
 * Outbound integration service.
 *
 * Routes requests to EMR, business office, and communications systems.
 * Actual delivery is mocked (POC), but routing, logging, and status updates
 * are real — requests are looked up, validated, and status-updated in the DB.
 */

/**
 * Forward a request to the EMR system.
 * Validates the request exists, updates its status to 'forwarded', and logs the action.
 * @param {string} tenantId
 * @param {string} requestId
 * @returns {Promise<object>}
 */
async function forwardToEmr(tenantId, requestId) {
  const request = await queries.getRequestById(tenantId, requestId);
  if (!request) {
    const err = new Error('Request not found');
    err.statusCode = 404;
    err.expose = true;
    throw err;
  }

  const updated = await queries.updateRequestStatus(tenantId, requestId, 'forwarded');
  console.log(`[Integration] Forwarded request ${requestId} to EMR system (tenant: ${tenantId})`);

  return {
    success: true,
    destination: 'emr',
    requestId: updated.id,
    previousStatus: request.status,
    currentStatus: updated.status,
    message: 'Request forwarded to EMR (delivery mocked for POC)',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Forward a request to the business office.
 * Validates the request exists, updates its status to 'forwarded', and logs the action.
 * @param {string} tenantId
 * @param {string} requestId
 * @returns {Promise<object>}
 */
async function forwardToBusinessOffice(tenantId, requestId) {
  const request = await queries.getRequestById(tenantId, requestId);
  if (!request) {
    const err = new Error('Request not found');
    err.statusCode = 404;
    err.expose = true;
    throw err;
  }

  const updated = await queries.updateRequestStatus(tenantId, requestId, 'forwarded');
  console.log(`[Integration] Forwarded request ${requestId} to business office (tenant: ${tenantId})`);

  return {
    success: true,
    destination: 'business_office',
    requestId: updated.id,
    previousStatus: request.status,
    currentStatus: updated.status,
    message: 'Request forwarded to business office (delivery mocked for POC)',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Send a notification for a request.
 * Validates the request exists, logs the notification action.
 * Actual notification delivery is mocked.
 * @param {string} tenantId
 * @param {string} requestId
 * @param {string} [message]
 * @returns {Promise<object>}
 */
async function sendNotification(tenantId, requestId, message) {
  const request = await queries.getRequestById(tenantId, requestId);
  if (!request) {
    const err = new Error('Request not found');
    err.statusCode = 404;
    err.expose = true;
    throw err;
  }

  console.log(`[Integration] Notification sent for request ${requestId} (tenant: ${tenantId}): ${message || '(no message)'}`);

  return {
    success: true,
    destination: 'notifications',
    requestId: request.id,
    message: message || null,
    note: 'Notification delivery mocked for POC',
    timestamp: new Date().toISOString(),
  };
}

module.exports = { forwardToEmr, sendNotification, forwardToBusinessOffice };
