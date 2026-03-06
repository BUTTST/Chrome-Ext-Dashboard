// Chrome 擴充功能管理器 - 核心操作

/**
 * 切換擴充功能狀態
 */
async function toggleExtension(id) {
  try {
    // 記錄用戶操作
    chrome.runtime.sendMessage({
      type: 'USER_ACTION',
      extensionId: id,
      actionType: 'toggle'
    });

    const ext = allExtensions.find(e => e.id === id);
    if (!ext) return;

    const previousState = ext.enabled;
    const newState = !ext.enabled;

    await chrome.management.setEnabled(id, newState);

    // 短暫延遲後重新查詢狀態
    setTimeout(async () => {
      try {
        const updatedExt = await chrome.management.get(id);
        ext.enabled = updatedExt.enabled;
        await renderExtensions();
        updateStatistics();
      } catch (error) {
        console.error('Failed to verify extension state:', error);
      }
    }, 100);

    ext.enabled = newState;
    await renderExtensions();
    updateStatistics();

    await logChange(`${ext.enabled ? '啟用' : '停用'} ${ext.name}`);
    await updateRecentChanges();
  } catch (error) {
    console.error('Failed to toggle extension:', error);
    alert(`無法切換擴充功能狀態：${error.message}`);
  }
}

/**
 * 開啟擴充功能設定頁
 */
async function openOptions(id) {
  try {
    // 記錄用戶操作
    chrome.runtime.sendMessage({
      type: 'USER_ACTION',
      extensionId: id,
      actionType: 'open_options'
    });

    const ext = allExtensions.find(e => e.id === id);
    if (ext && ext.optionsUrl) {
      await chrome.tabs.create({ url: ext.optionsUrl });
      await logChange(`開啟 ${ext.name} 設定頁`);
    } else {
      await chrome.tabs.create({ url: `chrome://extensions/?id=${id}` });
      await logChange(`開啟 ${ext.name} 詳情頁`);
    }
  } catch (error) {
    console.error('Failed to open options:', error);
  }
}

/**
 * 卸載擴充功能
 */
async function uninstallExtension(id) {
  try {
    const ext = allExtensions.find(e => e.id === id);
    if (!ext) return;

    if (!confirm(`確定要卸載 ${ext.name} 嗎？\n\n此操作無法復原。`)) {
      return;
    }

    // 記錄用戶操作
    chrome.runtime.sendMessage({
      type: 'USER_ACTION',
      extensionId: id,
      actionType: 'uninstall'
    });

    await chrome.management.uninstall(id);

    // 從本地陣列中移除
    const index = allExtensions.indexOf(ext);
    allExtensions.splice(index, 1);

    await renderExtensions();
    updateStatistics();
    updateGroupCounts();
    await logChange(`卸載 ${ext.name}`);
  } catch (error) {
    console.error('Failed to uninstall extension:', error);
    alert(`無法卸載擴充功能：${error.message}`);
  }
}

/**
 * 顯示擴充功能詳情
 */
function showDetails(id) {
  const ext = allExtensions.find(e => e.id === id);
  if (!ext) return;

  const permissions = ext.permissions || [];
  const hostPermissions = ext.hostPermissions || [];
  const metadata = ext.metadata || {};

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.cssText = 'background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 24px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; color: var(--text-primary);';

  content.innerHTML = `
    <h3 style="margin-bottom: 16px;">📊 擴充功能詳情</h3>
    
    <div style="margin-bottom: 12px;">
      <strong>名稱：</strong> ${ext.name}
    </div>
    
    <div style="margin-bottom: 8px;">
      <strong>ID：</strong> <code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 12px;">${ext.id}</code>
    </div>
    
    <div style="margin-bottom: 8px;">
      <strong>版本：</strong> ${ext.version}
    </div>
    
    <div style="margin-bottom: 8px;">
      <strong>狀態：</strong> 
      <span style="color: ${ext.enabled ? 'var(--success-color)' : 'var(--warning-color)'}">
        ${ext.enabled ? '✅ 已啟用' : '❌ 已停用'}
      </span>
    </div>
    
    <div style="margin-bottom: 8px;">
      <strong>群組：</strong>
      <span class="tag" style="display: inline-block; padding: 3px 8px; background: var(--accent-color); color: white; border-radius: 12px; font-size: 11px; margin-right: 4px;">
        ${groupNames[ext.group] || ext.group}
      </span>
      <span class="tag" style="display: inline-block; padding: 3px 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 12px; font-size: 11px;">
        ${deviceGroupNames[ext.deviceGroup] || ext.deviceGroup}
      </span>
    </div>
    
    ${metadata.installTime ? `
    <div style="margin-bottom: 8px;">
      <strong>安裝時間：</strong> ${formatDateTime(metadata.installTime)}
    </div>
    ` : ''}
    
    ${metadata.groupHistory && metadata.groupHistory.length > 1 ? `
    <div style="margin-bottom: 12px;">
      <strong>群組歷史：</strong>
      <div style="margin-top: 4px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 12px; max-height: 150px; overflow-y: auto;">
        ${metadata.groupHistory.map(h => `
          <div style="margin-bottom: 4px;">
            ${formatDateTime(h.timestamp)} - ${h.action} - 
            ${groupNames[h.functionalGroup] || h.functionalGroup} / 
            ${deviceGroupNames[h.deviceGroup] || h.deviceGroup}
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    ${permissions.length > 0 ? `
    <div style="margin-bottom: 8px;">
      <strong>權限：</strong>
      <div style="margin-top: 4px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 12px;">
        ${permissions.join(', ')}
      </div>
    </div>
    ` : ''}
    
    <div style="margin-bottom: 16px;">
      <strong>描述：</strong>
      <div style="margin-top: 4px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px;">
        ${ext.description || '無描述'}
      </div>
    </div>
    
    <button class="action-btn primary" style="width: 100%;" onclick="this.closest('.modal-backdrop').remove()">關閉</button>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };

  logChange(`查看 ${ext.name} 的詳情`);
}
