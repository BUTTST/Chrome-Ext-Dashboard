---
name: Extension Icon Handling
description: 擴充功能圖標（Icon）的抓取邏輯、降級策略、錯誤處理完整說明。
---

# 🖼️ Skill 03：擴充功能圖標處理邏輯

## 1. 問題背景

Chrome **沒有穩定的公開 API** 可 100% 可靠地取得其他擴充功能的圖標。  
本專案使用**多層降級策略（Fallback Chain）**來處理。

---

## 2. 圖標取得流程圖

```
                    ┌──────────────────────┐
                    │ ext.icons 陣列存在？   │
                    └─────┬───────┬────────┘
                          │ 是    │ 否
                          ▼       ▼
                  取 size ≥ 48   嘗試猜測路徑
                  的 icon.url    (chrome-extension://...)
                          │       │
                          ▼       ▼
                   <img src=url>  依序嘗試：
                          │       1. icon.png
                   成功？  │       2. icons/icon.png
                   ┌──┴──┐       3. images/icon.png
                   │ Yes │       4. icon48.png
                   │     │       5. icons/48.png
                   │ 顯示 │              │
                   │ 圖片 │        全部失敗？
                   └─────┘        ┌──┴──┐
                                  │ Yes │
                                  │     │
                                  ▼     │
                           fallback     │
                           Emoji 🔧     │
                                        ▼
                                   顯示 Emoji
```

---

## 3. Options 頁面的圖標處理（`options.js`）

### 3.1 取得圖標 URL

```javascript
function getExtensionIconUrl(ext) {
  const possiblePaths = [
    `chrome-extension://${ext.id}/icon.png`,
    `chrome-extension://${ext.id}/icons/icon.png`,
    `chrome-extension://${ext.id}/images/icon.png`,
    `chrome-extension://${ext.id}/icon48.png`,
    `chrome-extension://${ext.id}/icons/48.png`
  ];

  // 優先使用 chrome.management API 回傳的 icons 陣列
  if (ext.icons && ext.icons.length > 0) {
    const icon = ext.icons.find(i => i.size >= 48) || ext.icons[0];
    return icon.url;
  }

  // 如果 API 沒回傳，猜測第一個路徑
  return possiblePaths[0];
}
```

### 3.2 Emoji Fallback Map

```javascript
function getExtensionIcon(ext) {
  const iconMap = {
    'bgnkhhnnamicmpeenaelnjfhikgbkllg': '🛡️',  // AdGuard
    'ldadnegmmggmmgbijlnmjhcnjcpgkfdj': '🚫',  // youBlock
    'eimadpbcbfnmbkopoojfekhnkhdbieeh': '🌙',  // Dark Reader
    'onepmapfbjohnegdmfhndpefjkppbjkm': '📋',  // SuperCopy
    'ojnbohmppadfgpejeebfnmnknjdlckgj': '🤖',  // AIPRM
    // ... 更多映射
  };
  return iconMap[ext.id] || '🔧'; // 預設使用 🔧
}
```

### 3.3 圖片載入錯誤處理

```javascript
// 掛在 <img> 的 onerror 上
window.handleIconError = function(extId, fallbackIcon) {
  const iconContainer = document.getElementById(`icon-${extId}`);
  if (iconContainer) {
    const img = iconContainer.querySelector('img');
    const fallback = iconContainer.querySelector('.fallback-icon');
    if (img) img.style.display = 'none';       // 隱藏壞掉的 <img>
    if (fallback) fallback.style.display = 'flex'; // 顯示 emoji
  }
};

// 掛在 <img> 的 onload 上
window.handleIconSuccess = function(extId) {
  const iconContainer = document.getElementById(`icon-${extId}`);
  if (iconContainer) {
    const fallback = iconContainer.querySelector('.fallback-icon');
    if (fallback) fallback.style.display = 'none'; // 隱藏 emoji
  }
};
```

### 3.4 渲染時的 HTML 結構

```html
<div class="extension-icon" id="icon-{ext.id}">
  <!-- 實際圖片 -->
  <img src="{getExtensionIconUrl(ext)}"
       onload="handleIconSuccess('{ext.id}')"
       onerror="handleIconError('{ext.id}', '{emoji}')"
       style="width:100%; height:100%; border-radius:8px; object-fit:cover">
  <!-- Emoji Fallback（預設隱藏） -->
  <div class="fallback-icon"
       style="display:none; width:100%; height:100%; align-items:center; justify-content:center; font-size:24px">
    {emoji}
  </div>
</div>
```

---

## 4. Popup 頁面的圖標處理（`popup.js`）

Popup 使用類似但略不同的策略：**漸進式嘗試**多個路徑。

### 4.1 漸進式路徑嘗試

```javascript
function tryNextIcon(imgElement, extId, iconPaths, currentIndex) {
  if (currentIndex < iconPaths.length) {
    imgElement.src = iconPaths[currentIndex];
    imgElement.onerror = () => tryNextIcon(imgElement, extId, iconPaths, currentIndex + 1);
  } else {
    // 全部失敗，顯示 emoji fallback
    imgElement.style.display = 'none';
    if (imgElement.nextElementSibling) {
      imgElement.nextElementSibling.style.display = 'flex';
    }
  }
}
```

### 4.2 Popup 專用的 Emoji Map

Popup 有自己的 `getExtensionIcon(ext)` 函數，映射表更完整（包含 LINE、MetaMask 等），  
預設 fallback 也是 `'🔧'`。

---

## 5. 圖標容器 CSS 規格

```css
.extension-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
}

/* 三種密度模式 */
.compact .extension-icon   { width: 32px; height: 32px; font-size: 16px; }
.comfortable .extension-icon { width: 48px; height: 48px; font-size: 20px; }
```

---

## 6. 最佳實踐與注意事項

1. **永遠優先使用 `ext.icons` API 回傳的 URL** — 這是最可靠的來源。
2. **一定要提供 Emoji Fallback** — 許多擴充功能的圖標路徑不可預測。
3. **使用 `onerror` + `onload` 雙事件** — 確保顯示邏輯正確。
4. **Emoji Map 需手動維護** — 因為擴充功能 ID 是固定的，新增已知擴充功能時應更新。
5. **不要依賴 `chrome-extension://` 路徑猜測** — 它經常失敗，僅作為輔助手段。
6. **`object-fit: cover`** — 確保不同尺寸的圖標不會變形。

---

## 7. 已知限制

> ⚠️ 這是 Chrome 平台本身的限制，無法從程式碼層面完全解決。

- `chrome.management.getAll()` 回傳的 `icons` 陣列可能為空。
- `chrome-extension://` 協定存取其他擴充功能的資源受安全限制。
- **已停用的擴充功能**可能無法存取其圖標資源。
