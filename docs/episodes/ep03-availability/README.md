# Episode 03 — Availability & Confirmation Scheduling (時段可用性與確認排程)

> 本集聚焦於為已具備預約核心 (`booking-core`) 與圖文選單 (`rich-menu`) 的專案擴充 **時段可用性引擎與確認排程能力 (`booking-availability`)**。

> [!IMPORTANT]
> **教學影片與專案最新狀態同步聲明**：  
> 隨著合作社幹部於烈日農地與突發天候下之實際調度經驗，本專案在 EP03 的後台人體工學上已進行了關鍵優化（例如將天候豪雨或臨時機具維修最頻繁使用的「特定日期公休例外封鎖」卡片**移至時段設定最頂端**，並與 LINE 幹部 Rich Menu【休假預定】深層直達聯動），且資料庫層擁有 `idx_uniq_active_slot` 條件式唯一索引之硬性防超約保護。  
> **若教學影片內容或舊版展示與當前專案程式碼有所出入，請一律以 GitHub 專案最新原始碼與此處說明文件為準。**

---

## What This Adds (本集新增能力)

* **`booking-availability` 能力體系**：
  * **Request ≠ Reservation 領域分離**：農友端僅能提出寬鬆偏好時段（上午 / 下午 / 都可以），未經站所確認前絕不占用時段（Pending 不占時段）。
  * **Availability 計算引擎**：以公式 `Weekly Rules - Exceptions - Active Reservations - Past Dates = Selectable Broad Slots` 精確計算可選時段，支援 Legacy 與 Managed 漸進模式切換。
  * **合作社管理員確認排程**：管理員致電溝通後，指定正式日期與開工時間白名單（上午 08:00～11:30、下午 13:00～17:00，排除 12:00/12:30 午休），原子建立 `slot_reservations`。
  * **資料庫層級條件式唯一索引防超約**：D1 具備 `idx_uniq_active_slot`（`UNIQUE INDEX ON slot_reservations(booking_date, slot_code) WHERE status = 'active'`），在資料庫層保證並行高並發下絕無超約可能。
  * **生命週期與並行防護**：原子改期（Reschedule 碰撞安全回滾保全原案）、取消釋放（Cancel）、通用更新防繞過（Generic PATCH Bypass Guard）與防孤兒預約機制。
  * **時段規則與公休設定人體工學 UI (`AdminDashboard.tsx`)**：
    * **首屏第一張（置頂）**：🟥 **特定日期公休例外封鎖 (Exceptions)**（磚紅色系，支援天候豪雨/機具維修快速登打與 Case L 衝突檢查）。
    * **第二張**：🟢 **每週固定開放時段矩陣 (14 區間)**（Fail-Closed 防呆阻斷）。
    * **第三張（底部）**：🛡️ **排程引擎模式與預約窗口 (Lead Time & Horizon)**。
  * **與 LINE 幹部 4 大宮格工作台無縫直達**：
    * 點擊 LINE 幹部選單左下角【休假預定】（大地磚紅），透過 LIFF `liff.state` 參數無縫直達置頂的公休設定卡片。
  * **即時排程確認推播與跨端顯示一致**：正式確認與改期專屬 LINE Flex 卡片即時推播，官方帳號查詢進度 Webhook 與後台儀表板統一以 Reservation 為權威來源。

---

## Prerequisites (前置條件)

在開始安裝此能力前，專案必須滿足：
1. **前置能力依賴**：本地 `.booking/project-state.json` 中的 `booking-core` 與 `rich-menu` 必須已為 `verified` 狀態。
2. **LINE OA 權限**：具備 LINE Messaging API Channel Access Token。
3. **Cloudflare D1 權限**：具備執行資料庫遷移之權限。

---

## Get / Update This Episode (如何安全取得本集更新)

### 步驟 1：檢視工作目錄狀態
```bash
git status
```

### 步驟 2：執行自動化遷移與驗證
1. 執行 D1 Schema 遷移：
   ```bash
   npx wrangler d1 migrations apply xingnong-db --local
   ```
2. 執行全套自動化測試驗證：
   ```bash
   npm test
   ```

---

## Start (如何開始執行)

取得更新後，直接對您的 AI Coding Agent 發出指令：

> 「請檢查我目前的專案狀態，並在目前專案安裝 Episode 03 booking-availability 能力。」

Agent 會自動：
1. 檢核前置 `booking-core` 與 `rich-menu` 是否已就緒。
2. 遵循 `.agent/episodes/ep03-availability/` 之任務 SOP 依序完成所有驗證門檻。
3. 確保全庫 21 項驗收案例（Case A~U）與人類實機各項指標 100% 通過。

---

## Result (完成後成果)

通過實機驗收後，您將擁有：
- 完整啟用時段可用性引擎的農友預約介面（自動連動公休與額滿時段阻斷）。
- 人體工學置頂的合作社營業時段與公休例外設定工作台。
- 支援 LINE Rich Menu【休假預定】深層直達的後台設定路由。
- 包含預約排程白名單開工時間與「準時抵達」說明之 LINE Flex 即時確認推播。
- 本地 `.booking/project-state.json` 將正式記錄 `capabilities.booking-availability` 為 `verified`。

---

## Version (版本資訊)

- **能力識別碼**：`booking-availability`
- **狀態**：`Stable`（已通過全套單元測試與實機端對端驗收）
- **歷史快照 Tag**：
  - 最初發布版本：[`ep03-availability`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep03-availability)
  - **最新後台公休置頂人體工學版**：[`ep03-admin-settings-top`](https://github.com/chingfonlee/open-booking-line/releases/tag/ep03-admin-settings-top)

---

## Video (教學影片)

- **YouTube 教學連結**：*(製作準備中)*  
  *(註：影片畫面以初版架構講解，最新功能演進請參照本文件)*
