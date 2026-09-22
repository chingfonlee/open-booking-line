# 行農合作社｜服務申請管理 — 專案進度追蹤 (status.md)

**最後更新時間**：2026-09-22  
**當前版本**：Starter 實體運作版 (高雄服務站)  
**專案技術棧**：Cloudflare Workers + Hono + Cloudflare D1 (SQLite) + Vite + React 18 + Tailwind CSS + LINE LIFF 相容

---

## 📌 專案定位與產品規格
- **定位**：極簡、高效、專注於第一線「顧客送單 ➔ 幹部打電話確認 ➔ 標記狀態」的單一實體運作版。
- **原則**：不導入繁複階梯報價、不導入多師傅指派、不導入農地照片上傳，降低農友與幹部使用門檻。
- **服務站所**：高雄服務站

---

## ✅ 已完成進度里程碑 (Changelog)

### 1. 核心服務項目與作物選項
- [x] **4 大核心服務項目**：
  1. 果樹枝條粉碎
  2. 果樹代耕
  3. 農機出租
  4. 其他農業服務
- [x] **主要作物標籤**：芭樂、蜜棗、芒果、竹子（已依指示移除水稻、檸檬、蔬菜）。

### 2. 農友預約需求欄位優化
- [x] **枝條數量卡片（必填）**：少量、中量、大量、不確定。
- [x] **預估面積欄位（分離式設計）**：
  - 數值框：自適應縮放，防止在行動與網格排版中超出右側外框線。
  - 單位選單：精巧寬度（80px），預設單位為「**分**」，可選「**甲**」、「**畝**」、「**坪**」。
- [x] **希望施工日期與彈性（選填）**：
  - 日期選擇：支援未來日期。
  - 日期彈性卡片：僅此日期方便、前後 3 天皆可、日期可以再與我聯絡確認。
  - 時段選擇：上午、下午、皆可配合。

### 3. 日期黑名單與排程防呆
- [x] 資料庫建立 `blocked_dates` 表，支援合作社手動關閉特定額滿日期。
- [x] 前端填單時自動檢核，若農友選取已被關閉之日期立即跳出提示並阻擋送單。

### 4. 視覺風格與行動端適配（依照示範站 xingnong-starter-demo）
- [x] **大地暖色系主視覺**：
  - 溫潤奶油米色背景（`#f8f3e7` / `#f3f0e8`）。
  - 紙白質感卡片（`#fffdf7`）與泥土棕邊框（`#c8ad86` / `#e0d9cb`）。
  - 深森林綠 Header（`#173820`）搭配裝飾底線與大地墨黑內文（`#20271f`）。
- [x] **字體載入**：全面導入 Google Fonts `Noto Sans TC`（思源黑體）。
- [x] **行動優先（Mobile-First）**：
  - 手機寬度下自動切換為流暢單欄排版。
  - 點擊熱區均大於 44px，田間單手大拇指好點選。
  - 管理端一鍵觸發手機原生外撥電話（`tel:`）。

### 5. 後端與資料庫架構 (Monorepo)
- [x] `packages/shared`：統一資料傳輸介面 (`CreateServiceRequestDto`, `ServiceRequest`, `AREA_UNIT_OPTIONS`)。
- [x] `packages/backend`：Hono 路由、D1 遷移腳本、LINE Push Notification (Flex Message) 模組。
- [x] `packages/frontend`：React 18 + Tailwind SPA，包含顧客填單頁與幹部管理後台。

### 6. 程式碼版本控制 (Git / GitHub)
- [x] 建立標準 `.gitignore`（排除 `node_modules/`、`dist/`、`.wrangler/` 本地快取）。
- [x] 成功初始化 Git 本地儲存庫並關聯遠端 GitHub。
- [x] **GitHub 專案位址**：[https://github.com/chingfonlee/biz-resource-reservation](https://github.com/chingfonlee/biz-resource-reservation)
- [x] 完成初次 Commit 並推送到 `main` 分支。

---

## 🚀 伺服器運行與測試位址

| 服務項目 | 本機運行端點 | 說明 |
| :--- | :--- | :--- |
| **前端應用 (顧客端)** | `http://localhost:5173/` | 農友預約申請表單 |
| **前端應用 (管理端)** | `http://localhost:5173/?view=admin` | 幹部服務申請管理儀表板 |
| **真機區域網路測試** | `http://192.168.16.215:5173/` | 同 Wi-Fi 實體手機瀏覽器測試 |
| **後端 API 伺服器** | `http://127.0.0.1:8787` | Cloudflare Workers API |

---

## 📋 下一步規劃待辦清單 (Backlog)

1. **黑名單後台管理 UI**：在站所後台介面增加日曆或列表，讓幹部直接「點擊關閉/開啟某日」。
2. **LINE 官方帳號正式對接**：
   - 建立 LINE Developers LIFF App 綁定生產 URL。
   - 配置 LINE Bot Channel Access Token 與幹部 Admin User ID。
3. **雲端生產部署**：
   - 前端發佈至 Cloudflare Pages / Netlify。
   - 後端部署至 Cloudflare Workers + Remote D1 Database。
