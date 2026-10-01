# Episode 01 — Basic Booking (基礎預約核心)

> 這是 `open-booking-line` 系列的第一集，專注於在 Cloudflare Serverless 與 LINE 官方生態上建立完整的**純文字預約與管理核心**。

---

## What This Adds (本集新增能力)

* **`booking-core` 能力**：
  * **LINE LIFF 預約表單**：農友 / 顧客點開即可帶入 LINE 暱稱完成預約。
  * **Cloudflare Workers 後端 API**：輕量高並發 Hono 框架，負責表單驗證、限流與推播調度。
  * **Cloudflare D1 資料庫**：無伺服器 SQLite 儲存預約單 (`service_requests`) 與排程設定 (`blocked_dates`)。
  * **LINE 官方即時推播**：新預約送出即發送 LINE Flex Message 通知站所人員。
  * **Zero-Password 零密碼管理後台**：透過 LINE ID Token 白名單驗證，無靜態密碼洩漏風險。
  * **Cloudflare Turnstile 防護**：智慧真人檢驗防禦惡意機器人洗單。

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
- 一個可對外公開的預約網址（Pages / LIFF）。
- 即時接收預約推播的 LINE 官方帳號。
- 可透過 LINE 免密碼授權登入的管理後台。
- 本地 `.booking/project-state.json` 將註冊 `booking-core` 為 `verified` 狀態。

---

## Version (版本資訊)

- **能力識別碼**：`booking-core`
- **歷史快照 Tag**：[`ep01-basic-booking`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep01-basic-booking)
- **狀態**：`Stable`（已通過實機驗收）

---

## Video (教學影片)

- **YouTube 教學連結**：*(即將發布，敬請期待)*
