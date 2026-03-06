---
name: Extension State Management
description: 擴充功能的啟用/停用切換邏輯、狀態同步機制、背景腳本事件監聽完整說明。
---

# ⚡ Skill 04：擴充功能狀態管理（開啟/關閉腳本）

## 1. 核心 API

### 1.1 狀態切換

```javascript
// 啟用或停用一個擴充功能
chrome.management.setEnabled(extensionId, enabled);
// enabled: true = 啟用, false = 停用
```

### 1.2 查詢狀態

```javascript
// 取得所有擴充功能
chrome.management.getAll((extensions) => { ... });

// 取得單一擴充功能
chrome.management.get(extensionId, (info) => { ... });
```

### 1.3 事件監聽

```javascript
chrome.management.onEnabled.addListener((info) => { ... });    // 被啟用
chrome.management.onDisabled.addListener((info) => { ... });   // 被停用
chrome.management.onInstalled.addListener((info) => { ... });  // 被安裝
chrome.management.onUninstalled.addListener((id) => { ... });  // 被卸載
```

---

## 2. Options 頁面的切換流程

### 2.1 `toggleExtension(id)` — 核心切換函數

```javascript
async function toggleExtension(id) {
  try {
    // Step 1: 通知背景腳本記錄用戶操作
    chrome.runtime.sendMessage({
      type: 'USER_ACTION',
      extensionId: id,
      actionType: 'toggle'
    });

    // Step 2: 找到擴充功能物件
    const ext = allExtensions.find(e => e.id === id);
    if (!ext) return;

    const newState = !ext.enabled;

    // Step 3: 呼叫 Chrome API 切換狀態
    await chrome.management.setEnabled(id, newState);

    // Step 4: 延遲驗證真實狀態
    setTimeout(async () => {
      const updatedExt = await chrome.management.get(id);
      ext.enabled = updatedExt.enabled;
      await renderExtensions();
      updateStatistics();
    }, 100);

    // Step 5: 即時更新 UI（樂觀更新）
    ext.enabled = newState;
    await renderExtensions();
    updateStatistics();

    // Step 6: 記錄變更歷史
    await logChange(`${ext.enabled ? '啟用' : '停用'} ${ext.name}`);
    await updateRecentChanges();

  } catch (error) {
    console.error('Failed to toggle extension:', error);
    alert(`無法切換擴充功能狀態：${error.message}`);
  }
}
```

### 2.2 流程圖

```
用戶點擊 Toggle Switch
        │
        ▼
通知 background.js 記錄操作
        │
        ▼
呼叫 chrome.management.setEnabled()
        │
        ├─── 立即（樂觀更新）
        │    → 更新本地 ext.enabled
        │    → renderExtensions()
        │    → updateStatistics()
        │
        └─── 100ms 延遲（驗證）
             → chrome.management.get()
             → 確認真實狀態
             → 再次渲染（如有差異）
        │
        ▼
記錄變更歷史（logChange）
更新最近變更面板
```

---

## 3. Popup 頁面的切換流程

Popup 使用較簡化的版本：

```javascript
async function toggleExtension(id) {
  const ext = allExtensions.find(e => e.id === id);
  if (!ext) return;

  await chrome.management.setEnabled(id, !ext.enabled);

  // 直接更新本地狀態
  ext.enabled = !ext.enabled;
  renderExtensions();

  // 記錄變更
  await logChange(`${ext.enabled ? '啟用' : '停用'} ${ext.name}`);
}
```

**差異**：
- 無延遲驗證
- 無通知 background.js
- UI 更新更簡化

---

## 4. Background 腳本的事件監聽

### 4.1 啟用/停用事件

```javascript
chrome.management.onEnabled.addListener((info) => {
  console.log('Extension enabled:', info.name);
  notifyExtensionUpdate(); // 通知前端
});

chrome.management.onDisabled.addListener((info) => {
  console.log('Extension disabled:', info.name);
  notifyExtensionUpdate();
});
```

### 4.2 通知前端更新

