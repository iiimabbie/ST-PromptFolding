import { config, state, dividerRegex } from './state.js';

/**
 * 判斷 LI 是不是標題
 * @returns headerInfo object or null
 */
function getGroupHeaderInfo(promptItem) {
  const link = promptItem.querySelector(config.selectors.promptLink);
  if (!link) return null;

  const originalName = link.textContent.trim();
  // 記錄原始名稱，避免重複處理時名字壞掉
  if (!promptItem.dataset.originalName) promptItem.dataset.originalName = originalName;

  // 用 ID 當 Key
  const createInfo = (name) => ({ originalName: name, stableKey: promptItem.dataset.pmIdentifier });

  return dividerRegex.test(originalName) ? createInfo(originalName) : null;
}

/**
 * [Helper] 建立群組的 DOM 結構
 */
function createGroupDOM(headerItem, headerInfo, contentItems) {
    const groupKey = headerInfo.stableKey;
    
    // 1. 記錄狀態
    const childIds = contentItems.map(item => item.dataset.pmIdentifier).filter(Boolean);
    state.groupHierarchy[groupKey] = childIds;
    state.groupHeaderStatus[groupKey] = !headerItem.classList.contains('completion_prompt_manager_prompt_disabled');

    // 2. 標記標題 Item
    headerItem.classList.add(config.classNames.isGroupHeader);
    const link = headerItem.querySelector(config.selectors.promptLink);
    if (link) {
        link.textContent = headerInfo.originalName;
        // 綁定點擊：只點文字才開關
        link.onclick = (e) => {
            e.preventDefault(); 
            e.stopPropagation();
            details.open = !details.open;
        };
    }

    // 3. 建立容器
    const details = document.createElement('details');
    details.className = config.classNames.group;
    details.open = state.openGroups[groupKey] !== false; // 預設開啟
    details.dataset.groupKey = groupKey;

    // 4. 建立 Summary (標題列)
    const summary = document.createElement('summary');
    summary.onclick = (e) => e.preventDefault(); // 擋掉預設行為，由上面 link 控制
    summary.appendChild(headerItem);
    details.appendChild(summary);

    // 5. 建立內容區
    const contentDiv = document.createElement('div');
    contentDiv.className = config.classNames.groupContent;
    contentItems.forEach(item => contentDiv.appendChild(item));
    details.appendChild(contentDiv);

    // 6. 監聽開關狀態
    details.ontoggle = () => {
        state.openGroups[groupKey] = details.open;
        localStorage.setItem(config.storageKeys.openStates, JSON.stringify(state.openGroups));
    };

    return details;
}

/**
 * 主函式：重建列表
 */
