# Episode 02 — Agent Execution Workspace

> 本目錄為 **Episode 02 (LINE Rich Menu)** 的 AI Agent 協同執行工作區。  
> 若您是一般人類使用者或 YouTube 觀眾，請閱讀公開手冊：[`docs/episodes/ep02-rich-menu/README.md`](../../../docs/episodes/ep02-rich-menu/README.md)。

---

## 協同工作模式

本集採用 **Multi-Agent 循序遞進架構**：
* 任務被嚴格拆分為 6 個獨立 Task（`Ep02-0` 至 `Ep02-5`）。
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
| [`episode.json`](episode.json) | 機器可讀能力契約（前置依賴 `booking-core`，提供 `rich-menu`）。 |
| [`PLAN.md`](PLAN.md) | Ep02 總體架構、任務相依順序與邊界定義。 |
| [`STATUS.md`](STATUS.md) | 唯一進度狀態機（Pending / Ready / In Progress / Blocked / Complete）。 |
| [`DECISIONS.md`](DECISIONS.md) | 架構與技術選型決策紀錄（ADR）。 |
| [`TASK.md`](TASK.md) | 頂層進入點路由（Router）。 |
| `tasks/00-discovery.md` | Task 0: 探索與前置檢測（Discovery / Preflight） |
| `tasks/01-spec-builder.md` | Task 1: 規格定義與結構產生器（Spec + Builder） |
| `tasks/02-renderer.md` | Task 2: 確定性畫布渲染器（Deterministic Renderer） |
| `tasks/03-preview-approval.md` | Task 3: 預覽與授權鎖定門禁（Preview + Approval Gate） |
| `tasks/04-publisher.md` | Task 4: 安全發布器與還原機制（Safe Publisher + Rollback） |
| `tasks/05-acceptance.md` | Task 5: 實機驗收與版本凍結（Acceptance / Freeze） |
