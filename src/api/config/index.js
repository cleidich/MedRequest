'use strict';

require('dotenv').config();

/**
 * Application configuration.
 * Reads from environment variables with sensible local-dev defaults.
 * In Azure, secrets come from Key Vault references in App Service config.
 */
const config = {
  port: parseInt(process.env.PORT, 10) || 3000,

  db: {
    server:   process.env.DB_SERVER   || 'localhost',
    database: process.env.DB_NAME     || 'medrequest',
    port:     parseInt(process.env.DB_PORT, 10) || 1433,

    // SQL auth fallback for local dev
    user:     process.env.DB_USER     || '',
    password: process.env.DB_PASSWORD || '',

    // Set to 'true' in Azure to use managed identity (Azure AD)
    useManagedIdentity: process.env.DB_USE_MANAGED_IDENTITY === 'true',

    options: {
      encrypt:            true,
      trustServerCertificate: process.env.NODE_ENV !== 'production',
      connectTimeout:     30000,
      requestTimeout:     30000,
    },

    pool: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  },

  // Key Vault reference (informational — App Service resolves these automatically)
  keyVault: {
    uri: process.env.KEY_VAULT_URI || '',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};

module.exports = config;
