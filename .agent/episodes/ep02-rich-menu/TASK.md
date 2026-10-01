# Episode 02 Task Router: LINE Rich Menu

> 本文件為 AI Agent 進入 Episode 02 執行任務之頂層路由器（Router）。  
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
| **Ep02-0** | Discovery / Preflight（探索本機與遠端目標） | [`tasks/00-discovery.md`](tasks/00-discovery.md) |
| **Ep02-1** | Spec + Builder（幾何計算與 LINE 物件產生器） | [`tasks/01-spec-builder.md`](tasks/01-spec-builder.md) |
| **Ep02-2** | Deterministic Renderer（確定性本地圖像渲染器） | [`tasks/02-renderer.md`](tasks/02-renderer.md) |
| **Ep02-3** | Preview + Approval（預覽與人類授權門禁鎖） | [`tasks/03-preview-approval.md`](tasks/03-preview-approval.md) |
| **Ep02-4** | Safe Publisher（具 Rollback 之發布工具） | [`tasks/04-publisher.md`](tasks/04-publisher.md) |
| **Ep02-5** | Acceptance / Freeze（端對端驗收與版本凍結） | [`tasks/05-acceptance.md`](tasks/05-acceptance.md) |
