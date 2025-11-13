// Chrome 擴充功能管理器 v2.0 - 主要邏輯處理
// 完整重構版本，支持：元數據、雙重群組、保留記錄、完善導入等

// ==================== 常量定義 ====================
const STORAGE_KEYS = {
  // 現有
  extensionGroups: 'extensionGroups',
  extensionDescriptions: 'extensionDescriptions',
  customGroupNames: 'customGroupNames',
  theme: 'theme',
  autoSnapshot: 'autoSnapshot',
  snapshots: 'snapshots',
  changeHistory: 'changeHistory',
  cardWidth: 'cardWidth',
  cardHeight: 'cardHeight',
  cardSize: 'cardSize',
  
  // v2.0 新增
  deviceGroupNames: 'deviceGroupNames',
  extensionDeviceGroups: 'extensionDeviceGroups',
  extensionMetadata: 'extensionMetadata',
  deletedExtensions: 'deletedExtensions',
  currentFilters: 'currentFilters',
  archiveWarningDismissed: 'archiveWarningDismissed',
  archiveNeedsCleanup: 'archiveNeedsCleanup'
};

// ==================== 全域變數 ====================
let allExtensions = [];
let filteredExtensions = [];
let deletedExtensions = [];

// 當前篩選狀態
let currentFilters = {
  functionalGroup: 'all',
  deviceGroup: 'all_devices',
  viewMode: 'active' // 'active' | 'deleted'
};

// 排序狀態（只有在用戶點擊排序按鈕時才為 true）
let userRequestedSort = false;
let currentSortMode = null; // 'status' | 'name' | null

// 群組數據
let groupNames = {
  'all': '所有擴充功能',
  'adblocker': '🛡️ 廣告封鎖與隱私',
  'ai': '🤖 AI助手與聊天',
  'productivity': '📌 生產力工具',
  'dev': '💻 開發工具',
  'screenshot': '📸 截圖與複製',
  'youtube': '🎬 YouTube工具',
  'translate': '🌐 翻譯工具',
  'scraper': '🔍 資料抓取',
  'other': '🔧 其他工具'
};

let deviceGroupNames = {};
let extensionGroups = {};
let extensionDeviceGroups = {};
let extensionDescriptions = {};
let extensionMetadata = {};

// DOM 元素
let mainContent, loadingState, groupList, deviceGroupFilter;

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

// ==================== 數據載入 ====================

/**
 * 初始化主題
 */
async function initTheme() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.theme, STORAGE_KEYS.cardSize]);
  const theme = result.theme || 'dark';
  const cardSize = result.cardSize || 'normal';
  document.body.setAttribute('data-theme', theme);
  
  const grid = document.querySelector('.extensions-grid');
  if (grid) {
    grid.className = `extensions-grid ${cardSize}`;
  }
}

/**
 * 載入所有儲存的資料
 */
async function loadStorageData() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.extensionGroups,
    STORAGE_KEYS.extensionDescriptions,
    STORAGE_KEYS.customGroupNames,
    STORAGE_KEYS.deviceGroupNames,
    STORAGE_KEYS.extensionDeviceGroups,
    STORAGE_KEYS.extensionMetadata,
    STORAGE_KEYS.deletedExtensions,
    STORAGE_KEYS.currentFilters
  ]);
  
  extensionGroups = result.extensionGroups || {};
  extensionDescriptions = result.extensionDescriptions || {};
  extensionMetadata = result.extensionMetadata || {};
  deletedExtensions = result.deletedExtensions || [];
  
  // 合併自定義群組名稱
  if (result.customGroupNames) {
    groupNames = { ...groupNames, ...result.customGroupNames };
  }
  
  // 載入設備群組
  deviceGroupNames = result.deviceGroupNames || {
    'all_devices': '🌐 所有設備',
    'desktop_main': '🖥️ 主力機',
    'laptop_portable': '💻 外出筆電'
  };
  
  extensionDeviceGroups = result.extensionDeviceGroups || {};
  
  // 恢復篩選狀態
  if (result.currentFilters) {
    currentFilters = { ...currentFilters, ...result.currentFilters };
  }
  
  console.log('Storage data loaded', {
    extensions: Object.keys(extensionGroups).length,
    devices: Object.keys(deviceGroupNames).length,
    deleted: deletedExtensions.length
  });
}

/**
 * 載入所有擴充功能
 */
async function loadExtensions() {
  try {
    const extensions = await chrome.management.getAll();
    allExtensions = extensions.filter(ext => 
      ext.type === 'extension' && 
      ext.id !== chrome.runtime.id
    );
    
    console.log('Loaded extensions:', allExtensions.length);
    
    // 合併數據
    allExtensions.forEach(ext => {
      ext.group = extensionGroups[ext.id] || 'other';
      ext.deviceGroup = extensionDeviceGroups[ext.id] || 'all_devices';
      ext.customDesc = extensionDescriptions[ext.id] || '';
      ext.metadata = extensionMetadata[ext.id] || null;
      ext.isDeleted = false;
      ext.isAvailable = true;
    });
    
    // 合併已刪除的擴充功能（用於顯示）
    const deletedWithData = deletedExtensions.map(d => ({
      id: d.id,
      name: `[已刪除] ${d.metadata?.groupHistory?.[0]?.functionalGroup || 'Unknown'}`,
      group: d.functionalGroup,
      deviceGroup: d.deviceGroup,
      customDesc: d.customDesc,
      metadata: d.metadata,
      isDeleted: true,
      isAvailable: false,
      deleteTime: d.deleteTime,
      deleteType: d.deleteType
    }));
    
    filteredExtensions = [...allExtensions];
    
    updateGroupCounts();
    updateDeviceFilter();
    updateArchiveCounts();
    updateStatistics();
    renderGroupList();
    
    loadingState.style.display = 'none';
  } catch (error) {
    console.error('Failed to load extensions:', error);
    loadingState.textContent = '載入失敗';
  }
}

// ==================== 篩選邏輯 ====================

/**
 * 應用雙重篩選
 */
function applyFilters() {
  let filtered = allExtensions;
  
  // 按設備群組篩選
  if (currentFilters.deviceGroup !== 'all_devices') {
    filtered = filtered.filter(ext => ext.deviceGroup === currentFilters.deviceGroup);
  }
  
  // 按功能群組篩選
  if (currentFilters.functionalGroup !== 'all') {
    filtered = filtered.filter(ext => ext.group === currentFilters.functionalGroup);
  }
  
  filteredExtensions = filtered;
  return filtered;
}

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
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 12px; color: var(--text-primary); font-weight: 600;">
              快照 #${snapshots.length - index}
            </div>
            <div style="font-size: 11px; color: var(--text-secondary);">
              ${getTimeAgo(snapshot.timestamp)}
            </div>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">
            ${snapshot.count} 個擴充功能 • ${snapshot.type === 'manual' ? '手動' : '自動'}
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

