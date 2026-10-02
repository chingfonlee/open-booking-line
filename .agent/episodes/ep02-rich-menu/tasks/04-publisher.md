# Ep02-4 — Safe Publisher + Rollback (安全發布器與還原機制)

## Goal (目標)
實作具備安全 Dry-run 模擬預檢、原子發布流程、以及完備三情境 Rollback 還原能力的 LINE Rich Menu 發布工具。確保在任何網路例外或使用者要求撤銷時，均能精準復原原官方帳號狀態。

---

## Must Read (必讀文件)
- [`AGENTS.md`](../../../../AGENTS.md)
- [`.agent/AGENT-RULES.md`](../../../AGENT-RULES.md)
- [`.agent/episodes/ep02-rich-menu/PLAN.md`](../PLAN.md)
- [`.agent/episodes/ep02-rich-menu/STATUS.md`](../STATUS.md)
- [`.agent/episodes/ep02-rich-menu/DECISIONS.md`](../DECISIONS.md)（特別是 ADR-EP02-005）

---

## Inputs (輸入資訊)
- 經核准之 Spec 與圖檔（`.booking/rich-menu/approval.json`、`.booking/rich-menu/preview.png`）。
- 執行階段密鑰：`LINE_CHANNEL_ACCESS_TOKEN`（Operation Secret，由環境變數或 CLI 傳入）。

---

## Deliverables (交付產物)
1. 發布腳本：`scripts/rich-menu/publisher.ts`（支援 `--dry-run` 旗標）。
2. 還原腳本：`scripts/rich-menu/rollback.ts`。
3. 營運狀態追蹤檔：`.booking/rich-menu/managed.json`（受 `.gitignore` 保護，**嚴禁寫入 `project-state.json`**）。
4. 測試套件：驗證 Dry-run 不殘留、發布流程完整性、以及 3 種 Rollback 情境。

---

## Implementation Requirements (實作要求)

### 階段 1：實作 `--dry-run` 乾跑驗證
在進行任何遠端資源變更前，必須能執行乾跑：
```text
1. 本地讀取 approval.json 並驗算 specHash / imageHash
2. 驗證通過 ➔ 呼叫 LINE 官方規格校驗端點 POST /v2/bot/richmenu/validate
3. 查詢目前 LINE 遠端預設選單狀態 (GET /v2/bot/user/all/richmenu)
4. 輸出預檢報告並安全中止 (STOP) ➔ 絕不建立或上傳任何遠端資源！
```

### 階段 2：實作正式發布 (Publish Pipeline)
Dry-run 測試通過後，實作原子發布管線：
```text
1. 嚴格校驗 approval.json
2. 查詢並記錄原預設選單 (oldDefaultMenuId)
3. 建立新 Rich Menu 物件 (POST /v2/bot/richmenu) ➔ 取得 newRichMenuId
4. 上傳圖檔 (POST /v2/bot/richmenu/{richMenuId}/content，帶入 image/png 或 image/jpeg)
5. 驗證圖檔已成功掛載 (GET /v2/bot/richmenu/{richMenuId})
6. 將新選單設為全域預設 (POST /v2/bot/user/all/richmenu/{richMenuId})
7. 遠端確認預設選單已生效 (GET /v2/bot/user/all/richmenu 驗收 ID)
8. 寫入本地 .booking/rich-menu/managed.json 記錄目前與歷史選單 ID
```

### 階段 3：實作 Rollback 還原機制
還原腳本必須涵蓋以下三種既有狀態情境：
* **情境 A（原先有 API 預設選單）**：
  若 `oldDefaultMenuId` 存在，重新將其設為預設（`POST /v2/bot/user/all/richmenu/{oldDefaultMenuId}`）。
* **情境 B（原先為 OA Manager 手動選單或特殊綁定）**：
  解除 API 預設綁定（`DELETE /v2/bot/user/all/richmenu`），讓 LINE 聊天室自動退回 OA 後台手動選單。
* **情境 C（原先完全無任何選單）**：
  解除 API 預設綁定（`DELETE /v2/bot/user/all/richmenu`），使聊天室回到無選單之初始純對話狀態。
* 刪除本次新建之孤兒選單（`DELETE /v2/bot/richmenu/{newRichMenuId}`）。

---

## Out of Scope (本任務禁止事項)
- ❌ **嚴禁**更新 `.booking/project-state.json`（必須留待 Task 5 實機驗收完畢）。
- ❌ **嚴禁**在 `wrangler.toml` 或 Git 中留下 Access Token。

---

## Tests (測試驗收項目)
1. **Dry-run 隔離測試**：執行 `--dry-run` 後，確認 LINE 遠端選單數量未增加、預設選單未變更。
2. **Hash 阻斷測試**：竄改圖檔後呼叫 Publisher，確認立即 Fail-Closed 阻斷。
3. **Rollback 情境測試**：
   - 測試 A：成功回滾至原先的 `oldDefaultMenuId`。
   - 測試 B/C：成功呼叫 DELETE 解除預設綁定。

---

## Completion Criteria (完工門檻)
- [ ] Publisher 支援 `--dry-run` 且運作正常。
- [ ] 正式發布與狀態更新邏輯完成。
- [ ] 3 種 Rollback 情境均通過模擬或端對端測試。

---

## Files Allowed to Change (允許變更的檔案)
- `scripts/rich-menu/publisher.*`
- `scripts/rich-menu/rollback.*`
- `tests/rich-menu/publisher.*`
- `tests/rich-menu/rollback.*`
- `.booking/rich-menu/managed.json`

---

## Handoff (交接程序)
1. 確認測試全部 PASS。
2. 更新 [`.agent/episodes/ep02-rich-menu/STATUS.md`](../STATUS.md)：
   - `Ep02-4`: 改為 `Complete`
   - `Ep02-5`: 改為 `Ready`
   - 在 `Current Verified Outputs` 登記 Safe Publisher & Rollback 成果。
3. 停止執行，交由下一個 Agent 執行 Ep02-5。
