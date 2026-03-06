// Chrome 擴充功能管理器 - 群組管理器
function showFunctionalGroupsManager() {
  const dialog = document.createElement('div');
  dialog.className = 'modal-backdrop';
  dialog.id = 'functionalGroupsModal';
  dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;';

  dialog.innerHTML = `
    <div class="modal-content" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; width: 90%; max-width: 600px; max-height: 80vh; display: flex; flex-direction: column;">
      <div class="modal-header" style="padding: 20px; border-bottom: 1px solid var(--border-color);">
        <h2 style="margin: 0; color: var(--text-primary);">⚙️ 管理功能分類</h2>
      </div>
      
      <div style="padding: 20px; overflow-y: auto; flex: 1;">
        <div id="functionalGroupsList">
          ${Object.entries(groupNames).filter(([id]) => id !== 'all').map(([id, name]) => {
    const isCustom = id.startsWith('custom_');
    const count = allExtensions.filter(ext => ext.group === id).length;
    return `
              <div class="group-manager-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px;">
                <div style="flex: 1;">
                  <strong style="color: var(--text-primary); font-size: 14px;">${name}</strong>
                  <small style="display: block; color: var(--text-secondary); font-size: 12px; margin-top: 4px;">${count} 個擴充功能</small>
                </div>
                <div style="display: flex; gap: 8px;">
                  ${!isCustom ? `<button class="action-btn" onclick="editGroupName('${id}')" style="padding: 6px 12px; font-size: 12px;">✏️ 編輯</button>` : ''}
                  ${isCustom ? `
                    <button class="action-btn" onclick="editGroupName('${id}')" style="padding: 6px 12px; font-size: 12px;">✏️ 編輯</button>
                    <button class="action-btn danger" onclick="confirmDeleteGroup('${id}')" style="padding: 6px 12px; font-size: 12px;">🗑️ 刪除</button>
                  ` : ''}
                </div>
              </div>
            `;
  }).join('')}
        </div>
        
        <button class="action-btn primary" onclick="addNewFunctionalGroup()" style="width: 100%; margin-top: 16px; padding: 12px;">+ 新增功能分類</button>
      </div>
      
      <div class="modal-footer" style="padding: 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
        <button class="action-btn" onclick="closeFunctionalGroupsManager()">關閉</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
}

window.closeFunctionalGroupsManager = function () {
  const dialog = document.getElementById('functionalGroupsModal');
  if (dialog) dialog.remove();
};

window.addNewFunctionalGroup = async function () {
  const name = prompt('請輸入新功能分類的名稱：');
  if (!name || name.trim() === '') return;

  const groupId = `custom_${Date.now()}`;
  groupNames[groupId] = name.trim();

  const customGroups = {};
  Object.keys(groupNames).forEach(key => {
    if (key.startsWith('custom_')) {
      customGroups[key] = groupNames[key];
    }
  });

  await chrome.storage.local.set({ customGroupNames: customGroups });
  await logChange(`新增功能分類：${name.trim()}`);

  closeFunctionalGroupsManager();
  showFunctionalGroupsManager();

  alert(`已成功新增功能分類「${name.trim()}」`);
};

window.confirmDeleteGroup = async function (groupId) {
  await deleteGroup(groupId);
  closeFunctionalGroupsManager();
  showFunctionalGroupsManager();
};

function showDeviceGroupsManager() {
  const dialog = document.createElement('div');
  dialog.className = 'modal-backdrop';
  dialog.id = 'deviceGroupsModal';
  dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;';

  dialog.innerHTML = `
    <div class="modal-content" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; width: 90%; max-width: 600px; max-height: 80vh; display: flex; flex-direction: column;">
      <div class="modal-header" style="padding: 20px; border-bottom: 1px solid var(--border-color);">
        <h2 style="margin: 0; color: var(--text-primary);">⚙️ 管理設備分類</h2>
      </div>
      
      <div style="padding: 20px; overflow-y: auto; flex: 1;">
        <div id="deviceGroupsListDetailed">
          ${Object.entries(deviceGroupNames).filter(([id]) => id !== 'all_devices').map(([id, name]) => {
    const count = allExtensions.filter(ext => ext.deviceGroup === id).length;
    return `
              <div class="group-manager-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px;">
                <div style="flex: 1;">
                  <strong style="color: var(--text-primary); font-size: 14px;">${name}</strong>
                  <small style="display: block; color: var(--text-secondary); font-size: 12px; margin-top: 4px;">${count} 個擴充功能</small>
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="action-btn" onclick="editDeviceGroupName('${id}')" style="padding: 6px 12px; font-size: 12px;">✏️ 編輯</button>
                  <button class="action-btn danger" onclick="confirmDeleteDeviceGroup('${id}')" style="padding: 6px 12px; font-size: 12px;">🗑️ 刪除</button>
                </div>
              </div>
            `;
  }).join('')}
        </div>
        
        <button class="action-btn primary" onclick="addNewDeviceGroupFromManager()" style="width: 100%; margin-top: 16px; padding: 12px;">+ 新增設備分類</button>
      </div>
      
      <div class="modal-footer" style="padding: 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
        <button class="action-btn" onclick="closeDeviceGroupsManager()">關閉</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
}

window.closeDeviceGroupsManager = function () {
  const dialog = document.getElementById('deviceGroupsModal');
  if (dialog) dialog.remove();
};

window.addNewDeviceGroupFromManager = async function () {
  await addDeviceGroup();
  closeDeviceGroupsManager();
  showDeviceGroupsManager();
};

window.editDeviceGroupName = async function (groupId) {
  const currentName = deviceGroupNames[groupId];
  const newName = prompt('編輯設備群組名稱：', currentName);

  if (!newName || newName.trim() === '' || newName === currentName) return;

  deviceGroupNames[groupId] = newName.trim();

  await chrome.storage.local.set({ deviceGroupNames: deviceGroupNames });
  await logChange(`編輯設備群組：${currentName} → ${newName.trim()}`);

  renderDeviceGroupList();
  closeDeviceGroupsManager();
  showDeviceGroupsManager();

  alert(`已成功更新設備群組名稱`);
};

window.confirmDeleteDeviceGroup = async function (groupId) {
  await deleteDeviceGroup(groupId);
  closeDeviceGroupsManager();
  showDeviceGroupsManager();
};

console.log('Options v2.0 Part 6 loaded: Export Dialog & Group Managers');
