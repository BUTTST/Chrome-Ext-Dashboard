// Chrome 擴充功能管理器 - 主題管理
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
