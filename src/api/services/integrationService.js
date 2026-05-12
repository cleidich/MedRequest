'use strict';

/**
 * Outbound integration service — scaffold.
 *
 * Stub functions representing future integrations with EMR systems,
 * communications platforms, and business office workflows.
 * Each function logs intent and returns a mock response for demo purposes.
 */

/**
 * Forward a request to the EMR system.
 * @param {object} request - The request record
 * @returns {Promise<object>} Mock EMR response
 */
async function forwardToEmr(request) {
  console.log(`[Integration] Would forward request ${request.id} to EMR system`);
  return {
    success: true,
    destination: 'emr',
    requestId: request.id,
    message: 'EMR integration not yet implemented — stub response',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Send a notification via the communications system.
 * @param {object} params - { requestId, recipientId, channel }
 * @returns {Promise<object>} Mock notification response
 */
async function sendNotification({ requestId, recipientId, channel }) {
  console.log(`[Integration] Would notify ${recipientId} via ${channel} for request ${requestId}`);
  return {
    success: true,
    destination: 'communications',
    channel: channel || 'in-app',
    requestId,
    recipientId,
    message: 'Communications integration not yet implemented — stub response',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Forward a request to the business office.
 * @param {object} request - The request record
 * @returns {Promise<object>} Mock business office response
 */
async function forwardToBusinessOffice(request) {
  console.log(`[Integration] Would forward request ${request.id} to business office`);
  return {
    success: true,
    destination: 'business_office',
    requestId: request.id,
    message: 'Business office integration not yet implemented — stub response',
    timestamp: new Date().toISOString(),
  };
}

module.exports = { forwardToEmr, sendNotification, forwardToBusinessOffice };
