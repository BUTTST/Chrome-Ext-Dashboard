// Chrome 擴充功能管理器 - 導入導出
// Chrome 擴充功能管理器 v2.0 - Part 4: 完整導入/導出功能

// ==================== 完整導入功能 ====================

/**
 * 顯示完整導入對話框
 */
function showImportDialog() {
  const dialog = document.createElement('div');
  dialog.className = 'modal-backdrop';
  dialog.id = 'importModal';
  dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;';

  dialog.innerHTML = `
    <div class="modal-content" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; width: 90%; max-width: 700px; max-height: 85vh; display: flex; flex-direction: column;">
      <!-- 標題欄 -->
      <div class="modal-header" style="padding: 20px; border-bottom: 1px solid var(--border-color);">
        <h2 style="margin: 0; color: var(--text-primary);">📥 導入擴充功能配置</h2>
      </div>
      
      <!-- 內容 -->
      <div style="padding: 20px; overflow-y: auto; flex: 1;">
        <!-- 文件選擇 -->
        <div class="modal-section" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-weight: 600;">選擇配置文件</label>
          <div style="display: flex; gap: 8px;">
            <input type="file" id="importFileInput" accept=".json" style="flex: 1; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--card-bg); color: var(--text-primary);" />
          </div>
          <div id="selectedFileInfo" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);"></div>
        </div>
        
        <!-- 導入模式 -->
        <div class="modal-section" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 12px; color: var(--text-primary); font-weight: 600;">導入模式</label>
          <div class="radio-group" style="display: flex; flex-direction: column; gap: 10px;">
            <label class="radio-option" style="display: flex; align-items: start; gap: 10px; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; cursor: pointer;">
              <input type="radio" name="importMode" value="byData" checked style="margin-top: 2px;" />
              <div class="option-content">
                <strong style="display: block; margin-bottom: 4px; color: var(--text-primary);">按數據決定開啟/關閉</strong>
                <small style="color: var(--text-secondary);">保持配置文件中的原始狀態</small>
              </div>
            </label>
            <label class="radio-option" style="display: flex; align-items: start; gap: 10px; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; cursor: pointer;">
              <input type="radio" name="importMode" value="allDisabled" style="margin-top: 2px;" />
              <div class="option-content">
                <strong style="display: block; margin-bottom: 4px; color: var(--text-primary);">全部導入為關閉狀態</strong>
                <small style="color: var(--text-secondary);">導入後所有擴充功能預設停用</small>
              </div>
            </label>
            <label class="radio-option" style="display: flex; align-items: start; gap: 10px; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; cursor: pointer;">
              <input type="radio" name="importMode" value="allEnabled" style="margin-top: 2px;" />
              <div class="option-content">
                <strong style="display: block; margin-bottom: 4px; color: var(--text-primary);">全部導入為開啟狀態</strong>
                <small style="color: var(--text-secondary);">導入後所有擴充功能預設啟用</small>
              </div>
            </label>
          </div>
        </div>
        
        <!-- 目標群組選擇 -->
        <div class="modal-section" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 12px; color: var(--text-primary); font-weight: 600;">目標群組</label>
          <div class="group-selection">
            <div class="group-row" style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 6px; color: var(--text-secondary); font-size: 13px;">功能分類</label>
              <div style="display: flex; gap: 8px;">
                <select id="targetFunctionalGroup" style="flex: 1; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--card-bg); color: var(--text-primary);">
                  <option value="">保持原分類</option>
                  ${Object.entries(groupNames).filter(([id]) => id !== 'all').map(([id, name]) =>
    `<option value="${id}">${name}</option>`
  ).join('')}
                </select>
                <button class="action-btn" onclick="openAddGroupDialog('functional')" style="padding: 10px 12px;">+ 新增</button>
              </div>
            </div>
            <div class="group-row">
              <label style="display: block; margin-bottom: 6px; color: var(--text-secondary); font-size: 13px;">設備分類</label>
              <div style="display: flex; gap: 8px;">
                <select id="targetDeviceGroup" style="flex: 1; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--card-bg); color: var(--text-primary);">
                  <option value="">保持原分類</option>
                  ${Object.entries(deviceGroupNames).filter(([id]) => id !== 'all_devices').map(([id, name]) =>
    `<option value="${id}">${name}</option>`
  ).join('')}
                </select>
                <button class="action-btn" onclick="openAddGroupDialog('device')" style="padding: 10px 12px;">+ 新增</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 導入預覽 -->
        <div class="modal-section preview-section" id="importPreviewSection" style="display: none;">
          <label style="display: block; margin-bottom: 12px; color: var(--text-primary); font-weight: 600;">導入預覽</label>
          <div class="import-preview" style="background: var(--bg-tertiary); border-radius: 6px; padding: 16px;">
            <div class="preview-stats" id="previewStats" style="margin-bottom: 12px; font-size: 14px; color: var(--text-primary);">
              <!-- 動態生成 -->
            </div>
            <div class="preview-list" id="previewList" style="max-height: 200px; overflow-y: auto;">
              <!-- 動態生成預覽列表 -->
            </div>
          </div>
        </div>
      </div>
      
      <!-- 操作按鈕 -->
      <div class="modal-footer" style="padding: 20px; border-top: 1px solid var(--border-color); display: flex; gap: 12px; justify-content: flex-end;">
        <button class="action-btn" id="cancelImportBtn">取消</button>
        <button class="action-btn primary" id="confirmImportBtn" disabled style="background: var(--accent-color); color: white;">確認導入</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // 綁定文件選擇事件
  const fileInput = document.getElementById('importFileInput');
  fileInput.addEventListener('change', handleImportFileSelect);

  // 綁定確認按鈕
  const confirmBtn = document.getElementById('confirmImportBtn');
  confirmBtn.addEventListener('click', performImport);

  // 綁定取消按鈕
  const cancelBtn = document.getElementById('cancelImportBtn');
  cancelBtn.addEventListener('click', () => {
    closeImportDialog();
  });

  // 點擊背景關閉
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      closeImportDialog();
    }
  });
}

/**
 * 關閉導入對話框
 */
window.closeImportDialog = function () {
  const dialog = document.getElementById('importModal');
  if (dialog && dialog.parentNode) {
    dialog.parentNode.removeChild(dialog);
  }
};

/**
 * 處理文件選擇
 */
let importFileData = null;

async function handleImportFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileInfo = document.getElementById('selectedFileInfo');
  const previewSection = document.getElementById('importPreviewSection');
  const confirmBtn = document.getElementById('confirmImportBtn');

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // 驗證數據格式
    if (!data.extensions || !Array.isArray(data.extensions)) {
      throw new Error('無效的配置文件格式');
    }

    importFileData = data;

    // 顯示文件信息
    fileInfo.innerHTML = `
      <span style="color: var(--success-color);">✓</span> 
      已選擇：${file.name} (${data.extensions.length} 個擴充功能)
    `;

    // 生成預覽
    await generateImportPreview(data);
    previewSection.style.display = 'block';
    confirmBtn.disabled = false;

  } catch (error) {
    fileInfo.innerHTML = `
      <span style="color: var(--warning-color);">✗</span> 
      文件讀取失敗：${error.message}
    `;
    previewSection.style.display = 'none';
    confirmBtn.disabled = true;
    importFileData = null;
  }
}

/**
 * 生成導入預覽
 */
async function generateImportPreview(data) {
  const previewStats = document.getElementById('previewStats');
  const previewList = document.getElementById('previewList');

  // 計算新增和更新的數量
  let newCount = 0;
  let updateCount = 0;

  data.extensions.forEach(ext => {
    const existing = allExtensions.find(e => e.id === ext.id);
    if (existing) {
      updateCount++;
    } else {
      newCount++;
    }
  });

  previewStats.innerHTML = `
    將導入 <strong>${data.extensions.length}</strong> 個擴充功能：
    <strong style="color: var(--success-color);">新增 ${newCount}</strong>，
    <strong style="color: var(--accent-color);">更新 ${updateCount}</strong>
  `;

  previewList.innerHTML = data.extensions.map(ext => {
    const existing = allExtensions.find(e => e.id === ext.id);
    const status = existing ? '更新' : '新增';
    const statusColor = existing ? 'var(--accent-color)' : 'var(--success-color)';

    return `
      <div style="padding: 8px; margin-bottom: 6px; background: var(--card-bg); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="color: var(--text-primary); font-size: 13px;">${ext.name}</strong>
          <small style="display: block; color: var(--text-secondary); font-size: 11px;">
            ${ext.group ? groupNames[ext.group] || ext.group : '未分類'}
          </small>
        </div>
        <span style="padding: 3px 8px; background: ${statusColor}; color: white; border-radius: 12px; font-size: 11px;">
          ${status}
        </span>
      </div>
    `;
  }).join('');
}

/**
 * 執行導入
 */
async function performImport() {
  if (!importFileData) return;

  const confirmBtn = document.getElementById('confirmImportBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = '導入中...';

  try {
    // 獲取選擇的模式和群組
    const mode = document.querySelector('input[name="importMode"]:checked').value;
    const targetFunctionalGroup = document.getElementById('targetFunctionalGroup').value;
    const targetDeviceGroup = document.getElementById('targetDeviceGroup').value;

    let successCount = 0;
    let skipCount = 0;

    for (const extData of importFileData.extensions) {
      try {
        // 設置群組（如果指定了目標群組）
        const functionalGroup = targetFunctionalGroup || extData.group || 'other';
        const deviceGroup = targetDeviceGroup || extData.deviceGroup || 'all_devices';

        // 更新群組
        extensionGroups[extData.id] = functionalGroup;
        extensionDeviceGroups[extData.id] = deviceGroup;

        // 更新描述
        if (extData.description || extData.customDesc) {
          extensionDescriptions[extData.id] = extData.customDesc || extData.description || '';
        }

        // 檢查擴充功能是否已安裝
        const existing = allExtensions.find(e => e.id === extData.id);
        if (existing) {
          existing.group = functionalGroup;
          existing.deviceGroup = deviceGroup;
          existing.customDesc = extData.customDesc || extData.description || '';

          // 根據模式設置啟用狀態
          let targetEnabled = existing.enabled;
          if (mode === 'byData') {
            targetEnabled = extData.enabled;
          } else if (mode === 'allEnabled') {
            targetEnabled = true;
          } else if (mode === 'allDisabled') {
            targetEnabled = false;
          }

          if (existing.enabled !== targetEnabled) {
            await chrome.management.setEnabled(extData.id, targetEnabled);
            existing.enabled = targetEnabled;
          }

          successCount++;
        } else {
          // 擴充功能未安裝，只保存配置
          skipCount++;
        }

        // 創建或更新元數據
        const now = Date.now();
        if (!extensionMetadata[extData.id]) {
          extensionMetadata[extData.id] = {
            installTime: now,
            importTime: now,
            deleteTime: null,
            lastModified: now,
            deleteType: null,
            deleteReason: null,
            groupHistory: [
              {
                functionalGroup,
                deviceGroup,
                timestamp: now,
                action: 'imported'
              }
            ],
            source: 'imported',
            notes: ''
          };
        } else {
          // 更新現有元數據
          extensionMetadata[extData.id].lastModified = now;
          extensionMetadata[extData.id].groupHistory.push({
            functionalGroup,
            deviceGroup,
            timestamp: now,
            action: 'imported'
          });
        }

      } catch (error) {
        console.error(`Failed to import extension ${extData.id}:`, error);
        skipCount++;
      }
    }

    // 保存所有更改
    await chrome.storage.local.set({
      [STORAGE_KEYS.extensionGroups]: extensionGroups,
      [STORAGE_KEYS.extensionDeviceGroups]: extensionDeviceGroups,
      [STORAGE_KEYS.extensionDescriptions]: extensionDescriptions,
      [STORAGE_KEYS.extensionMetadata]: extensionMetadata
    });

    // 重新載入
    await loadExtensions();
    await renderExtensions();
    updateGroupCounts();
    renderGroupList();

    await logChange(`導入配置：成功 ${successCount}，跳過 ${skipCount}`);

    alert(`導入完成！\n\n成功：${successCount} 個\n跳過：${skipCount} 個\n\n已安裝的擴充功能配置已更新。`);

    closeImportDialog();

  } catch (error) {
    console.error('Import failed:', error);
    alert(`導入失敗：${error.message}`);
    confirmBtn.disabled = false;
    confirmBtn.textContent = '確認導入';
  }
}

/**
 * 打開新增群組對話框（在導入對話框內）
 */
window.openAddGroupDialog = function (type) {
  const groupName = prompt(`請輸入新${type === 'functional' ? '功能' : '設備'}群組的名稱：`);
  if (!groupName || groupName.trim() === '') return;

  if (type === 'functional') {
    const groupId = `custom_${Date.now()}`;
    groupNames[groupId] = groupName.trim();

    // 更新下拉選單
    const select = document.getElementById('targetFunctionalGroup');
    const option = document.createElement('option');
    option.value = groupId;
    option.textContent = groupName.trim();
    select.appendChild(option);
    select.value = groupId;

    // 保存（異步）
    chrome.storage.local.get([STORAGE_KEYS.customGroupNames], (result) => {
      const customGroups = result.customGroupNames || {};
      customGroups[groupId] = groupName.trim();
      chrome.storage.local.set({ [STORAGE_KEYS.customGroupNames]: customGroups });
    });

  } else if (type === 'device') {
    const groupId = `device_${Date.now()}`;
    const displayName = `💻 ${groupName.trim()}`;
    deviceGroupNames[groupId] = displayName;

    // 更新下拉選單
    const select = document.getElementById('targetDeviceGroup');
    const option = document.createElement('option');
    option.value = groupId;
    option.textContent = displayName;
    select.appendChild(option);
    select.value = groupId;

    // 保存（異步）
    chrome.storage.local.set({ [STORAGE_KEYS.deviceGroupNames]: deviceGroupNames });
  }
};

// ==================== 導出功能增強 ====================

/**
 * 匯出設定（v2.0格式，包含元數據）
 */
async function exportData(event) {
  try {
    const exportType = event?.target?.dataset?.exportType || 'all';
    const data = await chrome.storage.local.get();

    let exportData = {
      version: '2.1',
      exportDate: new Date().toISOString(),
      exportType: exportType
    };

    // 根據導出類型選擇要包含的資料
    switch (exportType) {
      case 'all':
        // 完整導出：包含所有資料
        exportData = {
          ...exportData,
          extensionGroups: data.extensionGroups || {},
          extensionDeviceGroups: data.extensionDeviceGroups || {},
          extensionDescriptions: data.extensionDescriptions || {},
          extensionMetadata: data.extensionMetadata || {},
          deviceGroupNames: data.deviceGroupNames || {},
          customGroupNames: data.customGroupNames || {},
          groupNames: data.groupNames || {},
          snapshots: data.snapshots || [],
          changeHistory: data.changeHistory || [],
          theme: data.theme || 'dark',
          autoSnapshot: data.autoSnapshot !== false
        };
        break;

      case 'groups':
        // 僅群組配置
        exportData = {
          ...exportData,
          extensionGroups: data.extensionGroups || {},
          extensionDeviceGroups: data.extensionDeviceGroups || {},
          deviceGroupNames: data.deviceGroupNames || {},
          customGroupNames: data.customGroupNames || {},
          groupNames: data.groupNames || {}
        };
        break;

      case 'snapshots':
        // 僅快照記錄
        exportData = {
          ...exportData,
          snapshots: data.snapshots || [],
          changeHistory: data.changeHistory || []
        };
        break;

      case 'settings':
        // 僅設定
        exportData = {
          ...exportData,
          theme: data.theme || 'dark',
          autoSnapshot: data.autoSnapshot !== false,
          extensionDescriptions: data.extensionDescriptions || {},
          extensionMetadata: data.extensionMetadata || {}
        };
        break;
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const typeNames = {
      'all': '完整',
      'groups': '群組',
      'snapshots': '快照',
      'settings': '設定'
    };

    const a = document.createElement('a');
    a.href = url;
    a.download = `extension-manager-${typeNames[exportType]}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    await logChange(`導出資料：${typeNames[exportType]}（v2.1）`);
    alert(`✅ 成功導出${typeNames[exportType]}資料`);
  } catch (error) {
    console.error('Export failed:', error);
    alert('❌ 導出失敗：' + error.message);
  }
}

