// Chrome 擴充功能管理器 - 保留記錄管理
// ==================== 保留記錄管理 ====================

/**
 * 初始化保留記錄監聽器
 */
function initArchiveListeners() {
  const deletedFilter = document.querySelector('[data-filter="deleted"]');
  const unavailableFilter = document.querySelector('[data-filter="unavailable"]');

  if (deletedFilter) {
    deletedFilter.addEventListener('click', () => showArchiveView('deleted'));
  }

  if (unavailableFilter) {
    unavailableFilter.addEventListener('click', () => showArchiveView('unavailable'));
  }
}

/**
 * 顯示保留記錄視圖
 */
async function showArchiveView(filterType = 'deleted') {
  const previousViewMode = currentFilters.viewMode;
  currentFilters.viewMode = 'archived';

  mainContent.innerHTML = getArchiveView(filterType);

  await renderArchiveList(filterType);
  initArchiveActions();

  console.log('Archive view shown, previous mode:', previousViewMode);
}

/**
 * 獲取保留記錄視圖HTML
 */
function getArchiveView(filterType) {
  return `
      <div class="archive-detail-view" style="padding: 20px;">
      <div class="archive-header" style="margin-bottom: 24px;">
        <h2 style="color: var(--text-primary);">🗑️ 保留紀錄 - ${filterType === 'deleted' ? '已刪除' : '不可用'}</h2>
        <div class="archive-actions" style="display: flex; gap: 12px; margin-top: 16px;">
          <button class="action-btn primary" onclick="backToManagerView()">← 返回管理器</button>
          <button class="action-btn" data-action="sortArchive">排序</button>
          <button class="action-btn danger" data-action="cleanOldRecords">清理90天前記錄</button>
          <button class="action-btn danger" data-action="clearAllArchive">清除所有記錄</button>
        </div>
      </div>
      
      <div class="archive-list" id="archiveList">
        <!-- 動態生成 -->
      </div>
    </div>
  `;
}

/**
 * 渲染保留記錄列表
 */
async function renderArchiveList(filterType = 'deleted') {
  const archiveList = document.getElementById('archiveList');
  if (!archiveList) return;

  let items = deletedExtensions;
  if (filterType === 'deleted') {
    items = items.filter(d => d.deleteType);
  }

  if (items.length === 0) {
    archiveList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        暫無${filterType === 'deleted' ? '已刪除' : '不可用'}記錄
      </div>
    `;
    return;
  }

  archiveList.innerHTML = items.map(item => `
    <div class="archive-item-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-bottom: 12px;">
      <div class="item-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
        <div style="display: flex; gap: 12px; align-items: start; flex: 1;">
          <div class="item-icon" style="font-size: 32px;">
            ${item.deleteType === 'manual' ? '🗑️' : '⚠️'}
          </div>
          <div class="item-info" style="flex: 1;">
            <h4 style="margin: 0 0 8px 0; color: var(--text-primary);">
              ${item.name || '未知擴充功能'}
            </h4>
            <span class="delete-badge ${item.deleteType === 'manual' ? 'manual' : 'auto'}" 
                  style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; 
                         background: var(--${item.deleteType === 'manual' ? 'warning' : 'text-secondary'}-color); 
                         color: white;">
              ${item.deleteType === 'manual' ? '手動刪除' : '自動刪除'}
            </span>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="action-btn" data-action="changeDeleteType" data-id="${item.id}" 
                  style="padding: 6px 12px; font-size: 12px;">
            修改標註
          </button>
          <button class="action-btn danger" data-action="deleteArchiveRecord" data-id="${item.id}"
                  style="padding: 6px 12px; font-size: 12px;">
            永久刪除
          </button>
        </div>
      </div>
      
      <div class="item-details" style="display: grid; gap: 8px; font-size: 13px;">
        <div class="detail-row" style="display: flex; justify-content: space-between;">
          <span class="label" style="color: var(--text-secondary);">刪除時間</span>
          <span class="value" style="color: var(--text-primary);">
            ${item.deleteTime ? formatDateTime(item.deleteTime) : '未知'}
          </span>
        </div>
        <div class="detail-row" style="display: flex; justify-content: space-between;">
          <span class="label" style="color: var(--text-secondary);">原群組</span>
          <span class="value">
            <span class="tag" style="display: inline-block; padding: 2px 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 11px; margin-right: 4px;">
              ${groupNames[item.functionalGroup] || item.functionalGroup}
            </span>
            <span class="tag" style="display: inline-block; padding: 2px 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 11px;">
              ${deviceGroupNames[item.deviceGroup] || item.deviceGroup}
            </span>
          </span>
        </div>
        ${item.metadata?.installTime ? `
        <div class="detail-row" style="display: flex; justify-content: space-between;">
          <span class="label" style="color: var(--text-secondary);">使用時長</span>
          <span class="value" style="color: var(--text-primary);">
            ${calculateDuration(item.metadata.installTime, item.deleteTime)}
          </span>
        </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

/**
 * 檢查是否需要清理警告
 */
async function checkArchiveCleanupWarning() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.archiveNeedsCleanup,
    STORAGE_KEYS.archiveWarningDismissed
  ]);

  if (result.archiveNeedsCleanup && !result.archiveWarningDismissed) {
    showArchiveCleanupDialog();
  }
}

/**
 * 顯示清理警告對話框
 */
function showArchiveCleanupDialog() {
  const dialog = document.createElement('div');
  dialog.className = 'modal-backdrop';
  dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;';

  dialog.innerHTML = `
    <div class="modal-content" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 24px; max-width: 500px; width: 90%;">
      <h3 style="margin-bottom: 16px; color: var(--text-primary);">⚠️ 保留記錄過多</h3>
      <p style="margin-bottom: 16px; color: var(--text-primary);">
        您目前有超過 100 條保留記錄。建議定期清理舊記錄以優化性能。
      </p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="action-btn" onclick="dismissArchiveWarning(true)">不再提示</button>
        <button class="action-btn" onclick="dismissArchiveWarning(false)">稍後提醒</button>
        <button class="action-btn primary" onclick="goToArchiveManagement()">立即清理</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
}

// 全域函數（用於對話框按鈕）
window.dismissArchiveWarning = async function (permanent) {
  if (permanent) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.archiveWarningDismissed]: true
    });
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.archiveNeedsCleanup]: false
  });

  const dialog = document.querySelector('.modal-backdrop');
  if (dialog) dialog.remove();
};

