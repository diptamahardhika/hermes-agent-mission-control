# 🐘 Hermy HQ Self-Hosted PostgreSQL Migration Guide

## Overview
This stack gives you **Neon-like DX** (auto-tuning, connection pooling, branching-ready) **fully self-hosted** with:
- **PostgreSQL 16** with key extensions pre-loaded
- **PgBouncer** for connection pooling (transaction mode, like Neon)
- **pgAdmin 4** for web-based management
- **Prometheus exporter** for monitoring
- **Auto-tuned config** for mixed OLTP/analytics workloads

> **Status as of 2026-08-29:** pgBackRest is **disabled** (GHCR auth denied anonymous pull). Re-enable when you have a Docker Hub image or GHCR auth — see TODO at bottom of this file. **Backups are NOT yet automated.** Configure a stopgap (`pg_dump` cron) before relying on this stack for anything you can't recreate.

---

## Quick Start

```bash
cd infra/postgres
./setup.sh
```

This will:
1. Create `.env` from template (you fill in passwords)
2. Create data dirs with correct perms
3. Pull all Docker images
4. Generate `userlist.txt` (scram hash for PgBouncer auth)
5. Start the stack
6. Wait for health checks
7. Print connection strings

---

## Connection Strings for Hermy HQ

### For Next.js App (use pooled - **recommended**)
```env
DATABASE_URL="postgres://hermy:YOUR_PASSWORD@localhost:6432/hermy_hq?sslmode=disable&pgbouncer=true"
POSTGRES_URL="postgres://hermy:YOUR_PASSWORD@localhost:5432/hermy_hq?sslmode=disable"
```

### For Prisma Migrations / Admin (direct)
```env
DATABASE_URL="postgres://hermy:YOUR_PASSWORD@localhost:5432/hermy_hq?sslmode=disable"
```

### For hermes-bridge (direct is fine - local only)
```env
# hermes-bridge/.env
DATABASE_URL="postgres://hermy:YOUR_PASSWORD@localhost:5432/hermy_hq?sslmode=disable"
```

> **Note:** `sslmode=disable` is intentional for local dev — Postgres is bound to `127.0.0.1` only and the pg_hba uses scram-sha-256 for auth. For Umbrel/remote, re-enable SSL (see Hardening section).

---

## Migration from Prisma Postgres

### What we did (Aug 2026)

We migrated the dashboard from Prisma Cloud (free tier hit limit) to this self-hosted stack. Since the Prisma Cloud instance had no real application data (it was a fresh account), the migration was schema-only — no `pg_dump` import was needed. The 27 Prisma models were materialized via `npx prisma db push`.

### If you ever need to import data from Prisma Cloud

1. Export from Prisma:
   ```bash
   # Prisma Cloud's free tier does not provide pg_dump, so this only works
   # if you upgraded to a paid plan or use the Prisma Data Browser export.
   ```

2. Start the local stack:
   ```bash
   cd infra/postgres
   ./setup.sh
   ```

3. Import:
   ```bash
   # Option A: Via psql (if you have a SQL dump)
   docker compose exec -T postgres psql -U hermy -d hermy_hq < hermy_backup.sql

   # Option B: Prisma db push (sync schema to fresh DB)
   DATABASE_URL="postgres://hermy:PASS@localhost:5432/hermy_hq?sslmode=disable" npx prisma db push
   ```

4. Update `.env` files in repo root + `hermes-bridge/.env` (see Connection Strings above)

5. Regenerate Prisma Client + restart:
   ```bash
   npx prisma generate
   launchctl kickstart -k gui/$(id -u)/ai.hermyhq.dashboard   # restart the dashboard
   # Restart the bridge:
   pkill -f "hermes-bridge/bridge.mjs"
   cd hermes-bridge && nohup node bridge.mjs > /tmp/hermes-bridge.log 2>&1 &
   ```

---

## Key Differences from Prisma Postgres

