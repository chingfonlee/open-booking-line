# Ep03-2 — Availability Engine & Read API (可用性計算引擎與查詢 API)

## Goal (目標)
建立後端唯一的 Availability 計算引擎與查詢端點（Read API），前端不自行計算可用性。

---

## 核心計算公式 (Managed Mode)
```text
Weekly Rules
- Exceptions
- Active Reservations
- Invalid/Past Dates
= Selectable Broad Slots
```
* 注意：`Pending Requests` 絕不扣除！

---

## 交付產物與測試
1. 後端 Availability Engine 模組。
2. 查詢 API（如 `GET /api/availability?date=YYYY-MM-DD`）。
3. 測試套件涵蓋：
   - 正常開放日期
   - 整天封鎖
   - 上午封鎖
   - 上午已正式保留（Reserved）
   - 上午有 Pending 申請（不影響可用性）
   - 過去日期
   - Legacy 模式與 Managed 模式切換行為
