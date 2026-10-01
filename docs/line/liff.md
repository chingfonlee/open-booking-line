# LINE LIFF — 整合說明

> 本文件說明 open-booking-line 如何整合 LINE LIFF（LINE Front-end Framework）。

---

## 什麼是 LINE LIFF？

LINE LIFF 是 LINE 提供的前端框架，讓你的網頁可以：
- 在 LINE App 內以全螢幕顯示（不需要切換到瀏覽器）
- 自動取得使用者的 LINE 暱稱與頭像
- 取得 LINE ID Token（用於身分驗證）
- 在 LINE 聊天室底部作為底部選單開啟

---

## 設定步驟

### 1. 在 LINE Developers 建立 LIFF App

1. 進入 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇你的 LINE Login Channel
3. 點選 **LIFF** Tab
4. 新增 LIFF App：
   - **Size**：`Full`（全螢幕）
   - **Endpoint URL**：你的 Cloudflare Pages URL（如 `https://your-app.pages.dev`）
   - **Scopes**：勾選 `profile` 和 `openid`
   - **Bot prompt**：`Normal`（引導使用者加好友）

### 2. 設定 LIFF ID

取得 LIFF ID 後，設定環境變數：

```env
# packages/frontend/.env
VITE_LIFF_ID=your-liff-id

# packages/backend/wrangler.toml
[vars]
LIFF_ID = "your-liff-id"
```

### 3. 將 LINE Login Channel 切換為 Published

> ⚠️ **重要**：新建的 Channel 預設為 `Developing` 狀態，一般使用者無法開啟。

1. 進入 LINE Developers Console
2. 選擇你的 **LINE Login Channel**
3. 在頁面頂部點擊 `Developing` → 切換為 `Published`

---

## LIFF 在程式碼中的使用

### 初始化

```typescript
// ApplyForm.tsx
import liff from '@line/liff';

liff.init({ liffId: LIFF_ID })
  .then(() => {
    if (liff.isLoggedIn()) {
      liff.getProfile().then(profile => {
        // 使用 profile.displayName, profile.userId
      });
    }
  });
```

### 取得 ID Token（用於後端驗證）

```typescript
// 提交表單時
const idToken = liff.isLoggedIn() ? liff.getIDToken() : undefined;

// 傳給後端
const payload = {
  ...formData,
  id_token: idToken,  // 後端用此驗證 LINE User ID
};
```

### 關閉 LIFF 視窗

```typescript
if (liff.isInClient()) {
  liff.closeWindow();  // 關閉並返回 LINE
}
```

---

## LIFF URL 分享方式

```
# 標準 LIFF URL
https://liff.line.me/{YOUR_LIFF_ID}

# 直接連結到特定頁面
https://liff.line.me/{YOUR_LIFF_ID}/path?param=value
```

---

## 安全考量

1. **不要信任前端傳來的 `line_user_id`**
   - 必須使用 `id_token` 在後端驗證，才能確認真實 LINE User ID
   - 參見 `packages/backend/src/index.ts` 的 `verifyLineIdToken()` 實作

2. **LIFF ID 不是 Secret**
   - LIFF ID 可以公開，不需要保密
   - 真正需要保密的是 `LINE_CHANNEL_ACCESS_TOKEN` 和 `LINE_CHANNEL_SECRET`

---

## 🔵 Planned（計畫中）

- Rich Menu 與 LIFF 的連結方式 — 參閱 [rich-menu.md](rich-menu.md)（計畫中）
- LIFF 在桌機（非 LINE App）中的行為說明
