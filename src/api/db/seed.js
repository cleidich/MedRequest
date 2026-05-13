'use strict';

const fs   = require('fs');
const path = require('path');

const SEED_FILE = path.resolve(__dirname, '../../../db/seed/demo-data.sql');

/**
 * Split a SQL script on GO batch separators.
 */
function splitBatches(sql) {
  return sql
    .split(/^\s*GO\s*$/im)
    .map(b => b.trim())
    .filter(b => b.length > 0);
}

/**
 * Seed demo data if the tenants table is empty (idempotent).
 * @param {import('mssql').ConnectionPool} pool
 */
async function runSeed(pool) {
  const result = await pool.request().query(
    'SELECT COUNT(*) AS cnt FROM dbo.tenants'
  );
  const count = result.recordset[0].cnt;

  if (count > 0) {
    console.log('[seed] Data already exists, skipping');
    return;
  }

  console.log('[seed] Seeding demo data...');
  const sql = fs.readFileSync(SEED_FILE, 'utf8');
  const batches = splitBatches(sql);

  for (const batch of batches) {
    await pool.request().query(batch);
  }

  console.log('[seed] Demo data seeded successfully');
}

module.exports = { runSeed };
