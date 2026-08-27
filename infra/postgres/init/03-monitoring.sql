-- ─── Monitoring Views & pg_cron Jobs ────────────────────────────────

-- Enable pg_cron (requires superuser, run once)
-- SELECT cron.schedule('vacuum-analyze', '0 3 * * *', 'VACUUM (ANALYZE)');
-- SELECT cron.schedule('refresh-stats', '*/15 * * * *', 'ANALYZE');

-- ─── View: Active locks ──────────────────────────────────────────────
CREATE OR REPLACE VIEW hermy.active_locks AS
SELECT
    l.pid,
    l.locktype,
    l.mode,
    l.granted,
    a.usename,
    a.application_name,
    a.client_addr,
    a.state,
    now() - a.query_start AS duration,
    a.query
FROM pg_locks l
JOIN pg_stat_activity a ON a.pid = l.pid
WHERE NOT l.granted OR l.locktype IN ('relation','tuple','transactionid')
ORDER BY duration DESC;

-- ─── View: Table sizes ───────────────────────────────────────────────
CREATE OR REPLACE VIEW hermy.table_sizes AS
SELECT
    n.nspname AS schema,
    c.relname AS table,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
    pg_total_relation_size(c.oid) AS total_bytes,
    pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
    pg_relation_size(c.oid) AS table_bytes,
    pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) AS index_size,
    (pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) AS index_bytes,
    c.reltuples::bigint AS est_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p')  -- tables and partitions
  AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
ORDER BY pg_total_relation_size(c.oid) DESC;

-- ─── View: Index sizes ───────────────────────────────────────────────
CREATE OR REPLACE VIEW hermy.index_sizes AS
SELECT
    n.nspname AS schema,
    c.relname AS table,
    i.relname AS index,
    pg_size_pretty(pg_relation_size(i.oid)) AS size,
    pg_relation_size(i.oid) AS size_bytes,
    ix.indisunique AS unique,
    ix.indisprimary AS primary
FROM pg_index ix
JOIN pg_class c ON c.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY pg_relation_size(i.oid) DESC;

-- ─── View: Sequence usage (for BIGSERIAL exhaustion monitoring) ──────
CREATE OR REPLACE VIEW hermy.sequence_usage AS
SELECT
    n.nspname AS schema,
    c.relname AS sequence,
    s.last_value,
    s.is_called,
    CASE WHEN s.seqtypid = 'bigint'::regtype THEN 9223372036854775807
         WHEN s.seqtypid = 'integer'::regtype THEN 2147483647
         ELSE NULL END AS max_value,
    round(s.last_value::numeric / nullif(
        CASE WHEN s.seqtypid = 'bigint'::regtype THEN 9223372036854775807
             WHEN s.seqtypid = 'integer'::regtype THEN 2147483647
             ELSE NULL END, 0) * 100, 2) AS pct_used
FROM pg_sequences s
JOIN pg_class c ON c.relname = s.sequencename
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY pct_used DESC NULLS LAST;

GRANT SELECT ON ALL TABLES IN SCHEMA hermy TO hermy;