| Feature | Prisma Postgres | Self-Hosted Stack |
|---------|-----------------|-------------------|
| **Free tier** | 100K rows, 10M rows/mo | Unlimited (your hardware) |
| **Cold starts** | Yes (serverless) | Never (always warm) |
| **Connection pooling** | Built-in | PgBouncer (transaction mode) |
| **Branching** | ✅ Git-like | ❌ (use pg_dump/restore or ZFS snapshots) |
| **Extensions** | Limited | 15+ pre-installed |
| **Backups** | Automatic | pgBackRest (incremental, encrypted) |
| **Monitoring** | Basic | Prometheus + custom queries |
| **Cost** | $$$ at scale | Hardware only |

---

## Daily Operations

### View Logs
```bash
docker compose logs -f postgres      # Database
docker compose logs -f pgbouncer     # Connection pooler
```

### Connect via psql
```bash
# Direct
docker compose exec -T postgres env PGPASSWORD=$POSTGRES_PASSWORD psql -U hermy -d hermy_hq

# Via PgBouncer (what your app uses)
docker compose exec -T pgbouncer psql -U hermy -d hermy_hq -h localhost -p 6432
```

### Manual Backup (stopgap until pgBackRest is re-enabled)
```bash
# One-off full dump to host:
mkdir -p ~/backups/hermy
docker compose exec -T postgres pg_dump -U hermy -d hermy_hq -Fc > ~/backups/hermy/$(date +%Y%m%d).dump
```

> **TODO:** Re-enable pgBackRest (GHCR auth or Docker Hub image) and wire daily full + diff backups. Until then, run the `pg_dump` above manually or set up a cron on the host.

### Monitor Health
```bash
# Cache hit ratios
docker compose exec postgres psql -U hermy -d hermy_hq -c "SELECT * FROM hermy.cache_hit_ratio();"

# Table bloat
docker compose exec postgres psql -U hermy -d hermy_hq -c "SELECT * FROM hermy.table_bloat() WHERE bloat_ratio > 1.5;"

# Unused indexes
docker compose exec postgres psql -U hermy -d hermy_hq -c "SELECT * FROM hermy.index_usage() WHERE idx_scan = 0;"

# Long queries
docker compose exec postgres psql -U hermy -d hermy_hq -c "SELECT * FROM hermy.long_running_queries();"
```

---

## Accessing Remotely (Tailscale/SSH Tunnel)

### Via Tailscale (recommended)
```bash
# On server: tailscale up
# On client: tailscale up
# Then use tailnet IP:
DATABASE_URL="postgresql://hermy:PASS@100.x.y.z:6432/hermy_hq?sslmode=disable&pgbouncer=true"
```

### Via SSH Tunnel
```bash
# Tunnel PgBouncer port
ssh -L 6432:localhost:6432 user@server

# Then connect locally
DATABASE_URL="postgresql://hermy:PASS@localhost:6432/hermy_hq?sslmode=disable&pgbouncer=true"
```

---

## Scaling Tips

### Vertical (bigger container)
Edit `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 4G      # Increase
    reservations:
      memory: 1G
```
Then adjust `postgresql.conf`:
```
shared_buffers = 1GB
effective_cache_size = 3GB
work_mem = 32MB
maintenance_work_mem = 512MB
max_worker_processes = 8
max_parallel_workers = 8
```

### Horizontal (read replica)
1. Add replica to `docker-compose.yml`
2. Configure streaming replication
3. Point read queries to replica
4. Use `pg_cron` for automated failover (or Patroni)

### Connection Pool Tuning
For high concurrency (>500 connections), tune PgBouncer:
```yaml
environment:
  DEFAULT_POOL_SIZE: 50
  MAX_CLIENT_CONN: 2000
  MIN_POOL_SIZE: 10
```

---

## Troubleshooting

