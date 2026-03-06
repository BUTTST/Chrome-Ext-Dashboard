// Chrome 擴充功能管理器 - 擴充功能載入
/**
 * 載入所有擴充功能
 */
async function loadExtensions() {
  try {
    const extensions = await chrome.management.getAll();
    allExtensions = extensions.filter(ext =>
      ext.type === 'extension' &&
      ext.id !== chrome.runtime.id
    );

    console.log('Loaded extensions:', allExtensions.length);

    let needsSaveDescriptions = false;

    // 合併數據
    allExtensions.forEach(ext => {
      ext.group = extensionGroups[ext.id] || 'other';
      ext.deviceGroup = extensionDeviceGroups[ext.id] || 'all_devices';

      // 自動匯入完整敘述
      ext.customDesc = extensionDescriptions[ext.id] || ext.description || '';
      if (!extensionDescriptions[ext.id] && ext.description) {
        extensionDescriptions[ext.id] = ext.description;
        needsSaveDescriptions = true;
      }

      ext.metadata = extensionMetadata[ext.id] || null;
      ext.isDeleted = false;
      ext.isAvailable = true;

      // 載入翻譯與健康資訊
      ext.translation = extensionTranslations[ext.id] || '';
      ext.health = extensionHealthData[ext.id] || null;

      // 偵測是否為外文 (含有英文字元且不含中文字元)
      ext.isEnglish = /[a-zA-Z]/.test(ext.customDesc) && !/[\u4E00-\u9FFF]/.test(ext.customDesc);
    });

    if (needsSaveDescriptions) {
      chrome.storage.local.set({ [STORAGE_KEYS.extensionDescriptions]: extensionDescriptions });
    }

    // 合併已刪除的擴充功能（用於顯示）
    const deletedWithData = deletedExtensions.map(d => ({
      id: d.id,
      name: `[已刪除] ${d.metadata?.groupHistory?.[0]?.functionalGroup || 'Unknown'}`,
      group: d.functionalGroup,
      deviceGroup: d.deviceGroup,
      customDesc: d.customDesc,
      metadata: d.metadata,
      isDeleted: true,
      isAvailable: false,
      deleteTime: d.deleteTime,
      deleteType: d.deleteType
    }));

    filteredExtensions = [...allExtensions];

    updateGroupCounts();
    updateDeviceFilter();
    updateArchiveCounts();
    updateStatistics();
    renderGroupList();

    loadingState.style.display = 'none';
  } catch (error) {
    console.error('Failed to load extensions:', error);
    loadingState.textContent = '載入失敗';
  }
}
// ==================== 篩選邏輯 ====================

/**
 * 應用雙重篩選
 */
function applyFilters() {
  let filtered = allExtensions;

  // 按設備群組篩選
  if (currentFilters.deviceGroup !== 'all_devices') {
    filtered = filtered.filter(ext => ext.deviceGroup === currentFilters.deviceGroup);
  }

  // 按功能群組篩選
  if (currentFilters.functionalGroup !== 'all') {
    filtered = filtered.filter(ext => ext.group === currentFilters.functionalGroup);
  }

  filteredExtensions = filtered;
  return filtered;
}
