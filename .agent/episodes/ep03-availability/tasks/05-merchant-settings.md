# Ep03-5 — Merchant Availability Settings (合作社時段規則設定)

## Goal (目標)
提供合作社管理者設定每週循環開放時段與特定日期例外封鎖維護能力。

---

## 核心規格要求
1. **每週開放時段 (Weekly Rules)**：
   - 星期一至星期日各時段（上午、下午）之啟用或停用狀態。
2. **例外封鎖 (Exceptions)**：
   - 支援封鎖特定日期之全天、僅上午或僅下午。
3. **衝突警告 (Conflict Warning)**：
   - 若封鎖日期已有 active reservation，系統跳出警告並提示衝突數量，不自動取消既有正式預約。
4. **漸進切換 (Legacy → Managed)**：
   - 首次儲存時不得預設關閉全部時段。
   - 儲存頁面提供清楚預覽，確認儲存後正式由 Legacy 模式轉為 Managed 模式。
