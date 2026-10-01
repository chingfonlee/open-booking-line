# Episode 01 Task: Basic Booking Capability Installation

> 本文件為 Agent 執行 Episode 01 基礎預約能力建置的標準作業程序 (SOP)。

---

## 1. Goal（任務目標）
在現有或全新店家實例中建立並部署 `booking-core` 能力，包含：
- React + Vite + LINE LIFF 前端預約表單 (Cloudflare Pages)
- Hono + Cloudflare Workers 後端 API
- Cloudflare D1 資料庫結構 (`service_requests`, `blocked_dates`)
- 基礎身分驗證與管理後台通道

---

## 2. Prerequisites（前置條件）
- `requires`: `[]`（本集為基礎第一步，無前置能力依賴）。
- 本地環境安裝有 Node.js 20+ 與 npm。
- 使用者已準備好 Cloudflare 帳號與 LINE 官方帳號設定值。

---

## 3. Inputs（必要輸入資訊）
Agent 在執行部署前，必須引導使用者提供或自本地讀取以下設定：
1. **店家基本資料**：
   - 店家名稱 (`STATION_NAME`)
   - 產業類型 (`projectType`)
2. **LINE 設定值**：
   - `LINE_CHANNEL_ACCESS_TOKEN` (Operation/Runtime Secret)
   - `LINE_CHANNEL_SECRET` (Runtime Secret)
   - `LINE_LOGIN_CHANNEL_ID` (Private Local Config)
   - `LIFF_ID` (Private Local Config)
   - `ADMIN_NOTIFY_USER_ID` (Private Local Config)
3. **安全防護設定**：
   - `TURNSTILE_SECRET_KEY` (Runtime Secret，預設可用測試金鑰)

---

## 4. Execution Steps（執行步驟）

### Step 4.1: 初始化本地 Project State
1. 檢查根目錄是否存在 `.booking/project-state.json`。
2. 若不存在，自 `.booking/project-state.json.example` 複製並寫入店家名稱與產業類型：
   - 初始狀態下 `capabilities: {}`。

### Step 4.2: 配置本地店家參數
1. 建立或更新 `packages/frontend/.env`（受 `.gitignore` 保護）：
   - `VITE_LIFF_ID=<LIFF_ID>`
   - `VITE_STATION_NAME=<STATION_NAME>`
   - `VITE_API_BASE_URL=` (由 Pages Functions 反向代理)
2. 建立或更新本地 Worker 設定（`wrangler.local.toml` 或透過環境變數傳入）。

### Step 4.3: 初始化 Cloudflare D1 資料庫
1. 執行 `npx wrangler d1 create <db-name>` 建立資料庫。
2. 執行 `npx wrangler d1 execute <db-name> --file=packages/backend/schema.sql` 建立資料表。

### Step 4.4: 注入 Runtime Secrets
透過 Wrangler CLI 將敏感密鑰注入 Worker：
```bash
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
```

### Step 4.5: 部署 Workers 與 Pages
1. 後端部署：`cd packages/backend && npx wrangler deploy`
2. 前端構建與發布：`cd packages/frontend && npm run build && npx wrangler pages deploy dist`

---

## 5. Verification（驗證程序 - 必須全部通過）

Agent 必須執行以下 3 項真實系統檢驗，不得跳過：

### V1: 前端加載驗證 (frontend-loads)
- 存取前端 Pages 網址，HTTP 狀態碼為 200。
- HTML 正常渲染，無 JavaScript 執行未捕獲異常或全白畫面。

### V2: 表單送出與 API 通訊驗證 (booking-submit-success)
- 發送真實預約表單測試請求（可透過 LIFF 或測試腳本向 `/api/requests` 發送符合格式之預約資料）。
- 後端回應 HTTP 200，回傳格式包含 `success: true` 與申請單號 `id`。

### V3: 資料庫持久化驗證 (database-record-created)
- 查詢 D1 資料庫 `service_requests` 表，確認該筆申請單已確實寫入。
- 欄位包含正確之 `contact_name`、`phone`、`service_type` 與初始狀態 `to_contact`。

---

## 6. Failure Handling（失敗處理）
- 若任何一項驗證失敗：
  1. 立即輸出失敗階段之錯誤日誌。
  2. 引導使用者檢查 Cloudflare Token 或 LINE Webhook 設定。
  3. **嚴禁**更新 `.booking/project-state.json`。
  4. 保持 `booking-core` 處於未登錄狀態。

---

## 7. State Update（狀態登錄）
**只有在 V1、V2、V3 全部 PASS 後**，執行狀態原子寫入：

```json
"booking-core": {
  "status": "verified",
  "sourceEpisode": "ep01-basic-booking",
  "verifiedAt": "<當前 ISO 8601 時間戳>"
}
```

---

## 8. Completion Output（完成回報）
輸出結構化回報給使用者：
- 系統網址（Pages URL、LIFF URL）
- 已驗證能力清單：`[✓ booking-core]`
- 提醒：請至 LINE 官方帳號進行一次實機點擊測試。