// ==================== 設備群組管理 ====================

/**
 * 初始化設備篩選器
 */
function initDeviceFilter() {
  const deviceGroupList = document.getElementById('deviceGroupList');
  if (!deviceGroupList) return;
  
  renderDeviceGroupList();
  
  // 綁定點擊事件
  deviceGroupList.addEventListener('click', (e) => {
    const item = e.target.closest('.device-group-item');
    if (!item) return;
    
    const deviceGroup = item.dataset.deviceGroup;
    currentFilters.deviceGroup = deviceGroup;
    saveCurrentFilters();
    
    // 更新UI
    document.querySelectorAll('.device-group-item').forEach(el => el.classList.remove('active'));
    item.classList.add('active');
    
    // 刷新顯示
    applyFilters();
    updateGroupCounts();
    renderGroupList();
    renderExtensions();
  });
}

/**
 * 渲染設備群組列表
 */
function renderDeviceGroupList() {
  const deviceGroupList = document.getElementById('deviceGroupList');
  if (!deviceGroupList) return;
  
  deviceGroupList.innerHTML = Object.entries(deviceGroupNames)
    .map(([id, name]) => {
      const isActive = id === currentFilters.deviceGroup ? 'active' : '';
      const count = allExtensions.filter(ext => 
        id === 'all_devices' ? true : ext.deviceGroup === id
      ).length;
      const canEdit = id.startsWith('device_'); // 只允許編輯自定義設備群組
      
      return `
        <li class="device-group-item ${isActive}" data-device-group="${id}" style="padding: 14px 16px; margin-bottom: 6px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: var(--text-primary); position: relative;">
          <span style="flex: 1;" ${canEdit ? `ondblclick="editDeviceGroupName('${id}')" title="雙擊編輯"` : ''}>${name}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
          <span class="count" style="background: var(--bg-tertiary); padding: 4px 8px; border-radius: 12px; font-size: 12px; color: var(--text-secondary); min-width: 24px; text-align: center;">${count}</span>
            ${canEdit ? `
              <button onclick="editDeviceGroupName('${id}'); event.stopPropagation();" style="background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 4px; font-size: 14px;" title="編輯名稱">✏️</button>
            ` : ''}
          </div>
        </li>
      `;
    }).join('');
}

/**
 * 新增設備群組
 */
async function addDeviceGroup() {
  const name = prompt('請輸入新設備群組的名稱：');
  if (!name || name.trim() === '') return;
  
  const groupId = `device_${Date.now()}`;
  const displayName = `💻 ${name.trim()}`;
  
  deviceGroupNames[groupId] = displayName;
  
  await chrome.storage.local.set({
    [STORAGE_KEYS.deviceGroupNames]: deviceGroupNames
  });
  
  renderDeviceGroupList();
  updateGroupCounts();
  renderExtensions();
  await logChange(`新增設備群組：${displayName}`);
  
  alert(`已成功新增設備群組「${displayName}」`);
}

/**
 * 編輯設備群組名稱
 */
async function editDeviceGroupName(groupId) {
  if (!groupId.startsWith('device_')) {
    alert('只能編輯自定義設備群組');
    return;
  }
  
  const currentName = deviceGroupNames[groupId];
  const newName = prompt('編輯設備群組名稱：', currentName);
  
  if (!newName || newName.trim() === '' || newName === currentName) {
    return;
  }
  
  const oldName = currentName;
  deviceGroupNames[groupId] = newName.trim();
  
  await chrome.storage.local.set({
    [STORAGE_KEYS.deviceGroupNames]: deviceGroupNames
  });
  
  renderDeviceGroupList();
  await logChange(`編輯設備群組：${oldName} → ${newName.trim()}`);
  
  alert(`已成功更新設備群組名稱為「${newName.trim()}」`);
}

/**
 * 刪除設備群組
 */
async function deleteDeviceGroup(groupId) {
  if (groupId === 'all_devices') {
    alert('無法刪除「所有設備」群組');
    return;
  }
  
  const groupName = deviceGroupNames[groupId];
  const extensionsInGroup = allExtensions.filter(ext => ext.deviceGroup === groupId);
  
  // 二次確認
  const firstConfirm = window.confirm(
    `確定要刪除設備群組「${groupName}」嗎？\n\n` +
    `此群組中有 ${extensionsInGroup.length} 個擴充功能。`
  );
  
  if (!firstConfirm) return;
  
  if (extensionsInGroup.length > 0) {
    const secondConfirm = window.confirm(
      `⚠️ 再次確認\n\n` +
      `刪除後，這 ${extensionsInGroup.length} 個擴充功能將被移到「所有設備」群組。\n` +
      `確定要繼續嗎？`
    );
    
    if (!secondConfirm) return;
    
    // 移動擴充功能到「所有設備」
    extensionsInGroup.forEach(ext => {
      ext.deviceGroup = 'all_devices';
      extensionDeviceGroups[ext.id] = 'all_devices';
    });
    
    await chrome.storage.local.set({
      [STORAGE_KEYS.extensionDeviceGroups]: extensionDeviceGroups
    });
  }
  
  delete deviceGroupNames[groupId];
  
  await chrome.storage.local.set({
    [STORAGE_KEYS.deviceGroupNames]: deviceGroupNames
  });
  
  if (currentFilters.deviceGroup === groupId) {
    currentFilters.deviceGroup = 'all_devices';
  }
  
  renderDeviceGroupList();
  updateGroupCounts();
  renderExtensions();
  await logChange(`刪除設備群組：${groupName}`);
  
  alert(`已成功刪除設備群組「${groupName}」`);
}

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
window.dismissArchiveWarning = async function(permanent) {
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

window.goToArchiveManagement = async function() {
  const dialog = document.querySelector('.modal-backdrop');
  if (dialog) dialog.remove();
  
  await showArchiveView('deleted');
};

/**
 * 返回管理器視圖
 */
window.backToManagerView = async function() {
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

/**
 * 保存當前篩選狀態
 */
async function saveCurrentFilters() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.currentFilters]: currentFilters
  });
}

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

// ==================== 待續：第2部分 ====================
// 接下來將實現：
// - 渲染擴充功能列表（支持雙重群組標籤）
// - 導入功能完整實現
// - 群組管理功能
// - 詳細記錄展示
// 等等...

console.log('Options v2.0 module loaded (Part 1/3)');

// Chrome 擴充功能管理器 v2.0 - Part 2: 渲染和視圖管理
// 此文件將與 options-v2.js 合併

// ==================== 視圖管理 ====================

/**
 * 顯示指定視圖
 */
