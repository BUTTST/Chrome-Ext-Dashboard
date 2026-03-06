// Chrome 擴充功能管理器 - 篩選與統計
/**
 * 更新群組計數（考慮當前設備篩選）
 */
function updateGroupCounts() {
  const counts = {};

  // 初始化計數
  Object.keys(groupNames).forEach(group => {
    counts[group] = 0;
  });

  // 獲取當前設備下的擴充功能
  let extensions = allExtensions;
  if (currentFilters.deviceGroup !== 'all_devices') {
    extensions = extensions.filter(ext => ext.deviceGroup === currentFilters.deviceGroup);
  }

  // 計數
  extensions.forEach(ext => {
    const group = ext.group || 'other';
    counts[group] = (counts[group] || 0) + 1;
    counts['all']++;
  });

  // 更新UI
  Object.keys(counts).forEach(group => {
    const countId = `count${group.charAt(0).toUpperCase() + group.slice(1)}`;
    const countEl = document.getElementById(countId);
    if (countEl) {
      countEl.textContent = counts[group];
    }
  });
}

/**
 * 更新保留記錄計數
 */
function updateArchiveCounts() {
  const deleted = deletedExtensions.filter(d => d.deleteType).length;
  const unavailable = 0; // TODO: 實現不可用檢測
  const total = deleted + unavailable;

  const archiveCountEl = document.getElementById('archiveCount');
  const deletedCountEl = document.getElementById('countDeleted');
  const unavailableCountEl = document.getElementById('countUnavailable');

  if (archiveCountEl) archiveCountEl.textContent = total;
  if (deletedCountEl) deletedCountEl.textContent = deleted;
  if (unavailableCountEl) unavailableCountEl.textContent = unavailable;
}

/**
 * 更新統計資訊
 */
function updateStatistics() {
  const total = allExtensions.length;
  const enabled = allExtensions.filter(e => e.enabled).length;
  const disabled = total - enabled;

  const totalEl = document.getElementById('totalCount');
  const enabledEl = document.getElementById('enabledCount');
  const disabledEl = document.getElementById('disabledCount');

  if (totalEl) totalEl.textContent = total;
  if (enabledEl) enabledEl.textContent = enabled;
  if (disabledEl) disabledEl.textContent = disabled;
}

/**
 * 更新右側面板的最近變更
 */
async function updateRecentChanges() {
  const recentChangesEl = document.getElementById('recentChanges');
  if (!recentChangesEl) return;

  const result = await chrome.storage.local.get([STORAGE_KEYS.changeHistory]);
  const history = result.changeHistory || [];

  if (history.length === 0) {
    recentChangesEl.innerHTML = `
      <div style="font-size: 13px; color: var(--text-secondary);">
        暫無變更記錄
      </div>
    `;
    return;
  }

  // 只顯示最近5筆記錄
  const recentItems = history.slice(0, 5);

  recentChangesEl.innerHTML = recentItems.map(item => `
    <div style="border-bottom: 1px solid var(--border-color); padding: 8px 0; font-size: 12px;">
      <div style="color: var(--text-primary); margin-bottom: 4px;">${item.action}</div>
      <div style="color: var(--text-secondary); font-size: 11px;">${getTimeAgo(item.timestamp)}</div>
    </div>
  `).join('');
}

/**
 * 更新右側面板的快照列表
 */
async function updateSnapshotsList() {
  const snapshotListEl = document.getElementById('snapshotList');
  if (!snapshotListEl) return;

  const result = await chrome.storage.local.get([STORAGE_KEYS.snapshots]);
  const snapshots = result.snapshots || [];

  if (snapshots.length === 0) {
    snapshotListEl.innerHTML = `
      <div style="background: var(--card-bg); border: 1px solid var(--border-color); padding: 16px; border-radius: 6px; text-align: center; color: var(--text-secondary); font-size: 12px;">
        暫無快照記錄<br>
        <small style="display: block; margin-top: 8px;">點擊上方「📸 建立快照」按鈕來建立第一個快照</small>
      </div>
    `;
    return;
  }

  // 只顯示最近3個快照
  const recentSnapshots = snapshots.slice(0, 3);

  snapshotListEl.innerHTML = `
    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden;">
      ${recentSnapshots.map((snapshot, index) => `
        <div style="padding: 12px; ${index < recentSnapshots.length - 1 ? 'border-bottom: 1px solid var(--border-color);' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <div style="font-size: 13px; color: var(--text-primary); font-weight: 600; flex: 1; word-break: break-all; padding-right: 8px;">
              ${snapshot.name || `快照 #${snapshots.length - index}`}
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; padding-top: 2px;">
              ${snapshot.date}
            </div>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; display: flex; justify-content: space-between;">
            <span>${snapshot.count} 個擴充功能</span>
            <span>${snapshot.type === 'manual' ? '手動' : '自動'}</span>
          </div>
          <div style="display: flex; gap: 4px;">
            <button class="action-btn" data-action="restoreSnapshot" data-snapshot-id="${snapshot.id || snapshot.timestamp}" style="flex: 1; padding: 4px 8px; font-size: 10px;">
              🔄 恢復
            </button>
            <button class="action-btn danger" data-action="deleteSnapshot" data-snapshot-id="${snapshot.id || snapshot.timestamp}" style="flex: 1; padding: 4px 8px; font-size: 10px;">
              🗑️ 刪除
            </button>
          </div>
        </div>
      `).join('')}
    </div>
    ${snapshots.length > 3 ? `
      <button class="action-btn" data-action="viewAllSnapshots" style="width: 100%; margin-top: 8px; padding: 6px; font-size: 11px;">
        查看全部 ${snapshots.length} 個快照
      </button>
    ` : ''}
  `;
}
