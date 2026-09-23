# 行農合作社｜服務申請管理 — 專案進度追蹤 (status.md)

**最後更新時間**：2026-09-23  
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
- [x] **主要作物標籤與彈性選項**：
  - 常用作物：芭樂、蜜棗、芒果、竹子。
  - **新增「其他(在備註內填寫作物種類)」**：點選後提示農友於備註說明，並啟用動態連動防呆（未填寫時阻擋送單）。

### 2. 農友預約需求欄位與格式校正 (嚴格防呆)
- [x] **聯絡電話嚴格格式驗證 (前後端雙層檢核)**：
  - **手機號碼**：嚴格限制需為 10 碼純數字且由 `09` 開頭 (`^09\d{8}$`)。
  - **市話號碼**：嚴格限制需為 9 碼純數字且由 `02`~`08` 開頭 (`^0[2-8]\d{7}$`)。
  - 容錯清理：自動剝除使用者輸入之連字號（`-`）與空白，存入資料庫時維持標準乾淨數字。
  - 即時提示：長度不足或字首不符時，跳出明確字數與格式指引。
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

### 7. Cloudflare 雲端生產部署 (已完成)
- [x] **Cloudflare D1 資料庫**：`xingnong-db` (亞太區域 APAC，資料表 `service_requests`、`blocked_dates` 已建立)。
- [x] **後端 API 伺服器 (Workers)**：`https://line-bot-farm-api.chingfon-lee.workers.dev`
- [x] **前端應用 (Pages)**：`https://xingnong-farm.pages.dev`
- [x] **API 穿透代理 (Pages Functions)**：解決手機與 LIFF 跨域（CORS）問題，已通過端對端送單與管理查詢測試。

### 8. LINE Bot 與 LIFF 應用程式對接 (已上線驗證)
- [x] **官方帳號與 Messaging API**：建立「**行農服務示範帳號**」，設定推播權限。
- [x] **LIFF 內嵌網頁應用**：建立「**行農服務示範-LIFF**」，LIFF ID：`2011709076-09FdfkjH`。
- [x] **自動身分識別 (LINE Profile)**：在 LINE 內開啟表單自動辨識顧客 LINE 暱稱與大頭貼，預填姓名並綁定 `line_user_id`。
- [x] **即時推播通知 (Flex Message)**：農友送出申請後，後端自動透過 Worker 觸發 LINE Messaging API 推播通知給站所幹部，附帶綠色「**撥打電話**」一鍵外撥按鈕。
- [x] **原生體驗優化**：送單成功畫面提供「**關閉視窗 (返回 LINE)**」按鈕，提升使用流暢度。
- [x] **前台顧客與幹部後台畫面徹底分離**：預設完全隱藏頂部「示範切換列」，LIFF 與前台專屬顯示農友預約表單；幹部管理端（`?view=admin`）專屬顯示管理儀表板，符合真實上線運作模式（若簡報需切換可帶入 `?demo=1`）。

### 9. 站所幹部管理端安全防護與防刷機制 (已上線強化)
- [x] **方案 A：PIN 碼密碼鎖安全升級**：
  - **站所管理密碼**：`20241718`（安全儲存於 Cloudflare Worker 環境變數，絕不寫死於前端靜態檔案）。
  - **前端靜態檔案去敏感化**：已完全移除前端 JavaScript 編譯打包產物中的任何明文密碼，前端僅傳送使用者輸入並透過 `/api/admin/verify` 與後端即時核對。
  - **管理端防暴力破解鎖定**：同一來源 IP 若連續輸入錯誤密碼達 5 次，後端自動拒絕存取並暫時鎖定 15 分鐘（回傳 429），杜絕暴力窮舉猜測。
- [x] **農友預約 API 頻率限制 (Rate Limiting 防刷單)**：
  - 在 `POST /api/requests` 加入滑動窗口頻率限制（每 IP 於 10 分鐘內最多 5 筆）。
  - 有效防止惡意爬蟲或腳本刷單塞爆 D1 資料庫，並徹底杜絕惡意耗盡 LINE 官方帳號推播額度的風險。

---

## 🚀 伺服器運行與測試位址

### 🌐 雲端正式線上環境 (手機 / 任何網路皆可直接開啟)
| 服務項目 | 正式網址 / 連結 | 說明 |
| :--- | :--- | :--- |
| **LINE 官方專用入口 (LIFF)** | [https://liff.line.me/2011709076-09FdfkjH](https://liff.line.me/2011709076-09FdfkjH) | **LINE 內直接全螢幕開啟，自動抓取暱稱** |
| **農友預約填單 (一般網頁)** | [https://xingnong-farm.pages.dev](https://xingnong-farm.pages.dev) | 一般手機/電腦瀏覽器直接開啟 |
| **服務申請管理 (幹部端)** | [https://xingnong-farm.pages.dev/?view=admin](https://xingnong-farm.pages.dev/?view=admin) | **站所幹部管理 (通行密碼：`20241718`)** |
| **後端 API 服務** | `https://line-bot-farm-api.chingfon-lee.workers.dev` | Cloudflare Workers API |

### 💻 本地端開發環境 (Local Dev)
| 服務項目 | 本機運行端點 | 說明 |
| :--- | :--- | :--- |
| **前端應用 (顧客端)** | `http://localhost:5173/` | 農友預約申請表單 |
| **前端應用 (管理端)** | `http://localhost:5173/?view=admin` | 幹部服務申請管理儀表板 (密碼：`20241718`) |
| **真機區域網路測試** | `http://192.168.16.215:5173/` | 同 Wi-Fi 實體手機瀏覽器測試 |
| **後端 API 伺服器** | `http://127.0.0.1:8787` | 本機 Worker API |

---

## 📋 下一步規劃待辦清單 (Backlog)

1. **正式上線安全升級（幹部 LINE 白名單驗證）**：客戶正式商轉上線後，將管理端身分驗證改為「限定特定幹部 LINE 帳號（依據 `line_user_id`）登入」，全面免除手動輸入密碼且具備最高防偽安全性。
2. **LINE 官方帳號圖文選單 (Rich Menu)**：在 LINE Official Account Manager 設定底部常駐選單按鈕，點擊直通 LIFF 預約。
3. **黑名單後台管理 UI**：在站所後台介面增加日曆或列表，讓幹部直接「點擊關閉/開啟某日」。
