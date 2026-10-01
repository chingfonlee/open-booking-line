# LINE Messaging API — 說明

> 本文件說明 open-booking-line 如何使用 LINE Messaging API。

---

## 使用場景

open-booking-line 使用 LINE Messaging API 進行：

| 功能 | API 類型 | 費用 |
| :--- | :--- | :--- |
| 管理員接收新預約通知 | Push Message | 計入每月免費額度 |
| 使用者收到預約確認 | Push Message | 計入每月免費額度 |
| 使用者查詢進度時回覆 | Reply Message | ✅ 完全免費 |
| 歡迎訊息、功能導覽 | Reply Message | ✅ 完全免費 |

> 💡 **費用最小化策略**：盡量使用 Reply API（免費），只在使用者查詢時被動回覆。
> 主動推播（Push API）只在新預約時使用，減少額度消耗。

---

## Flex Message 卡片類型

系統目前包含以下 Flex Message 卡片：

| 卡片 | 觸發時機 | 接收者 |
| :--- | :--- | :--- |
| 新申請通知 | 使用者送出預約 | 管理員 |
| 預約確認收據 | 使用者送出預約 | 使用者 |
| 進度查詢結果 | 使用者在 LINE 查詢 | 使用者 |
| 預約引導卡片 | 使用者傳送「預約」 | 使用者 |
| 功能導覽卡片 | 任何未識別訊息 | 使用者 |
| 管理後台入口 | 管理員傳送「管理」 | 管理員（限白名單） |

---

## Webhook 設定

要讓 LINE 聊天室的訊息觸發功能，需要設定 Webhook：

1. **LINE OA 後台**（[manager.line.biz](https://manager.line.biz/)）：
   - 設定 → 回應設定 → **Webhook 開啟**

2. **LINE Developers Console**：
   - Messaging API Channel → Webhook settings
   - 填入：`https://your-worker.workers.dev/api/line/webhook`
   - 點擊 Verify 驗證
   - **Use webhook 開啟**

---

## 安全機制：HMAC-SHA256 簽名驗證

所有 Webhook 請求都必須通過 LINE 的簽名驗證：

```typescript
// packages/backend/src/line.ts
export async function verifyLineSignature(
  rawBody: string,
  signature: string,
  channelSecret: string
): Promise<boolean>
```

- 未設定 `LINE_CHANNEL_SECRET` → 拒絕所有 Webhook（HTTP 503）
- 缺少 `x-line-signature` → 拒絕（HTTP 401）
- 簽名不符 → 拒絕（HTTP 401）

---

## 免費額度說明

LINE Messaging API 每月免費額度（以官方最新文件為準）：

- **Reply API**：無限（被動回覆，完全免費）
- **Push API**：每月 200 則免費（超過需付費）

> 建議在 [LINE Developers Console](https://developers.line.biz/console/) 查看最新的免費額度說明。

---

## 🔵 Planned（計畫中）

- Flex Message 進階設計教學 — Episode 07
- 如何自訂通知卡片內容
- 多管理員通知設定
