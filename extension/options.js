// Chrome 擴充功能管理器 - 主要邏輯處理

// 全域變數
let allExtensions = [];
let filteredExtensions = [];
let currentGroup = 'all';
let extensionGroups = {};
let extensionDescriptions = {};

// 群組映射（可編輯）
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

// DOM 元素
let mainContent, loadingState, groupList;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Options page initializing...');
        
        mainContent = document.getElementById('mainContent');
        loadingState = document.getElementById('loadingState');
        groupList = document.getElementById('groupList');
        
        if (!mainContent) {
            console.error('mainContent element not found');
            return;
        }
        
        console.log('Loading theme...');
        await initTheme();
        
        console.log('Loading storage data...');
        await loadStorageData();
        
        console.log('Loading extensions...');
        await loadExtensions();
        
        console.log('Initializing event listeners...');
        initEventListeners();

        // 導航按鈕事件（移除inline，改為委派）
        const nav = document.querySelector('.nav-buttons');
        if (nav) {
            nav.addEventListener('click', (e) => {
                const btn = e.target.closest('.nav-btn');
                if (!btn) return;
                const view = btn.getAttribute('data-view');
                if (view) showView(view, btn);
            });
        }
        
        console.log('Showing manager view...');
        showView('manager');
        
        console.log('Options page initialization complete');
    } catch (error) {
        console.error('Initialization failed:', error);
        if (mainContent) {
            mainContent.innerHTML = `
                <div style="padding: 20px; color: var(--warning-color);">
                    <h3>初始化失敗</h3>
                    <p>錯誤：${error.message}</p>
                    <button id="btnReload" style="margin-top: 10px; padding: 8px 16px; background: var(--accent-color); color: var(--bg-primary); border: none; border-radius: 4px; cursor: pointer;">重新載入</button>
                </div>
            `;
        }
    }
});

// 初始化主題
async function initTheme() {
    const result = await chrome.storage.local.get(['theme', 'cardSize']);
    const theme = result.theme || 'dark';
    const cardSize = result.cardSize || 'normal';
    document.body.setAttribute('data-theme', theme);
    
    // 設定卡片大小類別
    const grid = document.querySelector('.extensions-grid');
    if (grid) {
        grid.className = `extensions-grid ${cardSize}`;
    }
}

// 載入儲存的資料
async function loadStorageData() {
    const result = await chrome.storage.local.get(['extensionGroups', 'extensionDescriptions', 'customGroupNames']);
    extensionGroups = result.extensionGroups || {};
    extensionDescriptions = result.extensionDescriptions || {};
    
    // 載入自定義群組名稱
    const customGroupNames = result.customGroupNames || {};
    groupNames = { ...groupNames, ...customGroupNames };
}

// 檢查單個擴充功能的狀態
async function checkExtensionStatus(id) {
    try {
        const ext = await chrome.management.get(id);
        console.log(`Direct API check for ${ext.name}: enabled=${ext.enabled}`);
        return ext.enabled;
    } catch (error) {
        console.error('Error checking extension status:', error);
        return false;
    }
}

// 載入所有擴充功能
async function loadExtensions() {
    try {
        const extensions = await chrome.management.getAll();
        allExtensions = extensions.filter(ext => 
            ext.type === 'extension' && 
            ext.id !== chrome.runtime.id // 排除自己
        );
        
        console.log('Loaded extensions:', allExtensions.length);
        
        // 合併儲存的資料
        allExtensions.forEach(ext => {
            ext.group = extensionGroups[ext.id] || classifyExtension(ext);
            ext.customDesc = extensionDescriptions[ext.id] || '';
        });
        
        filteredExtensions = [...allExtensions];
        updateGroupCounts();
        updateStatistics();
        
        // 渲染群組列表
        renderGroupList();
        
        if (mainContent.querySelector('.extensions-grid')) {
            await renderExtensions();
        }
        
        loadingState.style.display = 'none';
    } catch (error) {
        console.error('Failed to load extensions:', error);
        loadingState.textContent = '載入失敗';
    }
}

// 自動分類擴充功能
function classifyExtension(ext) {
    const name = ext.name.toLowerCase();
    const id = ext.id;
    
    // 根據已知的ID進行分類
    const knownIds = {
        'bgnkhhnnamicmpeenaelnjfhikgbkllg': 'adblocker',
        'eimadpbcbfnmbkopoojfekhnkhdbieeh': 'adblocker',
        'ojnbohmppadfgpejeebfnmnknjdlckgj': 'ai',
        'ofpnmcalabcbjgholdjcjblkibolbppb': 'ai',
        'knheggckgoiihginacbkhaalnibhilkk': 'productivity',
        'chphlpgkkbolifaimnlloiipkdnihall': 'productivity',
        'bkhaagjahfmjljalopjnoealnfndnagc': 'dev',
        'dhdgffkkebhmkfjojejmpbldmpobfkfo': 'dev',
    };
    
    if (knownIds[id]) {
        return knownIds[id];
    }
    
    // 根據名稱關鍵字分類
    if (name.includes('ad') || name.includes('block') || name.includes('privacy')) return 'adblocker';
    if (name.includes('ai') || name.includes('gpt') || name.includes('chat')) return 'ai';
    if (name.includes('dev') || name.includes('github') || name.includes('code')) return 'dev';
    if (name.includes('youtube') || name.includes('video')) return 'youtube';
    if (name.includes('translate') || name.includes('翻譯')) return 'translate';
    if (name.includes('screenshot') || name.includes('capture') || name.includes('擷圖')) return 'screenshot';
    if (name.includes('scraper') || name.includes('scrape') || name.includes('爬蟲')) return 'scraper';
    if (name.includes('notion') || name.includes('note') || name.includes('productivity')) return 'productivity';
    
    return 'other';
}

// 更新群組計數
function updateGroupCounts() {
    const counts = {};
    
    // 初始化所有群組計數
    Object.keys(groupNames).forEach(group => {
        counts[group] = 0;
    });
    
    // 計算每個群組的擴充功能數量
    allExtensions.forEach(ext => {
        const group = ext.group || 'other';
        counts[group] = (counts[group] || 0) + 1;
        counts['all']++;
    });
    
    // 更新UI顯示
    Object.keys(counts).forEach(group => {
        const countEl = document.getElementById(`count${group.charAt(0).toUpperCase() + group.slice(1)}`);
        if (countEl) {
            countEl.textContent = counts[group];
        }
    });
}

// 更新統計資訊
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

// 視圖切換
async function showView(view, targetButton = null) {
    console.log('Switching to view:', view);
    
    // 更新導航按鈕狀態
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 如果有傳入按鈕元素或事件，則標記為active
    if (targetButton) {
        targetButton.classList.add('active');
    } else {
        // 不再依賴 window.event，避免未定義
        // 找到對應的按鈕並標記
        const buttons = document.querySelectorAll('.nav-btn');
        buttons.forEach(btn => {
            if (btn.getAttribute('data-view') === view) {
                btn.classList.add('active');
            }
        });
    }
    
    try {
        // 切換內容
        switch(view) {
            case 'manager':
                mainContent.innerHTML = getManagerView();
                setTimeout(async () => {
                    await initManagerView();
                    console.log('Manager view initialized');
                }, 100); // 延遲確保DOM已更新
                break;
            case 'history':
                mainContent.innerHTML = getHistoryView();
                setTimeout(async () => {
                    await initHistoryView();
                    console.log('History view initialized');
                }, 100);
                break;
            case 'settings':
                mainContent.innerHTML = getSettingsView();
                setTimeout(async () => {
                    await initSettingsView();
                    console.log('Settings view initialized');
                }, 100);
                break;
        }
        
        await logChange(`切換到${view}視圖`);
    } catch (error) {
        console.error('View switch error:', error);
        mainContent.innerHTML = `<div style="padding: 20px; color: var(--warning-color);">載入視圖時發生錯誤：${error.message}</div>`;
    }
}

