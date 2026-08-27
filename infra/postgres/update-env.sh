#!/usr/bin/env bash
# ─── Update Hermy HQ .env files for self-hosted PostgreSQL ───────────
# Run AFTER the postgres stack is up and you have your password

set -euo pipefail

# Configuration - EDIT THESE
POSTGRES_PASSWORD="${1:-}"
POSTGRES_HOST="${2:-localhost}"

if [[ -z "$POSTGRES_PASSWORD" ]]; then
    echo "Usage: $0 <POSTGRES_PASSWORD> [POSTGRES_HOST]"
    echo "Example: $0 'super-secret-password' localhost"
    echo ""
    echo "Or if using Tailscale: $0 'super-secret-password' 100.x.y.z"
    exit 1
fi

PROJECT_ROOT="/Users/pradiptamahardika/hermes-agent-mission-control"

# Connection strings
# App uses PgBouncer (port 6432)
APP_DB_URL="postgresql://hermy:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:6432/hermy_hq?sslmode=disable&pgbouncer=true"
# Bridge uses direct (port 5432)
BRIDGE_DB_URL="postgresql://hermy:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/hermy_hq?sslmode=prefer"

echo "🔧 Updating Hermy HQ environment files..."
echo ""
echo "App DB URL:      $APP_DB_URL"
echo "Bridge DB URL:   $BRIDGE_DB_URL"
echo ""

# 1. Main app .env
ENV_FILE="$PROJECT_ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
    echo "📝 Updating $ENV_FILE"
    # Backup
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%s)"
    
    # Update DATABASE_URL and POSTGRES_URL
    sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=\"$APP_DB_URL\"|" "$ENV_FILE"
    sed -i '' "s|^POSTGRES_URL=.*|POSTGRES_URL=\"$APP_DB_URL\"|" "$ENV_FILE"
    echo "   ✅ Updated DATABASE_URL and POSTGRES_URL"
else
    echo "⚠️  $ENV_FILE not found"
fi

# 2. Hermes bridge .env
BRIDGE_ENV="$PROJECT_ROOT/hermes-bridge/.env"
if [[ -f "$BRIDGE_ENV" ]]; then
    echo "📝 Updating $BRIDGE_ENV"
    cp "$BRIDGE_ENV" "$BRIDGE_ENV.backup.$(date +%s)"
    sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=\"$BRIDGE_DB_URL\"|" "$BRIDGE_ENV"
    echo "   ✅ Updated DATABASE_URL"
else
    echo "⚠️  $BRIDGE_ENV not found"
fi

echo ""
echo "✅ Done! Now regenerate Prisma client and restart:"
echo "   cd $PROJECT_ROOT"
echo "   npx prisma generate"
echo "   npm run dev"
echo ""
echo "   # In another terminal, restart bridge:"
echo "   cd $PROJECT_ROOT/hermes-bridge && npm start"