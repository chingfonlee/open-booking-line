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
    * **農家共用手機隱私草稿**：採用 LocalStorage 安全暫存，開啟時主動詢問「繼續填寫」或「重新開始」，防止家庭成員意外查看他人個資；自最後修改起保留 7 天，送單成功自動清除。
    * **長者與 WCAG 無障礙友善**：支援雙指自由縮放（移除禁止縮放限縮）、全按鈕熱區 $\ge 48\text{px}$、輸入框字級 $\ge 16\text{px}$（防 iOS 聚焦自動放大破版）、換步焦點自動移至標題、驗證失敗自動聚焦首個錯誤欄位，並完整標註 `aria-current="step"`、`role="progressbar"` 與 `aria-live` 狀態朗讀。
    * **返回鍵與防跳步保護**：支援 URL Hash 與 History API，手機/LINE 原生返回鍵退回上一步不退頁；防跳步守衛自動阻斷未填前置步驟之直接跳轉。
  * **Cloudflare Workers 後端 API**：輕量高並發 Hono 框架，負責全欄位重驗、時段即時可用性預檢、複合頻率限制與推播調度。
  * **Cloudflare D1 資料庫**：無伺服器 SQLite 儲存預約單 (`service_requests`) 與排程設定 (`blocked_dates`)。
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

若您是初次使用，直接 Clone 開源專案最新主分支即可：

```bash
git clone https://github.com/chingfonlee/open-booking-line.git
cd open-booking-line
npm install
```

---

## Start (如何開始執行)

請將指令交由您的 AI Coding Agent 執行：

1. **AI 自動引導**：
   直接對 AI 輸入：
   > 「我想在目前專案安裝 Episode 01 basic-booking 能力，請引導我完成設定與部署。」

2. **手動開發者流程**：
   詳細步驟請參考 [DEPLOYMENT_GUIDE.md](../../../DEPLOYMENT_GUIDE.md) 或 `.agent/episodes/ep01-basic-booking/TASK.md`。

---

## Result (完成後成果)

安裝並完成實機驗證後，您將擁有：
- 一個可對外公開的 4 步驟無障礙預約網址（Pages / LIFF）。
- 即時接收預約推播的 LINE 官方帳號。
- 可透過 LINE 免密碼授權登入的管理後台。
- 本地 `.booking/project-state.json` 將註冊 `booking-core` 為 `verified` 狀態。
- 完整通過包含 ApplyForm 在內之全套自動化單元測試。

---

## Version (版本資訊)

- **能力識別碼**：`booking-core`
- **歷史快照 Tag**：
  - 最初發布版本：[`ep01-basic-booking`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep01-basic-booking)
  - 4 步驟導覽精靈與隱私草稿加固版：[`ep01-wizard-form`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep01-wizard-form)
- **狀態**：`Stable`（已通過實機端對端驗收與 142 項自動化測試）

---

## Video (教學影片)

- **YouTube 教學連結**：*(即將發布，敬請期待)*
  *(註：影片畫面以初版架構講解，最新功能演進請參照本文件)*
