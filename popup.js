// Chrome 擴充功能管理器 - Popup 邏輯

let allExtensions = [];
let filteredExtensions = [];

// DOM 元素
const loadingState = document.getElementById('loadingState');
const extensionsList = document.getElementById('extensionsList');
const noResults = document.getElementById('noResults');
const searchInput = document.getElementById('searchInput');
const openOptionsBtn = document.getElementById('openOptions');
const snapshotBtn = document.getElementById('snapshotBtn');
const settingsBtn = document.getElementById('settingsBtn');

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await initTheme();
    await loadExtensions();
    initEventListeners();
});

// 初始化主題
async function initTheme() {
    const result = await chrome.storage.local.get(['theme']);
    const theme = result.theme || 'dark';
    document.body.setAttribute('data-theme', theme);
}

// 載入擴充功能
async function loadExtensions() {
    try {
        const extensions = await chrome.management.getAll();
        allExtensions = extensions.filter(ext => 
            ext.type === 'extension' && 
            ext.id !== chrome.runtime.id // 排除自己
        );
        
        // 載入自訂描述和群組
        const storage = await chrome.storage.local.get(['extensionDescriptions', 'extensionGroups']);
        const descriptions = storage.extensionDescriptions || {};
        const groups = storage.extensionGroups || {};
        
        // 合併資料
        allExtensions.forEach(ext => {
            ext.customDesc = descriptions[ext.id] || '';
            ext.group = groups[ext.id] || 'other';
        });
        
        filteredExtensions = [...allExtensions];
        renderExtensions();
        
        loadingState.style.display = 'none';
        extensionsList.style.display = 'block';
    } catch (error) {
        console.error('Failed to load extensions:', error);
        loadingState.textContent = '載入失敗';
    }
}

// 渲染擴充功能列表
function renderExtensions() {
    if (filteredExtensions.length === 0) {
        extensionsList.style.display = 'none';
        noResults.style.display = 'block';
        return;
    }
    
    extensionsList.style.display = 'block';
    noResults.style.display = 'none';
    
    extensionsList.innerHTML = filteredExtensions.map(ext => {
        // 嘗試多種圖標路径
        const iconPaths = [
            `chrome-extension://${ext.id}/icon.png`,
            `chrome-extension://${ext.id}/icons/icon48.png`,
            `chrome-extension://${ext.id}/icon48.png`,
            `chrome-extension://${ext.id}/images/icon.png`
        ];
        
        return `
        <div class="extension-item" data-id="${ext.id}">
            <div class="extension-icon">
                <img src="${iconPaths[0]}" 
                     onerror="tryNextIcon(this, '${ext.id}', ${JSON.stringify(iconPaths)}, 1)"
                     onload="this.nextElementSibling.style.display='none';">
                <div style="display:flex; width:100%; height:100%; align-items:center; justify-content:center; background: linear-gradient(135deg, var(--accent-color), var(--success-color)); border-radius: 4px; color: var(--bg-primary); font-size: 16px;">
                    ${getExtensionIcon(ext)}
                </div>
            </div>
            <div class="extension-info">
                <div class="extension-name" title="${ext.name}">${ext.name}</div>
                <div class="extension-status">
                    v${ext.version} • ${ext.enabled ? '已啟用' : '已停用'}
                </div>
            </div>
            <div class="quick-toggle">
                <div class="toggle-switch-small ${ext.enabled ? 'active' : ''}" 
                     onclick="toggleExtension('${ext.id}')"></div>
            </div>
        </div>
        `;
    }).join('');
}

// 嘗試載入下一個圖標路径
function tryNextIcon(imgElement, extId, iconPaths, currentIndex) {
    if (currentIndex < iconPaths.length) {
        imgElement.src = iconPaths[currentIndex];
        imgElement.onerror = () => tryNextIcon(imgElement, extId, iconPaths, currentIndex + 1);
    } else {
        // 所有路径都失敗，顯示fallback
        imgElement.style.display = 'none';
        if (imgElement.nextElementSibling) {
            imgElement.nextElementSibling.style.display = 'flex';
        }
    }
}

