#!/usr/bin/env node
'use strict';

/**
 * Standalone seed runner for azd hooks.
 * Uses AAD token auth — no SQL password required.
 *
 * Env vars: SQL_SERVER, SQL_DATABASE (or DB_SERVER, DB_NAME)
 */

const { execSync } = require('child_process');
const path = require('path');
const sql  = require(path.resolve(__dirname, '../../src/api/node_modules/mssql'));

const { runSeed } = require(path.resolve(__dirname, '../../src/api/db/seed'));

const rawServer = process.env.SQL_SERVER  || process.env.DB_SERVER;
const database  = process.env.SQL_DATABASE || process.env.DB_NAME;

if (!rawServer || !database) {
  console.error('[run-seed] Missing SQL_SERVER/DB_SERVER or SQL_DATABASE/DB_NAME env vars');
  process.exit(1);
}

// Ensure FQDN — append .database.windows.net if not already present
const server = rawServer.includes('.') ? rawServer : `${rawServer}.database.windows.net`;

async function getAadToken() {
  const raw = execSync(
    'az account get-access-token --resource https://database.windows.net/ --query accessToken -o tsv',
    { encoding: 'utf8', timeout: 30000 }
  );
  return raw.trim();
}

async function main() {
  console.log(`[run-seed] Connecting to ${server}/${database}...`);
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
    await runSeed(pool);
  } finally {
    await pool.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[run-seed] Failed:', err.message);
    process.exit(1);
  });
