# 🌱 行農合作社 · 農業資源預約管理系統 (Open Source Starter)

全純文字輕量化、高效能且安全嚴謹的農業與在地資源預約管理系統。基於 **Cloudflare Serverless（Workers + D1 + Pages）** 與 **LINE LIFF** 架構打造，無需負擔高昂伺服器與資料庫月租費，全案皆可在 Cloudflare 與 LINE 免費額度內極速運行。

> 🤖 **AI Agent / 開發者快速部署懶人包**：請直接參閱 **[Agent 全自動化部署手冊 (DEPLOYMENT_GUIDE.md)](DEPLOYMENT_GUIDE.md)**，內含環境自動檢測、Cloudflare D1 初始化、金鑰配置與全自動發布之 SOP。

---

## 🌟 核心特色

1. **極致輕量與低營運成本**
   - 捨棄笨重高耗能的照片上傳與物件儲存（R2 / S3），聚焦於農民最核心的田區資訊、作物面積、枝條體積與希望施工時程。
   - 全無伺服器（Serverless）架構，零冷啟動延遲，單次預約送出僅需數十毫秒。
2. **LINE 原生流暢體驗**
   - 農民開啟 LINE LIFF 即可自動帶入暱稱，一鍵完成預約。
   - 預約送出後，站所服務人員即刻收到美觀的 **LINE Flex Message** 推播通知，並可直接點擊卡片撥號聯絡農民或一鍵進入後台。
3. **開源級企業安全防護體系**
   - 🛡️ **LINE 服務人員白名單原生鑑權**：管理後台採用 LINE 官方 ID Token 驗證，僅允許設定在 `ADMIN_LINE_IDS` 白名單內的服務人員存取。手機端自動授權進入，電腦桌機端支援 QR Code 掃描登入；徹底免除靜態密碼洩漏之風險（並保留可折疊之緊急備援 PIN 通道）。
   - 🛡️ **LINE Webhook 密碼學防偽驗簽**：採用原生 Web Crypto API 針對 `x-line-signature` 進行 HMAC-SHA256 驗證，杜絕偽造 Webhook 事件盜刷 DB 或耗損推播配額。
   - 🛡️ **Cloudflare Turnstile 零摩擦防護**：農民填表無須辨識歪斜文字或點擊紅綠燈，由 Cloudflare Turnstile 進行無感真人驗證，徹底防禦惡意機器人刷單、保護每月免費 LINE 推播額度與 D1 寫入資源。
   - 🛡️ **全環境零硬編碼機密 (Zero Hardcoded Secrets)**：無任何預設密碼，所有敏感憑證均透過環境變數或 `wrangler secret` 隔離，並具備全自動開源脫敏保護。

---

## 📁 專案架構 (Monorepo)

```text
line-bot-farm/
├── packages/
│   ├── shared/            # 雙端共用 TypeScript 型別與常數定義
│   │   └── types.ts
│   ├── backend/           # Cloudflare Workers 後端 API (採用 Hono 框架)
│   │   ├── src/
│   │   │   ├── index.ts   # 路由控制、頻率限制、安全驗證中間件
│   │   │   ├── line.ts    # LINE Flex Message 產生器、Push API、ID Token 驗證
│   │   │   └── turnstile.ts # Cloudflare Turnstile 站點真人校驗模組
│   │   └── wrangler.toml  # Cloudflare Worker 佈署與環境變數綁定檔
│   └── frontend/          # Cloudflare Pages 前端 (React + Vite + Tailwind CSS)
│       ├── functions/     # Cloudflare Pages Functions (API 代理轉發)
│       └── src/
│           ├── components/
│           │   ├── ApplyForm.tsx      # 農友預約表單 (含 Turnstile 與 LINE 身分綁定)
│           │   └── AdminDashboard.tsx  # 幹部管理後台 (支援 LINE 登入與電話一鍵撥號)
│           └── App.tsx
├── scripts/
│   └── verify-no-photo.js # 輕量版純文字架構相依性自動校驗腳本
├── .env.example           # 環境變數範本檔
└── README.md
```

---

## 🚀 快速開始

### 1. 取得專案並安裝相依套件

```bash
git clone https://github.com/chingfonlee/biz-resource-reservation.git
cd biz-resource-reservation
npm install
```

