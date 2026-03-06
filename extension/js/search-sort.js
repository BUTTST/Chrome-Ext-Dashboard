// Chrome 擴充功能管理器 - 搜尋與排序
// ==================== 搜尋功能 ====================

/**
 * 初始化搜尋功能
 */
function initSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      await renderExtensions(e.target.value);
    }, 300);
  });
}

// ==================== 排序功能 ====================

/**
 * 按狀態排序
 */
async function sortByStatus() {
  userRequestedSort = true;
  currentSortMode = 'status';

  await renderExtensions();
  await logChange('執行狀態排序');
}

/**
 * 按名稱排序
 */
async function sortByName() {
  userRequestedSort = true;
  currentSortMode = 'name';

  await renderExtensions();
  await logChange('執行名稱排序');
}
