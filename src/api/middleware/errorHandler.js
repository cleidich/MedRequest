'use strict';

/**
 * Centralized error-handling middleware.
 * Catches unhandled errors from route handlers and returns a consistent JSON response.
 */
function errorHandler(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const message = err.expose ? err.message : 'Internal server error';

  console.error(`[ERROR] ${req.method} ${req.originalUrl} — ${err.message}`);

  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
  });
}

module.exports = errorHandler;
