# Ep03-0 — Current State & Data Audit (現況盤點與資料審計)

## Goal (目標)
完全了解 Ep01 現況，**不修改任何功能代碼**。
針對目前程式碼庫與線上遠端資料庫進行深度只讀審計，為後續資料庫設計（Ep03-1）提供客觀依據。

---

## 必查項目 (Mandatory Audit Items)

1. **Request Schema & Status Lifecycle 映射盤點**：
   - 盤點真實欄位名稱：日期（`preferred_date`）、時段（`preferred_time_slot`，注意包含 `'morning' | 'afternoon' | 'any'`）、日期彈性（`date_flexibility`）、狀態（`status`：現況為 `'to_contact' | 'processing' | 'closed'`）、服務項目（`service_type`）。
   - **分析現有狀態與新契約之映射風險**：目前完全沒有 `confirmed` 狀態；管理員僅能標記為 `processing`（處理中），不可直接將 `processing` 視為已確認排程！
2. **Farmer Slot 現狀**：
   - 確認目前農友端表單實際可選時段（目前為：`morning` 上午、`afternoon` 下午、`any` 皆可配合）。
   - 確認文案提示與驗證行為。
3. **Status Lifecycle & Generic Update Bypass 盤點**：
   - 找出目前所有修改 status、修改日期、修改時段的 API route（例如 `PATCH /api/admin/requests/:id`）與 UI 操作。
   - 紀錄其直接更新 `status` 欄位而繞過排程鎖定生命週期的架構弱點。
4. **Date/Time Displays 顯示盤點**：
   - 搜尋農友進度查詢、LINE Flex Webhook 回覆、Admin list、Admin detail 與其他通知目前顯示哪一組 date/time。
   - 確認目前均直接顯示農友希望日期 `preferred_date` 與時段。
5. **blocked_dates 現況與相容性風險**：
   - 確認現有 `blocked_dates` 表結構（`date TEXT PRIMARY KEY, reason TEXT, created_at TEXT`）。
   - 盤點管理員操作端點（`GET /api/config/blocked-dates`, `POST /api/admin/blocked-dates`）與農友端表單檢查。
   - 評估未來新 `availability_exceptions` 與舊 `blocked_dates` 之共存或遷移路徑。
6. **Existing Remote Data (只讀 SELECT 統計)**：
   - 透過 Cloudflare D1 執行只讀統計（若有可用 Cloudflare / D1 查詢環境）：
     - `status` 分布統計（`to_contact`, `processing`, `closed`）
     - `preferred_time_slot` 分布（`morning`, `afternoon`, `any`）
     - 檢查是否有重複日期+時段之案件
     - 檢查是否有缺失日期或時段之案件
   - **缺少憑證時的處置 (No Credential Handling)**：
     - 若無遠端 D1 操作憑證或無法連線，該項**嚴格標記為 `NOT VERIFIED — remote credential unavailable`**，並保留為未完成項。
     - **嚴禁以本地 schema.sql 推論替代遠端真實資料證據**！
   - **嚴格去識別化**：禁止輸出姓名、電話、地址、個資或真實備註。
7. **Timezone & 邊界時間計算**：
   - 盤點目前前端 `new Date().toISOString().slice(0, 10)` 與後端 Worker UTC 時間之使用方式。
   - 找出可能導致「跨日（UTC vs Asia/Taipei）」計算錯誤的隱患。

---

## Deliverables (交付產物)
- Gitignored 審計報告檔：`.booking/audits/ep03-current-state.md`（已於 `.gitignore` 宣告保護）。

---

## Completion Criteria (完工門檻)
- 審計報告產出且包含上述 7 大維度之完整證據。
- **嚴禁**在此 Task 修改或實作任何功能代碼或資料庫 Schema。