// 獲取管理器視圖
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
                目前群組：<span id="currentGroupName">所有擴充功能</span>
            </div>
        </div>

        <!-- 擴充功能列表 -->
        <div class="extensions-grid" id="extensionsList">
            <!-- 動態生成的擴充功能卡片 -->
        </div>
    `;
}

// 獲取歷史記錄視圖
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

// 獲取設定視圖
function getSettingsView() {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    const currentCardSize = localStorage.getItem('cardSize') || 'normal';
    
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
                            <button class="action-btn" data-action="resetTheme" title="還原預設主題" style="padding: 8px 12px;">↻ 還原</button>
                        </div>
                        <small style="display: block; color: var(--text-secondary); margin-top: 4px;">
                            選擇您偏好的介面主題風格
                        </small>
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-primary);">卡片大小調整</label>
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; margin-bottom: 4px; color: var(--text-secondary); font-size: 12px;">寬度 (200-400px)</label>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button class="action-btn" data-action="decreaseWidth" style="padding: 6px 12px;">-</button>
                                <input type="number" id="cardWidthInput" min="200" max="400" step="20" value="240" style="width: 80px; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--card-bg); color: var(--text-primary); text-align: center;">
                                <button class="action-btn" data-action="increaseWidth" style="padding: 6px 12px;">+</button>
                                <span style="font-size: 12px; color: var(--text-secondary);">px</span>
                            </div>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; margin-bottom: 4px; color: var(--text-secondary); font-size: 12px;">高度 (160-300px)</label>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button class="action-btn" data-action="decreaseHeight" style="padding: 6px 12px;">-</button>
                                <input type="number" id="cardHeightInput" min="160" max="300" step="20" value="192" style="width: 80px; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--card-bg); color: var(--text-primary); text-align: center;">
                                <button class="action-btn" data-action="increaseHeight" style="padding: 6px 12px;">+</button>
                                <span style="font-size: 12px; color: var(--text-secondary);">px</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="action-btn" data-action="resetCardSize" style="padding: 8px 12px;">↻ 還原預設</button>
                            <button class="action-btn primary" data-action="applyCardSize" style="padding: 8px 12px;">✓ 套用</button>
                        </div>
                        <small style="display: block; color: var(--text-secondary); margin-top: 4px;">
                            直接調整每個卡片的寬度和高度數值
                        </small>
                    </div>
                </div>
                
                <!-- 快照設定 -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px;">
                    <h3 style="margin-bottom: 16px; color: var(--text-primary);">快照設定</h3>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: flex; align-items: center; gap: 12px; color: var(--text-primary);">
                            <input type="checkbox" id="autoSnapshotSetting" checked>
                            <span>自動每日快照</span>
                        </label>
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <button class="action-btn primary" data-action="createSnapshot">立即建立快照</button>
                        <button class="action-btn danger" data-action="clearAllSnapshots" style="margin-left: 8px;">清除所有快照</button>
                    </div>
                </div>
                
                <!-- 資料管理 -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px;">
                    <h3 style="margin-bottom: 16px; color: var(--text-primary);">資料管理</h3>
                    
                    <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                        <button class="action-btn" data-action="exportData">匯出設定</button>
                        <button class="action-btn" data-action="importData">匯入設定</button>
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <button class="action-btn primary" data-action="exportExtensionList">匯出擴充功能清單</button>
                        <small style="display: block; color: var(--text-secondary); margin-top: 4px;">
                            將目前的擴充功能狀態匯出為JSON格式
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 初始化管理器視圖
async function initManagerView() {
    try {
        await renderExtensions();
        initSearch();
        initDragAndDrop();
        initEventListeners();
        initActionHandlers();
    } catch (error) {
        console.error('Failed to initialize manager view:', error);
    }
}

// 初始化歷史記錄視圖
async function initHistoryView() {
    await loadHistoryList();
    initActionHandlers();
}

// 初始化設定視圖
async function initSettingsView() {
    // 同步自動快照設定
    const settings = await chrome.storage.local.get(['autoSnapshot', 'cardWidth', 'cardHeight']);
    
    const autoSnapshotSetting = document.getElementById('autoSnapshotSetting');
    if (autoSnapshotSetting) {
        autoSnapshotSetting.checked = settings.autoSnapshot !== false;
    }
    
    // 載入卡片大小設定
    const widthInput = document.getElementById('cardWidthInput');
    const heightInput = document.getElementById('cardHeightInput');
    
    if (widthInput) {
        widthInput.value = settings.cardWidth || 240;
    }
    if (heightInput) {
        heightInput.value = settings.cardHeight || 192;
    }
    
    // 如果有自定義大小，套用它
    if (settings.cardWidth && settings.cardHeight) {
        updateCardSizeCSS(settings.cardWidth, settings.cardHeight);
    }
    
    initActionHandlers();
    
    // 綁定選擇器事件
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => changeTheme(e.target.value));
    }
}

// 渲染擴充功能列表
async function renderExtensions(filter = '') {
    const container = document.getElementById('extensionsList');
    if (!container) return;
    
    // 獲取卡片大小設定
    const result = await chrome.storage.local.get(['cardSize']);
    const cardSize = result.cardSize || 'normal';
    container.className = `extensions-grid ${cardSize}`;
    
    let displayExtensions = filteredExtensions;
    
    if (currentGroup !== 'all') {
        displayExtensions = filteredExtensions.filter(ext => ext.group === currentGroup);
    }
    
    if (filter) {
        displayExtensions = displayExtensions.filter(ext => 
            ext.name.toLowerCase().includes(filter.toLowerCase()) ||
            ext.id.includes(filter.toLowerCase())
        );
    }

    container.innerHTML = displayExtensions.map(ext => {
        const iconUrl = getExtensionIconUrl(ext);
        const fallbackIcon = getExtensionIcon(ext);
        const description = ext.customDesc || getDefaultDescription(ext) || '點擊添加描述...';
        
        return `
        <div class="extension-card" draggable="true" data-id="${ext.id}">
            <div class="extension-toggle">
                <div class="toggle-switch ${ext.enabled ? 'active' : ''}" 
                     data-action="toggleExtension" data-ext-id="${ext.id}"></div>
            </div>
            <div class="extension-header">
                <div class="extension-icon" id="icon-${ext.id}">
                    <img src="${iconUrl}" 
                         data-ext-id="${ext.id}" data-fallback="${fallbackIcon}"
                         class="ext-icon-img">
                    <div class="fallback-icon" style="display:none; width:100%; height:100%; align-items:center; justify-content:center; background: linear-gradient(135deg, var(--accent-color), var(--success-color)); border-radius: 8px; color: var(--bg-primary); font-size: 20px;">
                        ${fallbackIcon}
                    </div>
                </div>
                <div class="extension-info">
                    <div class="extension-name" title="${ext.name}">${ext.name}</div>
                    <div class="extension-meta" title="版本 ${ext.version}">v${ext.version}</div>
                </div>
            </div>
            <div class="extension-description" 
                 contenteditable="true" 
                 data-ext-id="${ext.id}"
                 data-action="editDescription"
                 data-placeholder="點擊添加描述...">${description}</div>
            <div class="extension-actions">
                <button class="extension-btn" data-action="openOptions" data-ext-id="${ext.id}" title="設定">⚙️</button>
                <button class="extension-btn" data-action="showDetails" data-ext-id="${ext.id}" title="詳情">📊</button>
                <button class="extension-btn" data-action="uninstallExtension" data-ext-id="${ext.id}" title="卸載">🗑️</button>
            </div>
        </div>
        `;
    }).join('');
}

// 獲取擴充功能圖示
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
        'lpcaedmchfhocbbapmcbpinfpgnhiddi': '📝',
        'bkhaagjahfmjljalopjnoealnfndnagc': '🌳',
        'dhdgffkkebhmkfjojejmpbldmpobfkfo': '🐒',
        'aapbdbdomjkkjkaonfhkkikfgjllcleb': '🌐',
        'bpoadfkcbjbfhfodiogcnhhhpibjhbnh': '📖',
        'hjfkenebldkfgibelglepinlabpjfbll': '🎬',
        'nmmicjeknamkfloonkhhcjmomieiodli': '📺',
        'dbjbempljhcmhlfpfacalomonjpalpko': '🖼️',
        'nkbihfbeogaeaoehlefnkodbefgpgknn': '🦊',
        'ophjlpahpchlmihnnnihgmmeilfjmjjc': '💬',
    };
    
    return iconMap[ext.id] || '🔧';
}

// 獲取擴充功能的真實圖標URL
function getExtensionIconUrl(ext) {
    // 嘗試多種圖標路径
    const possiblePaths = [
        `chrome-extension://${ext.id}/icon.png`,
        `chrome-extension://${ext.id}/icons/icon.png`,
        `chrome-extension://${ext.id}/images/icon.png`,
        `chrome-extension://${ext.id}/icon48.png`,
        `chrome-extension://${ext.id}/icons/48.png`,
        `chrome-extension://${ext.id}/icons/icon48.png`
    ];
    
    // 如果擴充功能有icons屬性，使用它
    if (ext.icons && ext.icons.length > 0) {
        const icon = ext.icons.find(i => i.size >= 48) || ext.icons[0];
        return icon.url;
    }
    
    return possiblePaths[0]; // 返回最常見的路径
}

