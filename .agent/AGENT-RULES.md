# AGENT-RULES.md — AI Agent 核心作業守則

> 本文件為所有 AI Agent（包括 Antigravity、Claude Code、Cursor、Windsurf 等）在 `open-booking-line` 執行任務時的強制守則。

---

## 0. 工作區與 Git 時效性檢查 (Workspace & Git Freshness Pre-flight)
* **啟動任務首要步驟**：Agent 在開始執行任何任務（包括初次安裝、重新執行、日常維護或 Debug）前，**必須先確認工作區受 Git 控制且為最新狀態**。
* **分支時效檢查**：
  1. 執行 `git status` 與 `git remote -v`，確認當前目錄為目標專案並受 Git 管理。
  2. 檢查本地 `main` 分支是否落後於遠端 `origin/main`。
  3. 若工作區乾淨且遠端有更新，**必須先執行 `git pull origin main` 同步最新程式碼與文件**。
  4. 若存在本地未提交之修改，先確認其性質，嚴禁在過期的舊版本上盲目分析或執行部署。
* **多專案目錄防呆**：確認當前終端機路徑為本專案之主目錄，嚴禁在歷史舊專案或非目標同名目錄中誤操作。

## 1. 核心交易防護 (Core Transaction Protection)
* **主幹優先**：「農友填寫預約單並成功取得單號」為系統最核心生命線。
* 任何附加功能或新擴充出錯，絕不可阻斷基礎預約流程。

## 2. 旁路功能隔離 (Feature Isolation & Circuit Breaker)
* 所有非核心旁路功能（如 LINE 額外推播、統計計算、新欄位處理）**必須以獨立 `try-catch` 包裹**。
* 旁路出錯僅記錄 `console.warn`，**嚴禁拋出未捕獲錯誤（Uncaught Exception）導致 API 回傳 HTTP 500**。

## 3. 資料庫安全擴充原則 (Safe Schema)
* **只增不減（Additive Only）**：嚴禁刪除既有欄位或變更欄位型別。
* **嚴禁未設預設值的 `NOT NULL`**：新增欄位**必須允許 `NULL` 或具備明確 `DEFAULT` 值**。
* **雙向向下相容**：即使舊版前端未送新欄位，或舊資料庫缺少新欄位，後端 INSERT / SELECT 必須維持正常。

## 4. 嚴禁憑證進 Git (No Secrets in Git)
* `LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET`、`TURNSTILE_SECRET_KEY` 等 Runtime Secret 只能透過 `wrangler secret put` 寫入雲端，**本地磁碟零存儲 (Zero-Disk)**。
* 嚴禁在程式碼、提示詞或 Git 追蹤檔案中硬編碼真實金鑰。

## 5. 嚴禁私人設定進 Git (No Private Configuration in Git)
* 特定店家名稱、個人 LINE UID、個人專屬 LIFF ID 屬於單一實例隱私。
* 只能放置於 `.env.local`、`.dev.vars` 或本地忽略設定，公開檔案一律維持通用佔位符。

## 6. 狀態必須驗證後更新 (Verified State Registry)
* 嚴格遵守 `Execute ➔ Verify ➔ Pass? ➔ Update State`。
* **不得**因為「代碼已產生」、「指令已執行」或「Agent 認為應該成功」就將能力標記為 `verified`。
* 只有實際測試通過（網頁打開、真實送單成功、D1 寫入確認）後，方可登錄。
* 本地狀態格式嚴格遵守 `.booking/project-state.schema.json`，以 `capabilities.<id>.status = "verified"` 作為唯一真理，不得自創 `installedEpisodes` 或布林值。

## 7. 執行前檢查前置依賴 (Check Prerequisites First)
* 在執行任何 Episode 任務前，必須先檢查 `episode.json` 中的 `requires`。
* 若前置依賴未驗證，必須先引導使用者完成前置任務，不得強行跳級執行。

## 8. 不得破壞已驗證能力 (No Regression of Verified Capabilities)
* 新增能力時，不得修改或破壞過去 Episode 已經標記為 `verified` 的現有能力。

## 9. 重大功能開關控制 (Feature Flags / Switches)
* 跨階段重大新功能（如多服務目錄、新版管理後台）應具備環境變數開關。
* 當生產環境出現非預期異常時，能一鍵切換回基礎安全模式。

## 10. 禁止自行假設憑證 (Never Assume Credentials)
* Agent 不得依賴過去的對話記憶來假設使用者仍擁有有效的 Token。
* 缺少 Operation Secret 時，必須以友善提示引導使用者於當次操作提供。

