'use strict';

/**
 * APIM Gateway validation middleware.
 *
 * Ensures API requests came through the APIM gateway by validating
 * the X-Gateway-Key header against the GATEWAY_SECRET environment variable.
 *
 * - If GATEWAY_SECRET is not set (local dev) → allows request (fail-open)
 * - If header matches secret → allows request
 * - Otherwise → returns 403 forbidden
 */
function gatewayAuth(req, res, next) {
  const gatewaySecret = process.env.GATEWAY_SECRET;

  // Fail-open: allow requests if GATEWAY_SECRET is not configured (local dev)
  if (!gatewaySecret) {
    return next();
  }

  const headerValue = req.headers['x-gateway-key'];

  // Validate the gateway key header
  if (!headerValue || headerValue !== gatewaySecret) {
    return res.status(403).json({
      error: 'Direct access not permitted. Use the API gateway.',
    });
  }

  next();
}

module.exports = gatewayAuth;
