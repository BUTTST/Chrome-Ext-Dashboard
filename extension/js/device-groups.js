// Chrome 擴充功能管理器 - 設備群組管理
// ==================== 設備群組管理 ====================

/**
 * 初始化設備篩選器
 */
function initDeviceFilter() {
  const deviceGroupList = document.getElementById('deviceGroupList');
  if (!deviceGroupList) return;

  renderDeviceGroupList();

  // 綁定點擊事件
  deviceGroupList.addEventListener('click', (e) => {
    const item = e.target.closest('.device-group-item');
    if (!item) return;

    const deviceGroup = item.dataset.deviceGroup;
    currentFilters.deviceGroup = deviceGroup;
    saveCurrentFilters();

    // 更新UI
    document.querySelectorAll('.device-group-item').forEach(el => el.classList.remove('active'));
    item.classList.add('active');

    // 刷新顯示
    applyFilters();
    updateGroupCounts();
    renderGroupList();
    renderExtensions();
  });
}

/**
 * 渲染設備群組列表
 */
function renderDeviceGroupList() {
  const deviceGroupList = document.getElementById('deviceGroupList');
  if (!deviceGroupList) return;

  deviceGroupList.innerHTML = Object.entries(deviceGroupNames)
    .map(([id, name]) => {
      const isActive = id === currentFilters.deviceGroup ? 'active' : '';
      const count = allExtensions.filter(ext =>
        id === 'all_devices' ? true : ext.deviceGroup === id
      ).length;
      const canEdit = id.startsWith('device_'); // 只允許編輯自定義設備群組

      return `
        <li class="device-group-item ${isActive}" data-device-group="${id}" style="padding: 14px 16px; margin-bottom: 6px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: var(--text-primary); position: relative;">
          <span style="flex: 1;" ${canEdit ? `ondblclick="editDeviceGroupName('${id}')" title="雙擊編輯"` : ''}>${name}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
          <span class="count" style="background: var(--bg-tertiary); padding: 4px 8px; border-radius: 12px; font-size: 12px; color: var(--text-secondary); min-width: 24px; text-align: center;">${count}</span>
            ${canEdit ? `
              <button onclick="editDeviceGroupName('${id}'); event.stopPropagation();" style="background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 4px; font-size: 14px;" title="編輯名稱">✏️</button>
            ` : ''}
          </div>
        </li>
      `;
    }).join('');
}

/**
 * 新增設備群組
 */
async function addDeviceGroup() {
  const name = prompt('請輸入新設備群組的名稱：');
  if (!name || name.trim() === '') return;

  const groupId = `device_${Date.now()}`;
  const displayName = `💻 ${name.trim()}`;

  deviceGroupNames[groupId] = displayName;

  await chrome.storage.local.set({
    [STORAGE_KEYS.deviceGroupNames]: deviceGroupNames
  });

  renderDeviceGroupList();
  updateGroupCounts();
  renderExtensions();
  await logChange(`新增設備群組：${displayName}`);

  alert(`已成功新增設備群組「${displayName}」`);
}

/**
 * 編輯設備群組名稱
 */
async function editDeviceGroupName(groupId) {
  if (!groupId.startsWith('device_')) {
    alert('只能編輯自定義設備群組');
    return;
  }

  const currentName = deviceGroupNames[groupId];
  const newName = prompt('編輯設備群組名稱：', currentName);

  if (!newName || newName.trim() === '' || newName === currentName) {
    return;
  }

  const oldName = currentName;
  deviceGroupNames[groupId] = newName.trim();

  await chrome.storage.local.set({
    [STORAGE_KEYS.deviceGroupNames]: deviceGroupNames
  });

  renderDeviceGroupList();
  await logChange(`編輯設備群組：${oldName} → ${newName.trim()}`);

  alert(`已成功更新設備群組名稱為「${newName.trim()}」`);
}

/**
 * 顯示群組選擇器（彈出菜單）
 */
