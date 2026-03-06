# Chrome 擴充功能管理器 — 模組結構說明書

> **用途**：讓 AI 或開發者能快速定位要修改的模組，不需逐檔搜尋。
> **最後更新**：2026-03-07

---

## 目錄總覽

```
extension/
├── manifest.json                 # 擴充功能設定（權限、腳本入口）
├── background.js                 # 背景服務腳本（事件監聯、自動快照）
├── options.html                  # 設定頁面 HTML（載入所有 JS/CSS）
│
├── js/                           # ★ 前端模組化 JS（27 檔）
│   └── (見下方「JS 模組詳細對照表」)
│
├── styles/                       # ★ 模組化 CSS（6 檔）
│   ├── themes.css                # CSS 變數、深/淺色主題
│   ├── layout.css                # 頁面佈局：container、sidebar、content、header
│   ├── components.css            # 按鈕、搜尋框、群組列表、toggle、badge
│   ├── cards.css                 # 擴充功能卡片、網格、圖標、健康統計
│   ├── panels.css                # 右側面板、快照、設定頁
│   └── responsive.css            # 所有 @media 響應式規則
│
├── icons/                        # 擴充功能圖標資源
└── _locales/                     # 國際化語言包
```

---

## JS 模組詳細對照表

### 載入順序

`options.html` 中以 `<script>` 標籤依序載入，分為 6 層。**順序不可更改**，後層模組依賴前層。

---

### 第一層：基礎定義

| 檔案 | 行數 | 職責 | 包含函數 / 匯出 |
|------|------|------|-----------------|
| `constants.js` | 34 | Storage key 常量 | `STORAGE_KEYS` 物件 |
| `state.js` | 51 | 全域狀態變數 & DOM 參考 | `allExtensions`, `filteredExtensions`, `deletedExtensions`, `currentFilters`, `groupNames`, `deviceGroupNames`, `extensionGroups`, `extensionDeviceGroups`, `extensionDescriptions`, `extensionTranslations`, `extensionHealthData`, `extensionMetadata`, `preferredDescTab`, `currentSortMode`, `userRequestedSort`, `mainContent`, `loadingState`, `groupList`, `deviceGroupFilter` |
| `utils.js` | 97 | 通用工具函數 | `formatDateTime()`, `logChange()`, `getTimeAgo()`, `getDefaultDescription()`, `showErrorMessage()` |
| `storage.js` | 64 | chrome.storage 讀寫 | `loadStorageData()`, `saveCurrentFilters()` |

---

### 第二層：核心功能

| 檔案 | 行數 | 職責 | 包含函數 |
|------|------|------|---------|
| `theme.js` | 41 | 深/淺色主題切換 | `initTheme()`, `changeTheme()`, `resetTheme()` |
| `icons.js` | 96 | 擴充功能圖標抓取 & 降級 | `getExtensionIconUrl()`, `getExtensionIcon()`, `handleIconError()`, `handleIconSuccess()` |
| `extensions-loader.js` | 93 | 用 chrome.management 載入擴充功能 | `loadExtensions()`, `applyFilters()` |
| `webstore-sync.js` | 170 | Chrome Web Store 資訊同步 | `syncExtensionStoreData()`, `translateExtensionDescription()`, `switchDescTab()`, `getDisplayDescription()` |
| `filters.js` | 156 | 篩選計數 & 面板更新 | `updateGroupCounts()`, `updateArchiveCounts()`, `updateStatistics()`, `updateRecentChanges()`, `updateSnapshotsList()` |

---

### 第三層：群組與記錄管理

