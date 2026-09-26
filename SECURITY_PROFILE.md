# 🔐 專案安全實作設定檔 (Security Profile) — open-booking-line

> **專案定位**：本文件定義本專案（`open-booking-line` / `line-bot-farm`）如何具體對齊與落實 [`SECURITY_BASELINE.md`](SECURITY_BASELINE.md) 之通用安全基線。  
> 若更換技術棧（如改用 Supabase、AWS 或 Next.js），只需調整本設定檔，通用安全基線維持不變。

---

## 🛠️ 本專案技術架構與安全規格映射 (Baseline-to-Profile Mapping)

| 通用安全基線 (SECURITY_BASELINE) | 本專案具體實作 (open-booking-line Profile) | 實作檔案與元件 |
| :--- | :--- | :--- |
| **1. 伺服器端外部輸入校驗** | • Hono 全域中介層限制 `bodyLimit: 32KB`<br/>• 姓名 $\le 50$、電話 $8\sim 15$ 碼、地址 $\le 200$、備註 $\le 500$ 字 | `packages/backend/src/index.ts` |
| **2. 身分識別與伺服器鑑權** | • 透過 LINE Login `id_token` 驗簽解碼取得真實 User ID（`sub`）<br/>• 後端比對 `ADMIN_LINE_IDS` 白名單，拔除靜態密碼 | `packages/backend/src/line.ts`<br/>`packages/frontend/src/components/AdminDashboard.tsx` |
| **3. 憑證與密鑰零磁碟落地** | • `LINE_CHANNEL_SECRET`<br/>• `LINE_CHANNEL_ACCESS_TOKEN`<br/>• `TURNSTILE_SECRET_KEY`<br/>👉 透過 `wrangler secret put` 經 `stdin` 管道直接注入 Worker Secrets | `packages/backend/wrangler.toml`<br/>`scripts/setup-turnstile.js` |
| **4. 個資遮蔽與錯誤泛化** | • 電話中間 3 碼遮蔽（例：`0912***456`）<br/>• 攔截 SQL/D1 錯誤，統一對外回傳泛化錯誤代碼（`DATABASE_ERROR`）<br/>• 自動化腳本透過 `ERROR_DESCRIPTIONS` 字典映射，杜絕 raw stack trace | `packages/backend/src/index.ts`<br/>`scripts/setup-turnstile.js` |
| **5. 第三方 Webhook 驗簽** | • LINE Webhook 接收時以 `LINE_CHANNEL_SECRET` 進行 HMAC-SHA256 運算<br/>• 採用 Web Crypto API 恆定時間比對，無效簽章直接 401 阻斷 | `packages/backend/src/index.ts` (`/api/line/webhook`) |
| **6. 雙軌失效處理分流** | • **資安關鍵依賴（Turnstile）**：正式環境驗證異常或過期 ➔ **Fail-Closed 阻斷 (403)**<br/>• **非關鍵副作用（LINE 推播）**：預約寫入 DB 成功後，若 LINE 推播 500 異常 ➔ **安全降級（記錄警告並保留預約）**，絕不回滾農民預約單 | `packages/backend/src/turnstile.ts`<br/>`packages/backend/src/index.ts` |
| **7. 雙層冪等性設計** | • **基礎設施冪等**：`setup-turnstile.js` 實作 A/B/C 三層策略（本地復用 ➔ 遠端比對 ➔ 乾淨新建），支援 `--recreate`<br/>• **業務邏輯冪等**：預約單號採高熵亂數（`BK-YYYYMMDD-10hex`，1.1 兆種組合）；前端送出按鈕 Disable + DB 狀態防重 | `scripts/setup-turnstile.js`<br/>`packages/backend/src/index.ts` |
| **8. 瀏覽器隔離 vs API 安全** | • **瀏覽器隔離**：Hono 動態驗證 `ALLOWED_ORIGINS`（支援 `https://*.pages.dev`）與安全標頭（HSTS, nosniff, SAMEORIGIN）<br/>• **API 真實安全**：複合限流中介層（Client IP + Phone 10次/10分鐘）+ Turnstile 真人檢核 | `packages/backend/src/index.ts` |
| **9. 正式與測試環境隔離** | • Starter 模式使用官方 Managed Always-Pass 測試 Key（`1x...`）<br/>• 生產模式自動排除 `1x`, `2x`, `3x` 測試金鑰，部署專屬 Widget 與 Secret | `packages/backend/src/turnstile.ts`<br/>`scripts/setup-turnstile.js` |
| **10. Agent-Safe 工具鏈** | • 全面移除 `shell: true`<br/>• 由 `process.execPath` 原生直調 `wrangler.js` 與 `npm-cli.js`<br/>• 子程序輸出透過 Buffer 記憶體隔離，杜絕 Token 洩漏 | `scripts/setup-turnstile.js` |

---

## 📋 專案特定環境變數與金鑰清冊 (Secrets Inventory)

| 變數名稱 | 儲存位置 | 敏感等級 | 說明 |
| :--- | :--- | :--- | :--- |
| `LINE_CHANNEL_SECRET` | Cloudflare Worker Secret | 🔴 極高 | LINE Webhook HMAC-SHA256 驗簽金鑰 |
| `LINE_CHANNEL_ACCESS_TOKEN` | Cloudflare Worker Secret | 🔴 極高 | LINE Messaging API 推播發送憑證 |
| `TURNSTILE_SECRET_KEY` | Cloudflare Worker Secret | 🔴 極高 | Cloudflare Turnstile 後端核驗金鑰 |
| `ADMIN_LINE_IDS` | `wrangler.toml` [vars] | 🟡 中等 | 授權管理員 LINE User ID 逗號分隔清單 |
| `ADMIN_NOTIFY_USER_ID` | `wrangler.toml` [vars] | 🟡 中等 | 預設接收推播通知之服務幹部 User ID |
| `VITE_TURNSTILE_SITE_KEY` | 前端 `.env` | 🟢 公開 | 前端 Turnstile 渲染所需之公開 Site Key |
| `VITE_LIFF_ID` | 前端 `.env` | 🟢 公開 | LINE 前端應用公開 ID |
