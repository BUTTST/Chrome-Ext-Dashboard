// Chrome 擴充功能管理器 - 導出對話框
// ==================== 擴展功能：導出對話框、群組管理器 ====================

/**
 * 顯示完善的導出對話框
 */
function showExportDialog() {
  const dialog = document.createElement('div');
  dialog.className = 'modal-backdrop';
  dialog.id = 'exportModal';
  dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;';

  dialog.innerHTML = `
    <div class="modal-content" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; width: 90%; max-width: 700px; max-height: 85vh; display: flex; flex-direction: column;">
      <div class="modal-header" style="padding: 20px; border-bottom: 1px solid var(--border-color);">
        <h2 style="margin: 0; color: var(--text-primary);">📤 導出擴充功能配置</h2>
      </div>
      
      <div style="padding: 20px; overflow-y: auto; flex: 1;">
        <div class="modal-section" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 12px; color: var(--text-primary); font-weight: 600;">導出範圍</label>
          <div class="radio-group" style="display: flex; flex-direction: column; gap: 10px;">
            <label class="radio-option" style="display: flex; align-items: start; gap: 10px; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; cursor: pointer;">
              <input type="radio" name="exportScope" value="all" checked style="margin-top: 2px;" />
              <div class="option-content">
                <strong style="display: block; margin-bottom: 4px; color: var(--text-primary);">全部導出</strong>
                <small style="color: var(--text-secondary);">導出所有已安裝的擴充功能配置</small>
              </div>
            </label>
            <label class="radio-option" style="display: flex; align-items: start; gap: 10px; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; cursor: pointer;">
              <input type="radio" name="exportScope" value="device" style="margin-top: 2px;" />
              <div class="option-content">
                <strong style="display: block; margin-bottom: 4px; color: var(--text-primary);">指定設備群組</strong>
                <small style="color: var(--text-secondary);">僅導出特定設備群組的擴充功能</small>
              </div>
            </label>
            <label class="radio-option" style="display: flex; align-items: start; gap: 10px; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; cursor: pointer;">
              <input type="radio" name="exportScope" value="functional" style="margin-top: 2px;" />
              <div class="option-content">
                <strong style="display: block; margin-bottom: 4px; color: var(--text-primary);">指定功能分類</strong>
                <small style="color: var(--text-secondary);">僅導出特定功能分類的擴充功能</small>
              </div>
            </label>
            <label class="radio-option" style="display: flex; align-items: start; gap: 10px; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; cursor: pointer;">
              <input type="radio" name="exportScope" value="enabled" style="margin-top: 2px;" />
              <div class="option-content">
                <strong style="display: block; margin-bottom: 4px; color: var(--text-primary);">僅已啟用</strong>
                <small style="color: var(--text-secondary);">只導出目前處於啟用狀態的擴充功能</small>
              </div>
            </label>
          </div>
        </div>
        
        <div class="modal-section" id="deviceGroupSelection" style="margin-bottom: 20px; display: none;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-weight: 600;">選擇設備群組</label>
          <select id="exportDeviceGroup" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--card-bg); color: var(--text-primary);">
            ${Object.entries(deviceGroupNames).filter(([id]) => id !== 'all_devices').map(([id, name]) =>
    `<option value="${id}">${name}</option>`
  ).join('')}
          </select>
        </div>
        
        <div class="modal-section" id="functionalGroupSelection" style="margin-bottom: 20px; display: none;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-weight: 600;">選擇功能分類</label>
          <select id="exportFunctionalGroup" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--card-bg); color: var(--text-primary);">
            ${Object.entries(groupNames).filter(([id]) => id !== 'all').map(([id, name]) =>
    `<option value="${id}">${name}</option>`
  ).join('')}
          </select>
        </div>
        
        <div class="modal-section" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 12px; color: var(--text-primary); font-weight: 600;">導出選項</label>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; color: var(--text-primary);">
              <input type="checkbox" id="includeMetadata" checked />
              <span>包含完整元數據（安裝時間、群組歷史等）</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; color: var(--text-primary);">
              <input type="checkbox" id="includeDeleted" />
              <span>包含已刪除記錄</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; color: var(--text-primary);">
              <input type="checkbox" id="includeDescriptions" checked />
              <span>包含自定義描述</span>
            </label>
          </div>
        </div>
        
        <div class="modal-section" id="exportPreview" style="background: var(--bg-tertiary); border-radius: 6px; padding: 16px;">
          <div id="exportPreviewContent" style="color: var(--text-primary); font-size: 14px;">
            將導出 <strong id="exportCount">0</strong> 個擴充功能
          </div>
        </div>
      </div>
      
      <div class="modal-footer" style="padding: 20px; border-top: 1px solid var(--border-color); display: flex; gap: 12px; justify-content: flex-end;">
        <button class="action-btn" id="cancelExportBtn">取消</button>
        <button class="action-btn primary" id="confirmExportBtn" style="background: var(--success-color); color: white;">確認導出</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const scopeRadios = dialog.querySelectorAll('input[name="exportScope"]');
  scopeRadios.forEach(radio => {
    radio.addEventListener('change', updateExportScope);
  });

  document.getElementById('cancelExportBtn').addEventListener('click', () => {
    dialog.remove();
  });

  document.getElementById('confirmExportBtn').addEventListener('click', performExport);

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });

  updateExportPreview();
}

function updateExportScope() {
  const scope = document.querySelector('input[name="exportScope"]:checked').value;
  const deviceSection = document.getElementById('deviceGroupSelection');
  const functionalSection = document.getElementById('functionalGroupSelection');

  deviceSection.style.display = scope === 'device' ? 'block' : 'none';
  functionalSection.style.display = scope === 'functional' ? 'block' : 'none';

  updateExportPreview();
}

function updateExportPreview() {
  const scope = document.querySelector('input[name="exportScope"]:checked')?.value || 'all';
  const includeDeleted = document.getElementById('includeDeleted')?.checked || false;

  let count = 0;
  let extensions = allExtensions;

  switch (scope) {
    case 'all':
      count = extensions.length;
      break;
    case 'device':
      const deviceGroup = document.getElementById('exportDeviceGroup')?.value;
      count = extensions.filter(ext => ext.deviceGroup === deviceGroup).length;
      break;
    case 'functional':
      const functionalGroup = document.getElementById('exportFunctionalGroup')?.value;
      count = extensions.filter(ext => ext.group === functionalGroup).length;
      break;
    case 'enabled':
      count = extensions.filter(ext => ext.enabled).length;
      break;
  }

  if (includeDeleted) {
    count += deletedExtensions.length;
  }

  const countEl = document.getElementById('exportCount');
  if (countEl) countEl.textContent = count;
}

async function performExport() {
  try {
    const scope = document.querySelector('input[name="exportScope"]:checked').value;
    const includeMetadata = document.getElementById('includeMetadata').checked;
    const includeDeleted = document.getElementById('includeDeleted').checked;
    const includeDescriptions = document.getElementById('includeDescriptions').checked;

    let exportExtensions = [];

    switch (scope) {
      case 'all':
        exportExtensions = [...allExtensions];
        break;
      case 'device':
        const deviceGroup = document.getElementById('exportDeviceGroup').value;
        exportExtensions = allExtensions.filter(ext => ext.deviceGroup === deviceGroup);
        break;
      case 'functional':
        const functionalGroup = document.getElementById('exportFunctionalGroup').value;
        exportExtensions = allExtensions.filter(ext => ext.group === functionalGroup);
        break;
      case 'enabled':
        exportExtensions = allExtensions.filter(ext => ext.enabled);
        break;
    }

    const exportData = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      exportScope: scope,
      extensions: exportExtensions.map(ext => ({
        id: ext.id,
        name: ext.name,
        version: ext.version,
        enabled: ext.enabled,
        group: ext.group,
        deviceGroup: ext.deviceGroup,
        description: includeDescriptions ? (ext.customDesc || ext.description || '') : '',
        metadata: includeMetadata ? extensionMetadata[ext.id] : undefined
      })),
      deletedExtensions: includeDeleted ? deletedExtensions : [],
      groupNames: groupNames,
      deviceGroupNames: deviceGroupNames,
      totalCount: exportExtensions.length
    };

    const timestamp = new Date().toISOString().split('T')[0];
    let filename = `chrome-extensions-${timestamp}`;
    if (scope !== 'all') {
      filename += `-${scope}`;
    }
    filename += '.json';

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    await logChange(`導出配置：${exportData.totalCount} 個擴充功能`);

    document.getElementById('exportModal').remove();

    alert(`導出成功！\n\n已導出 ${exportData.totalCount} 個擴充功能\n檔名：${filename}`);

  } catch (error) {
    console.error('Export failed:', error);
    alert(`導出失敗：${error.message}`);
  }
}
