-- Schema for Cloudflare D1
CREATE TABLE IF NOT EXISTS service_requests (
  id TEXT PRIMARY KEY,                       -- 如 REQ-20260922-001
  created_at TEXT NOT NULL,                  -- ISO8601
  updated_at TEXT NOT NULL,                  -- ISO8601
  
  -- 農友與農地資訊
  contact_name TEXT NOT NULL,                -- 姓名
  phone TEXT NOT NULL,                       -- 聯絡電話
  service_type TEXT NOT NULL,                -- 服務項目
  crop_type TEXT NOT NULL,                   -- 作物種類
  area_size TEXT NOT NULL,                   -- 預估面積 (完整字串如 '3 分')
  area_value TEXT,                           -- 面積數值 (如 '3', '0.5')
  area_unit TEXT,                            -- 面積單位 ('分' | '甲' | '畝' | '坪')
  branch_volume TEXT,                        -- 枝條數量 ('少量' | '中量' | '大量' | '不確定')
  location_area TEXT NOT NULL,               -- 區域
  location_address TEXT NOT NULL,            -- 地段/地號/地址
  
  -- 預約期望
  preferred_date TEXT NOT NULL,              -- 希望施工日期 (YYYY-MM-DD)
  preferred_time_slot TEXT NOT NULL,         -- 偏好時段 ('morning' | 'afternoon' | 'any')
  date_flexibility TEXT,                     -- 日期彈性 ('僅此日期方便' | '前後 3 天皆可' | '日期可以再與我聯絡確認')
  notes TEXT,                                -- 備註補充說明
  
  -- 狀態管理
  status TEXT NOT NULL DEFAULT 'to_contact', -- 'to_contact' | 'processing' | 'closed'
  admin_memo TEXT,                           -- 站所內部備註
  
  -- LINE 識別
  line_user_id TEXT                          -- 送單者的 LINE UID
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_preferred_date ON service_requests(preferred_date);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON service_requests(created_at DESC);

-- 手動關閉日期黑名單表
CREATE TABLE IF NOT EXISTS blocked_dates (
  date TEXT PRIMARY KEY,                     -- YYYY-MM-DD
  reason TEXT DEFAULT '當日服務站調配額滿',
  created_at TEXT NOT NULL
);
