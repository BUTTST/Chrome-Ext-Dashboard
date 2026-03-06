// Chrome 擴充功能管理器 - 歷史記錄
// ==================== 歷史記錄 ====================

/**
 * 載入歷史記錄列表
 */
async function loadHistoryList() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;

  const result = await chrome.storage.local.get([STORAGE_KEYS.changeHistory]);
  const history = result.changeHistory || [];

  if (history.length === 0) {
    historyList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">暫無變更記錄</div>';
    return;
  }

  historyList.innerHTML = history.map(item => `
    <div style="border-bottom: 1px solid var(--border-color); padding: 16px 0;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="color: var(--text-primary);">${item.date.split(' ')[1] || item.date}</strong> 
          <span style="color: var(--text-primary);">${item.action}</span>
        </div>
        <small style="color: var(--text-secondary);">${getTimeAgo(item.timestamp)}</small>
      </div>
    </div>
  `).join('');
}

// getTimeAgo 函數定義在 utils.js 中


/**
 * 匯出歷史記錄
 */
async function exportHistory() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.changeHistory]);
    const history = result.changeHistory || [];

    const exportData = {
      history,
      totalRecords: history.length,
      exportDate: new Date().toISOString(),
      dateRange: history.length > 0 ? {
        from: new Date(history[history.length - 1].timestamp).toISOString(),
        to: new Date(history[0].timestamp).toISOString()
      } : null
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `extension-manager-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    await logChange('匯出歷史記錄');
  } catch (error) {
    console.error('Export history failed:', error);
    alert('匯出歷史記錄失敗');
  }
}

/**
 * 清除歷史記錄
 */
async function clearHistory() {
  if (confirm('確定要清除所有歷史記錄嗎？\n\n此操作無法復原。')) {
    await chrome.storage.local.set({ [STORAGE_KEYS.changeHistory]: [] });
    await loadHistoryList();
    alert('已清除所有歷史記錄');
  }
}

console.log('Options v2.0 Part 3 loaded: Core Operations');
