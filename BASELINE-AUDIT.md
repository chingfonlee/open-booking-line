# BASELINE-AUDIT.md — Phase 0 基線審計報告

**審計時間：** 2026-10-01  
**計畫代號：** `Evolution-4Tier-Architecture`  
**審計範圍：** `open-booking-line` 程式庫現狀與安全性盤點

---

## 1. 儲存庫現狀 (Current Repository Role & Git Status)

* **本地工作目錄：** `C:\Users\user\claudecode\open-booking-line-series\open-booking-line`
* **目前分支 (Current Branch)：** `main`
* **目前遠端 (Current Remote)：**
  * `origin: https://github.com/chingfonlee/biz-resource-reservation.git` (私人/展示用遠端，非公開目標)
* **目標公開遠端：** `https://github.com/chingfonlee/open-booking-line.git` (尚未關聯為當前主要 origin)
* **現存 Git Tags：** 無任何 Tag (尚未建立 `ep01-basic-booking`)
* **最新 Commit：** `0772ee6 docs: streamline beginner flow to Option A chat-only input with zero terminal operation`

---

## 2. 敏感資料與識別碼盤點 (Secrets & Identifiers Discovered)

經過 Git Commit 歷史與目前工作目錄之全面搜尋：

### A. 真正敏感憑證 (Authentication Credentials / Secrets)
* **`LINE_CHANNEL_ACCESS_TOKEN`**：未在 Git 歷史中發現硬編碼（專案從初期即以說明要求注入 Cloudflare Worker Secret）。
* **`LINE_CHANNEL_SECRET`**：未在 Git 歷史中發現硬編碼。
* **`TURNSTILE_SECRET_KEY`**：Git 歷史中曾存在 Cloudflare 官方公開測試 key (`1x0000000000000000000000000000000AA`)，無真實 Secret 外洩。

### B. 私人識別碼與隱私資料 (Private Identifiers & Personal Data)
在受追蹤與未追蹤檔案中發現具體個人/特定站點資料：

| 檔案 | 欄位 | 數值現狀 | 性質 | 處置方式 |
| :--- | :--- | :--- | :--- | :--- |
| `packages/backend/wrangler.toml` | `database_id` | `9ab7d6d6-6e29-421b-8674-6e6bf0d3e770` | 私人 D1 ID | 移除，改為開源佔位符 |
| `packages/backend/wrangler.toml` | `database_name` | `xingnong-db` | 私人 DB 名稱 | 改為通用佔位符 |
| `packages/backend/wrangler.toml` | `ADMIN_NOTIFY_USER_ID` | `Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | 真實 LINE UID | 移除，改為佔位符 |
| `packages/backend/wrangler.toml` | `ADMIN_LINE_IDS` | `Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | 真實 LINE UID | 移除，改為佔位符 |
| `packages/backend/wrangler.toml` | `LINE_LOGIN_CHANNEL_ID` | `2000000000` | 私人 Channel ID | 移除，改為佔位符 |
| `packages/backend/wrangler.toml` | `LIFF_ID` | `2000000000-XXXXXXXX` | 私人 LIFF ID | 移除，改為佔位符 |
| `packages/backend/wrangler.toml` | `STATION_NAME` | `高雄服務站` | 私人站點名稱 | 改為通用示範站名 |
| `packages/frontend/src/components/ApplyForm.tsx` | Fallback LIFF | `|| '<LIFF_ID_PLACEHOLDER>'` | 硬編碼備援 | 移除 fallback |
| `packages/frontend/src/components/ApplyForm.tsx` | Fallback 站名 | `|| '高雄服務站'` | 硬編碼備援 | 改為通用預設 |
| `packages/backend/src/index.ts` | Fallback LIFF | `|| '<LIFF_ID_PLACEHOLDER>'` | 硬編碼備援 | 移除 fallback |
| `packages/frontend/.env` (未追蹤) | 站名/網址/Key | 包含真實 worker url、站名、turnstile | 本地私有 | 需確認被 gitignore 保護 |

---

## 3. Git 歷史與安全性風險 (Git History Risk)

1. **憑證旋轉需求 (Rotation Requirements)：**
   - 由於目前代碼庫與歷史中未曾提交過 `LINE_CHANNEL_ACCESS_TOKEN` 與 `LINE_CHANNEL_SECRET`，核心身份認證 Token 尚無外洩紀錄。
   - 但為確保最高安全級別，建議在開源正式發布前，使用者若曾使用同一組 Channel 進行公開展示，可視需要進行 LINE Token 重新生成（Rotate）。
2. **識別碼脫鉤需求：**
   - `packages/backend/wrangler.toml` 必須徹底清空私人 UID 與 D1 ID，改由開源範本取代。

---

## 4. 提前加入之 Episode 02 內容 (Premature Ep02 Artifacts Found)

依據實施計畫第 30 條（*「Episode 01 Tag 建立前禁止加入 Ep02 正式內容」*），以下檔案屬於提前引入之產物，需在 Phase 1 移出或暫存：
- `.agent/skills/rich-menu/`
- `skills/rich-menu/`
- `packages/frontend/public/rich_menu.jpg`
- `packages/frontend/public/rich_menu.png`
- `Flex申請服務.png`, `LIFFRICHMENU.png`

---

## 5. 建議執行行動清單 (Phase 1 & Phase 2 Action Items)

1. **Phase 1：**
   - 安全備份本地私人設定至忽略檔。
   - 去識別化清理 `wrangler.toml`、`ApplyForm.tsx`、`index.ts`。
   - 強化 `.gitignore`，確保 `.env`, `.env.local`, `.dev.vars`, `.booking/project-state.json` 被安全忽略。
   - 建立 `docs/SECURITY-AND-SECRETS.md`。
   - 移除提前引入之 Ep02 產物。
2. **Phase 2：**
   - 建立標準 `AGENTS.md`。
   - 建立 `.agent/AGENT-RULES.md`。
   - 建立 `.agent/episodes/ep01-basic-booking/` (`episode.json` + `TASK.md`)。
   - 建立 `.booking/` (`project-state.schema.json` + `project-state.json.example`)。
   - 建立最小化狀態工具 `scripts/project-state.mjs`。
   - 對齊遠端至 `https://github.com/chingfonlee/open-booking-line.git`。