async function showView(view, targetButton = null) {
  console.log('Switching to view:', view);
  
  // 更新導航按鈕狀態
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  if (targetButton) {
    targetButton.classList.add('active');
  } else {
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => {
      if (btn.getAttribute('data-view') === view) {
        btn.classList.add('active');
      }
    });
  }
  
  try {
    switch(view) {
      case 'manager':
        mainContent.innerHTML = getManagerView();
        await initManagerView();
        break;
      case 'history':
        mainContent.innerHTML = getHistoryView();
        await initHistoryView();
        break;
      case 'settings':
        mainContent.innerHTML = getSettingsView();
        await initSettingsView();
        break;
    }
    
    await logChange(`切換到${view}視圖`);
  } catch (error) {
    console.error('View switch error:', error);
    mainContent.innerHTML = `<div style="padding: 20px; color: var(--warning-color);">載入視圖時發生錯誤：${error.message}</div>`;
  }
}

/**
 * 獲取管理器視圖HTML
 */
function getManagerView() {
  return `
    <!-- 統一工具欄 -->
    <div class="toolbar">
      <div class="search-box">
        <input type="text" placeholder="搜尋擴充功能..." id="searchInput">
      </div>
      <button class="filter-btn" data-action="sortByStatus">📊 狀態排序</button>
      <button class="filter-btn" data-action="sortByName">🔤 名稱排序</button>
      <button class="action-btn primary" data-action="createSnapshot">📸 建立快照</button>
      <button class="action-btn" data-action="refreshExtensions" title="重新載入擴充功能狀態">🔄 刷新</button>
      <div style="margin-left: auto; font-size: 14px; color: var(--text-secondary);">
        目前篩選：
        <span id="currentFilterDisplay" style="color: var(--accent-color); font-weight: 600;">
          ${deviceGroupNames[currentFilters.deviceGroup] || '所有設備'} / 
          ${groupNames[currentFilters.functionalGroup] || '所有擴充功能'}
        </span>
      </div>
    </div>

    <!-- 擴充功能列表 -->
    <div class="extensions-grid" id="extensionsList">
      <!-- 動態生成的擴充功能卡片 -->
    </div>
  `;
}

/**
 * 獲取歷史記錄視圖HTML
 */
function getHistoryView() {
  return `
    <div style="padding: 20px;">
      <h2 style="margin-bottom: 24px; color: var(--text-primary);">📝 變更歷史記錄</h2>
      
      <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px;">
        <div class="toolbar" style="margin-bottom: 16px;">
          <input type="date" id="dateFilter" style="padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--card-bg); color: var(--text-primary);">
          <button class="filter-btn" data-action="filterByDate">篩選日期</button>
          <button class="action-btn" data-action="exportHistory">匯出記錄</button>
          <button class="action-btn danger" data-action="clearHistory">清除記錄</button>
        </div>
        
        <div id="historyList">
          <!-- 動態生成歷史記錄 -->
        </div>
      </div>
    </div>
  `;
}

/**
 * 獲取設定視圖HTML
 */
function getSettingsView() {
  const currentTheme = document.body.getAttribute('data-theme') || 'dark';
  
  return `
    <div style="padding: 20px;">
      <h2 style="margin-bottom: 24px; color: var(--text-primary);">⚙️ 擴充功能管理器設定</h2>
      
      <div style="display: grid; gap: 24px;">
        <!-- 外觀設定 -->
        <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px;">
          <h3 style="margin-bottom: 16px; color: var(--text-primary);">外觀設定</h3>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; color: var(--text-primary);">主題選擇</label>
            <div style="display: flex; align-items: center; gap: 10px;">
              <select id="themeSelect" style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--card-bg); color: var(--text-primary); width: 200px;">
                <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>🌙 Monokai 暗色主題</option>
                <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>☀️ 明亮主題</option>
              </select>
              <button class="action-btn" data-action="resetTheme" title="還原預設主題">↻ 還原</button>
            </div>
          </div>
        </div>
        
        <!-- 資料管理 -->
        <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px;">
          <h3 style="margin-bottom: 16px; color: var(--text-primary);">資料管理</h3>
          
          <div style="margin-bottom: 16px;">
            <button class="action-btn primary" data-action="showImportDialog">📥 完整導入功能</button>
            <small style="display: block; color: var(--text-secondary); margin-top: 4px;">
              使用完整導入對話框，支援多種模式和群組選擇
            </small>
          </div>
          
          <div style="margin-bottom: 16px;">
            <button class="action-btn primary" data-action="showExportDialog">📤 完整導出功能</button>
            <small style="display: block; color: var(--text-secondary); margin-top: 4px;">
              選擇特定設備群組或功能類別進行導出
            </small>
          </div>
          
          <div style="display: flex; gap: 12px;">
            <button class="action-btn" data-action="exportData">快速匯出</button>
            <button class="action-btn" data-action="importData">快速匯入</button>
          </div>
        </div>
        
        <!-- 群組管理 -->
        <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px;">
          <h3 style="margin-bottom: 16px; color: var(--text-primary);">群組管理</h3>
          
          <div style="margin-bottom: 16px;">
            <button class="action-btn" data-action="manageFunctionalGroups">⚙️ 管理功能分類</button>
            <small style="display: block; color: var(--text-secondary); margin-top: 4px;">
              編輯、新增、刪除功能分類群組
            </small>
          </div>
          
          <div>
            <button class="action-btn" data-action="manageDeviceGroupsDetailed">⚙️ 管理設備分類</button>
            <small style="display: block; color: var(--text-secondary); margin-top: 4px;">
              編輯、新增、刪除設備分類群組
            </small>
          </div>
        </div>

        <!-- 設備群組快速管理 -->
        <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px;">
          <h3 style="margin-bottom: 16px; color: var(--text-primary);">設備群組管理</h3>
          
          <div id="deviceGroupsList" style="margin-bottom: 16px;">
            <!-- 動態生成 -->
          </div>
          
          <button class="action-btn primary" data-action="addDeviceGroup">+ 新增設備群組</button>
        </div>
      </div>
    </div>
  `;
}

// ==================== 初始化視圖 ====================

/**
 * 初始化管理器視圖
 */
async function initManagerView() {
  try {
    await renderExtensions();
    initSearch();
    initActionHandlers();
    
    // 更新右側面板
    await updateRecentChanges();
    await updateSnapshotsList();
  } catch (error) {
    console.error('Failed to initialize manager view:', error);
  }
}

/**
 * 初始化歷史記錄視圖
 */
async function initHistoryView() {
  await loadHistoryList();
  initActionHandlers();
}

/**
 * 初始化設定視圖
 */
async function initSettingsView() {
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => changeTheme(e.target.value));
  }
  
  renderDeviceGroupsList();
  initActionHandlers();
}

// ==================== 擴充功能渲染 ====================

/**
 * 渲染擴充功能列表（支援雙重群組標籤）
 */
