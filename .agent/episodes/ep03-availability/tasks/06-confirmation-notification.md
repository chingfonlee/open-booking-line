# Ep03-6 — Confirmation Card & Display Consistency (確認通知與顯示一致性)

## Goal (目標)
正式預約確認後即時推播 LINE 卡片，並確保所有農友端與管理端之正式排程顯示來源皆以 `slot_reservations` 為唯一依歸。

---

## 核心規格要求
1. **即時確認卡片推播**：
   - Confirm 成功後立即推播包含服務項目、正式服務日期、時段、精確開工時間與服務地點之 LINE Flex 卡片。
   - 卡片中之時間資料**必須**來自 `slot_reservations`。
2. **通知失敗副作用防護**：
   - 若 LINE 推播失敗，**絕不可回滾已確認的 Reservation**。
   - 管理端清楚標示推播成功或失敗狀態，必要時可提供手動重推按鈕。
3. **顯示一致性修復**：
   - 修正農友查詢、LINE Flex 查詢、管理端列表與明細：
     - Pending 狀態：顯示希望日期 / 希望時段。
     - Confirmed 狀態：顯示正式服務日期 / 正式時段 / 預定開工時間。
