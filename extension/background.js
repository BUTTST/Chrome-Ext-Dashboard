// Chrome 擴充功能管理器 - 背景服務
// 用於監聽擴充功能狀態變化並通知UI更新

// 監聽擴充功能狀態變化
chrome.management.onEnabled.addListener((info) => {
  console.log('Extension enabled:', info.name);
  notifyExtensionUpdate();
});

chrome.management.onDisabled.addListener((info) => {
  console.log('Extension disabled:', info.name);
  notifyExtensionUpdate();
});

chrome.management.onInstalled.addListener(async (info) => {
  console.log('Extension installed:', info.name);
  notifyExtensionUpdate();
  
  // 為新安裝的擴充功能創建預設分類和元數據
  const result = await chrome.storage.local.get([
    'extensionGroups',
    'extensionDeviceGroups',
    'extensionMetadata'
  ]);
  
    const groups = result.extensionGroups || {};
  const deviceGroups = result.extensionDeviceGroups || {};
  const metadata = result.extensionMetadata || {};
  
    if (!groups[info.id]) {
    groups[info.id] = 'other';
  }
  
  if (!deviceGroups[info.id]) {
    deviceGroups[info.id] = 'all_devices';
  }
  
  // 記錄安裝時間和基本信息
  if (!metadata[info.id]) {
    metadata[info.id] = {
      name: info.name,
      version: info.version,
      installTime: Date.now(),
      lastModified: Date.now(),
      groupHistory: [{
        functionalGroup: groups[info.id],
        deviceGroup: deviceGroups[info.id],
        timestamp: Date.now(),
        action: 'installed'
      }],
      source: 'installed'
    };
  }
  
  await chrome.storage.local.set({
    extensionGroups: groups,
    extensionDeviceGroups: deviceGroups,
    extensionMetadata: metadata
  });
});

// 跟踪最近的用户操作，用于区分手动删除和自动删除
let recentUserActions = new Map();
const USER_ACTION_TIMEOUT = 30000; // 30秒内认为是有用户操作的

chrome.management.onUninstalled.addListener(async (id) => {
  console.log('Extension uninstalled:', id);
  notifyExtensionUpdate();
  
  try {
    // 检查是否有用户操作记录
    const hasRecentUserAction = recentUserActions.has(id);
    const deleteType = hasRecentUserAction ? 'manual' : 'auto';

    // 清除用户操作记录
    recentUserActions.delete(id);

    // 获取扩展信息（在卸载前应该从存储中获取）
    const storageData = await chrome.storage.local.get([
      'extensionMetadata',
      'extensionGroups',
      'extensionDeviceGroups',
      'extensionDescriptions'
    ]);
    
    const extensionMetadata = storageData.extensionMetadata || {};
    const extensionGroups = storageData.extensionGroups || {};
    const extensionDeviceGroups = storageData.extensionDeviceGroups || {};
    const extensionDescriptions = storageData.extensionDescriptions || {};
    
    // 构建扩展信息对象
    const extensionInfo = {
      id: id,
      name: extensionMetadata[id]?.name || '未知擴充功能',
      version: extensionMetadata[id]?.version || 'N/A',
      group: extensionGroups[id] || 'other',
      deviceGroup: extensionDeviceGroups[id] || 'all_devices',
      description: extensionDescriptions[id] || '',
      metadata: extensionMetadata[id] || {}
    };

    console.log('Extension info before deletion:', extensionInfo);

    // 保留删除记录而不是清除数据
    await saveDeletedExtension(id, deleteType, extensionInfo);

    // 从活跃扩展中移除，但保留在元数据中
    chrome.storage.local.get(['extensionGroups', 'extensionDescriptions', 'extensionDeviceGroups'], (result) => {
    const groups = result.extensionGroups || {};
    const descriptions = result.extensionDescriptions || {};
      const deviceGroups = result.extensionDeviceGroups || {};
    
      // 移除活跃状态，但保留元数据记录
    delete groups[id];
    delete descriptions[id];
      delete deviceGroups[id];
    
    chrome.storage.local.set({ 
      extensionGroups: groups,
        extensionDescriptions: descriptions,
        extensionDeviceGroups: deviceGroups
      });
    });

  } catch (error) {
    console.error('Error handling extension uninstall:', error);
  }
});

