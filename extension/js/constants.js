// Chrome 擴充功能管理器 - 常量定義
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
  archiveNeedsCleanup: 'archiveNeedsCleanup',

  // v2.1 新增 (新功能)
  extensionTranslations: 'extensionTranslations',
  extensionHealthData: 'extensionHealthData',
  displaySettings: 'displaySettings',
  preferredDescTab: 'preferredDescTab'
};
