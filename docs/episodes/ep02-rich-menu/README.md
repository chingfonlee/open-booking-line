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
- **全體顧客預設選單 (Default Rich Menu)**：LINE 官方帳號開啟時預設展示的高質感溫潤大地 2 宮格選單（線上預約 + 查詢進度）。
- **商家專屬管理工作台 (Per-User Admin Rich Menu)**：針對站所幹部 LINE UID 派發之「雙卡片 × 6 快捷操作」選單，包含案件審核、今日派工、電話代客登記、公休設定、歷史查詢與示範視角。
- 本地 `.booking/project-state.json` 將正式記錄 `capabilities.rich-menu` 為 `verified`。

---

## 🛠️ 商家專屬選單綁定與解除指南 (Admin Per-User Rich Menu)

系統採用 LINE 官方 **Per-User Rich Menu API**，實現「一般顧客看 2 宮格顧客選單、商家管理員看 6 快捷管理選單」的權限隔離機制。

### 1. 開發者 / 終端機指令

```bash
# A. 將指定商家 LINE UID 綁定至管理員專屬選單
node scripts/rich-menu/publisher.mjs --admin --uid <LINE_USER_ID>

# B. 解除該使用者之專屬選單（立即自動恢復為全體顧客預設選單）
node scripts/rich-menu/publisher.mjs --unlink --uid <LINE_USER_ID>
```
*(執行時需具備 `LINE_CHANNEL_ACCESS_TOKEN` 環境變數)*

---

### 2. 🤖 AI Agent 協同操作提示詞 (Prompt Templates)

您可以直接複製以下標準提示詞給您的 AI Coding Agent（如 Antigravity、Claude Code、Cursor 等）執行選單管理作業：

#### 📌 提示詞 1：為商家/幹部綁定專屬選單
> **「請幫我將管理員的 LINE UID `Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 綁定為 EP02 專屬的商家管理工作台選單（Admin Rich Menu）。」**
> 
> *Agent 預期行為*：讀取環境中的 Channel Access Token，執行 `node scripts/rich-menu/publisher.mjs --admin --uid <UID>`，並向 LINE API 驗證綁定成功。

#### 📌 提示詞 2：解除商家選單（恢復預設顧客版面）
> **「請幫我解除 LINE UID `Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 的管理員選單，讓該帳號恢復成一般顧客預設選單。」**
> 
> *Agent 預期行為*：執行 `node scripts/rich-menu/publisher.mjs --unlink --uid <UID>`，解除個人綁定。

#### 📌 提示詞 3：查詢特定使用者目前顯示的選單狀態
> **「請幫我檢查 LINE UID `Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 目前在官方帳號顯示的是預設選單還是商家管理選單？」**
> 
> *Agent 預期行為*：調用 `getRemoteUserRichMenu` 查詢該 UID 的遠端關聯，並比對 `.booking/rich-menu/managed.json` 說明當前狀態。

---

## Version (版本資訊)

- **能力識別碼**：`rich-menu`
- **狀態**：`Stable`（已通過端對端與實機驗收）
- **歷史快照 Tag**：[`ep02-admin-rich-menu`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep02-admin-rich-menu)

---

## Video (教學影片)

- **YouTube 教學連結**：*(製作準備中)*