// 通知UI更新
function notifyExtensionUpdate() {
  // 向所有監聽的頁面發送更新通知
  chrome.runtime.sendMessage({ 
    type: 'EXTENSION_UPDATE' 
  }).catch(() => {
    // 忽略沒有監聽者的錯誤
  });
}

// 處理來自content script或popup的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_EXTENSIONS') {
    chrome.management.getAll((extensions) => {
      sendResponse({ extensions });
    });
    return true; // 保持訊息通道開放
  }
  
  if (request.type === 'TOGGLE_EXTENSION') {
    chrome.management.setEnabled(request.id, request.enabled, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.type === 'UNINSTALL_EXTENSION') {
    // 记录用户操作，用于区分手动删除和自动删除
    recordUserAction(request.id, 'uninstall');
    chrome.management.uninstall(request.id, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === 'UPDATE_DELETE_TYPE') {
    // 允许用户手动更改删除类型标注
    updateDeleteType(request.extensionId, request.deleteType);
    sendResponse({ success: true });
    return true;
  }
});

/**
 * 保存已删除扩展的记录
 */
async function saveDeletedExtension(id, deleteType, extensionInfo) {
  try {
    const result = await chrome.storage.local.get([
      'deletedExtensions',
      'extensionMetadata',
      'extensionGroups',
      'extensionDeviceGroups',
      'extensionDescriptions'
    ]);

    const deletedExtensions = result.deletedExtensions || [];
    const extensionMetadata = result.extensionMetadata || {};
    const extensionGroups = result.extensionGroups || {};
    const extensionDeviceGroups = result.extensionDeviceGroups || {};
    const extensionDescriptions = result.extensionDescriptions || {};

    const now = Date.now();

    // 创建删除记录 - 使用传入的 extensionInfo
    const deletedRecord = {
      id: extensionInfo.id,
      name: extensionInfo.name,
      version: extensionInfo.version,
      deleteTime: now,
      deleteType: deleteType,
      functionalGroup: extensionInfo.group,
      deviceGroup: extensionInfo.deviceGroup,
      description: extensionInfo.description,
      metadata: {
        ...extensionInfo.metadata,
        deleteTime: now,
        deleteType: deleteType,
        isDeleted: true
      }
    };

    // 添加到删除记录列表
    deletedExtensions.unshift(deletedRecord);

    // 更新元数据中的删除信息
    if (!extensionMetadata[id]) {
      extensionMetadata[id] = {};
    }
    extensionMetadata[id].deleteTime = now;
    extensionMetadata[id].deleteType = deleteType;
    extensionMetadata[id].isDeleted = true;

    // 检查是否需要清理提示
    const needsCleanup = deletedExtensions.length > 100;

    await chrome.storage.local.set({
      deletedExtensions: deletedExtensions,
      extensionMetadata: extensionMetadata,
      archiveNeedsCleanup: needsCleanup
    });

    console.log(`Saved deleted extension record: ${deletedRecord.name} (${deleteType})`);
  } catch (error) {
    console.error('Error saving deleted extension:', error);
  }
}

/**
 * 记录用户操作
 */
function recordUserAction(extensionId, actionType) {
  recentUserActions.set(extensionId, {
    type: actionType,
    timestamp: Date.now()
  });

  // 设置超时清除
  setTimeout(() => {
    recentUserActions.delete(extensionId);
  }, USER_ACTION_TIMEOUT);
}

/**
 * 更新删除类型标注
 */