window.goToArchiveManagement = async function () {
  const dialog = document.querySelector('.modal-backdrop');
  if (dialog) dialog.remove();

  await showArchiveView('deleted');
};

/**
 * 返回管理器視圖
 */
window.backToManagerView = async function () {
  console.log('Returning to manager view');
  currentFilters.viewMode = 'active';
  await showView('manager');
  await renderExtensions();
};

/**
 * 清理舊記錄（90天前）
 */
async function cleanOldRecords() {
  const confirm = window.confirm('確定要清理 90 天前的所有記錄嗎？此操作無法復原。');
  if (!confirm) return;

  const cutoffTime = Date.now() - (90 * 24 * 60 * 60 * 1000);
  const before = deletedExtensions.length;

  deletedExtensions = deletedExtensions.filter(d => d.deleteTime > cutoffTime);

  await chrome.storage.local.set({
    [STORAGE_KEYS.deletedExtensions]: deletedExtensions
  });

  const removed = before - deletedExtensions.length;
  alert(`已清理 ${removed} 條舊記錄`);

  await renderArchiveList('deleted');
  updateArchiveCounts();
}

/**
 * 清除所有保留記錄
 */
async function clearAllArchive() {
  const confirm = window.confirm('確定要清除所有保留記錄嗎？此操作無法復原。');
  if (!confirm) return;

  const count = deletedExtensions.length;
  deletedExtensions = [];

  await chrome.storage.local.set({
    [STORAGE_KEYS.deletedExtensions]: [],
    [STORAGE_KEYS.archiveNeedsCleanup]: false
  });

  alert(`已清除 ${count} 條記錄`);

  await renderArchiveList('deleted');
  updateArchiveCounts();
}

/**
 * 修改刪除類型標註
 */
async function changeDeleteType(extensionId) {
  const item = deletedExtensions.find(d => d.id === extensionId);
  if (!item) return;

  const newType = item.deleteType === 'manual' ? 'auto' : 'manual';
  const confirm = window.confirm(
    `確定要將此記錄標註為「${newType === 'manual' ? '手動刪除' : '自動刪除'}」嗎？`
  );

  if (!confirm) return;

  item.deleteType = newType;
  if (item.metadata) {
    item.metadata.deleteType = newType;
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.deletedExtensions]: deletedExtensions
  });

  await renderArchiveList('deleted');
  await logChange(`修改刪除類型標註：${extensionId} -> ${newType}`);
}

/**
 * 永久刪除保留記錄
 */
async function deleteArchiveRecord(extensionId) {
  const confirm = window.confirm('確定要永久刪除此記錄嗎？此操作無法復原。');
  if (!confirm) return;

  deletedExtensions = deletedExtensions.filter(d => d.id !== extensionId);

  await chrome.storage.local.set({
    [STORAGE_KEYS.deletedExtensions]: deletedExtensions
  });

  await renderArchiveList('deleted');
  updateArchiveCounts();
  await logChange(`永久刪除記錄：${extensionId}`);
}
