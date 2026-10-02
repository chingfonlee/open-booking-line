# Architecture Decision Records (ADR) — Episode 03: Availability & Confirmation Scheduling

> 本文件記錄 Episode 03 開發期間確立之重大架構、業務領域模型與技術選型決策。  
> 任何接續任務的 Agent 若對架構設計有疑問，以此文件之決策為準，無需重新爭辯或推翻。

---

## ADR-EP03-001: Request ≠ Reservation 領域分離

* **狀態**：Accepted
* **背景**：在農事服務（如果樹枝條粉碎、代耕）場景中，農友送出的預約申請往往受天候、地況與機具調度影響，需要合作社致電確認。
* **決策**：
  1. `service_requests` 僅代表農友提出的需求願望（Requested Preference），包含希望日期、偏好時段（上午/下午/都可以）與日期彈性。
  2. 正式排程一律由 `slot_reservations` 獨立記錄，代表合作社與農友雙方致電確認後的工作排程。
  3. 兩者徹底解耦，禁止在 `service_requests` 中儲存正式確認時間，避免雙頭資料不同步。

---

## ADR-EP03-002: Pending 申請不鎖定時段

* **狀態**：Accepted
* **背景**：若農友送出申請即自動鎖定時段，惡意或無效申請會導致時段瞬間被占滿，其他人無法預約。
* **決策**：
  1. 處於 `to_contact`（Pending）狀態的案件，**絕不**占用或扣除時段可用性。
  2. 允許多位農友同時針對相同日期與時段（例如 10/15 上午）提出申請。
  3. 時段僅在管理端正式建立 `active` 狀態之 `slot_reservations` 時才被鎖定。

---

## ADR-EP03-003: slot_reservations 為正式排程唯一真實來源 (Single Source of Truth)

* **狀態**：Accepted
* **背景**：正式排程（正式日期、正式時段、精確開工時間）若同時散落在 `service_requests` 與其他資料表，容易產生不一致。
* **決策**：
  1. 所有對外正式排程資訊（LINE 確認卡片、農友查詢進度卡片、管理端已確認列表）均以 `slot_reservations` 為唯一資料來源。
  2. `service_requests` 僅保留原始填單偏好供比對協調。

---

## ADR-EP03-004: MVP 碰撞規則（同一日期 + Broad Slot 最多一筆 Active Reservation）

* **狀態**：Accepted
* **背景**：Episode 03 第一版專注於單組作業機具/工班的核心排程邏輯，不處理多工隊並行。
* **決策**：
  1. Availability Collision Unit 固定為「日期 + Broad Slot（`morning` 或 `afternoon`）」。
  2. 同一日期與同一個 broad slot 最多僅能存在 **1 筆 `status = 'active'`** 的 Reservation（Invariant A）。
  3. 資料庫層級透過部分唯一索引（Partial Unique Index）嚴格防護。

---

## ADR-EP03-005: 案件唯一性（同一 Request 最多一筆 Active Reservation）

* **狀態**：Accepted
* **背景**：避免同一案件被兩位管理員同時或先後排定在兩個不同時間。
* **決策**：
  1. 同一 `request_id` 在任何時間點最多僅能關聯 **1 筆 `status = 'active'`** 的 Reservation（Invariant B）。
  2. 資料庫層級透過部分唯一索引保證此不變量。

---

## ADR-EP03-006: Availability 模式策略與 Legacy 漸進相容 (含 SSOT 封鎖同步)

* **狀態**：Accepted
* **背景**：升級 Ep03 時，商家若尚未設定每週營業時間，不能讓全系統突然不可預約；同時舊管理介面操作 `blocked_dates` 若無法與新表同步，會造成解除封鎖失效的「幽靈封鎖」問題。
* **決策**：
  1. 系統支援兩種模式：`legacy` 與 `managed`。
  2. **Legacy 模式**：農友端維持全週開放選擇，**但仍必須扣除被 Active Reservation 鎖定之時段**。
  3. **Managed 模式**：公式為 `Weekly Rules - Exceptions - Active Reservations - Past Dates`。
  4. 合作社管理員首次於後台明確儲存每週規則後，系統自動將模式切換為 `managed`。
  5. **單一真實來源 (SSOT) 與雙向同步防護**：
     - `availability_exceptions` 為新排程系統之單一真實來源。
     - 資料庫遷移時，透過 SQLite 觸發器 (`trg_sync_blocked_dates_delete` 與 `trg_sync_blocked_dates_insert`) 實現雙向同步：
       - 當舊 API 端點解除封鎖 (`DELETE FROM blocked_dates WHERE date = ?`) 時，觸發器自動刪除 `availability_exceptions` 中對應日期的紀錄，徹底解決舊封鎖解除後仍被新表封鎖的幽靈問題。
       - 當舊 API 新增封鎖時，觸發器自動寫入 `availability_exceptions`。
     - 後續 Ep03-5 升級後，以 `availability_exceptions` 為主要管理介面。

