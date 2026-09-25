# 更新日誌 (Changelog)

本專案遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/) 規範。

---

## [1.0.1] - 2026-09-24

### 🐛 錯誤修復與環境解耦 (Bug Fixes & Hardcoded Values Decoupling)

本版本主要解決開源化過程中所發現的環境綁定、跨域限制與寫死常數問題，確保任何團隊在全新 Cloudflare / LINE 帳號下皆能開箱即用。

#### 1. 前端 API 網址解耦與 DNS 報錯修復 (API Base URL Fallback)
- **問題**：`packages/frontend/src/config.ts` 原先預設 fallback 至 `line-bot-farm-api.your-subdomain.workers.dev`。若使用者部署前端時未設定 `VITE_API_BASE_URL`，瀏覽器發出 API 請求時會因域名不存在而拋出 `TypeError: Failed to fetch`。
- **修復**：改為 `(import.meta.env.VITE_API_BASE_URL as string) || ''`。未填寫時安全回退為同源相對路徑（`/api/...`），由 Cloudflare Pages Functions 自動反向代理至 Worker 後端。

#### 2. Pages Functions 反向代理路由衝突與例外防護
- **問題**：`packages/frontend/functions/api/` 目錄同時存在 `[[path]].ts` 與 `[[catchall]].ts` 兩份 Catch-all 路由檔，造成 Cloudflare Pages 建置衝突，且內部寫死無效網址。
- **修復**：
  - 移除冗餘衝突的 `[[path]].ts`。
  - 在 `[[catchall]].ts` 內增加 `context.env.BACKEND_API_URL` 檢查；若未配置後端變數，回傳結構化的 HTTP 502 JSON 診斷訊息，避免無日誌的靜態轉發崩潰。

#### 3. 後端 CORS 萬用字元支援 (CORS Wildcard Matching)
- **問題**：`packages/backend/src/index.ts` 原 CORS 正規表示式無法精準匹配開源者建立的 `https://*.pages.dev` 二級子網域，導致前端送出預約表單時觸發瀏覽器的跨來源資源共用（CORS）阻擋。
- **修復**：重構 `isOriginAllowed` 萬用字元解析演算法，支援 `*.pages.dev` 及逗號分隔的多來源清單，完整涵蓋 Cloudflare Pages 預覽環境與正式自訂網域。

#### 4. LINE LIFF ID 動態化與未配置防崩潰保護 (LIFF ID Decoupling & Guard)
- **問題**：
  - 後端 `line.ts` 內 5 款 Flex Message 卡片（服務申請通知、顧客確認單、歡迎指引、進度查詢等）的跳轉 URL 寫死原專案之特定 LIFF ID。
  - 前端 `ApplyForm.tsx` 與 `AdminDashboard.tsx` 預設 fallback 原作者 LIFF ID；若新開源者尚未申請或未填寫 `VITE_LIFF_ID`，前端呼叫 `liff.init()` 會引發未處理例外，導致頁面載入白屏。
- **修復**：
  - 後端所有 Flex Message 生成函數增加 `liffId?: string` 參數，全面動態讀取 Worker 環境變數 `c.env.LIFF_ID`。
  - 前端 fallback 清空，並在呼叫 `liff.init()` 前加入 `if (LIFF_ID)` 嚴格防護；若未設定 LIFF ID，登入時跳出友善提示，表單於一般瀏覽器中仍可正常操作與送單。

#### 5. 服務站所名稱與預設行政區解耦 (Station Name & District Decoupling)
- **問題**：
  - 後端推播卡片頁首、頁尾與前端 UI 標題多處寫死「🌱 行農合作社 · 高雄服務站」。
  - 後端資料庫寫入時，未填寫行政區預設寫入「燕巢區」，不符合其他縣市合作社之需求。
- **修復**：
  - 支援動態 `STATION_NAME`（後端）與 `VITE_STATION_NAME`（前端），未提供時退回中性預設「農業服務站」。
  - 移除預設「燕巢區」fallback，改為依據表單實際輸入內容儲存。

#### 6. LINE Flex 推播卡片突出顯示預約單號
- **問題**：農友送出需求後，站所幹部於 LINE 收到通知卡片時，首屏缺少顯眼的「申請單號」（例如 `REQ-20260924-XXXXX`），幹部在進行電話回訪與跨系統核對時極為不便。
- **修復**：重新設計 `generateFlexNotification` 卡片佈局，於頂部 Header 標頭以醒目綠色高亮呈現單號，並於內文明細區第一行置入等寬字體單號。

#### 7. 阻斷客戶 LINE UID 偽造漏洞 (Line User ID Forgery / IDOR Prevention)
- **問題**：原後端邏輯 `let verifiedLineUserId = body.line_user_id || null;` 會在未提供 `id_token` 時盲目信任前端傳送之 `body.line_user_id`。攻擊者若知曉特定目標的 LINE User ID，可偽造其 UID 送出垃圾預約，導致受害者遭到推播騷擾或在 LINE 查詢時出現偽造紀錄。
- **修復**：後端嚴格宣告 `let verifiedLineUserId = null;`，只有經過 LINE 官方 OAuth 驗簽之 `body.id_token` 解析成功後（`lineProfile.sub`）才予以綁定，徹底杜絕無 Token 偽造他人 UID。