async function renderExtensions(filter = '') {
  const container = document.getElementById('extensionsList');
  if (!container) return;
  
  // 應用篩選
  let displayExtensions = applyFilters();
  
  // 搜尋篩選
  if (filter) {
    displayExtensions = displayExtensions.filter(ext => 
      ext.name.toLowerCase().includes(filter.toLowerCase()) ||
      ext.id.includes(filter.toLowerCase()) ||
      (ext.customDesc && ext.customDesc.toLowerCase().includes(filter.toLowerCase()))
    );
  }
  
  // 只有在用戶請求排序時才應用排序
  if (userRequestedSort && currentSortMode) {
    if (currentSortMode === 'status') {
      displayExtensions = [...displayExtensions].sort((a, b) => {
        if (a.enabled === b.enabled) {
          return a.name.localeCompare(b.name, 'zh-TW');
        }
        return b.enabled - a.enabled;
      });
    } else if (currentSortMode === 'name') {
      displayExtensions = [...displayExtensions].sort((a, b) => 
        a.name.localeCompare(b.name, 'zh-TW')
      );
    }
  }

  if (displayExtensions.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        沒有找到符合條件的擴充功能
      </div>
    `;
    return;
  }

  container.innerHTML = displayExtensions.map(ext => {
    const iconUrl = getExtensionIconUrl(ext);
    const description = ext.customDesc || getDefaultDescription(ext) || '點擊添加描述...';
    const installTime = ext.metadata?.installTime ? 
      formatDate(ext.metadata.installTime) : '未知';
    
    return `
      <div class="extension-card" draggable="true" data-id="${ext.id}">
        <div class="extension-toggle">
          <div class="toggle-switch ${ext.enabled ? 'active' : ''}" 
               data-action="toggleExtension" data-ext-id="${ext.id}"></div>
        </div>
        <div class="extension-header">
          <div class="extension-icon" id="icon-${ext.id}">
            <img src="${iconUrl}" 
                 data-ext-id="${ext.id}"
                 class="ext-icon-img"
                 onerror="showFallbackIcon('${ext.id}')"
                 onload="hideFallbackIcon('${ext.id}')"
                 style="width: 80%; height: 80%; object-fit: contain; border-radius: 8px;">
            <div class="fallback-icon" id="fallback-${ext.id}" style="display:none; width:100%; height:100%; align-items:center; justify-content:center; background: linear-gradient(135deg, var(--accent-color), var(--success-color)); border-radius: 8px; color: var(--bg-primary); font-size: 20px; position: absolute; top: 0; left: 0;">
              🔠
            </div>
          </div>
          <div class="extension-info">
            <div class="extension-name" title="${ext.name}">${ext.name}</div>
            <div class="extension-meta" title="版本 ${ext.version}">v${ext.version}</div>
          </div>
        </div>
        
        <!-- 雙重群組標籤 -->
        <div class="group-tags" style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
          <span class="tag functional" style="display: inline-block; padding: 3px 8px; background: linear-gradient(135deg, var(--accent-color), var(--success-color)); color: white; border-radius: 12px; font-size: 11px; font-weight: 500;" 
                title="功能分類" onclick="filterByGroup('${ext.group}')">
            ${groupNames[ext.group] || ext.group}
          </span>
          <span class="tag device" style="display: inline-block; padding: 3px 8px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 12px; font-size: 11px;" 
                title="設備分類" onclick="filterByDevice('${ext.deviceGroup}')">
            ${deviceGroupNames[ext.deviceGroup] || ext.deviceGroup}
          </span>
        </div>
        
        <div class="extension-description" 
             contenteditable="true" 
             data-ext-id="${ext.id}"
             data-action="editDescription"
             data-placeholder="點擊添加描述..."
             onblur="saveDescription('${ext.id}', this.textContent, this)"
             onkeydown="handleDescriptionKeydown(event)">${description}</div>
        
        <!-- 元數據摘要 -->
        <div class="metadata-summary" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">
          <small>安裝於 ${installTime}</small>
        </div>
        
        <div class="extension-actions">
          <button class="extension-btn" data-action="openOptions" data-ext-id="${ext.id}" title="設定">⚙️</button>
          <button class="extension-btn" data-action="showDetails" data-ext-id="${ext.id}" title="詳情">📊</button>
          <button class="extension-btn" data-action="uninstallExtension" data-ext-id="${ext.id}" title="卸載">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  
  // 初始化拖放
  initDragAndDrop();
}

/**
 * 渲染群組列表
 */
function renderGroupList() {
  if (!groupList) return;
  
  const groupEntries = Object.entries(groupNames);
  
  groupList.innerHTML = groupEntries.map(([groupId, groupName]) => {
    // 計算當前設備下的該群組數量
    let count = 0;
    let extensions = allExtensions;
    
    if (currentFilters.deviceGroup !== 'all_devices') {
      extensions = extensions.filter(ext => ext.deviceGroup === currentFilters.deviceGroup);
    }
    
    if (groupId === 'all') {
      count = extensions.length;
    } else {
      count = extensions.filter(ext => ext.group === groupId).length;
    }
    
    const isActive = currentFilters.functionalGroup === groupId ? 'active' : '';
    const isCustom = groupId.startsWith('custom_');
    
    return `
      <li class="group-item ${isActive}" data-group="${groupId}">
        <span class="group-name" data-action="editGroupName" data-group-id="${groupId}" ${groupId === 'all' ? '' : 'title="雙擊編輯群組名稱"'}>${groupName}</span>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span class="count">${count}</span>
          ${isCustom ? `<button class="group-delete-btn" data-action="deleteGroup" data-group-id="${groupId}" title="刪除群組" style="background: none; border: none; color: var(--warning-color); cursor: pointer; font-size: 12px;">×</button>` : ''}
        </div>
      </li>
    `;
  }).join('');
  
  // 綁定點擊事件
  document.querySelectorAll('.group-item').forEach(item => {
    item.addEventListener('click', async function(e) {
      if (e.target.classList.contains('group-name') && e.detail === 2) {
        return; // 雙擊編輯，不觸發切換
      }
      
      try {
        document.querySelectorAll('.group-item').forEach(g => g.classList.remove('active'));
        this.classList.add('active');
        currentFilters.functionalGroup = this.dataset.group;
        
        await saveCurrentFilters();
        applyFilters();
        updateGroupCounts();
        await renderExtensions();
        
        // 更新顯示
        const filterDisplay = document.getElementById('currentFilterDisplay');
        if (filterDisplay) {
          filterDisplay.textContent = `${deviceGroupNames[currentFilters.deviceGroup] || '所有設備'} / ${groupNames[currentFilters.functionalGroup] || '所有擴充功能'}`;
        }
      } catch (error) {
        console.error('Group selection error:', error);
      }
    });
  });
  
  // 雙擊編輯群組名稱
  document.querySelectorAll('[data-action="editGroupName"]').forEach(el => {
    el.addEventListener('dblclick', async function(e) {
      e.stopPropagation();
      const groupId = this.getAttribute('data-group-id');
      if (groupId && groupId !== 'all') {
        await editGroupName(groupId);
      }
    });
  });
}

/**
 * 渲染設備群組列表（設定頁）
 */
function renderDeviceGroupsList() {
  const container = document.getElementById('deviceGroupsList');
  if (!container) return;
  
  container.innerHTML = Object.entries(deviceGroupNames).map(([id, name]) => {
    const canDelete = id !== 'all_devices';
    const extensionCount = allExtensions.filter(ext => ext.deviceGroup === id).length;
    
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 8px;">
        <div>
          <strong style="color: var(--text-primary);">${name}</strong>
          <small style="display: block; color: var(--text-secondary); margin-top: 4px;">
            ${extensionCount} 個擴充功能
          </small>
        </div>
        ${canDelete ? `
          <button class="action-btn danger" data-action="deleteDeviceGroup" data-group-id="${id}" style="padding: 6px 12px; font-size: 12px;">
            刪除
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ==================== 輔助函數 ====================

/**
 * 獲取擴充功能圖標URL
 */
function getExtensionIconUrl(ext) {
  const possiblePaths = [
    `chrome-extension://${ext.id}/icon.png`,
    `chrome-extension://${ext.id}/icons/icon.png`,
    `chrome-extension://${ext.id}/images/icon.png`,
    `chrome-extension://${ext.id}/icon48.png`,
    `chrome-extension://${ext.id}/icons/48.png`
  ];
  
  if (ext.icons && ext.icons.length > 0) {
    const icon = ext.icons.find(i => i.size >= 48) || ext.icons[0];
    return icon.url;
  }
  
  return possiblePaths[0];
}

/**
 * 獲取擴充功能圖標（emoji fallback）
 */
function getExtensionIcon(ext) {
  const iconMap = {
    'bgnkhhnnamicmpeenaelnjfhikgbkllg': '🛡️',
    'ldadnegmmggmmgbijlnmjhcnjcpgkfdj': '🚫',
    'eimadpbcbfnmbkopoojfekhnkhdbieeh': '🌙',
    'onepmapfbjohnegdmfhndpefjkppbjkm': '📋',
    'ojnbohmppadfgpejeebfnmnknjdlckgj': '🤖',
    'ofpnmcalabcbjgholdjcjblkibolbppb': '🎯',
    'befflofjcniongenjmbkgkoljhgliihe': '🧠',
    'enkmmegahkfbohjlnmmmkiicmhoglnne': '📝',
    'knheggckgoiihginacbkhaalnibhilkk': '📌',
    'chphlpgkkbolifaimnlloiipkdnihall': '📑',
    'bkhaagjahfmjljalopjnoealnfndnagc': '🌳',
    'dhdgffkkebhmkfjojejmpbldmpobfkfo': '🐒'
  };
  
  return iconMap[ext.id] || '🔧';
}

/**
 * 獲取預設描述
 */
function getDefaultDescription(ext) {
  const descriptions = {
    'bgnkhhnnamicmpeenaelnjfhikgbkllg': '高效阻擋廣告，保護隱私',
    'eimadpbcbfnmbkopoojfekhnkhdbieeh': '自動為所有網站生成深色主題',
    'ojnbohmppadfgpejeebfnmnknjdlckgj': '提供大量專業提示詞',
    'ofpnmcalabcbjgholdjcjblkibolbppb': '整合多種AI模型的全能助手'
  };
  
  return descriptions[ext.id] || ext.description || '';
}

/**
 * 格式化日期
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days}天前`;
  if (days < 365) return `${Math.floor(days/30)}個月前`;
  return `${Math.floor(days/365)}年前`;
}

/**
 * 處理圖標錯誤
 */
window.handleIconError = function(extId, fallbackIcon) {
  const iconContainer = document.getElementById(`icon-${extId}`);
  if (iconContainer) {
    const img = iconContainer.querySelector('img');
    const fallback = iconContainer.querySelector('.fallback-icon');
    if (img) img.style.display = 'none';
    if (fallback) fallback.style.display = 'flex';
  }
};

/**
 * 處理圖標成功
 */
window.handleIconSuccess = function(extId) {
  const iconContainer = document.getElementById(`icon-${extId}`);
  if (iconContainer) {
    const fallback = iconContainer.querySelector('.fallback-icon');
    if (fallback) fallback.style.display = 'none';
  }
};

/**
 * 通過群組篩選
 */
window.filterByGroup = async function(groupId) {
  currentFilters.functionalGroup = groupId;
  await saveCurrentFilters();
  applyFilters();
  updateGroupCounts();
  await renderExtensions();
  renderGroupList();
};

/**
 * 通過設備篩選
 */
window.filterByDevice = async function(deviceId) {
  currentFilters.deviceGroup = deviceId;
  if (deviceGroupFilter) {
    deviceGroupFilter.value = deviceId;
  }
  await saveCurrentFilters();
  applyFilters();
  updateGroupCounts();
  await renderExtensions();
};

/**
 * 描述編輯鍵盤事件
 */
window.handleDescriptionKeydown = function(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    event.target.blur();
  }
  if (event.key === 'Escape') {
    event.target.blur();
  }
};

/**
 * 保存描述
 */
window.saveDescription = async function(id, newDesc, descElement) {
  const ext = allExtensions.find(e => e.id === id);
  if (!ext) return;
  
  const trimmedDesc = newDesc.trim();
  if (!trimmedDesc || trimmedDesc === '點擊添加描述...') {
    const defaultDesc = getDefaultDescription(ext);
    descElement.textContent = defaultDesc || '點擊添加描述...';
    return;
  }
  
  ext.customDesc = trimmedDesc;
  extensionDescriptions[id] = trimmedDesc;
  
  try {
    await chrome.storage.local.set({ 
      [STORAGE_KEYS.extensionDescriptions]: extensionDescriptions 
    });
    await logChange(`更新 ${ext.name} 的描述`);
  } catch (error) {
    console.error('Failed to save description:', error);
  }
};

console.log('Options v2.0 Part 2 loaded: Views & Rendering');

// Chrome 擴充功能管理器 v2.0 - Part 3: 核心功能（導入/導出/操作）

// ==================== 擴充功能操作 ====================

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

// ==================== 搜尋功能 ====================

/**
 * 初始化搜尋功能
 */
function initSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      await renderExtensions(e.target.value);
    }, 300);
  });
}

