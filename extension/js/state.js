// Chrome 擴充功能管理器 - 全域狀態變數
// ==================== 全域變數 ====================
let allExtensions = [];
let filteredExtensions = [];
let deletedExtensions = [];

// 當前篩選狀態
let currentFilters = {
  functionalGroup: 'all',
  deviceGroup: 'all_devices',
  viewMode: 'manager' // 'manager' | 'history' | 'settings' | 'archived'
};

// v2.1 全域變數
let extensionTranslations = {};
let extensionHealthData = {};
let displaySettings = {
  showRating: true,
  showUserCount: true,
  showUpdateTime: true
};
let preferredDescTab = 'translated';

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

