// Chrome 擴充功能管理器 - 擴充功能渲染
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
    const installTime = ext.metadata?.installTime ? formatDate(ext.metadata.installTime) : '未知';

    // 預設一律先看原始內容
    let activeTab = 'original';
    const hasTranslation = !!extensionTranslations[ext.id];

    // 如果使用者手動選擇看翻譯且已經有翻譯，才跳去翻譯
    if (preferredDescTab === 'translated' && hasTranslation) {
      activeTab = 'translated';
    } else if (ext.isEnglish && !hasTranslation) {
      // 這是英文且還沒翻譯過 -> 直接在背景排隊請 Google 翻譯
      setTimeout(() => {
        if (window.triggerAutoTranslation) window.triggerAutoTranslation(ext.id);
      }, 0);
    }

    let displayDesc = '';
    if (activeTab === 'translated') {
      displayDesc = extensionTranslations[ext.id];
    } else {
      displayDesc = ext.customDesc || getDefaultDescription(ext) || '點擊添加描述...';
    }

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
          <span class="tag functional" style="display: inline-block; padding: 3px 8px; background: linear-gradient(135deg, var(--accent-color), var(--success-color)); color: white; border-radius: 12px; font-size: 11px; font-weight: 500; cursor: pointer;" 
                title="點擊編輯功能分類" onclick="showGroupSelector('${ext.id}', 'functional', event)">
            ${groupNames[ext.group] || ext.group}
          </span>
          <span class="tag device" style="display: inline-block; padding: 3px 8px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 12px; font-size: 11px; cursor: pointer;" 
                title="點擊編輯設備分類" onclick="showGroupSelector('${ext.id}', 'device', event)">
            ${deviceGroupNames[ext.deviceGroup] || ext.deviceGroup}
          </span>
        </div>
        
        <!-- 描述 Tab 系統 -->
        <div class="desc-tabs-container">
            <button class="desc-tab ${activeTab === 'original' ? 'active' : ''}" 
                    data-action="switchDescTab"
                    data-tab="original"
                    data-ext-id="${ext.id}">✍️ 原始</button>
            ${ext.isEnglish || hasTranslation ? `
            <button class="desc-tab ${activeTab === 'translated' ? 'active' : ''}" 
                    data-action="switchDescTab"
                    data-tab="translated"
                    data-ext-id="${ext.id}">🌏 翻譯</button>
            ` : ''}
        </div>

        <div class="extension-description desc-content" 
             id="desc-${ext.id}"
             contenteditable="true" 
             data-ext-id="${ext.id}"
             data-action="editDescription"
             data-placeholder="點擊添加描述..."
             onblur="saveDescription('${ext.id}', this.textContent, this)"
             onkeydown="handleDescriptionKeydown(event)">${displayDesc}</div>

        <!-- 商店連結與健康資訊 -->
        <div class="store-link-container" style="padding-top: 8px;">
            <a href="https://chromewebstore.google.com/detail/${ext.id}" target="_blank" class="store-link">🔗 前往商店</a>
        </div>
        
        ${ext.health ? `
        <div class="health-stats">
            ${displaySettings.showRating ? `<div class="health-item"><span class="rating-stars">⭐</span> <span class="health-value">${ext.health.rating}</span></div>` : ''}
            ${displaySettings.showUserCount ? `<div class="health-item"><span class="user-count">👤</span> <span class="health-value">${ext.health.userCount}</span></div>` : ''}
            ${displaySettings.showUpdateTime ? `<div class="health-item"><span class="update-date">🕒</span> <span class="health-value">${ext.health.lastUpdate}</span></div>` : ''}
        </div>
        ` : ''}

        <!-- 元數據摘要 -->
        <div class="metadata-summary" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; margin-top: 8px;">
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
    item.addEventListener('click', async function (e) {
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
    el.addEventListener('dblclick', async function (e) {
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
