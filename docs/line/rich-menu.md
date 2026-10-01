# LINE Rich Menu（圖文選單）通用架構與設計指南

> 本文件說明 `open-booking-line` 如何透過 LINE Rich Menu 建立系統的「入口層（Navigation Layer）」，並針對不同產業與預約情境提供版型規範與 AI 產圖提示詞（Prompt）。

---

## 🧭 一、 核心心智模型

> **「Rich Menu = 圖片 ＋ 點擊區域 ＋ 點下去要做什麼（Action）」**

LINE Rich Menu 是使用者進入官方帳號的第一門面。在預約系統中，它將 LINE 官方帳號化身為**免下載、免安裝的輕量級行動 App**：

```
LINE Official Account
        │
        ▼
   Rich Menu（系統入口層）
   ┌────────────────────────────────────────┐
   │ 📅 主要行動區（例：線上預約）           │ ➔ 開啟 LIFF ApplyForm
   │ 🔍 狀態查詢區（例：查詢進度）           │ ➔ 觸發 Webhook 回傳進度卡片
   │ ℹ️ 資訊輔助區（例：聯絡站所 / 價目表）   │ ➔ 撥打電話、開啟說明頁或管理後台
   └────────────────────────────────────────┘
```

---

## 📐 二、 官方尺寸規範與情境選擇指南

LINE 官方支援兩種標準版型比例。由於現代手機螢幕皆為 Retina 高解析度，**強烈建議一律採用 2500px 寬度的最高解析度製作**，避免在手機端產生縮放鋸齒與毛邊：

| 版型類型 | 官方推薦尺寸 | 寬高比例 | 格數建議 | 適用情境 |
| :--- | :--- | :--- | :--- | :--- |
| **大型版型（雙排 / 大版）** | **`2500 × 1686 px`** | 約 **1.48 : 1**（接近 3:2） | 3 ～ 6 格 | **預約/工具型服務（強烈推薦）**。主次分明，適合將官方帳號當作 App 首頁。 |
| **小型版型（單排 / 矮版）** | **`2500 × 843 px`** | 約 **2.97 : 1**（高為大版的一半） | 1 ～ 3 格 | **諮詢/客服對話型服務**。高度僅佔螢幕約 1/5，不會遮擋上方對話紀錄。 |

> ⚠️ **上傳限制**：
> 1. 檔案格式：`JPG` 或 `PNG`。
> 2. 檔案大小限制：**1 MB 以下**（超過將無法上傳，若 PNG 過大請壓縮或轉存為高品質 JPG）。

## 🤖 三、 AI-Native 一鍵自動生成：使用內建 Rich Menu Skill

本開源專案已內建完整的 **Rich Menu AI Skill**（位於 `.agent/skills/rich-menu/SKILL.md`）。

只要將本專案 Clone 或 Fork 到支援 AI Agent 的開發環境（如 Google Antigravity、Claude Code、Cursor 等），**您不需要懂圖片尺寸、切格線或寫代碼**，只需將下方這組「黃金提示詞（Golden Prompt）」複製並發送給您的 Agent，Agent 即會自動為您的行業生成專屬圖檔並輸出綁定表：

> ### 📋 一鍵複製給 Agent 的提示詞：
> ```text
> 請根據我的產業【請在此填寫您的行業與店名，例如：晴空美甲美睫工作室 / 阿德冷氣水電行 / 幸福心理諮商所】，
> 調用專案中內建的 rich-menu skill，為我客製化設計專屬的 LINE Rich Menu 圖文選單，
> 並直接生成標準尺寸圖片（存入專案目錄）與提供 LINE 官方後台設定對照表。
> ```

---

## 🏢 四、 五大通用預約情境、版型規劃與 AI 產圖提示詞

本專案長期定位為「通用預約系統開源模板」。以下針對 5 大典型預約情境，提供對應的**版型規劃**與**AI Agent 產圖提示詞（Prompt）**。如果您需要手動產圖或客製微調，可直接參考以下規格：

---

### 情境 1：農業代耕與農機租借（在地資源共享型）

* **建議版型**：大型版型 `2500 × 1686 px`（版型：左 1 大、右 2 小）
* **按鈕設計**：
  - 左大格 (50% 寬)：**線上預約**（開啟 LIFF 表單）
  - 右上格 (25% 面積)：**查詢進度**（文字：`查詢預約`）
  - 右下格 (25% 面積)：**站所聯絡**（撥打電話 或 開啟管理後台）
