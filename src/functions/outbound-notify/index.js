'use strict';

/**
 * Azure Function: outbound-notify (scaffold)
 *
 * HTTP-triggered stub that simulates notifying an EMR or communications
 * system about a new patient request. For demo purposes, it simply logs
 * the payload and returns a success response.
 */
module.exports = async function (context, req) {
  const requestId = (req.body && req.body.requestId) || 'unknown';

  context.log(`[outbound-notify] Would notify EMR for request: ${requestId}`);
  context.log('[outbound-notify] Payload:', JSON.stringify(req.body || {}));

  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      status: 'acknowledged',
      requestId,
      message: 'EMR notification stub — no external system called',
      timestamp: new Date().toISOString(),
    },
  };
};
