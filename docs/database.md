# Database — 資料庫說明

> 本文件說明 open-booking-line 的 Cloudflare D1 資料庫結構。
> 實際 Schema 定義以 `packages/backend/schema.sql` 為準。

---

## 概覽

open-booking-line 使用 **Cloudflare D1**（SQLite 架構）作為資料庫。

- **優點**：免費額度、零維運、邊緣節點低延遲
- **限制**：不支援所有 PostgreSQL 功能（如 JSONB、陣列型別）

---

## 資料表結構

### service_requests（服務申請單）

| 欄位 | 型別 | 說明 | 必填 |
| :--- | :--- | :--- | :--- |
| `id` | TEXT PK | 申請單號（`REQ-YYYYMMDD-10HEX`） | ✅ |
| `created_at` | TEXT | 建立時間（ISO8601） | ✅ |
| `updated_at` | TEXT | 更新時間（ISO8601） | ✅ |
| `contact_name` | TEXT | 聯絡姓名（≤50字） | ✅ |
| `phone` | TEXT | 聯絡電話 | ✅ |
| `service_type` | TEXT | 服務項目 | ✅ |
| `crop_type` | TEXT | 作物/服務種類 | ✅ |
| `area_size` | TEXT | 面積（組合字串，如「3 分」） | ✅ |
| `area_value` | TEXT | 面積數值 | 否 |
| `area_unit` | TEXT | 面積單位（分/甲/畝/坪） | 否 |
| `branch_volume` | TEXT | 枝條數量（少量/中量/大量/不確定） | 否 |
| `location_area` | TEXT | 服務地區 | ✅ |
| `location_address` | TEXT | 詳細地址（≤200字） | ✅ |
| `preferred_date` | TEXT | 希望日期（YYYY-MM-DD） | ✅ |
| `preferred_time_slot` | TEXT | 偏好時段（morning/afternoon/any） | ✅ |
| `date_flexibility` | TEXT | 日期彈性選項 | 否 |
| `notes` | TEXT | 備註（≤1000字） | 否 |
| `status` | TEXT | 狀態（to_contact/processing/closed） | ✅ |
| `admin_memo` | TEXT | 內部備註（⚠️ 不對使用者公開） | 否 |
| `line_user_id` | TEXT | LINE User ID（驗證後寫入） | 否 |

```sql
-- 完整 SQL 定義
CREATE TABLE IF NOT EXISTS service_requests (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service_type TEXT NOT NULL,
  crop_type TEXT NOT NULL,
  area_size TEXT NOT NULL,
  area_value TEXT,
  area_unit TEXT,
  branch_volume TEXT,
  location_area TEXT NOT NULL,
  location_address TEXT NOT NULL,
  preferred_date TEXT NOT NULL,
  preferred_time_slot TEXT NOT NULL,
  date_flexibility TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'to_contact',
  admin_memo TEXT,
  line_user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_preferred_date ON service_requests(preferred_date);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON service_requests(created_at DESC);
```

---

### blocked_dates（封鎖日期）

| 欄位 | 型別 | 說明 |
| :--- | :--- | :--- |
| `date` | TEXT PK | 日期（YYYY-MM-DD） |
| `reason` | TEXT | 封鎖原因 |
| `created_at` | TEXT | 設定時間（ISO8601） |

```sql
CREATE TABLE IF NOT EXISTS blocked_dates (
  date TEXT PRIMARY KEY,
  reason TEXT DEFAULT '當日服務站調配額滿',
  created_at TEXT NOT NULL
);
```

---

## 資料庫初始化

```bash
# 建立資料庫
npx wrangler d1 create your-db-name

# 建立資料表
npx wrangler d1 execute your-db-name --file=packages/backend/schema.sql
```

---

## 🔵 Planned — Database Customization（計畫中）

> 以下內容將在 YouTube Episode 05 詳細介紹：

### 新增欄位的安全流程

```bash
# 在 D1 中新增欄位（不影響現有資料）
npx wrangler d1 execute your-db-name --command "ALTER TABLE service_requests ADD COLUMN vehicle_plate TEXT;"
```

### Migration 原則（防損毀與向後相容）

- **只增不減**：優先使用 `ADD COLUMN`，避免刪除或重命名既有欄位導致舊版代碼報錯。
- **嚴禁未設預設值的 `NOT NULL`**：新增欄位**必須允許 `NULL` 或提供明確 `DEFAULT` 值**（例：`ALTER TABLE service_requests ADD COLUMN x TEXT DEFAULT NULL;`）。若設為 `NOT NULL` 且無預設值，未更新的前端送單時會導致整台資料庫寫入崩潰！
- **旁路交易隔離**：新欄位之後端處理邏輯需以 `try-catch` 隔離保護，絕不允許因為非核心欄位的格式錯誤破壞主要預約成立流程。
- 修改 Schema 前，**必須同步檢查 shared/types.ts、前端表單與後端驗證**。

---

## ⚠️ 安全注意事項

1. `admin_memo` 欄位只能在管理員 API 中使用，**不得回傳給一般使用者**
2. `line_user_id` 只寫入驗證過的 LINE User ID（不接受前端直接傳入）
3. 不要在程式碼中使用 `SELECT *`，應使用欄位白名單投影
4. 使用參數化查詢（Prepared Statements）防止 SQL Injection
