# Episode 02 Implementation Plan: LINE Rich Menu

> 本計畫定義 Episode 02 的完整執行藍圖、模組職責劃分、任務順序、依賴關係與驗收門檻。

---

## 1. Goal (目標)

為已驗證通過 `booking-core` 能力的專案實例，安全、確定性地增添 **LINE Rich Menu（圖文選單）** 能力：
1. 自動探索本機現有預約入口（LIFF）與進度查詢觸發詞。
2. 確定性規格與幾何區域計算（符合 LINE 官方規範）。
3. 本地確定性圖形渲染（零外部 AI 生圖 API 依賴，支援中文，大小 $\le 1\text{ MB}$）。
4. 預覽與人類明確授權鎖定門禁（Approval Gate）。
5. 具備安全 Dry-run 與完整 Rollback（支援三種舊狀態回滾）的發布工具。
6. 真實 LINE 手機端實機驗收，通過後始得登錄能力並封裝版本。

---

## 2. Architecture (管線架構)

```text
[Ep01 Verified Project]
         │
         ▼
[Task 0: Discovery / Preflight]
         │ 產出: .booking/rich-menu/targets.json
         ▼
[Task 1: Spec + Builder]
         │ 產出: menu-spec schema & LINE object validator
         ▼
[Task 2: Deterministic Renderer]
         │ 產出: 2500x1686 Menu Image (PNG/JPEG <= 1MB)
         ▼
[Task 3: Preview + Approval Gate]
         │ 產出: .booking/rich-menu/approval.json (Spec & Image Hash)
         ▼
[Task 4: Safe Publisher + Rollback]
         │ 產出: LINE Messaging API 上傳、發布與 managed.json 追蹤
         ▼
[Task 5: Acceptance / Freeze]
         │ 產出: 手機實機驗證、狀態登錄、文件更新與 Git Tag
         ▼
[Episode Complete]
```

---

## 3. Task Order (任務執行順序)

每個 Task 皆為獨立垂直切片，必須嚴格按照以下順序前進：

1. **`Ep02-0` — Discovery / Preflight**：探索本地預約網址、查詢觸發詞、LINE 遠端圖文選單現狀。
2. **`Ep02-1` — Spec + Builder**：建立確定性規格 Schema、幾何計算與 LINE API 格式轉換器。
3. **`Ep02-2` — Deterministic Renderer**：實作免外部依賴的本地圖檔渲染器。
4. **`Ep02-3` — Preview + Approval**：提供視覺預覽，要求人類明確確認並寫入防竄改雜湊授權檔。
5. **`Ep02-4` — Safe Publisher**：實作 Dry-run 驗證、上傳發布、原狀態備份與三情境 Rollback 復原。
6. **`Ep02-5` — Acceptance / Freeze**：端對端全流程驗收、手機實機查核、能力登錄與版本快照發布。

---

## 4. Dependencies (前置依賴)

* **專案實例能力**：本地 `.booking/project-state.json` 必須具備 `capabilities.booking-core.status = "verified"`。
* **執行環境**：Node.js 22 LTS，已安裝專案 npm dependencies。
* **LINE 憑證**：具備合法有效之 `LINE_CHANNEL_ACCESS_TOKEN`（作為執行階段 Operation Secret）。

---

## 5. Completion Criteria (完工準則)

唯有以下條件**全部滿足**，Episode 02 始得判定為 Complete：
1. 程式管線（Discovery ➔ Spec ➔ Render ➔ Approval ➔ Publish ➔ Rollback）單元與整合測試全部通過。
2. 人類在實機 LINE 官方帳號聊天室驗收通過：
   - [x] 圖文選單正確顯示在聊天室底欄。
   - [x] 點擊「線上預約」可正常開啟 LIFF 表單。
   - [x] 點擊「查詢進度」可收到被動回傳之進度卡片。
3. 本地 `.booking/project-state.json` 註冊 `capabilities.rich-menu.status = "verified"`。
4. Root `README.md` 將 `LINE Rich Menu` 標記為 `✓`。
5. `CHANGELOG.md` 正式新增 Episode 02 發布條目。
6. Git 提交穩定主幹並建立推送 `ep02-rich-menu` 歷史標籤。

---

## 6. Out of Scope (本集排除範圍 - 嚴格禁止私自擴充)

為了確保交付穩定度與零外部非受控依賴，以下事項**嚴禁**納入 Ep02：
- ❌ **外部 AI 生圖 API 依賴**（如 DALL-E、Midjourney、第三方生圖模型），確保完全離線確定性產出。
- ❌ **LINE MCP 外部 Runtime 依賴**，以原生 Node.js / Fetch 實作標準 REST API 調用。
- ❌ **複雜之 3 格 / 6 格多層動態選單切換**，專注於 Ep02 最核心之「預約 + 查詢」雙分區標準選單。
- ❌ **破壞或重寫 Ep01 已驗證之 Hono API 與 D1 資料結構**。