* **視覺風格**：大地綠 (`#173820`)、米色底、粗體大字、發芽農作物與日曆插圖。

```text
[AI 產圖提示詞 - 情境 1 農業服務]
A professional modern LINE Rich Menu interface UI graphic, 3:2 aspect ratio (2500x1686 px layout), designed for agricultural machinery rental and farm service booking.
Divided into three distinct functional clickable zones with crisp card borders:
1. Left large block (taking up 50% width): Prominent bold text "線上預約" with an illustration of a calendar and growing green sprout, deep forest green (#173820) primary button theme.
2. Top-right block (50% width, top half): Text "查詢進度" with a magnifying glass and checklist clipboard icon, soft olive green tone.
3. Bottom-right block (50% width, bottom half): Text "站所聯絡" with a telephone receiver and gear setting icon, warm cream neutral background (#f8f3e7).
Flat modern vector illustration, bold high-contrast traditional Chinese typography, clear separation grid for LINE OA touch regions, zero clutter, clean mobile UI asset.
```

---

### 情境 2：美容沙龍 / 美甲美睫 / 芳療美髮（個人精緻服務型）

* **建議版型**：大型版型 `2500 × 1686 px`（版型：左 1 大、右 2 小 或 下三上一）
* **按鈕設計**：
  - 左大格 (50% 寬)：**立即預約**（開啟 LIFF 預約設計師/美甲師）
  - 右上格 (25% 面積)：**預約查詢**（文字：`查詢預約`）
  - 右下格 (25% 面積)：**作品價目**（開啟外部作品集/官網或傳送價目卡片）
* **視覺風格**：莫蘭迪粉米色、極簡線條花草、溫潤典雅、高級感字體。

```text
[AI 產圖提示詞 - 情境 2 美容美甲]
A minimalist aesthetic LINE Rich Menu UI graphic, 3:2 aspect ratio, designed for a luxury beauty salon and nail art studio appointment system.
Divided into 3 distinct card zones:
1. Left large section (50% width): Elegant bold traditional Chinese text "立即預約" with a delicate flower petal and clock calendar icon, warm terracotta or dusty rose accent theme.
2. Top-right section (top half): Text "預約查詢" with a minimalist checkmark agenda icon, soft blush cream background.
3. Bottom-right section (bottom half): Text "作品價目" with a price-tag and sparkle beauty icon, soft neutral champagne beige background.
Clean aesthetic flat UI kit, elegant layout, gentle pastel tones, high-contrast readable Chinese characters, modern salon branding, no photographic clutter.
```

---

### 情境 3：居家修繕 / 冷氣水電 / 專業清潔（急迫派工與叫修型）

* **建議版型**：大型版型 `2500 × 1686 px`（版型：左 1 大、右 2 小）
* **按鈕設計**：
  - 左大格 (50% 寬)：**線上叫修派工**（開啟 LIFF 填寫地址、故障描述）
  - 右上格 (25% 面積)：**進度查詢**（文字：`查詢進度`）
  - 右下格 (25% 面積)：**緊急通話**（動作：撥打電話 `tel:09xxxxxxxx`）
* **視覺風格**：工程深藍搭警示亮橘/明黃、扳手與水滴插圖、超大醒目字體。

```text
[AI 產圖提示詞 - 情境 3 居家水電叫修]
A professional high-efficiency LINE Rich Menu UI graphic, 3:2 aspect ratio, tailored for home repair, plumbing, and air conditioner maintenance services.
Divided into 3 clear touch areas:
1. Left large block (50% width): Highly visible bold text "線上叫修" with a wrench tool and home checkmark illustration, industrial safety blue and safety orange primary theme.
2. Top-right block (top half): Text "維修進度" with a status tracking clock icon, clean cool gray background.
3. Bottom-right block (bottom half): Text "緊急來電" with a bold telephone handset icon and alert badge, bright amber/yellow button style for urgent contact.
High contrast flat vector design, ultra-legible Chinese signage, intuitive utility UI, sharp borders aligning with LINE touch grid.
```

---

### 情境 4：一對一專業顧問 / 法律諮詢 / 心理諮商 / 教練預約（高隱私對話型）

