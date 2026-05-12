'use strict';

const sql = require('mssql');
const config = require('../config');

let pool = null;

/**
 * Build the mssql connection configuration.
 * Supports Azure AD managed identity auth with fallback to SQL auth for local dev.
 * @returns {object} mssql config object
 */
function buildDbConfig() {
  const dbConfig = {
    server:   config.db.server,
    database: config.db.database,
    port:     config.db.port,
    options:  config.db.options,
    pool:     config.db.pool,
  };

  if (config.db.useManagedIdentity) {
    // Azure AD authentication via managed identity
    dbConfig.authentication = {
      type: 'azure-active-directory-default',
    };
  } else {
    // SQL Server authentication (local dev)
    dbConfig.user     = config.db.user;
    dbConfig.password = config.db.password;
  }

  return dbConfig;
}

/**
 * Get or create the shared connection pool.
 * @returns {Promise<import('mssql').ConnectionPool>}
 */
async function getPool() {
  if (pool) return pool;

  const dbConfig = buildDbConfig();
  pool = await new sql.ConnectionPool(dbConfig).connect();

  pool.on('error', (err) => {
    console.error('[DB] Pool error:', err.message);
    pool = null;
  });

  console.log('[DB] Connected to Azure SQL');
  return pool;
}

/**
 * Close the connection pool (for graceful shutdown).
 */
async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('[DB] Pool closed');
  }
}

module.exports = { getPool, closePool, sql };
