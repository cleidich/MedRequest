'use strict';

const fs   = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../db/migrations');

/**
 * Split a SQL script on GO batch separators.
 * GO must appear on its own line (optionally with whitespace).
 */
function splitBatches(sql) {
  return sql
    .split(/^\s*GO\s*$/im)
    .map(b => b.trim())
    .filter(b => b.length > 0);
}

/**
 * Ensure the _migrations tracking table exists.
 */
async function ensureMigrationsTable(pool) {
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = '_migrations'
    )
    CREATE TABLE dbo._migrations (
      id         INT IDENTITY(1,1) PRIMARY KEY,
      filename   NVARCHAR(255)  NOT NULL UNIQUE,
      applied_at DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
    );
  `);
}

/**
 * Run all pending migrations from db/migrations/ against the given pool.
 * @param {import('mssql').ConnectionPool} pool
 */
async function runMigrations(pool) {
  await ensureMigrationsTable(pool);

  // Determine which migrations have already been applied
  const result = await pool.request().query(
    'SELECT filename FROM dbo._migrations ORDER BY id'
  );
  const applied = new Set(result.recordset.map(r => r.filename));

  // Read migration files, sorted alphabetically
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] Already applied: ${file}`);
      continue;
    }

    console.log(`[migrate] Applying ${file}...`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const batches = splitBatches(sql);

    for (const batch of batches) {
      await pool.request().query(batch);
    }

    // Record the migration
    await pool.request()
      .input('filename', file)
      .query('INSERT INTO dbo._migrations (filename) VALUES (@filename)');

    console.log(`[migrate] Applied: ${file}`);
  }

  console.log('[migrate] All migrations up to date');
}

module.exports = { runMigrations };
