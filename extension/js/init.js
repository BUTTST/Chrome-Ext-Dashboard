// Chrome 擴充功能管理器 - 初始化
// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Options page v2.0 initializing...');

    mainContent = document.getElementById('mainContent');
    loadingState = document.getElementById('loadingState');
    groupList = document.getElementById('groupList');
    deviceGroupFilter = document.getElementById('deviceGroupFilter');

    if (!mainContent) {
      console.error('mainContent element not found');
      return;
    }

    await initTheme();
    await loadStorageData();
    await loadExtensions();
    await checkArchiveCleanupWarning();

    initEventListeners();
    initDeviceFilter();
    initArchiveListeners();

    showView('manager');

    console.log('Options page v2.0 initialization complete');
  } catch (error) {
    console.error('Initialization failed:', error);
    showErrorMessage(error);
  }
});



// ==================== 頁面完全載入後初始化 ====================

/**
 * 頁面載入完成後執行
 */
window.addEventListener('load', () => {
  try {
    console.log('Window loaded, initializing additional features...');

    injectStyles();
    initActionHandlers();
    initArchiveActions();

    // 初始化設備篩選器
    if (deviceGroupFilter) {
      console.log('Device filter initialized');
    }

    console.log('All features initialized successfully');
  } catch (error) {
    console.error('Window load error:', error);
  }
});
