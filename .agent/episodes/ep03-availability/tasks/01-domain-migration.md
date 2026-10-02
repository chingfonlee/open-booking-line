# Ep03-1 — Domain Model, Migration & Recovery (領域模型與遷移程序)

## Goal (目標)
根據 Ep03-0 審計之真實結果，正式定義 Availability 與 Reservation 領域模型、建立 ADR、編寫 D1 遷移腳本、部分唯一索引（Partial Unique Indexes）、原子交易保障與資料庫復原程序。

---

## 必做項目 (Mandatory Items)

1. **確立 ADR (架構決策記錄)**：
   - 正式形成 ADR-EP03-001 至 ADR-EP03-010。
   - **狀態映射與完整轉移矩陣**：
     - 明訂舊狀態（`to_contact`, `processing`, `closed`）與新排程生命週期（`confirmed`, `cancelled`）之關係。
     - 確立合法的狀態轉移矩陣（State Machine Matrix），明訂各狀態在 `confirm`、`start_work`、`complete`、`cancel`、`reschedule` 之條件與結果。
     - 明確禁止將舊有 `processing` 直接當成已確認排程！
     - **舊版 processing 案件過渡處置**：明訂既有 5 筆無排程的舊 processing 案件可透過電話確認呼叫 `/confirm` 補建 1 筆 active reservation，或由管理員直接 `/complete` 結案或 `/cancel`。
   - **完成態與提前關閉處理**：
     - 已過期案件保留歷史紀錄，自然不影響未來時段。
     - **未來日期案件提前結案/取消 (Early Closed/Cancelled)**：明確規定若案件於排定日期到來前被關閉或取消，其關聯的 active reservation 必須釋放（設為 `released`），以釋出未來時段供其他農友預約。
   - **Availability 邊界與時間規範**：
     - 農友「都可以（`any`）」在後端驗證之判定方式（若上午或下午任一時段可用即允許送單）。
     - 上午 / 下午開工時間白名單：上午 08:00～11:30（8 個時段），下午 13:00～17:00（9 個時段）；**12:00 與 12:30 為午休時段，嚴格禁止作為開工時間**。
     - 時區強制以 `Asia/Taipei` 計算；Lead time（預約前置天數 1 天，當天不可選）、Booking horizon（開放預約天數 30 天）；農友端有效預約閉區間為 $[T+1, T+30]$（兩端皆包含）。管理員電話預約視窗為 $[T, T+60]$。
     - Legacy 模式下是否扣除 active reservations（明確規範：Legacy 模式農友仍可選各時段，但被 Active Reservation 鎖定之時段必須扣除）。
2. **Schema Design**：
   - 設計 `availability_rules`、`availability_exceptions`（透過 SQLite 觸發器雙向同步舊 `blocked_dates`，杜絕幽靈封鎖）、`slot_reservations`（含 `request_id` 外鍵約束與開工時間白名單 CHECK）與 availability configuration 相關資料表結構。
3. **Reservation 欄位與唯一性規範**：
   - 包含 `id`, `request_id`, `booking_date`, `slot_code` (`morning` | `afternoon`), `scheduled_start_time`, `status` (`active` | `released`), `created_at`, `released_at` 等。
   - 保證兩層唯一性（Invariant A: 同一 date + slot 最多一筆 active；Invariant B: 同一 request 最多一筆 active）。
4. **Migration (遷移腳本) 與 Backfill 策略**：
   - 依據 Ep03-0 盤點之真實線上資料決定回補策略。
   - 由於 Ep01 僅有希望日期，**無法可靠自動推論正式開工時間**；若無足夠確切證據，絕不自動猜測建立 Reservation，應保留為待處理狀態交由人工於後台確認（Fail-Closed 原則）。
5. **原子交易保障與並行防護設計**：
   - **改期原子性**：明訂 D1/SQLite 交易或條件式更新策略（Release Old + Create New + Update Request 在同一批次內執行；任一步驟碰撞失敗則全數回滾，保留舊預約有效）。
   - **防孤兒條件**：明確定義「確認非 Pending 案件或重複確認時，條件更新 0 筆觸發整批中斷回滾，操作失敗且不得新增 reservation，並完整保留既有合法 reservation」。外鍵保證不存在之案件無法排程。
   - **設計與執行界線 (Design vs Execution Boundary)**：
     - **在 Task 1 方案獲得人類正式審閱通過前，本 Task 僅產出設計規格、SQL 腳本與本地測試，嚴禁對正式線上 D1 執行任何 DDL、Migration 或寫入操作**！
6. **DB Recovery**：
   - 建立資料庫冷備份程序、隔離回滾腳本（獨立於 migrations 目錄至 `packages/backend/scripts/recovery/`）、雙軌復原 SOP（區分「未啟用遷移撤銷」與「已上線營運資料軟降級」）與 Schema 版本策略。

---

## Completion Criteria (完工門檻)
- Schema、Migration SQL 腳本、Rollback 程序、ADRs、交易策略與測試設計全數通過審閱。
- 尚未開始對線上資料庫執行變更，尚未開始農友端與管理端介面修改。
