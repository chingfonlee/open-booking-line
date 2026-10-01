# Episode 02 Implementation Status

> 本文件為 Multi-Agent 協同作業之唯一即時狀態機。  
> 狀態定義：`Pending`（等待前置完成）、`Ready`（可立即接手執行）、`In Progress`（正在執行）、`Blocked`（遭遇阻礙）、`Complete`（驗收通過已結案）。  
> 任何 Agent 於完成所屬 Task 後，必須更新本文件。

---

## Current Status (當前狀態)

* **Current Task**: `None (Episode Complete)`
* **Episode Status**: `Complete`
* **Next Task**: `None (Ready for Ep03)`

---

## Tasks Progress (任務進度表)

| Task ID | 名稱 | 狀態 | 負責 Agent / 交付紀錄 |
| :--- | :--- | :--- | :--- |
| **Ep02-0** | Discovery / Preflight | **Complete** | 通過目標解析與前置檢測，產出 targets.json，測試 100% PASS |
| **Ep02-1** | Spec + Builder | **Complete** | 實作 menu-spec Schema、幾何計算與 LINE API 轉換器，測試 100% PASS |
| **Ep02-2** | Deterministic Renderer | **Complete** | 本地確定性 SVG + Sharp 渲染引擎（2500×1686, 157KB $\le$ 1MB），測試 100% PASS |
| **Ep02-3** | Preview + Approval | **Complete** | 預覽產生、人類明確授權，防偽 SHA-256 門禁鎖鎖定，測試 100% PASS |
| **Ep02-4** | Safe Publisher | **Complete** | 實作 Dry-run 模擬預檢、原子發布管線與三情境 Rollback 還原器，測試 100% PASS |
| **Ep02-5** | Acceptance / Freeze | **Complete** | 人類實機 3 項查核全數 PASS、版本狀態登錄、手冊更新與 Tag 封裝完成 |

---

## Current Verified Outputs (已驗證產物登錄)

### Ep02-0:
* **產物路徑**：`.booking/rich-menu/targets.json`（受 `.gitignore` 保護）
* **解析成果**：
  * **店家名稱**：`高雄服務站`（來源：`packages/frontend/.env` line 4）
  * **預約網址**：`https://liff.line.me/2011709076-09FdfkjH`（來源：`packages/frontend/.env` line 2）
  * **進度查詢詞**：`查詢預約`（來源：`packages/backend/src/index.ts` lines 603-611）
  * **遠端預檢**：記錄為 `requires-operation-token`（未洩漏任何金鑰）
* **測試套件**：`tests/rich-menu/discovery.test.mjs`（5 項測試 100% PASS）

### Ep02-1:
* **產物路徑**：
  * `scripts/rich-menu/menu-spec.schema.json`（規格 Schema 定義）
  * `scripts/rich-menu/builder.mjs`（幾何產生器與 LINE 轉換器）
* **驗證成果**：
  * **確定性幾何**：固定 2500×1686 雙分區佈局（左 1250×1686 預約，右 1250×1686 查詢），無重疊、無越界。
  * **嚴格欄位防禦**：`chatBarText` 嚴格限制 $\le 14$ 字，`name` 限制 $\le 300$ 字。
  * **LINE 物件轉換**：符合 LINE 官方 `POST /v2/bot/richmenu` 規格要求。
* **測試套件**：`tests/rich-menu/builder.test.mjs`（6 項測試 100% PASS）

### Ep02-2:
* **產物路徑**：
  * `scripts/rich-menu/renderer.mjs`（確定性本地 SVG + Sharp 渲染引擎）
  * `.booking/rich-menu/preview.png`（實體輸出圖檔，受 `.gitignore` 保護）
* **驗證成果**：
  * **確定性像素與畫布**：解析度精確為 $2500 \times 1686$。
  * **極致輕量壓縮**：檔案大小僅 **157.4 KB**（161,172 bytes），遠低於 LINE 1 MB 限制（上限 1,048,576 bytes）。
  * **字型與視覺設計**：支援繁體中文（Noto Sans TC / 微軟正黑體）、清晰向量日曆與放大鏡圖標、行動端大字按鈕。
  * **二進位雜湊確定性**：相同輸入重複渲染之 SHA-256 二進位完全一致。
* **架構決策**：`DECISIONS.md` 之 `ADR-EP02-006`。
* **測試套件**：`tests/rich-menu/renderer.test.mjs`（4 項測試 100% PASS）

### Ep02-3:
* **產物路徑**：
  * `scripts/rich-menu/approval.mjs`（預覽生成、授權校驗與門禁鎖模組）
  * `.booking/rich-menu/approval.json`（門禁授權標記檔，受 `.gitignore` 保護）
* **驗證成果**：
  * **人類授權確認**：使用者已明確檢視預覽並回覆確認核准。
  * **防偽雜湊鎖定**：
    * `specHash`: `sha256:411530f96d355196ff3d66bbed2170a3fe1cf180f9a93955367cc203145245b1`
    * `imageHash`: `sha256:b0f4751e903792e129e3ddc3091ba20115ae97e24d9d0705a7dafd88cdb1725a`
  * **Fail-Closed 門禁阻斷防護**：缺少授權檔或任一 Hash 遭改動 1 個 byte 立即阻斷發布。
* **測試套件**：`tests/rich-menu/approval.test.mjs`（5 項測試 100% PASS）

### Ep02-4:
* **產物路徑**：
  * `scripts/rich-menu/publisher.mjs`（安全發布器，支援 `--dry-run` 乾跑預檢）
  * `scripts/rich-menu/rollback.mjs`（三情境 Rollback 還原腳本）
* **驗證成果**：
  * **Dry-run 預檢隔離**：乾跑模式完整驗算 Hash、呼叫 LINE 規格驗簽並查詢原選單，確保零外部資源建立與零修改。
  * **原子發布管線**：建立選單 ➔ 上傳圖檔 ➔ 設為預設 ➔ 遠端驗收 ID ➔ 寫入 `.booking/rich-menu/managed.json`。
  * **三情境 Rollback**：
    * 情境 A：原先為 API 預設選單 ➔ 回滾綁定原先舊選單 ID。
    * 情境 B / C：原先為 OA Manager 手動選單或無選單 ➔ 解除 API 預設綁定並刪除新建孤兒選單。
* **測試套件**：
  * `tests/rich-menu/publisher.test.mjs`（3 項測試 100% PASS）
  * `tests/rich-menu/rollback.test.mjs`（2 項測試 100% PASS）

---

## Known Issues (已知問題與障礙)

* 無。

---

## Handoff Rule (交接規則)

1. 當前執行的 Agent **嚴禁跳級執行未標記為 `Ready` 的任務**。
2. 當前任務若遭遇外部錯誤或阻礙，將狀態改為 `Blocked` 並於「Known Issues」詳細記錄。
3. 唯有在當前任務所定義之測試全部 PASS 後，方可將當前任務標記為 `Complete`，並將下一個任務由 `Pending` 改為 `Ready`。
