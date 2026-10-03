# Episode 01 — Basic Booking (基礎預約核心)

> 這是 `open-booking-line` 系列的第一集，專注於在 Cloudflare Serverless 與 LINE 官方生態上建立完整的**純文字預約與管理核心**。

> [!IMPORTANT]
> **教學影片與專案最新狀態同步聲明**：  
> 隨著開源社群與在地農友實際使用回饋，本專案的介面人體工學與無障礙設計已持續迭代升級（例如由早期之一頁式表單全面升級為「4 步驟精緻分段導覽精靈」、新增共用手機隱私草稿防護與 WCAG 雙指縮放等）。  
> **若教學影片中的展示畫面或操作步驟與當前專案有所不同，請一律以 GitHub 專案最新原始碼與此處說明文件為準。**

---

## What This Adds (本集新增能力)

* **`booking-core` 能力**：
  * **4 步驟分段導覽預約精靈 (LINE LIFF)**：
    * **樣式 C 分段進度**：依農友思考直覺拆分為「需求項目 ➔ 地點時段 ➔ 聯絡資料 ➔ 核對送出」。
    * **核對與一鍵修改**：第 4 步提供全卡片摘要檢閱，各分區附「✏️ 修改」按鈕，改完直返核對頁不重複點擊。
    * **防幽靈送單與防連點保護**：解耦原生表單 `submit`、React 獨立 `key` 節點隔離、換步 500ms 安全冷卻時間（`canSubmitForm`）與全欄位 Enter 鍵防誤觸，徹底阻絕快速連點或 Enter 穿透引發之誤送單。
    * **農家共用手機隱私草稿**：採用 LocalStorage 安全暫存，開啟時主動詢問「繼續填寫」或「重新開始」，防止家庭成員意外查看他人個資；自最後修改起保留 7 天，送單成功自動清除。
    * **長者與 WCAG 無障礙友善**：支援雙指自由縮放（移除禁止縮放限縮）、全按鈕熱區 $\ge 48\text{px}$、輸入框字級 $\ge 16\text{px}$（防 iOS 聚焦自動放大破版）、換步焦點自動移至標題、驗證失敗自動聚焦首個錯誤欄位，並完整標註 `aria-current="step"`、`role="progressbar"` 與 `aria-live` 狀態朗讀。
    * **返回鍵與防跳步保護**：支援 URL Hash 與 History API，手機/LINE 原生返回鍵退回上一步不退頁；防跳步守衛自動阻斷未填前置步驟之直接跳轉。
  * **Cloudflare Workers 後端 API**：輕量高並發 Hono 框架，負責全欄位重驗、時段即時可用性預檢、複合頻率限制與推播調度。
  * **Cloudflare D1 資料庫與智慧引導**：無伺服器 SQLite 儲存預約單 (`service_requests`) 與排程設定 (`blocked_dates`)；支援 `npm run setup:db` 智慧配置，自動探測帳號既有資料庫，引導建立獨立 DB（防多官方帳號混雜）並主動檢核 `LIFF_ID` 前綴與 `LINE_LOGIN_CHANNEL_ID` 一致性（防止 ID 錯位導致身分驗證失敗與查無預約）。
  * **LINE 官方即時推播**：新預約送出即發送 LINE Flex Message 通知站所幹部，支援一鍵撥號確認。
  * **Zero-Password 零密碼管理後台**：透過 LINE ID Token 白名單驗證，無靜態密碼洩漏風險。
  * **Cloudflare Turnstile 防護**：智慧真人檢驗防禦惡意機器人洗單，支援過期自動重設取權杖與重試上限保護。

---

## Prerequisites (開始前準備)

在開始安裝此集能力前，請準備好以下 4 項免費資源：
1. **LINE 官方帳號 (LINE OA)**：提供推播小秘書與官方聊天室。
2. **LINE Developers Console 帳號**：取得 Channel ID、Secret 與建立 LIFF 應用。
3. **Cloudflare 帳號**：免費託管 Workers、D1 資料庫與 Pages 前端。
4. **AI Coding Agent**（例如 Antigravity、Claude Code、OpenCode 或 Cursor）與本機 Node.js 22 LTS 環境。

---

## Get / Update This Episode (如何取得本集專案)

* **初次使用（全新安裝）**：
  ```bash
  git clone https://github.com/chingfonlee/open-booking-line.git
  cd open-booking-line
  npm install
  ```
* **既有專案更新（已存在本機目錄）**：
  ```bash
  cd open-booking-line
  git pull origin main
  npm install
  ```
  *(💡 請確保本地專案已拉取至 `main` 最新版本，以套用最新的四步驟確認防誤送守衛與 D1 智慧配置腳本)*

---

## Start (如何開始執行)

### 推薦自動化部署路徑
1. **配置資料庫與防呆檢核**：
   ```bash
   npm run setup:db
   ```
   系統自動檢測 Cloudflare 帳號既有資料庫，引導建立獨立 DB 或沿用既有 DB，並自動驗證 `LIFF_ID` 前綴與 `LINE_LOGIN_CHANNEL_ID` 是否相符。
2. **配置真人安全防護 (Turnstile)**：
   ```bash
   npm run setup:turnstile
   ```
3. **注入 LINE 敏感密鑰**：
   ```bash
   cd packages/backend
   npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
   npx wrangler secret put LINE_CHANNEL_SECRET
   ```
4. **發布部署**：
   ```bash
   npm run deploy:backend
   cd ../frontend && npm run build && npx wrangler pages deploy dist --project-name <pages-project-name>
   ```

### AI Agent 引導模式
直接對 AI 輸入：
> 「我想在目前專案安裝 Episode 01 basic-booking 能力，請引導我完成設定與部署。」

---

## Result (完成後成果)

安裝並完成實機驗證後，您將擁有：
- 一個可對外公開的 4 步驟無障礙預約網址（Pages / LIFF）。
- 即時接收預約推播的 LINE 官方帳號。
- 可透過 LINE 免密碼授權登入的管理後台。
- 本地 `.booking/project-state.json` 將註冊 `booking-core` 為 `verified` 狀態。
- 完整通過包含 ApplyForm 與 SetupDB 在內之全套自動化單元測試（**155/155 PASS**）。

---

## Version (版本資訊)

- **能力識別碼**：`booking-core`
- **歷史快照 Tag**：
  - 最初發布版本：[`ep01-basic-booking`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep01-basic-booking)
  - 4 步驟導覽精靈與隱私草稿加固版：[`ep01-wizard-form`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep01-wizard-form)
- **狀態**：`Stable`（已通過實機端對端驗收與 155 項自動化測試）

---

## Video (教學影片)

- **YouTube 教學連結**：*(即將發布，敬請期待)*
  *(註：影片畫面以初版架構講解，最新功能演進請參照本文件)*
