-- ====================================================================
-- Migration: Episode 03 - Availability & Confirmation Scheduling
-- Target: Cloudflare D1 (SQLite)
-- Safety: Additive & Non-destructive. Strictly preserves all existing data.
-- ====================================================================

-- 1. 系統設定表 (Availability Configuration)
CREATE TABLE IF NOT EXISTS availability_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 初始化預設值 (Legacy 模式，避免未設定前全系統無法預約)
INSERT OR IGNORE INTO availability_config (key, value, updated_at) VALUES
  ('mode', 'legacy', datetime('now')),
  ('lead_time_days', '1', datetime('now')),
  ('booking_horizon_days', '30', datetime('now'));

-- 2. 每週循環營業時段表 (Weekly Availability Rules)
-- day_of_week: 0 (週日) ~ 6 (週六)
-- slot_code: 'morning' | 'afternoon'
CREATE TABLE IF NOT EXISTS availability_rules (
  id TEXT PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  slot_code TEXT NOT NULL CHECK (slot_code IN ('morning', 'afternoon')),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  updated_at TEXT NOT NULL,
  UNIQUE(day_of_week, slot_code)
);

-- 初始化每週一至週五開放上午與下午，週六週日休息
INSERT OR IGNORE INTO availability_rules (id, day_of_week, slot_code, is_enabled, updated_at) VALUES
  ('rule_0_morning',   0, 'morning',   0, datetime('now')),
  ('rule_0_afternoon', 0, 'afternoon', 0, datetime('now')),
  ('rule_1_morning',   1, 'morning',   1, datetime('now')),
  ('rule_1_afternoon', 1, 'afternoon', 1, datetime('now')),
  ('rule_2_morning',   2, 'morning',   1, datetime('now')),
  ('rule_2_afternoon', 2, 'afternoon', 1, datetime('now')),
  ('rule_3_morning',   3, 'morning',   1, datetime('now')),
  ('rule_3_afternoon', 3, 'afternoon', 1, datetime('now')),
  ('rule_4_morning',   4, 'morning',   1, datetime('now')),
  ('rule_4_afternoon', 4, 'afternoon', 1, datetime('now')),
  ('rule_5_morning',   5, 'morning',   1, datetime('now')),
  ('rule_5_afternoon', 5, 'afternoon', 1, datetime('now')),
  ('rule_6_morning',   6, 'morning',   0, datetime('now')),
  ('rule_6_afternoon', 6, 'afternoon', 0, datetime('now'));

-- 3. 特定日期例外封鎖表 (Availability Exceptions)
-- 支援全天 (all)、上午 (morning)、下午 (afternoon)
CREATE TABLE IF NOT EXISTS availability_exceptions (
  id TEXT PRIMARY KEY,
  exception_date TEXT NOT NULL, -- YYYY-MM-DD
  slot_code TEXT NOT NULL CHECK (slot_code IN ('all', 'morning', 'afternoon')),
  reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(exception_date, slot_code)
);

-- 4. 正式排程預約表 (Slot Reservations) - 唯一真實來源
CREATE TABLE IF NOT EXISTS slot_reservations (
  id TEXT PRIMARY KEY,                       -- e.g. RSV-20261001-XXXX
  request_id TEXT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE, -- 關聯的 service_requests.id
  booking_date TEXT NOT NULL,                -- 正式服務日期 (YYYY-MM-DD)
  slot_code TEXT NOT NULL CHECK (slot_code IN ('morning', 'afternoon')),
  scheduled_start_time TEXT NOT NULL,        -- 精確開工時間
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
  created_at TEXT NOT NULL,
  released_at TEXT,
  notes TEXT,
  -- 嚴格時間白名單與上下午對應約束 (排除午休 12:00 / 12:30):
  CHECK (
    (slot_code = 'morning' AND scheduled_start_time IN ('08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30')) OR
    (slot_code = 'afternoon' AND scheduled_start_time IN ('13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'))
  )
);

-- 索引與約束：
-- 索引 1: 關聯查詢加速
CREATE INDEX IF NOT EXISTS idx_reservations_req ON slot_reservations(request_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON slot_reservations(booking_date, slot_code);

-- 核心約束 A (Invariant A): 同一日期 + broad slot 最多一筆 active reservation (碰撞防護)
CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_active_slot 
  ON slot_reservations(booking_date, slot_code) 
  WHERE status = 'active';

-- 核心約束 B (Invariant B): 同一 request 最多一筆 active reservation (案件唯一性)
CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_active_req 
  ON slot_reservations(request_id) 
  WHERE status = 'active';

-- 5. 既有 blocked_dates 兼容同步機制 (SSOT: availability_exceptions 為核心)
-- 5.1 將舊表既有資料匯入 availability_exceptions
INSERT OR IGNORE INTO availability_exceptions (id, exception_date, slot_code, reason, created_at)
  SELECT 'legacy_' || date, date, 'all', reason, created_at FROM blocked_dates;

-- 5.2 建立雙向同步觸發器：當舊端點操作 blocked_dates 時，自動同步至 availability_exceptions
-- 刪除舊封鎖時，同步刪除對應 exception，杜絕幽靈封鎖
CREATE TRIGGER IF NOT EXISTS trg_sync_blocked_dates_delete
AFTER DELETE ON blocked_dates
FOR EACH ROW
BEGIN
  DELETE FROM availability_exceptions WHERE exception_date = OLD.date;
END;

-- 新增舊封鎖時，同步建立 exception
CREATE TRIGGER IF NOT EXISTS trg_sync_blocked_dates_insert
AFTER INSERT ON blocked_dates
FOR EACH ROW
BEGIN
  INSERT OR IGNORE INTO availability_exceptions (id, exception_date, slot_code, reason, created_at)
  VALUES ('legacy_' || NEW.date, NEW.date, 'all', NEW.reason, NEW.created_at);
END;
