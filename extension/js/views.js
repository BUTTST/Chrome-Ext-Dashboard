// Chrome 擴充功能管理器 - 視圖管理
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
    switch (view) {
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
      <button class="action-btn" data-action="syncAllData" title="從商店同步所有評分與更新資訊">🔄 同步商店資料</button>
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

        <!-- v2.1 健康資訊顯示設定 -->
        <div class="settings-section-card">
          <h3 style="margin-bottom: 16px; color: var(--text-primary);">📊 擴充功能健康資訊</h3>
          <div class="settings-row">
            <div class="settings-info">
              <span class="settings-label">顯示評分 (⭐)</span>
              <span class="settings-desc">在卡片中顯示 Chrome Web Store 的評分</span>
            </div>
            <label class="switch">
              <input type="checkbox" id="showRatingToggle" ${displaySettings.showRating ? 'checked' : ''} onchange="updateDisplaySetting('showRating', this.checked)">
              <span class="slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-info">
              <span class="settings-label">顯示使用者人數 (👤)</span>
              <span class="settings-desc">在卡片中顯示下載使用者總數</span>
            </div>
            <label class="switch">
              <input type="checkbox" id="showUserCountToggle" ${displaySettings.showUserCount ? 'checked' : ''} onchange="updateDisplaySetting('showUserCount', this.checked)">
              <span class="slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-info">
              <span class="settings-label">顯示最後更新時間 (🕒)</span>
              <span class="settings-desc">顯示商店中的最後版本更新日期</span>
            </div>
            <label class="switch">
              <input type="checkbox" id="showUpdateTimeToggle" ${displaySettings.showUpdateTime ? 'checked' : ''} onchange="updateDisplaySetting('showUpdateTime', this.checked)">
              <span class="slider"></span>
            </label>
          </div>
          <div style="margin-top: 16px;">
            <button class="action-btn primary" data-action="syncAllData" style="width: 100%;">🔄 同步所有商店資訊</button>
            <small style="display: block; color: var(--text-secondary); margin-top: 8px; font-size: 11px;">
              將逐一爬取所有擴充功能在 Chrome Web Store 的最新評分與人數 (可能需要幾分鐘)
            </small>
          </div>
        </div>
        
        <!-- 資料管理 -->
        <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px;">
          <h3 style="margin-bottom: 16px; color: var(--text-primary);">📦 資料管理</h3>
          
          <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 6px; margin-bottom: 16px;">
            <h4 style="font-size: 14px; color: var(--text-primary); margin-bottom: 12px;">導入資料</h4>
            <button class="action-btn primary" data-action="importData" style="width: 100%; margin-bottom: 8px;">
              📥 導入配置
            </button>
            <small style="display: block; color: var(--text-secondary); font-size: 11px; line-height: 1.5;">
              • 支援完整配置（群組、設定、快照、歷史記錄）<br>
              • 支援選擇性導入（僅群組配置或僅設定）<br>
              • 自動合併或覆蓋現有配置
            </small>
          </div>
          
          <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 6px; margin-bottom: 16px;">
            <h4 style="font-size: 14px; color: var(--text-primary); margin-bottom: 12px;">導出資料</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
              <button class="action-btn" data-action="exportData" data-export-type="all">
                📤 完整導出
              </button>
              <button class="action-btn" data-action="exportData" data-export-type="groups">
                📋 群組配置
              </button>
              <button class="action-btn" data-action="exportData" data-export-type="snapshots">
                📸 快照記錄
              </button>
              <button class="action-btn" data-action="exportData" data-export-type="settings">
                ⚙️ 僅設定
              </button>
            </div>
            <small style="display: block; color: var(--text-secondary); font-size: 11px; line-height: 1.5;">
              • 完整導出：所有配置、群組、快照、歷史<br>
              • 選擇性導出：根據需求導出特定資料<br>
              • JSON 格式，可在其他設備導入
            </small>
          </div>
          
          <div style="background: rgba(255,193,7,0.1); border: 1px solid rgba(255,193,7,0.3); padding: 12px; border-radius: 6px;">
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <button class="action-btn danger" data-action="resetAllData" style="flex: 1;">
                🗑️ 重置所有資料
              </button>
              <button class="action-btn" data-action="backupBeforeReset" style="flex: 1;">
                💾 備份後重置
              </button>
            </div>
            <small style="display: block; color: var(--warning-color); font-size: 11px;">
              ⚠️ 危險操作：重置將清除所有自定義配置
            </small>
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
