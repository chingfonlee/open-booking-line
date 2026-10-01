# Installation — 安裝與設定指南

> 本文件說明如何從 GitHub 取得程式碼、設定環境變數並部署系統。
> 新手建議直接使用 [BEGINNER_GUIDE.md](../BEGINNER_GUIDE.md) 的零門檻安裝流程。

---

## 📋 前置要求

| 需求 | 說明 |
| :--- | :--- |
| Node.js 22 LTS | 執行 Wrangler CLI |
| Cloudflare 帳號 | 免費，託管 Workers + D1 + Pages |
| LINE 官方帳號 (OA) | 發送推播通知 |
| LINE Developers 帳號 | 取得 Channel ID、LIFF ID 等設定值 |

---

## 🔑 需要準備的設定值

在開始安裝前，準備以下五個必要值（詳細取得方式參閱 [BEGINNER_GUIDE.md](../BEGINNER_GUIDE.md)）：

| 設定值 | 說明 | 在哪裡取得 |
| :--- | :--- | :--- |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API Channel Access Token | LINE Developers Console |
| `LINE_CHANNEL_SECRET` | LINE Messaging API Channel Secret | LINE Developers Console |
| `LINE_LOGIN_CHANNEL_ID` | LIFF 所屬的 LINE Login Channel ID | LINE Developers Console |
| `LIFF_ID` | LIFF 應用的 ID | LINE Developers Console > LIFF Tab |
| `ADMIN_NOTIFY_USER_ID` | 接收推播的管理員 LINE User ID | LINE Developers Console |

---

## 🚀 安裝步驟

### 1. 取得程式碼

```bash
git clone https://github.com/chingfonlee/open-booking-line.git
cd open-booking-line
npm install
```

### 2. 設定後端

複製設定範本：
```bash
cp packages/backend/wrangler.toml.example packages/backend/wrangler.toml
```

在 `wrangler.toml` 中設定：
```toml
[vars]
STATION_NAME = "你的服務站名稱"
LIFF_ID = "your-liff-id"
LINE_LOGIN_CHANNEL_ID = "your-line-login-channel-id"
ADMIN_NOTIFY_USER_ID = "your-admin-line-user-id"
ADMIN_LINE_IDS = "admin-uid-1,admin-uid-2"
ALLOWED_ORIGINS = "https://your-app.pages.dev"
```

### 3. 設定 Secrets（安全金鑰）

```bash
cd packages/backend

# LINE Messaging API Channel Access Token
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN

# LINE Messaging API Channel Secret
npx wrangler secret put LINE_CHANNEL_SECRET

# Cloudflare Turnstile Secret（正式環境）
# 新手可以先跳過，測試金鑰預設已設定
npx wrangler secret put TURNSTILE_SECRET_KEY
```

### 4. 建立資料庫

```bash
# 建立 D1 資料庫
npx wrangler d1 create your-db-name

# 將輸出的 database_id 填入 wrangler.toml 的 [[d1_databases]] 區塊

# 建立資料表
npx wrangler d1 execute your-db-name --file=packages/backend/schema.sql
```

### 5. 設定前端環境變數

```bash
# 複製前端設定範本（如有 .env.example）
cp packages/frontend/.env.example packages/frontend/.env
```

編輯 `packages/frontend/.env`：
```env
VITE_LIFF_ID=your-liff-id
VITE_STATION_NAME=你的服務站名稱
VITE_API_BASE_URL=   # 通常留空（由 Pages Functions 代理）
VITE_TURNSTILE_SITE_KEY=your-turnstile-site-key  # 可選
```

### 6. 部署

```bash
# 部署後端 API
cd packages/backend
npx wrangler deploy

# 部署前端
cd ../frontend
npm run build
npx wrangler pages deploy dist --project-name your-project-name
```

---

## ✅ 驗收測試

部署完成後，確認以下功能正常：

- [ ] 開啟 LIFF URL（`https://liff.line.me/your-liff-id`）可以看到預約表單
- [ ] 填寫並送出預約，管理員收到 LINE 推播通知
- [ ] 管理員可以登入管理後台（`https://your-app.pages.dev?admin=1`）
- [ ] Health check 正常：`GET https://your-worker.workers.dev/api/health`

---

## 🔒 正式上線安全加固

部署測試完成後，務必完成以下加固步驟：

1. 設定真實的 Cloudflare Turnstile（執行 `npm run setup:turnstile`）
2. 確認 `LINE_CHANNEL_SECRET` 已設定（啟用 Webhook 驗簽）
3. 確認 `ALLOWED_ORIGINS` 只包含你的網域
4. 將 LINE Login Channel 從 `Developing` 切換為 `Published`

詳細說明請參閱 [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)。

---

## 🆘 常見問題

### CORS 錯誤
確認 `ALLOWED_ORIGINS` 包含你的前端網域（或使用 `*.pages.dev`）。

### LIFF 無法初始化
確認 `VITE_LIFF_ID` 正確，且 LINE Login Channel 狀態為 `Published`。

### 管理後台無法登入
確認你的 LINE User ID 在 `ADMIN_LINE_IDS` 或 `ADMIN_NOTIFY_USER_ID` 中。
