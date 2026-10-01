# Architecture Decision Records (ADR) — Episode 02

> 本文件記錄 Episode 02 開發期間確立之重大架構、技術選型與邊界決策。  
> 任何接續任務的 Agent 若對架構設計有疑問，以此文件之決策為準，無需重新爭辯或推翻。

---

## ADR-EP02-001: 2500×1686 作為 Large Rich Menu 標準畫布尺寸

* **狀態**：Accepted
* **背景**：LINE Messaging API 官方支援多種圖文選單尺寸（例如 2500×1686、1200×810、800×540、2500×843 等）。
* **決策**：在 Ep02 中，一律採用 **2500 × 1686** 作為標準 Large Menu 幾何標準畫布。
* **理由**：
  1. 2500×1686 為 LINE 官方最大解析度規格，能確保在現代高解析度智慧型手機（Retina/AMOLED）上呈現清晰之字體與圖標。
  2. 統一固定畫布尺寸可使 Spec Builder 與 Renderer 之幾何座標計算具備 100% 確定性（Deterministic），消除跨解析度換算之浮點誤差與邊界外溢。

---

## ADR-EP02-002: AI 生圖 (AI Visual Generation) 不屬於 Ep02 完工條件

* **狀態**：Accepted
* **背景**：部分圖文選單設計會考慮呼叫外部生圖模型（如 Imagen、DALL-E）產生動態背景插圖。
* **決策**：Ep02 的標準渲染管線採用本地確定性幾何 + SVG/Canvas 渲染，**不將外部 AI 生圖列為完工依賴**。
* **理由**：
  1. 避免專案依賴昂貴、有配額限制或需要額外 API Key 之第三方圖像服務。
  2. 確保任何使用者在離線或全新環境下，皆可 100% 重複產出符合規格之標準選單。自訂品牌背景圖片可透過本地資產抽換機制提供。

---

## ADR-EP02-003: 嚴格 Multi-Agent 任務邊界與檔案交接機制

* **狀態**：Accepted
* **背景**：大型任務若一次性交由單一 Agent 生成，容易出現上下文遺忘、未經測試即提前宣稱完成，或擴大實作範圍等問題。
* **決策**：將 Ep02 劃分為 6 個獨立垂直切片（Task 0~5），每個 Task 僅能由當前 Agent 讀取專屬合約檔案（`tasks/XX-*.md`）執行。
* **理由**：
  1. 知識留存在 Repository 控制文件（`STATUS.md`、`DECISIONS.md`、測試產物）而非暫態對話記憶。
  2. 任何模型（Claude、Codex、Antigravity 等）皆可在中途無縫接手，只要讀取狀態機與合約即可立即精確上工。

---

## ADR-EP02-004: 人類明確授權門禁 (Approval Gate) 為發布必要條件

* **狀態**：Accepted
* **背景**：Rich Menu 發布至 LINE 官方帳號屬於面向全體使用者的對外變更，若程式自動未經審核即推播發布，可能造成非預期版面或死連結。
* **決策**：在發布（Task 4）前，必須經過 Task 3 產出視覺預覽，並經人類審核後產生 `.booking/rich-menu/approval.json`（記錄 `specHash`、`imageHash`、`approvedAt`）。
* **理由**：
  1. Publisher 啟動前強制校驗 Hash，若未經授權或規格於審核後遭改動，Publisher 必須直接拒絕執行（Fail-Closed）。
  2. 確保人類掌控對外品牌形象與連結正確性。

---

## ADR-EP02-005: Safe Publisher 必須具備三情境完整 Rollback 復原能力

* **狀態**：Accepted
* **背景**：更換官方帳號預設選單可能覆蓋原先既有之選單，若新選單有誤，需能精準復原。
* **決策**：Task 4 在設定新預設選單前，必須先記錄當前狀態至本地 `.booking/rich-menu/managed.json`，並具備還原腳本能處理以下三種情境：
  1. **情境 A（原為 API 預設選單）**：回滾綁定原先之舊 `oldDefaultMenuId`。
  2. **情境 B（原為 OA Manager 後台手動選單）**：解除 API 預設綁定，讓 LINE 官方權限自然降回後台手動選單。
  3. **情境 C（原無任何選單）**：解除 API 預設綁定，還原為乾淨無選單聊天室。
* **理由**：保障任何既有官方帳號的營運安全，具備 100% 可逆性。

---

## ADR-EP02-006: 本地確定性向量 SVG + Sharp 點陣化渲染引擎

* **狀態**：Accepted
* **背景**：需要將 `menu-spec` 規格確定性轉換為合規之高解析度圖檔（2500×1686、$\le 1\text{ MB}$、繁體中文無缺字），且不依賴外部連網生圖 API 或笨重之 Headless 瀏覽器（如 Puppeteer）。
* **決策**：採用 Node.js 原生建構語意化 SVG 向量模板，搭配既有之 `sharp`（整合 Cairo / Pango / librsvg）進行本地點陣化 PNG/JPEG 輸出。
* **理由**：
  1. `sharp` 具備高效能 C++ / librsvg 原生引擎，文字與圖形抗鋸齒渲染品質優異。
  2. 繁體中文字型回退棧：優先採用系統 `Noto Sans TC`、`Microsoft JhengHei`、`PingFang TC` 等主流高品質字體。
  3. 純向量幾何搭配 Sharp 壓縮，輸出之 2500×1686 PNG 檔案大小通常僅在 100~300 KB，遠低於 LINE 官方 1 MB 限制，同時維持 100% 無失真清晰度與執行確定性。