### 2. 初始化 Cloudflare D1 資料庫

登入 Cloudflare CLI 並建立 D1 資料庫：
```bash
npx wrangler login
npx wrangler d1 create xingnong-db
```
將終端機輸出的 `database_id` 填寫至 `packages/backend/wrangler.toml` 中的 `[[d1_databases]]` 區塊。

執行資料表建立：
```bash
npx wrangler d1 execute xingnong-db --command "
CREATE TABLE IF NOT EXISTS service_requests (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service_type TEXT NOT NULL,
  crop_type TEXT NOT NULL,
  area_size TEXT NOT NULL,
  area_value TEXT,
  area_unit TEXT,
  branch_volume TEXT,
  location_area TEXT NOT NULL,
  location_address TEXT NOT NULL,
  preferred_date TEXT NOT NULL,
  preferred_time_slot TEXT NOT NULL,
  date_flexibility TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'to_contact',
  admin_memo TEXT,
  line_user_id TEXT
);
CREATE TABLE IF NOT EXISTS blocked_dates (
  date TEXT PRIMARY KEY,
  reason TEXT,
  created_at TEXT NOT NULL
);
"
```

### 3. 設定環境變數與金鑰

參考 `.env.example` 與 `packages/backend/wrangler.toml.example`，在 `packages/backend/wrangler.toml` 填寫以下設定：

| 變數名稱 | 說明 | 範例值 / 建議設定 |
| :--- | :--- | :--- |
| `STATION_NAME` | 服務站所名稱 | `高雄服務站`（開源範例：`示範農場服務站`） |
| `ADMIN_NOTIFY_USER_ID` | 接收預約推播通知的服務人員 LINE User ID | `U7c0c955...` |
| `ADMIN_LINE_IDS` | 授權管理服務人員的 LINE User ID 白名單（逗號分隔） | `U7c0c955...,U123456...` |
| `LINE_LOGIN_CHANNEL_ID` | LIFF 所屬的 LINE Login Channel ID | `2011709076` |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile 密鑰 | 測試：`1x0000000000000000000000000000000AA`（正式請自建） |
| `ADMIN_PIN` | 備援管理通行密碼 | 建議自訂高強度 8 位數密碼（或以 `wrangler secret put ADMIN_PIN` 注入） |
| `ALLOWED_ORIGINS` | 前端允許之 CORS 來源（逗號分隔） | `https://your-app.pages.dev,https://*.pages.dev` |

將 LINE 關鍵密鑰設為 Worker Secret（避免明文納入版本控制）：
```bash
cd packages/backend
# 1. LINE Messaging API Channel Access Token (必填，用於發送通知與查詢進度)
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN

# 2. LINE Messaging API Channel Secret (強烈推薦，用於 Webhook HMAC-SHA256 驗簽)
npx wrangler secret put LINE_CHANNEL_SECRET
```

### 4. 部署至 Cloudflare

#### 部署後端 API (Cloudflare Worker)
```bash
cd packages/backend
npx wrangler deploy
```

#### 部署前端介面 (Cloudflare Pages)
```bash
cd ../frontend
npm run build
npx wrangler pages deploy dist --project-name xingnong-farm
```

---

## 🔒 企業級安全性架構與已修復項目說明 (Security Hardening)

本專案經過嚴謹的安全審計與重構，全面解決了常見的 Serverless 與 LINE Bot 部署資安漏洞，具備以下 8 重防護機制：

```mermaid
flowchart TD
    subgraph Client["農民端與服務人員端 (Client)"]
        Farmer["🧑‍🌾 農友表單 (LIFF)"]
        Admin["🛠️ 服務人員後台"]
        LineApp["📱 LINE 官方聊天室"]
    end

    subgraph SecurityLayer["安全性防禦層 (Workers Edge Security)"]
        CORS["🌐 CORS 動態網域檢驗<br>(ALLOWED_ORIGINS)"]
        Headers["🛡️ 安全標頭注入<br>(X-Frame-Options, nosniff)"]
        RateLimit["⏳ 複合式滑動窗口頻率限制<br>(Client IP + Phone)"]
        Turnstile["🤖 Cloudflare Turnstile<br>無感真人驗證"]
        HMAC["🔑 LINE Webhook HMAC-SHA256<br>密碼學防偽驗簽"]
        LineAuth["🆔 LINE ID Token 簽名驗證<br>(白名單校驗)"]
        PinLock["🔒 管理員 PIN 碼防爆破鎖定<br>(錯 5 次鎖定 15 分鐘)"]
    end

    subgraph Core["核心資料與服務 (Zero-Cost Core)"]
        D1[("🗄️ Cloudflare D1 (SQLite)")]
        LINE_API["📨 LINE Messaging API"]
    end

    Farmer --> CORS --> Headers --> RateLimit --> Turnstile --> D1
    Farmer -. 預約成立 .-> LINE_API
    LineApp --> HMAC --> D1
    Admin --> LineAuth --> PinLock --> D1
```

