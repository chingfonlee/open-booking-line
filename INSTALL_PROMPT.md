# 📋 AI 自動安裝提示詞範本 (INSTALL_PROMPT.md)

> 💡 **使用說明**：  
> 如果您是完全零程式基礎的新手，請勿手動執行任何終端機指令！  
> 只要在 [新手圖文指南 (BEGINNER_GUIDE.md)](BEGINNER_GUIDE.md) 中取得您的 **5 個必要值**，複製下方文字方塊、填入資料後**整段貼給 AI Agent（Claude Code、Cursor、Antigravity 等）**，AI 就會全自動為您完成所有雲端部署！

---

### ✂️ 請複製以下提示詞並發送給 AI Agent：

```text
你好！請幫我安裝 open-booking-line（農業與在地資源預約管理系統）。

這是我的 5 個必要值：
LINE_CHANNEL_ACCESS_TOKEN=（填入 Messaging API 的 Channel Access Token）
LINE_CHANNEL_SECRET=（填入 Messaging API 的 Channel Secret 32 碼）
ADMIN_NOTIFY_USER_ID=（填入以 U 開頭的服務人員個人 LINE User ID）
LINE_LOGIN_CHANNEL_ID=（填入 LINE Login Channel ID 數字）
VITE_LIFF_ID=（填入 LIFF ID，格式如 2000000000-XXXXXXXX）

服務站名稱（選填，預設為「高雄示範站」）：
STATION_NAME=

請依照專案內的 AGENTS.md 與 DEPLOYMENT_GUIDE.md 規範，全自動完成：
1. Cloudflare D1 資料庫建立與 Schema 初始化（自動取得 database_id）。
2. 自動推導 ADMIN_LINE_IDS 與 LIFF_ID，並配置 packages/backend/wrangler.toml。
3. 透過安全管道（Zero-Disk）將 LINE 與 Turnstile 憑證寫入 Worker Secrets。
4. 自動產生 packages/frontend/.env 並編譯發布 Cloudflare Pages 與 Worker API。
5. 執行連線健康檢查（/api/health），並提供我部署完成的 Pages 網址。

除了 Cloudflare 瀏覽器授權（wrangler login）需要我本人點擊確認外，其餘所有建置與設定步驟請自行全自動完成。謝謝！
```

---

### 📢 AI 部署完成後，您只需進行最後 2 個手動確認：
1. **綁定網址**：回到 [LINE Developers Console](https://developers.line.biz/console/) ➔ 點入 LINE Login Channel ➔ LIFF 標籤 ➔ 將 **Endpoint URL** 改為 AI 回報給您的 Pages 網址（例如 `https://xxx.pages.dev`）。
2. **公開頻道**：在 LINE Login Channel 頂部，將狀態由 **`Developing`** 點擊切換為 **`Published`**（正式開放大眾預約）。
