// Chrome 擴充功能管理器 - 調試工具
// ==================== 調試輔助 ====================

/**
 * 開發者工具：查看當前狀態
 */
window.debugExtensionManager = function () {
  console.log('=== Extension Manager v2.0 Debug Info ===');
  console.log('All Extensions:', allExtensions.length);
  console.log('Filtered Extensions:', filteredExtensions.length);
  console.log('Deleted Extensions:', deletedExtensions.length);
  console.log('Current Filters:', currentFilters);
  console.log('Group Names:', groupNames);
  console.log('Device Group Names:', deviceGroupNames);
  console.log('Extension Groups:', Object.keys(extensionGroups).length);
  console.log('Extension Device Groups:', Object.keys(extensionDeviceGroups).length);
  console.log('Extension Metadata:', Object.keys(extensionMetadata).length);
  console.log('=========================================');
};

/**
 * 開發者工具：重置所有數據（慎用！）
 */
window.resetAllData = async function () {
  if (!confirm('⚠️ 警告：這將重置所有數據！\n\n確定要繼續嗎？')) {
    return;
  }

  try {
    await chrome.storage.local.clear();
    console.log('All data cleared');
    alert('數據已重置，即將重新載入...');
    location.reload();
  } catch (error) {
    console.error('Failed to reset data:', error);
    alert('重置失敗：' + error.message);
  }
};

// ==================== 錯誤恢復 ====================

/**
 * 全局錯誤處理
 */
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);

  // 可選：顯示用戶友好的錯誤提示
  if (event.error && event.error.message) {
    // 避免顯示過多錯誤提示
    if (!window.lastErrorTime || Date.now() - window.lastErrorTime > 5000) {
      console.warn('An error occurred. Check console for details.');
      window.lastErrorTime = Date.now();
    }
  }
});

/**
 * Promise rejection 處理
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

console.log('Options v2.0 Part 5 loaded: Event Handlers & Init');
