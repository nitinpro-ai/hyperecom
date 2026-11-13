-- Enable required Postgres extensions BEFORE any table uses their types.
-- Ordered first so Prisma's shadow database (and any fresh DB) gets PostGIS,
-- pg_trgm and ltree before the M03 geography tables (which use geometry()).
-- On the live cluster DB these were enabled manually on 2026-11-05; this makes
-- that reproducible. All idempotent.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS ltree;