| 檔案 | 行數 | 職責 | 包含函數 |
|------|------|------|---------|
| `device-groups.js` | 277 | 設備群組 CRUD & 選擇器 | `initDeviceFilter()`, `renderDeviceGroupList()`, `addDeviceGroup()`, `editDeviceGroupName()`, `showGroupSelector()`, `deleteDeviceGroup()` |
| `archive.js` | 301 | 已刪除 / 不可用擴充的保留記錄 | `initArchiveListeners()`, `showArchiveView()`, `getArchiveView()`, `renderArchiveList()`, `checkArchiveCleanupWarning()`, `showArchiveCleanupDialog()`, `dismissArchiveWarning()`, `goToArchiveManagement()`, `backToManagerView()`, `cleanOldRecords()`, `clearAllArchive()`, `changeDeleteType()`, `deleteArchiveRecord()` |
| `views.js` | 302 | 三大視圖 (管理器/歷史/設定) HTML 生成 | `showView()`, `getManagerView()`, `getHistoryView()`, `getSettingsView()`, `initManagerView()`, `initHistoryView()`, `initSettingsView()` |
| `render.js` | 260 | 擴充功能卡片 & 群組列表渲染 | `renderExtensions()`, `renderGroupList()`, `renderDeviceGroupsList()` |
| `description.js` | 87 | 描述欄位編輯 & 群組篩選按鈕 | `filterByGroup()`, `filterByDevice()`, `handleDescriptionKeydown()`, `saveDescription()` |

---

### 第四層：操作與互動

| 檔案 | 行數 | 職責 | 包含函數 |
|------|------|------|---------|
| `actions.js` | 209 | 啟用/停用/卸載/詳情 | `toggleExtension()`, `openOptions()`, `uninstallExtension()`, `showDetails()` |
| `search-sort.js` | 43 | 搜尋欄與排序 | `initSearch()`, `sortByStatus()`, `sortByName()` |
| `drag-drop.js` | 158 | 卡片拖放至群組 | `initDragAndDrop()`, `moveExtensionToGroup()`, `moveExtensionToDeviceGroup()` |
| `groups.js` | 116 | 功能群組 CRUD | `addNewGroup()`, `editGroupName()`, `deleteGroup()` |
| `snapshots.js` | 220 | 快照建立/恢復/刪除 | `createSnapshot()`, `restoreSnapshot()`, `deleteSnapshot()`, `viewAllSnapshots()`, `refreshExtensionStates()` |

---

### 第五層：歷史與數據

| 檔案 | 行數 | 職責 | 包含函數 |
|------|------|------|---------|
| `history.js` | 81 | 變更歷史列表 & 匯出 | `loadHistoryList()`, `exportHistory()`, `clearHistory()` |
| `import-export.js` | 798 | 完整導入/導出/重置 | `showImportDialog()`, `closeImportDialog()`, `handleImportFileSelect()`, `generateImportPreview()`, `performImport()`, `openAddGroupDialog()`, `exportData()`, `importData()`, `resetAllData()`, `backupBeforeReset()`, `exportExtensionList()` |

---

### 第六層：事件與 UI

| 檔案 | 行數 | 職責 | 包含函數 |
|------|------|------|---------|
| `events.js` | 296 | 統一事件委派 & 按鈕處理 | `initActionHandlers()`, `initArchiveActions()`, `disableAllExtensions()`, `restoreLatestSnapshot()`, `disableCurrentGroup()`, `initEventListeners()` |
| `styles-injector.js` | 64 | 動態注入 CSS（拖放、動畫） | `injectStyles()` |
| `debug.js` | 66 | 開發者調試 & 全域錯誤處理 | `debugExtensionManager()`, `resetAllData()` |
| `export-dialog.js` | 241 | 進階導出對話框 UI | `showExportDialog()`, `updateExportScope()`, `updateExportPreview()`, `performExport()` |
| `group-managers.js` | 162 | 功能/設備群組管理對話框 | `showFunctionalGroupsManager()`, `closeFunctionalGroupsManager()`, `addNewFunctionalGroup()`, `confirmDeleteGroup()`, `showDeviceGroupsManager()`, `closeDeviceGroupsManager()`, `addNewDeviceGroupFromManager()`, `editDeviceGroupName()`, `confirmDeleteDeviceGroup()` |

---

### 最後：初始化

