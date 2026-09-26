# 📋 AI 自動安裝提示詞範本 (INSTALL_PROMPT.md)

> 💡 **使用說明**：  
> 如果您是完全零程式基礎的新手，請勿手動執行任何複雜指令！  
> 只要在 [新手圖文指南 (BEGINNER_GUIDE.md)](BEGINNER_GUIDE.md) 中準備好 **5 個必要值**：  
> **3 個一般設定**直接複製貼給 AI，**2 個敏感金鑰**自己留在本機，待部署時由終端機提示直接輸入 Cloudflare Secret。  
> 🔒 **真正的 Agent-Safe 資安體驗：連 AI 都不需要知道您的密碼！**

---

### ✂️ 請複製以下提示詞並發送給 AI Agent：

```text
你好！請幫我安裝 open-booking-line（農業與在地資源預約管理系統）。

以下是我的一般設定：
ADMIN_NOTIFY_USER_ID=（填入以 U 開頭的服務人員個人 LINE User ID）
LINE_LOGIN_CHANNEL_ID=（填入 LINE Login Channel ID 數字）
VITE_LIFF_ID=（填入 LIFF ID，格式如 2000000000-XXXXXXXX）

服務站名稱（選填，預設為「高雄示範站」）：
STATION_NAME=

我已經在本地另外準備好：
- LINE_CHANNEL_ACCESS_TOKEN
- LINE_CHANNEL_SECRET

🔒 基於 Zero-Disk 與 Zero-Leak 安全規範，我不會把這兩個 Secret 貼進 AI 對話。
當部署進行到設定 Secret 的步驟時，請於終端機啟動：
cd packages/backend && npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
cd packages/backend && npx wrangler secret put LINE_CHANNEL_SECRET
並提示我直接在終端機貼入 Secret，請勿要求我把 Secret 傳給 AI，也絕不寫入 .env、設定檔、Git 或日誌。

請依照專案內的 AGENTS.md 與 DEPLOYMENT_GUIDE.md 規範，全自動完成：
1. Cloudflare D1 資料庫建立與 Schema 初始化（自動取得 database_id）。
2. 自動推導 ADMIN_LINE_IDS 與 LIFF_ID，並配置 packages/backend/wrangler.toml。
3. 自動產生 packages/frontend/.env 並編譯發布 Cloudflare Pages 與 Worker API。
4. 執行連線健康檢查（/api/health），並提供我部署完成的 Pages 網址。

除了 Cloudflare 瀏覽器授權（wrangler login）與終端機貼入 Secret 需我本人確認外，其餘所有建置與設定步驟請自行全自動完成。謝謝！
```

---

### 📢 AI 部署完成後，您只需進行最後 2 個手動確認（1 分鐘）：
1. **綁定網址**：回到 [LINE Developers Console](https://developers.line.biz/console/) ➔ 點入 LINE Login Channel ➔ LIFF 標籤 ➔ 將 **Endpoint URL** 改為 AI 回報給您的 Pages 網址（例如 `https://xxx.pages.dev`）。
2. **公開頻道**：在 LINE Login Channel 頂部，將狀態由 **`Developing`** 點擊切換為 **`Published`**（正式開放大眾預約）。
