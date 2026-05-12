'use strict';

// UUID v4 format regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES = ['patient', 'concierge', 'case_manager'];

/**
 * Header-based authentication middleware (demo only).
 *
 * Reads X-Tenant-Id, X-User-Id, and X-User-Role from request headers,
 * validates format, and populates req.user.
 *
 * In production this would be replaced with OAuth / MSAL / JWT validation.
 */
function auth(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  const userId   = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];

  if (!tenantId || !userId || !userRole) {
    return res.status(401).json({
      error: 'Missing required auth headers: X-Tenant-Id, X-User-Id, X-User-Role',
    });
  }

  if (!UUID_RE.test(tenantId)) {
    return res.status(400).json({ error: 'X-Tenant-Id must be a valid UUID' });
  }

  if (!UUID_RE.test(userId)) {
    return res.status(400).json({ error: 'X-User-Id must be a valid UUID' });
  }

  if (!VALID_ROLES.includes(userRole)) {
    return res.status(400).json({
      error: `X-User-Role must be one of: ${VALID_ROLES.join(', ')}`,
    });
  }

  req.user = {
    tenantId,
    userId,
    role: userRole,
  };

  next();
}

module.exports = auth;
