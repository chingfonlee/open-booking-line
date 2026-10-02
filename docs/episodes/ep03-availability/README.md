# Episode 03 — Availability & Confirmation Scheduling (時段可用性與確認排程)

> 本集聚焦於為已具備預約核心 (`booking-core`) 與圖文選單 (`rich-menu`) 的專案擴充 **時段可用性引擎與確認排程能力 (`booking-availability`)**。

---

## What This Adds (本集新增能力)

* **`booking-availability` 能力**：
  * **Request ≠ Reservation 領域分離**：農友端僅能提出寬鬆偏好時段（上午 / 下午 / 都可以），未經站所確認前絕不占用時段（Pending 不占時段）。
  * **Availability 計算引擎**：以公式 `Weekly Rules - Exceptions - Active Reservations - Past Dates = Selectable Broad Slots` 精確計算可選時段，支援 Legacy 與 Managed 漸進模式切換。
  * **合作社管理員確認排程**：管理員致電溝通後，指定正式日期與開工時間白名單（上午 08:00～11:30、下午 13:00～17:00，排除 12:00/12:30 午休），原子建立 `slot_reservations`。
  * **生命週期與並行防護**：原子改期（Reschedule 碰撞安全回滾保全原案）、取消釋放（Cancel）、通用更新防繞過（Generic PATCH Bypass Guard）與防孤兒預約機制。
  * **合作社時段規則與公休設定 UI**：每週 14 個區間營業開放矩陣（Fail-Closed 防呆阻斷）、特定公休例外維護與衝突警示保全（Case L 不破壞既有預約）。
  * **即時排程確認推播與跨端顯示一致**：正式確認與改期專屬 LINE Flex 卡片即時推播，官方帳號查詢進度 Webhook 與後台儀表板統一以 Reservation 為權威來源。

---

## Prerequisites (前置條件)

在開始安裝此能力前，專案必須滿足：
1. **前置能力依賴**：本地 `.booking/project-state.json` 中的 `booking-core` 與 `rich-menu` 必須已為 `verified` 狀態。
2. **LINE OA 權限**：具備 LINE Messaging API Channel Access Token。
3. **Cloudflare D1 權限**：具備執行資料庫遷移之權限。

---

## Get / Update This Episode (如何安全取得本集更新)

### 步驟 1：檢視工作目錄狀態
```bash
git status
```

### 步驟 2：執行自動化遷移與驗證
1. 執行 D1 Schema 遷移：
   ```bash
   npx wrangler d1 migrations apply xingnong-db --local
   ```
2. 執行全套自動化測試驗證：
   ```bash
   npm test
   ```

---

## Start (如何開始執行)

取得更新後，直接對您的 AI Coding Agent 發出指令：

> 「請檢查我目前的專案狀態，並在目前專案安裝 Episode 03 booking-availability 能力。」

Agent 會自動：
1. 檢核前置 `booking-core` 與 `rich-menu` 是否已就緒。
2. 遵循 `.agent/episodes/ep03-availability/` 之任務 SOP 依序完成所有驗證門檻。
3. 確保全庫 21 項驗收案例（Case A~U）與人類實機 10 項指標 100% 通過。
