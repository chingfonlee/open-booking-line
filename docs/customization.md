# Customization — 客製化指南

> 本文件說明如何將 open-booking-line 客製化成你自己的預約系統。

---

## 🎯 概覽：三層客製化架構

open-booking-line 採用三層客製化設計，讓不同技術能力的使用者都能完成客製：

```
Level 1 — Configuration Only（環境變數設定）
  ↓ 不需改程式碼，只改設定值
  
Level 2 — Form Customization（表單欄位客製化）
  ↓ 需要修改 types.ts + 前端 + 後端
  
Level 3 — Schema / Business Logic（資料庫與業務邏輯）
  ↓ 需要修改 D1 Schema + Migration（進階）
```

大部分小型商家**只需要 Level 1**，最多到 Level 2。

---

## Level 1 — Configuration Only（設定值客製化）

**不需要改程式碼**，只需要設定環境變數。

### 可以客製的項目

| 設定 | 環境變數 | 範例 |
| :--- | :--- | :--- |
| 服務站名稱 | `VITE_STATION_NAME` / `STATION_NAME` | `我的美容工作室` |
| LIFF ID | `VITE_LIFF_ID` | `2001234567-AbCdEfGh` |
| API Base URL | `VITE_API_BASE_URL` | _(通常留空)_ |
| Turnstile Site Key | `VITE_TURNSTILE_SITE_KEY` | _(正式環境填入)_ |

### 設定方式

**後端（wrangler.toml）**：
```toml
[vars]
STATION_NAME = "我的美容工作室"
LIFF_ID = "your-liff-id"
```

**前端（packages/frontend/.env）**：
```env
VITE_STATION_NAME=我的美容工作室
VITE_LIFF_ID=your-liff-id
```

---

## Level 2 — Form Customization（表單欄位客製化）

**需要修改程式碼**，但有明確的修改路徑。

### 修改流程

```
1. 修改 packages/shared/types.ts
        ↓
2. 修改 packages/backend/schema.sql（如果是新欄位）
        ↓
3. 修改 packages/backend/src/index.ts（後端驗證 + INSERT）
        ↓
4. 修改 packages/frontend/src/components/ApplyForm.tsx（前端表單）
```

> ⚠️ **重要**：每一層都要同步修改，不能只改前端。

### 範例：新增「車牌號碼」欄位

#### Step 1: 修改 types.ts
```typescript
export interface CreateServiceRequestDto {
  // ... 現有欄位
  vehicle_plate?: string;  // 新增
}
```

#### Step 2: 修改 schema.sql
```sql
ALTER TABLE service_requests ADD COLUMN vehicle_plate TEXT;
```

#### Step 3: 修改後端 INSERT
```typescript
// 在 index.ts 的 INSERT SQL 中加入 vehicle_plate
```

#### Step 4: 修改前端表單
```tsx
<input
  value={formData.vehicle_plate}
  onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
  placeholder="車牌號碼"
/>
```

### 🔵 Planned — 常見客製化案例

> 以下教學將在 YouTube 系列中逐集介紹：

- [ ] 修改服務地區（地區選單）— _Phase 4_
- [ ] 新增服務項目 — _Phase 3_
- [ ] 修改時段選項 — _Phase 4_
- [ ] 新增自訂欄位 — _Phase 5_

---

## Level 3 — Schema / Business Logic（進階客製化）

**需要深入修改**，適合有開發經驗的使用者。

### 包含

- 新增/刪除資料表
- 修改業務邏輯（狀態機、計算邏輯）
- D1 Migration（不影響現有資料的欄位新增）

### 🔵 Planned（計畫中）

> 詳細說明將在 YouTube Episode 05 介紹：

- D1 Migration 安全流程
- Backward compatibility 設計原則
- 如何刪除欄位而不影響現有資料

---

## 🎯 使用場景映射

| 使用場景 | 需要修改 | Level |
| :--- | :--- | :--- |
| 改商家名稱 | 環境變數 | Level 1 |
| 改服務地區（高雄 → 台北） | `types.ts` + 環境變數 | Level 1-2 |
| 農業 → 美容預約 | 服務項目 + 前端文字 | Level 1-2 |
| 農業 → 維修預約 | 服務項目 + 欄位調整 | Level 2 |
| 新增「附圖」功能 | 需要 R2 + 大改 | Level 3 |
| 多租戶（多個商家） | 架構重新設計 | 超出本專案範圍 |

---

## 🔗 相關資源

- [database.md](database.md) — 資料庫 Schema 詳細說明
- [architecture.md](architecture.md) — 系統架構說明
- YouTube 系列（計畫中）— 逐集示範客製化方式
