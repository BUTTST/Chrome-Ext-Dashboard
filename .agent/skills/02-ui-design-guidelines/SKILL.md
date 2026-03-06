---
name: UI Design Guidelines & Theme System
description: UI 設計規範，涵蓋主題系統、CSS 變數、色彩體系、分頁/模塊化架構、響應式佈局規範。
---

# 🎨 Skill 02：UI 設計規範與主題系統

## 1. 主題系統

專案使用 **CSS 變數 + `data-theme` 屬性** 驅動的雙主題系統。

### 1.1 主題變數定義（`styles/themes.css`）

```css
:root {
    /* Monokai Dark Theme (預設) */
    --bg-primary: #2b2b2b;
    --bg-secondary: #3a3a3a;
    --bg-tertiary: #4a4a4a;
    --text-primary: #e8e8e8;
    --text-secondary: #999999;
    --text-accent: #cccccc;
    --border-color: #555555;
    --accent-color: #66d9ef;      /* 主強調色 - Monokai 青色 */
    --warning-color: #f92672;     /* 警告色 - Monokai 粉紅 */
    --success-color: #66d9ef;     /* 成功色（暗色主題與強調色同色） */
    --card-bg: #383838;
    --sidebar-bg: #333333;
    --header-bg: #2a2a2a;
}

[data-theme="light"] {
    /* Light Theme */
    --bg-primary: #f5f7fa;
    --bg-secondary: #ffffff;
    --bg-tertiary: #fafbfc;
    --text-primary: #2c3e50;
    --text-secondary: #7f8c8d;
    --text-accent: #3498db;
    --border-color: #e0e6ed;
    --accent-color: #3498db;
    --warning-color: #e74c3c;
    --success-color: #27ae60;
    --card-bg: #ffffff;
    --sidebar-bg: #fafbfc;
    --header-bg: #2c3e50;
}
```

### 1.2 主題切換動畫

```css
*, *::before, *::after {
    transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
```

### 1.3 切換方法

```javascript
function changeTheme(theme) {
  document.body.dataset.theme = theme;
  chrome.storage.local.set({ theme });
}

// 初始化時讀取
async function initTheme() {
  const result = await chrome.storage.local.get('theme');
  document.body.dataset.theme = result.theme || 'dark';
}
```

**規範**：
- 所有顏色必須使用 CSS 變數，**禁止硬編碼色值**。
- 若新增 CSS 變數，**兩個主題都需定義**。

---

## 2. 分頁 / 模塊化架構

### 2.1 三分頁導覽（Options 頁面）

Options 頁面使用 **SPA 式分頁**，透過 JavaScript 切換 `innerHTML` 渲染不同視圖：

```
┌─────────────────────────────────────────┐
│  [管理器]  [歷史記錄]  [設定]            │ ← nav-buttons
├─────────────────────────────────────────┤
│  ┌──────┐  ┌────────────────┐  ┌─────┐ │
│  │ 側邊  │  │   主內容區域   │  │ 右側 │ │
│  │ 欄    │  │  (動態切換)    │  │ 面板 │ │
│  └──────┘  └────────────────┘  └─────┘ │
└─────────────────────────────────────────┘
```

### 2.2 視圖切換機制

```javascript
function showView(view, targetButton = null) {
  // 1. 更新導覽按鈕高亮
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if (targetButton) targetButton.classList.add('active');

  // 2. 動態渲染 HTML 到 mainContent
  const mainContent = document.getElementById('mainContent');
  switch(view) {
    case 'manager':  mainContent.innerHTML = getManagerView(); break;
    case 'history':  mainContent.innerHTML = getHistoryView(); break;
    case 'settings': mainContent.innerHTML = getSettingsView(); break;
  }

  // 3. 初始化該視圖特定的功能
  switch(view) {
    case 'manager':  initManagerView(); break;
    case 'history':  initHistoryView(); break;
    case 'settings': initSettingsView(); break;
  }
}
```

