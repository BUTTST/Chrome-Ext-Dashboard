---
name: Project Overview & Architecture
description: Chrome 擴充功能管理器的專案全局概覽，包含檔案結構、技術棧、模組分區與命名規範。
---

# 📁 Skill 01：專案全局概覽與架構

## 1. 專案簡介

**Chrome 擴充功能管理器** 是一個基於 Manifest V3 的 Chrome Extension，用來管理瀏覽器中已安裝的擴充功能。提供群組分類、快照還原、批量操作、拖放排序、匯入匯出等功能。

- **儲存庫**：`https://github.com/BUTTST/Chrome-Ext-Dashboard.git`
- **授權**：MIT License
- **當前版本**：v2.1.1（Git）/ 1.0.0（manifest.json，需同步更新）
- **技術棧**：純原生 HTML + JavaScript + CSS，無框架依賴

---

## 2. 目錄結構

```
Chrome-Ext-Dashboard-main/
├── extension/                     # ← Chrome 載入的根目錄
│   ├── manifest.json              # Manifest V3 配置
│   ├── background.js              # Service Worker（346 行）
│   ├── popup.html + popup.js      # 快速彈窗（238 + 275 行）
│   ├── options.html + options.js  # 主管理介面（178 + 4131 行）
│   ├── icons/                     # 擴充功能自身圖標（16/48/128 px）
│   └── styles/
│       ├── themes.css             # CSS 變數主題定義
│       └── main.css               # 主要版面與組件樣式（787 行）
├── assets/                        # README 用截圖資源
├── generate-icons.js              # Node.js 圖標生成腳本
├── svg-to-png-generator.html      # SVG → PNG 工具頁面
└── README.md                      # 專案說明
```

### 關鍵規則
- Chrome **載入未封裝項目**時，選擇的是 `extension/` 資料夾（包含 `manifest.json`）。
- 所有新增的 JS/CSS 檔案都應放在 `extension/` 下。
- `assets/` 僅供 README 使用，不屬於擴充功能本體。

---

## 3. Manifest V3 設定

```json
{
  "manifest_version": 3,
  "name": "Chrome 擴充功能管理器",
  "version": "1.0.0",
  "permissions": ["management", "storage", "tabs"],
  "background": { "service_worker": "background.js" },
  "action": {
    "default_icon": {
      "16": "icons/Chrome擴充功能管理器_icon-16.png",
      "48": "icons/Chrome擴充功能管理器_icon-48.png",
      "128": "icons/Chrome擴充功能管理器_icon-128.png"
    }
  },
  "options_page": "options.html"
}
```

### 權限說明

| 權限 | 用途 |
|---|---|
| `management` | 讀取、啟用/停用、卸載擴充功能 |
| `storage` | chrome.storage.local 儲存群組、描述、快照等 |
| `tabs` | 開啟擴充功能設定頁面 |

---

## 4. 模組分區（options.js 的 6 個 Part）

`options.js` 是目前的巨型文件（4131 行 / 139 個函數），被邏輯性地分為 6 個 Part：

| Part | 行號範圍 | 職責 |
|---|---|---|
| **Part 1** | 1–1054 | 常量定義、資料載入、雙重篩選、設備群組管理、保留記錄管理、輔助函數 |
| **Part 2** | 1055–1707 | 視圖管理（Manager/History/Settings）、擴充功能渲染、圖標處理、群組列表渲染 |
| **Part 3** | 1708–2571 | 核心操作（啟用/停用/卸載/詳情）、搜尋、排序、拖放、群組管理、快照功能 |
| **Part 4** | 2572–3368 | 完整導入/導出對話框、資料重置 |
| **Part 5** | 3369–3638 | 統一事件處理器、事件監聽器、CSS 動態樣式注入、全局錯誤處理 |
| **Part 6** | 3639–4131 | 導出對話框增強版、功能群組管理器、設備群組管理器、調試工具 |

### 命名規範

- **函數**：使用 `camelCase`，如 `toggleExtension()`, `renderExtensions()`
- **常量**：使用 `UPPER_SNAKE_CASE`，如 `STORAGE_KEYS`, `DEFAULT_STATE`
- **CSS 類別**：使用 `kebab-case`，如 `.extension-card`, `.toggle-switch`
- **DOM ID**：使用 `camelCase`，如 `mainContent`, `loadingState`
- **Storage Key**：使用 `camelCase` 字串，如 `extensionGroups`, `extensionMetadata`

---

## 5. 三層界面架構

```
┌─────────────────────────────────────────────────────────┐
│  Popup（popup.html + popup.js）                          │
│  → 快速開關、搜尋、快照                                    │
│  → 點擊「完整介面」→ 開啟 Options                          │
├─────────────────────────────────────────────────────────┤
│  Options（options.html + options.js）                     │
│  ├─ 左側：設備群組 + 功能群組 + 保留記錄                     │
│  ├─ 中間：擴充功能卡片 Grid / 歷史記錄 / 設定               │
│  └─ 右側：統計、最近變更、快照列表、批量操作                   │
├─────────────────────────────────────────────────────────┤
│  Background（background.js）                              │
│  → Service Worker，監聽 management 事件                   │
│  → 通知 Popup/Options 更新                                │
└─────────────────────────────────────────────────────────┘
```

---

## 6. 未來任何改動的檢查清單

1. ✅ 修改檔案後，到 `chrome://extensions/` 點擊「重新載入」
2. ✅ 確認 `manifest.json` 的 `version` 欄位是否需更新
3. ✅ 若新增 JS 檔案，需在 HTML 中引入 `<script src="...">`
4. ✅ 若新增 CSS 檔案，需在 HTML 中引入 `<link rel="stylesheet" href="...">`
5. ✅ 確認新功能的 chrome API 權限是否已在 `permissions` 中宣告
