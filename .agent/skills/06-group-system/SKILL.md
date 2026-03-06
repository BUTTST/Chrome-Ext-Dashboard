---
name: Group System & Drag-and-Drop
description: 雙重群組系統（功能群組 + 設備群組）的架構、拖放排序、篩選邏輯完整說明。
---

# 📂 Skill 06：群組系統與拖放功能

## 1. 雙重群組架構

本專案使用**雙軸分類**系統，每個擴充功能同時屬於兩個維度：

```
                    功能群組（哪種用途）
                    ┌─────────────────┐
                    │ adblocker       │
                    │ ai              │
  設備群組          │ productivity    │
  （哪台電腦用）    │ dev             │
  ┌────────┐       │ screenshot      │
  │ 所有設備│ ×     │ youtube         │ = 交叉篩選
  │ 主力機  │       │ translate       │
  │ 外出筆電│       │ scraper         │
  └────────┘       │ other           │
                    └─────────────────┘
```

---

## 2. 功能群組

### 2.1 預設群組（不可刪除）

| 群組 ID | 名稱 | Emoji |
|---|---|---|
| `all` | 所有擴充功能 | （虛擬群組，顯示全部） |
| `adblocker` | 廣告封鎖與隱私 | 🛡️ |
| `ai` | AI助手與聊天 | 🤖 |
| `productivity` | 生產力工具 | 📌 |
| `dev` | 開發工具 | 💻 |
| `screenshot` | 截圖與複製 | 📸 |
| `youtube` | YouTube工具 | 🎬 |
| `translate` | 翻譯工具 | 🌐 |
| `scraper` | 資料抓取 | 🔍 |
| `other` | 其他工具 | 🔧 |

### 2.2 自訂群組

用戶可以新增自訂群組：

```javascript
function addNewGroup() {
  const groupName = prompt('請輸入新群組名稱：');
  if (!groupName) return;

  const groupId = 'custom_' + Date.now(); // 自動生成唯一 ID
  groupNames[groupId] = groupName;

  // 儲存到 storage
  chrome.storage.local.set({ customGroups: extractCustomGroups() });

  // 重新渲染群組列表
  renderGroupList();
}
```

### 2.3 群組列表渲染

```javascript
function renderGroupList() {
  const groupList = document.getElementById('groupList');
  // 保留預設群組的 HTML（已在 options.html 中靜態定義）
  // 動態追加自訂群組
  for (const [id, name] of Object.entries(groupNames)) {
    if (!isDefaultGroup(id)) {
      // 可編輯、可刪除的自訂群組
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${name}</span>
        <span class="count">${count}</span>
        <button onclick="deleteGroup('${id}')">×</button>
      `;
      groupList.appendChild(li);
    }
  }
}
```

---

## 3. 設備群組

### 3.1 預設設備群組

```javascript
const defaultDeviceGroups = {
  'all_devices': '🌐 所有設備',
  'desktop_main': '🖥️ 主力機',
  'laptop_portable': '💻 外出筆電'
};
```

### 3.2 管理操作

```javascript
// 新增
function addDeviceGroup() {
  const name = prompt('新增設備群組：');
  const id = 'device_' + Date.now();
  deviceGroupNames[id] = name;
  chrome.storage.local.set({ deviceGroupNames });
}

// 編輯名稱
function editDeviceGroupName(groupId) { /* prompt + 更新 */ }

// 刪除（會將成員移回 'all_devices'）
function deleteDeviceGroup(groupId) { /* 確認 + 清理 */ }
```

---

## 4. 雙重篩選邏輯

```javascript
function applyFilters() {
  const currentGroup = DEFAULT_STATE.currentGroup;    // 功能群組
  const currentDevice = DEFAULT_STATE.deviceGroup;     // 設備群組

  filteredExtensions = allExtensions.filter(ext => {
    // 功能群組篩選
    const groupMatch = currentGroup === 'all'
      || extensionGroups[ext.id] === currentGroup;

    // 設備群組篩選
    const deviceMatch = currentDevice === 'all_devices'
      || extensionDeviceGroups[ext.id] === currentDevice
      || !extensionDeviceGroups[ext.id]; // 未分配的算「所有設備」

    return groupMatch && deviceMatch;
  });

  renderExtensions();
  updateGroupCounts();
  updateStatistics();
}
```

### 篩選切換

```javascript
function filterByGroup(groupId) {
  DEFAULT_STATE.currentGroup = groupId;
  // 更新 UI 高亮
  document.querySelectorAll('.group-item').forEach(item => {
    item.classList.toggle('active', item.dataset.group === groupId);
  });
  applyFilters();
}

function filterByDevice(deviceId) {
  DEFAULT_STATE.deviceGroup = deviceId;
  applyFilters();
}
```

---

## 5. 拖放功能（Drag & Drop）

### 5.1 初始化

```javascript
function initDragAndDrop() {
  // 為卡片設置 draggable
  document.querySelectorAll('.extension-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });

  // 為群組列表設置 drop target
  document.querySelectorAll('.group-item').forEach(item => {
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const extId = e.dataTransfer.getData('text/plain');
      const groupId = item.dataset.group;
      moveExtensionToGroup(extId, groupId);
      item.classList.remove('drag-over');
    });
  });
}
```

### 5.2 移動到群組

```javascript
function moveExtensionToGroup(extensionId, targetGroupId) {
  extensionGroups[extensionId] = targetGroupId;

  chrome.storage.local.set({ extensionGroups });

  logChange(`移動到群組: ${groupNames[targetGroupId]}`);

  renderExtensions();
  updateGroupCounts();
}
```

### 5.3 拖放 CSS

```css
.extension-card[draggable="true"] {
    cursor: grab;
}

.extension-card.dragging {
    opacity: 0.6;
    transform: rotate(3deg);
}

.group-item.drag-over {
    background: var(--accent-color);
    color: var(--bg-primary);
}
```

---

## 6. 群組選擇彈出選單

使用彈出選單讓用戶為擴充功能選擇群組（除了拖放外的替代方式）：

```javascript
function showGroupSelector(extensionId, type, event) {
  // type = 'functional' | 'device'
  // 建立一個絕對定位的選單
  const popup = document.createElement('div');
  popup.className = 'group-selector-popup';
  popup.style.position = 'absolute';
  popup.style.left = `${event.clientX}px`;
  popup.style.top = `${event.clientY}px`;

  // 列出所有可選群組
  const groups = type === 'functional' ? groupNames : deviceGroupNames;
  for (const [id, name] of Object.entries(groups)) {
    const item = document.createElement('div');
    item.textContent = name;
    item.onclick = () => {
      if (type === 'functional') {
        moveExtensionToGroup(extensionId, id);
      } else {
        moveExtensionToDeviceGroup(extensionId, id);
      }
      popup.remove();
    };
    popup.appendChild(item);
  }

  document.body.appendChild(popup);
}
```

---

## 7. 注意事項

1. **`all` 群組是虛擬的** — 不存儲，只用於 UI 篩選。
2. **未分類的擴充功能**預設歸入 `other` 群組。
3. **刪除群組時**，其成員會被移動到 `other`。
4. **群組計數**需基於當前的設備篩選來計算。
5. **拖放**必須在 `renderExtensions()` 後重新初始化（因為 DOM 被重建）。