```javascript
function notifyExtensionUpdate() {
  chrome.runtime.sendMessage({
    type: 'EXTENSION_UPDATE'
  }).catch(() => {
    // Popup 或 Options 未開啟時忽略錯誤
  });
}
```

### 4.3 前端接收通知

```javascript
// Popup 或 Options 中
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTENSION_UPDATE') {
    loadExtensions(); // 重新載入全部擴充功能
  }
});
```

---

## 5. 安裝/卸載事件處理

### 5.1 新安裝

```javascript
chrome.management.onInstalled.addListener(async (info) => {
  // 1. 通知 UI 更新
  notifyExtensionUpdate();

  // 2. 建立元數據
  const metadata = {
    [info.id]: {
      installTime: Date.now(),
      lastToggleTime: null,
      toggleCount: 0,
      notes: ''
    }
  };

  // 3. 為新擴充功能分配預設群組
  chrome.storage.local.set({ extensionMetadata: metadata });
});
```

### 5.2 卸載

```javascript
chrome.management.onUninstalled.addListener(async (id) => {
  // 1. 判斷是手動還是自動移除
  const hasRecentUserAction = recentUserActions.has(id);
  const deleteType = hasRecentUserAction ? 'manual' : 'auto';

  // 2. 從 storage 中讀取擴充功能資料（快照式保留）
  // 3. 保存到 deletedExtensions 記錄
  await saveDeletedExtension(id, deleteType, extensionInfo);

  // 4. 從活躍群組中移除
  chrome.storage.local.get(['extensionGroups', 'extensionDescriptions', ...], (result) => {
    delete groups[id];
    delete descriptions[id];
    chrome.storage.local.set({ extensionGroups: groups, ... });
  });
});
```

---

## 6. 用戶操作追蹤機制

為了區分「手動移除」和「自動移除」（例如被 Chrome 商店下架），使用時效性的操作記錄：

```javascript
let recentUserActions = new Map();
const USER_ACTION_TIMEOUT = 30000; // 30 秒

function recordUserAction(extensionId, actionType) {
  recentUserActions.set(extensionId, {
    actionType,
    timestamp: Date.now()
  });

  // 30 秒後自動清除
  setTimeout(() => {
    recentUserActions.delete(extensionId);
  }, USER_ACTION_TIMEOUT);
}
```

---

## 7. 批量操作

```javascript
// 啟用群組內所有擴充功能
async function enableGroup(groupId) {
  const groupExtensions = allExtensions.filter(ext => extensionGroups[ext.id] === groupId);
  for (const ext of groupExtensions) {
    if (!ext.enabled) {
      await chrome.management.setEnabled(ext.id, true);
    }
  }
}

// 停用群組內所有擴充功能
async function disableGroup(groupId) { /* 同上，反向處理 */ }
```

### 批量操作 UI 位置

在右側面板底部的「批量控制當前群組」區域：
```html
<button id="btnGroupDisable" class="action-btn danger">全部停用</button>
<button id="btnGroupEnable" class="action-btn">全部啟用</button>
```

---

## 8. 狀態保護機制

- 自身（本管理器擴充功能）不會被列出，防止自行停用。
- 系統擴充功能（如 Chrome Web Store）會被過濾掉。
- 切換失敗時會顯示 `alert()` 錯誤訊息。

---

## 9. API 參考速查

| 方法 | 用途 | 返回值 |
|---|---|---|
| `chrome.management.getAll()` | 取得所有擴充功能列表 | `ExtensionInfo[]` |
| `chrome.management.get(id)` | 取得單一擴充功能資訊 | `ExtensionInfo` |
| `chrome.management.setEnabled(id, enabled)` | 啟用/停用 | `void` |
| `chrome.management.uninstall(id)` | 卸載擴充功能 | `void` |
| `chrome.management.onEnabled` | 監聽啟用事件 | `ExtensionInfo` |
| `chrome.management.onDisabled` | 監聽停用事件 | `ExtensionInfo` |
| `chrome.management.onInstalled` | 監聽安裝事件 | `ExtensionInfo` |
| `chrome.management.onUninstalled` | 監聽卸載事件 | `string (id)` |
