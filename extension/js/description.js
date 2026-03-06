// Chrome 擴充功能管理器 - 描述處理
/**
 * 通過群組篩選
 */
window.filterByGroup = async function (groupId) {
  currentFilters.functionalGroup = groupId;
  await saveCurrentFilters();
  applyFilters();
  updateGroupCounts();
  await renderExtensions();
  renderGroupList();
};

/**
 * 通過設備篩選
 */
window.filterByDevice = async function (deviceId) {
  currentFilters.deviceGroup = deviceId;
  if (deviceGroupFilter) {
    deviceGroupFilter.value = deviceId;
  }
  await saveCurrentFilters();
  applyFilters();
  updateGroupCounts();
  await renderExtensions();
};

/**
 * 描述編輯鍵盤事件
 */
window.handleDescriptionKeydown = function (event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    event.target.blur();
  }
  if (event.key === 'Escape') {
    event.target.blur();
  }
};

/**
 * 保存描述
 */
window.saveDescription = async function (id, newDesc, descElement) {
  const ext = allExtensions.find(e => e.id === id);
  if (!ext) return;

  const trimmedDesc = newDesc.trim();
  if (!trimmedDesc || trimmedDesc === '點擊添加描述...') {
    const defaultDesc = getDefaultDescription(ext);
    descElement.textContent = defaultDesc || '點擊添加描述...';
    return;
  }

  // v2.1: 如果用戶自定義了描述，我們通常將其保存為 customDesc (原始敘述)
  // 如果他們是在翻譯模式下編輯的，這會變得很混亂，所以我們在編輯時應提示或默認為原始敘述
  ext.customDesc = trimmedDesc;
  extensionDescriptions[id] = trimmedDesc;

  // 既然手動編輯了，原本的翻譯可能不再適用，清空翻譯以便重新生成
  if (extensionTranslations[id]) {
    delete extensionTranslations[id];
    ext.translation = '';
  }

  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.extensionDescriptions]: extensionDescriptions,
      [STORAGE_KEYS.extensionTranslations]: extensionTranslations
    });
    await logChange(`更新 ${ext.name} 的描述`);

    // 如果在翻譯標籤下編輯，編輯完可以切換回原始標籤顯示
    if (preferredDescTab === 'translated') {
      switchDescTab(id, 'original', null);
    }
  } catch (error) {
    console.error('Failed to save description:', error);
  }
};

console.log('Options v2.0 Part 2 loaded: Views & Rendering');

// Chrome 擴充功能管理器 v2.0 - Part 3: 核心功能（導入/導出/操作）

// ==================== 擴充功能操作 ====================
