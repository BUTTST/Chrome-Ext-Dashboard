// Chrome 擴充功能管理器 - 事件處理
// Chrome 擴充功能管理器 v2.0 - Part 5: 事件處理和初始化

// ==================== 統一事件處理器 ====================

let actionHandlersInitialized = false;

/**
 * 初始化所有操作處理器
 */
function initActionHandlers() {
  if (actionHandlersInitialized) {
    console.log('Action handlers already initialized');
    return;
  }

  console.log('Initializing action handlers...');
  actionHandlersInitialized = true;

  // 使用事件委託處理所有帶有 data-action 的元素
  document.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');
    const extId = target.getAttribute('data-ext-id');
    const snapshotId = target.getAttribute('data-snapshot-id');
    const groupId = target.getAttribute('data-group-id');

    console.log('Action triggered:', action);

    try {
      switch (action) {
        // 擴充功能操作
        case 'switchDescTab':
          const tabMode = target.getAttribute('data-tab');
          if (extId && tabMode) {
            await window.switchDescTab(extId, tabMode, target);
          }
          break;
        case 'toggleExtension':
          if (extId) await toggleExtension(extId);
          break;
        case 'openOptions':
          if (extId) await openOptions(extId);
          break;
        case 'showDetails':
          if (extId) showDetails(extId);
          break;
        case 'uninstallExtension':
          if (extId) await uninstallExtension(extId);
          break;

        // 排序和刷新
        case 'sortByStatus':
          await sortByStatus();
          break;
        case 'sortByName':
          await sortByName();
          break;
        case 'refreshExtensions':
          await refreshExtensionStates();
          break;

        // 快照操作
        case 'createSnapshot':
          await createSnapshot();
          break;
        case 'restoreSnapshot':
          if (snapshotId) await restoreSnapshot(snapshotId);
          break;
        case 'deleteSnapshot':
          if (snapshotId) await deleteSnapshot(snapshotId);
          break;
        case 'viewAllSnapshots':
          await viewAllSnapshots();
          break;

        // 群組管理
        case 'addNewGroup':
          await addNewGroup();
          break;
        case 'addDeviceGroup':
          await addDeviceGroup();
          break;
        case 'deleteGroup':
          if (groupId) await deleteGroup(groupId);
          break;
        case 'deleteDeviceGroup':
          if (groupId) await deleteDeviceGroup(groupId);
          break;

        // 保留記錄
        case 'manageArchive':
          await showArchiveView('deleted');
          break;
        case 'backToManager':
          await showView('manager');
          break;
        case 'cleanOldRecords':
          await cleanOldRecords();
          break;
        case 'clearAllArchive':
          await clearAllArchive();
          break;
        case 'changeDeleteType':
          if (extId) await changeDeleteType(extId);
          break;
        case 'deleteArchiveRecord':
          if (extId) await deleteArchiveRecord(extId);
          break;

        // 設定操作
        case 'resetTheme':
          await resetTheme();
          break;
        case 'exportData':
          await exportData();
          break;
        case 'importData':
          await importData();
          break;
        case 'exportExtensionList':
          await exportExtensionList();
          break;
        case 'showImportDialog':
          showImportDialog();
          break;

        case 'showExportDialog':
          showExportDialog();
          break;

        case 'manageFunctionalGroups':
          showFunctionalGroupsManager();
          break;

        case 'manageDeviceGroupsDetailed':
          showDeviceGroupsManager();
          break;

        case 'syncAllData':
          await syncAllData();
          break;

        // 歷史記錄操作
        case 'exportHistory':
          await exportHistory();
          break;
        case 'clearHistory':
          await clearHistory();
          break;

        default:
          console.warn('Unknown action:', action);
      }
    } catch (error) {
      console.error('Action handler error:', action, error);
      alert(`操作失敗：${error.message}`);
    }
  });

  console.log('Action handlers initialized');
}

/**
 * 初始化保留記錄項目的點擊事件
 */
function initArchiveActions() {
  const archiveItems = document.querySelectorAll('.archive-item[data-filter]');
  archiveItems.forEach(item => {
    item.addEventListener('click', () => {
      const filter = item.getAttribute('data-filter');
      showArchiveView(filter);
    });
  });
}

// ==================== 自訂的全域與群組禁用功能 ====================

