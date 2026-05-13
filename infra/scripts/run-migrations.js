#!/usr/bin/env node
'use strict';

/**
 * Standalone migration runner for azd hooks.
 * Uses AAD token auth — no SQL password required.
 *
 * Env vars: SQL_SERVER, SQL_DATABASE (or DB_SERVER, DB_NAME)
 */

const { execSync } = require('child_process');
const path = require('path');
const sql  = require(path.resolve(__dirname, '../../src/api/node_modules/mssql'));

const { runMigrations } = require(path.resolve(__dirname, '../../src/api/db/migrate'));

const server   = process.env.SQL_SERVER  || process.env.DB_SERVER;
const database = process.env.SQL_DATABASE || process.env.DB_NAME;

if (!server || !database) {
  console.error('[run-migrations] Missing SQL_SERVER/DB_SERVER or SQL_DATABASE/DB_NAME env vars');
  process.exit(1);
}

async function getAadToken() {
  const raw = execSync(
    'az account get-access-token --resource https://database.windows.net/ --query accessToken -o tsv',
    { encoding: 'utf8', timeout: 30000 }
  );
  return raw.trim();
}

async function main() {
  console.log(`[run-migrations] Connecting to ${server}/${database}...`);
  const token = await getAadToken();

  const pool = await new sql.ConnectionPool({
    server,
    database,
    port: 1433,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
    authentication: {
      type: 'azure-active-directory-access-token',
      options: { token },
    },
  }).connect();

  try {
    await runMigrations(pool);
  } finally {
    await pool.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[run-migrations] Failed:', err.message);
    process.exit(1);
  });
