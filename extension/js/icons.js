// Chrome 擴充功能管理器 - 圖標處理
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
  if (days < 365) return `${Math.floor(days / 30)}個月前`;
  return `${Math.floor(days / 365)}年前`;
}

/**
 * 處理圖標錯誤
 */
window.handleIconError = function (extId, fallbackIcon) {
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
window.handleIconSuccess = function (extId) {
  const iconContainer = document.getElementById(`icon-${extId}`);
  if (iconContainer) {
    const fallback = iconContainer.querySelector('.fallback-icon');
    if (fallback) fallback.style.display = 'none';
  }
};