// 獲取預設描述
function getDefaultDescription(ext) {
    const descriptions = {
        'bgnkhhnnamicmpeenaelnjfhikgbkllg': '高效阻擋廣告，保護隱私，提升網頁載入速度',
        'eimadpbcbfnmbkopoojfekhnkhdbieeh': '自動為所有網站生成深色主題，保護眼睛',
        'ojnbohmppadfgpejeebfnmnknjdlckgj': '提供大量專業提示詞，提升ChatGPT使用效率',
        'ofpnmcalabcbjgholdjcjblkibolbppb': '整合GPT-4、Claude等多種AI模型的全能助手',
        'knheggckgoiihginacbkhaalnibhilkk': '一鍵將網頁內容剪藏到Notion筆記本',
        'chphlpgkkbolifaimnlloiipkdnihall': '將所有分頁合併為單一清單，大幅節省記憶體',
        'bkhaagjahfmjljalopjnoealnfndnagc': '在GitHub側邊顯示檔案樹狀結構',
        'dhdgffkkebhmkfjojejmpbldmpobfkfo': '執行自訂JavaScript腳本來修改網頁',
    };
    
    return descriptions[ext.id] || ext.description || '';
}

// 切換擴充功能狀態
async function toggleExtension(id) {
    try {
        console.log('Toggling extension:', id);
        const ext = allExtensions.find(e => e.id === id);
        if (!ext) {
            console.error('Extension not found:', id);
            return;
        }
        
        // 記錄操作前的狀態（用於復原）
        const previousState = ext.enabled;
        const newState = !ext.enabled;
        
        console.log('Extension before toggle:', ext.name, ext.enabled);
        
        // 執行狀態切換
        await chrome.management.setEnabled(id, newState);
        
        // 短暫延遲後重新查詢狀態以確保同步
        setTimeout(async () => {
            try {
                const updatedExt = await chrome.management.get(id);
                ext.enabled = updatedExt.enabled;
                console.log('Extension after toggle (verified):', ext.name, ext.enabled);
                
                // 重新渲染以確保UI正確
                await renderExtensions();
                updateStatistics();
                updateGroupCounts();
            } catch (verifyError) {
                console.error('Failed to verify extension state:', verifyError);
                // fallback：使用預期的狀態
                ext.enabled = newState;
            }
        }, 100);
        
        // 立即更新狀態和UI（樂觀更新）
        ext.enabled = newState;
        await renderExtensions();
        updateStatistics();
        updateGroupCounts();
        
        // 記錄變更並包含復原資料
        await logChange(
            `${ext.enabled ? '啟用' : '停用'} ${ext.name}`, 
            {
                type: 'toggleExtension',
                extensionId: id,
                extensionName: ext.name,
                previousState: previousState,
                newState: newState
            }
        );
        
    } catch (error) {
        console.error('Failed to toggle extension:', error);
        alert(`無法切換擴充功能狀態：${error.message}`);
    }
}

// 開啟擴充功能設定頁
async function openOptions(id) {
    try {
        const ext = allExtensions.find(e => e.id === id);
        if (ext && ext.optionsUrl) {
            await chrome.tabs.create({ url: ext.optionsUrl });
            await logChange(`開啟 ${ext.name} 設定頁`);
        } else {
            // 如果沒有 optionsUrl，開啟擴充功能詳情頁
            await chrome.tabs.create({ url: `chrome://extensions/?id=${id}` });
            await logChange(`開啟 ${ext.name} 詳情頁`);
        }
    } catch (error) {
        console.error('Failed to open options:', error);
    }
}

