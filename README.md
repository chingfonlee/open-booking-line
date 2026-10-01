# 🌱 open-booking-line — LINE 開源預約管理系統

全純文字輕量化、高效能且安全嚴謹的 LINE 預約與在地服務管理系統。基於 **Cloudflare Serverless（Workers + D1 + Pages）** 與 **LINE LIFF** 架構打造，無需負擔高昂伺服器與資料庫月租費，全案皆可在 Cloudflare 與 LINE 免費額度內極速運行。

> 🤖 **AI Agent 協同入口規範**：請參閱 **[AGENTS.md](AGENTS.md)**，所有 AI 工具進入專案之首要讀取約束與核心守則。  
> 📖 **本集更新與歷史變更**：請參閱 **[CHANGELOG.md](CHANGELOG.md)**。

---

## 🌟 Current Capabilities (目前已驗證功能)

以下為目前主幹分支（`main`）經實機端對端驗收通過之穩定功能：

* ✓ **LINE 原生流暢預約 (LIFF)**：支援在 LINE 官方帳號內開啟前端預約表單，自動帶入顧客 LINE 暱稱。
* ✓ **LINE Rich Menu 圖文選單**：支援一鍵探索、SVG + Sharp 零外部依賴本地確定性渲染 2500x1686 品牌選單，具備雜湊審核門禁、原子化發布、遠端校驗與安全回滾機制。
* ✓ **極低成本 Serverless 後端**：基於 Cloudflare Workers + Hono 框架，提供低延遲、高並發之預約處理與時段排程 API。
* ✓ **無伺服器關聯資料庫 (Cloudflare D1)**：以 SQLite 儲存預約單與時段封鎖紀錄，免除資料庫維護負擔。
* ✓ **LINE Flex Message 即時推播**：新預約送出時，即時推播通知站所幹部，支援一鍵撥號與後台跳轉。
* ✓ **Zero-Password 零密碼管理後台**：管理端 100% 透過 LINE 官方 ID Token 驗證服務人員白名單，手機端自動免密碼登入、桌機端掃碼授權，徹底拔除靜態密碼洩漏風險。
* ✓ **企業級安全防禦**：
  * Cloudflare Turnstile 無感真人防刷單驗證。
  * 原生 Web Crypto HMAC-SHA256 恆定時間 Webhook 驗簽。
  * 電信級 Client IP + Phone 複合滑動窗口頻率限制。
  * 資料庫全欄位長度防爆破與日誌敏感個資（PII）脫敏。

---

## 📺 YouTube Episode Guide (教學影片索引)

本專案採**「能力演進式（Evolution Capability）」**架構，每一集 YouTube 教學為專案增添一項經驗證的新能力。

| Episode | Capability | Status | Episode Guide | Snapshot Tag |
| :--- | :--- | :--- | :--- | :--- |
| **Ep01** | Basic Booking (預約核心) | **Stable** (已驗證) | [Ep01 Guide](docs/episodes/ep01-basic-booking/README.md) | [`ep01-basic-booking`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep01-basic-booking) |
| **Ep02** | LINE Rich Menu (圖文選單) | **Stable** (已驗證) | [Ep02 Guide](docs/episodes/ep02-rich-menu/README.md) | [`ep02-rich-menu`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep02-rich-menu) |
| **Ep03** | Service Catalog (多服務項目) | **Planned** (規劃中) | — | — |
| **Ep04** | Admin Scheduling (排程與封鎖) | **Planned** (規劃中) | — | — |
| **Ep05** | Notification & Broadcast (推播加固) | **Planned** (規劃中) | — | — |

> 📌 **說明**：
> 1. 新使用者預設直接 Clone 最新 `main` 分支即可。
> 2. 詳細執行 SOP 請參閱 `.agent/episodes/<episode-id>/TASK.md`。

---

## 🚀 How to Use (如何開始使用)

現階段專案正式支援 **Episode-by-Episode 循序建置路線**：

### 1. 取得最新程式碼
```bash
git clone https://github.com/chingfonlee/open-booking-line.git
cd open-booking-line
npm install
```

### 2. 準備前置資源
* **LINE 官方帳號 (LINE OA)** 及 **LINE Developers** 頻道（取得 Channel Access Token、Channel Secret、Channel ID、LIFF ID）。
* **Cloudflare 帳號**（免信用卡，具備 Workers 與 D1 權限）。
* 推薦使用 **AI Coding Agent**（例如 Antigravity、Claude Code、Cursor、OpenCode）協同部署。

### 3. 交由 AI Agent 執行部署
在專案根目錄直接對 AI 輸入：
> 「我想在目前專案安裝 Episode 01 basic-booking 能力，請引導我完成設定與部署。」

AI 會依據 `.agent/episodes/ep01-basic-booking/TASK.md` 檢查前置條件、引導設定，並在完成實機驗收後於本地 `.booking/project-state.json` 登錄已驗證能力。

---

## 📁 Architecture (系統架構)