### 1. 🛡️ LINE Webhook 原生 HMAC-SHA256 密碼學防偽驗簽
* **修復漏洞**：傳統 Webhook 缺乏簽名驗證時，攻擊者可偽造 HTTP POST 請求刷爆後端資料庫或消耗 LINE 免費推播額度。
* **防護機制**：實作 [`verifyLineSignature`](packages/backend/src/line.ts)，透過原生 Web Crypto API 計算 `x-line-signature` 之 HMAC-SHA256 雜湊，阻斷所有未授權的偽造 Webhook 事件。

### 2. 🔐 零硬編碼機密與安全金鑰治理 (Zero Hardcoded Secrets)
* **修復漏洞**：舊版本代碼與設定檔曾包含預設 PIN 與明文金鑰，公開至 Git 會導致系統門戶大開。
* **防護機制**：
  - 徹底刪除程式碼中所有預設密碼常數（如 `DEFAULT_ADMIN_PIN`），未配置環境變數時系統自動拒絕認證並輸出安全警告。
  - 機密憑證建議透過 `wrangler secret put` 儲存，且開源導出腳本（`scripts/export-opensource.js`）具備自動去識別化脫敏機制。

### 3. 🌐 動態 CORS 白名單隔離 (`ALLOWED_ORIGINS`)
* **修復漏洞**：硬編碼特定網域會導致開源採用者無法在自訂網域運作；而使用 `cors('*')` 又會遭受任意惡意網站跨站刷單。
* **防護機制**：後端採用動態來源校驗，支援環境變數 `ALLOWED_ORIGINS`（支援多組網域與萬用字元如 `*.pages.dev`），預設僅信任本機開發環境與 LINE 官方 LIFF。

### 4. 🔏 嚴格 Header 憑證傳輸（移除 URL Query 傳參）
* **修復漏洞**：透過 `?pin=...` 或 `?token=...` 傳送憑證會被瀏覽器歷史紀錄、CDN 快取與伺服器 Access Log 完整記錄造成洩密。
* **防護機制**：全面禁止 URL Query 傳遞管理憑證，一律採用 HTTP Header（`x-admin-pin`、`x-line-token`、`Authorization: Bearer`）安全傳輸。

### 5. 🧱 除錯與高權限端點收斂 (`/api/admin/debug/*`)
* **修復漏洞**：公開的 `/api/debug/test-card` 端點可被任意人觸發 LINE Push 並透過 User ID 列舉資料庫。
* **防護機制**：除錯端點一律收納於 `/api/admin/*` 路由群組下，必須通過服務人員 LINE 白名單鑑權或管理 PIN 授權方可執行。

### 6. 📱 電信級複合頻率限制 (Composite Rate Limiting)
* **修復漏洞**：純以 IP 限流在台灣行動網路環境下，常因基地台 CGNAT（數千台手機共用同一個電信公網 IP）導致無辜農民互相被鎖定阻擋。
* **防護機制**：採用 `Client IP + Phone Number` 複合鍵作為滑動視窗限流依據（10 分鐘內最多 5 筆預約），兼顧防惡意刷單與電信網路相容性。

### 7. 🎲 訂單 ID 高熵防碰撞 (`crypto.randomUUID()`)
* **修復漏洞**：原先使用 `Math.random()` 產生的隨機後綴在高並發情境下碰撞率高且易被預測。
* **防護機制**：全面改用原生 `crypto.randomUUID()` 截取高熵隨機字串，杜絕訂單撞號與遞增枚舉攻擊。

