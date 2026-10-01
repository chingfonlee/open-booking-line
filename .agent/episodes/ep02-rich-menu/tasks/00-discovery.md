# Ep02-0 — Discovery / Preflight (探索與前置檢測)

## Goal (目標)
自動檢測現有 Ep01 部署與店家資訊，解析出真實的預約入口（LIFF URL / Pages URL）、查詢進度觸發關鍵字（預設為「查詢預約」），並透過 LINE Messaging API 執行 Preflight 檢測遠端當前的 Rich Menu 狀態。

---

## Must Read (必讀文件)
- [`AGENTS.md`](../../../AGENTS.md)
- [`.agent/AGENT-RULES.md`](../../AGENT-RULES.md)
- [`.agent/episodes/ep02-rich-menu/PLAN.md`](../PLAN.md)
- [`.agent/episodes/ep02-rich-menu/STATUS.md`](../STATUS.md)
- [`.agent/episodes/ep02-rich-menu/DECISIONS.md`](../DECISIONS.md)

---

## Inputs (輸入資訊)
- 現有 Ep01 專案原始碼（`packages/frontend`、`packages/backend`）。
- 本地專案狀態：`.booking/project-state.json`。
- 本地環境設定：`packages/frontend/.env`、`packages/backend/wrangler.local.toml`。
- 執行階段金鑰：`LINE_CHANNEL_ACCESS_TOKEN`（由環境變數或互動提示取得）。

---

## Deliverables (交付產物)
1. 探索腳本或模組：例如 `scripts/rich-menu/discovery.ts`（或 `discovery.js`）。
2. 本地探索資料產物：`.booking/rich-menu/targets.json`。
3. 單元/整合測試：驗證探索邏輯與 JSON 格式正確性。

---

## Implementation Requirements (實作要求)
1. **本地目標探索**：
   - 解析出目前店家名稱（`stationName`）。
   - 解析出有效的預約網址（若有 `VITE_LIFF_ID` 優先組合成 `https://liff.line.me/<LIFF_ID>`，否則使用 Pages 網址）。
   - 解析出進度查詢關鍵字（預設為 `查詢預約`）。
2. **LINE 遠端 Preflight**：
   - 呼叫 `GET https://api.line.me/v2/bot/user/all/richmenu` 檢查是否已有預設選單。
   - 若有預設選單，紀錄 `currentDefaultMenuId`；若回傳 404 則標記為無預設選單。
3. **規格輸出**：
   將探索結果原子寫入 `.booking/rich-menu/targets.json`，格式範例：
   ```json
   {
     "stationName": "高雄服務站",
     "bookingUri": "https://liff.line.me/2000000000-XXXXXXXX",
     "queryKeyword": "查詢預約",
     "remotePreflight": {
       "hasExistingDefault": false,
       "currentDefaultMenuId": null,
       "totalExistingMenus": 0
     },
     "discoveredAt": "2026-10-01T12:00:00.000Z"
   }
   ```
4. **安全原則**：
   - 嚴禁將 `LINE_CHANNEL_ACCESS_TOKEN` 明文寫入 `targets.json`！

---

## Out of Scope (本任務禁止事項)
- ❌ **嚴禁**進行圖像渲染或 SVG 產出。
- ❌ **嚴禁**建立或上傳任何 Rich Menu 至 LINE。
- ❌ **嚴禁**修改 LINE 官方帳號的目前預設選單。

---

## Tests (測試驗收項目)
1. **目標解析測試**：給定前端與後端設定檔，確認能正確解析出 LIFF 預約網址與店家名稱。
2. **Preflight 模擬測試**：模擬 LINE API 回傳（有既有選單 vs 無既有選單），確認 `targets.json` 欄位完整符合 schema。

---

## Completion Criteria (完工門檻)
- [ ] 執行 discovery 腳本成功產出 `.booking/rich-menu/targets.json`。
- [ ] 測試套件執行 100% 通過。
- [ ] 產物未洩漏任何 Access Token。

---

## Files Allowed to Change (允許變更的檔案)
- `scripts/rich-menu/discovery.*`
- `tests/rich-menu/discovery.*`
- `package.json`（若需加入 npm run script）
- `.booking/rich-menu/targets.json`

---

## Handoff (交接程序)
1. 確認測試全部 PASS。
2. 更新 [`.agent/episodes/ep02-rich-menu/STATUS.md`](../STATUS.md)：
   - `Ep02-0`: 改為 `Complete`
   - `Ep02-1`: 改為 `Ready`
   - 在 `Current Verified Outputs` 登記 `targets.json`。
3. 若產生未預期之架構抉擇，記錄至 `DECISIONS.md`。
4. 停止執行，交由下一個 Agent 執行 Ep02-1。
