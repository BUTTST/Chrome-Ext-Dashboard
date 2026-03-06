---
name: Data Storage & Persistence
description: chrome.storage.local 的資料結構、儲存鍵值定義、快照機制、匯入匯出規範。
---

# 💾 Skill 05：資料儲存與持久化

## 1. 儲存引擎

本專案**僅使用 `chrome.storage.local`**，不使用 localStorage 或 IndexedDB。

```javascript
// 讀取
chrome.storage.local.get(['key1', 'key2'], (result) => { ... });

// 寫入
chrome.storage.local.set({ key1: value1, key2: value2 });
```

---

## 2. 儲存鍵值定義

所有儲存鍵在 `options.js` 的 `STORAGE_KEYS` 常量中定義：

```javascript
const STORAGE_KEYS = {
  // 群組相關
  extensionGroups: 'extensionGroups',             // 功能群組分配
  extensionDeviceGroups: 'extensionDeviceGroups', // 設備群組分配
  extensionDescriptions: 'extensionDescriptions', // 個人化描述
  extensionMetadata: 'extensionMetadata',         // 擴充功能元數據

  // 設定相關
  theme: 'theme',                   // 當前主題 ('dark' | 'light')
  autoSnapshot: 'autoSnapshot',     // 自動每日快照 (boolean)
  deviceGroupNames: 'deviceGroupNames', // 設備群組名稱映射

  // 記錄相關
  snapshots: 'snapshots',           // 快照陣列
  changeHistory: 'changeHistory',   // 變更歷史
  deletedExtensions: 'deletedExtensions', // 已刪除擴充功能記錄

  // 清理相關
  archiveNeedsCleanup: 'archiveNeedsCleanup',
  archiveWarningDismissed: 'archiveWarningDismissed'
};
```

---

## 3. 資料結構定義

### 3.1 extensionGroups

```javascript
// 擴充功能 ID → 群組 ID 的映射
{
  "bgnkhhnnamicmpeenaelnjfhikgbkllg": "adblocker",
  "ojnbohmppadfgpejeebfnmnknjdlckgj": "ai",
  "knheggckgoiihginacbkhaalnibhilkk": "productivity",
  // ...
}
```

### 3.2 extensionDeviceGroups

```javascript
// 擴充功能 ID → 設備群組 ID 的映射
{
  "bgnkhhnnamicmpeenaelnjfhikgbkllg": "desktop_main",
  "ojnbohmppadfgpejeebfnmnknjdlckgj": "all_devices",
  // ...
}
```

### 3.3 deviceGroupNames

```javascript
// 設備群組 ID → 顯示名稱
{
  "all_devices": "🌐 所有設備",
  "desktop_main": "🖥️ 主力機",
  "laptop_portable": "💻 外出筆電"
}
```

### 3.4 extensionDescriptions

```javascript
// 擴充功能 ID → 個人化描述文字
{
  "bgnkhhnnamicmpeenaelnjfhikgbkllg": "封鎖廣告，效果很好",
  // ...
}
```

### 3.5 extensionMetadata

```javascript
// 擴充功能 ID → 元數據物件
{
  "bgnkhhnnamicmpeenaelnjfhikgbkllg": {
    "installTime": 1695340800000,
    "lastToggleTime": 1699804800000,
    "toggleCount": 15,
    "notes": ""
  }
}
```

### 3.6 snapshots（快照陣列）

```javascript
[
  {
    "id": "snapshot_1699804800000",
    "time": 1699804800000,
    "type": "manual",    // 'manual' | 'auto'
    "extensions": [
      {
        "id": "bgnkhhnnamicmpeenaelnjfhikgbkllg",
        "name": "AdGuard",
        "enabled": true,
        "version": "4.2.0"
      }
      // ...
    ],
    "groups": { /* 該時間點的 extensionGroups */ },
    "descriptions": { /* 該時間點的 extensionDescriptions */ }
  }
]
```

### 3.7 changeHistory（變更歷史）

```javascript
[
  {
    "action": "啟用 AdGuard",
    "timestamp": 1699804800000,
    "undoData": null  // 可選的撤銷資料
  }
]
```

### 3.8 deletedExtensions（已刪除記錄）

```javascript
[
  {
    "id": "some_extension_id",
    "name": "已卸載的擴充功能",
    "version": "1.0.0",
    "deleteType": "manual",  // 'manual' | 'auto'
    "deleteTime": 1699804800000,
    "previousGroup": "ai",
    "previousDescription": "AI 助手"
  }
]
```

---

## 4. 初始化預設值

在 `background.js` 的 `chrome.runtime.onInstalled` 中設置：

```javascript
chrome.storage.local.set({
  extensionGroups: defaultGroups,      // 預設的功能群組映射
  autoSnapshot: true,                   // 預設開啟自動快照
  theme: 'dark',                        // 預設暗色主題
  deviceGroupNames: {
    'all_devices': '🌐 所有設備',
    'desktop_main': '🖥️ 主力機',
    'laptop_portable': '💻 外出筆電'
  },
  extensionDeviceGroups: {},
  extensionMetadata: {},
  deletedExtensions: [],
  archiveNeedsCleanup: false,
  archiveWarningDismissed: false
});
```

---

## 5. 匯出格式（v2.0）

```javascript
{
  "version": "2.0",
  "exportDate": "2025-11-13T10:00:00.000Z",
  "extensionGroups": { ... },
  "extensionDeviceGroups": { ... },
  "deviceGroupNames": { ... },
  "extensionDescriptions": { ... },
  "extensionMetadata": { ... },
  "snapshots": [ ... ],
  "customGroups": { ... }
}
```

### 匯入相容性

- 支援 v2.0 格式（完整）
- 向後相容 v1.0 格式（僅基本群組和描述）

---

## 6. 操作規範

### 讀取資料

```javascript
async function loadStorageData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      STORAGE_KEYS.extensionGroups,
      STORAGE_KEYS.extensionDescriptions,
      // ... 所有需要的鍵
    ], (result) => {
      extensionGroups = result.extensionGroups || {};
      extensionDescriptions = result.extensionDescriptions || {};
      // ...
      resolve();
    });
  });
}
```

### 寫入資料

- **單一欄位更新**：直接 `chrome.storage.local.set({ key: newValue })`
- **批量更新**：合併為一次 `set()` 呼叫
- **重要操作前**：先建議用戶建立快照

### 資料清理

- 快照超過一定數量應提示清理
- 已刪除記錄超過 90 天建議清理
- 使用 `cleanOldRecords()` 清理舊資料
