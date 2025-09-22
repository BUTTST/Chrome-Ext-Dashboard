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

chrome.management.onInstalled.addListener((info) => {
  console.log('Extension installed:', info.name);
  notifyExtensionUpdate();
  
  // 為新安裝的擴充功能創建預設分類
  chrome.storage.local.get(['extensionGroups'], (result) => {
    const groups = result.extensionGroups || {};
    if (!groups[info.id]) {
      groups[info.id] = 'other'; // 預設分到其他工具群組
      chrome.storage.local.set({ extensionGroups: groups });
    }
  });
});

chrome.management.onUninstalled.addListener((id) => {
  console.log('Extension uninstalled:', id);
  notifyExtensionUpdate();
  
  // 清理已卸載擴充功能的資料
  chrome.storage.local.get(['extensionGroups', 'extensionDescriptions'], (result) => {
    const groups = result.extensionGroups || {};
    const descriptions = result.extensionDescriptions || {};
    
    delete groups[id];
    delete descriptions[id];
    
    chrome.storage.local.set({ 
      extensionGroups: groups,
      extensionDescriptions: descriptions
    });
  });
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
    chrome.management.uninstall(request.id, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// 初始化：設置預設的分類映射
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension Manager installed');
  
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
    theme: 'dark'
  });
});
