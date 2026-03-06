// Chrome 擴充功能管理器 - 輔助工具函數
// ==================== 輔助函數 ====================

/**
 * 格式化日期時間
 */
function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * 計算時長
 */
function calculateDuration(startTime, endTime) {
  const duration = endTime - startTime;
  const days = Math.floor(duration / (24 * 60 * 60 * 1000));

  if (days < 1) {
    const hours = Math.floor(duration / (60 * 60 * 1000));
    return `${hours} 小時`;
  }

  return `${days} 天`;
}

// saveCurrentFilters 定義在 storage.js 中

/**
 * 記錄變更
 */
async function logChange(action, undoData = null) {
  const excludeActions = [
    '切換到manager視圖', '切換到history視圖', '切換到settings視圖'
  ];
  if (excludeActions.some(exclude => action.includes(exclude))) {
    return;
  }

  const timestamp = Date.now();
  const logEntry = {
    timestamp,
    action,
    date: new Date().toLocaleString('zh-TW'),
    undoData
  };

  const result = await chrome.storage.local.get([STORAGE_KEYS.changeHistory]);
  const history = result.changeHistory || [];
  history.unshift(logEntry);

  if (history.length > 100) {
    history.splice(100);
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.changeHistory]: history });
}

/**
 * 顯示錯誤消息
 */
function showErrorMessage(error) {
  if (mainContent) {
    mainContent.innerHTML = `
      <div style="padding: 20px; color: var(--warning-color);">
        <h3>初始化失敗</h3>
        <p>錯誤：${error.message}</p>
        <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: var(--accent-color); color: var(--bg-primary); border: none; border-radius: 4px; cursor: pointer;">
          重新載入
        </button>
      </div>
    `;
  }
}

/**
 * 獲取相對時間
 */
function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '剛才';
  if (minutes < 60) return `${minutes}分鐘前`;
  if (hours < 24) return `${hours}小時前`;
  return `${days}天前`;
}
