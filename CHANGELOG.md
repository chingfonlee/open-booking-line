# 更新日誌 (Changelog)

本專案遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/) 與 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/) 規範。

---

## [Unreleased]

### 規劃中 (Planned)
- **Episode 04 — Service Catalog**：多服務項目與動態服務類別管理。
- **Episode 05 — Notification & Broadcast**：多渠道通知與排程提醒加固。

---

## [1.2.2] - Episode 01 — Smart DB Setup, Multi-Tenant Isolation & Anti-Ghost Submission (2026-10-03)

能力演進：`booking-core` 資料庫智慧引導、多官方帳號隔離防呆與步驟 4 送單安全加固

### Added (新增能力與工具)
- **智慧資料庫配置與多租戶隔離腳本 (`scripts/setup-db.js`, `npm run setup:db`)**：
  - **既有資料庫探測與互動確認**：自動呼叫 `wrangler d1 list`，當 Cloudflare 帳號內已存在其他 D1 時，主動提供「建立全新獨立 DB (推薦)」與「沿用既有 DB」選項，徹底杜絕不同店家/官方帳號共用同一個 DB 造成的資料混雜與污染。
  - **自動化綁定與結構遷移**：自動解析資料庫 UUID 寫入 `packages/backend/wrangler.toml` 並自動套用 `schema.sql` 與 Ep03 時段表格。
- **Pre-flight 關鍵安全與防呆檢核**：
  - **LINE 雙重 ID 一致性檢驗**：自動比對 `LIFF_ID` 前 10 碼是否等於 `LINE_LOGIN_CHANNEL_ID`，阻斷 ID 錯位（如 431 vs 419）引發的 LINE OAuth 驗簽失敗、收不到卡片與無法查詢。
  - **Worker 名稱覆蓋檢測**：檢查目標 Worker 是否已在 Cloudflare 運行，防範多專案部署時意外覆蓋既有服務站。
  - **Turnstile 狀態檢查**：自動檢視 `TURNSTILE_SECRET_KEY` 配置狀態並提示建立。
- **步驟 4 核對送出防幽靈送單與連點防護 (`canSubmitForm`)**：
  - **解耦表單原生 Submit**：`<form onSubmit={(e) => e.preventDefault()}>`，避免瀏覽器 Enter 鍵或 IME 中文選字確認穿透引發自動送單。
  - **React Key DOM 節點隔離**：步驟 3「下一步」（`key="btn-next-step"`）與步驟 4「確認送出」（`key="btn-submit-step"`）強制切換 DOM 節點，防止快速連點誤命中。
  - **500ms 換步安全冷卻時間**：進入步驟 4 的 500ms 內忽略送單請求，徹底阻絕連按誤觸。
- **單元測試體系擴充**：
  - 新增 `tests/setup-db/setup-db.test.mjs`（7 項測試）與 `apply-form.test.mjs` 送單防護測試（6 項測試），全專案測試增至 **155/155 PASS**。

---

## [1.2.1] - Episode 01 — Wizard Form & Accessibility Upgrade (2026-10-02)

快照標籤：[`ep01-wizard-form`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep01-wizard-form)  
能力演進：`booking-core` 人體工學、隱私草稿與 WCAG 無障礙強化

### Added (新增與優化)
- **4 步驟分段預約導覽精靈 (Wizard Form, 樣式 C)**：
  - 步驟重構：將原本一頁式表單拆分為「1. 需求項目 ➔ 2. 地點時段 ➔ 3. 聯絡資料 ➔ 4. 核對送出」。
  - 確認頁跳轉修改（`returnToReview`）：第 4 步總覽卡片可一鍵跳轉修改任一分區，完成後直接返回核對頁。
  - 路由防跳步保護（`formSteps.ts`）：結合 URL Hash（`#step-1` ~ `#step-4`）與 History API，手機/LINE 返回鍵精準退回上一步，防止跳步繞過必填。
- **農家共用手機隱私草稿保護 (`formDraft.ts`)**：
  - 版本控管（`version: 1`）與自最後修改起算 7 天過期自動清理。
  - 開啟頁面時主動詢問「繼續填寫」或「重新開始」，防止家庭成員意外查看他人個資。
  - 底部防誤觸清空草稿按鈕與送單成功自動清除。
- **WCAG 無障礙與長者友善規範**：
  - 解鎖雙指無障礙縮放（移除 `user-scalable=no` 與 `maximum-scale=1.0`）。
  - 按鈕觸控熱區 $\ge 48\text{px}$、輸入框字級 $\ge 16\text{px}$（防 iOS 聚焦自動放大破版）。
  - 換步焦點自動移至標題，驗證失敗自動聚焦首個錯誤欄位。
  - 完整標註 `role="progressbar"`、`aria-valuenow`、`aria-valuetext` 與 `aria-live` 狀態朗讀。
- **單元測試體系擴充**：
  - 新增 `tests/apply-form/apply-form.test.mjs`（19 項單元測試），全專案測試增至 **142/142 PASS**。

---

## [1.2.0] - Episode 03 — Availability & Confirmation Scheduling (2026-10-02)

快照標籤：[`ep03-availability`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep03-availability)  
能力登錄：`booking-availability` (Verified)

### Added (新增能力)
- **Request ≠ Reservation 領域分離架構**：
  - 農友端僅能提出寬鬆偏好時段（上午 / 下午 / 都可以），未經確認前絕不占用時段（Pending 不鎖時段）。
  - 管理端電話確認後指定正式日期、正式 broad slot 與白名單開工時間，建立正式 `slot_reservations` 並原子鎖定。
