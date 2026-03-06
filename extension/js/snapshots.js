// Chrome 擴充功能管理器 - 快照管理
// ==================== 快照功能 ====================

/**
 * 建立快照
 */
async function createSnapshot() {
  try {
    const enabledExtensions = allExtensions.filter(ext => ext.enabled);

    // 先取得現有快照計算流水號
    const result = await chrome.storage.local.get([STORAGE_KEYS.snapshots]);
    const snapshots = result.snapshots || [];
    const nextId = snapshots.length + 1;
    const defaultName = `快照 #${nextId}`;

    // 讓用戸輸入名稱，預設為流水號
    const customName = prompt('請輸入快照名稱：', defaultName);
    if (customName === null) return; // 用戶取消

    const snapshotName = customName.trim() || defaultName;

    const snapshot = {
      id: Date.now(),
      timestamp: Date.now(),
      name: snapshotName,
      date: new Date().toLocaleString('zh-TW'),
      extensions: enabledExtensions.map(ext => ({
        id: ext.id,
        name: ext.name,
        version: ext.version,
        enabled: ext.enabled,
        group: ext.group,
        deviceGroup: ext.deviceGroup
      })),
      count: enabledExtensions.length,
      type: 'manual',
      deviceFilter: currentFilters.deviceGroup
    };

    snapshots.unshift(snapshot);

    if (snapshots.length > 50) {
      snapshots.splice(50);
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.snapshots]: snapshots });
    await logChange(`建立快照 - ${snapshot.count}個擴充功能`);

    // 更新快照列表
    await updateSnapshotsList();

    alert(`快照建立成功！\n時間：${snapshot.date}\n已記錄 ${snapshot.count} 個啟用的擴充功能`);
  } catch (error) {
    console.error('Failed to create snapshot:', error);
    alert('建立快照失敗');
  }
}

/**
 * 恢復快照
 */
async function restoreSnapshot(snapshotId) {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.snapshots]);
    const snapshots = result.snapshots || [];
    const snapshot = snapshots.find(s => (s.id || s.timestamp) == snapshotId);

    if (!snapshot) {
      alert('找不到該快照');
      return;
    }

    const confirmed = confirm(
      `確定要恢復此快照嗎？\n` +
      `時間：${snapshot.date}\n` +
      `擴充功能數量：${snapshot.count}\n\n` +
      `這將會根據快照狀態啟用/停用擴充功能。`
    );

    if (!confirmed) return;

    // 獲取快照中的擴充功能ID列表
    const snapshotExtIds = new Set(snapshot.extensions.map(e => e.id));

    // 停用所有不在快照中的已啟用擴充功能
    for (const ext of allExtensions) {
      const shouldBeEnabled = snapshotExtIds.has(ext.id);

      if (ext.enabled !== shouldBeEnabled) {
        try {
          await chrome.management.setEnabled(ext.id, shouldBeEnabled);
          ext.enabled = shouldBeEnabled;
        } catch (error) {
          console.error(`Failed to ${shouldBeEnabled ? 'enable' : 'disable'} ${ext.name}:`, error);
        }
      }
    }

    await loadExtensions();
    await renderExtensions();
    updateStatistics();
    await updateRecentChanges();
    await logChange(`恢復快照 - ${snapshot.date}`);

    alert(`快照恢復成功！\n已恢復到 ${snapshot.date} 的狀態`);
  } catch (error) {
    console.error('Failed to restore snapshot:', error);
    alert('恢復快照失敗');
  }
}

/**
 * 刪除快照
 */
async function deleteSnapshot(snapshotId) {
  try {
    const confirmed = confirm('確定要刪除此快照嗎？此操作無法復原。');
    if (!confirmed) return;

    const result = await chrome.storage.local.get([STORAGE_KEYS.snapshots]);
    const snapshots = result.snapshots || [];
    const filteredSnapshots = snapshots.filter(s => (s.id || s.timestamp) != snapshotId);

    await chrome.storage.local.set({ [STORAGE_KEYS.snapshots]: filteredSnapshots });
    await updateSnapshotsList();
    await logChange('刪除快照');

    alert('快照已刪除');
  } catch (error) {
    console.error('Failed to delete snapshot:', error);
    alert('刪除快照失敗');
  }
}

/**
 * 查看所有快照
 */
async function viewAllSnapshots() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.snapshots]);
    const snapshots = result.snapshots || [];

    if (snapshots.length === 0) {
      alert('暫無快照記錄');
      return;
    }

    // 創建詳細的快照列表視圖
    const snapshotListHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;" id="snapshotModal">
        <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; width: 90%; max-width: 800px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;">
          <div style="padding: 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <h2 style="margin: 0; color: var(--text-primary);">📸 所有快照記錄</h2>
            <button onclick="document.getElementById('snapshotModal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">×</button>
          </div>
          <div style="flex: 1; overflow-y: auto; padding: 20px;">
            ${snapshots.map((snapshot, index) => `
              <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                  <div>
                    <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
                      ${snapshot.name || `快照 #${snapshots.length - index}`}
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                      ${snapshot.type === 'manual' ? '手動建立' : '自動建立'}
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 14px; color: var(--accent-color); font-weight: 600;">
                      ${snapshot.count} 個擴充功能
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                      ${snapshot.date}
                    </div>
                  </div>
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="action-btn" data-action="restoreSnapshot" data-snapshot-id="${snapshot.id || snapshot.timestamp}" style="flex: 1; padding: 8px;">
                    🔄 恢復此快照
                  </button>
                  <button class="action-btn danger" data-action="deleteSnapshot" data-snapshot-id="${snapshot.id || snapshot.timestamp}" style="flex: 1; padding: 8px;">
                    🗑️ 刪除
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // 添加到頁面
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = snapshotListHTML;
    document.body.appendChild(modalDiv.firstElementChild);

    // 初始化按鈕事件
    initActionHandlers();
  } catch (error) {
    console.error('Failed to view snapshots:', error);
    alert('無法顯示快照列表');
  }
}

/**
 * 刷新擴充功能狀態
 */
async function refreshExtensionStates() {
  try {
    await loadExtensions();
    await renderExtensions();

    const refreshButton = document.querySelector('[data-action="refreshExtensions"]');
    if (refreshButton) {
      const originalText = refreshButton.textContent;
      refreshButton.textContent = '✅ 已刷新';
      refreshButton.style.background = 'var(--success-color)';

      setTimeout(() => {
        refreshButton.textContent = originalText;
        refreshButton.style.background = '';
      }, 1500);
    }

    await logChange('手動刷新擴充功能狀態');
  } catch (error) {
    console.error('Failed to refresh extension states:', error);
    alert('刷新失敗：' + error.message);
  }
}