// 顯示擴充功能詳情
function showDetails(id) {
    const ext = allExtensions.find(e => e.id === id);
    if (!ext) return;
    
    const permissions = ext.permissions || [];
    const hostPermissions = ext.hostPermissions || [];
    
    // 建立詳情對話框
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.cssText = `
        background: var(--card-bg);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        color: var(--text-primary);
    `;
    
    content.innerHTML = `
        <h3 style="margin-bottom: 16px; color: var(--text-primary);">📊 擴充功能詳情</h3>
        
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
            <strong>狀態：</strong> <span style="color: ${ext.enabled ? 'var(--success-color)' : 'var(--warning-color)'}">${ext.enabled ? '✅ 已啟用' : '❌ 已停用'}</span>
        </div>
        
        <div style="margin-bottom: 8px;">
            <strong>安裝類型：</strong> ${ext.installType}
        </div>
        
        <div style="margin-bottom: 8px;">
            <strong>可停用：</strong> ${ext.mayDisable ? '✅ 是' : '❌ 否'}
        </div>
        
        ${permissions.length > 0 ? `
        <div style="margin-bottom: 8px;">
            <strong>權限：</strong>
            <div style="margin-top: 4px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 12px;">
                ${permissions.join(', ')}
            </div>
        </div>
        ` : ''}
        
        ${hostPermissions.length > 0 ? `
        <div style="margin-bottom: 8px;">
            <strong>網站權限：</strong>
            <div style="margin-top: 4px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 12px; word-break: break-all;">
                ${hostPermissions.join('<br>')}
            </div>
        </div>
        ` : ''}
        
        <div style="margin-bottom: 16px;">
            <strong>描述：</strong>
            <div style="margin-top: 4px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px;">
                ${ext.description || '無描述'}
            </div>
        </div>
        
        <button class="action-btn primary" style="width: 100%;">關閉</button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // 綁定關閉事件
    const closeBtn = content.querySelector('button');
    closeBtn.onclick = () => modal.remove();
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
    
    logChange(`查看 ${ext.name} 的詳情`);
}

// 卸載擴充功能
async function uninstallExtension(id) {
    try {
        const ext = allExtensions.find(e => e.id === id);
        if (!ext) return;
        
        if (!confirm(`確定要卸載 ${ext.name} 嗎？\n\n此操作無法復原。`)) {
            return;
        }
        
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

// 圖標載入錯誤處理
function handleIconError(extId, fallbackIcon) {
    const iconContainer = document.getElementById(`icon-${extId}`);
    if (iconContainer) {
        const img = iconContainer.querySelector('img');
        const fallback = iconContainer.querySelector('.fallback-icon');
        if (img) img.style.display = 'none';
        if (fallback) fallback.style.display = 'flex';
    }
}

// 圖標載入成功處理
function handleIconSuccess(extId) {
    const iconContainer = document.getElementById(`icon-${extId}`);
    if (iconContainer) {
        const fallback = iconContainer.querySelector('.fallback-icon');
        if (fallback) fallback.style.display = 'none';
    }
}

// 描述編輯鍵盤事件處理
function handleDescriptionKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        event.target.blur(); // 觸發保存
    }
    if (event.key === 'Escape') {
        event.target.blur();
    }
}

// 編輯描述
function editDescription(id, descElement = null) {
    const element = descElement || event.target;
    if (element.textContent === '點擊添加描述...') {
        element.textContent = '';
    }
    
    element.classList.add('editing');
    element.focus();
    
    // 選中所有文字
    try {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    } catch (error) {
        console.warn('Text selection failed:', error);
    }
}

// 保存描述
async function saveDescription(id, newDesc, descElement = null) {
    const ext = allExtensions.find(e => e.id === id);
    if (!ext) return;
    
    const element = descElement || event.target;
    element.classList.remove('editing');
    
    const trimmedDesc = newDesc.trim();
    if (!trimmedDesc || trimmedDesc === '點擊添加描述...') {
        // 如果描述為空，恢復預設或佔位符
        const defaultDesc = getDefaultDescription(ext);
        element.textContent = defaultDesc || '點擊添加描述...';
        return;
    }
    
    // 限制描述長度
    if (trimmedDesc.length > 50) {
        const shortened = trimmedDesc.substring(0, 47) + '...';
        element.textContent = shortened;
        ext.customDesc = shortened;
        extensionDescriptions[id] = shortened;
    } else {
        ext.customDesc = trimmedDesc;
        extensionDescriptions[id] = trimmedDesc;
    }
    
    try {
        await chrome.storage.local.set({ extensionDescriptions });
        await logChange(`更新 ${ext.name} 的描述`);
    } catch (error) {
        console.error('Failed to save description:', error);
    }
}

// 群組批量控制確認
function confirmToggleGroup(enable) {
    const action = enable ? '啟用' : '停用';
    const groupName = groupNames[currentGroup] || '當前群組';
    
    let targetExtensions = currentGroup === 'all' ? allExtensions : allExtensions.filter(ext => ext.group === currentGroup);
    const affectedCount = targetExtensions.filter(ext => ext.enabled !== enable).length;
    
    if (affectedCount === 0) {
        alert(`所有擴充功能已經是${action}狀態`);
        return;
    }
    
    if (confirm(`確定要${action}「${groupName}」中的 ${affectedCount} 個擴充功能嗎？\n\n此操作將影響多個擴充功能的狀態。`)) {
        toggleGroup(enable);
    }
}

// 群組批量控制
async function toggleGroup(enable) {
    let targetExtensions = currentGroup === 'all' ? allExtensions : allExtensions.filter(ext => ext.group === currentGroup);
    let successCount = 0;
    let failedCount = 0;
    
    for (const ext of targetExtensions) {
        if (ext.enabled !== enable && ext.mayDisable !== false) {
            try {
                await chrome.management.setEnabled(ext.id, enable);
                ext.enabled = enable;
                successCount++;
            } catch (error) {
                console.error(`Failed to toggle ${ext.name}:`, error);
                failedCount++;
            }
        }
    }
    
    await renderExtensions();
    updateStatistics();
    await logChange(`批量${enable ? '啟用' : '停用'} ${successCount}個擴充功能`);
    
    if (failedCount > 0) {
        alert(`操作完成！\n成功：${successCount} 個\n失敗：${failedCount} 個`);
    } else if (successCount > 0) {
        alert(`已${enable ? '啟用' : '停用'} ${successCount} 個擴充功能`);
    }
}

// 排序功能 - 一次性排序，不持續自動排序
async function sortByStatus() {
    console.log('Sorting by status (one-time sort)...');
    // 創建新的排序陣列，避免影響原始順序
    filteredExtensions = [...filteredExtensions].sort((a, b) => {
        if (a.enabled === b.enabled) {
            return a.name.localeCompare(b.name, 'zh-TW');
        }
        return b.enabled - a.enabled; // 啟用的在前
    });
    
    await renderExtensions();
    await logChange('執行狀態排序（一次性）');
}

async function sortByName() {
    console.log('Sorting by name (one-time sort)...');
    // 創建新的排序陣列，避免影響原始順序
    filteredExtensions = [...filteredExtensions].sort((a, b) => 
        a.name.localeCompare(b.name, 'zh-TW')
    );
    
    await renderExtensions();
    await logChange('執行名稱排序（一次性）');
}

// 建立快照
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
                group: ext.group
            })),
            count: enabledExtensions.length,
            type: 'manual'
        };
        
        const result = await chrome.storage.local.get(['snapshots']);
        const snapshots = result.snapshots || [];
        snapshots.unshift(snapshot);
        
        // 只保留最近 50 個快照
        if (snapshots.length > 50) {
            snapshots.splice(50);
        }
        
        await chrome.storage.local.set({ snapshots });
        await logChange(`建立快照 - ${snapshot.count}個擴充功能`);
        
        // 更新快照列表顯示
        loadSnapshotList();
        
        alert(`快照建立成功！\n時間：${snapshot.date}\n已記錄 ${snapshot.count} 個啟用的擴充功能`);
    } catch (error) {
        console.error('Failed to create snapshot:', error);
        alert('建立快照失敗');
    }
}

// 載入快照列表
async function loadSnapshotList() {
    const snapshotList = document.getElementById('snapshotList');
    if (!snapshotList) return;
    
    const result = await chrome.storage.local.get(['snapshots']);
    const snapshots = result.snapshots || [];
    
    if (snapshots.length === 0) {
        snapshotList.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px; text-align: center; padding: 16px;">暫無快照記錄</div>';
        return;
    }
    
    snapshotList.innerHTML = snapshots.slice(0, 5).map(snapshot => `
        <div class="snapshot-item" data-action="restoreSnapshot" data-snapshot-id="${snapshot.id}">
            <div class="snapshot-time">${snapshot.date.split(' ')[1] || snapshot.date}</div>
            <div class="snapshot-meta">${snapshot.count}個啟用 • ${snapshot.type === 'manual' ? '手動建立' : '自動快照'}</div>
        </div>
    `).join('');
}

// 還原快照
async function restoreSnapshot(snapshotId) {
    try {
        const result = await chrome.storage.local.get(['snapshots']);
        const snapshots = result.snapshots || [];
        const snapshot = snapshots.find(s => s.id == snapshotId);
        
        if (!snapshot) {
            alert('找不到指定的快照');
            return;
        }
        
        if (!confirm(`確定要還原到快照狀態嗎？\n\n時間：${snapshot.date}\n將有 ${snapshot.count} 個擴充功能被啟用\n\n此操作會改變當前的擴充功能狀態。`)) {
            return;
        }
        
        const enabledIds = new Set(snapshot.extensions.map(ext => ext.id));
        let successCount = 0;
        
        for (const ext of allExtensions) {
            if (ext.mayDisable !== false) {
                const shouldEnable = enabledIds.has(ext.id);
                if (ext.enabled !== shouldEnable) {
                    try {
                        await chrome.management.setEnabled(ext.id, shouldEnable);
                        ext.enabled = shouldEnable;
                        successCount++;
                    } catch (error) {
                        console.error(`Failed to restore ${ext.name}:`, error);
                    }
                }
            }
        }
        
        await renderExtensions();
        updateStatistics();
        await logChange(`還原快照 - 影響${successCount}個擴充功能`);
        
        alert(`快照還原完成！\n成功還原 ${successCount} 個擴充功能狀態`);
        
    } catch (error) {
        console.error('Failed to restore snapshot:', error);
        alert('還原快照失敗');
    }
}

// 主題切換
async function changeTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    await chrome.storage.local.set({ theme });
    await logChange(`切換到${theme === 'dark' ? 'Monokai暗色' : '明亮'}主題`);
}

// 還原預設主題
async function resetTheme() {
    const defaultTheme = 'dark';
    document.body.setAttribute('data-theme', defaultTheme);
    await chrome.storage.local.set({ theme: defaultTheme });
    
    // 更新選擇器
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = defaultTheme;
    }
    
    await logChange('還原預設主題');
}

// 調整卡片大小數值
function adjustCardSize(dimension, delta) {
    const input = document.getElementById(dimension === 'width' ? 'cardWidthInput' : 'cardHeightInput');
    if (input) {
        const currentValue = parseInt(input.value) || (dimension === 'width' ? 240 : 192);
        const newValue = Math.max(
            parseInt(input.min), 
            Math.min(parseInt(input.max), currentValue + delta)
        );
        input.value = newValue;
    }
}

// 套用卡片大小
async function applyCardSize() {
    const widthInput = document.getElementById('cardWidthInput');
    const heightInput = document.getElementById('cardHeightInput');
    
    if (!widthInput || !heightInput) return;
    
    const width = parseInt(widthInput.value) || 240;
    const height = parseInt(heightInput.value) || 192;
    
    // 儲存設定
    await chrome.storage.local.set({ 
        cardWidth: width, 
        cardHeight: height 
    });
    
    // 更新CSS
    updateCardSizeCSS(width, height);
    
    await logChange(`調整卡片大小為 ${width}x${height}px`);
}

// 更新卡片大小CSS
function updateCardSizeCSS(width, height) {
    let styleId = 'custom-card-size';
    let existingStyle = document.getElementById(styleId);
    
    if (existingStyle) {
        existingStyle.remove();
    }
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .extensions-grid {
            grid-template-columns: repeat(auto-fill, minmax(${width}px, 1fr)) !important;
        }
        .extension-card {
            width: ${width}px !important;
            height: ${height}px !important;
            aspect-ratio: unset !important;
        }
    `;
    
    document.head.appendChild(style);
}

