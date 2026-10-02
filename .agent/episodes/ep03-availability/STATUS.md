# Episode 03 Implementation Status: Availability & Confirmation Scheduling

> 本文件為 Multi-Agent 協同作業之唯一即時狀態機。  
> 狀態定義：`Pending`（等待前置完成）、`Ready`（可立即接手執行）、`In Progress`（正在執行）、`Blocked`（遭遇阻礙）、`Complete`（驗收通過已結案）。  
> 任何 Agent 於完成所屬 Task 後，必須更新本文件。

---

## Current Status (當前狀態)

* **Current Task**: `Ep03-7: End-to-End Acceptance & Freeze (Complete)`
* **Episode Status**: `Complete`
* **Next Task**: `None (Episode 03 Fully Verified & Frozen)`

---

## Tasks Progress (任務進度表)

| Task ID | 名稱 | 狀態 | 負責 Agent / 交付紀錄 |
| :--- | :--- | :--- | :--- |
| **Ep03-0** | Current State & Data Audit | **Complete** | 完成現狀結構盤點與線上 D1 (43 筆) 唯讀審計，產出 ep03-current-state.md |
| **Ep03-1** | Domain Model, Migration & Recovery | **Complete** | 完成 ADR-001~010、0002 遷移/隔離回滾腳本、RECOVERY.md 與 11 項單元測試 (11/11 pass) |
| **Ep03-2** | Availability Engine & Read API | **Complete** | 完成 availability.ts 引擎模組、GET /api/availability 路由與 12 項單元整合測試 (12/12 pass) |
| **Ep03-3** | Farmer Booking Flow | **Complete** | 前端農友申請表單與防護（僅上午/下午/都可以，表單提交驗證，6/6 測試 pass） |
| **Ep03-4** | Confirmation & Reservation Lifecycle | **Complete** | 管理者電話確認排程、碰撞偵測、原子改期與防孤兒預約機制（10/10 測試 pass） |
| **Ep03-5** | Merchant Availability Settings | **Complete** | 合作社管理員每週營業時段設定、特定公休例外維護、漸進模式無縫切換與衝突警示機制（8/8 測試 pass） |
| **Ep03-6** | Confirmation Card & Display Consistency | **Complete** | 正式預約確認 LINE 卡片即時推播（支援確認與改期）、所有查詢介面顯示一致性更新（7/7 測試 pass） |
| **Ep03-7** | End-to-End Acceptance & Freeze | **Complete** | 21 項自動化案例（Case A~U 22/22 pass）、人類實機 10 項指標全數通過、能力登錄、文檔同步與版本凍結 |

---

## Current Verified Outputs (已驗證產物登錄)

### Ep03-0:
* **交付產物**：`.booking/audits/ep03-current-state.md`（受到 `.gitignore` 嚴格保護）
* **審計成果**：
  * **線上 D1 資料庫**：`xingnong-db` (43 筆真實申請單，0 筆 blocked_dates)。
  * **狀態分布**：`to_contact` 26 筆 (60.5%)、`processing` 5 筆 (11.6%)、`closed` 12 筆 (27.9%)、`confirmed` 0 筆 (0%)。
  * **時段分布**：`morning` 29 筆 (67.4%)、`any` 11 筆 (25.6%)、`afternoon` 3 筆 (7.0%)。
  * **Backfill 決策依據**：現有 5 筆 `processing` 案件中 3 筆為 `any` 且皆無確切開工時間，證實**不可自動回補 active reservation**（Fail-Closed 原則）。
  * **Bypass 弱點確認**：確認 `PATCH /api/admin/requests/:id` 可直接更新 status，需於後續任務重構為專用生命週期 API。

### Ep03-1:
* **架構決策紀錄 (ADRs)**：[DECISIONS.md](DECISIONS.md)（ADR-EP03-001 至 ADR-EP03-010 修訂完成）：
  * **完整狀態轉移矩陣**：列出 `to_contact`, `confirmed`, `processing`, `closed`, `cancelled` 在 `confirm`, `start_work`, `complete`, `cancel`, `reschedule` 下之條件與 Reservation 處置。
  * **舊版 processing 案件過渡處置**：明確規定線上既有 5 筆無排程之舊 `processing` 案件可透過電話溝通後呼叫 `/confirm` 補建 1 筆 active reservation，或直接結案（`/complete`）/取消（`/cancel`）。
  * **精確開工時間白名單**：上午 08:00～11:30 (8 個時段)、下午 13:00～17:00 (9 個時段)，嚴格排除 12:00 與 12:30 午休時間。
  * **日期邊界定義**：農友端可選閉區間 $[T+1, T+30]$（兩端皆含）；管理員電話預約視窗 $[T, T+60]$（兩端皆含，禁止過去日期）。
  * **單一真實來源 (SSOT) 與雙向同步**：`availability_exceptions` 為核心，舊 `blocked_dates` 透過 DB 觸發器雙向聯動，消除幽靈封鎖。
