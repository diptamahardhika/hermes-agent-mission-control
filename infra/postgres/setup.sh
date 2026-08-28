#!/usr/bin/env bash
# ─── Hermy HQ PostgreSQL Stack Setup ─────────────────────────────────
# Run this script to bootstrap the entire stack

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🐘 Hermy HQ PostgreSQL Stack Setup"
echo "=================================="

# 1. Check for .env
if [[ ! -f .env ]]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and set secure passwords!"
    echo "   Generate with: openssl rand -base64 32"
    echo ""
    read -p "Press Enter after editing .env to continue..."
fi

# 2. Source environment
set -a
source .env
set +a

# 3. Validate required vars (pgBackRest key is optional — pgBackRest is currently disabled)
required_vars=("POSTGRES_PASSWORD" "PGADMIN_PASSWORD")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" || "${!var}" == *"generate_with_"* ]]; then
        echo "❌ Error: $var not set in .env"
        exit 1
    fi
done

# 4. Create data directories with correct permissions
echo "📁 Creating data directories..."
mkdir -p data/postgres data/pgadmin
# Fix permissions for postgres (UID 999) and pgadmin (UID 5050)
sudo chown -R 999:999 data/postgres 2>/dev/null || chown -R 999:999 data/postgres
sudo chown -R 5050:5050 data/pgadmin 2>/dev/null || chown -R 5050:5050 data/pgadmin

# 5. Generate userlist.txt from Postgres scram hash
echo "🔑 Generating PgBouncer auth file (userlist.txt)..."
if [[ ! -f userlist.txt ]]; then
    SCRAM_HASH=$(docker compose exec -T postgres psql -U hermy -d hermy_hq -t -c \
        "SELECT rolpassword FROM pg_authid WHERE rolname='hermy';" 2>/dev/null | tr -d '[:space:]')
    if [[ -n "$SCRAM_HASH" ]]; then
        echo "\"hermy\" \"$SCRAM_HASH\"" > userlist.txt
        echo "✅ Generated userlist.txt from Postgres"
    else
        echo "⚠️  Could not fetch scram hash from Postgres — userlist.txt not created."
        echo "   Start the stack first, then run: docker compose exec -T postgres psql -U hermy -d hermy_hq"
    fi
else
    echo "ℹ️  userlist.txt already exists, skipping."
fi

# 6. Pull images
echo "📦 Pulling Docker images..."
docker compose pull

# 7. Start stack
echo "🚀 Starting stack..."
docker compose up -d

# 8. Wait for health checks
echo "⏳ Waiting for PostgreSQL to be healthy..."
timeout=120
elapsed=0
while [[ $elapsed -lt $timeout ]]; do
    if docker compose exec -T postgres pg_isready -U hermy -d hermy_hq >/dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
done

if [[ $elapsed -ge $timeout ]]; then
    echo "❌ Timeout waiting for PostgreSQL"
    docker compose logs postgres
    exit 1
fi

# 9. pgBackRest is currently disabled (GHCR auth required).
#    To re-enable: uncomment the pgbackrest section in docker-compose.yml,
#    restore PGBACKREST_REPO_KEY in .env, and run:
#    docker compose exec pgbackrest pgbackrest --stanza=hermy_hq stanza-create
#    docker compose exec pgbackrest pgbackrest --stanza=hermy_hq --type=full backup

# 10. Show connection info
echo ""
echo "✅ Stack is running!"
echo ""
echo "📍 Connection Strings (use passwords from .env):"
echo "   Direct (migrations):     postgres://hermy:***@localhost:5432/hermy_hq?sslmode=prefer"
echo "   Pooled (application):    postgres://hermy:***@localhost:6432/hermy_hq?sslmode=disable&pgbouncer=true"
echo ""
echo "🌐 Web UIs:"
echo "   pgAdmin:  http://localhost:5050  (email: ${PGADMIN_EMAIL:-admin@hermy.dev})"
echo "   Metrics:  http://localhost:9187/metrics"
echo ""
echo "🔧 Useful Commands:"
echo "   Logs:       docker compose logs -f [service]"
echo "   psql:       docker compose exec postgres psql -U hermy -d hermy_hq"
echo "   Status:     docker compose ps"
echo "   Stop:       docker compose down"
echo "   Stop+wipe:  docker compose down -v"
echo ""
echo "⚠️  Backups are NOT configured yet. pgBackRest is disabled (GHCR auth required)."
echo "   To enable: re-enable pgbackrest section in docker-compose.yml, add PGBACKREST_REPO_KEY to .env,"
echo "   then run: docker compose exec pgbackrest pgbackrest --stanza=hermy_hq stanza-create"
