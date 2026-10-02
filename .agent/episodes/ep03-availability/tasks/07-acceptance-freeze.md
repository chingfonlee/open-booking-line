# Ep03-7 — Acceptance & Freeze (端對端驗收與版本凍結)

## Goal (目標)
本階段**不再新增任何功能代碼**。
針對完整流程進行自動化驗收測試（包含核心 Case A~O 以及擴充加固案例）與人類實機 10 項驗收，全數通過後依嚴格時序完成版本凍結。

---

## 自動化驗收案例清單 (Automated Cases)

### 核心排程與碰撞案例 (Case A ~ O)
- **Case A**：農友 A 與 B 同時送出 10/15 上午 Pending 均成功（Pending 不占時段）。
- **Case B**：管理員確認 A（10/15 上午 09:30），Reservation 建立、A 轉 confirmed。
- **Case C**：新農友查詢 10/15 上午不再可選（鎖定驗證）。
- **Case D**：管理員嘗試確認 B 於 10/15 上午 ➔ 衝突拒絕（Collision 驗證）。
- **Case E**：真實並行同時確認 10/15 上午 ➔ 一成功一衝突（實體並行競爭）。
- **Case F**：同一案件同時確認至不同時間 ➔ 僅能成功一筆 active reservation（案件唯一性 Invariant B）。
- **Case G**：取消之案件嘗試確認 ➔ 失敗且不得產生 active reservation。
- **Case H**：開工時間檢驗（白名單：上午 08:00~11:30、下午 13:00~17:00 每 30 分鐘合法；07:30/09:15/12:00/12:30 等午休與界外時間非法拒絕）。
- **Case I**：改期驗證（舊 released，新 active，系統中僅一筆 active）。
- **Case J**：已確認案件取消 ➔ 釋放 reservation，時段重新開放。
- **Case K**：封鎖 10/20 上午 ➔ 農友無法送單。
- **Case L**：封鎖已有預約之日期 ➔ 警告提示且不自動取消既有 reservation。
- **Case M**：LINE 確認卡片日期時間與 reservation 100% 一致。
- **Case N**：LINE 推播失敗時 reservation 維持 confirmed。
- **Case O**：農友端 UI 100% 不存在確切時間選擇器。

### 擴充安全與邊界加固案例 (Supplemental Hardening Cases)
- **Case P (改期碰撞防護)**：案件進行改期至已被占用之時段 ➔ 改期失敗，且**原預約依然保持 active 完好**。
- **Case Q (重複確認冪等/防護)**：已確認案件再次收到確認請求 ➔ 阻擋操作，不新增多餘 reservation，不重複推播通知。
- **Case R (通用更新 Bypass 阻斷)**：嘗試使用通用 `PATCH /api/admin/requests/:id` 將狀態改為 `processing`、`closed` 或其他涉及生命週期之狀態 ➔ API 阻斷並拒絕，強制走專用排程端點（`/confirm`, `/reschedule`, `/cancel`）。
- **Case S (時區跨日邊界)**：以固定測試時鐘模擬 Asia/Taipei 跨日與閉區間 $[T+1, T+30]$ 判定，驗證不受 Worker UTC 時間漂移干擾。
- **Case T (遷移失敗回滾)**：模擬 D1 Schema 遷移過程中遇到衝突數據 ➔ Fail-closed 中斷並完整保留原狀。
- **Case U (Legacy/Managed 模式切換)**：驗證 Legacy 模式下仍受 Active Reservation 鎖定，且切換為 Managed 後完整套用每週規則與例外。

> **測試環境要求**：所有日期案例（如 10/15, 10/20）均搭配固定可控的測試時鐘（Mock Clock），確保測試在任何時間執行皆具備 100% 確定性。

---

## 人類實機 10 項查核門禁 (Human Acceptance Gate)
```markdown
[ ] 1. 農友只能選上午 / 下午 / 都可以（無確切開工時間選擇器）
[ ] 2. 農友看不到 blocked / reserved broad slots
[ ] 3. Pending 不會鎖 slot（多筆同時送單皆可成功）
[ ] 4. 合作社 Confirm 時能選正式日期
[ ] 5. 合作社 Confirm 時能選上午 / 下午
[ ] 6. 合作社能選白名單精確開工時間（上午 08:00～11:30、下午 13:00～17:00，排除 12:00/12:30 午休）
[ ] 7. Confirm 後 Reservation 正確鎖定該 broad slot
[ ] 8. 農友查詢進度卡片看到正式日期與預定開工時間
[ ] 9. LINE 確認卡片推播內容與正式排程 100% 一致
[ ] 10. Cancel 釋放時段 / Reschedule 原子改期行為正確
```

---

## 結案與凍結時序 (Freeze Sequence)
1. 自動化測試（Case A~U）100% PASS。
2. 人類實機 10 項確認 PASS。
3. 更新 `.booking/project-state.json` 登錄 `booking-availability: verified`。
4. 更新根目錄 `README.md`、公開手冊 `docs/episodes/ep03-availability/README.md`、`CHANGELOG.md`。
5. 更新 `.agent/episodes/ep03-availability/STATUS.md` 為 `Complete`。
6. Commit 代碼並建立推播 Git Tag `ep03-availability`。