// ==================== 排序功能 ====================

/**
 * 按狀態排序
 */
async function sortByStatus() {
  userRequestedSort = true;
  currentSortMode = 'status';
  
  filteredExtensions = [...filteredExtensions].sort((a, b) => {
    if (a.enabled === b.enabled) {
      return a.name.localeCompare(b.name, 'zh-TW');
    }
    return b.enabled - a.enabled;
  });
  
  await renderExtensions();
  await logChange('執行狀態排序');
}

/**
 * 按名稱排序
 */
async function sortByName() {
  userRequestedSort = true;
  currentSortMode = 'name';
  
  filteredExtensions = [...filteredExtensions].sort((a, b) => 
    a.name.localeCompare(b.name, 'zh-TW')
  );
  
  await renderExtensions();
  await logChange('執行名稱排序');
}

// ==================== 拖放功能 ====================

/**
 * 初始化拖放功能
 */
function initDragAndDrop() {
  let draggedElement = null;
  let draggedExtensionId = null;

  document.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('extension-card')) {
      draggedElement = e.target;
      draggedExtensionId = e.target.dataset.id;
      e.target.classList.add('dragging');
      e.dataTransfer.setData('text/plain', draggedExtensionId);
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  document.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('extension-card')) {
      e.target.classList.remove('dragging');
      document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      document.querySelectorAll('.device-group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      draggedElement = null;
      draggedExtensionId = null;
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    
    const groupItem = e.target.closest('.group-item');
    const deviceGroupItem = e.target.closest('.device-group-item');
    
    if (groupItem && draggedExtensionId) {
      document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      document.querySelectorAll('.device-group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      groupItem.classList.add('drag-over');
    } else if (deviceGroupItem && draggedExtensionId) {
      document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      document.querySelectorAll('.device-group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      deviceGroupItem.classList.add('drag-over');
    }
  });
  
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    
    const groupItem = e.target.closest('.group-item');
    const deviceGroupItem = e.target.closest('.device-group-item');
    
    if (groupItem && draggedExtensionId) {
      const targetGroupId = groupItem.dataset.group;
      
      document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      
      if (targetGroupId !== 'all') {
        await moveExtensionToGroup(draggedExtensionId, targetGroupId);
      }
    } else if (deviceGroupItem && draggedExtensionId) {
      const targetDeviceGroupId = deviceGroupItem.dataset.deviceGroup;
      
      document.querySelectorAll('.device-group-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      
      if (targetDeviceGroupId !== 'all_devices') {
        await moveExtensionToDeviceGroup(draggedExtensionId, targetDeviceGroupId);
      }
    }
  });
}

