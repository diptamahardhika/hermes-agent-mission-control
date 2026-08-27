# 🐘 Hermy HQ Self-Hosted PostgreSQL Migration Guide

## Overview
This stack gives you **Neon-like DX** (auto-tuning, connection pooling, branching-ready) **fully self-hosted** with:
- **PostgreSQL 16** with 15+ extensions pre-loaded
- **PgBouncer** for connection pooling (transaction mode, like Neon)
- **pgBackRest** for incremental, encrypted, compressed backups
- **pgAdmin 4** for web-based management
- **Prometheus exporter** for monitoring
- **Auto-tuned config** for mixed OLTP/analytics workloads

---

## Quick Start

```bash
cd infra/postgres
./setup.sh
```

This will:
1. Create `.env` from template (you'll edit passwords)
2. Pull all Docker images
3. Start the stack
4. Initialize pgBackRest
5. Run initial backup

---

## Connection Strings for Hermy HQ

### For Next.js App (use pooled - **recommended**)
```env
DATABASE_URL="postgresql://hermy:YOUR_PASSWORD@localhost:6432/hermy_hq?sslmode=disable&pgbouncer=true"
POSTGRES_URL="postgresql://hermy:YOUR_PASSWORD@localhost:6432/hermy_hq?sslmode=disable&pgbouncer=true"
```

### For Prisma Migrations / Admin (direct)
```env
DATABASE_URL="postgresql://hermy:YOUR_PASSWORD@localhost:5432/hermy_hq?sslmode=prefer"
```

### For hermes-bridge (direct is fine - local only)
```env
# hermes-bridge/.env
DATABASE_URL="postgresql://hermy:YOUR_PASSWORD@localhost:5432/hermy_hq?sslmode=prefer"
```

---

## Migration from Prisma Postgres

### 1. Export current data
```bash
# From project root
npx prisma db pull --print > schema-backup.sql
# Or use pg_dump if you have direct access
pg_dump "prisma://..." > hermy_backup.sql
```

### 2. Start new stack
```bash
cd infra/postgres
./setup.sh
```

### 3. Import data
```bash
# Option A: Via psql (if you have SQL dump)
docker compose exec -T postgres psql -U hermy -d hermy_hq < hermy_backup.sql

# Option B: Prisma migrate deploy (if schema matches)
DATABASE_URL="postgresql://hermy:PASS@localhost:5432/hermy_hq?sslmode=prefer" npx prisma migrate deploy

# Option C: Prisma db push (development only)
DATABASE_URL="postgresql://hermy:PASS@localhost:5432/hermy_hq?sslmode=prefer" npx prisma db push
```

### 4. Update .env files
```bash
# Main app .env
DATABASE_URL="postgresql://hermy:PASS@localhost:6432/hermy_hq?sslmode=disable&pgbouncer=true"
POSTGRES_URL="postgresql://hermy:PASS@localhost:6432/hermy_hq?sslmode=disable&pgbouncer=true"

# hermes-bridge/.env
DATABASE_URL="postgresql://hermy:PASS@localhost:5432/hermy_hq?sslmode=prefer"
```

### 5. Regenerate Prisma Client
```bash
npx prisma generate
```

### 6. Restart app
```bash
npm run dev
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
docker compose logs -f pgbackrest    # Backups
```

### Connect via psql
```bash
# Direct
docker compose exec postgres psql -U hermy -d hermy_hq

# Via PgBouncer (what your app uses)
docker compose exec pgbouncer psql -U hermy -d hermy_hq -h localhost -p 6432
```

### Manual Backup
```bash
# Full backup
docker compose exec pgbackrest pgbackrest --stanza=hermy_hq --type=full backup

# Differential backup (faster)
docker compose exec pgbackrest pgbackrest --stanza=hermy_hq --type=diff backup
```

### Restore from Backup
```bash
# List backups
docker compose exec pgbackrest pgbackrest --stanza=hermy_hq info

# Restore latest (delta restore = faster)
docker compose exec pgbackrest pgbackrest --stanza=hermy_hq --type=full --delta restore

# Restore to specific time (PITR)
docker compose exec pgbackrest pgbackrest --stanza=hermy_hq --type=time --target="2025-01-15 10:00:00" --delta restore
```

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

1. **Enable SSL properly** - Mount real certs:
```yaml
volumes:
  - ./certs/server.crt:/etc/ssl/certs/server.crt:ro
  - ./certs/server.key:/etc/ssl/private/server.key:ro
```
In `postgresql.conf`:
```
ssl = on
ssl_cert_file = '/etc/ssl/certs/server.crt'
ssl_key_file = '/etc/ssl/private/server.key'
```

2. **Restrict network access** - Don't bind to `0.0.0.0` in production, use Tailscale/VPN

3. **Rotate passwords periodically** - Use `ALTER USER hermy PASSWORD 'newpass';`

4. **Audit with pgAudit** - Add to extensions if needed

---

## Uninstall / Clean Slate
```bash
docker compose down -v    # Removes all data volumes!
rm -rf data/
```