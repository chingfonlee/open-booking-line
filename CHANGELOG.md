# 更新日誌 (Changelog)

本專案遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/) 與 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/) 規範。

---

## [Unreleased]

### 規劃中 (Planned)
- **Episode 03 — Service Catalog**：多服務項目與動態服務類別管理。
- **Episode 04 — Admin Scheduling**：管理端時段排程與封鎖日控管。
- **Episode 05 — Notification & Broadcast**：多渠道通知與分眾推播加固。

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
