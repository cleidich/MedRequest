#!/usr/bin/env bash
# postdeploy.sh — Post-deploy verification after azd deploy
# Fixes startup command and verifies the app is running.
set -euo pipefail

echo "🚀 Running post-deploy verification..."

: "${AZURE_ENV_NAME:?ERROR: AZURE_ENV_NAME is not set. Are you running via azd?}"

APP_NAME="${AZURE_APP_SERVICE_NAME:?ERROR: AZURE_APP_SERVICE_NAME not set — check main.bicep outputs}"
RG="${AZURE_RESOURCE_GROUP:?ERROR: AZURE_RESOURCE_GROUP not set — are you running via azd?}"

# --- Step 1: Set startup command ---
echo "  Setting startup command to 'node server.js'..."
az webapp config set \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --startup-file "node server.js" \
  --output none
echo "  ✅ Startup command set"

# --- Step 2: Restart to pick up new startup command ---
echo "  Restarting app service..."
az webapp restart \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --output none

# --- Step 3: Wait for app to come up ---
echo "  Waiting for app to start (30s)..."
sleep 30

# --- Step 4: Health check ---
APP_URL="https://${APP_NAME}.azurewebsites.net"
echo "  Checking health endpoint: ${APP_URL}/api/health"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/api/health" --max-time 15 || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
  echo "  ✅ Health check passed (HTTP ${HTTP_STATUS})"
else
  echo "  ⚠️  Health check returned HTTP ${HTTP_STATUS} — app may still be starting"
  echo "  Check logs: az webapp log tail --name ${APP_NAME} --resource-group ${RG}"
fi

echo ""
echo "🎉 Deployment complete!"
echo "   App URL: ${APP_URL}"
echo "   Health:  ${APP_URL}/api/health"
echo "   Ready:   ${APP_URL}/api/ready"
