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
   - 預約送出後，站所幹部即刻收到美觀的 **LINE Flex Message** 推播通知，並可直接點擊卡片撥號聯絡農民。
3. **三層開源級企業安全防護**
   - 🛡️ **LINE 幹部白名單原生鑑權**：管理後台採用 LINE 官方 ID Token 驗證，僅允許設定在 `ADMIN_LINE_IDS` 白名單內的幹部存取。手機端自動授權進入，電腦桌機端支援 QR Code 掃描登入；徹底免除靜態密碼洩漏之風險（並保留可折疊之緊急備援 PIN 通道）。
   - 🛡️ **Cloudflare Turnstile 零摩擦防護**：農民填表無須辨識歪斜文字或點擊紅綠燈，由 Cloudflare Turnstile 進行無感真人驗證，徹底防禦惡意機器人刷單、保護每月免費 LINE 推播額度與 D1 寫入資源。
   - 🛡️ **後端 LINE ID Token 密碼學簽名校驗**：表單送出及幹部鑑權時，後端皆向 LINE 官方授權伺服器驗證簽名真實性，杜絕前端偽造他人 LINE User ID。

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

| 變數名稱 | 說明 | 範例值 |
| :--- | :--- | :--- |
| `STATION_NAME` | 服務站所名稱 | `高雄服務站` |
| `ADMIN_NOTIFY_USER_ID` | 接收預約推播通知的幹部 LINE User ID | `U7c0c955...` |
| `ADMIN_LINE_IDS` | 授權管理幹部的 LINE User ID 白名單（逗號分隔） | `U7c0c955...,U123456...` |
| `LINE_LOGIN_CHANNEL_ID` | LIFF 所屬的 LINE Login Channel ID | `2011709076` |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile 密鑰 | `1x0000000000000000000000000000000AA` (測試) |
| `ADMIN_PIN` | 備援管理通行密碼 | `20241718` |

將 LINE Messaging API Channel Access Token 設為 Worker Secret：
```bash
cd packages/backend
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
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

## 🔒 安全性架構說明

1. **防暴力破解與濫發 (Anti-Abuse)**
   - API 具備 IP 滑動視窗頻率限制（10 分鐘內最多送出 5 筆預約，超量回傳 HTTP 429）。
   - 備援通行碼具備密碼錯誤次數計數（連續 5 次錯誤強制鎖定 15 分鐘）。
2. **防偽造身分 (Identity Verification)**
   - 前端向 LINE LIFF SDK 索取 `id_token`，後端透過 LINE 官方 `/oauth2/v2.1/verify` API 驗證憑證簽名，確認 `sub` 身分合法性，防止惡意仿冒他人身分發送訂單。
3. **無感驗證 (Cloudflare Turnstile)**
   - 採用 Cloudflare 最新隱私友善的驗證技術，有效阻絕無頭瀏覽器與腳本發送無效請求。

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

### 3. 如何分享給農民使用
- **取得專屬 LIFF 連結**：在 LIFF 設定頁複製 `https://liff.line.me/<YOUR_LIFF_ID>`。
- **整合官方帳號圖文選單**：登入 [LINE Official Account Manager](https://manager.line.biz/)，於「圖文選單 (Rich Menu)」或「加入好友歡迎訊息」新增按鈕，將點擊動作設為連結並填入您的 LIFF URL，農民即可在手機 LINE 內以原生全螢幕極速開啟預約表單！
- **免費推播額度**：LINE 官方提供每月 **200 則免費 Push 訊息**（每送出一筆預約通知扣 1 則）。超過 200 則時推播會暫停，但 **Cloudflare D1 資料庫仍會 100% 完整儲存所有預約單**，幹部依然可於管理後台查閱。

---

## 📄 開源授權

本專案採用 [MIT License](LICENSE) 開源授權，歡迎在地合作社、農會與各類產銷組織自由使用、修改與二次開發。
