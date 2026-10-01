# Episode 02 — LINE Rich Menu (圖文選單擴充)

> 本集聚焦於為已具備基礎預約能力的專案擴充 **LINE 官方帳號圖文選單 (Rich Menu)**，讓顧客能在聊天室首頁一鍵點擊開啟 LIFF 預約與被動查詢預約進度。

---

## What This Adds (本集新增能力)

* **`rich-menu` 能力**：
  * **圖文選單資源產生**：包含直覺易用的預約入口與查詢按鈕。
  * **LINE Messaging API 自動化上傳與發布**：由腳本或 Agent 安全調用 LINE API 建立 Rich Menu 並綁定為預設選單。
  * **LINE 聊天室進度查詢整合**：點擊「查詢預約」被動回傳 Flex Message 卡片（完全不耗費每月免費推播則數）。

---

## Prerequisites (前置條件)

在開始安裝此能力前，專案必須滿足：
1. **前置能力依賴**：本地 `.booking/project-state.json` 中的 `booking-core` 必須已為 `verified` 狀態（即完成 Episode 01）。
2. **LINE OA 權限**：具備 LINE Messaging API Channel Access Token。
3. **現有 LIFF 網址**：已取得 Ep01 建立之 LIFF Endpoint。

---

## Get / Update This Episode (如何安全取得本集更新)

若您是從 Episode 01 接續進行，您的本地專案可能需要同步最新的開源專案代碼。

> ⚠️ **重要安全原則**：**嚴禁使用 `git reset --hard` 或 `git checkout .` 等破壞性指令**，這會抹除您的本地私有設定！

Agent 與開發者應遵循以下安全更新程序：

### 步驟 1：檢視工作目錄狀態
```bash
git status
```

### 步驟 2：依狀態安全處理
* **情境 A — 工作目錄乾淨 (Clean)**：
  可以直接安全拉取最新更新：
  ```bash
  git pull origin main
  ```
  完成後確認 `.agent/episodes/ep02-rich-menu/` 存在即可。

* **情境 B — 存在本地修改 (Modified / Untracked)**：
  1. 檢視修改內容，確認修改是否屬於私有設定（如 `wrangler.local.toml`、`.env`、`.booking/project-state.json`）。
  2. 若有追蹤檔案的修改，可使用 `git stash` 暫存，或開立本地專屬分支。
  3. 安全取得最新 `main` 後，再還原本地專屬設定。

---

## Start (如何開始執行)

取得更新後，直接對您的 AI Coding Agent 發出指令：

> 「請檢查我目前的專案狀態，並在目前專案安裝 Episode 02 rich-menu 能力。」

Agent 會自動：
1. 檢核前置 `booking-core` 是否已就緒。
2. 讀取 `.agent/episodes/ep02-rich-menu/TASK.md` 執行 SOP。
3. 完成圖文選單建立、驗證，並在通過後於 `.booking/project-state.json` 註冊 `capabilities.rich-menu`。

---

## Result (完成後成果)

通過實機驗收後，您將獲得：
- LINE 官方帳號開啟時預設展示的高質感 Rich Menu。
- 點擊按鈕直接開啟 LIFF 預約或免費查詢進度。
- 本地 `.booking/project-state.json` 將正式記錄 `capabilities.rich-menu` 為 `verified`。

---

## Version (版本資訊)

- **能力識別碼**：`rich-menu`
- **狀態**：`Stable`（已通過端對端與實機驗收）
- **歷史快照 Tag**：[`ep02-rich-menu`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep02-rich-menu)

---

## Video (教學影片)

- **YouTube 教學連結**：*(製作準備中)*