#### 8. 防禦內部管理備註外洩 (Internal Memo Privacy Leakage Prevention)
- **問題**：管理端後台標註「站所內部備註（僅站所可見）」，但在農友透過 LINE 官方帳號點擊「查詢預約進度」時，後端原以 `SELECT *` 撈取資料，並在 `generateProgressQueryFlex()` 卡片中將 `latest.admin_memo` 以「站所內部回覆：...」直接輸出給農友。若站所人員在備註中紀錄內部敏感評估、款項糾紛或私人通訊細節，將引發重大隱私洩漏事故。
- **修復**：
  - 前端與推播卡片徹底拔除 `admin_memo` 的對外渲染，客戶進度卡片統一採用客製化之官方標準狀態指引（`statusNote`）。
  - 後端查詢資料庫時，以「嚴格欄位白名單投影（Column Projection Whitelist）」取代 `SELECT *`，主動阻絕未授權欄位滲漏至對外響應。

#### 9. Turnstile 雙軌防禦架構升級 (Smart Dual-Mode Fail-Closed Guard)
- **問題**：原後端驗證邏輯無條件放行 `XXXX.DUMMY.TOKEN.XXXX` 虛擬測試 Token，若使用者在正式生產環境未更換真實金鑰，會造成真人驗證存在「假防禦、真放行（Fail Open）」之漏洞。若強制拔除測試金鑰，又會導致新手初次部署時卡死於建立 Turnstile Widget。
- **修復**：實施智慧雙軌防禦（Smart Dual-Mode）：
  - **Starter 體驗軌道**：保留官方測試金鑰（`1x...`），讓新手初次架設與體驗維持 0 門檻開箱即測，並於後端日誌輸出明確安全提醒。
  - **Production 生產加固軌道**：一旦管理者配置真實 Turnstile 密鑰（非 `1x...` 測試前綴），系統自動鎖定為 **Fail-Closed 鋼鐵防禦**，全面拒絕任何虛擬測試 Token，強制走 Cloudflare 官方 `siteverify` 密碼學核驗，驗證未過或連線異常一律 403 阻擋。

#### 10. LINE Webhook 嚴格防偽驗簽 (Strict Fail-Closed Webhook Verification)
- **問題**：原後端在未配置 `LINE_CHANNEL_SECRET` 時僅以 warning 警告並放行請求（Fail Open），攻擊者可直接偽造 Webhook 事件冒充管理幹部觸發後台指令，或偽造進度查詢。
- **修復**：後端全面落實 Fail-Closed 安全標準：
  - 未配置 `LINE_CHANNEL_SECRET` ➔ 拒絕處理並回傳 HTTP 503 Configuration Error。
  - 缺少 `x-line-signature` 標頭 ➔ 拒絕處理並回傳 HTTP 401 Unauthorized。
  - HMAC-SHA256 簽名不符 ➔ 拒絕處理並回傳 HTTP 401 Unauthorized。
  - 同步更新 `wrangler.toml.example` 與部署指南，正式將 Channel Secret 標記為必備安全密鑰。

#### 11. LINE 管理員 Token 快取壽命精確化 (Strict Token Expiry Alignment)
- **問題**：原後端管理快取固定為 30 分鐘，忽視了 LINE Verify API 官方回傳的真實 `exp`，可能在 Token 已在 LINE 端過期後仍被快取誤認有效。
- **修復**：
  - `verifyLineIdToken` 完整解析並回傳官方 `exp`（UNIX 秒數）。
  - 快取時間嚴格取 `Math.min(lineExp, now + 10 分鐘)`，絕不超過 LINE 官方壽命，且本地快取不超過 10 分鐘以維持時效性。
  - 加入過期快取自動清理機制。

#### 12. 架構收斂、日誌隱私脫敏與診斷端點防護 (Architecture Cleanup & PII Privacy Hardening)
- **問題**：
  - 前端 Functions 同時存在 `[[path]].ts` 與 `[[catchall]].ts`，前者寫死特定網址且造成路由歧義。
  - CORS 設定未與 `ALLOWED_ORIGINS` 聯動，即使管理者配置特定網域，系統仍會無差別 fallback 放行所有 `*.pages.dev`。
  - `/api/admin/debug/test-card` 診斷端點在推播測試卡片時，回傳資料包含 `latestRecord` 完整物件與 `SELECT *` 內部資訊。
  - 日誌輸出包含使用者訊息內容、LINE UID 與 replyToken，存在個資洩漏風險。
