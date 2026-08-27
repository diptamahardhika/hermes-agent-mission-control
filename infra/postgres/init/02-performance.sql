-- ─── Performance Indexes & Helper Functions ──────────────────────────

-- Create schema for our custom functions
CREATE SCHEMA IF NOT EXISTS hermy;
GRANT USAGE ON SCHEMA hermy TO hermy;

-- ─── Helper: Safe concurrent index creation ──────────────────────────
CREATE OR REPLACE FUNCTION hermy.create_index_concurrently(
    idx_name text,
    tbl_name text,
    col_expr text
) RETURNS void AS $$
BEGIN
    EXECUTE format('CREATE INDEX CONCURRENTLY IF NOT EXISTS %I ON %I (%s)', idx_name, tbl_name, col_expr);
EXCEPTION WHEN duplicate_table THEN
    -- Index already exists, ignore
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Helper: Table bloat estimation ──────────────────────────────────
CREATE OR REPLACE FUNCTION hermy.table_bloat()
RETURNS TABLE (
    schemaname text,
    tablename text,
    bloat_ratio numeric,
    waste_bytes bigint,
    table_size_bytes bigint
) AS $$
SELECT
    n.nspname AS schemaname,
    c.relname AS tablename,
    CASE WHEN c.relpages = 0 THEN 0
         ELSE round((c.relpages - otta)::numeric / nullif(c.relpages,0), 2) END AS bloat_ratio,
    CASE WHEN c.relpages = 0 THEN 0
         ELSE (c.relpages - otta) * current_setting('block_size')::bigint END AS waste_bytes,
    c.relpages * current_setting('block_size')::bigint AS table_size_bytes
FROM (
    SELECT
        c.oid,
        c.relname,
        c.relpages,
        ceil(c.reltuples * (c.relpages::numeric / nullif(c.relpages,0))) AS otta
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema')
) c
JOIN pg_namespace n ON n.oid = c.relnamespace
ORDER BY waste_bytes DESC;
$$ LANGUAGE sql SECURITY DEFINER;

-- ─── Helper: Index usage stats ───────────────────────────────────────
CREATE OR REPLACE FUNCTION hermy.index_usage()
RETURNS TABLE (
    schemaname text,
    tablename text,
    indexname text,
    idx_scan bigint,
    idx_tup_read bigint,
    idx_tup_fetch bigint,
    size_bytes bigint
) AS $$
SELECT
    s.schemaname,
    s.relname AS tablename,
    s.indexrelname AS indexname,
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch,
    pg_relation_size(s.indexrelid) AS size_bytes
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE NOT i.indisunique
ORDER BY s.idx_scan ASC NULLS FIRST, pg_relation_size(s.indexrelid) DESC;
$$ LANGUAGE sql SECURITY DEFINER;

-- ─── Helper: Long-running queries ────────────────────────────────────
CREATE OR REPLACE FUNCTION hermy.long_running_queries(min_duration interval DEFAULT '30s')
RETURNS TABLE (
    pid int,
    usename text,
    application_name text,
    client_addr inet,
    state text,
    duration interval,
    query text
) AS $$
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    now() - query_start AS duration,
    query
FROM pg_stat_activity
WHERE state IN ('active','idle in transaction')
  AND now() - query_start > min_duration
  AND pid <> pg_backend_pid()
ORDER BY duration DESC;
$$ LANGUAGE sql SECURITY DEFINER;

-- ─── Helper: Cache hit ratio ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION hermy.cache_hit_ratio()
RETURNS TABLE (
    name text,
    ratio numeric
) AS $$
SELECT
    'buffer' AS name,
    round(blks_hit::numeric / nullif(blks_hit + blks_read, 0), 4) AS ratio
FROM pg_stat_database
WHERE datname = current_database()
UNION ALL
SELECT
    'index' AS name,
    round(idx_blks_hit::numeric / nullif(idx_blks_hit + idx_blks_read, 0), 4)
FROM pg_stat_database
WHERE datname = current_database();
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA hermy TO hermy;