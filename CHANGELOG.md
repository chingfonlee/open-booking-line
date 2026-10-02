# 更新日誌 (Changelog)

本專案遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/) 與 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/) 規範。

---

## [Unreleased]

### 規劃中 (Planned)
- **Episode 04 — Service Catalog**：多服務項目與動態服務類別管理。
- **Episode 05 — Notification & Broadcast**：多渠道通知與排程提醒加固。

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
