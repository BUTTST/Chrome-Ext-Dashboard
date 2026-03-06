// Chrome 擴充功能管理器 - 功能群組管理
// ==================== 群組管理 ====================

/**
 * 新增功能群組
 */
async function addNewGroup() {
  const groupName = prompt('請輸入新群組的名稱：');
  if (!groupName || groupName.trim() === '') return;

  const groupId = `custom_${Date.now()}`;
  const displayName = groupName.trim();

  groupNames[groupId] = displayName;

  const customGroups = {};
  Object.keys(groupNames).forEach(key => {
    if (key.startsWith('custom_')) {
      customGroups[key] = groupNames[key];
    }
  });

  await chrome.storage.local.set({
    [STORAGE_KEYS.customGroupNames]: customGroups
  });

  renderGroupList();
  await logChange(`新增功能群組：${displayName}`);
}

/**
 * 編輯群組名稱
 */
async function editGroupName(groupId) {
  if (groupId === 'all') {
    alert('無法編輯「所有擴充功能」群組');
    return;
  }

  const currentName = groupNames[groupId];
  const newName = prompt('編輯群組名稱：', currentName);

  if (!newName || newName.trim() === '' || newName === currentName) {
    return;
  }

  groupNames[groupId] = newName.trim();

  const customGroups = {};
  Object.keys(groupNames).forEach(key => {
    if (key.startsWith('custom_')) {
      customGroups[key] = groupNames[key];
    }
  });

  await chrome.storage.local.set({
    [STORAGE_KEYS.customGroupNames]: customGroups
  });

  renderGroupList();
  await logChange(`重新命名群組：${currentName} → ${newName.trim()}`);
}

/**
 * 刪除群組
 */
async function deleteGroup(groupId) {
  if (groupId === 'all' || !groupId.startsWith('custom_')) {
    alert('只能刪除自定義群組');
    return;
  }

  const groupName = groupNames[groupId];
  const extensionsInGroup = allExtensions.filter(ext => ext.group === groupId);

  if (extensionsInGroup.length > 0) {
    const moveToOther = confirm(
      `群組「${groupName}」中有 ${extensionsInGroup.length} 個擴充功能。\n\n` +
      `確定要刪除嗎？這些擴充功能將被移到「其他工具」群組。`
    );

    if (!moveToOther) return;

    extensionsInGroup.forEach(ext => {
      ext.group = 'other';
      extensionGroups[ext.id] = 'other';
    });

    await chrome.storage.local.set({
      [STORAGE_KEYS.extensionGroups]: extensionGroups
    });
  }

  delete groupNames[groupId];

  const customGroups = {};
  Object.keys(groupNames).forEach(key => {
    if (key.startsWith('custom_')) {
      customGroups[key] = groupNames[key];
    }
  });

  await chrome.storage.local.set({
    [STORAGE_KEYS.customGroupNames]: customGroups
  });

  if (currentFilters.functionalGroup === groupId) {
    currentFilters.functionalGroup = 'all';
  }

  renderGroupList();
  updateGroupCounts();
  await renderExtensions();
  await logChange(`刪除群組：${groupName}`);
}
