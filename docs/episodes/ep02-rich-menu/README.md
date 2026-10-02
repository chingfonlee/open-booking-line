# Episode 02 — LINE Rich Menu (圖文選單體系)

> 本集聚焦於為已具備基礎預約能力的專案擴充 **LINE 官方帳號圖文選單體系 (Rich Menu)**，包含全體顧客適用的 2 宮格服務選單，以及商家幹部專屬的「4 大宮格調度工作台」。

> [!IMPORTANT]
> **教學影片與專案最新狀態同步聲明**：  
> 影片錄製時主要示範顧客端雙分區選單或早期 6 快捷管理選單。隨著實地操作回饋與介面人體工學演進，管理者專屬選單已進一步升級為專為戶外烈日農地作業設計的 **「4 大宮格調度工作台（4-Grid Console）」**（包含超大 116px 標題、370px 巨型圖示、大地磚紅休假預定，以及完整支援 LINE LIFF `liff.state` 參數之深層連結直達）。  
> **若教學影片內容或舊版展示與當前專案程式碼有所出入，請一律以 GitHub 專案最新原始碼與此處說明文件為準。**

---

## What This Adds (本集新增能力)

* **`rich-menu` 能力體系**：
  * **全體顧客預設選單 (Customer 2-Grid Rich Menu)**：
    * 2500×1686 溫潤大地雙分區（左：線上預約 / 右：查詢進度）。
    * 本地確定性 SVG + Sharp 渲染，零外部依賴、圖檔小於 200KB（極速載入）。
    * LINE 聊天室被動進度查詢：點擊「查詢預約」被動回傳 Flex Message 卡片（完全不耗費每月免費推播則數）。
  * **商家幹部專屬 4 大宮格調度工作台 (Admin 4-Grid Console)**：
    * **左上【待審確認】（新單綠）**：`?view=admin&filter=to_contact` 一鍵直達新申請單審核。
    * **右上【施工排程】（出工藍）**：`?view=admin&filter=confirmed` 一鍵直達今日出工與已確認排程。
    * **左下【休假預定】（大地磚紅）**：`?view=admin&tab=settings` 一鍵直達公休例外與營業時段設定。
    * **右下【代客排單】（溫潤茶褐）**：`?view=apply&mode=manual` 一鍵直達電話代客掛單作業。
    * **深層連結與 LIFF 狀態解析 (Deep-Linking & liff.state)**：前端支援解析一般 URL 與 LINE LIFF 重導後的 `liff.state` 參數，無縫直達特定功能分頁。
    * **極致戶外抗光設計**：116px 特粗黑體標題、370px 巨型向量圖示，專為農地戶外強光下單手快速操作防誤觸設計。
  * **企業級安全發布與回滾模組 (Safe Publisher & Rollback)**：
    * **雜湊審批門禁鎖 (Approval Gate)**：以 SHA-256 雙向鎖定圖檔與規格，嚴格遵守「人類核准前零寫入」之 Fail-Closed 原則。
    * **Dry-Run 模擬預檢**：乾跑模式完整驗算 Hash、呼叫 LINE 規格驗簽並查詢原選單，確保零外部資源建立與零修改。
    * **三情境原子發布與安全回滾**：若發布過程中斷或失敗，全自動無損還原至先前生效之選單或乾淨狀態。

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
- **商家幹部專屬 4 大宮格調度工作台 (Admin 4-Grid Console)**：針對站所幹部 LINE UID 派發之專屬工作台（待審確認、施工排程、休假預定、代客排單），支援深層直達。
- 本地 `.booking/project-state.json` 將正式記錄 `capabilities.rich-menu` 為 `verified`。

---

## 🛠️ 商家專屬選單綁定與解除指南 (Admin Per-User Rich Menu)

系統採用 LINE 官方 **Per-User Rich Menu API**，實現「一般顧客看 2 宮格顧客選單、商家幹部看 4 大宮格調度工作台」的權限隔離機制。

### 1. 開發者 / 終端機指令

```bash
# A. 將指定商家 LINE UID 綁定至幹部 4 大宮格工作台
node scripts/rich-menu/publisher.mjs --admin --uid <LINE_USER_ID>

# B. 解除該使用者之專屬選單（立即自動恢復為全體顧客預設選單）
node scripts/rich-menu/publisher.mjs --unlink --uid <LINE_USER_ID>
```
*(執行時需具備 `LINE_CHANNEL_ACCESS_TOKEN` 環境變數)*

---

### 2. 🤖 AI Agent 協同操作提示詞 (Prompt Templates)

您可以直接複製以下標準提示詞給您的 AI Coding Agent 執行選單管理作業：

#### 📌 提示詞 1：為商家/幹部綁定專屬工作台選單
> **「請幫我將管理員的 LINE UID `Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 綁定為 EP02 專屬的幹部 4 大宮格調度工作台選單（Admin 4-Grid Rich Menu）。」**
> 
> *Agent 預期行為*：讀取環境中的 Channel Access Token，執行 `node scripts/rich-menu/publisher.mjs --admin --uid <UID>`，並向 LINE API 驗證綁定成功。

#### 📌 提示詞 2：解除商家選單（恢復預設顧客版面）
> **「請幫我解除 LINE UID `Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 的管理員選單，讓該帳號恢復成一般顧客預設選單。」**
> 
> *Agent 預期行為*：執行 `node scripts/rich-menu/publisher.mjs --unlink --uid <UID>`，解除個人綁定。

#### 📌 提示詞 3：查詢特定使用者目前顯示的選單狀態
> **「請幫我檢查 LINE UID `Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 目前在官方帳號顯示的是顧客預設選單還是幹部 4 大宮格工作台？」**
> 
> *Agent 預期行為*：調用 `getRemoteUserRichMenu` 查詢該 UID 的遠端關聯，並比對 `.booking/rich-menu/managed.json` 說明當前狀態。

---

## Version (版本資訊)

- **能力識別碼**：`rich-menu`
- **狀態**：`Stable`（已通過端對端與實機驗收）
- **歷史快照 Tag**：
  - 最初顧客雙分區版本：[`ep02-rich-menu`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep02-rich-menu)
  - 溫潤大地色系美化版：[`ep02-warm-palette`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep02-warm-palette)
  - 雙卡片幹部選單版本：[`ep02-admin-rich-menu`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep02-admin-rich-menu)
  - **最新幹部 4 大宮格調度工作台版**：[`ep02-admin-4grid`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep02-admin-4grid)

---

## Video (教學影片)

- **YouTube 教學連結**：*(製作準備中)*  
  *(註：影片畫面以初版架構講解，最新功能演進請參照本文件)*