* **D1 Schema 遷移腳本**：[0002_ep03_availability_schema.sql](../../../packages/backend/migrations/0002_ep03_availability_schema.sql)（純累加、零破壞性，包含外鍵約束 `REFERENCES service_requests(id) ON DELETE CASCADE`、開工時間白名單 CHECK 約束、部分唯一索引 `idx_uniq_active_slot` 與 `idx_uniq_active_req`、以及雙向同步觸發器 `trg_sync_blocked_dates_delete` 與 `trg_sync_blocked_dates_insert`）。
* **D1 回滾隔離腳本與災難復原指引**：
  * [0002_rollback_ep03.sql](../../../packages/backend/scripts/recovery/0002_rollback_ep03.sql)（自 `migrations/` 目錄隔離至 `packages/backend/scripts/recovery/`，避免被 wrangler 自動執行）。
  * [RECOVERY.md](../../../packages/backend/scripts/recovery/RECOVERY.md)（標準維運 SOP：規範遷移前強制冷備份、情境 A 驗證失敗撤銷、情境 B 生產事故禁止刪表而改採 `mode = 'legacy'` 軟降級與資料保全匯出）。
* **單元測試驗證**：[domain-migration.test.mjs](../../../tests/availability/domain-migration.test.mjs)（**11/11 測試通過**：涵蓋基準初始化、外鍵約束阻斷、午休 CHECK 拒絕、觸發器解除幽靈封鎖、Invariant A/B 碰撞阻斷、D1 Batch 條件更新防孤兒、舊 processing 補建排程過渡確認、原子改期碰撞回滾保留原案、提前取消釋放、以及隔離回滾乾淨卸載）。
* **線上 D1 保護原則**：嚴格遵守審閱前「禁止對遠端正式 D1 執行任何 DDL 或寫入操作」，全部驗證皆於本地 Node.js 記憶體 SQLite 完成。

### Ep03-2:
* **後端可用性計算引擎**：[availability.ts](../../../packages/backend/src/availability.ts)
  * 嚴格落實單一計算公式：`Weekly Rules - Exceptions - Active Reservations - Past Dates = Selectable Broad Slots`。
  * **Pending 案件絕不扣除時段**（審查驗證通過）。
  * 支援 `legacy`（全週開放扣除預約）與 `managed`（每週規則 + 例外 + 預約）模式無縫切換。
  * 嚴格時區計算：以 `Asia/Taipei`（UTC+8）計算「今天」，農友端預約閉區間為 $[T+1, T+30]$，管理員預約視窗為 $[T, T+60]$。
  * 提供 `computeAvailability` 批次查詢與 `isSlotAvailable` 快速單點校驗函式。
* **查詢端點 Read API**：[index.ts](../../../packages/backend/src/index.ts)
  * `GET /api/availability`：支援單日 `?date=`、範圍 `?from=&to=`、月份 `?month=` 以及預設全視窗查詢。
  * 支援管理者身份（透過 `Authorization` 或 `x-line-token` 驗證）自動擴展至管理員排程視窗。
* **單元與整合測試套件**：[availability-engine.test.mjs](../../../tests/availability/availability-engine.test.mjs)
  * **12/12 項測試全數 PASS**（涵蓋時區計算、Legacy 模式開放、整日封鎖、上午封鎖、正式預約扣除、Pending 不占時段、過去與前置日期邊界、視窗超時、Managed 模式規則生效、快速校驗 helper、多日/月份範圍查詢、Hono HTTP 端點整合測試）。

### Ep03-3:
* **前端農友預約表單強化**：[ApplyForm.tsx](../../../packages/frontend/src/components/ApplyForm.tsx)
  * 即時串接 `GET /api/availability`，依據後端可用狀態自動動態禁用已滿時段，顯示「時段已滿」徽章。
  * 明確展示防爭議聲明：「*此為希望服務時段，實際服務日期與開工時間將由服務站聯絡確認。*」。
  * 嚴格僅提供「上午」、「下午」、「都可以」三個大時段選項，**0% 精確時間選擇器**。
  * 日期選擇器限定在 $[T+1, T+30]$ 閉區間之合法日期。
