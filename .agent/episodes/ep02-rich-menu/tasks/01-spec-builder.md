# Ep02-1 — Spec + Builder (規格與結構產生器)

## Goal (目標)
實作 Rich Menu 規格定義（`menu-spec` Schema）、幾何區域計算器（Geometry Builder）與 LINE Rich Menu 物件轉換器（LINE Object Builder）。確保輸入任意合規之業務配置時，均能產出完全符合 LINE 官方 API 要求之確定性物件結構。

---

## Must Read (必讀文件)
- [`AGENTS.md`](../../../../AGENTS.md)
- [`.agent/AGENT-RULES.md`](../../../AGENT-RULES.md)
- [`.agent/episodes/ep02-rich-menu/PLAN.md`](../PLAN.md)
- [`.agent/episodes/ep02-rich-menu/STATUS.md`](../STATUS.md)
- [`.agent/episodes/ep02-rich-menu/DECISIONS.md`](../DECISIONS.md)

---

## Inputs (輸入資訊)
- Ep02-0 產出之目標檔案：`.booking/rich-menu/targets.json`。
- 圖文選單自訂參數（例如自訂按鈕文字、底欄文字 `chatBarText`、色彩主題）。

---

## Deliverables (交付產物)
1. 規格定義與產生器程式碼：例如 `scripts/rich-menu/builder.ts`（或 `builder.js`）。
2. JSON Schema 檔案：`scripts/rich-menu/menu-spec.schema.json`。
3. 單元測試：全面檢驗幾何邊界與 LINE 官方欄位限制。

---

## Implementation Requirements (實作要求)
1. **標準畫布幾何規格 (ADR-EP02-001)**：
   - 寬高固定為 `2500 × 1686`。
   - 預設雙分區佈局（左右各半）：
     - 左側（預約區）：`bounds = { x: 0, y: 0, width: 1250, height: 1686 }`，Action 類型為 `uri`，URI 指向 `bookingUri`。
     - 右側（查詢區）：`bounds = { x: 1250, y: 0, width: 1250, height: 1686 }`，Action 類型為 `message`，文字內容為 `queryKeyword`。
2. **LINE 物件轉換**：
   - 輸出符合 `POST /v2/bot/richmenu` 要求的 JSON 結構：
     ```json
     {
       "size": { "width": 2500, "height": 1686 },
       "selected": true,
       "name": "預設選單 - <stationName>",
       "chatBarText": "快速選單",
       "areas": [...]
     }
     ```
   - 驗證 `name` 不超過 300 字元。
   - 驗證 `chatBarText` 不超過 14 字元。
   - 驗證 `areas` 數量介於 1 至 20 之間，且每一區域皆在畫布內（`x + width <= 2500` 且 `y + height <= 1686`）。

---

## Out of Scope (本任務禁止事項)
- ❌ **嚴禁**進行實體圖像渲染（PNG/JPEG 產出）。
- ❌ **嚴禁**呼叫 LINE API 上傳或發布選單。

---

## Tests (測試驗收項目)
1. **邊界檢測測試**：幾何區域不可越界（$X \ge 0, Y \ge 0, X+W \le 2500, Y+H \le 1686$）。
2. **不重疊檢測測試**：各動作區域座標無非預期重疊。
3. **字數防禦測試**：`chatBarText` 超過 14 字元時必須拋出明確錯誤並阻止產生。
4. **確定性測試**：相同輸入多次執行產出之 JSON 完全一致（Deterministic）。

---

## Completion Criteria (完工門檻)
- [ ] Spec Builder 邏輯實作完畢且 Schema 建立完成。
- [ ] 幾何與欄位限制單元測試 100% PASS。
- [ ] 產出之物件能通過 LINE 官方 Rich Menu 規格校驗。

---

## Files Allowed to Change (允許變更的檔案)
- `scripts/rich-menu/builder.*`
- `scripts/rich-menu/menu-spec.schema.json`
- `tests/rich-menu/builder.*`

---

## Handoff (交接程序)
1. 確認測試全部 PASS。
2. 更新 [`.agent/episodes/ep02-rich-menu/STATUS.md`](../STATUS.md)：
   - `Ep02-1`: 改為 `Complete`
   - `Ep02-2`: 改為 `Ready`
   - 在 `Current Verified Outputs` 登記 Spec Builder 驗證成果。
3. 停止執行，交由下一個 Agent 執行 Ep02-2。
