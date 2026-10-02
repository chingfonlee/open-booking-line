# Episode 03: Database Recovery & Disaster Procedures (資料庫復原與災難復原指引)

> 本文件定義 Episode 03 (Availability & Confirmation Scheduling) 之資料庫遷移前後、驗證失敗及線上異常時之標準處置程序 (SOP)。  
> 任何維運人員或 Agent 必須依據具體情境選擇復原途徑，**嚴禁在已有正式營運排程資料時粗暴執行刪表**。

---

## 一、遷移前強制備份程序 (Pre-Migration Cold Backup)

在獲得人類授權、準備對線上正式 D1 (`xingnong-db`) 執行 `0002_ep03_availability_schema.sql` 之前，**必須**先執行全庫匯出備份：

```bash
# 1. 建立具有時間戳記之線上冷備份檔 (儲存於不受 git 追蹤之安全目錄)
npx wrangler d1 export xingnong-db --remote --output .booking/backups/xingnong-db-backup-$(date +%Y%m%d%H%M%S).sql
```

驗證備份檔案大小大於 0 位元組，方可繼續執行 Migration。

---

## 二、情境 A：部署驗證失敗 (尚未產生正式營運資料)

* **適用條件**：
  - Migration 剛套用至 D1（不論是測試環境或線上環境）。
  - 尚未開始讓合作社正式確認新排程，`slot_reservations` 表中資料筆數為 0。
  - 驗收測試或健康檢查失敗，需要立即撤銷本次遷移。

* **操作程序**：
  使用隔離於 `packages/backend/scripts/recovery/` 之回滾腳本：

  ```bash
  npx wrangler d1 execute xingnong-db --remote --file packages/backend/scripts/recovery/0002_rollback_ep03.sql
  ```

* **驗證步驟**：
  執行查詢確認新結構已安全清除，且舊有 `service_requests` 與 `blocked_dates` 完整留存：

  ```bash
  npx wrangler d1 execute xingnong-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
  ```
  預期結果：包含 `service_requests` 與 `blocked_dates`，不包含 `slot_reservations`、`availability_rules`、`availability_config`、`availability_exceptions`。

---

## 三、情境 B：生產事故復原 (已有正式營運排程資料)

* **適用條件**：
  - Ep03 已上線運作，`slot_reservations` 中已有真實農友與合作社電話敲定的排程。
  - 系統遭遇邏輯異常、效能問題或前端故障。

* **嚴重警告 (Strict Prohibition)**：
  > ❌ **嚴禁執行 `0002_rollback_ep03.sql` 或任何 `DROP TABLE slot_reservations` 命令！**  
  > 刪除資料表將直接銷毀農友確認排程與工班行程，造成無法挽回的營業損失！

* **處置程序 (雙軌安全降級 SOP)**：

  ### 步驟 1：無損軟降級 (Soft Degradation)
  若可用性引擎計算異常，透過系統設定將模式即刻切換為 `legacy` 模式，解除複雜規則限制，但保留預約記錄不被破壞：

  ```bash
  npx wrangler d1 execute xingnong-db --remote --command "UPDATE availability_config SET value = 'legacy', updated_at = datetime('now') WHERE key = 'mode';"
  ```

  ### 步驟 2：排程資料保全匯出 (Data Evacuation)
  在進行任何修復前，先行匯出所有 active 與 released 的 reservation 記錄：

  ```bash
  npx wrangler d1 execute xingnong-db --remote --command "SELECT * FROM slot_reservations;" --json > .booking/backups/slot_reservations_rescue.json
  ```

  ### 步驟 3：修復補丁 (Fix-Forward)
  編寫針對性修復腳本（Fix-Forward Migration），而非刪表重來。
