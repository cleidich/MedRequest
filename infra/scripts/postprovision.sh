#!/usr/bin/env bash
# postprovision.sh — Post-infrastructure setup (replaces TESTING.md Phase 3 manual steps)
# Called by azd after Bicep provisioning. Uses azd env vars set from Bicep outputs.
set -euo pipefail

echo "🔧 Running post-provision setup..."

# --- Load azd environment variables (Bicep outputs) ---
# azd automatically exports AZURE_ENV_NAME, AZURE_LOCATION, and all Bicep outputs.
# If running outside azd, source them manually: source <(azd env get-values)

: "${AZURE_ENV_NAME:?ERROR: AZURE_ENV_NAME is not set. Are you running via azd?}"

# Resource names from Bicep outputs (set by azd from main.bicep outputs)
export SQL_SERVER="${AZURE_SQL_SERVER_NAME:?ERROR: AZURE_SQL_SERVER_NAME not set — check main.bicep outputs}"
export SQL_DATABASE="${AZURE_SQL_DATABASE_NAME:?ERROR: AZURE_SQL_DATABASE_NAME not set — check main.bicep outputs}"
MI_NAME="${AZURE_MANAGED_IDENTITY_NAME:?ERROR: AZURE_MANAGED_IDENTITY_NAME not set — check main.bicep outputs}"
RG="rg-medrequest-${AZURE_ENV_NAME}"

echo "  Environment: ${AZURE_ENV_NAME}"
echo "  Resource Group: ${RG}"
echo "  SQL Server: ${SQL_SERVER}"
echo "  Database: ${SQL_DATABASE}"
echo "  Managed Identity: ${MI_NAME}"

# --- Step 1: Add deployer's IP to SQL Server firewall ---
echo ""
echo "📡 Adding deployer IP to SQL Server firewall..."
MY_IP=$(curl -s ifconfig.me)
az sql server firewall-rule create \
  --resource-group "$RG" \
  --server "$SQL_SERVER" \
  --name "allow-deploy-ip" \
  --start-ip-address "$MY_IP" \
  --end-ip-address "$MY_IP" \
  --output none 2>/dev/null || \
az sql server firewall-rule update \
  --resource-group "$RG" \
  --server "$SQL_SERVER" \
  --name "allow-deploy-ip" \
  --start-ip-address "$MY_IP" \
  --end-ip-address "$MY_IP" \
  --output none
echo "  ✅ Firewall rule set for ${MY_IP}"

# --- Step 2: Install npm dependencies (needed for mssql package) ---
echo ""
echo "📦 Installing npm dependencies..."
cd src/api && npm install --silent && cd ../..

# --- Step 3: Grant managed identity SQL access ---
echo ""
echo "🔑 Granting managed identity '${MI_NAME}' SQL access..."
ACCESS_TOKEN=$(az account get-access-token \
  --resource https://database.windows.net/ \
  --query accessToken -o tsv)

node -e "
const sql = require('./src/api/node_modules/mssql');
const config = {
  server: '${SQL_SERVER}.database.windows.net',
  database: '${SQL_DATABASE}',
  authentication: {
    type: 'azure-active-directory-access-token',
    options: { token: '${ACCESS_TOKEN}' }
  },
  options: { encrypt: true, trustServerCertificate: false }
};
(async () => {
  try {
    const pool = await sql.connect(config);
    await pool.request().query(\`
      IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = '${MI_NAME}')
      BEGIN
        CREATE USER [${MI_NAME}] FROM EXTERNAL PROVIDER;
        ALTER ROLE db_datareader ADD MEMBER [${MI_NAME}];
        ALTER ROLE db_datawriter ADD MEMBER [${MI_NAME}];
        GRANT EXECUTE TO [${MI_NAME}];
      END
    \`);
    await pool.close();
    console.log('  ✅ Managed identity SQL access granted');
  } catch (err) {
    console.error('  ❌ Failed to grant SQL access:', err.message);
    process.exit(1);
  }
})();
"

# --- Step 4: Run database migrations ---
echo ""
echo "📋 Running database migrations..."
node infra/scripts/run-migrations.js

# --- Step 5: Seed demo data ---
echo ""
echo "🌱 Seeding demo data..."
node infra/scripts/run-seed.js

# --- Step 6: Clean up firewall rule (optional, leave for now) ---
echo ""
echo "✅ Post-provision complete! Database is configured and seeded."