* **後端提交防護與重校驗**：[index.ts](../../../packages/backend/src/index.ts)
  * `POST /api/requests` 於收到請求時，呼叫 `isSlotAvailable` 進行後端原子校驗。
  * 若目標時段已被預約或封鎖，精確返回 409 Conflict 與專屬錯誤碼 `SLOT_UNAVAILABLE`，拒絕無效建立。
  * 允許相同日期與時段有多筆 pending（`to_contact`）申請（並發保護，Pending 不鎖時段）。
* **單元與合約測試驗證**：[farmer-booking-flow.test.mjs](../../../tests/availability/farmer-booking-flow.test.mjs)
  * **6/6 項測試全數 PASS**（涵蓋大時段合法性校驗、精確時間提交阻斷、已預約時段 409 拒絕、上午下午皆滿時 `any` 拒絕、多筆 Pending 同時並存安全、前置時間與過去日期阻斷、前端 UI 靜態合約審計）。

### Ep03-4:
* **生命週期專用端點與 Bypass 阻斷防護**：[index.ts](../../../packages/backend/src/index.ts)
  * **通用 PATCH 阻斷 (Case R)**：`PATCH /api/admin/requests/:id` 嚴格禁止帶入 `status` 欄位（返回 400 與 `STATUS_MUTATION_FORBIDDEN`），僅允許更新 `admin_memo`。
  * **開工時間白名單檢核 (Case H)**：白名單限制上午 08:00～11:30、下午 13:00～17:00（30 分鐘間隔），嚴格禁止午休（12:00/12:30）。
  * **確認排程端點 (`POST /api/admin/requests/:id/confirm`)**：待聯絡轉已確認，以條件更新保證防孤兒預約；時段碰撞拋出 409 `SLOT_COLLISION`。
  * **施工與結案端點 (`/start-work`, `/complete`)**：`confirmed` 轉 `processing`、`processing` 轉 `closed`，保留歷史 Reservation 記錄。
  * **原子改期端點 (`/reschedule`, Case P/I)**：以 D1 批次操作原子執行舊預約釋出、新預約插入與案件更新；若目標時段碰撞，因部分唯一索引立即交易回滾，**原預約依然保持 active 完好**。
  * **取消與釋放時段 (`/cancel`, Case J)**：案件狀態轉 `cancelled`，同步釋出關聯 active reservation。
  * **舊版 processing 案件過渡處置**：無排程之舊 `processing` 案件可透過 `/confirm` 補建排程，亦可直接 `/complete` 或 `/cancel`。
  * **通知失敗副作用防護 (ADR-008)**：推播非同步執行，推播失敗絕不回滾已建立之正式 Reservation。
  * **查詢列表左連接升級**：`GET /api/admin/requests` 與 LINE 查詢進度 webhook 皆左連接 `slot_reservations`，輸出正式排程日期與開工時間。
* **管理端確認與排程介面**：[AdminDashboard.tsx](../../../packages/frontend/src/components/AdminDashboard.tsx)
  * 提供「待聯絡、已確認、處理中、已結案、已取消、全部」狀態分類分頁與徽章。
  * 待聯絡案件展示正式服務日期、時段與開工時間白名單下拉選單，一鍵確認排程。
  * 已確認案件提供「🚜 開始施工」、「📅 原子改期」彈跳對話框與「取消預約」專用操作。
### Ep03-5:
* **後端可用性設定與管理端點**：[index.ts](../../../packages/backend/src/index.ts)
  * `GET /api/admin/availability-settings`：回傳系統設定 (`mode`, `lead_time_days`, `booking_horizon_days`)、14 個每週開放時段規則矩陣與所有特定日期公休例外清單。
  * `PUT /api/admin/availability-rules`（Case U 漸進模式轉換）：
    * 支援批次更新每週 14 個區間開放狀態與天數參數。
    * **Fail-Closed 防呆防護**：若管理員試圖停用所有 14 個時段，立即回傳 400 阻斷儲存。
    * 首次合法儲存時，以 D1 批次操作原子切換 `availability_config.mode` 為 `managed`。
  * `GET /api/admin/availability-exceptions/check-conflict`（Case L 衝突警示）：
    * 查詢目標日期與時段內是否有狀態為 `active` 的正式預約排程。
    * 即時回傳衝突筆數、預約人名稱、電話、服務項目與專屬警告文字。
  * `POST /api/admin/availability-exceptions`：新增例外封鎖（支援全天 `all`、上午 `morning`、下午 `afternoon` 與備註），若為全天同步雙向寫入 `blocked_dates` 相容舊版。
  * `DELETE /api/admin/availability-exceptions/:id`：刪除公休例外並解除封鎖，恢復時段可預約狀態。
