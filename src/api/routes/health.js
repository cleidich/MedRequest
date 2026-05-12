'use strict';

const { Router } = require('express');
const { getPool } = require('../db/pool');

const router = Router();

/**
 * GET /api/health — Liveness probe.
 * Returns 200 if the process is running.
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/ready — Readiness probe.
 * Returns 200 only if the database connection is healthy.
 */
router.get('/ready', async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({
      status: 'unavailable',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