/**
 * 移動擴充功能到群組
 */
async function moveExtensionToGroup(extensionId, targetGroupId) {
  const ext = allExtensions.find(e => e.id === extensionId);
  if (!ext) return;
  
  const oldGroup = ext.group;
  const oldGroupName = groupNames[oldGroup] || '未知群組';
  const newGroupName = groupNames[targetGroupId] || '未知群組';
  
  ext.group = targetGroupId;
  extensionGroups[extensionId] = targetGroupId;
  
  await chrome.storage.local.set({ 
    [STORAGE_KEYS.extensionGroups]: extensionGroups 
  });
  
  // 記錄群組變更
  chrome.runtime.sendMessage({
    type: 'UPDATE_GROUP',
    extensionId: extensionId,
    functionalGroup: targetGroupId,
    deviceGroup: ext.deviceGroup
  });
  
  updateGroupCounts();
  await renderExtensions();
  await logChange(`移動 ${ext.name}：${oldGroupName} → ${newGroupName}`);
}

/**
 * 移動擴充功能到設備群組
 */
async function moveExtensionToDeviceGroup(extensionId, targetDeviceGroupId) {
  const ext = allExtensions.find(e => e.id === extensionId);
  if (!ext) return;
  
  const oldDeviceGroup = ext.deviceGroup;
  const oldDeviceGroupName = deviceGroupNames[oldDeviceGroup] || '未知設備';
  const newDeviceGroupName = deviceGroupNames[targetDeviceGroupId] || '未知設備';
  
  ext.deviceGroup = targetDeviceGroupId;
  extensionDeviceGroups[extensionId] = targetDeviceGroupId;
  
  await chrome.storage.local.set({ 
    [STORAGE_KEYS.extensionDeviceGroups]: extensionDeviceGroups 
  });
  
  // 記錄設備群組變更
  chrome.runtime.sendMessage({
    type: 'UPDATE_GROUP',
    extensionId: extensionId,
    functionalGroup: ext.group,
    deviceGroup: targetDeviceGroupId
  });
  
  renderDeviceGroupList();
  updateGroupCounts();
  await renderExtensions();
  await logChange(`移動 ${ext.name}：${oldDeviceGroupName} → ${newDeviceGroupName}`);
}

// ==================== 群組管理 ====================

/**
 * 新增功能群組
 */
async function addNewGroup() {
  const groupName = prompt('請輸入新群組的名稱：');
  if (!groupName || groupName.trim() === '') return;
  
  const groupId = `custom_${Date.now()}`;
  const displayName = groupName.trim();
  
  groupNames[groupId] = displayName;
  
  const customGroups = {};
  Object.keys(groupNames).forEach(key => {
    if (key.startsWith('custom_')) {
      customGroups[key] = groupNames[key];
    }
  });
  
  await chrome.storage.local.set({ 
    [STORAGE_KEYS.customGroupNames]: customGroups 
  });
  
  renderGroupList();
  await logChange(`新增功能群組：${displayName}`);
}

/**
 * 編輯群組名稱
 */
async function editGroupName(groupId) {
  if (groupId === 'all') {
    alert('無法編輯「所有擴充功能」群組');
    return;
  }
  
  const currentName = groupNames[groupId];
  const newName = prompt('編輯群組名稱：', currentName);
  
  if (!newName || newName.trim() === '' || newName === currentName) {
    return;
  }
  
  groupNames[groupId] = newName.trim();
  
  const customGroups = {};
  Object.keys(groupNames).forEach(key => {
    if (key.startsWith('custom_')) {
      customGroups[key] = groupNames[key];
    }
  });
  
  await chrome.storage.local.set({ 
    [STORAGE_KEYS.customGroupNames]: customGroups 
  });
  
  renderGroupList();
  await logChange(`重新命名群組：${currentName} → ${newName.trim()}`);
}

/**
 * 刪除群組
 */
