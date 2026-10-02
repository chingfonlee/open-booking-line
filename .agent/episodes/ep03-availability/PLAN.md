# Episode 03 Implementation Plan: Availability & Confirmation Scheduling

> 本計畫定義 Episode 03 的完整執行藍圖、模組職責劃分、任務順序、依賴關係與驗收門檻。

---

## 1. Goal (目標)

為已驗證通過 `booking-core` 與 `rich-menu` 能力的專案實例，安全、確定性地增添 **時段可用性與確認排程（booking-availability）** 能力：
1. **Request ≠ Reservation 領域分離**：農友端僅能提出寬鬆偏好時段（上午 / 下午 / 都可以），Pending 狀態絕不占用正式時段。
2. **合作社管理員確認排程**：電話確認後，由管理端指定正式服務日期、正式 broad slot（上午 / 下午）與精確開工時間（08:00～17:00，30 分鐘間隔），建立正式 `slot_reservations` 並鎖定該時段。
3. **Availability 計算引擎**：後端統一以公式 `Weekly Rules - Exceptions - Active Reservations - Past Dates` 計算可選時段，並支援 Legacy 與 Managed 模式切換。
4. **排程生命週期與並行防護**：保證原子性改期（Reschedule）、釋放（Cancel）、防止孤兒預約（Orphan Protection）與真正的資料庫級碰撞阻擋（Collision Invariants A & B）。
5. **即時確認卡片推播與介面一致性**：Confirm 成功後即時發送包含精確開工時間的 LINE 確認 Flex 卡片，所有查詢與管理介面之正式排程皆以 `slot_reservations` 為唯一真實來源。

---

## 2. Architecture (管線架構)

```text
[Ep02 Verified Project]
         │
         ▼
[Task 0: Current State & Data Audit]
         │ 產出: .booking/audits/ep03-current-state.md (只讀盤點，不改代碼)
         ▼
[Task 1: Domain Model, Migration & Recovery]
         │ 產出: D1 Schema, ADRs, 遷移腳本與回滾復原方案
         ▼
[Task 2: Availability Engine & Read API]
         │ 產出: 後端核心計算邏輯與 GET /api/availability API
         ▼
[Task 3: Farmer Booking Flow]
         │ 產出: 農友端寬鬆時段申請介面、提示文案與後端時段防護
         ▼
[Task 4: Confirmation & Reservation Lifecycle]
         │ 產出: 管理端確認介面、開工時間驗證、原子改期與防孤兒防護
         ▼
[Task 5: Merchant Availability Settings]
         │ 產出: 合作社週期營業時段與例外封鎖管理介面
         ▼
[Task 6: Confirmation Card & Display Consistency]
         │ 產出: 即時預約確認 LINE 卡片推播與跨端顯示一致性
         ▼
[Task 7: Acceptance / Freeze]
         │ 產出: 21 項自動化案例驗收（Case A~U）、人類手機實機查核、能力登錄與版本凍結
         ▼
[Episode Complete]
```

---

## 3. Task Order (任務執行順序)

每個 Task 皆為獨立垂直切片，必須嚴格按照以下順序前進：

1. **`Ep03-0` — Current State & Data Audit**：盤點 Ep01 資料結構、時區處理、繞過風險與線上資料庫狀態（唯讀審計）。
2. **`Ep03-1` — Domain Model, Migration & Recovery**：確立領域模型、ADR、DB 遷移、部分唯一索引與回滾保護。
3. **`Ep03-2` — Availability Engine & Read API**：建立後端唯一 Availability 計算邏輯與單元測試。
4. **`Ep03-3` — Farmer Booking Flow**：更新農友申請表單與提示，嚴禁選擇確切時間，送單重新校驗時段。
5. **`Ep03-4` — Confirmation & Reservation Lifecycle**：實作管理員確認/改期/取消專用 API 與前端，禁止通用 bypass。
6. **`Ep03-5` — Merchant Availability Settings**：實作合作社週期時段與特定日期例外封鎖設定，Legacy 漸進轉 Managed。
7. **`Ep03-6` — Confirmation Card & Display Consistency**：LINE 確認卡片即時推播（發送失敗不回滾排程），統一顯示來源。
8. **`Ep03-7` — Acceptance / Freeze**：21 項驗收案例（Case A~U，含並行競爭、改期防護、Bypass 阻斷、時區與切換驗證）、人類實機 10 項確認、登錄 state、更新文件並建立 Tag。

---

## 4. Completion & Freeze Criteria (結案與凍結條件)

- 所有 8 個 Tasks 依序執行且其交付產物全部齊全。
- 自動化測試套件（Case A~U 全數 21 項）100% 通過。
- 人類實機 10 項驗收指標全數確認 PASS。
- 專案能力登錄 `.booking/project-state.json` 包含 `booking-availability: verified`。
- 建立並推送正式 Git Commit 與 Tag `ep03-availability`。