- **後端 Availability 計算引擎 (`availability.ts`)**：
  - 核心公式：`Weekly Rules - Exceptions - Active Reservations - Past Dates = Selectable Broad Slots`。
  - 支援 `Legacy`（相容舊全週開放）與 `Managed`（嚴格營業規則矩陣）漸進切換。
  - 統一業務時區為 `Asia/Taipei`（UTC+8），精確定義農友預約閉區間 $[T+1, T+30]$ 與管理員排程視窗 $[T, T+60]$。
- **D1 資料庫健全性架構 (Migration 0002)**：
  - 外鍵約束級聯保護、午休禁令（12:00/12:30）CHECK 約束。
  - 部分唯一索引 `idx_uniq_active_slot`（同一時段僅 1 筆 active）與 `idx_uniq_active_req`（同一案件僅 1 筆 active）。
  - 單一真實來源 (SSOT) 雙向觸發器同步消除幽靈封鎖。
  - 隔離回滾腳本 `0002_rollback_ep03.sql` 與災難復原手冊 `RECOVERY.md`。
- **生命週期專用端點與 Bypass 阻斷**：
  - 實作確認排程 (`/confirm`)、開始施工 (`/start-work`)、結案 (`/complete`)、改期 (`/reschedule`) 與取消 (`/cancel`) 端點。
  - 通用 `PATCH /api/admin/requests/:id` 禁止更新 status（Case R 防繞過）。
  - 改期碰撞原子回滾（Case P/I，保留原預約有效）。
  - 舊 `processing` 案件過渡補建排程機制。
- **合作社營業時段與特定公休管理 UI (`AdminDashboard.tsx`)**：
  - 每週 14 個區間營業開放矩陣，Fail-Closed 全關防呆阻斷（Case U）。
  - 特定日期公休例外維護，即時時段衝突檢測與預約保全（Case L 不破壞既有預約）。
- **即時排程確認卡片推播與跨端顯示一致性**：
  - 正式確認與改期 LINE Flex 卡片推播（包含白名單開工時間與「準時抵達」說明）。
  - LINE 官方帳號查詢進度 Webhook 與管理端儀表板全面左連接 `slot_reservations`，統一顯示正式日期與開工時間。
  - 推播失敗非同步隔離（ADR-EP03-008，通知失敗絕不回滾預約）。

---

## [1.1.0] - Episode 02 — LINE Rich Menu (2026-10-01)

快照標籤：[`ep02-rich-menu`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep02-rich-menu)  
能力登錄：`rich-menu` (Verified)

### Added (新增能力)
- **LINE 官方圖文選單能力 (`rich-menu`)**：
  - **自動化探索預檢 (Discovery Preflight)**：自動解析專案實例變數（站所名稱、LIFF URL、查詢關鍵字），零硬編碼，保護隱私金鑰。
  - **規格生成器與 LINE 物件校驗 (Spec Builder)**：精確計算 2500x1686 像素坐標，產生符合 LINE 官方規範之 menu-spec 與 Action 綁定。
  - **本地確定性渲染器 (Deterministic Renderer)**：採用 SVG 模板與 Sharp 函式庫，零外部雲端繪圖依賴，生成高質感視覺圖檔（<200KB）。
  - **預覽與雙向雜湊審批門禁 (Preview & Approval Gate)**：以 SHA-256 鎖定圖檔與規格，嚴格遵守「人類核准前零寫入」之 Fail-Closed 原則。
  - **安全發布與回滾模組 (Safe Publisher & Rollback)**：支援 dry-run 預檢、原子化建立/上傳/設為預設選單，以及自動記錄狀態與一鍵安全回滾。
  - **被動進度查詢與管理入口 (LINE Chatbot Webhook)**：點擊選單按鈕於聊天室免推播費回覆預約進度 Flex Message。

### Fixed & Hardened (修復與加固)
- 優化 Publisher 處理 LINE OA Manager 既有預設選單之 HTTP 403 容錯邏輯。
- Webhook 驗簽加入金鑰與簽章之去空白與換行處理（`trim()`），提升各作業系統環境相容性。

---

## [1.0.0] - Episode 01 — Basic Booking (2026-10-01)

快照標籤：[`ep01-basic-booking`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep01-basic-booking)  
能力登錄：`booking-core` (Verified)

### Added (新增能力)
- **核心預約能力 (`booking-core`)**：
  - **LINE LIFF 預約表單**：採用 React + Vite + Tailwind CSS，在手機 LINE 內原生開啟並自動帶入暱稱。
  - **Cloudflare Workers 後端 API**：採用高效能 Hono 框架，提供預約建立、時段查詢與管理員授權等 API。
  - **Cloudflare D1 儲存庫**：以無伺服器 SQLite 保存預約需求表 (`service_requests`) 與預約阻擋日期 (`blocked_dates`)。
  - **LINE 官方推播整合**：新預約即時向管理員發送 LINE Flex Message 通知卡片，支援點擊一鍵撥號。
  - **Zero-Password 零密碼管理後台**：透過 LINE 官方 ID Token 驗證管理員白名單（`ADMIN_LINE_IDS`），徹底拔除靜態密碼。
  - **智慧防刷防護**：整合 Cloudflare Turnstile 無感真人驗證與複合式限流機制。

### Security & Hardening (安全基線與環境加固)
- LINE Webhook 採用 Web Crypto API 進行原生的 HMAC-SHA256 恆定時間簽章校驗。
- 後端資料庫查詢全面落實欄位投影白名單，阻斷內部備註（`admin_memo`）對外洩漏。
- 敏感金鑰全面實施 Zero-Disk 雲端 Worker Secret 託管，禁止硬編碼進 Git。
- 支援動態 CORS 白名單與多站所名稱動態解耦。