- **修復**：
  - **移除衝突代理**：徹底刪除冗餘的 `[[path]].ts`，全面統一由 `[[catchall]].ts` 讀取 `BACKEND_API_URL` 代理。
  - **CORS 雙層防護**：若管理者配置 `ALLOWED_ORIGINS`，嚴格限制僅允許白名單網域通過；未配置時自動維持相容所有 `*.pages.dev`，確保新手安裝體驗 0 摩擦。
  - **診斷端點安全收斂**：移除 `/api/admin/debug/test-card` 的 `latestRecord` 資料實體回傳，查詢改採安全欄位投影白名單，阻絕內部欄位外洩。
#### 13. Request Body 限制、欄位繞過修補、高熵單號與伺服器錯誤防洩漏 (Body Limit, Validation Guard, High Entropy ID & Safe Errors)
- **問題**：
  - `/api/requests` 在驗證前讀入完整 HTTP Body，無大小限制，易遭超大 JSON 消耗 Worker 記憶體。
  - `locationStr` 檢核存在繞過漏洞：送出假 `location` 可繞過 200 字限制，但後端寫入未限制之 `location_address`；同理 `body.area_size` 可被攻擊者自訂超長文字塞入資料庫。
  - 訂單後綴僅 5 碼 Hex（約 100 萬種組合），並非真正高熵。
  - 後端 API 拋出未捕獲例外或資料庫錯誤時，直接將 `error.message` 回傳給前端，存在資料表結構與內部 SQL 外洩風險。
  - 前端 `_redirects` 包含寫死 Worker 網址的 `/api/*` 規則，與 Pages Functions 重疊造成維護困惑。
- **修復**：
  - **引入 Hono `bodyLimit` 中介軟體**：`/api/requests` 嚴格限制 Payload 上限為 32 KB，超出直接 HTTP 413 阻擋，保護 Worker 運算與記憶體資源。
  - **修補欄位驗證繞過**：
    - 直接檢驗 `body.location_address`（上限 200 字）與 `body.location_area`（上限 30 字），杜絕假欄位繞過。
    - 徹底捨棄未信任之 `body.area_size`，改由檢核過之 `area_value` 與 `area_unit` 伺服器端動態計算拼裝。
  - **單號升級真高熵（10 碼 Hex）**：單號隨機尾碼擴增為 10 碼（$16^{10} \approx 1.1$ 兆種排列），徹底杜絕併發碰撞。
  - **內部錯誤全面脫敏**：全域與各端點 500 捕捉錯誤時，僅在內部輸出伺服器日誌，對外統一回傳友善安全訊息，防止 SQL/D1 內部結構洩漏。
  - **收斂 `_redirects` 與刪除衝突代理**：使用 PowerShell `-LiteralPath` 徹底刪除實體檔案 `[[path]].ts`，並清理 `_redirects` 僅保留 SPA 路由規則。
#### 14. AI Agent 驅動之 Cloudflare Turnstile 零接觸自動化配置 (Zero-Touch Turnstile Automation by Agent)
- **問題**：原正式商轉需引導新手手動登入 Cloudflare Web 控制台、建立 Turnstile Widget、手動複製 Site Key 與 Secret Key 至程式碼與後台，流程繁複且容易出錯。
- **修復**：
  - **升級 Wrangler 核心工具鏈**：後端升級至原生支援 Turnstile CLI 管理之最新版本（Wrangler 4.139+）。
  - **新增自動化配置腳本 (`npm run setup:turnstile`)**：透過 Cloudflare 官方 API / CLI 原生呼叫 `wrangler turnstile widget create`，全自動建立 Managed 模式 Widget、提取金鑰、更新前端 `.env`、更新後端密鑰，並自動觸發前端與後端之重新編譯與發布。
  - **全面導入 Agent 一鍵升級指示**：於 `DEPLOYMENT_GUIDE.md` 與 `BEGINNER_GUIDE.md` 制定零摩擦升級規範。使用者僅需對 Agent 發出「我測試完成了，請幫我啟用正式 Turnstile 防護」自然語言指令，即可由 Agent 完成生產環境 Fail-Closed 密碼學鋼鐵防護之切換。

---

## [1.0.0] - 2026-09-24

### 🎉 初始開源發布 (Initial Open Source Release)
- **純無伺服器架構**：Cloudflare Workers + D1 (SQLite) + Cloudflare Pages + LINE Messaging API / LIFF。
- **Zero-Password 幹部白名單原生鑑權**：管理後台使用 LINE 官方 ID Token 驗證，免除靜態密碼外洩與撞庫風險。
- **LINE Webhook 密碼學防偽驗簽**：採用 Web Crypto API 進行 HMAC-SHA256 驗簽。
- **Cloudflare Turnstile 無感真人驗證**：後端嚴格核驗，防禦自動化腳本刷單與推播配額消耗。
- **去識別化導出腳本**：提供 `npm run export:opensource` 建立乾淨無金鑰紀錄之公開開源版本。