* **管理端時段規則與公休設定 UI**：[AdminDashboard.tsx](../../../packages/frontend/src/components/AdminDashboard.tsx)
  * 頂層頁籤切換器：「申請單管理」與「時段規則與公休設定」。
  * **系統模式與參數卡片**：即時指示 `Managed` 或 `Legacy` 模式徽章，支援微調 `lead_time_days` 與 `booking_horizon_days`。
  * **每週固定開放時段矩陣 (14 區間)**：提供週一至週日、上午與下午的複選切換；一鍵儲存並防呆防護。
  * **特定日期公休例外維護 (Case L)**：
    * 新增公休日期、時段與原因表單。
    * 即時衝突偵測回饋，當目標日期存在預約排程時展示黃色警示橫幅與農友預約清單。
    * **非破壞性保全不變量**：封鎖僅防止新農友預約，**絕不自動取消或刪除既有預約排程**。
    * 公休清單展示與一鍵垃圾桶解除封鎖。
* **單元與合約測試驗證**：[merchant-settings.test.mjs](../../../tests/availability/merchant-settings.test.mjs)
  * **8/8 項測試全數 PASS**（涵蓋基準模式初始化、Fail-Closed 全關阻斷、自訂每週規則原子切換 Managed 模式、衝突檢測準確性、新增公休不損壞既有預約、解除封鎖時段恢復開放、前端管理介面靜態合約審計）。
### Ep03-6:
* **正式排程確認與改期 LINE Flex 卡片推播**：[line.ts](../../../packages/backend/src/line.ts)
  * `generateScheduledConfirmationFlex` 函式：
    * 顯示站所名稱與「🎉 預約排程已正式確認」（改期時顯示「📅 預約排程已更新 (改期)」）。
    * 展示正式預約單號、服務項目、作物/面積、正式確認日期（`booking_date` 與時段文字）。
    * **精確開工時間唯一真實來源**：直接提取 `reservation.scheduled_start_time` 並標註「準時抵達」。
    * 施作地點與服務站提醒說明，並附帶一鍵開啟 LIFF 查詢進度按鈕。
  * **非同步副作用防護 (ADR-008)**：推播操作於確認與改期端點以 `c.executionCtx.waitUntil` 非同步背景執行，推播失敗（網路異常或農友封鎖）**絕不回滾已建立之正式 Reservation**。
* **跨端介面顯示一致性更新 (Single Source of Truth: `slot_reservations`)**：
  * **管理端查詢 API (`GET /api/admin/requests`)**：
    * SQL 查詢強制以 `LEFT JOIN slot_reservations s ON r.id = s.request_id AND s.status = 'active'` 提取正式排程 `scheduled_date`、`scheduled_slot_code` 與 `scheduled_start_time`。
  * **LINE 官方帳號農友進度查詢 Webhook**：
    * 查詢 SQL 同步採用左連接 `slot_reservations (status = 'active')` 提取正式排程資訊。
    * 卡片標題與日期列自動動態切換：未確認（`to_contact`）顯示「希望日期：{preferred_date}」；已確認（`confirmed` / `processing`）顯示「確認日期：{scheduled_date}」並增列「開工時間：{scheduled_start_time} 準時抵達」。
    * 底部說明動態帶出確切開工時間與日期，嚴格過濾站所內部機密備註 (`admin_memo`)。
  * **管理端儀表板 UI (`AdminDashboard.tsx`)**：
    * 案件清單卡片清楚展示綠色「正式排程：{scheduled_date} {scheduled_start_time} 開工」徽章。
    * 抽屜詳情頁展示「正式排程已鎖定」藍色資訊卡與開工時間。
* **單元與合約測試驗證**：[confirmation-card.test.mjs](../../../tests/availability/confirmation-card.test.mjs)
  * **7/7 項測試全數 PASS**（涵蓋確認卡片結構/開工時間驗證、改期卡片標題/內容適配、進度查詢卡片已排程動態開工時間展示、待聯絡申請單無開工時間保護、後端 index.ts SQL 左連接靜態合約審計、管理端 UI 一致性審計）。