### "Connection refused" on port 5432
- Check `docker compose ps` - postgres must be healthy
- Verify `postgresql.conf` has `listen_addresses = '*'`

### "Pool exhausted" errors
- Increase `DEFAULT_POOL_SIZE` in PgBouncer
- Check for connection leaks in app (missing `await prisma.$disconnect()`)

### Slow queries
```bash
# Check pg_stat_statements
docker compose exec postgres psql -U hermy -d hermy_hq -c "
  SELECT query, calls, mean_exec_time, total_exec_time
  FROM pg_stat_statements
  ORDER BY total_exec_time DESC LIMIT 20;
"
```

### Backup failing
```bash
# Check pgBackRest logs
docker compose logs pgbackrest

# Verify stanza
docker compose exec pgbackrest pgbackrest --stanza=hermy_hq check
```

---

## Security Hardening (Production)

**Current local state (as of Aug 2026):**
- SSL is **off** in `postgresql.conf` (only safe because Postgres binds to `127.0.0.1`)
- Auth uses scram-sha-256 (no `trust`, no `md5`)
- Port 5432 binds `127.0.0.1:5432` only (PgBouncer same)
- pgAdmin on `127.0.0.1:5050`

**Before Umbrel migration, do this:**

1. **Enable SSL properly** — generate self-signed certs (or use Tailscale certs):
   ```bash
   # In infra/postgres/
   mkdir -p certs
   openssl req -new -x509 -days 365 -nodes -text \
     -out certs/server.crt -keyout certs/server.key \
     -subj "/CN=hermy-postgres"
   chmod 600 certs/server.key
   ```
   Mount them in `docker-compose.yml`:
   ```yaml
   volumes:
     - ./certs/server.crt:/etc/ssl/certs/server.crt:ro
     - ./certs/server.key:/etc/ssl/private/server.key:ro
   ```
   Re-enable in `postgresql.conf`:
   ```
   ssl = on
   ssl_cert_file = '/etc/ssl/certs/server.crt'
   ssl_key_file = '/etc/ssl/private/server.key'
   ```
   Then update app/bridge `DATABASE_URL` to use `sslmode=require`.

2. **Restrict network access** — on Umbrel, bind Postgres to Tailscale interface only (not `0.0.0.0`). Update `ports` in `docker-compose.yml` to `<tailscale-ip>:5432:5432`.

3. **Rotate passwords periodically** — `ALTER USER hermy PASSWORD 'newpass';` then update `.env` and `userlist.txt`.

4. **Audit with pgAudit** — add to extensions if needed.

---

## TODO (before relying on this stack)

- [ ] **Backups** — pgBackRest is disabled (GHCR auth denied). Options:
  - Option A: Switch to Docker Hub image (search for `pgbackrest docker hub`)
  - Option B: Configure GHCR auth (logged-in Docker Hub account can pull from GHCR)
  - Option C: Stopgap — `pg_dump` cron on host (see Daily Operations above)
- [ ] **pg_cron** — currently disabled (not in stock `postgres:16-bookworm` image). To re-enable: build a custom image with `pg_cron` extension, or use a `postgres` image variant that includes it.
- [ ] **SSL on Umbrel** — currently `ssl=off` for local dev. Before exposing Postgres over network, re-enable SSL (see Security Hardening above).
- [ ] **pgAdmin email** — use a valid email format (pgAdmin 8+ rejects `.local` TLDs). Currently set to `admin@hermy.dev` in `.env`.
- [ ] **Boot persistence** — Docker Desktop on Mac restarts containers automatically after reboot. On Umbrel, ensure `restart: unless-stopped` is sufficient (it is).
- [ ] **Umbrel migration** — when ready: clone repo, run `./setup.sh`, update `hermes-bridge/.env` to point at `<umbrel-tailscale-ip>:5432`.

---

## Uninstall / Clean Slate
```bash
docker compose down -v    # Removes all data volumes!
rm -rf data/
```