export function buildCollapsibleGroups(listContainer) {
  // 強制同步最新的開關狀態
  state.openGroups = JSON.parse(localStorage.getItem(config.storageKeys.openStates) || '{}');

  if (!listContainer || state.isProcessing) return;
  state.isProcessing = true;

  try {
    // 1. 清理與還原 (所有模式共用)
    // querySelectorAll 會自動抓到 nested items (details 裡的 li)
    const allItems = Array.from(listContainer.querySelectorAll(config.selectors.promptListItem));

    allItems.forEach(item => {
      item.classList.remove(config.classNames.isGroupHeader);
      item.style.display = '';
      // 還原名稱
      if (item.dataset.originalName) {
        const link = item.querySelector(config.selectors.promptLink);
        if (link) link.textContent = item.dataset.originalName;
      }
    });

    // 2. 清空並重置狀態
    listContainer.innerHTML = '';
    state.groupHierarchy = {};
    state.groupHeaderStatus = {};

    // 3. 沒啟用就直接塞回去
    if (!state.isEnabled) {
      allItems.forEach(item => listContainer.appendChild(item));
      return; 
    }

    // 2. 搜尋模式檢查
    // 如果有輸入搜尋字，直接跑過濾，忽略後面所有分組邏輯
    if (state.searchQuery) {
        const query = state.searchQuery; // 已經在 input event轉成小寫了

        // 檢查是否為特殊指令
        const isCommandOn = query === 'on';
        const isCommandOff = query === 'off';

        allItems.forEach(item => {
            // 為了防止資料遺失，必須把所有項目都塞回 DOM
            // 只透過 CSS 來控制顯示與否
            listContainer.appendChild(item);

            let isMatch = false;
            // ST 判斷是否禁用的 class
            const isDisabled = item.classList.contains('completion_prompt_manager_prompt_disabled');

            if (isCommandOn) {
                // 指令 on: 顯示未禁用的 (即開啟的)
                isMatch = !isDisabled;
            } else if (isCommandOff) {
                // 指令 off: 顯示被禁用的
                isMatch = isDisabled;
            } else {
                // 普通搜尋: 比對名稱
                const name = item.dataset.originalName || item.textContent;
                isMatch = name.toLowerCase().includes(query);
            }
            
            item.style.display = isMatch ? '' : 'none';
        });
        // 搜尋模式下，不跑分組邏輯，直接結束
        return;
    }

    // 3. 未啟用功能：全部塞回去
    if (!state.isEnabled) {
      allItems.forEach(item => listContainer.appendChild(item));
      return; 
    }

    // --- 標準模式 (遇到標題就切分) ---
    const buildStandardGroups = () => {
      let buffer = [];
      let currentHeader = null;
      let currentHeaderInfo = null;

      const flushBuffer = () => {
        if (currentHeader) {
            listContainer.appendChild(createGroupDOM(currentHeader, currentHeaderInfo, buffer));
        } else {
            buffer.forEach(i => listContainer.appendChild(i)); // 沒標題的孤兒
        }
        buffer = [];
      };

      allItems.forEach(item => {
        const info = getGroupHeaderInfo(item);
        if (info) {
          flushBuffer(); // 把上一組結算掉
          currentHeader = item;
          currentHeaderInfo = info;
        } else {
          buffer.push(item);
        }
      });
      flushBuffer(); // 結算最後一組
    };

    // --- 包覆模式 (A...A 為一組) ---
    const buildSandwichGroups = () => {
      let remaining = [...allItems];

      while (remaining.length > 0) {
        const current = remaining.shift();
        const info = getGroupHeaderInfo(current);

        if (!info) {
          listContainer.appendChild(current); // 不是標題，直接放
          continue;
        }

        // 找配對的結束標題
        const closerIdx = remaining.findIndex(item => {
            const otherInfo = getGroupHeaderInfo(item);
            return otherInfo && otherInfo.originalName === info.originalName;
        });

        if (closerIdx !== -1) {
          // 抓出中間這整包 (含結束標題)
          const groupContent = remaining.splice(0, closerIdx + 1); 
          listContainer.appendChild(createGroupDOM(current, info, groupContent));
        } else {
          listContainer.appendChild(current); // 找不到另一半，當孤兒
        }
      }
    };

    state.foldingMode === 'sandwich' ? buildSandwichGroups() : buildStandardGroups();
    
    // 補上禁用樣式
    applyGroupDisabledStyles(listContainer);

  } catch (err) {
    console.error('[PF] Oops, 分組壞了:', err);
  } finally {
    state.isProcessing = false;
  }
}

/**
 * 全收合/展開
 */
export function toggleAllGroups(listContainer, shouldOpen) {
  const details = listContainer.querySelectorAll(`.${config.classNames.group}`);
  details.forEach(el => el.open = shouldOpen);
  // 狀態就不一個個存了，下次重建時會自動更新
}

/**
 * 根據群組標頭的啟用狀態，為子項目應用或移除灰度樣式
 */
function applyGroupDisabledStyles(listContainer) {
    // 掃描所有群組，依據 Header 狀態對內容加 class
    listContainer.querySelectorAll(`.${config.classNames.group}`).forEach(group => {
        const key = group.dataset.groupKey;
        if (!key) return;
        
        const isDisabled = state.groupHeaderStatus[key] === false;
        const contentItems = group.querySelectorAll(`.${config.classNames.groupContent} > li`);
        
        contentItems.forEach(item => {
            item.classList.toggle('prompt-controlled-by-disabled-group', isDisabled);
        });
    });
}