# Episode 02 — LINE Rich Menu (圖文選單體系)

> 本集聚焦於為已具備基礎預約能力的專案擴充 **LINE 官方帳號圖文選單體系 (Rich Menu)**，包含全體農友適用的 2 宮格服務選單，以及合作社幹部專屬的「4 大宮格調度工作台」。

> [!IMPORTANT]
> **教學影片與專案最新狀態同步聲明**：  
> 影片錄製時主要示範農友端雙分區選單或早期 6 快捷管理選單。隨著實地操作回饋與介面人體工學演進，管理者專屬選單已進一步升級為專為戶外烈日農地作業設計的 **「4 大宮格調度工作台（4-Grid Console）」**（包含超大 116px 標題、370px 巨型圖示、大地磚紅休假預定，以及完整支援 LINE LIFF `liff.state` 參數之深層連結直達）。  
> **若教學影片內容或舊版展示與當前專案程式碼有所出入，請一律以 GitHub 專案最新原始碼與此處說明文件為準。**

---

## What This Adds (本集新增能力)

* **`rich-menu` 能力體系**：
  * **全體農友預設選單 (Farmer 2-Grid Rich Menu)**：
    * 2500×1686 溫潤大地雙分區（左：線上預約 / 右：查詢進度）。
    * 本地確定性 SVG + Sharp 渲染，零外部依賴、圖檔小於 200KB（極速載入）。
    * LINE 聊天室被動進度查詢：點擊「查詢預約」被動回傳 Flex Message 卡片（完全不耗費每月免費推播則數）。
  * **合作社幹部專屬 4 大宮格調度工作台 (Admin 4-Grid Console)**：
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

## Start (如何開始執行 — 一鍵提示詞與互動流程)

為了讓不熟悉電腦指令的使用者也能輕鬆完成，您**不需要分段複製多個提示詞**。

只需將下方這段 **「一鍵完成 EP02 圖文選單」提示詞** 完整複製並貼給您的 AI Coding Agent。Agent 將會自動執行前置作業，並在需要您確認或提供資料時**主動逐步詢問您**：

---

### 📋 一鍵複製專用提示詞 (Copy & Paste Once)

> 複製下方整段內容，一次貼給 AI Agent 即可：

```text
請協助我在目前專案中安裝並發布 EP02 的 LINE 圖文選單（Rich Menu）。

請依循以下 3 階段進行，並在每個關鍵節點主動停下來詢問我，不要讓我手動找指令執行：

【第 1 階段：前置探索與生成預覽】
1. 檢查我的專案設定（LIFF 預約網址、站所名稱、查詢關鍵字）。
2. 使用本地渲染引擎產出 2500x1686 的圖文選單預覽圖（.booking/rich-menu/preview.png）。
3. 產生完成後，請停下來「展示預覽圖路徑」並詢問我：「請確認選單畫面與按鈕文字是否滿意？確認後請回覆『確認通過』或告訴我想修改的地方。」

【第 2 階段：授權門禁鎖定 (Approval Gate)】
當我回覆確認通過後：
1. 請自動執行審批腳本（node scripts/rich-menu/approval.mjs --approve），計算圖檔與規格的防偽 SHA-256 雜湊值並寫入門禁鎖。
2. 完成鎖定後，若環境中缺少 LINE 權杖，請主動詢問並提醒我提供：LINE Messaging API 的 Channel Access Token。

【第 3 階段：安全發布至 LINE 官方帳號】
當金鑰就緒後：
1. 請先自動執行 Dry-Run 模擬預檢，確認遠端驗證通過。
2. 正式將圖文選單發布至 LINE 官方並設為全體農友預設選單。
3. 更新專案狀態，並引導我如何用手機開啟 LINE 官方帳號進行實機點擊驗收。

現在請直接從【第 1 階段】開始執行！
```

---

### 💡 互動過程說明（使用者只會遇到這兩個提問）

貼上上述提示詞後，您只需要在對話視窗中輕鬆回答 AI 的兩次提問：

