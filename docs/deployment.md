# Deployment — 部署說明

> 本文件說明部署流程的詳細步驟。
> 完整的新手部署流程請參閱 [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)。

---

## 部署架構

```
前端：Cloudflare Pages
後端：Cloudflare Workers
資料庫：Cloudflare D1
代理：Cloudflare Pages Functions
```

---

## 後端部署（Cloudflare Workers）

```bash
cd packages/backend

# 確認 wrangler.toml 設定正確
npx wrangler deploy

# 部署後確認
curl https://your-worker.workers.dev/api/health
```

## 前端部署（Cloudflare Pages）

```bash
cd packages/frontend

# Build
npm run build

# 部署（首次建立專案）
npx wrangler pages deploy dist --project-name your-project-name

# 之後的更新
npx wrangler pages deploy dist
```

## 環境變數設定

在 Cloudflare Pages 後台設定前端環境變數：
- `VITE_LIFF_ID`
- `VITE_STATION_NAME`
- `VITE_TURNSTILE_SITE_KEY`（可選）

---

## 🔵 Planned（計畫中）

> 以下內容將在未來 Episodes 中補充：

- GitHub Actions CI/CD 自動部署設定
- 預覽環境（Preview Deployment）配置
- 多環境（staging / production）管理
- D1 Migration 流程說明

---

> 完整的安裝與部署流程請參閱：
> - [BEGINNER_GUIDE.md](../BEGINNER_GUIDE.md) — 新手零門檻指南
> - [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) — 完整技術部署手冊
