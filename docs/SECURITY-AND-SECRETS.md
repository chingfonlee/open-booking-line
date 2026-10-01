# Security & Secrets Specification — 機密與設定分類規範

本文件嚴格定義 `open-booking-line` 專案中各類資料與金鑰的安全邊界、存放規範與生命週期。

---

## 🔐 四級設定與機密分類

| 分類層級 | 代表資料項目 | 存放位置 | 是否可進入 Git | 生命週期與存取原則 |
| :--- | :--- | :--- | :--- | :--- |
| **A. Public Configuration**<br>(公開設定) | • 功能開關預設值<br>• 通用公開示範設定<br>• 佔位符 (`your-liff-id`)<br>• 資料庫架構 (`schema.sql`) | `wrangler.toml`<br>`.env.example`<br>`packages/shared/types.ts` | ✅ **允許** | 永遠公開，給全世界開發者作為通用範本。 |
| **B. Private Local Configuration**<br>(店家本地私有設定) | • 店家名稱 (`STATION_NAME`)<br>• 店家專屬 `LIFF_ID`<br>• 店家管理員 LINE UID<br>• 本地開發 API Base URL | `.env`<br>`.env.local`<br>`.dev.vars`<br>`wrangler.local.toml` | ❌ **嚴格禁止**<br>(由 `.gitignore` 強制忽略) | 屬於單一店家實例，存於本機磁碟，絕不提交進任何公開分支。 |
| **C. Runtime Secret**<br>(線上運行金鑰) | • `LINE_CHANNEL_ACCESS_TOKEN`<br>• `LINE_CHANNEL_SECRET`<br>• `TURNSTILE_SECRET_KEY`<br>• Cloudflare API Token | Cloudflare Worker Secrets<br>(透過 `wrangler secret put` 注入) | ❌ **嚴格禁止** | 直接進入遠端 Worker 執行環境記憶體，**本地磁碟零存儲 (Zero-Disk)**。 |
| **D. Operation Secret**<br>(管理操作臨時金鑰) | • Agent 本地執行 LINE 管理 API 所需之臨時 Access Token (例如建立 Rich Menu) | 當次 Process 環境變數<br>或 `operation-secrets/*.secret` | ❌ **嚴格禁止**<br>(任務完成後即刻刪除) | 本地 Agent 執行批次操作時由使用者單次提供，禁止依賴對話上下文永久記憶。 |

---

## 🛡️ Git 提交前安全檢核清單 (Pre-Commit Checklist)

在將程式碼推送至公開 Repository 前，必須確認：

- [ ] `packages/backend/wrangler.toml` 僅包含範本佔位符 (`your-d1-database-id`, `Uxxxx`, `2000000000`)。
- [ ] 程式碼中不存在任何硬編碼的特定店家名稱、真實 LINE UID 或個人 LIFF ID。
- [ ] `.booking/project-state.json` 已被 `.gitignore` 排除，未出現於 `git status`。
- [ ] 所有含有真實憑證的 `.env` 或 `.env.local` 均未被追蹤。

---

## 🚨 憑證洩漏應變程序 (Incident Response)

如果發現真正的敏感密鑰（如 Channel Access Token 或 Channel Secret）曾意外進入 Git 歷史紀錄：

1. **立即視為已洩漏**：不應抱持僥倖心理。
2. **第一時間於平台進行金鑰旋轉 (Rotate / Regenerate)**：
   - 前往 [LINE Developers Console](https://developers.line.biz/console/) 重新生成 Channel Access Token / Channel Secret。
   - 前往 Cloudflare 重新生成 Turnstile Secret Key。
3. **更新線上環境**：
   - 透過 `npx wrangler secret put <KEY_NAME>` 覆蓋線上 Worker Secret。
4. **清理歷史記錄**：使用 `git filter-repo` 或重新初始化乾淨公開提交。
