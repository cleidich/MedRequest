'use strict';

const express = require('express');
const path    = require('path');
const cors    = require('cors');
const helmet  = require('helmet');
const config  = require('./config');
const auth    = require('./middleware/auth');
const tenantContext  = require('./middleware/tenantContext');
const errorHandler   = require('./middleware/errorHandler');
const healthRoutes   = require('./routes/health');
const requestRoutes  = require('./routes/requests');
const integrationRoutes = require('./routes/integration');
const debugRoutes       = require('./routes/debug');
const configRoutes      = require('./routes/config');
const proxyRoutes       = require('./routes/proxy');
const { closePool }  = require('./db/pool');

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
app.use('/api/requests',    auth, tenantContext, requestRoutes);
app.use('/api/integration', auth, tenantContext, integrationRoutes);
app.use('/api/debug',       auth, tenantContext, debugRoutes);

// ---------------------------------------------------------------------------
// Static frontend files (served from public/ directory)
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// Error handler (must be last)
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const server = app.listen(config.port, () => {
  console.log(`[MedRequest API] Listening on port ${config.port}`);
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n[MedRequest API] Received ${signal}, shutting down...`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = app;