// 獲取擴充功能圖示
function getExtensionIcon(ext) {
    // 根據擴充功能ID返回合適的emoji
    const iconMap = {
        'bgnkhhnnamicmpeenaelnjfhikgbkllg': '🛡️', // AdGuard
        'ldadnegmmggmmgbijlnmjhcnjcpgkfdj': '🚫', // youBlock
        'eimadpbcbfnmbkopoojfekhnkhdbieeh': '🌙', // Dark Reader
        'onepmapfbjohnegdmfhndpefjkppbjkm': '📋', // SuperCopy
        'ojnbohmppadfgpejeebfnmnknjdlckgj': '🤖', // AIPRM
        'ofpnmcalabcbjgholdjcjblkibolbppb': '🎯', // Monica
        'befflofjcniongenjmbkgkoljhgliihe': '🧠', // TinaMind
        'enkmmegahkfbohjlnmmmkiicmhoglnne': '📝', // 小結
        'ilmdofdhpnhffldihboadndccenlnfll': '💾', // ChatGPT Export
        'knheggckgoiihginacbkhaalnibhilkk': '📌', // Notion
        'chphlpgkkbolifaimnlloiipkdnihall': '📑', // OneTab
        'lpcaedmchfhocbbapmcbpinfpgnhiddi': '📝', // Google Keep
        'bkhaagjahfmjljalopjnoealnfndnagc': '🌳', // Octotree
        'dhdgffkkebhmkfjojejmpbldmpobfkfo': '🐒', // 篡改猴
        'aapbdbdomjkkjkaonfhkkikfgjllcleb': '🌐', // Google翻譯
        'bpoadfkcbjbfhfodiogcnhhhpibjhbnh': '📖', // 沉浸式翻譯
        'hjfkenebldkfgibelglepinlabpjfbll': '🎬', // No YouTube Shorts
        'nmmicjeknamkfloonkhhcjmomieiodli': '📺', // YouTube Summary
        'dbjbempljhcmhlfpfacalomonjpalpko': '🖼️', // 圖片助手
        'nkbihfbeogaeaoehlefnkodbefgpgknn': '🦊', // MetaMask
        'ophjlpahpchlmihnnnihgmmeilfjmjjc': '💬', // LINE
    };
    
    return iconMap[ext.id] || '🔧';
}

// 切換擴充功能狀態
async function toggleExtension(id) {
    try {
        const ext = allExtensions.find(e => e.id === id);
        if (!ext) return;
        
        await chrome.management.setEnabled(id, !ext.enabled);
        
        // 更新本地狀態
        ext.enabled = !ext.enabled;
        
        // 重新渲染
        renderExtensions();
        
        // 記錄變更
        await logChange(`${ext.enabled ? '啟用' : '停用'} ${ext.name}`);
        
    } catch (error) {
        console.error('Failed to toggle extension:', error);
        alert(`無法切換擴充功能狀態：${error.message}`);
    }
}

// 搜尋功能
function filterExtensions(query) {
    if (!query.trim()) {
        filteredExtensions = [...allExtensions];
    } else {
        const lowerQuery = query.toLowerCase();
        filteredExtensions = allExtensions.filter(ext =>
            ext.name.toLowerCase().includes(lowerQuery) ||
            ext.id.includes(lowerQuery)
        );
    }
    renderExtensions();
}

// 記錄變更
async function logChange(action) {
    const timestamp = Date.now();
    const logEntry = {
        timestamp,
        action,
        date: new Date().toLocaleString('zh-TW')
    };
    
    const result = await chrome.storage.local.get(['changeHistory']);
    const history = result.changeHistory || [];
    history.unshift(logEntry);
    
    // 只保留最近 100 筆記錄
    if (history.length > 100) {
        history.splice(100);
    }
    
    await chrome.storage.local.set({ changeHistory: history });
}

// 建立快照
async function createSnapshot() {
    try {
        const enabledExtensions = allExtensions.filter(ext => ext.enabled);
        const snapshot = {
            timestamp: Date.now(),
            date: new Date().toLocaleString('zh-TW'),
            extensions: enabledExtensions.map(ext => ({
                id: ext.id,
                name: ext.name,
                version: ext.version,
                enabled: ext.enabled
            })),
            count: enabledExtensions.length
        };
        
        const result = await chrome.storage.local.get(['snapshots']);
        const snapshots = result.snapshots || [];
        snapshots.unshift(snapshot);
        
        // 只保留最近 30 個快照
        if (snapshots.length > 30) {
            snapshots.splice(30);
        }
        
        await chrome.storage.local.set({ snapshots });
        await logChange(`建立快照 - ${snapshot.count}個擴充功能`);
        
        alert(`快照建立成功！\n已記錄 ${snapshot.count} 個啟用的擴充功能`);
    } catch (error) {
        console.error('Failed to create snapshot:', error);
        alert('建立快照失敗');
    }
}

// 初始化事件監聽器
function initEventListeners() {
    // 搜尋功能
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filterExtensions(e.target.value);
        }, 300);
    });
    
    // 開啟完整管理介面
    openOptionsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
    });
    
    // 建立快照
    snapshotBtn.addEventListener('click', createSnapshot);
    
    // 開啟設定
    settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
    });
}

// 監聽背景腳本的更新通知
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTENSION_UPDATE') {
        loadExtensions();
    }
});
