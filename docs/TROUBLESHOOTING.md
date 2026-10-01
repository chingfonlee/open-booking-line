# 故障排除指南 (Troubleshooting Guide)

> 本文件統整 `open-booking-line` 在部署與運行各集數能力時常見的共通問題與解決方案。

---

## 1. LINE 相關問題

### Q1: LINE 開啟網頁出現「此服務目前正在開發中」
* **原因**：LINE Login Channel 預設處於 `Developing` 狀態，僅頻道開發者可存取。
* **解決方式**：前往 [LINE Developers Console](https://developers.line.biz/console/)，點入該 LINE Login Channel，於頁面頂部將 **`Developing`** 切換為 **`Published`**。

### Q2: 點擊管理後台的「使用 LINE 帳號授權登入」無反應或提示未授權
* **原因**：
  1. 您的 LINE User ID 未加入管理員白名單。
  2. 後端環境變數 `ADMIN_LINE_IDS` 未正確設定或部署。
* **解決方式**：
  1. 在後端環境變數中設定您的 LINE UID（格式如 `Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`）。
  2. 重新執行後端部署（`npx wrangler deploy`）。

### Q3: 聊天室輸入「查詢預約」沒有收到卡片
* **原因**：LINE Webhook 未啟用或未通過驗證。
* **解決方式**：
  1. 在 [LINE OA 後台 (manager.line.biz)](https://manager.line.biz/) 的「回應設定」中將 **Webhook** 切換為「開啟」。
  2. 在 [LINE Developers 後台](https://developers.line.biz/) 的 Messaging API 頁面，將 Webhook URL 設定為 `https://<YOUR_WORKER_DOMAIN>/api/line/webhook`，並點擊 **Verify** 確認回傳 Success。

---

## 2. Cloudflare 相關問題

### Q1: 前端出現 CORS 錯誤 (Cross-Origin Request Blocked)
* **原因**：後端 `ALLOWED_ORIGINS` 未包含目前前端網域。
* **解決方式**：在 Worker 設定中加入前端網域（例如 `https://your-app.pages.dev,https://*.pages.dev`）並重新部署。

### Q2: 部署時 Wrangler 出現帳號或授權過期
* **原因**：Cloudflare CLI 授權憑證失效。
* **解決方式**：在終端機執行 `npx wrangler login` 重新授權瀏覽器。

### Q3: D1 查詢報錯 `no such table`
* **原因**：D1 資料表結構尚未初始化。
* **解決方式**：執行 `npx wrangler d1 execute <db-name> --file=packages/backend/schema.sql` 完成資料表建置。

---

## 3. 本地專案更新與 Git 相關

### Q1: 想要更新至下一集時發現本地檔案有衝突
* **安全原則**：**切勿使用 `git reset --hard`**。
* **解決方式**：
  1. 執行 `git status` 查看未提交變更。
  2. 確認私有設定檔（如 `wrangler.local.toml`、`.booking/project-state.json`）已列於 `.gitignore`。
  3. 對於追蹤檔案的修改，可執行 `git stash` 暫存，取得最新 `origin/main` 後再執行 `git stash pop`。
