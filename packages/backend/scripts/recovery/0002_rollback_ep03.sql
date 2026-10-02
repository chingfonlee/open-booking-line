-- ====================================================================
-- Rollback / Recovery: Episode 03 - Availability & Confirmation Scheduling
-- Target: Cloudflare D1 (SQLite)
-- Safety: Safely drops Ep03 added structures and restores clean Ep01/Ep02 baseline.
-- NOTE: This file is intentionally placed outside packages/backend/migrations/
--       so that wrangler d1 migrations apply does not execute it during migration.
-- ====================================================================

-- 1. 刪除約束索引
DROP INDEX IF EXISTS idx_uniq_active_req;
DROP INDEX IF EXISTS idx_uniq_active_slot;
DROP INDEX IF EXISTS idx_reservations_date;
DROP INDEX IF EXISTS idx_reservations_req;

-- 2. 刪除新建立的排程與設定表
DROP TRIGGER IF EXISTS trg_sync_blocked_dates_delete;
DROP TRIGGER IF EXISTS trg_sync_blocked_dates_insert;
DROP TABLE IF EXISTS slot_reservations;
DROP TABLE IF EXISTS availability_exceptions;
DROP TABLE IF EXISTS availability_rules;
DROP TABLE IF EXISTS availability_config;

-- 註：舊有 service_requests 與 blocked_dates 保持完整無缺。
