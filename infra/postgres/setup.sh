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

# 3. Validate required vars
required_vars=("POSTGRES_PASSWORD" "PGBACKREST_REPO_KEY" "PGADMIN_PASSWORD")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" || "${!var}" == *"generate_with_"* ]]; then
        echo "❌ Error: $var not set in .env"
        exit 1
    fi
done

# 4. Create data directories with correct permissions
echo "📁 Creating data directories..."
mkdir -p data/postgres data/pgbackrest data/pgadmin
# Fix permissions for postgres (UID 999) and pgadmin (UID 5050)
sudo chown -R 999:999 data/postgres 2>/dev/null || chown -R 999:999 data/postgres
sudo chown -R 5050:5050 data/pgadmin 2>/dev/null || chown -R 5050:5050 data/pgadmin

# 5. Pull images
echo "📦 Pulling Docker images..."
docker compose pull

# 6. Start stack
echo "🚀 Starting stack..."
docker compose up -d

# 7. Wait for health checks
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

# 8. Initialize pgBackRest stanza
echo "🔧 Initializing pgBackRest..."
docker compose exec -T pgbackrest pgbackrest --stanza=hermy_hq stanza-create
docker compose exec -T pgbackrest pgbackrest --stanza=hermy_hq check

# 9. Run initial full backup
echo "💾 Running initial backup..."
docker compose exec -T pgbackrest pgbackrest --stanza=hermy_hq --type=full backup

# 10. Show connection info
echo ""
echo "✅ Stack is running!"
echo ""
echo "📍 Connection Strings:"
echo "   Direct (admin/migrations): postgresql://hermy:***@localhost:5432/hermy_hq?sslmode=prefer"
echo "   Pooled (application):      postgresql://hermy:***@localhost:6432/hermy_hq?sslmode=disable&pgbouncer=true"
echo ""
echo "🌐 Web UIs:"
echo "   pgAdmin:  http://localhost:5050  (email: $PGADMIN_EMAIL)"
echo "   Metrics:  http://localhost:9187/metrics"
echo ""
echo "🔧 Useful Commands:"
echo "   Logs:        docker compose logs -f [service]"
echo "   psql:        docker compose exec postgres psql -U hermy -d hermy_hq"
echo "   Backup now:  docker compose exec pgbackrest pgbackrest --stanza=hermy_hq --type=full backup"
echo "   Restore:     docker compose exec pgbackrest pgbackrest --stanza=hermy_hq --type=full --delta restore"
echo "   Stop:        docker compose down"
echo "   Stop + wipe: docker compose down -v"