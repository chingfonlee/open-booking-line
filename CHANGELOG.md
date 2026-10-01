# 更新日誌 (Changelog)

本專案遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/) 與 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/) 規範。

---

## [Unreleased]

### 進行中 (In Development)
- **Episode 02 — LINE Rich Menu**：規劃與開發 LINE 官方帳號圖文選單能力（包含圖片產生、LINE Messaging API 發布與被動預約查詢按鈕）。

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
