# Ep02-3 — Preview + Approval Gate (預覽與授權門禁鎖)

## Goal (目標)
實作「精簡訪談 ➔ 規格產生 ➔ 圖像渲染 ➔ 視覺預覽 ➔ 人類明確審查 ➔ 雜湊鎖定」的防護門禁。在未取得使用者明確授權並產出防偽簽名檔之前，發布程序絕對無法啟動（Fail-Closed）。

---

## Must Read (必讀文件)
- [`AGENTS.md`](../../../AGENTS.md)
- [`.agent/AGENT-RULES.md`](../../AGENT-RULES.md)
- [`.agent/episodes/ep02-rich-menu/PLAN.md`](../PLAN.md)
- [`.agent/episodes/ep02-rich-menu/STATUS.md`](../STATUS.md)
- [`.agent/episodes/ep02-rich-menu/DECISIONS.md`](../DECISIONS.md)（特別是 ADR-EP02-004）

---

## Inputs (輸入資訊)
- Ep02-0 的 `.booking/rich-menu/targets.json`。
- Ep02-1 的 Spec Builder 模組。
- Ep02-2 的 Renderer 模組。
- 使用者互動輸入（自訂選單名稱、自訂顏色偏好，或直接使用推薦預設值）。

---

## Deliverables (交付產物)
1. 預覽與審批腳本：`scripts/rich-menu/preview.ts` 與 `scripts/rich-menu/approve.ts`（或合一之互動式 CLI）。
2. 本地預覽圖檔：`.booking/rich-menu/preview.png`。
3. 門禁授權標記檔：`.booking/rich-menu/approval.json`。
4. 測試套件：驗證未授權阻斷、Hash 竄改防禦與審核鎖定流程。

---

## Implementation Requirements (實作要求)
1. **精簡需求訪談**：
   - 讀取已探索之預約網址與店家名稱。
   - 只詢問必要項目（例如：確認主色系、確認按鈕文字），推薦預設方案。
2. **產出預覽並展示**：
   - 呼叫 Builder 產生 Spec，並呼叫 Renderer 渲染至 `.booking/rich-menu/preview.png`。
   - 向使用者展示預覽路徑，並提示核對按鈕位置與導引文字。
3. **人類明確確認與寫入門禁鎖**：
   - 使用者確認滿意後，執行確認指令（或於 CLI 輸入確認）。
   - 計算當前 Spec 之 SHA-256（`specHash`）與圖檔之 SHA-256（`imageHash`）。
   - 寫入 `.booking/rich-menu/approval.json`：
     ```json
     {
       "approved": true,
       "specHash": "sha256:abc123...",
       "imageHash": "sha256:def456...",
       "approvedAt": "2026-10-01T12:30:00.000Z",
       "menuName": "預設選單 - 高雄服務站"
     }
     ```
4. **防禦鐵律 (Enforcement Rule)**：
   - **若無 `approval.json` 或圖檔與 Spec 的 Hash 任一不匹配，Publisher 必須直接拒絕執行！**

---

## Out of Scope (本任務禁止事項)
- ❌ **嚴禁**向 LINE 官方發布選單。
- ❌ **嚴禁**在未獲使用者明確回覆前自動產生 `approval.json`。

---

## Tests (測試驗收項目)
1. **防偽校驗測試**：手動修改圖檔 1 個 byte 或修改 Spec 內容，驗證 Approval 校驗邏輯拋出「Hash mismatch 竄改」錯誤。
2. **未授權阻斷測試**：缺少 `approval.json` 時，Publisher 預檢程序拋出「未授權」拒絕信號。

---

## Completion Criteria (完工門檻)
- [ ] 預覽與確認管線程式碼實作完畢。
- [ ] 能在本地正確生成預覽圖檔並引導使用者確認。
- [ ] 門禁鎖 Hash 防偽校驗測試 100% PASS。

---

## Files Allowed to Change (允許變更的檔案)
- `scripts/rich-menu/preview.*`
- `scripts/rich-menu/approve.*`
- `tests/rich-menu/approval.*`
- `.booking/rich-menu/approval.json`
- `.booking/rich-menu/preview.*`

---

## Handoff (交接程序)
1. 確認測試全部 PASS。
2. 更新 [`.agent/episodes/ep02-rich-menu/STATUS.md`](../STATUS.md)：
   - `Ep02-3`: 改為 `Complete`
   - `Ep02-4`: 改為 `Ready`
   - 在 `Current Verified Outputs` 登記 Approval Gate 機制。
3. 停止執行，交由下一個 Agent 執行 Ep02-4。