async function updateDeleteType(extensionId, newDeleteType) {
  try {
    const result = await chrome.storage.local.get(['deletedExtensions', 'extensionMetadata']);
    const deletedExtensions = result.deletedExtensions || [];
    const extensionMetadata = result.extensionMetadata || {};

    // 更新删除记录中的类型
    const recordIndex = deletedExtensions.findIndex(ext => ext.id === extensionId);
    if (recordIndex !== -1) {
      deletedExtensions[recordIndex].deleteType = newDeleteType;
    }

    // 更新元数据中的类型
    if (extensionMetadata[extensionId]) {
      extensionMetadata[extensionId].deleteType = newDeleteType;
    }

    await chrome.storage.local.set({
      deletedExtensions: deletedExtensions,
      extensionMetadata: extensionMetadata
    });

    console.log(`Updated delete type for ${extensionId} to ${newDeleteType}`);
  } catch (error) {
    console.error('Error updating delete type:', error);
  }
}

// 點擊擴充功能圖標時直接開啟options頁面
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// 初始化：設置預設的分類映射
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension Manager v2.0 installed');
  
  // 初始化預設分類
  const defaultGroups = {
    // 廣告封鎖與隱私
    'bgnkhhnnamicmpeenaelnjfhikgbkllg': 'adblocker', // AdGuard
    'ldadnegmmggmmgbijlnmjhcnjcpgkfdj': 'adblocker', // youBlock
    'eimadpbcbfnmbkopoojfekhnkhdbieeh': 'adblocker', // Dark Reader
    'onepmapfbjohnegdmfhndpefjkppbjkm': 'adblocker', // SuperCopy
    
    // AI助手
    'ojnbohmppadfgpejeebfnmnknjdlckgj': 'ai', // AIPRM
    'ofpnmcalabcbjgholdjcjblkibolbppb': 'ai', // Monica
    'befflofjcniongenjmbkgkoljhgliihe': 'ai', // TinaMind
    'enkmmegahkfbohjlnmmmkiicmhoglnne': 'ai', // 小結
    'ilmdofdhpnhffldihboadndccenlnfll': 'ai', // ChatGPT Export
    
    // 生產力工具
    'knheggckgoiihginacbkhaalnibhilkk': 'productivity', // Notion
    'chphlpgkkbolifaimnlloiipkdnihall': 'productivity', // OneTab
    'lpcaedmchfhocbbapmcbpinfpgnhiddi': 'productivity', // Google Keep
    'efaidnbmnnnibpcajpcglclefindmkaj': 'productivity', // Adobe PDF
    
    // 開發工具
    'bkhaagjahfmjljalopjnoealnfndnagc': 'dev', // Octotree
    'dhdgffkkebhmkfjojejmpbldmpobfkfo': 'dev', // 篡改猴
    'jlmpjdjjbgclbocgajdjefcidcncaied': 'dev', // daily.dev
    
    // YouTube工具
    'hjfkenebldkfgibelglepinlabpjfbll': 'youtube', // No Shorts
    'nmmicjeknamkfloonkhhcjmomieiodli': 'youtube', // Summary
    'nghlhmhjdlbcgnmjffpeialapbcnajig': 'youtube', // 翻譯修正
    
    // 翻譯工具
    'aapbdbdomjkkjkaonfhkkikfgjllcleb': 'translate', // Google翻譯
    'bpoadfkcbjbfhfodiogcnhhhpibjhbnh': 'translate', // 沉浸式翻譯
  };
  
  chrome.storage.local.set({ 
    extensionGroups: defaultGroups,
    autoSnapshot: true,
    theme: 'dark',
    // v2.0 新增默认值
    deviceGroupNames: {
      'all_devices': '🌐 所有設備',
      'desktop_main': '🖥️ 主力機',
      'laptop_portable': '💻 外出筆電'
    },
    extensionDeviceGroups: {},
    extensionMetadata: {},
    deletedExtensions: [],
    archiveNeedsCleanup: false,
    archiveWarningDismissed: false
  });
});