/**
 * 匯入設定（向後兼容v1.0）
 */
async function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);

      // 顯示導入對話框
      const importType = importedData.exportType || 'all';
      const version = importedData.version || '1.0';

      const typeNames = {
        'all': '完整配置',
        'groups': '群組配置',
        'snapshots': '快照記錄',
        'settings': '設定'
      };

      // 創建導入選項對話框
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--card-bg);
        border: 2px solid var(--border-color);
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        z-index: 10001;
        min-width: 400px;
        max-width: 500px;
      `;

      dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">📥 導入資料</h3>
        
        <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; margin-bottom: 16px;">
          <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">
            <strong>檔案資訊：</strong>
          </div>
          <div style="font-size: 12px; color: var(--text-primary);">
            • 類型：${typeNames[importType] || '未知'}<br>
            • 版本：v${version}<br>
            • 導出時間：${new Date(importedData.exportDate).toLocaleString('zh-TW')}<br>
            • 檔案名：${file.name}
          </div>
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-weight: 600;">
            導入模式：
          </label>
          <select id="importMode" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--card-bg); color: var(--text-primary);">
            <option value="merge">🔄 合併模式（保留現有資料，新增/更新匯入資料）</option>
            <option value="replace">⚠️ 覆蓋模式（完全替換為匯入資料）</option>
          </select>
        </div>
        
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="cancelImport" class="action-btn" style="padding: 8px 16px;">
            取消
          </button>
          <button id="confirmImport" class="action-btn primary" style="padding: 8px 16px;">
            確認導入
          </button>
        </div>
      `;

      // 創建遮罩
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        z-index: 10000;
      `;

      document.body.appendChild(overlay);
      document.body.appendChild(dialog);

      // 綁定事件
      document.getElementById('cancelImport').onclick = () => {
        overlay.remove();
        dialog.remove();
      };

      document.getElementById('confirmImport').onclick = async () => {
        const mode = document.getElementById('importMode').value;

        try {
          const currentData = await chrome.storage.local.get();
          let finalData = {};

          if (mode === 'merge') {
            // 合併模式：保留現有資料，合併新資料
            finalData = { ...currentData };

            // 合併各個字段
            Object.keys(importedData).forEach(key => {
              if (key === 'version' || key === 'exportDate' || key === 'exportType') {
                return; // 跳過元數據
              }

              if (typeof importedData[key] === 'object' && !Array.isArray(importedData[key])) {
                // 對象類型：合併
                finalData[key] = { ...(currentData[key] || {}), ...importedData[key] };
              } else if (Array.isArray(importedData[key])) {
                // 陣列類型：合併並去重（基於時間戳）
                const current = currentData[key] || [];
                const imported = importedData[key];
                const combined = [...current, ...imported];

                // 去重（針對快照和歷史記錄）
                const seen = new Set();
                finalData[key] = combined.filter(item => {
                  const id = item.timestamp || item.id || JSON.stringify(item);
                  if (seen.has(id)) return false;
                  seen.add(id);
                  return true;
                });
              } else {
                // 基本類型：使用導入的值
                finalData[key] = importedData[key];
              }
            });
          } else {
            // 覆蓋模式：完全替換
            finalData = { ...importedData };
            delete finalData.version;
            delete finalData.exportDate;
            delete finalData.exportType;
          }

          // 保存資料
          await chrome.storage.local.set(finalData);

          overlay.remove();
          dialog.remove();

          await logChange(`導入資料：${typeNames[importType]}（${mode === 'merge' ? '合併' : '覆蓋'}模式）`);
          alert('✅ 導入成功！頁面將重新載入...');

          // 重新載入頁面
          setTimeout(() => location.reload(), 500);
        } catch (error) {
          console.error('Import failed:', error);
          alert('❌ 導入失敗：' + error.message);
        }
      };
    } catch (error) {
      console.error('Import failed:', error);
      alert('❌ 導入失敗：' + error.message);
    }
  };

  input.click();
}

/**
 * 重置所有資料
 */
async function resetAllData() {
  if (!confirm('⚠️ 警告：此操作將清除所有自定義配置、群組、快照和歷史記錄。\n\n確定要繼續嗎？')) {
    return;
  }

  if (!confirm('⚠️ 最後確認：所有資料將被永久刪除，無法恢復！\n\n確定要繼續嗎？')) {
    return;
  }

  try {
    await chrome.storage.local.clear();
    await logChange('重置所有資料');
    alert('✅ 已重置所有資料，頁面將重新載入...');
    setTimeout(() => location.reload(), 500);
  } catch (error) {
    console.error('Reset failed:', error);
    alert('❌ 重置失敗：' + error.message);
  }
}

/**
 * 備份後重置
 */
async function backupBeforeReset() {
  try {
    // 先導出完整備份
    const data = await chrome.storage.local.get();
    const backupData = {
      version: '2.1',
      exportDate: new Date().toISOString(),
      exportType: 'all',
      ...data
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `extension-manager-backup-before-reset-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);

    // 詢問是否繼續重置
    if (confirm('✅ 備份已下載！\n\n現在要繼續重置所有資料嗎？')) {
      await resetAllData();
    }
  } catch (error) {
    console.error('Backup failed:', error);
    alert('❌ 備份失敗：' + error.message);
  }
}

