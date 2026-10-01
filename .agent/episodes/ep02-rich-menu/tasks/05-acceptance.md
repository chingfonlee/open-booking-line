# Ep02-5 — Acceptance / Freeze (端對端驗收與版本凍結)

## Goal (目標)
本階段**不再新增任何功能代碼**。職責為在全新的乾淨對話／執行工作區中，以真實使用者與實機視角完整驗證整條鏈路（Discovery ➔ Spec ➔ Render ➔ Approval ➔ Dry Run ➔ Publish ➔ Remote Verify ➔ Mobile Verify），並在人類實機驗收通過後，依照嚴格順序完成狀態登錄與版本快照封裝。

---

## Must Read (必讀文件)
- [`AGENTS.md`](../../../AGENTS.md)
- [`.agent/AGENT-RULES.md`](../../AGENT-RULES.md)
- [`.agent/episodes/ep02-rich-menu/PLAN.md`](../PLAN.md)
- [`.agent/episodes/ep02-rich-menu/STATUS.md`](../STATUS.md)
- [`.agent/episodes/ep02-rich-menu/DECISIONS.md`](../DECISIONS.md)

---

## Inputs (輸入資訊)
- 完整通過測試之 Ep02 程式碼（`scripts/rich-menu/*`）。
- 部署完成之線上 LINE 官方帳號與管理員手機。

---

## Deliverables (交付產物)
1. 端對端自動化測試回報（CI/Local E2E）。
2. 人類實機手機檢驗回報（三項查核點）。
3. 狀態登錄檔：更新 `.booking/project-state.json`。
4. 公開手冊更新：更新 `README.md`、`docs/episodes/ep02-rich-menu/README.md`、`CHANGELOG.md`。
5. Git 歷史快照標籤：`ep02-rich-menu`。

---

## Implementation Requirements (實作要求)

### 步驟 1：端對端全流程乾跑與發布檢驗
由 Agent 執行整合管線：
```text
1. 執行 Discovery ➔ 驗證 targets.json
2. 產生 Spec ➔ 驗證 menu-spec.json
3. 渲染圖檔 ➔ 驗證 preview.png
4. 產生審批門禁 ➔ approval.json
5. 執行 Publisher --dry-run ➔ 預檢通過
6. 執行正式 Publisher ➔ 取得 LINE 遠端生效回報
```

### 步驟 2：人類實機手機驗收 (Human Acceptance Gate)
必須由使用者在真實手機 LINE 官方帳號中操作，並明確回報以下三項確認：
```text
[ ] 1. 手機打開 LINE 官方帳號聊天室，底部圖文選單顯示正常且清晰。
[ ] 2. 點擊「線上預約」能正常開啟 LIFF 表單且可送出預約。
[ ] 3. 點擊「查詢進度」能在聊天室收到進度 Flex Message 卡片。
```

> ⚠️ **鐵律 (Enforcement Rule)**：  
> **若上述 3 項驗收未全數通過，嚴禁更新 `project-state.json`、嚴禁更新 `README.md`、嚴禁建立 Git Tag！**

### 步驟 3：驗收通過後之固定收尾時序 (Post-Pass Freeze Sequence)
若三項實機驗收全部 PASS，嚴格按照以下時間序執行（順序不可顛倒）：
```text
1. 更新本地 .booking/project-state.json:
   "rich-menu": {
     "status": "verified",
     "sourceEpisode": "ep02-rich-menu",
     "verifiedAt": "<當前 ISO 8601 時間戳>"
   }
2. 更新根目錄 README.md:
   在 Current Capabilities 將「LINE Rich Menu 圖文選單」標記為 ✓
   在 Episode Guide 將 Ep02 狀態更新為 Stable
3. 更新 docs/episodes/ep02-rich-menu/README.md:
   將狀態標記為 Stable，Tag 填入 ep02-rich-menu
4. 更新 CHANGELOG.md:
   正式將 Ep02 內容移入 [1.1.0] - Episode 02 — LINE Rich Menu
5. 更新 .agent/episodes/ep02-rich-menu/STATUS.md:
   將 Episode Status 改為 Complete
6. 提交 Git 乾淨代碼至 main 並 Push:
   git commit -m "feat(ep02): complete verified LINE Rich Menu capability"
7. 建立並推送正式 Git Tag:
   git tag -a ep02-rich-menu -m "Episode 02: Verified LINE Rich Menu Capability"
   git push origin ep02-rich-menu
```

---

## Out of Scope (本任務禁止事項)
- ❌ **嚴禁**在此步驟變更任何渲染樣式或業務邏輯。
- ❌ **嚴禁**在未獲人類回覆 PASS 前建立 Tag。

---

## Completion Criteria (完工門檻)
- [ ] 全鏈路自動化與遠端驗證通過。
- [ ] 人類實機 3 項查核全部 PASS。
- [ ] 本地 project-state 已登錄 `rich-menu: verified`。
- [ ] README、CHANGELOG、Episode Docs 完成更新。
- [ ] Git Tag `ep02-rich-menu` 成功推送。

---

## Files Allowed to Change (允許變更的檔案)
- `.booking/project-state.json`
- `README.md`
- `docs/episodes/ep02-rich-menu/README.md`
- `CHANGELOG.md`
- `.agent/episodes/ep02-rich-menu/STATUS.md`

---

## Handoff (交接程序)
完成上述收尾時序後，向使用者呈報 Episode 02 正式完工報告，Ep02 全系列任務結案。
