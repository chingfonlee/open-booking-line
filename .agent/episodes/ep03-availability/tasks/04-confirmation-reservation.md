# Ep03-4 — Confirmation & Reservation Lifecycle (確認排程與生命週期)

## Goal (目標)
建立正式排程確認流程，包含管理端電話確認排程 UI、原子改期、取消釋放、精確開工時間檢核、防孤兒預約與防止通用端點繞過機制。

---

## 核心規格要求
1. **管理端確認 UI**：
   - 顯示農友原始希望日期、希望時段（上午/下午/都可以）與日期彈性。
   - 管理員輸入：正式服務日期、正式 broad slot（上午或下午，若農友選「都可以」，管理員必須明確指定上午或下午）、預定開工時間（白名單：上午 08:00～11:30、下午 13:00～17:00，固定 30 分鐘間隔；12:00 與 12:30 午休嚴格禁止）。
2. **開工時間範圍校驗**：
   - 確切開工時間必須符合正式 broad slot 之時間範圍（上午限 08:00～11:30，下午限 13:00～17:00；12:00/12:30 不合法拒絕）。
3. **並行與防孤兒防護 (Concurrency & Orphan Protection)**：
   - 同一日期 + broad slot 碰撞：一筆成功，另一筆衝突拒絕（HTTP 409 Conflict）。
   - **重複確認與狀態防護**：若案件已確認或已關閉，再次請求確認必須失敗且**不得新增任何 reservation**，並完整保留該案件既有的合法 reservation。
4. **專用生命週期 API (No Generic Bypass)**：
   - 禁止透過通用 `PATCH /api/admin/requests/:id` 端點繞過排程直接修改狀態至 `confirmed`、`processing`、`closed` 或 `cancelled`。
   - 提供專用端點：
     - `POST /api/admin/requests/:id/confirm`（待聯絡轉已確認，或舊 processing 補建排程）
     - `POST /api/admin/requests/:id/start-work`（已確認轉施工處理中）
     - `POST /api/admin/requests/:id/complete`（施工處理中轉已結案）
     - `POST /api/admin/requests/:id/reschedule`（改期）
     - `POST /api/admin/requests/:id/cancel`（取消）
   - **改期原子性**：改期作業必須原子性執行（舊預約設為 released、建立新 active 預約、更新案件狀態；若目標時段已被占用，改期失敗且**舊預約維持 active 有效**）。
   - **舊版 processing 案件過渡處置**：查無 active reservation 的舊 processing 案件可透過 `/confirm` 補建排程，或直接 `/complete` 或 `/cancel`。