/**
 * 匯出擴充功能清單（完整版，包含元數據）
 */
async function exportExtensionList() {
  try {
    const extensionList = allExtensions.map(ext => ({
      name: ext.name,
      id: ext.id,
      version: ext.version,
      enabled: ext.enabled,
      group: ext.group,
      deviceGroup: ext.deviceGroup,
      description: ext.customDesc || ext.description,
      permissions: ext.permissions || [],
      hostPermissions: ext.hostPermissions || [],
      metadata: ext.metadata || null
    }));

    const exportData = {
      version: '2.0',
      extensions: extensionList,
      totalCount: extensionList.length,
      enabledCount: extensionList.filter(e => e.enabled).length,
      exportDate: new Date().toISOString(),
      deviceGroupNames: deviceGroupNames,
      groupNames: groupNames,
      groupCounts: {},
      deviceCounts: {}
    };

    // 計算群組統計
    Object.keys(groupNames).forEach(group => {
      if (group !== 'all') {
        exportData.groupCounts[group] = extensionList.filter(e => e.group === group).length;
      }
    });

    Object.keys(deviceGroupNames).forEach(device => {
      if (device !== 'all_devices') {
        exportData.deviceCounts[device] = extensionList.filter(e => e.deviceGroup === device).length;
      }
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `chrome-extensions-list-v2-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    await logChange(`匯出擴充功能清單（v2.0，${extensionList.length} 個項目）`);

    alert(`✅ 已成功匯出 ${extensionList.length} 個擴充功能`);

  } catch (error) {
    console.error('Export failed:', error);
    alert('匯出失敗：' + error.message);
  }
}

console.log('Options v2.0 Part 4 loaded: Import/Export');
