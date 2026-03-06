// Chrome 擴充功能管理器 - 動態樣式注入
// ==================== CSS 動態樣式 ====================

/**
 * 添加必要的CSS樣式
 */
function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* 拖放高亮 */
    .group-item.drag-over {
      background-color: var(--accent-color) !important;
      color: var(--bg-primary) !important;
      transform: scale(1.02);
      box-shadow: 0 2px 8px rgba(102, 217, 239, 0.3);
    }
    
    /* 拖放中的卡片 */
    .extension-card.dragging {
      opacity: 0.6;
      transform: scale(0.98);
    }
    
    /* 保留記錄hover效果 */
    .archive-item[data-filter]:hover {
      border-color: var(--accent-color) !important;
      box-shadow: 0 2px 8px rgba(102, 217, 239, 0.2);
    }
    
    /* 群組標籤hover效果 */
    .tag.functional:hover,
    .tag.device:hover {
      opacity: 0.8;
      cursor: pointer;
    }
    
    /* 模態對話框動畫 */
    .modal-backdrop {
      animation: fadeIn 0.2s ease;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    
    /* 單選按鈕樣式 */
    .radio-option:hover {
      background: var(--card-bg) !important;
    }
    
    .radio-option input[type="radio"]:checked + .option-content strong {
      color: var(--accent-color);
    }
  `;

  document.head.appendChild(style);
  console.log('Custom styles injected');
}
