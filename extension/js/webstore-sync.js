// Chrome 擴充功能管理器 - 商店數據同步 (v2.1)
// ==================== v2.1 輔助功能 ====================

// 自動翻譯用到的變數與佇列
let translationQueue = [];
let isTranslating = false;

/**
 * 從 Google Translate API 獲取翻譯
 */
async function translateText(text) {
  if (!text || text.trim() === '') return '';
  try {
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-TW&dt=t&q=${encodeURIComponent(text)}`);
    const data = await response.json();
    return data[0].map(x => x[0]).join('');
  } catch (err) {
    console.error('Translation API error:', err);
    return null;
  }
}

/**
 * 翻譯指定擴充功能的描述
 */
async function translateExtensionDescription(id) {
  const ext = allExtensions.find(e => e.id === id);
  if (!ext) return null;

  const translated = await translateText(ext.customDesc);
  if (translated) {
    extensionTranslations[id] = translated;
    await chrome.storage.local.set({ [STORAGE_KEYS.extensionTranslations]: extensionTranslations });
    return translated;
  }
  return null;
}

/**
 * 觸發自動翻譯 (將其加入背景排隊處理)
 */
window.triggerAutoTranslation = function (id) {
  // 如果已經在隊列中，不重複加入
  if (translationQueue.includes(id)) return;

  translationQueue.push(id);
  processTranslationQueue();
};

/**
 * 處理背景翻譯佇列
 */
async function processTranslationQueue() {
  if (isTranslating || translationQueue.length === 0) return;

  isTranslating = true;

  while (translationQueue.length > 0) {
    const extId = translationQueue.shift();

    // 如果這時候該擴充功能已經有翻譯了 (可能中途被其他人翻譯或從緩存)，就跳過
    if (extensionTranslations[extId]) continue;

    try {
      const translated = await translateExtensionDescription(extId);
      if (translated) {
        // 更新當前已經實例化的對象
        const ext = allExtensions.find(e => e.id === extId);
        if (ext) ext.translation = translated;

        // 如果目前畫面上正顯示這個擴充功能的翻譯 Tab，且文字是「自動翻譯中...」，就幫它原地更新
        const descEl = document.getElementById(`desc-${extId}`);
        if (descEl && descEl.textContent === '自動翻譯中...') {
          descEl.textContent = translated;
        }
      }
    } catch (err) {
      console.error(`Auto translation failed for ${extId}:`, err);
    }

    // 故意等待 0.5 ~ 1 秒鐘，不要讓 Google Translate API 被塞爆引發 429 Error
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  isTranslating = false;
}

/**
 * 從 Chrome Web Store 同步詳情
 */
async function syncExtensionStoreData(id) {
  try {
    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'FETCH_STORE_DATA', id: id }, resolve);
    });

    if (!response || !response.success) {
      console.error(`Store sync failed for ${id}:`, response?.error);
      return null;
    }

    const html = response.html;

    // 使用 DOMParser 解析 HTML 以提高通用可靠性
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    let rating = '?.?';
    let userCount = '未知';
    let lastUpdate = '未知';

    // 1. 取得評分
    const ratingEl = doc.querySelector('[aria-label*="顆星"], [aria-label*="stars"], [itemprop="ratingValue"]');
    if (ratingEl) {
      let text = ratingEl.getAttribute('aria-label') || ratingEl.textContent;
      let m = text.match(/([0-9.]+)/);
      if (m) rating = parseFloat(m[1]).toFixed(1);
    }
    // Fallback 評分
    if (rating === '?.?') {
      const match = html.match(/([0-9.]+)\s*(?:out of 5|分\s*\(\s*滿分\s*5\s*分\s*\))/i) || html.match(/ratingValue["']\s*:\s*["']?([0-9.]+)/i);
      if (match) rating = parseFloat(match[1]).toFixed(1);
    }

    // 2. 取得使用者人數
    const allTextNodes = Array.from(doc.querySelectorAll('div, span, li'));
    // 尋找包含 `users` 或 `使用者` 的短文字節點
    const userNode = allTextNodes.find(el => {
      const txt = el.textContent.trim();
      if (txt.length > 50 || txt.length < 2) return false; // 排除整頁全文字
      if (txt.match(/([0-9,萬億十百]+)\+?\s*(?:users|位?使用者|使\s*用\s*者)/i)) return true;
      if (txt.match(/([0-9,]+)/) && (txt.includes('users') || txt.includes('使用者'))) return true;
      if (el.classList.contains('F9aa1')) return true; // Google Store 特定 user quantity class
      return false;
    });

    if (userNode) {
      let txt = userNode.textContent.trim();
      const match = txt.match(/([0-9,萬億十百]+)\+?\s*(?:users|位?使用者|使\s*用\s*者)/i);
      if (match) {
        userCount = match[1];
      } else {
        // 提取第一段數字或文字 (例如 "10,000,000+ 個使用者" 取 "10,000,000")
        userCount = txt.split(/(?:users|使用者|使\s*用\s*者)/i)[0].replace(/[+＋]/g, '').trim();
      }
    }
    // Fallback 使用者人數 Regex (全域)
    if (userCount === '未知' || !userCount) {
      const broadMatch = html.match(/([0-9,]+)\+?\s*(?:users|位?使用者)/i) || html.match(/class="F9aa1"[^>]*>([^<]+)<\/div>/i);
      if (broadMatch) userCount = broadMatch[1].replace('+', '').trim();
    }

    // 當人數格式像 "1,000,000,000" 時保留逗號，但去除多餘文字
    if (userCount !== '未知' && userCount) {
      userCount = userCount.replace(/[^0-9,萬億十百]/g, '');
    }

    // 3. 取得最後更新時間
    const updateNode = allTextNodes.find(el => {
      const txt = el.textContent.trim();
      return (txt === 'Updated' || txt === '已更新' || txt === '最後更新日期');
    });

    if (updateNode) {
      if (updateNode.nextElementSibling && updateNode.nextElementSibling.textContent.match(/[0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日/)) {
        lastUpdate = updateNode.nextElementSibling.textContent.trim();
      } else if (updateNode.parentElement && updateNode.parentElement.textContent.match(/:\s*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/)) {
        lastUpdate = updateNode.parentElement.textContent.match(/:\s*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/)[1];
      } else if (updateNode.nextElementSibling) {
        lastUpdate = updateNode.nextElementSibling.textContent.trim();
      }
    }
    // Fallback 更新時間 Regex
    if (lastUpdate === '未知') {
      const updateMatch = html.match(/<div[^>]*>(?:Updated|已更新)<\/div>\s*<div[^>]*>([^<]+)<\/div>/i)
        || html.match(/(?:Updated|最後更新日期)[\s:：]*([^<"'\n]+)/i);
      if (updateMatch) {
        lastUpdate = (updateMatch[1] || updateMatch[2]);
        if (lastUpdate) lastUpdate = lastUpdate.trim();
      }
    }

    const health = {
      rating: rating,
      userCount: userCount ? userCount : '未知',
      lastUpdate: lastUpdate ? lastUpdate : '未知',
      syncTime: Date.now()
    };

    extensionHealthData[id] = health;
    await chrome.storage.local.set({ [STORAGE_KEYS.extensionHealthData]: extensionHealthData });
    return health;
  } catch (err) {
    console.error('Store sync error:', err);
    return null;
  }
}

/**
 * 切換描述標籤
 */
window.switchDescTab = async function (id, mode, btn) {
  preferredDescTab = mode;
  await chrome.storage.local.set({ [STORAGE_KEYS.preferredDescTab]: mode });

  const ext = allExtensions.find(e => e.id === id);
  if (!ext) return;

  const descEl = document.getElementById(`desc-${id}`);
  if (descEl) {
    if (mode === 'translated' && !ext.translation) {
      descEl.textContent = '翻譯中...';
      const translated = await translateExtensionDescription(id);
      ext.translation = translated; // 更新到對象
      descEl.textContent = translated || '翻譯失敗，請重試';
    } else {
      descEl.textContent = (mode === 'translated' && ext.translation) ? ext.translation : (ext.customDesc || '點擊添加描述...');
    }
  }

  // 更新按鈕樣式
  if (btn) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.desc-tab').forEach(b => {
      b.classList.remove('active');
      b.style.background = 'transparent';
      b.style.color = 'var(--text-secondary)';
    });
    btn.classList.add('active');
    btn.style.background = 'var(--accent-color)';
    btn.style.color = 'white';
  }
};

/**
 * 批量更新所有擴充功能的商店資訊
 */
/**
 * 更新顯示設定
 */
window.updateDisplaySetting = async function (key, value) {
  displaySettings[key] = value;
  await chrome.storage.local.set({ [STORAGE_KEYS.displaySettings]: displaySettings });
  await logChange(`更新顯示設定：${key}為${value}`);
  await renderExtensions();
};

/**
 * 同步所有擴充功能的商店數據 (帶進度條)
 */
async function syncAllData() {
  const total = allExtensions.length;
  if (total === 0) return;

  if (!confirm(`確定要同步這 ${total} 個擴充功能的商店數據嗎？\n這將需要幾分鐘時間。`)) return;

  // 創建進度條對話框
  const progressModal = document.createElement('div');
  progressModal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:20000; display:flex; align-items:center; justify-content:center;';
  progressModal.innerHTML = `
    <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:12px; padding:30px; width:400px; text-align:center;">
      <h3 style="margin-bottom:20px; color:var(--text-primary);">🔄 正在同步商店數據...</h3>
      <div style="background:var(--bg-tertiary); height:10px; border-radius:5px; margin-bottom:15px; overflow:hidden;">
        <div id="syncProgress" style="background:var(--accent-color); height:100%; width:0%; transition:width 0.3s;"></div>
      </div>
      <div id="syncStatus" style="color:var(--text-secondary); font-size:14px;">準備中 (0/${total})</div>
    </div>
  `;
  document.body.appendChild(progressModal);

  const progressBar = progressModal.querySelector('#syncProgress');
  const statusLine = progressModal.querySelector('#syncStatus');

  let successCount = 0;
  for (let i = 0; i < total; i++) {
    const ext = allExtensions[i];
    statusLine.textContent = `正在處理：${ext.name} (${i + 1}/${total})`;

    // 稍微延遲避免被 API 限制
    if (i > 0 && i % 5 === 0) {
      await new Promise(r => setTimeout(r, 1000));
    }

    try {
      const data = await syncExtensionStoreData(ext.id);
      if (data) successCount++;
    } catch (err) {
      console.error(`Sync failed for ${ext.id}:`, err);
    }

    const percent = Math.round(((i + 1) / total) * 100);
    progressBar.style.width = percent + '%';
  }

  statusLine.innerHTML = `<span style="color:var(--success-color);">✅ 同步完成！</span> 成功: ${successCount}`;
  setTimeout(() => {
    progressModal.remove();
    renderExtensions();
  }, 2000);

  await logChange(`全量同步擴充功能數據，成功: ${successCount}`);
}
