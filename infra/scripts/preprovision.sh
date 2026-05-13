#!/usr/bin/env bash
# preprovision.sh — Pre-flight checks before azd provision
# Warns about soft-deleted APIM / Key Vault resources that block re-deployment.
set -euo pipefail

echo "🔍 Running pre-provision checks..."

NAMING_PATTERN="medrequest"

# --- Check for soft-deleted APIM services ---
echo "  Checking for soft-deleted APIM services..."
DELETED_APIM=$(az apim deletedservice list --query "[?contains(name, '${NAMING_PATTERN}')]" -o tsv 2>/dev/null || true)
if [ -n "$DELETED_APIM" ]; then
  echo "  ⚠️  WARNING: Found soft-deleted APIM service(s) matching '${NAMING_PATTERN}':"
  az apim deletedservice list --query "[?contains(name, '${NAMING_PATTERN}')].{name:name, location:location, deletionDate:deletionDate}" -o table 2>/dev/null || true
  echo "  Purge with: az apim deletedservice purge --service-name <name> --location <location>"
  echo ""
fi

# --- Check for soft-deleted Key Vaults ---
echo "  Checking for soft-deleted Key Vaults..."
DELETED_KV=$(az keyvault list-deleted --query "[?contains(name, '${NAMING_PATTERN}')]" -o tsv 2>/dev/null || true)
if [ -n "$DELETED_KV" ]; then
  echo "  ⚠️  WARNING: Found soft-deleted Key Vault(s) matching '${NAMING_PATTERN}':"
  az keyvault list-deleted --query "[?contains(name, '${NAMING_PATTERN}')].{name:name, location:properties.location, deletionDate:properties.deletionDate}" -o table 2>/dev/null || true
  echo "  Purge with: az keyvault purge --name <name>"
  echo ""
fi

echo "✅ Pre-provision checks complete."

# --- Auto-set SQL admin to the current deployer ---
if [ -z "${AZURE_SQL_ADMIN_OBJECT_ID:-}" ]; then
  echo ""
  echo "🔑 Setting SQL admin to current Azure CLI user..."
  DEPLOYER_OID=$(az ad signed-in-user show --query id -o tsv 2>/dev/null || true)
  if [ -n "$DEPLOYER_OID" ]; then
    azd env set AZURE_SQL_ADMIN_OBJECT_ID "$DEPLOYER_OID"
    echo "  ✅ AZURE_SQL_ADMIN_OBJECT_ID set to ${DEPLOYER_OID}"
  else
    echo "  ⚠️  Could not determine deployer OID — SQL admin will default to managed identity"
  fi
fi
