-- ─── Core Extensions ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";           -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";            -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";             -- Trigram similarity search
CREATE EXTENSION IF NOT EXISTS "btree_gin";           -- GIN indexes on scalar types
CREATE EXTENSION IF NOT EXISTS "btree_gist";          -- GiST indexes on scalar types
CREATE EXTENSION IF NOT EXISTS "citext";              -- Case-insensitive text
CREATE EXTENSION IF NOT EXISTS "hstore";              -- Key-value store
CREATE EXTENSION IF NOT EXISTS "jsonb_plpython3u";    -- Python in JSONB (if PL/Python installed)

-- ─── Full-Text Search ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pg_bigm";             -- Bigram similarity (faster than pg_trgm for Asian languages)
-- Note: pg_bigm may need to be installed separately; fallback to pg_trgm

-- ─── Analytics & Time-Series ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "timescaledb";         -- Time-series (if available)
-- Fallback: native partitioning + BRIN indexes

-- ─── Monitoring & Stats ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";  -- Query statistics (preloaded)
CREATE EXTENSION IF NOT EXISTS "auto_explain";        -- Auto EXPLAIN (preloaded)
CREATE EXTENSION IF NOT EXISTS "pg_cron";             -- Scheduled jobs (preloaded)
CREATE EXTENSION IF NOT EXISTS "pg_stat_kcache";      -- Per-query kernel cache stats (optional)

-- ─── Data Types & Utilities ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "intarray";            -- Integer array functions
CREATE EXTENSION IF NOT EXISTS "ltree";               -- Hierarchical tree labels
CREATE EXTENSION IF NOT EXISTS "seg";                 -- Segment data types
CREATE EXTENSION IF NOT EXISTS "tablefunc";           -- Crosstab/pivot functions

-- ─── Grant Usage ──────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO hermy;
GRANT CREATE ON SCHEMA public TO hermy;