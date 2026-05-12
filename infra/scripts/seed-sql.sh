#!/usr/bin/env bash
# seed-sql.sh — Bootstrap the MedRequest database schema
# Usage: ./infra/scripts/seed-sql.sh <sql-server-fqdn> <database-name>
#
# Requires: sqlcmd (or Azure CLI with sql extension) and AAD auth configured

set -euo pipefail

SQL_SERVER="${1:?Usage: seed-sql.sh <sql-server-fqdn> <database-name>}"
SQL_DATABASE="${2:?Usage: seed-sql.sh <sql-server-fqdn> <database-name>}"
MIGRATION_DIR="db/migrations"

echo "==> Connecting to ${SQL_SERVER}/${SQL_DATABASE}"

for migration in "${MIGRATION_DIR}"/*.sql; do
  echo "==> Applying $(basename "${migration}")"
  sqlcmd -S "${SQL_SERVER}" -d "${SQL_DATABASE}" \
    --authentication-method=ActiveDirectoryDefault \
    -i "${migration}"
done

echo "==> Schema bootstrap complete"
