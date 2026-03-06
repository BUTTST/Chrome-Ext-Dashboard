// Chrome 擴充功能管理器 - 數據儲存操作
/**
 * 載入所有儲存的資料
 */
async function loadStorageData() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.extensionGroups,
    STORAGE_KEYS.extensionDescriptions,
    STORAGE_KEYS.customGroupNames,
    STORAGE_KEYS.deviceGroupNames,
    STORAGE_KEYS.extensionDeviceGroups,
    STORAGE_KEYS.extensionMetadata,
    STORAGE_KEYS.deletedExtensions,
    STORAGE_KEYS.currentFilters,
    STORAGE_KEYS.extensionTranslations,
    STORAGE_KEYS.extensionHealthData,
    STORAGE_KEYS.displaySettings,
    STORAGE_KEYS.preferredDescTab
  ]);

  extensionGroups = result.extensionGroups || {};
  extensionDescriptions = result.extensionDescriptions || {};
  extensionMetadata = result.extensionMetadata || {};
  deletedExtensions = result.deletedExtensions || [];

  // v2.1 數據
  extensionTranslations = result.extensionTranslations || {};
  extensionHealthData = result.extensionHealthData || {};
  displaySettings = result.displaySettings || displaySettings;
  preferredDescTab = result.preferredDescTab || 'translated';

  // 合併自定義群組名稱
  if (result.customGroupNames) {
    groupNames = { ...groupNames, ...result.customGroupNames };
  }

  // 載入設備群組
  deviceGroupNames = result.deviceGroupNames || {
    'all_devices': '🌐 所有設備',
    'desktop_main': '🖥️ 主力機',
    'laptop_portable': '💻 外出筆電'
  };

  extensionDeviceGroups = result.extensionDeviceGroups || {};

  // 恢復篩選狀態
  if (result.currentFilters) {
    currentFilters = { ...currentFilters, ...result.currentFilters };
  }

  console.log('Storage data loaded', {
    extensions: Object.keys(extensionGroups).length,
    devices: Object.keys(deviceGroupNames).length,
    deleted: deletedExtensions.length
  });
}
/**
 * 保存當前篩選狀態
 */
async function saveCurrentFilters() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.currentFilters]: currentFilters
  });
}