---

## ADR-EP03-007: 精確開工時間為管理員專用（排除午休，白名單約束）

* **狀態**：Accepted
* **背景**：農友無法自行決定調度機具與工班抵達的精確時間；且中午 12:00～13:00 為休息用餐時間，工班不在此時出工。
* **決策**：
  1. 農友端表單嚴格僅能選擇：`上午`、`下午`、`都可以`。
  2. 精確開工時間（`scheduled_start_time`）僅能由合作社管理員於電話確認後設定。
  3. **精確開工時間白名單（共 17 個合法時間點，排除 12:00 / 12:30 午休）**：
     - 上午（`morning`）：`08:00`, `08:30`, `09:00`, `09:30`, `10:00`, `10:30`, `11:00`, `11:30`（共 8 個時間點）。
     - 下午（`afternoon`）：`13:00`, `13:30`, `14:00`, `14:30`, `15:00`, `15:30`, `16:00`, `16:30`, `17:00`（共 9 個時間點）。
     - **午休禁令**：`12:00` 與 `12:30` 嚴格禁止作為開工時間，資料庫由 SQL CHECK 約束強行阻斷，API 亦設白名單檢驗。

---

## ADR-EP03-008: 確認通知為副作用 (Side Effect, Not Authoritative)

* **狀態**：Accepted
* **背景**：LINE Messaging API 可能因網路波動或使用者封鎖而推播失敗。
* **決策**：
  1. 資料庫交易與 Reservation 建立是權威來源。
  2. 確認成功後非同步嘗試推播 LINE 確認卡片；若推播失敗，**絕不可回滾已建立的 Reservation**。
  3. 系統記錄推播狀態，管理端可視需要手動重送。

---

## ADR-EP03-009: 完整生命週期狀態轉移矩陣、舊案件過渡確認與原子交易保障