async function deleteGroup(groupId) {
  if (groupId === 'all' || !groupId.startsWith('custom_')) {
    alert('只能刪除自定義群組');
    return;
  }
  
  const groupName = groupNames[groupId];
  const extensionsInGroup = allExtensions.filter(ext => ext.group === groupId);
  
  if (extensionsInGroup.length > 0) {
    const moveToOther = confirm(
      `群組「${groupName}」中有 ${extensionsInGroup.length} 個擴充功能。\n\n` +
      `確定要刪除嗎？這些擴充功能將被移到「其他工具」群組。`
    );
    
    if (!moveToOther) return;
    
    extensionsInGroup.forEach(ext => {
      ext.group = 'other';
      extensionGroups[ext.id] = 'other';
    });
    
    await chrome.storage.local.set({ 
      [STORAGE_KEYS.extensionGroups]: extensionGroups 
    });
  }
  
  delete groupNames[groupId];
  
  const customGroups = {};
  Object.keys(groupNames).forEach(key => {
    if (key.startsWith('custom_')) {
      customGroups[key] = groupNames[key];
    }
  });
  
  await chrome.storage.local.set({ 
    [STORAGE_KEYS.customGroupNames]: customGroups 
  });
  
  if (currentFilters.functionalGroup === groupId) {
    currentFilters.functionalGroup = 'all';
  }
  
  renderGroupList();
  updateGroupCounts();
  await renderExtensions();
  await logChange(`刪除群組：${groupName}`);
}

// ==================== 快照功能 ====================

/**
 * 建立快照
 */