## 11. 無法驗證即不得標記完成 (No Pass, No Verification)
* 若因為網路限制、缺乏金鑰或外部環境異常而無法執行真實端對端驗證，Agent 必須誠實向使用者回報「代碼已就緒，等待實機驗證」，**不得在 State 寫入 `verified`**。

## 12. 禁止重寫不相關核心模組 (No Unnecessary Framework Rewrites)
* 保持 Cloudflare 原生 Serverless (Pages + Workers + Hono + D1) 架構。
* 禁止為了實現單一集數的特定功能，擅自將專案重構為 Express、NestJS、傳統 VPS、PostgreSQL 或引入不必要之複雜設計模式。

---

## 13. 文件責任劃分守則 (Documentation Ownership Rule)
所有文件皆有固定之單一責任，Agent 修改文件前必須先判斷所屬層級，**嚴禁將同一份資訊大量複製至多個位置**：
* **Root `README.md` (產品首頁)**：
  * 責任：描述**目前穩定產品樣貌 (Current Stable State)**、**已驗證功能 (Current Verified Capabilities)**、人類導覽、Episode 簡表。
  * 嚴禁：當成歷史紀錄堆疊每集詳細演進；標記未驗證之功能為已支援；複製詳細 Agent 執行步驟。
* **`docs/episodes/<episode-id>/README.md` (人類集數手冊)**：
  * 責任：向一般使用者與 YouTube 觀眾說明該集新增內容、前置條件、安全取得更新方式、如何開始、預期成果與 Tag/影片連結。保持約一個畫面的簡短篇幅。
  * 嚴禁：複製完整 Agent TASK、內部 API 流程或驗簽邏輯。
* **`.agent/episodes/<episode-id>/` (Agent 執行合約)**：
  * 責任：存放機器可讀之 `episode.json`（依賴與產出宣告）與 `TASK.md`（Agent 執行 SOP、驗證條件與狀態寫入規則）。
* **`CHANGELOG.md` (產品歷史變更)**：
  * 責任：按版本/集數紀錄產品演進歷史（What changed across time），不作為新手教學或操作手冊。
* **Git Tags**：
  * 責任：保存歷史程式碼快照，供 YouTube 影片回溯或 Debug，不作為使用者本地進度管理。

---

## 14. 文件更新的正式時間序 (Documentation Update Sequence)
在執行任何 Episode 任務時，固定遵循以下不可顛倒的時間序：
```text
Implementation (實作)
      ↓
Verification (實機驗證)
      ↓
PASS (全數通過)
      ↓
Update project state (.booking/project-state.json 登錄 verified)
      ↓
Update Root README current capabilities (標記為 ✓)
      ↓
Finalize Episode README (更新集數文件狀態)
      ↓
Update CHANGELOG (新增該集正式變更)
      ↓
Commit stable state (提交乾淨代碼至 Git)
      ↓
Create Episode Tag (建立版本快照標籤)
```
> ⚠️ **重要原則**：若 Verification 失敗，**README 不得標記支援、CHANGELOG 不得宣告完成、State 不得標記 verified、Git Tag 絕不得建立**。

---

## 15. 下一集安全取得流程 (Safe Episode Update Protocol)
當使用者要求升級或進入下一個 Episode 時，Agent 必須先檢查 Git 狀態：
1. **執行 `git status` 檢查工作目錄**。
2. **情境 A（乾淨工作目錄）**：可安全執行 `git pull origin main`，完成後檢查目標 Episode 目錄是否就緒。
3. **情境 B（存在本地修改）**：
   * **嚴禁**使用 `git reset --hard`、`git checkout .` 或任何破壞性指令來抹除使用者環境！
   * 識別修改項目：若是私有設定（`.env`、`wrangler.local.toml`、`.booking/project-state.json`），確保其受 `.gitignore` 保護；若是已追蹤檔案，主動向使用者說明並使用 `git stash` 或專屬分支安全保護修改。

---

## 16. 共通問題集中收斂 (Centralized Troubleshooting)
* 嚴禁為每一集單獨建立重複的 `epXX-troubleshooting.md`。
* **集數專屬提示**：直接在該集 `docs/episodes/<episode-id>/README.md` 保留 1~2 點簡短說明。
* **跨集數共通問題**：統一收斂至 `docs/TROUBLESHOOTING.md`（例如 LINE 權限、Cloudflare 帳號過期、CORS 設定等），各集手冊僅以連結引導。
