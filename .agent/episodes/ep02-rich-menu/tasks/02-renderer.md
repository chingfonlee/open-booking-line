# Ep02-2 — Deterministic Renderer (確定性圖像渲染器)

## Goal (目標)
實作將 `menu-spec` 規格確定性轉換為高畫質圖文選單圖片的渲染引擎。產物必須符合 LINE 官方嚴格限制：尺寸精確為 `2500 × 1686`、檔案大小 $\le 1\text{ MB}$、支援中文字體清晰渲染，且**完全不依賴外部 AI 或雲端生圖 API**。

---

## Must Read (必讀文件)
- [`AGENTS.md`](../../../../AGENTS.md)
- [`.agent/AGENT-RULES.md`](../../../AGENT-RULES.md)
- [`.agent/episodes/ep02-rich-menu/PLAN.md`](../PLAN.md)
- [`.agent/episodes/ep02-rich-menu/STATUS.md`](../STATUS.md)
- [`.agent/episodes/ep02-rich-menu/DECISIONS.md`](../DECISIONS.md)

---

## Inputs (輸入資訊)
- Ep02-1 產出之 `menu-spec` JSON。
- 內建向量圖示（SVG）與配色主題設定。

---

## Deliverables (交付產物)
1. 渲染模組：`scripts/rich-menu/renderer.ts`（或 `renderer.js`）。
2. 圖檔輸出：支援輸出至 `.booking/rich-menu/preview.png`（或 `preview.jpg`）。
3. 測試套件：檢驗尺寸、檔案大小、確定性雜湊與繁體中文渲染。

---

## Technical Decisions Required (實作者必先確認之技術決策)
本任務 Agent 在實作前，必須明確確認：
1. **渲染引擎選型**：採用本地輕量 Canvas（例如 `@napi-rs/canvas`、`sharp`、或純 Node.js 原生 SVG 拼接轉碼），不得引入笨重外部服務。
2. **字型處理策略**：採用系統內建跨平臺無襯線字型（如 `Noto Sans TC`, `Microsoft JhengHei`, `PingFang TC`, `sans-serif`），確保繁體中文無缺字或方塊字（Tofu）。
3. **壓縮優化策略**：產出的 PNG 或 JPEG 必須嚴格控制在 1 MB 以內（LINE 上傳上限為 1 MB）。
*(確認後若有重大調整，同步寫入 `DECISIONS.md`)*

---

## Implementation Requirements (實作要求)
1. **渲染流程**：
   `menu-spec ➔ 幾何佈局計算 ➔ 向量 SVG 建構 ➔ 點陣化圖檔 (PNG/JPEG)`。
2. **視覺元素標準**：
   - 左側區塊：預約圖標、主標題（「線上預約」）、副標題（「立即預約服務」）。
   - 右側區塊：查詢圖標、主標題（「查詢進度」）、副標題（「查看預約狀態」）。
   - 頂部或底部分隔：清晰的視覺分隔線或區塊對比，讓顧客一眼辨識點擊區域。
3. **嚴格合規檢查**：
   - 尺寸必須**精確為 2500 × 1686**。
   - 檔案大小必須小於 1,048,576 bytes（1 MB）。

---

## Out of Scope (本任務禁止事項)
- ❌ **嚴禁**呼叫外部 AI 圖像生成服務（DALL-E 等）。
- ❌ **嚴禁**向 LINE API 上傳圖檔。
- ❌ **嚴禁**向使用者索取審核確認（屬於 Task 3）。

---

## Tests (測試驗收項目)
1. **尺寸檢驗**：輸出圖檔之像素解析度精確等於 $2500 \times 1686$。
2. **檔案大小檢驗**：輸出圖檔大小 $\le 1048576$ bytes。
3. **確定性檢驗**：輸入相同 Spec 與主題，連續兩次產出圖檔之 SHA-256 雜湊完全相同。
4. **字型檢驗**：產出之 SVG 或圖檔包含正確之中文文字標籤。

---

## Completion Criteria (完工門檻)
- [ ] 渲染器程式碼完成且能獨立運作。
- [ ] 單元與圖像合規測試全部 PASS。
- [ ] 產出合規之範例圖檔。

---

## Files Allowed to Change (允許變更的檔案)
- `scripts/rich-menu/renderer.*`
- `tests/rich-menu/renderer.*`
- `DECISIONS.md`（若更新渲染選型）

---

## Handoff (交接程序)
1. 確認測試全部 PASS。
2. 更新 [`.agent/episodes/ep02-rich-menu/STATUS.md`](../STATUS.md)：
   - `Ep02-2`: 改為 `Complete`
   - `Ep02-3`: 改為 `Ready`
   - 在 `Current Verified Outputs` 登記 Renderer 測試成果。
3. 停止執行，交由下一個 Agent 執行 Ep02-3。
