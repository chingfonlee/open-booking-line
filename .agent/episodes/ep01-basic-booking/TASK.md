# Episode 01 Task: Basic Booking Capability Installation

> 本文件為 Agent 執行 Episode 01 基礎預約能力建置的標準作業程序 (SOP)。

> [!IMPORTANT]
> **教學影片與專案最新狀態同步聲明**：  
> 專案在持續演進過程中，已將前端預約表單全面升級為 **「4 步驟分段導覽精靈（Wizard Form）」**，並加入了共用手機隱私草稿防護、WCAG 無障礙縮放與防跳步保護機制。  
> **若教學影片內容或舊版展示與當前實作有所出入，Agent 一律以 GitHub 專案最新程式碼與本文件 SOP 為唯一執行準則。**

---

## 1. Goal（任務目標）
在現有或全新店家實例中建立並部署 `booking-core` 能力，包含：
- **React + Vite + LINE LIFF 前端 4 步驟分段導覽預約精靈 (Cloudflare Pages)**：
  - `formSteps.ts`：步驟狀態機、返回鍵與網址 Hash 路由、防跳步阻斷（Bypass Protection）。
  - `formValidation.ts`：步驟 1～4 欄位驗證、手機（09 開頭 10 碼）/ 市話（02~08 開頭 9 碼）格式檢查、可用性時段約束。
  - `formDraft.ts`：LocalStorage 草稿安全讀寫（版本控管、7 天過期、開啟時個資隱私詢問彈窗、送單成功清除）。
- **Hono + Cloudflare Workers 後端 API**：全欄位伺服端二次校驗、時段即時可用性檢查、Cloudflare Turnstile 密鑰單次驗證。
- **Cloudflare D1 資料庫結構** (`service_requests`, `blocked_dates`)。
- **基礎身分驗證與管理後台通道**（LINE ID Token 簽名驗證）。

---

## 2. Prerequisites（前置條件）
- `requires`: `[]`（本集為基礎第一步，無前置能力依賴）。
- 本地環境安裝有 Node.js 22+ 與 npm。
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
   - `VITE_API_BASE_URL=` (由 Pages Functions 反向代理或 Workers 網址)
2. 建立或更新本地 Worker 設定（`wrangler.local.toml` 或透過環境變數傳入）。

### Step 4.3: 智慧初始化 Cloudflare D1 資料庫與多帳號隔離防呆
1. 執行智慧資料庫配置腳本：
   ```bash
   npm run setup:db
   ```
2. 腳本自動執行多帳號防呆與環境預檢：
   - **既有資料庫檢測與確認**：若帳號內已存在其他 D1 資料庫（例如已有其他官方帳號的 DB），主動詢問使用者：
     - `[1] 建立全新獨立資料庫`（推薦：不同店家/官方帳號資料徹底隔離，防資料混雜）。
     - `[2] 沿用現有資料庫`（同店家重新部署或修復）。
   - **設定檔自動綁定**：自動更新 `packages/backend/wrangler.toml` 之 `database_name` 與 `database_id`。
   - **資料表自動建置**：自動對目標資料庫套用 `schema.sql` 建立 `service_requests` 與 `blocked_dates`。
   - **LINE 關鍵防呆預檢**：自動比對 `LIFF_ID` 前 10 碼是否等於 `LINE_LOGIN_CHANNEL_ID`。若不一致則立即警告阻斷，杜絕送單身分驗證失敗與無法查詢。
   - **Worker 覆蓋預檢**：檢查 Worker 名稱是否與線上既有服務站衝突。

### Step 4.4: 注入 Runtime Secrets
透過 Wrangler CLI 將敏感密鑰注入 Worker：
```bash
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
```
*(提示：亦可執行 `npm run setup:turnstile` 一鍵自動配置 Turnstile)*

### Step 4.5: 執行自動化測試
執行全套單元測試，確保 4 步驟表單驗證、草稿防護與後端可用性計算 100% 通過：
```bash
npm test
```

### Step 4.6: 部署 Workers 與 Pages
1. 後端部署：`cd packages/backend && npx wrangler deploy`
2. 前端構建與發布：`cd packages/frontend && npm run build && npx wrangler pages deploy dist --project-name <pages-project-name>`

---

## 5. Verification（驗證程序 - 必須全部通過）

Agent 必須執行以下 4 項真實系統檢驗，不得跳過：

### V1: 前端加載驗證 (frontend-loads)
- 存取前端 Pages 網址，HTTP 狀態碼為 200。
- 4 步驟分段導覽進度條與表單正常渲染，無 JavaScript 執行未捕獲異常或全白畫面。
- HTML `<meta name="viewport">` 支援雙指無障礙縮放（不得包含 `user-scalable=no`）。

### V2: 表單送出與 API 通訊驗證 (booking-submit-success)
- 發送真實預約表單測試請求（可透過 LIFF 操作至第 4 步送出，或向 `/api/requests` 發送符合格式之預約資料）。
- 後端回應 HTTP 200，回傳格式包含 `success: true` 與申請單號 `id`。

### V3: 資料庫持久化驗證 (database-record-created)
- 查詢 D1 資料庫 `service_requests` 表，確認該筆申請單已確實寫入。
- 欄位包含正確之 `contact_name`、`phone`、`service_type` 與初始狀態 `to_contact`。

### V4: 4 步驟表單與草稿測試驗證 (apply-form-tests-pass)
- 執行 `npm run test:apply-form`，19 項單元測試（包含分步欄位驗證、草稿 7 天過期自動清理、防跳步保護）全數綠燈。

---

## 6. Failure Handling（失敗處理）
- 若任何一項驗證失敗：
  1. 立即輸出失敗階段之錯誤日誌。
  2. 引導使用者檢查 Cloudflare Token 或 LINE Webhook 設定。
  3. **嚴禁**更新 `.booking/project-state.json`。
  4. 保持 `booking-core` 處於未登錄狀態。

---

## 7. State Update（狀態登錄）
**只有在 V1、V2、V3、V4 全部 PASS 後**，執行狀態原子寫入：

```json
{
  "capabilities": {
    "booking-core": {
      "status": "verified",
      "verifiedAt": "<ISO-8601-TIMESTAMP>",
      "version": "1.0.0"
    }
  }
}
```