* **建議版型**：**小型版型（單排矮版）`2500 × 843 px`**（版型：水平三等分）
* **按鈕設計**：
  - 左格 (33.3% 寬)：**預約諮詢**（開啟 LIFF 選時段）
  - 中格 (33.3% 寬)：**服務介紹**（查看專業經歷與諮詢收費標準）
  - 右格 (33.3% 寬)：**專人對談**（文字：`轉接顧問`）
* **為什麼選小型？** 諮詢業需要頻繁在聊天室打字對談，小型選單高度只有一半，不會遮擋隱私諮詢對話。
* **視覺風格**：深海藍（`#0f172a`）、極簡白、沉穩專業信任感。

```text
[AI 產圖提示詞 - 情境 4 專業顧問諮詢 (小型單排)]
A sleek modern horizontal LINE Rich Menu bar UI graphic, compact banner 2.97:1 aspect ratio (2500x843 px format), for legal, mental counseling, or professional consultation services.
Clean horizontal layout divided into 3 equal columns:
1. Column 1 (left): Bold text "預約諮詢" with an elegant fountain pen and calendar icon, deep navy blue (#0f172a) theme.
2. Column 2 (center): Text "專業介紹" with a diploma/briefcase icon, crisp slate blue-gray tone.
3. Column 3 (right): Text "專人對話" with twin message chat bubbles icon, welcoming subtle teal accent.
Minimalist executive aesthetic, compact mobile navigation toolbar, perfectly balanced 3-column grid, razor-sharp typography in Traditional Chinese, unobtrusive height.
```

---

### 情境 5：活動場地 / 攝影棚 / 運動球場租借（檔期時段型）

* **建議版型**：大型版型 `2500 × 1686 px`（版型：左 1 大、右 2 小 或 上下各 2 格）
* **按鈕設計**：
  - 左大格 (50% 寬)：**立即預約檔期**（開啟 LIFF 查看空檔並預訂）
  - 右上格 (25% 面積)：**場地規格 / 設備**（開啟環境與燈光器材說明）
  - 右下格 (25% 面積)：**交通與收費**（查看地圖導航與收費須知）
* **視覺風格**：時尚幾何感、相機/聚光燈/球拍圖標、活力明亮色系。

```text
[AI 產圖提示詞 - 情境 5 場地攝影棚租借]
A trendy modern creative LINE Rich Menu graphic, 3:2 aspect ratio, designed for photo studio rental, event space, and sports arena booking.
Split into 3 clean card areas:
1. Left large block (50% width): Bold vibrant text "預約檔期" with an isometric studio spotlight and timetable icon, modern indigo/violet gradient card.
2. Top-right block (top half): Text "空間設備" with a camera and lighting gear icon, clean neutral white card.
3. Bottom-right block (bottom half): Text "收費與交通" with a location pin and price tag icon, pastel gray background.
Contemporary flat design, spacious padding, bold Traditional Chinese lettering, sharp division lines, mobile app launchpad feel.
```

---

## 🛠️ 四、 LINE 官方後台（OA Manager）綁定設定步驟

製作好圖片後，只需 3 分鐘即可在官方後台啟用：

1. **登入後台**：前往 [LINE Official Account Manager](https://manager.line.biz/)，點入您的官方帳號。
2. **新增圖文選單**：左側選單點選 **「聊天室管理」➔「圖文選單」➔ 點擊「建立」**。
3. **選擇版型**：
   - 根據圖片選擇「大型（左 1 大、右 2 小）」或「小型（單排 3 格）」。
4. **上傳背景圖**：上傳符合規格之圖片（系統會自動對齊網格）。
5. **設定動作（Action）**：
   - **線上預約**：類型選 `連結 (URI)` ➔ 填入 `https://liff.line.me/{VITE_LIFF_ID}`
   - **查詢進度**：類型選 `文字 (Text)` ➔ 填入 `查詢預約`（觸發 Workers Webhook）
   - **聯絡電話**：類型選 `文字` 傳送電話號碼，或填寫 `tel:09xxxxxxxx` 連結
6. **設定顯示期間與預設狀態**：
   - 將狀態設為 **「顯示」**，期間設定為長期（例如 5 年），並設定選單選單列顯示文字（如「🌱 點此開啟服務選單」）。
7. **儲存並發布**：回到手機 LINE 打開官方帳號，即可立即看到全新的系統入口！
