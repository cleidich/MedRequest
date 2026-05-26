'use strict';

const express = require('express');
const path    = require('path');
const cors    = require('cors');
const helmet  = require('helmet');
const config  = require('./config');
const auth    = require('./middleware/auth');
const gatewayAuth    = require('./middleware/gatewayAuth');
const tenantContext  = require('./middleware/tenantContext');
const errorHandler   = require('./middleware/errorHandler');
const healthRoutes   = require('./routes/health');
const requestRoutes  = require('./routes/requests');
const integrationRoutes = require('./routes/integration');
const debugRoutes       = require('./routes/debug');
const configRoutes      = require('./routes/config');
const proxyRoutes       = require('./routes/proxy');
const { getPool, closePool }  = require('./db/pool');
const { runMigrations }      = require('./db/migrate');
const { runSeed }            = require('./db/seed');

const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());

// ---------------------------------------------------------------------------
// Health probes (no auth required)
// ---------------------------------------------------------------------------
app.use('/api', healthRoutes);
app.use('/api/config', configRoutes);

// ---------------------------------------------------------------------------
// APIM proxy (handles auth forwarding internally, no middleware)
// ---------------------------------------------------------------------------
app.use('/api/proxy', proxyRoutes);

// ---------------------------------------------------------------------------
// Authenticated routes
// ---------------------------------------------------------------------------
app.use('/api/requests',    gatewayAuth, auth, tenantContext, requestRoutes);
app.use('/api/integration', gatewayAuth, auth, tenantContext, integrationRoutes);
app.use('/api/debug',       gatewayAuth, auth, tenantContext, debugRoutes);

// ---------------------------------------------------------------------------
// Static frontend files (served from public/ directory)
// No-cache for JS/CSS so deploys are picked up immediately (demo app)
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (/\.(js|css|html)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// Error handler (must be last)
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server (run migrations + seed first)
// ---------------------------------------------------------------------------
let server;

(async () => {
  try {
    const pool = await getPool();
    await runMigrations(pool);
    await runSeed(pool);
  } catch (err) {
    console.error('[startup] Migration/seed error (non-fatal):', err.message);
  }

  server = app.listen(config.port, () => {
    console.log(`[MedRequest API] Listening on port ${config.port}`);
  });
})();

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n[MedRequest API] Received ${signal}, shutting down...`);
  if (server) {
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  } else {
    await closePool();
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = app;
