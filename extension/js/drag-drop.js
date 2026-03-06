// Chrome 擴充功能管理器 - 拖放功能
// ==================== 拖放功能 ====================

/**
 * 初始化拖放功能
 */
function initDragAndDrop() {
  let draggedElement = null;
  let draggedExtensionId = null;

  document.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('extension-card')) {
      draggedElement = e.target;
      draggedExtensionId = e.target.dataset.id;
      e.target.classList.add('dragging');
      e.dataTransfer.setData('text/plain', draggedExtensionId);
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  document.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('extension-card')) {
      e.target.classList.remove('dragging');
      document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      document.querySelectorAll('.device-group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      draggedElement = null;
      draggedExtensionId = null;
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();

    const groupItem = e.target.closest('.group-item');
    const deviceGroupItem = e.target.closest('.device-group-item');

    if (groupItem && draggedExtensionId) {
      document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      document.querySelectorAll('.device-group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      groupItem.classList.add('drag-over');
    } else if (deviceGroupItem && draggedExtensionId) {
      document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      document.querySelectorAll('.device-group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      deviceGroupItem.classList.add('drag-over');
    }
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();

    const groupItem = e.target.closest('.group-item');
    const deviceGroupItem = e.target.closest('.device-group-item');

    if (groupItem && draggedExtensionId) {
      const targetGroupId = groupItem.dataset.group;

      document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('drag-over');
      });

      if (targetGroupId !== 'all') {
        await moveExtensionToGroup(draggedExtensionId, targetGroupId);
      }
    } else if (deviceGroupItem && draggedExtensionId) {
      const targetDeviceGroupId = deviceGroupItem.dataset.deviceGroup;

      document.querySelectorAll('.device-group-item').forEach(item => {
        item.classList.remove('drag-over');
      });

      if (targetDeviceGroupId !== 'all_devices') {
        await moveExtensionToDeviceGroup(draggedExtensionId, targetDeviceGroupId);
      }
    }
  });
}

/**
 * 移動擴充功能到群組
 */
async function moveExtensionToGroup(extensionId, targetGroupId) {
  const ext = allExtensions.find(e => e.id === extensionId);
  if (!ext) return;

  const oldGroup = ext.group;
  const oldGroupName = groupNames[oldGroup] || '未知群組';
  const newGroupName = groupNames[targetGroupId] || '未知群組';

  ext.group = targetGroupId;
  extensionGroups[extensionId] = targetGroupId;

  await chrome.storage.local.set({
    [STORAGE_KEYS.extensionGroups]: extensionGroups
  });

  // 記錄群組變更
  chrome.runtime.sendMessage({
    type: 'UPDATE_GROUP',
    extensionId: extensionId,
    functionalGroup: targetGroupId,
    deviceGroup: ext.deviceGroup
  });

  updateGroupCounts();
  await renderExtensions();
  await logChange(`移動 ${ext.name}：${oldGroupName} → ${newGroupName}`);
}

/**
 * 移動擴充功能到設備群組
 */
async function moveExtensionToDeviceGroup(extensionId, targetDeviceGroupId) {
  const ext = allExtensions.find(e => e.id === extensionId);
  if (!ext) return;

  const oldDeviceGroup = ext.deviceGroup;
  const oldDeviceGroupName = deviceGroupNames[oldDeviceGroup] || '未知設備';
  const newDeviceGroupName = deviceGroupNames[targetDeviceGroupId] || '未知設備';

  // 如果是移動到"所有設備"，則從 extensionDeviceGroups 中刪除該條目
  if (targetDeviceGroupId === 'all_devices') {
    ext.deviceGroup = 'all_devices';
    delete extensionDeviceGroups[extensionId];
  } else {
    ext.deviceGroup = targetDeviceGroupId;
    extensionDeviceGroups[extensionId] = targetDeviceGroupId;
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.extensionDeviceGroups]: extensionDeviceGroups
  });

  // 記錄設備群組變更
  chrome.runtime.sendMessage({
    type: 'UPDATE_GROUP',
    extensionId: extensionId,
    functionalGroup: ext.group,
    deviceGroup: targetDeviceGroupId
  });

  renderDeviceGroupList();
  updateGroupCounts();
  await renderExtensions();
  await logChange(`移動 ${ext.name}：${oldDeviceGroupName} → ${newDeviceGroupName}`);
}
