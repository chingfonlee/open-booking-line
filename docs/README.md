# docs/ — open-booking-line 技術文件

本目錄包含 open-booking-line 的所有技術文件。

## 文件結構

```
docs/
├── README.md           ← 本文件（文件目錄）
├── architecture.md     ← 系統架構說明
├── installation.md     ← 安裝與設定指南
├── deployment.md       ← 部署說明
├── customization.md    ← 客製化指南（三層架構）
├── database.md         ← 資料庫 Schema 與 Migration
│
├── line/
│   ├── liff.md         ← LINE LIFF 整合說明
│   ├── rich-menu.md    ← Rich Menu 規範、通用情境與 AI 產圖指南
│   └── messaging-api.md ← LINE Messaging API 說明
│
└── tutorials/
    └── README.md       ← 教學文件目錄
```

## 快速導覽

| 目標 | 推薦閱讀 |
| :--- | :--- |
| 了解系統架構 | [architecture.md](architecture.md) |
| 第一次安裝 | [installation.md](installation.md) |
| 部署到 Cloudflare | [deployment.md](deployment.md) |
| 客製化系統 | [customization.md](customization.md) |
| 了解資料庫結構 | [database.md](database.md) |
| LINE LIFF 設定 | [line/liff.md](line/liff.md) |
| LINE Rich Menu 入口設計 | [line/rich-menu.md](line/rich-menu.md) |
| LINE Messaging API | [line/messaging-api.md](line/messaging-api.md) |

## 文件狀態說明

- ✅ **完成** — 已完整撰寫並與程式碼同步
- 🔄 **更新中** — 需要更新以符合最新程式碼
- 🔵 **Planned** — 計畫中，尚未撰寫

> 📖 更完整的新手部署指南請參閱根目錄的 [BEGINNER_GUIDE.md](../BEGINNER_GUIDE.md)
