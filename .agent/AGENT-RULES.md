# AGENT-RULES.md — AI Agent 核心作業守則

> 本文件為所有 AI Agent（包括 Antigravity、Claude Code、Cursor、Windsurf 等）在 `open-booking-line` 執行任務時的強制守則。

---

## 1. 核心交易防護 (Core Transaction Protection)
* **主幹優先**：「顧客填寫預約單並成功取得單號」為系統最核心生命線。
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