// 全局停用所有（除了自己）
async function disableAllExtensions() {
  if (!confirm('即將關閉所有其他擴充功能進入排錯模式。\n確定要繼續嗎？（強烈建議：我們將在停用前為您建立快照以便稍後恢復）')) return;
  try {
    await createSnapshot();
    let count = 0;
    for (const ext of allExtensions) {
      if (ext.enabled) {
        await chrome.management.setEnabled(ext.id, false);
        count++;
      }
    }
    await logChange(`全局停用所有擴充功能 (${count}個)`);
    alert(`已停用 ${count} 個擴充功能進入排錯模式。`);
    await refreshExtensionStates();
  } catch (error) {
    console.error('Failed to disable all:', error);
    alert('停用失敗：' + error.message);
  }
}

// 恢復最新快照
async function restoreLatestSnapshot() {
  try {
    const result = await chrome.storage.local.get(['snapshots']);
    const snapshots = result.snapshots || [];
    if (snapshots.length === 0) {
      alert('找不到任何快照記錄！請先建立快照。');
      return;
    }
    const latest = snapshots[0];
    if (!confirm(`確定要恢復最新快照嗎？\n快照時間：${latest.date}\n記錄了 ${latest.count} 個啟用的擴充功能。`)) return;
    const enabledIds = new Set(latest.extensions.map(e => e.id));
    let changed = 0;
    for (const ext of allExtensions) {
      const shouldBeEnabled = enabledIds.has(ext.id);
      if (ext.enabled !== shouldBeEnabled) {
        await chrome.management.setEnabled(ext.id, shouldBeEnabled);
        changed++;
      }
    }
    await logChange(`從快照恢復 - ${latest.date}`);
    alert(`快照恢復成功！自動切換了 ${changed} 個擴充功能狀態。`);
    await refreshExtensionStates();
  } catch (error) {
    console.error('Failed to restore snapshot:', error);
    alert('恢復快照失敗：' + error.message);
  }
}

// 停用當前群組
async function disableCurrentGroup() {
  const toDisable = filteredExtensions.filter(e => e.enabled);
  if (toDisable.length === 0) {
    alert('目前顯示的清單中沒有任何已啟用的擴充功能。');
    return;
  }
  if (!confirm(`即將停用當前顯示的 ${toDisable.length} 個擴充功能，並建立快照。\n確定要繼續嗎？`)) return;
  try {
    await createSnapshot();
    let count = 0;
    for (const ext of toDisable) {
      await chrome.management.setEnabled(ext.id, false);
      count++;
    }
    await logChange(`停用當前群組 (${count}個)`);
    alert(`已停用群組內的 ${count} 個擴充功能。`);
    await refreshExtensionStates();
  } catch (error) {
    console.error('Failed to disable group:', error);
    alert('群組停用失敗：' + error.message);
  }
}

// ==================== 主要事件監聽器 ====================

/**
 * 初始化所有事件監聽器
 */
function initEventListeners() {
  try {
    console.log('Initializing event listeners...');

    // 導航按鈕事件
    const nav = document.querySelector('.nav-buttons');
    if (nav) {
      nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.nav-btn');
        if (!btn) return;
        const view = btn.getAttribute('data-view');
        if (view) showView(view, btn);
      });
    }

    // 將按鈕事件掛載
    const btnGroupDisable = document.getElementById('btnGroupDisable');
    if (btnGroupDisable) btnGroupDisable.addEventListener('click', disableCurrentGroup);

    const btnGlobalDisableAll = document.getElementById('btnGlobalDisableAll');
    if (btnGlobalDisableAll) btnGlobalDisableAll.addEventListener('click', disableAllExtensions);

    const btnRestoreLatest = document.getElementById('btnRestoreLatest');
    if (btnRestoreLatest) btnRestoreLatest.addEventListener('click', restoreLatestSnapshot);

    // 監聽背景腳本的更新通知
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'EXTENSION_UPDATE') {
        console.log('Received extension update notification');
        loadExtensions().then(() => {
          if (currentFilters.viewMode === 'active') {
            renderExtensions();
          }
        });
      }
    });

    console.log('Event listeners initialized');
  } catch (error) {
    console.error('Failed to initialize event listeners:', error);
  }
}
