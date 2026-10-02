# Episode 03 — Agent Execution Workspace

> 本目錄為 **Episode 03 (Availability & Confirmation Scheduling)** 的 AI Agent 協同執行工作區。  
> 若您是一般人類使用者或 YouTube 觀眾，請閱讀公開手冊：[`docs/episodes/ep03-availability/README.md`](../../../docs/episodes/ep03-availability/README.md)（將於結案時同步發布）。

---

## 協同工作模式

本集採用 **Multi-Agent 循序遞進架構**：
* 任務被嚴格拆分為 8 個獨立 Task（`Ep03-0` 至 `Ep03-7`）。
* 每個 Agent 接手時**不依賴歷史聊天記錄**，完全依靠 Repository 內的控制文件進行上下文還原。
* 執行前必須依序閱讀：
  1. [`AGENTS.md`](../../../AGENTS.md)
  2. [`.agent/AGENT-RULES.md`](../../AGENT-RULES.md)
  3. [`PLAN.md`](PLAN.md)
  4. [`STATUS.md`](STATUS.md)
  5. 讀取 `STATUS.md` 中唯一標記為 **`Ready`** 的 Task 契約文件。

---

## 控制文件清單

| 檔案 | 職責 |
| :--- | :--- |
| [`episode.json`](episode.json) | 機器可讀能力契約（前置依賴 `booking-core`, `rich-menu`，提供 `booking-availability`）。 |
| [`PLAN.md`](PLAN.md) | Ep03 總體架構、任務相依順序與邊界定義。 |
| [`STATUS.md`](STATUS.md) | 唯一進度狀態機（Pending / Ready / In Progress / Blocked / Complete）。 |
| [`DECISIONS.md`](DECISIONS.md) | 領域模型與技術選型決策紀錄（ADR）。 |
| [`TASK.md`](TASK.md) | 頂層進入點路由（Router）。 |
| `tasks/00-current-state-audit.md` | Task 0: 現狀盤點與遠端資料審計（Current State & Data Audit） |
| `tasks/01-domain-migration.md` | Task 1: 領域模型、資料庫遷移與恢復程序（Domain Model, Migration & Recovery） |
| `tasks/02-availability-engine.md` | Task 2: 可用性計算引擎與查詢 API（Availability Engine & Read API） |
| `tasks/03-farmer-booking-flow.md` | Task 3: 農友端寬鬆時段申請流程與防護（Farmer Booking Flow） |
| `tasks/04-confirmation-reservation.md` | Task 4: 管理員確認排程與生命週期（Confirmation & Reservation Lifecycle） |
| `tasks/05-merchant-settings.md` | Task 5: 合作社時段規則與封鎖設定（Merchant Availability Settings） |
| `tasks/06-confirmation-notification.md` | Task 6: 確認推播與介面一致性（Confirmation Card & Display Consistency） |
| `tasks/07-acceptance-freeze.md` | Task 7: 端對端全流程驗收與版本凍結（Acceptance / Freeze） |