async function createSnapshot() {
  try {
    const enabledExtensions = allExtensions.filter(ext => ext.enabled);
    const snapshot = {
      id: Date.now(),
      timestamp: Date.now(),
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
    
    const result = await chrome.storage.local.get([STORAGE_KEYS.snapshots]);
    const snapshots = result.snapshots || [];
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
                      快照 #${snapshots.length - index}
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                      ${snapshot.date}
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 14px; color: var(--accent-color); font-weight: 600;">
                      ${snapshot.count} 個擴充功能
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary);">
                      ${snapshot.type === 'manual' ? '手動建立' : '自動建立'}
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

// ==================== 主題切換 ====================

/**
 * 切換主題
 */
async function changeTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  await chrome.storage.local.set({ [STORAGE_KEYS.theme]: theme });
  await logChange(`切換到${theme === 'dark' ? 'Monokai暗色' : '明亮'}主題`);
}

/**
 * 還原預設主題
 */
async function resetTheme() {
  const defaultTheme = 'dark';
  document.body.setAttribute('data-theme', defaultTheme);
  await chrome.storage.local.set({ [STORAGE_KEYS.theme]: defaultTheme });
  
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.value = defaultTheme;
  }
  
  await logChange('還原預設主題');
}

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
window.closeImportDialog = function() {
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
window.openAddGroupDialog = function(type) {
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
async function exportData() {
  try {
    const data = await chrome.storage.local.get();
    const exportData = {
      version: '2.0',
      extensionGroups: data.extensionGroups || {},
      extensionDeviceGroups: data.extensionDeviceGroups || {},
      extensionDescriptions: data.extensionDescriptions || {},
      extensionMetadata: data.extensionMetadata || {},
      deviceGroupNames: data.deviceGroupNames || {},
      customGroupNames: data.customGroupNames || {},
      theme: data.theme || 'dark',
      autoSnapshot: data.autoSnapshot !== false,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `extension-manager-settings-v2-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    await logChange('匯出設定資料（v2.0）');
  } catch (error) {
    console.error('Export failed:', error);
    alert('匯出失敗');
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
      const data = JSON.parse(text);
      
      if (!confirm('確定要匯入設定嗎？這將覆蓋當前的設定。')) {
        return;
      }
      
      // 檢測版本
      const version = data.version || '1.0';
      
      if (version === '2.0') {
        // v2.0 格式，直接匯入
        await chrome.storage.local.set(data);
      } else {
        // v1.0 格式，轉換後匯入
        const converted = {
          extensionGroups: data.extensionGroups || {},
          extensionDescriptions: data.extensionDescriptions || {},
          customGroupNames: data.customGroupNames || {},
          theme: data.theme || 'dark',
          autoSnapshot: data.autoSnapshot !== false
        };
        await chrome.storage.local.set(converted);
      }
      
      await loadStorageData();
      await loadExtensions();
      alert('設定匯入成功！');
      await logChange(`匯入設定資料（${version}）`);
      
      // 刷新頁面
      location.reload();
      
    } catch (error) {
      console.error('Import failed:', error);
      alert('匯入失敗：' + error.message);
    }
  };
  
  input.click();
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

// ==================== CSS 動態樣式 ====================

/**
 * 添加必要的CSS樣式
 */
function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* 拖放高亮 */
    .group-item.drag-over {
      background-color: var(--accent-color) !important;
      color: var(--bg-primary) !important;
      transform: scale(1.02);
      box-shadow: 0 2px 8px rgba(102, 217, 239, 0.3);
    }
    
    /* 拖放中的卡片 */
    .extension-card.dragging {
      opacity: 0.6;
      transform: scale(0.98);
    }
    
    /* 保留記錄hover效果 */
    .archive-item[data-filter]:hover {
      border-color: var(--accent-color) !important;
      box-shadow: 0 2px 8px rgba(102, 217, 239, 0.2);
    }
    
    /* 群組標籤hover效果 */
    .tag.functional:hover,
    .tag.device:hover {
      opacity: 0.8;
      cursor: pointer;
    }
    
    /* 模態對話框動畫 */
    .modal-backdrop {
      animation: fadeIn 0.2s ease;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    
    /* 單選按鈕樣式 */
    .radio-option:hover {
      background: var(--card-bg) !important;
    }
    
    .radio-option input[type="radio"]:checked + .option-content strong {
      color: var(--accent-color);
    }
  `;
  
  document.head.appendChild(style);
  console.log('Custom styles injected');
}

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

// ==================== 調試輔助 ====================

/**
 * 開發者工具：查看當前狀態
 */
window.debugExtensionManager = function() {
  console.log('=== Extension Manager v2.0 Debug Info ===');
  console.log('All Extensions:', allExtensions.length);
  console.log('Filtered Extensions:', filteredExtensions.length);
  console.log('Deleted Extensions:', deletedExtensions.length);
  console.log('Current Filters:', currentFilters);
  console.log('Group Names:', groupNames);
  console.log('Device Group Names:', deviceGroupNames);
  console.log('Extension Groups:', Object.keys(extensionGroups).length);
  console.log('Extension Device Groups:', Object.keys(extensionDeviceGroups).length);
  console.log('Extension Metadata:', Object.keys(extensionMetadata).length);
  console.log('=========================================');
};

/**
 * 開發者工具：重置所有數據（慎用！）
 */
window.resetAllData = async function() {
  if (!confirm('⚠️ 警告：這將重置所有數據！\n\n確定要繼續嗎？')) {
    return;
  }
  
  try {
    await chrome.storage.local.clear();
    console.log('All data cleared');
    alert('數據已重置，即將重新載入...');
    location.reload();
  } catch (error) {
    console.error('Failed to reset data:', error);
    alert('重置失敗：' + error.message);
  }
};

// ==================== 錯誤恢復 ====================

/**
 * 全局錯誤處理
 */
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  
  // 可選：顯示用戶友好的錯誤提示
  if (event.error && event.error.message) {
    // 避免顯示過多錯誤提示
    if (!window.lastErrorTime || Date.now() - window.lastErrorTime > 5000) {
      console.warn('An error occurred. Check console for details.');
      window.lastErrorTime = Date.now();
    }
  }
});

/**
 * Promise rejection 處理
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

console.log('Options v2.0 Part 5 loaded: Event Handlers & Init');

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

function showFunctionalGroupsManager() {
  const dialog = document.createElement('div');
  dialog.className = 'modal-backdrop';
  dialog.id = 'functionalGroupsModal';
  dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;';
  
  dialog.innerHTML = `
    <div class="modal-content" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; width: 90%; max-width: 600px; max-height: 80vh; display: flex; flex-direction: column;">
      <div class="modal-header" style="padding: 20px; border-bottom: 1px solid var(--border-color);">
        <h2 style="margin: 0; color: var(--text-primary);">⚙️ 管理功能分類</h2>
      </div>
      
      <div style="padding: 20px; overflow-y: auto; flex: 1;">
        <div id="functionalGroupsList">
          ${Object.entries(groupNames).filter(([id]) => id !== 'all').map(([id, name]) => {
            const isCustom = id.startsWith('custom_');
            const count = allExtensions.filter(ext => ext.group === id).length;
            return `
              <div class="group-manager-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px;">
                <div style="flex: 1;">
                  <strong style="color: var(--text-primary); font-size: 14px;">${name}</strong>
                  <small style="display: block; color: var(--text-secondary); font-size: 12px; margin-top: 4px;">${count} 個擴充功能</small>
                </div>
                <div style="display: flex; gap: 8px;">
                  ${!isCustom ? `<button class="action-btn" onclick="editGroupName('${id}')" style="padding: 6px 12px; font-size: 12px;">✏️ 編輯</button>` : ''}
                  ${isCustom ? `
                    <button class="action-btn" onclick="editGroupName('${id}')" style="padding: 6px 12px; font-size: 12px;">✏️ 編輯</button>
                    <button class="action-btn danger" onclick="confirmDeleteGroup('${id}')" style="padding: 6px 12px; font-size: 12px;">🗑️ 刪除</button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <button class="action-btn primary" onclick="addNewFunctionalGroup()" style="width: 100%; margin-top: 16px; padding: 12px;">+ 新增功能分類</button>
      </div>
      
      <div class="modal-footer" style="padding: 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
        <button class="action-btn" onclick="closeFunctionalGroupsManager()">關閉</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
}

window.closeFunctionalGroupsManager = function() {
  const dialog = document.getElementById('functionalGroupsModal');
  if (dialog) dialog.remove();
};

window.addNewFunctionalGroup = async function() {
  const name = prompt('請輸入新功能分類的名稱：');
  if (!name || name.trim() === '') return;
  
  const groupId = `custom_${Date.now()}`;
  groupNames[groupId] = name.trim();
  
  const customGroups = {};
  Object.keys(groupNames).forEach(key => {
    if (key.startsWith('custom_')) {
      customGroups[key] = groupNames[key];
    }
  });
  
  await chrome.storage.local.set({ customGroupNames: customGroups });
  await logChange(`新增功能分類：${name.trim()}`);
  
  closeFunctionalGroupsManager();
  showFunctionalGroupsManager();
  
  alert(`已成功新增功能分類「${name.trim()}」`);
};

window.confirmDeleteGroup = async function(groupId) {
  await deleteGroup(groupId);
  closeFunctionalGroupsManager();
  showFunctionalGroupsManager();
};

function showDeviceGroupsManager() {
  const dialog = document.createElement('div');
  dialog.className = 'modal-backdrop';
  dialog.id = 'deviceGroupsModal';
  dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;';
  
  dialog.innerHTML = `
    <div class="modal-content" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; width: 90%; max-width: 600px; max-height: 80vh; display: flex; flex-direction: column;">
      <div class="modal-header" style="padding: 20px; border-bottom: 1px solid var(--border-color);">
        <h2 style="margin: 0; color: var(--text-primary);">⚙️ 管理設備分類</h2>
      </div>
      
      <div style="padding: 20px; overflow-y: auto; flex: 1;">
        <div id="deviceGroupsListDetailed">
          ${Object.entries(deviceGroupNames).filter(([id]) => id !== 'all_devices').map(([id, name]) => {
            const count = allExtensions.filter(ext => ext.deviceGroup === id).length;
            return `
              <div class="group-manager-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px;">
                <div style="flex: 1;">
                  <strong style="color: var(--text-primary); font-size: 14px;">${name}</strong>
                  <small style="display: block; color: var(--text-secondary); font-size: 12px; margin-top: 4px;">${count} 個擴充功能</small>
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="action-btn" onclick="editDeviceGroupName('${id}')" style="padding: 6px 12px; font-size: 12px;">✏️ 編輯</button>
                  <button class="action-btn danger" onclick="confirmDeleteDeviceGroup('${id}')" style="padding: 6px 12px; font-size: 12px;">🗑️ 刪除</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <button class="action-btn primary" onclick="addNewDeviceGroupFromManager()" style="width: 100%; margin-top: 16px; padding: 12px;">+ 新增設備分類</button>
      </div>
      
      <div class="modal-footer" style="padding: 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
        <button class="action-btn" onclick="closeDeviceGroupsManager()">關閉</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
}

window.closeDeviceGroupsManager = function() {
  const dialog = document.getElementById('deviceGroupsModal');
  if (dialog) dialog.remove();
};

window.addNewDeviceGroupFromManager = async function() {
  await addDeviceGroup();
  closeDeviceGroupsManager();
  showDeviceGroupsManager();
};

window.editDeviceGroupName = async function(groupId) {
  const currentName = deviceGroupNames[groupId];
  const newName = prompt('編輯設備群組名稱：', currentName);
  
  if (!newName || newName.trim() === '' || newName === currentName) return;
  
  deviceGroupNames[groupId] = newName.trim();
  
  await chrome.storage.local.set({ deviceGroupNames: deviceGroupNames });
  await logChange(`編輯設備群組：${currentName} → ${newName.trim()}`);
  
  renderDeviceGroupList();
  closeDeviceGroupsManager();
  showDeviceGroupsManager();
  
  alert(`已成功更新設備群組名稱`);
};

window.confirmDeleteDeviceGroup = async function(groupId) {
  await deleteDeviceGroup(groupId);
  closeDeviceGroupsManager();
  showDeviceGroupsManager();
};

console.log('Options v2.0 Part 6 loaded: Export Dialog & Group Managers');
console.log('=== Chrome Extension Manager v2.0 Fully Loaded ===');