* **狀態**：Accepted
* **背景**：需要完整定義狀態生命週期轉移圖，明確舊 `processing` 案件過渡處理方案，並在 D1/SQLite 層提供防孤兒、防繞過與改期交易保障。
* **決策**：
  1. **完整狀態轉移矩陣 (State Machine Matrix)**：
     | 原狀態 | 允許動作 | 對應專用端點 | 前置條件 | 目標狀態 | Reservation 處置 |
     | :--- | :--- | :--- | :--- | :--- | :--- |
     | `to_contact` | `confirm` | `POST /api/admin/requests/:id/confirm` | 無 active 預約且目標時段可用 | `confirmed` | 新增 1 筆 `active` 預約 |
     | `to_contact` | `cancel` | `POST /api/admin/requests/:id/cancel` | 無 active 預約 | `cancelled` | 維持 0 筆 |
     | `confirmed` | `start_work` | `POST /api/admin/requests/:id/start-work` | 必須具備 1 筆 active 預約 | `processing` | 保留該 active 預約 |
     | `confirmed` | `reschedule`| `POST /api/admin/requests/:id/reschedule` | 必須具備 1 筆 active 預約，目標新時段可用 | `confirmed` | 原預約改為 `released`，新增新時段 `active` 預約（原子交易） |
     | `confirmed` | `cancel` | `POST /api/admin/requests/:id/cancel` | 必須具備 1 筆 active 預約 | `cancelled` | 關聯 active 預約改為 `released`，釋放未來時段 |
     | `processing` (正常態) | `complete` | `POST /api/admin/requests/:id/complete` | 具備 active 預約 | `closed` | 保留歷史 reservation 作為存查 |
     | `processing` (正常態) | `cancel` | `POST /api/admin/requests/:id/cancel` | 具備 active 預約 | `cancelled` | 關聯 active 預約改為 `released`，釋出時段 |
     | **`processing` (舊版過渡)** | **`confirm`** | **`POST /api/admin/requests/:id/confirm`** | **查無任何 active 預約**（舊版無排程） | **`confirmed`** | **允許補建 1 筆 `active` 預約** |
     | **`processing` (舊版過渡)** | **`complete`** | **`POST /api/admin/requests/:id/complete`** | 查無 active 預約 | **`closed`** | 直接結案，無需 reservation |
     | **`processing` (舊版過渡)** | **`cancel`** | **`POST /api/admin/requests/:id/cancel`** | 查無 active 預約 | **`cancelled`** | 直接取消，無 reservation 釋放 |
     | `closed` | 無 | (終態) | - | - | 保留歷史排程記錄 |
     | `cancelled` | 無 | (終態) | - | - | 保留 released 排程記錄 |

  2. **既有 Ep01 `processing` 案件過渡處理機制**：
     - Ep03-0 盤點確認線上存在 5 筆舊 `processing` 案件，皆無 reservation 且無開工時間。
     - 規則：允許合作社管理員致電溝通後，使用 `/confirm` 端點為其「補建排程確認」；亦允許管理員直接完成（`/complete`）或取消（`/cancel`）。
     - 一旦補建預約完成，即納入標準生命週期，禁止再次 confirm。

  3. **D1 Batch 條件式更新與防孤兒預約 (Anti-Orphan Protection)**：
     - 所有排程確認與狀態轉移必須使用 D1 批次操作或交易，且必須包含條件式更新：
       ```sql
       -- 步驟 1: 條件更新 request 狀態
       UPDATE service_requests 
       SET status = 'confirmed', updated_at = datetime('now')
       WHERE id = ? AND (
         status = 'to_contact' OR 
         (status = 'processing' AND NOT EXISTS (SELECT 1 FROM slot_reservations WHERE request_id = ? AND status = 'active'))
       );
       -- 步驟 2: 建立 slot_reservations
       INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', datetime('now'));
       ```
     - 若步驟 1 影響行數為 0（例如案件已被重複確認或非合法狀態），整個批次回滾並拋出錯誤，**保證 0 筆孤兒 reservation 被新增**。
     - `slot_reservations` 宣告 `FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE`，資料庫層級保證不關聯不存在之 request。

  4. **改期原子性 (Atomic Reschedule)**：
     - 批次包含：(1) 舊預約狀態改為 `released`；(2) 插入新預約；(3) 更新 request 修改時間。
     - 若新時段發生碰撞，因部分唯一索引觸發錯誤，整個 D1 Batch/交易立即回滾，**舊預約維持 `active`，案件原排程完整保留**。

  5. **Bypass 阻斷**：
     - 通用 `PATCH /api/admin/requests/:id` 禁止變更任何狀態欄位 (`status`)，所有狀態轉移強制走上述專用生命週期 API。

---

## ADR-EP03-010: 統一業務時區為 Asia/Taipei 與可選日期閉區間邊界

* **狀態**：Accepted
* **背景**：Cloudflare Workers 預設為 UTC 時區，台灣清晨（UTC+8）容易跨日；且需要精確定義農友與管理員之可選日期邊界。
* **決策**：
  1. 系統時間基準統一強制換算為 `Asia/Taipei`（UTC+8）。
  2. **農友端預約視窗（閉區間 $[T + 1, T + 30]$）**：
     - 令台灣今日為 $T$。
     - `lead_time_days = 1`：農友最快可選日期為 **$T + 1$**（包含），當天 $T$ 嚴格不可選。
     - `booking_horizon_days = 30`：農友最遠可選日期為 **$T + 30$**（包含）。
     - 農友有效可選日期範圍為閉區間 **$[T + 1, T + 30]$**（兩端皆包含，共計 30 個日曆天）。
     - 農友選擇「都可以（`any`）」時，後端驗證只要該日期「上午」或「下午」有任一時段可用，即允許送單。
  3. **管理員電話排程視窗（閉區間 $[T, T + 60]$）**：
     - 合作社管理員電話確認或臨時工班調度時，**不受 `lead_time_days` 限制**，可排定「今天」$T$ 未過期時段。
     - 管理員嚴禁排定「過去日期」（$< T$）。
     - 管理員最遠排定日期為 **$T + 60$**（包含）。