function showGroupSelector(extensionId, type, event) {
  event.stopPropagation();

  // 移除任何現有的選擇器
  const existingSelector = document.querySelector('.group-selector-popup');
  if (existingSelector) {
    existingSelector.remove();
  }

  const ext = allExtensions.find(e => e.id === extensionId);
  if (!ext) return;

  // 創建彈出選擇器
  const selector = document.createElement('div');
  selector.className = 'group-selector-popup';
  selector.style.cssText = `
    position: fixed;
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    min-width: 150px;
    max-height: 300px;
    overflow-y: auto;
  `;

  // 根據類型構建選項列表
  let options = [];
  let currentValue = '';

  if (type === 'functional') {
    options = Object.entries(groupNames).map(([id, name]) => ({ id, name }));
    currentValue = ext.group;
  } else if (type === 'device') {
    options = Object.entries(deviceGroupNames).map(([id, name]) => ({ id, name }));
    currentValue = ext.deviceGroup;
  }

  // 創建選項列表
  const optionsHTML = options.map(option => `
    <div class="group-option" 
         data-group-id="${option.id}"
         style="padding: 8px 12px; cursor: pointer; border-radius: 4px; transition: background 0.2s; ${option.id === currentValue ? 'background: var(--accent-color); color: white; font-weight: 600;' : ''}">
      ${option.name}
    </div>
  `).join('');

  selector.innerHTML = `
    <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; padding: 0 4px;">
      ${type === 'functional' ? '選擇功能分類' : '選擇設備分類'}
    </div>
    ${optionsHTML}
  `;

  // 設置位置（在點擊位置附近）
  const rect = event.target.getBoundingClientRect();
  selector.style.left = `${rect.left}px`;
  selector.style.top = `${rect.bottom + 5}px`;

  document.body.appendChild(selector);

  // 添加點擊事件處理
  selector.querySelectorAll('.group-option').forEach(option => {
    option.addEventListener('mouseenter', function () {
      if (this.dataset.groupId !== currentValue) {
        this.style.background = 'var(--bg-tertiary)';
      }
    });

    option.addEventListener('mouseleave', function () {
      if (this.dataset.groupId !== currentValue) {
        this.style.background = '';
      }
    });

    option.addEventListener('click', async function () {
      const newGroupId = this.dataset.groupId;

      if (type === 'functional') {
        await moveExtensionToGroup(extensionId, newGroupId);
      } else if (type === 'device') {
        await moveExtensionToDeviceGroup(extensionId, newGroupId);
      }

      selector.remove();
    });
  });

  // 點擊外部關閉選擇器
  setTimeout(() => {
    document.addEventListener('click', function closeSelector(e) {
      if (!selector.contains(e.target)) {
        selector.remove();
        document.removeEventListener('click', closeSelector);
      }
    });
  }, 0);
}

/**
 * 刪除設備群組
 */
async function deleteDeviceGroup(groupId) {
  if (groupId === 'all_devices') {
    alert('無法刪除「所有設備」群組');
    return;
  }

  const groupName = deviceGroupNames[groupId];
  const extensionsInGroup = allExtensions.filter(ext => ext.deviceGroup === groupId);

  // 二次確認
  const firstConfirm = window.confirm(
    `確定要刪除設備群組「${groupName}」嗎？\n\n` +
    `此群組中有 ${extensionsInGroup.length} 個擴充功能。`
  );

  if (!firstConfirm) return;

  if (extensionsInGroup.length > 0) {
    const secondConfirm = window.confirm(
      `⚠️ 再次確認\n\n` +
      `刪除後，這 ${extensionsInGroup.length} 個擴充功能將被移到「所有設備」群組。\n` +
      `確定要繼續嗎？`
    );

    if (!secondConfirm) return;

    // 移動擴充功能到「所有設備」
    extensionsInGroup.forEach(ext => {
      ext.deviceGroup = 'all_devices';
      extensionDeviceGroups[ext.id] = 'all_devices';
    });

    await chrome.storage.local.set({
      [STORAGE_KEYS.extensionDeviceGroups]: extensionDeviceGroups
    });
  }

  delete deviceGroupNames[groupId];

  await chrome.storage.local.set({
    [STORAGE_KEYS.deviceGroupNames]: deviceGroupNames
  });

  if (currentFilters.deviceGroup === groupId) {
    currentFilters.deviceGroup = 'all_devices';
  }

  renderDeviceGroupList();
  updateGroupCounts();
  renderExtensions();
  await logChange(`刪除設備群組：${groupName}`);

  alert(`已成功刪除設備群組「${groupName}」`);
}
