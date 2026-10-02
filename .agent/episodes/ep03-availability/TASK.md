# Episode 03 Task Router: Availability & Confirmation Scheduling

> 本文件為 AI Agent 進入 Episode 03 執行任務之頂層路由器（Router）。  
> 本專案實施 Multi-Agent 垂直切片規範，具體任務合約與步驟已收斂至獨立 Task 文件中，**本文件不重複定義實作細節，避免規格漂移**。

---

## ⚡ Agent 執行規範 (Execution Protocol)

1. **依序讀取核心指引**：
   - 專案入口：[`AGENTS.md`](../../../AGENTS.md)
   - 核心守則：[`.agent/AGENT-RULES.md`](../../AGENT-RULES.md)
   - 架構計畫：[`PLAN.md`](PLAN.md)
   - 即時狀態：[`STATUS.md`](STATUS.md)
   - 重大決策：[`DECISIONS.md`](DECISIONS.md)

2. **鎖定唯一可執行任務**：
   - 檢視 [`STATUS.md`](STATUS.md) 中狀態為 **`Ready`** 的 Task ID。
   - 讀取對應的 Task 合約文件（位於 `tasks/` 目錄）。
   - **嚴禁**自行跳步或提前執行標記為 `Pending` 的後續任務！

3. **實作、測試與交接**：
   - 依據該 Task 檔案中的要求進行實作與測試。
   - 所有驗證條件 PASS 後，更新 `STATUS.md`（將該 Task 標記為 `Complete`，並將下一個 Task 改為 `Ready`）。
   - 若產生重大架構選型，記錄於 `DECISIONS.md`。

---

## 📋 Task 契約導覽 (Task Contracts)

| Task ID | 職責 | 合約文件 |
| :--- | :--- | :--- |
| **Ep03-0** | Current State & Data Audit（現狀盤點與遠端資料審計） | [`tasks/00-current-state-audit.md`](tasks/00-current-state-audit.md) |
| **Ep03-1** | Domain Model, Migration & Recovery（領域模型與遷移程序） | [`tasks/01-domain-migration.md`](tasks/01-domain-migration.md) |
| **Ep03-2** | Availability Engine & Read API（可用性計算引擎與查詢 API） | [`tasks/02-availability-engine.md`](tasks/02-availability-engine.md) |
| **Ep03-3** | Farmer Booking Flow（農友端寬鬆時段申請流程與防護） | [`tasks/03-farmer-booking-flow.md`](tasks/03-farmer-booking-flow.md) |
| **Ep03-4** | Confirmation & Reservation Lifecycle（管理員確認排程與生命週期） | [`tasks/04-confirmation-reservation.md`](tasks/04-confirmation-reservation.md) |
| **Ep03-5** | Merchant Availability Settings（合作社時段規則與封鎖設定） | [`tasks/05-merchant-settings.md`](tasks/05-merchant-settings.md) |
| **Ep03-6** | Confirmation Card & Display Consistency（確認推播與介面一致性） | [`tasks/06-confirmation-notification.md`](tasks/06-confirmation-notification.md) |
| **Ep03-7** | End-to-End Acceptance & Freeze（端對端全流程驗收與版本凍結） | [`tasks/07-acceptance-freeze.md`](tasks/07-acceptance-freeze.md) |