### Ep03-7:
* **端對端 21 項驗收套件 (Case A ~ U)**：[e2e-acceptance.test.mjs](../../../tests/availability/e2e-acceptance.test.mjs)
  * **22/22 項驗收測試全數 PASS**（包含 21 個獨立案例與測試容器，100% 確定性通過）：
    * **Case A**：農友 A 與 B 同時送出 10/15 上午 Pending 均成功（Pending 不占時段）。
    * **Case B**：管理員確認 A（10/15 上午 09:30），Reservation 建立、A 轉 confirmed。
    * **Case C**：新農友查詢 10/15 上午不再可選（時段鎖定驗證）。
    * **Case D**：管理員嘗試確認 B 於 10/15 上午 ➔ 衝突拒絕（Collision 驗證）。
    * **Case E**：真實並行同時確認 10/15 上午 ➔ 一成功一衝突（實體並行競爭）。
    * **Case F**：同一案件同時確認至不同時間 ➔ 僅能成功一筆 active reservation（案件唯一性 Invariant B）。
    * **Case G**：取消之案件嘗試確認 ➔ 失敗且不得產生 active reservation。
    * **Case H**：開工時間檢驗（白名單：上午 08:00~11:30、下午 13:00~17:00 每 30 分鐘合法；07:30/09:15/12:00/12:30 等午休與界外時間非法拒絕）。
    * **Case I**：改期驗證（舊 released，新 active，系統中僅一筆 active）。
    * **Case J**：已確認案件取消 ➔ 釋放 reservation，時段重新開放。
    * **Case K**：封鎖 10/20 上午 ➔ 農友無法送單。
    * **Case L**：封鎖已有預約之日期 ➔ 警告提示且不自動取消既有 reservation。
    * **Case M**：LINE 確認卡片日期時間與 reservation 100% 一致。
    * **Case N**：LINE 推播失敗時 reservation 維持 confirmed (副作用隔離)。
    * **Case O**：農友端 UI 100% 不存在確切時間選擇器。
    * **Case P**：改期碰撞防護 - 案件改期至已被占用之時段 ➔ 改期失敗，且原預約依然保持 active 完好。
    * **Case Q**：重複確認冪等/防護 - 已確認案件再次收到確認請求 ➔ 阻擋操作，不新增多餘 reservation。
    * **Case R**：通用更新 Bypass 阻斷 - PATCH `/api/admin/requests/:id` 禁止帶入 status 欄位。
    * **Case S**：時區跨日邊界 - 以 Asia/Taipei 計算 $[T+1, T+30]$ 閉區間判定。
    * **Case T**：遷移失敗回滾 - 隔離腳本乾淨卸載 Ep03 表格與觸發器。
    * **Case U**：Legacy/Managed 模式切換 - Legacy 扣除預約，Managed 全面套用每週規則與例外。
* **人類實機 10 項查核門禁 (Human Acceptance Gate)**：全數 10 項指標經靜態與單元對比確認通過。
* **專案能力登錄**：`.booking/project-state.json` 正式登錄 `booking-availability: verified`。
* **全庫自動化驗證**：
  * 全庫自動化測試共計 **117 項 100% PASS**（37 Rich Menu + 11 Domain Migration + 12 Availability Engine + 6 Farmer Booking Flow + 10 Confirmation Lifecycle + 8 Merchant Settings + 7 Confirmation Card + 22 E2E Acceptance Case A~U + 4 測試容器）。
  * 前端 (`tsc -b && vite build`) 與後端 (`tsc --noEmit`) 零錯誤編譯通過。
* **公開文檔同步**：
  * `README.md` 更新 Ep03 為 Stable。
  * `CHANGELOG.md` 發布 v1.2.0。
  * `docs/episodes/ep03-availability/README.md` 正式建立。

---

## Known Issues (已知問題與障礙)

* 無。

---

## Handoff Rule (交接規則)

1. 當前執行的 Agent **嚴禁跳級執行未標記為 `Ready` 的任務**。
2. 當前任務若遭遇外部錯誤或阻礙，將狀態改為 `Blocked` 並於「Known Issues」詳細記錄。
3. 唯有在當前任務所定義之測試與交付產物全部完成後，方可將當前任務標記為 `Complete`，並將下一個任務由 `Pending` 改為 `Ready`。