// 還原預設卡片大小
async function resetCardSize() {
    const defaultWidth = 240;
    const defaultHeight = 192;
    
    // 更新輸入框
    const widthInput = document.getElementById('cardWidthInput');
    const heightInput = document.getElementById('cardHeightInput');
    
    if (widthInput) widthInput.value = defaultWidth;
    if (heightInput) heightInput.value = defaultHeight;
    
    // 移除自定義樣式
    const existingStyle = document.getElementById('custom-card-size');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    // 清除儲存的設定
    await chrome.storage.local.remove(['cardWidth', 'cardHeight']);
    
    await logChange('還原預設卡片大小');
}

// 記錄變更（支援復原功能）
async function logChange(action, undoData = null) {
    // 過濾不需要記錄的操作
    const excludeActions = [
        '切換到manager視圖', '切換到history視圖', '切換到settings視圖',
        '切換到管理器視圖', '切換到歷史記錄視圖', '切換到設定視圖'
    ];
    if (excludeActions.some(exclude => action.includes(exclude))) {
        return;
    }
    
    const timestamp = Date.now();
    const logEntry = {
        timestamp,
        action,
        date: new Date().toLocaleString('zh-TW'),
        undoData: undoData // 存儲復原所需的資料
    };
    
    const result = await chrome.storage.local.get(['changeHistory']);
    const history = result.changeHistory || [];
    history.unshift(logEntry);
    
    // 只保留最近 100 筆記錄
    if (history.length > 100) {
        history.splice(100);
    }
    
    await chrome.storage.local.set({ changeHistory: history });
    
    // 更新最近變更顯示
    updateRecentChanges();
}

// 更新最近變更顯示
async function updateRecentChanges() {
    const recentChanges = document.getElementById('recentChanges');
    if (!recentChanges) return;
    
    const result = await chrome.storage.local.get(['changeHistory']);
    const history = result.changeHistory || [];
    
    if (history.length === 0) {
        recentChanges.innerHTML = '<div style="font-size: 13px; color: var(--text-secondary);">暫無變更記錄</div>';
        return;
    }
    
    const recentItems = history.slice(0, 5);
    recentChanges.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0; color: var(--text-primary); font-size: 14px;">📋 最近變更</h4>
            <button data-action="undoLastAction" style="background: var(--warning-color); border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; color: white; cursor: pointer;" title="返回上一步">↶ 復原</button>
        </div>
        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            ${recentItems.map(item => `
                <div style="margin-bottom: 8px;">• ${item.date.split(' ')[1]} ${item.action}</div>
            `).join('')}
        </div>
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
            <button data-action="showHistoryView" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 4px; font-size: 12px; color: var(--text-secondary); cursor: pointer;">查看所有記錄</button>
        </div>
    `;
}

// 載入歷史記錄列表
async function loadHistoryList() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
    const result = await chrome.storage.local.get(['changeHistory']);
    const history = result.changeHistory || [];
    
    if (history.length === 0) {
        historyList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">暫無變更記錄</div>';
        return;
    }
    
    historyList.innerHTML = history.map(item => `
        <div style="border-bottom: 1px solid var(--border-color); padding: 16px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--text-primary);">${item.date.split(' ')[1]}</strong> 
                    <span style="color: var(--text-primary);">${item.action}</span>
                </div>
                <small style="color: var(--text-secondary);">${getTimeAgo(item.timestamp)}</small>
            </div>
        </div>
    `).join('');
}

// 獲取相對時間
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

// 搜尋功能
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            console.log('Search input changed:', e.target.value);
            await renderExtensions(e.target.value);
        }, 300);
    });
}

// 初始化事件監聽器
function initEventListeners() {
    try {
        console.log('Initializing event listeners...');
        
        // 導航按鈕事件
        document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.preventDefault();
                const view = this.getAttribute('data-view');
                console.log('Navigation clicked:', view);
                await showView(view, this);
            });
        });
        
        // 群組選擇事件
        document.querySelectorAll('.group-item').forEach(item => {
            item.addEventListener('click', async function(e) {
                try {
                    e.preventDefault();
                    console.log('Group clicked:', this.dataset.group);
                    
                    document.querySelectorAll('.group-item').forEach(g => g.classList.remove('active'));
                    this.classList.add('active');
                    currentGroup = this.dataset.group;
                    
                    // 更新群組名稱顯示
                    const groupName = groupNames[currentGroup] || '未知群組';
                    const nameElement = document.querySelector('#currentGroupName');
                    if (nameElement) {
                        nameElement.textContent = groupName;
                    }
                    
                    // 重新渲染擴充功能列表
                    await renderExtensions();
                    
                    await logChange(`切換到群組：${groupName}`);
                } catch (error) {
                    console.error('Group selection error:', error);
                }
            });
        });

        // 自動快照設定同步
        const autoSnapshotToggle = document.getElementById('autoSnapshot');
        if (autoSnapshotToggle) {
            autoSnapshotToggle.addEventListener('change', async (e) => {
                await chrome.storage.local.set({ autoSnapshot: e.target.checked });
                await logChange(`${e.target.checked ? '啟用' : '停用'}自動快照`);
            });
        }
        
        // 重新載入按鈕事件
        document.addEventListener('click', (e) => {
            if (e.target.id === 'btnReload') {
                location.reload();
            }
        });
        
        console.log('Event listeners initialized');
    } catch (error) {
        console.error('Failed to initialize event listeners:', error);
    }
}

// 拖放功能
function initDragAndDrop() {
    let draggedElement = null;
    let draggedExtensionId = null;

    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('extension-card')) {
            draggedElement = e.target;
            draggedExtensionId = e.target.dataset.id;
            e.target.classList.add('dragging');
            
            // 設定拖拉數據
            e.dataTransfer.setData('text/plain', draggedExtensionId);
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('extension-card')) {
            e.target.classList.remove('dragging');
            
            // 清理高亮效果
            document.querySelectorAll('.group-item').forEach(item => {
                item.classList.remove('drag-over');
            });
            
            draggedElement = null;
            draggedExtensionId = null;
        }
    });

    // 卡片區域內的拖拉排序
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        
        // 檢查是否拖拉到群組上
        const groupItem = e.target.closest('.group-item');
        if (groupItem && draggedExtensionId) {
            // 高亮顯示可放置的群組
            document.querySelectorAll('.group-item').forEach(item => {
                item.classList.remove('drag-over');
            });
            groupItem.classList.add('drag-over');
            return;
        }
        
        // 在擴充功能列表內進行排序
        const container = document.getElementById('extensionsList');
        if (!container || !draggedElement) return;
        
        const afterElement = getDragAfterElement(container, e.clientY);
        if (afterElement == null) {
            container.appendChild(draggedElement);
        } else {
            container.insertBefore(draggedElement, afterElement);
        }
    });
    
    // 放置到群組
    document.addEventListener('drop', async (e) => {
        e.preventDefault();
        
        const groupItem = e.target.closest('.group-item');
        if (groupItem && draggedExtensionId) {
            const targetGroupId = groupItem.dataset.group;
            
            // 移除高亮效果
            document.querySelectorAll('.group-item').forEach(item => {
                item.classList.remove('drag-over');
            });
            
            // 執行移動到群組的操作
            if (targetGroupId !== 'all') {
                await moveExtensionToGroup(draggedExtensionId, targetGroupId);
            }
        }
    });
    
    // 群組項目的拖拉事件處理
    document.addEventListener('dragenter', (e) => {
        const groupItem = e.target.closest('.group-item');
        if (groupItem && draggedExtensionId) {
            e.preventDefault();
        }
    });
    
    document.addEventListener('dragleave', (e) => {
        const groupItem = e.target.closest('.group-item');
        if (groupItem) {
            // 檢查是否真的離開了群組區域
            const rect = groupItem.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || 
                e.clientY < rect.top || e.clientY > rect.bottom) {
                groupItem.classList.remove('drag-over');
            }
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.extension-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 匯出資料
async function exportData() {
    try {
        const data = await chrome.storage.local.get();
        const exportData = {
            extensionGroups: data.extensionGroups || {},
            extensionDescriptions: data.extensionDescriptions || {},
            theme: data.theme || 'dark',
            autoSnapshot: data.autoSnapshot !== false,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `extension-manager-settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        await logChange('匯出設定資料');
    } catch (error) {
        console.error('Export failed:', error);
        alert('匯出失敗');
    }
}