| 檔案 | 行數 | 職責 | 說明 |
|------|------|------|------|
| `init.js` | 60 | **必須最後載入** | `DOMContentLoaded` 事件啟動初始化流程：讀取 DOM → `initTheme()` → `loadStorageData()` → `loadExtensions()` → `showView('manager')`；`window.load` 後注入樣式、綁定事件 |

---

## 常見修改場景 → 應修改的檔案

| 我想要… | 修改檔案 |
|---------|---------|
| 新增 storage key | `constants.js` |
| 新增全域變數 / 狀態 | `state.js` |
| 修改時間格式、日誌記錄 | `utils.js` |
| 修改 storage 讀寫邏輯 | `storage.js` |
| 修改主題顏色 / 新增主題 | `styles/themes.css` + `theme.js` |
| 修改擴充功能圖標降級邏輯 | `icons.js` |
| 修改擴充功能載入 / 篩選條件 | `extensions-loader.js` |
| 修改 Web Store 同步、翻譯 | `webstore-sync.js` |
| 修改群組計數 / 統計面板 | `filters.js` |
| 修改設備群組 CRUD | `device-groups.js` |
| 修改已刪除記錄管理 | `archive.js` |
| 修改管理器 / 歷史 / 設定頁面 HTML 結構 | `views.js` |
| 修改擴充功能卡片樣式 | `styles/cards.css` |
| 修改擴充功能卡片渲染邏輯 | `render.js` |
| 修改描述欄位編輯行為 | `description.js` |
| 修改啟用 / 停用 / 卸載邏輯 | `actions.js` |
| 修改搜尋 / 排序行為 | `search-sort.js` |
| 修改拖放至群組邏輯 | `drag-drop.js` |
| 修改功能群組新增 / 刪除 | `groups.js` |
| 修改快照功能 | `snapshots.js` |
| 修改歷史記錄頁面 | `history.js` |
| 修改導入 / 導出功能 | `import-export.js` |
| 修改按鈕點擊事件綁定 | `events.js` |
| 修改動態注入樣式 | `styles-injector.js` |
| 新增調試功能 / 錯誤處理 | `debug.js` |
| 修改導出對話框 UI | `export-dialog.js` |
| 修改群組管理對話框 UI | `group-managers.js` |
| 修改初始化順序 / 啟動流程 | `init.js` |
| 修改側邊欄 / 整體佈局 | `styles/layout.css` |
| 修改按鈕 / 表單 / 通用元件樣式 | `styles/components.css` |
| 修改面板 / 設定區域樣式 | `styles/panels.css` |
| 修改響應式 / 手機版適配 | `styles/responsive.css` |
| 修改頁面 HTML 結構 / 新增 CSS/JS 引用 | `options.html` |
| 修改背景腳本 / 自動偵測 | `background.js` |

---

## 模組間通訊方式

- **全域作用域**：所有 JS 模組透過全域函數 / 全域變數互相呼叫（Chrome Extension 限制，無法使用 ES Module）。
- **storage 事件**：`background.js` 與前端透過 `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` 通訊。
- **DOM 事件委派**：`events.js` 中的 `initActionHandlers()` 使用 `data-action` 屬性做統一事件委派。

---

## CSS 檔案對照

| 檔案 | 涵蓋區域 |
|------|---------|
| `themes.css` | CSS 變數（`--bg-primary`, `--text-primary`, `--accent-color` 等）、`[data-theme="dark"]` / `[data-theme="light"]` |
| `layout.css` | `.container`, `.sidebar`, `.content`, `.right-panel`, `.header`, `.toolbar` |
| `components.css` | `.action-btn`, `.nav-btn`, `.search-box`, `.group-list`, `.group-item`, `.toggle-switch`, `.loading`, `.badge` |
| `cards.css` | `.ext-grid`, `.extension-card`, `.ext-icon`, `.ext-toggle`, `.health-stats`, `.desc-tabs` |
| `panels.css` | `.right-panel`, `.panel-section`, `.snapshot-item`, `.archive-item`, 設定頁相關 |
| `responsive.css` | 所有 `@media` 查詢（≤1400px, ≤1200px, ≤768px） |