### 系統拓撲
```mermaid
flowchart TD
    subgraph Client["客戶端與管理端"]
        User["🧑‍🌾 農友 / 顧客 (LINE LIFF)"]
        Admin["🛠️ 幹部管理端 (LINE Auth)"]
        LineChat["📱 LINE 官方帳號聊天室"]
    end

    subgraph Edge["Cloudflare Edge Network"]
        Pages["🌐 Cloudflare Pages (React + Vite)"]
        Worker["⚡ Cloudflare Workers API (Hono)"]
        Turnstile["🤖 Cloudflare Turnstile (真人核驗)"]
        D1[("🗄️ Cloudflare D1 (SQLite)")]
    end

    subgraph LinePlatform["LINE Platform"]
        MessagingAPI["📨 LINE Messaging API"]
        LineLogin["🆔 LINE Login / Verify API"]
    end

    User --> Pages
    Pages --> Turnstile
    Pages --> Worker
    Worker --> D1
    Worker --> MessagingAPI
    LineChat --> Worker
    Admin --> Pages
    Worker --> LineLogin
```

### Monorepo 目錄劃分
```text
open-booking-line/
├── packages/
│   ├── shared/            # 前後端共用 TypeScript 型別與介面
│   ├── backend/           # Cloudflare Workers 後端 API (Hono 框架)
│   │   ├── src/           # 路由、LINE 訊息、Turnstile 校驗
│   │   └── wrangler.toml  # Cloudflare Worker 範本檔 (不含敏感金鑰)
│   └── frontend/          # Cloudflare Pages 前端 (React + Vite + Tailwind)
│       └── src/           # 表單元件 (ApplyForm)、管理後台 (AdminDashboard)
├── docs/                  # 人類閱讀之技術手冊與 Episode 導覽
│   ├── episodes/          # 每集白話導覽 (docs/episodes/epXX/README.md)
│   ├── SECURITY-AND-SECRETS.md # 金鑰管理與隱私界線
│   └── TROUBLESHOOTING.md # 跨集數集中除錯指南
├── .agent/                # AI Agent 規範與執行合約
│   ├── AGENT-RULES.md     # Agent 核心作業守則
│   └── episodes/          # 各集機器可讀合約 (episode.json + TASK.md)
├── .booking/              # 本地實例狀態登錄
│   ├── project-state.schema.json  # 狀態結構定義
│   └── project-state.json.example # 範例檔 (實際狀態受 .gitignore 保護)
├── CHANGELOG.md           # 產品演進日誌
├── AGENTS.md              # AI Agent 入口指引
└── README.md              # 產品首頁
```

---

## ⚙️ Configuration (設定與金鑰入口)

為確保開源安全性，本專案嚴格區分**公開設定**與**私有憑證**：

1. **公開環境範本**：
   * `packages/backend/wrangler.toml`：存放通用架構與環境變數佔位符，**禁止寫入真實 Database ID 或個人 LINE UID**。
2. **本地私有配置 (受 `.gitignore` 保護)**：
   * `packages/backend/wrangler.local.toml`：本地開發或部署時指定特定店家的 `database_id`、`ADMIN_LINE_IDS`、`STATION_NAME` 等。
   * `packages/frontend/.env`：指定前端 `VITE_LIFF_ID` 與 `VITE_STATION_NAME`。
3. **雲端敏感密鑰 (Zero-Disk 零落地託管)**：
   * 透過 Wrangler 直接注入 Worker Secret，絕不儲存於本機檔案或 Git：
     ```bash
     cd packages/backend
     npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
     npx wrangler secret put LINE_CHANNEL_SECRET
     npx wrangler secret put TURNSTILE_SECRET_KEY
     ```

---

## 🔒 Security (安全基線與隱私守則)

本專案實施最高規格之開源安全標準：
- **Zero-Password 零密碼架構**：管理端僅依賴 LINE 官方 ID Token 驗簽，無靜態密碼洩漏與撞庫風險。
- **Zero-Disk 憑證保護**：所有 Access Token 與 Secret 僅在記憶體流轉，嚴禁寫入磁碟與 Git 倉庫。
- **Fail-Closed 嚴密防禦**：未通過真人驗證或缺少簽章之請求直接阻斷，保障免費資源額度。
- **詳細隱私與金鑰指南**：請參閱 **[docs/SECURITY-AND-SECRETS.md](docs/SECURITY-AND-SECRETS.md)**。

---

## 📚 Documentation (文件導覽)

* **給 AI Agent**：
  * [AGENTS.md](AGENTS.md) — AI Agent 作業入口指引。
  * [.agent/AGENT-RULES.md](.agent/AGENT-RULES.md) — Agent 核心作業守則與文件更新規則。
* **給人類開發者與使用者**：
  * [docs/episodes/](docs/episodes/) — 各集 YouTube 教學導覽手冊。
  * [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — 共通問題集中故障排除指南。
  * [docs/SECURITY-AND-SECRETS.md](docs/SECURITY-AND-SECRETS.md) — 敏感金鑰管理與隱私安全規範。
  * [BEGINNER_GUIDE.md](BEGINNER_GUIDE.md) — 初學者白話圖文部署指南。
  * [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) — 手動開發者部署手冊。
  * [CHANGELOG.md](CHANGELOG.md) — 產品版本歷史紀錄。

---

## 📄 License (授權條款)

本專案採用 [MIT License](LICENSE) 開源授權。