1. **第一次提問（看圖確認）**：
   - AI 會產出 `.booking/rich-menu/preview.png`，並問您圖案好不好看。
   - 您只要直接回覆：**「確認通過」**。
2. **第二次提問（提供金鑰）**：
   - AI 會詢問您的 LINE Token。
   - 您只要將 LINE Developers 後台複製下來的 **Channel Access Token** 貼給 AI，AI 就會自動安全發布並完成所有設定！

---

## Result (完成後成果)

通過實機驗收後，您將獲得：
- **全體農友預設選單 (Default Rich Menu)**：LINE 官方帳號開啟時預設展示的高質感溫潤大地 2 宮格選單（線上預約 + 查詢進度）。
- **合作社幹部專屬 4 大宮格調度工作台 (Admin 4-Grid Console)**：針對站所幹部 LINE UID 派發之專屬工作台（待審確認、施工排程、休假預定、代客排單），支援深層直達。
- 本地 `.booking/project-state.json` 將正式記錄 `capabilities.rich-menu` 為 `verified`。

---

## 🛠️ 合作社幹部專屬選單綁定與解除指南 (Admin Per-User Rich Menu)

系統採用 LINE 官方 **Per-User Rich Menu API**，實現「一般農友看 2 宮格選單、合作社幹部看 4 大宮格調度工作台」的權限隔離機制。

### 1. 開發者 / 終端機指令

```bash
# A. 將指定合作社幹部 LINE UID 綁定至 4 大宮格工作台
node scripts/rich-menu/publisher.mjs --admin --uid <LINE_USER_ID>

# B. 解除該使用者之專屬選單（立即自動恢復為全體農友預設選單）
node scripts/rich-menu/publisher.mjs --unlink --uid <LINE_USER_ID>
```
*(執行時需具備 `LINE_CHANNEL_ACCESS_TOKEN` 環境變數)*

---

### 2. 🤖 AI Agent 協同操作提示詞 (Prompt Templates)

您可以直接複製以下標準提示詞給您的 AI Coding Agent 執行選單管理作業：

#### 📌 提示詞 1：為合作社幹部綁定專屬工作台選單
> **「請幫我將管理員的 LINE UID `Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 綁定為 EP02 專屬的幹部 4 大宮格調度工作台選單（Admin 4-Grid Rich Menu）。」**
> 
> *Agent 預期行為*：讀取環境中的 Channel Access Token，執行 `node scripts/rich-menu/publisher.mjs --admin --uid <UID>`，並向 LINE API 驗證綁定成功。

#### 📌 提示詞 2：解除幹部選單（恢復預設農友版面）
> **「請幫我解除 LINE UID `Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 的管理員選單，讓該帳號恢復成一般農友預設選單。」**
> 
> *Agent 預期行為*：執行 `node scripts/rich-menu/publisher.mjs --unlink --uid <UID>`，解除個人綁定。

#### 📌 提示詞 3：查詢特定使用者目前顯示的選單狀態
> **「請幫我檢查 LINE UID `Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 目前在官方帳號顯示的是農友預設選單還是幹部 4 大宮格工作台？」**
> 
> *Agent 預期行為*：調用 `getRemoteUserRichMenu` 查詢該 UID 的遠端關聯，並比對 `.booking/rich-menu/managed.json` 說明當前狀態。

---

## Version (版本資訊)

- **能力識別碼**：`rich-menu`
- **狀態**：`Stable`（已通過端對端與實機驗收）
- **歷史快照 Tag**：
  - 最初農友雙分區版本：[`ep02-rich-menu`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep02-rich-menu)
  - 溫潤大地色系美化版：[`ep02-warm-palette`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep02-warm-palette)
  - 雙卡片幹部選單版本：[`ep02-admin-rich-menu`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep02-admin-rich-menu)
  - **最新幹部 4 大宮格調度工作台版**：[`ep02-admin-4grid`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep02-admin-4grid)

---

## Video (教學影片)

- **YouTube 教學連結**：*(製作準備中)*  
  *(註：影片畫面以初版架構講解，最新功能演進請參照本文件)*