**規範**：
- 每個視圖需有 `getXxxView()` 返回 HTML 字串，和 `initXxxView()` 綁定事件。
- 新增視圖時需在 `options.html` 的 `nav-buttons` 區域加入對應按鈕。

### 2.3 三欄式佈局（管理器視圖）

| 欄位 | 寬度 | 內容 |
|---|---|---|
| **左側邊欄** `.sidebar` | 固定 280px | 設備群組、功能群組列表、保留記錄 |
| **中間內容** `.content` | 彈性 `flex: 1` | 擴充功能卡片 Grid |
| **右側面板** `.right-panel` | 固定 280px | 統計、最近變更、快照列表、批量操作 |

---

## 3. 響應式設計規範

### 3.1 斷點

| 斷點 | 規則 |
|---|---|
| `> 1400px` | 卡片最多 5 欄（compact）/ 4 欄（standard） |
| `1024px – 1400px` | 標準三欄佈局 |
| `768px – 1024px` | 側邊欄縮窄，內容區適應 |
| `< 768px` | 隱藏側邊欄，單欄顯示 |

### 3.2 卡片 Grid 系統

```css
.extensions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
}
```

三種密度模式：

| 模式 | CSS Class | 最小寬度 | 寬高比 |
|---|---|---|---|
| **緊湊** | `.compact` | 200px | 4:3 |
| **標準** | （預設） | 240px | 4:3 |
| **舒適** | `.comfortable` | 280px | 5:4 |

---

## 4. 元件設計規範

### 4.1 卡片（Extension Card）

```html
<div class="extension-card" data-id="{ext.id}" draggable="true">
    <div class="extension-toggle">
        <div class="toggle-switch {active|''}" onclick="toggleExtension('{ext.id}')"></div>
    </div>
    <div class="extension-header">
        <div class="extension-icon" id="icon-{ext.id}">
            <img src="{iconUrl}" onerror="handleIconError(...)">
            <div class="fallback-icon" style="display:none">{emoji}</div>
        </div>
        <div class="extension-info">
            <div class="extension-name">{name}</div>
            <div class="extension-desc" contenteditable="true">{description}</div>
        </div>
    </div>
    <div class="extension-actions">
        <button class="extension-btn" onclick="openOptions('{id}')">⚙️ 設定</button>
        <button class="extension-btn" onclick="showDetails('{id}')">ⓘ 詳情</button>
    </div>
</div>
```

### 4.2 Toggle Switch 規格

```css
.toggle-switch {
    width: 44px; height: 22px;
    background: var(--text-secondary);
    border-radius: 11px;
}
.toggle-switch.active {
    background: var(--success-color);
}
.toggle-switch::after {
    /* 圓形滑塊：18px, 白色 */
    transform: translateX(0); /* inactive */
}
.toggle-switch.active::after {
    transform: translateX(22px); /* active */
}
```

### 4.3 按鈕規範

| 類型 | CSS Class | 用途 |
|---|---|---|
| 導覽按鈕 | `.nav-btn` | 頂部分頁切換 |
| 動作按鈕 | `.action-btn` | 一般操作（新增、管理等） |
| 危險按鈕 | `.action-btn.danger` | 刪除、清理等破壞性操作 |
| 卡片按鈕 | `.extension-btn` | 卡片上的設定、詳情 |
| 篩選按鈕 | `.filter-btn` | 排序、篩選操作 |

---

## 5. 字型規範

```css
body {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}
```

- 全部使用等寬字型，營造技術/開發者風格。
- 無需引入外部字型。

---

## 6. 動畫規範

- **主題過渡**：`transition: 0.3s ease`（背景色、文字色、邊框色）
- **卡片 Hover**：`box-shadow: 0 4px 12px rgba(102, 217, 239, 0.3)`
- **Toggle 動畫**：`transition: all 0.3s`
- **載入動畫**：`@keyframes spin` 旋轉
- **禁止**：過於花俏的動畫，保持簡潔專業。