### 8. 🛡️ 瀏覽器標準安全防護標頭 (Security Headers)
* 全域回應自動注入：
  - `X-Content-Type-Options: nosniff`（防範 MIME 嗅探攻擊）
  - `X-Frame-Options: SAMEORIGIN`（防止管理介面遭受 Clickjacking 點擊劫持）
  - `Referrer-Policy: strict-origin-when-cross-origin`（防止敏感路徑洩漏至外部參照）

---

## 📱 LINE 設定與開放一般農友預約指引

部署完成後，請務必確認以下 LINE 後台設定，確保外部農民能正常開啟表單並接收推播：

### 1. 將 LINE Login 頻道切換為「Published（已發布）」
> ⚠️ **關鍵開關**：LINE Developers Console 中新建的頻道預設為 **`Developing`（開發中）**。此時只有管理員與開發者帳號能開啟，**一般非測試人員點開會出現「此服務目前正在開發中」的錯誤**。
> - **發布步驟**：開啟 [LINE Developers Console](https://developers.line.biz/console/) ➡️ 點入您的 **LINE Login Channel** ➡️ 在頁面頂部將 **`Developing`** 點擊切換為 **`Published`** 即可對全網開放。

### 2. LIFF 應用必要設定
- **Scopes**：勾選 `profile` 與 `openid`（以支援自動帶入農民 LINE 暱稱與身分防偽校驗）。
- **Endpoint URL**：填入您的 Cloudflare Pages 正式網址（例如 `https://xingnong-farm.pages.dev`）。
- **Bot prompt**：選擇 `Normal`（在農民首次開啟表單授權時，主動引導將官方帳號加入好友）。

### 3. 如何分享給農民使用與圖文選單雙功能配置
- **取得專屬 LIFF 連結**：在 LIFF 設定頁複製 `https://liff.line.me/<YOUR_LIFF_ID>`。
- **圖文選單 (Rich Menu) 推薦配置**：
  - **預約按鈕**：動作類型設為「連結 (URL)」，網址填入 `https://liff.line.me/<YOUR_LIFF_ID>`。
  - **查詢進度按鈕**：動作類型設為「文字 (Text)」，文字填入 `查詢預約`。
- **免費用量優勢**：
  - 農友點擊「查詢預約」時，系統採用 LINE 原生 **Reply API** 被動回覆最新排程卡片，**完全免費且 100% 不計入每月 200 則推播額度**！
  - 只有新預約成立時的主動推播會扣除額度（每月 200 則免費 Push）。

### 4. 🚨 LINE 聊天室查詢進度 Webhook 必備雙開關（未開啟將無反應）
若要讓農友在 LINE 聊天室輸入「查詢預約」或點擊圖文選單時能收到進度卡片，務必確認以下兩處開關：
1. **[LINE OA 後台 (manager.line.biz)](https://manager.line.biz/)**：右上角「設定」➡️「回應設定」➡️ **「Webhook」務必切換為「開啟」**（預設為關閉！）。
2. **[LINE Developers 後台](https://developers.line.biz/)**：Messaging API 分頁 ➡️ **Webhook settings** 填入 `https://<YOUR_WORKER_DOMAIN>/api/line/webhook`，點擊 Verify，並將 **「Use webhook」切換為「開啟（綠色 Enabled）」**。

### 5. Cloudflare Turnstile 真人防護設定（去除警語橫幅）
- **預設狀態**：本專案預設採用 Cloudflare 官方 **Invisible 隱形模式**（`2x00000000000000000000AB`），表單完全不顯示灰色方塊與「僅用於測試」字樣，背景自動鑑權。
- **正式營運推薦（申請免費專屬金鑰）**：
  1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/) ➡️ 點選 **Turnstile** ➡️ **Add site**。
  2. 填入網站名稱與網域（例如 `xingnong-farm.pages.dev`）。
  3. **Widget Mode 強烈推薦選擇「Invisible（隱形無感）」**。
  4. 取得 Site Key（填入前端 `VITE_TURNSTILE_SITE_KEY`）與 Secret Key（填入後端 `TURNSTILE_SECRET_KEY`）後重新部署即可。

---

## 📄 開源授權

本專案採用 [MIT License](LICENSE) 開源授權，歡迎在地合作社、農會與各類產銷組織自由使用、修改與二次開發。
