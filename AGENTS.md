# 🤖 AGENTS.md — AI Agent 協同規範與進入點指南

> **To AI Agents (Claude Code, Cursor, Codex, Antigravity, etc.)**:  
> You are collaborating with a human engineer on this repository. Before inspecting, modifying, or creating code/architecture in this codebase, **you must read and strictly adhere to the following rules**:

---

## 📋 10 條不可妥協的核心準則 (Top 10 Agent Guidelines)

1. **先讀規範再動工 (Read Before Modifying)**：
   - 進行任何架構或功能修改前，優先閱讀 [`DEVELOPMENT_SOP.md`](DEVELOPMENT_SOP.md) 與 [`SECURITY_BASELINE.md`](SECURITY_BASELINE.md)。
   - 針對本專案特定技術實作，參閱 [`SECURITY_PROFILE.md`](SECURITY_PROFILE.md) 與 [`ARCHITECTURE.md`](ARCHITECTURE.md)。
2. **絕不私自降級安全基線 (Never Weaken Security Baselines)**：
   - 未經人類明確許可，不得為求「跑通測試」或「快速部署」而關閉安全檢查、將 Fail-Closed 改為 Fail-Open、放寬 CORS 或繞過驗簽。
3. **零磁碟憑證託管與無對話洩漏 (Zero-Disk & Zero-Prompt Secrets)**：
   - 任何 API Key、Secret、Token **嚴禁寫入 Git 追蹤檔案、本機 `.env`、配置檔、或記錄在日誌中**。
   - **嚴禁要求使用者在 AI 對話/Prompt 中張貼真實敏感金鑰**。需要注入憑證時，應啟動 CLI 原生安全輸入管道（如 `wrangler secret put`），引導使用者直接在終端機輸入，連 AI 都無須知曉密碼。
4. **伺服器端強制身分與鑑權 (Server-Enforced Auth)**：
   - 永遠不信任客戶端（前端、LIFF、App）傳入的使用者 ID 或身分旗標。身分必須源自伺服器端密碼學驗證（如驗證官方核發之 ID Token），權限必須在 Server 端強制校驗。
5. **所有外部輸入強制校驗 (Validate All External Inputs)**：
   - 客戶端傳入之所有欄位必須在伺服器端執行嚴格的型別、長度、邊界防呆與 Payload 體積上限限制。
6. **區分關鍵驗證與非關鍵副作用之失效模式 (Fail-Closed vs Safe Degradation)**：
   - **資安與身分關鍵依賴（Auth、Turnstile、Webhook 驗簽）**：外部異常時必須 **Fail-Closed（安全阻斷）**。
   - **非關鍵副作用（推播通知、信件發送、分析日誌）**：異常時必須 **安全降級（Degrade Safely）**，不應中斷已成功的主要交易，並提供重試/記錄機制。
7. **全方位冪等性設計 (Dual-Layer Idempotency)**：
   - **基礎設施冪等 (Infrastructure)**：部署與設定腳本重跑時必須自動 Reuse/Update，絕不產生重複孤兒資源。
   - **商業邏輯冪等 (Business)**：寫入與更新 API 必須設計防重放機制（如 Unique Key、Idempotency Key），不能僅依賴前端按鈕 Disable。
8. **正確認知 CORS 與 API 安全 (CORS is NOT API Security)**：
   - 牢記 CORS 僅為**瀏覽器同源隔離機制**，無法防禦 curl、Postman 或惡意爬蟲。真正的 API 安全性必須建立在 Token 鑑權、限流與真人檢核上。
9. **接入新外部服務必須雙模型審查 (Threat & Failure Model Review)**：
   - 每當引入新的第三方 API、SDK 或 Webhook，必須與人類工程師主動審查：
     - *Threat Model*：有人惡意偽造或爆破此接口時怎麼辦？
     - *Failure Model*：第三方回傳 500、連線逾時、格式變更或重試時怎麼辦？
10. **上線前維護驗收測試清單 (Maintain Acceptance Tests)**：
    - 在宣稱功能完成或發布前，必須對照並更新 [`ACCEPTANCE_TESTS.md`](ACCEPTANCE_TESTS.md)，確保各項端對端（E2E）情境與邊界測試皆已落實。