// 匯出擴充功能清單
async function exportExtensionList() {
    try {
        // 顯示預覽對話框
        showExportPreviewDialog();
        
    } catch (error) {
        console.error('Export extension list failed:', error);
        alert('匯出擴充功能清單失敗');
    }
}

// 顯示匯出預覽對話框
function showExportPreviewDialog() {
    const extensionList = allExtensions.map(ext => ({
        name: ext.name,
        id: ext.id,
        version: ext.version,
        enabled: ext.enabled,
        group: ext.group,
        description: ext.customDesc || ext.description,
        permissions: ext.permissions || [],
        hostPermissions: ext.hostPermissions || []
    }));
    
    // 創建預覽對話框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    dialog.innerHTML = `
        <div style="background: var(--card-bg); border-radius: 12px; width: 90%; max-width: 800px; max-height: 80%; display: flex; flex-direction: column; border: 1px solid var(--border-color);">
            <div style="padding: 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; color: var(--text-primary);">📋 匯出預覽 - 擴充功能清單</h3>
                <button class="close-dialog" style="background: none; border: none; font-size: 24px; color: var(--text-secondary); cursor: pointer;">&times;</button>
            </div>
            
            <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary);">
                <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                    <span style="color: var(--text-primary);">總計：<strong>${extensionList.length}</strong> 個擴充功能</span>
                    <span style="color: var(--success-color);">啟用：<strong>${extensionList.filter(e => e.enabled).length}</strong></span>
                    <span style="color: var(--text-secondary);">停用：<strong>${extensionList.filter(e => !e.enabled).length}</strong></span>
                    <div style="margin-left: auto; display: flex; gap: 8px;">
                        <button class="action-btn" id="selectAll" style="padding: 4px 12px; font-size: 12px;">全選</button>
                        <button class="action-btn" id="selectNone" style="padding: 4px 12px; font-size: 12px;">全不選</button>
                        <button class="action-btn" id="selectEnabled" style="padding: 4px 12px; font-size: 12px;">僅選啟用</button>
                    </div>
                </div>
            </div>
            
            <div style="flex: 1; overflow-y: auto; padding: 0; max-height: 400px;">
                <div id="extensionPreviewList" style="padding: 0;">
                    ${extensionList.map((ext, index) => `
                        <div class="extension-preview-item" style="padding: 12px 20px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 12px; ${ext.enabled ? '' : 'opacity: 0.7;'}">
                            <input type="checkbox" id="ext_${index}" checked style="margin: 0;">
                            <div style="width: 20px; height: 20px; background: var(--${ext.enabled ? 'success' : 'text-secondary'}-color); border-radius: 50%; flex-shrink: 0;"></div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ext.name}</div>
                                <div style="font-size: 12px; color: var(--text-secondary); display: flex; gap: 12px;">
                                    <span>v${ext.version}</span>
                                    <span>${groupNames[ext.group] || ext.group}</span>
                                    <span style="color: var(--${ext.enabled ? 'success' : 'text-secondary'}-color);">${ext.enabled ? '啟用' : '停用'}</span>
                                </div>
                            </div>
                            <button class="remove-item" data-index="${index}" style="background: var(--warning-color); border: none; color: white; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 12px; line-height: 1;" title="移除此項目">×</button>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div style="padding: 20px; border-top: 1px solid var(--border-color); display: flex; gap: 12px; justify-content: flex-end;">
                <button class="action-btn" id="cancelExport">取消</button>
                <button class="action-btn primary" id="confirmExport" style="background: var(--success-color);">📥 確認匯出</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // 綁定事件
    let currentExtensionList = [...extensionList];
    
    // 關閉對話框
    const closeDialog = () => {
        document.body.removeChild(dialog);
    };
    
    dialog.querySelector('.close-dialog').addEventListener('click', closeDialog);
    dialog.querySelector('#cancelExport').addEventListener('click', closeDialog);
    
    // 點擊背景關閉
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) closeDialog();
    });
    
    // 選擇操作
    dialog.querySelector('#selectAll').addEventListener('click', () => {
        dialog.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    });
    
    dialog.querySelector('#selectNone').addEventListener('click', () => {
        dialog.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    });
    
    dialog.querySelector('#selectEnabled').addEventListener('click', () => {
        dialog.querySelectorAll('input[type="checkbox"]').forEach((cb, index) => {
            cb.checked = currentExtensionList[index]?.enabled || false;
        });
    });
    
    // 移除項目
    dialog.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            const item = e.target.closest('.extension-preview-item');
            item.style.transition = 'opacity 0.3s ease';
            item.style.opacity = '0';
            setTimeout(() => {
                item.remove();
                currentExtensionList.splice(index, 1);
                updatePreviewStats();
            }, 300);
        });
    });
    
    // 更新統計信息
    const updatePreviewStats = () => {
        const remaining = dialog.querySelectorAll('.extension-preview-item').length;
        const enabled = currentExtensionList.filter(e => e.enabled).length;
        const disabled = currentExtensionList.length - enabled;
        
        const statsDiv = dialog.querySelector('[style*="總計"]').parentElement;
        statsDiv.innerHTML = `
            <span style="color: var(--text-primary);">總計：<strong>${remaining}</strong> 個擴充功能</span>
            <span style="color: var(--success-color);">啟用：<strong>${enabled}</strong></span>
            <span style="color: var(--text-secondary);">停用：<strong>${disabled}</strong></span>
            <div style="margin-left: auto; display: flex; gap: 8px;">
                <button class="action-btn" id="selectAll" style="padding: 4px 12px; font-size: 12px;">全選</button>
                <button class="action-btn" id="selectNone" style="padding: 4px 12px; font-size: 12px;">全不選</button>
                <button class="action-btn" id="selectEnabled" style="padding: 4px 12px; font-size: 12px;">僅選啟用</button>
            </div>
        `;
    };
    
    // 確認匯出
    dialog.querySelector('#confirmExport').addEventListener('click', async () => {
        const selectedIndices = [];
        dialog.querySelectorAll('input[type="checkbox"]').forEach((cb, index) => {
            if (cb.checked) selectedIndices.push(index);
        });
        
        if (selectedIndices.length === 0) {
            alert('請至少選擇一個擴充功能進行匯出');
            return;
        }
        
        const selectedExtensions = selectedIndices.map(index => currentExtensionList[index]).filter(Boolean);
        await performExport(selectedExtensions);
        closeDialog();
    });
}

// 執行實際的匯出操作
async function performExport(extensionList) {
    try {
        const exportData = {
            extensions: extensionList,
            totalCount: extensionList.length,
            enabledCount: extensionList.filter(e => e.enabled).length,
            exportDate: new Date().toISOString(),
            groupCounts: {}
        };
        
        // 計算群組統計
        Object.keys(groupNames).forEach(group => {
            if (group !== 'all') {
                exportData.groupCounts[group] = extensionList.filter(e => e.group === group).length;
            }
        });
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `chrome-extensions-list-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        await logChange(`匯出擴充功能清單 (${extensionList.length} 個項目)`);
        
        // 顯示成功消息
        const successMsg = document.createElement('div');
        successMsg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--success-color);
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10001;
            font-size: 14px;
        `;
        successMsg.textContent = `✅ 已成功匯出 ${extensionList.length} 個擴充功能`;
        document.body.appendChild(successMsg);
        
        setTimeout(() => {
            if (successMsg.parentNode) {
                document.body.removeChild(successMsg);
            }
        }, 3000);
        
    } catch (error) {
        console.error('Export failed:', error);
        alert('匯出失敗：' + error.message);
    }
}

// 清除所有快照
async function clearAllSnapshots() {
    if (confirm('確定要清除所有快照記錄嗎？\n\n此操作無法復原。')) {
        await chrome.storage.local.set({ snapshots: [] });
        loadSnapshotList();
        await logChange('清除所有快照記錄');
        alert('已清除所有快照記錄');
    }
}

// 監聽背景腳本的更新通知
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTENSION_UPDATE') {
        loadExtensions();
    }
});

// 匯入設定資料
async function importData() {
    try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (confirm('確定要匯入設定嗎？這將覆蓋當前的設定。')) {
                await chrome.storage.local.set(data);
                await loadStorageData();
                await loadExtensions();
                alert('設定匯入成功！');
                await logChange('匯入設定資料');
            }
        };
        
        input.click();
    } catch (error) {
        console.error('Import failed:', error);
        alert('匯入失敗：' + error.message);
    }
}

// 篩選歷史記錄
async function filterByDate() {
    const dateInput = document.getElementById('dateFilter');
    if (!dateInput) return;
    
    const selectedDate = dateInput.value;
    if (!selectedDate) {
        await loadHistoryList();
        return;
    }
    
    const result = await chrome.storage.local.get(['changeHistory']);
    const history = result.changeHistory || [];
    
    const filteredHistory = history.filter(item => {
        const itemDate = new Date(item.timestamp).toISOString().split('T')[0];
        return itemDate === selectedDate;
    });
    
    const historyList = document.getElementById('historyList');
    if (filteredHistory.length === 0) {
        historyList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">該日期無變更記錄</div>';
        return;
    }
    
    historyList.innerHTML = filteredHistory.map(item => `
        <div style="border-bottom: 1px solid var(--border-color); padding: 16px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--text-primary);">${item.date.split(' ')[1]}</strong> 
                    <span style="color: var(--text-primary);">${item.action}</span>
                </div>
                <small style="color: var(--text-secondary);">${getTimeAgo(item.timestamp)}</small>
            </div>
        </div>
    `).join('');
}

// 匯出歷史記錄
async function exportHistory() {
    try {
        const result = await chrome.storage.local.get(['changeHistory']);
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

// 清除歷史記錄
async function clearHistory() {
    if (confirm('確定要清除所有歷史記錄嗎？\n\n此操作無法復原。')) {
        await chrome.storage.local.set({ changeHistory: [] });
        await loadHistoryList();
        alert('已清除所有歷史記錄');
    }
}

// ========== 群組管理功能 ==========

// 新增群組
async function addNewGroup() {
    const groupName = prompt('請輸入新群組的名稱：');
    if (!groupName || groupName.trim() === '') {
        return;
    }
    
    const groupId = `custom_${Date.now()}`;
    const displayName = groupName.trim();
    
    // 添加到群組名稱映射
    groupNames[groupId] = displayName;
    
    // 保存到storage
    const customGroups = {};
    Object.keys(groupNames).forEach(key => {
        if (key.startsWith('custom_')) {
            customGroups[key] = groupNames[key];
        }
    });
    
    await chrome.storage.local.set({ customGroupNames: customGroups });
    await logChange(`新增群組：${displayName}`);
    
    // 重新渲染群組列表
    renderGroupList();
}

// 編輯群組名稱（雙擊觸發）
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
    
    // 更新群組名稱
    groupNames[groupId] = newName.trim();
    
    // 保存自定義群組
    const customGroups = {};
    Object.keys(groupNames).forEach(key => {
        if (key.startsWith('custom_') || ['adblocker', 'ai', 'productivity', 'dev', 'screenshot', 'youtube', 'translate', 'scraper', 'other'].includes(key)) {
            if (groupNames[key] !== getDefaultGroupName(key)) {
                customGroups[key] = groupNames[key];
            }
        }
    });
    
    await chrome.storage.local.set({ customGroupNames: customGroups });
    await logChange(`群組重新命名：${currentName} → ${newName.trim()}`);
    
    // 重新渲染
    renderGroupList();
    
    // 如果當前選中的是被編輯的群組，更新顯示
    if (currentGroup === groupId) {
        const nameElement = document.querySelector('#currentGroupName');
        if (nameElement) {
            nameElement.textContent = newName.trim();
        }
    }
}

// 獲取預設群組名稱
function getDefaultGroupName(groupId) {
    const defaultNames = {
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
    return defaultNames[groupId] || '';
}

// 刪除群組
async function deleteGroup(groupId) {
    if (groupId === 'all' || !groupId.startsWith('custom_')) {
        alert('只能刪除自定義群組');
        return;
    }
    
    const groupName = groupNames[groupId];
    const extensionsInGroup = allExtensions.filter(ext => ext.group === groupId);
    
    if (extensionsInGroup.length > 0) {
        const moveToOther = confirm(`群組「${groupName}」中有 ${extensionsInGroup.length} 個擴充功能。\n\n確定要刪除嗎？這些擴充功能將被移到「其他工具」群組。`);
        
        if (!moveToOther) return;
        
        // 將擴充功能移到 other 群組
        extensionsInGroup.forEach(ext => {
            ext.group = 'other';
            extensionGroups[ext.id] = 'other';
        });
        
        await chrome.storage.local.set({ extensionGroups });
    }
    
    // 刪除群組名稱
    delete groupNames[groupId];
    
    // 更新自定義群組設定
    const customGroups = {};
    Object.keys(groupNames).forEach(key => {
        if (key.startsWith('custom_')) {
            customGroups[key] = groupNames[key];
        }
    });
    
    await chrome.storage.local.set({ customGroupNames: customGroups });
    await logChange(`刪除群組：${groupName}`);
    
    // 如果當前選中的是被刪除的群組，切換到「所有擴充功能」
    if (currentGroup === groupId) {
        currentGroup = 'all';
    }
    
    // 重新渲染
    renderGroupList();
    updateGroupCounts();
    await renderExtensions();
}

// 移動擴充功能到群組
async function moveExtensionToGroup(extensionId, targetGroupId) {
    const ext = allExtensions.find(e => e.id === extensionId);
    if (!ext) return;
    
    const oldGroup = ext.group;
    const oldGroupName = groupNames[oldGroup] || '未知群組';
    const newGroupName = groupNames[targetGroupId] || '未知群組';
    
    // 更新擴充功能的群組
    ext.group = targetGroupId;
    extensionGroups[extensionId] = targetGroupId;
    
    // 保存變更
    await chrome.storage.local.set({ extensionGroups });
    await logChange(`移動 ${ext.name}：${oldGroupName} → ${newGroupName}`);
    
    // 更新UI
    updateGroupCounts();
    await renderExtensions();
}

// 重新渲染群組列表
function renderGroupList() {
    const groupListElement = document.getElementById('groupList');
    if (!groupListElement) return;
    
    const groupEntries = Object.entries(groupNames);
    
    groupListElement.innerHTML = groupEntries.map(([groupId, groupName]) => {
        const count = groupId === 'all' 
            ? allExtensions.length 
            : allExtensions.filter(ext => ext.group === groupId).length;
            
        const isActive = currentGroup === groupId ? 'active' : '';
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
    
    // 重新綁定事件監聽器
    initGroupEventListeners();
}

// 初始化群組事件監聽器
function initGroupEventListeners() {
    document.querySelectorAll('.group-item').forEach(item => {
        // 移除舊的監聽器並添加新的
        item.replaceWith(item.cloneNode(true));
    });
    
    // 重新添加點擊事件
    document.querySelectorAll('.group-item').forEach(item => {
        item.addEventListener('click', async function(e) {
            // 防止雙擊編輯時觸發群組切換
            if (e.target.classList.contains('group-name') && e.detail === 2) {
                return;
            }
            
            try {
                e.preventDefault();
                console.log('Group clicked:', this.dataset.group);
                
                document.querySelectorAll('.group-item').forEach(g => g.classList.remove('active'));
                this.classList.add('active');
                currentGroup = this.dataset.group;
                
                // 更新群組名稱顯示
                const groupName = groupNames[currentGroup] || '未知群組';
                const nameElement = document.querySelector('#currentGroupName');
                if (nameElement) {
                    nameElement.textContent = groupName;
                }
                
                // 重新渲染擴充功能列表
                await renderExtensions();
                
                await logChange(`切換到群組：${groupName}`);
            } catch (error) {
                console.error('Group selection error:', error);
            }
        });
    });
}

// 刷新擴充功能狀態
async function refreshExtensionStates() {
    try {
        console.log('Refreshing extension states...');
        
        // 重新載入所有擴充功能
        const extensions = await chrome.management.getAll();
        const freshExtensions = extensions.filter(ext => 
            ext.type === 'extension' && 
            ext.id !== chrome.runtime.id
        );
        
        console.log(`Refreshed ${freshExtensions.length} extensions`);
        
        // 更新現有陣列中的狀態
        allExtensions.forEach(existingExt => {
            const freshExt = freshExtensions.find(ext => ext.id === existingExt.id);
            if (freshExt) {
                const oldEnabled = existingExt.enabled;
                existingExt.enabled = freshExt.enabled;
                
                if (oldEnabled !== freshExt.enabled) {
                    console.log(`Status changed for ${existingExt.name}: ${oldEnabled} → ${freshExt.enabled}`);
                }
            }
        });
        
        // 更新過濾陣列
        filteredExtensions = [...allExtensions];
        
        // 重新渲染和更新統計
        await renderExtensions();
        updateStatistics();
        updateGroupCounts();
        
        await logChange('手動刷新擴充功能狀態');
        
        // 顯示刷新完成提示
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
        
        console.log('Extension states refreshed successfully');
        
    } catch (error) {
        console.error('Failed to refresh extension states:', error);
        alert('刷新失敗：' + error.message);
    }
}

// 復原上一個動作
async function undoLastAction() {
    try {
        const result = await chrome.storage.local.get(['changeHistory']);
        const history = result.changeHistory || [];
        
        if (history.length === 0) {
            alert('沒有可復原的動作');
            return;
        }
        
        const lastAction = history[0];
        
        // 檢查是否有復原資料
        if (!lastAction.undoData) {
            alert('此操作無法復原（缺少復原資料）');
            return;
        }
        
        const undoData = lastAction.undoData;
        let undoSuccess = false;
        
        // 根據操作類型執行復原
        switch (undoData.type) {
            case 'toggleExtension':
                const ext = allExtensions.find(e => e.id === undoData.extensionId);
                if (ext) {
                    // 恢復到之前的狀態
                    await chrome.management.setEnabled(undoData.extensionId, undoData.previousState);
                    ext.enabled = undoData.previousState;
                    
                    await renderExtensions();
                    updateStatistics();
                    updateGroupCounts();
                    
                    undoSuccess = true;
                    alert(`已復原：${undoData.extensionName} ${undoData.previousState ? '已啟用' : '已停用'}`);
                } else {
                    alert(`無法找到擴充功能：${undoData.extensionName}`);
                }
                break;
                
            case 'batchToggle':
                // 批量操作復原
                let successCount = 0;
                for (const extData of undoData.extensions) {
                    const ext = allExtensions.find(e => e.id === extData.id);
                    if (ext) {
                        try {
                            await chrome.management.setEnabled(extData.id, extData.previousState);
                            ext.enabled = extData.previousState;
                            successCount++;
                        } catch (error) {
                            console.error(`Failed to restore ${extData.name}:`, error);
                        }
                    }
                }
                
                if (successCount > 0) {
                    await renderExtensions();
                    updateStatistics();
                    updateGroupCounts();
                    undoSuccess = true;
                    alert(`已復原 ${successCount} 個擴充功能的狀態`);
                }
                break;
                
            case 'snapshot':
                // 快照復原的復原（恢復到快照前的狀態）
                if (undoData.previousSnapshot) {
                    // 這裡可以實現快照復原的復原邏輯
                    alert('快照復原暫不支援自動復原，請手動調整或建立新快照');
                }
                break;
                
            default:
                alert('未知的操作類型，無法復原');
                return;
        }
        
        // 如果復原成功，從歷史記錄中移除該操作
        if (undoSuccess) {
            history.shift();
            await chrome.storage.local.set({ changeHistory: history });
            updateRecentChanges();
            
            // 記錄復原操作（但不包含復原資料，避免循環）
            await logChange(`復原操作：${lastAction.action}`);
        }
        
    } catch (error) {
        console.error('Undo failed:', error);
        alert('復原失敗：' + error.message);
    }
}

// 統一的動作處理器
let actionHandlersInitialized = false;
function initActionHandlers() {
    if (actionHandlersInitialized) {
        console.log('Action handlers already initialized, skipping...');
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
        
        console.log('Action triggered:', action, extId);
        
        try {
            switch (action) {
                // 擴充功能相關操作
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
                
                // 排序和快照操作
                case 'sortByStatus':
                    await sortByStatus();
                    break;
                case 'sortByName':
                    await sortByName();
                    break;
                case 'createSnapshot':
                    await createSnapshot();
                    break;
                case 'restoreSnapshot':
                    if (snapshotId) await restoreSnapshot(snapshotId);
                    break;
                
                // 設定相關操作
                case 'resetTheme':
                    await resetTheme();
                    break;
                case 'resetCardSize':
                    await resetCardSize();
                    break;
                case 'clearAllSnapshots':
                    await clearAllSnapshots();
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
                
                // 歷史記錄相關操作
                case 'filterByDate':
                    await filterByDate();
                    break;
                case 'exportHistory':
                    await exportHistory();
                    break;
                case 'clearHistory':
                    await clearHistory();
                    break;
                case 'showHistoryView':
                    await showView('history');
                    break;
                case 'undoLastAction':
                    await undoLastAction();
                    break;
                case 'decreaseWidth':
                    adjustCardSize('width', -20);
                    break;
                case 'increaseWidth':
                    adjustCardSize('width', 20);
                    break;
                case 'decreaseHeight':
                    adjustCardSize('height', -20);
                    break;
                case 'increaseHeight':
                    adjustCardSize('height', 20);
                    break;
                case 'applyCardSize':
                    await applyCardSize();
                    break;
                        case 'refreshExtensions':
                            await refreshExtensionStates();
                            break;
                        case 'addNewGroup':
                            await addNewGroup();
                            break;
                        case 'deleteGroup':
                            const groupId = target.getAttribute('data-group-id');
                            await deleteGroup(groupId);
                            break;
                
                default:
                    console.warn('Unknown action:', action);
            }
        } catch (error) {
            console.error('Action handler error:', action, error);
        }
    });
    
    // 處理描述編輯
    document.addEventListener('click', (e) => {
        if (e.target.matches('.extension-description[data-action="editDescription"]')) {
            const extId = e.target.getAttribute('data-ext-id');
            if (extId) editDescription(extId, e.target);
        }
    });
    
    // 處理描述保存
    document.addEventListener('blur', (e) => {
        if (e.target.matches('.extension-description[data-action="editDescription"]')) {
            const extId = e.target.getAttribute('data-ext-id');
            if (extId) saveDescription(extId, e.target.textContent, e.target);
        }
    }, true);
    
    // 處理描述鍵盤事件
    document.addEventListener('keydown', (e) => {
        if (e.target.matches('.extension-description[data-action="editDescription"]')) {
            handleDescriptionKeydown(e);
        }
    });
    
    // 處理圖標載入錯誤
    document.addEventListener('error', (e) => {
        if (e.target.matches('.ext-icon-img')) {
            const extId = e.target.getAttribute('data-ext-id');
            const fallback = e.target.getAttribute('data-fallback');
            if (extId && fallback) {
                handleIconError(extId, fallback);
            }
        }
    }, true);
    
    // 處理圖標載入成功
    document.addEventListener('load', (e) => {
        if (e.target.matches('.ext-icon-img')) {
            const extId = e.target.getAttribute('data-ext-id');
            if (extId) {
                handleIconSuccess(extId);
            }
        }
    }, true);
}

// 頁面載入時初始化
window.addEventListener('load', () => {
    try {
        initEventListeners();
        loadSnapshotList();
        updateRecentChanges();
        initActionHandlers(); // 初始化統一的動作處理器
        
        // 綁定雙擊編輯群組名稱事件
        document.addEventListener('dblclick', async (e) => {
            const target = e.target.closest('[data-action="editGroupName"]');
            if (!target) return;
            
            const groupId = target.getAttribute('data-group-id');
            if (groupId && groupId !== 'all') {
                await editGroupName(groupId);
            }
        });
        
    } catch (error) {
        console.error('Window load error:', error);
    }
});
