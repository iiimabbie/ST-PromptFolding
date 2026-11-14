import { config, state, dividerRegex, log, saveToPreset, schedulePresetSave } from './state.js';

/**
 * 從 <a> 標籤中提取純文字名稱（不含 icon）
 */
function extractTextName(link) {
    // 找純文字節點（nodeType === 3），不包含 <span> 等元素
    const textNodes = Array.from(link.childNodes).filter(n => n.nodeType === 3);
    return textNodes.map(n => n.textContent).join('').trim();
}

/**
 * 判斷 LI 是不是標題
 * @returns headerInfo object or null
 */
function getGroupHeaderInfo(promptItem) {
  const link = promptItem.querySelector(config.selectors.promptLink);
  if (!link) return null;

  const itemId = promptItem.dataset.pmIdentifier;

  // 每次都重新讀取名稱（確保顯示最新的名稱）
  const originalName = extractTextName(link);

  const createInfo = (name) => ({ originalName: name, stableKey: itemId });

  // 手動模式優先
  if (state.foldingMode === 'manual') {
    return state.manualHeaders.has(itemId) ? createInfo(originalName) : null;
  }

  // 原有的符號判斷（標準/包覆模式）
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

    // 3. 建立容器
    const details = document.createElement('details');
    details.className = config.classNames.group;
    details.open = state.openGroups[groupKey] !== false; // 預設開啟
    details.dataset.groupKey = groupKey;

    // 4. 標題文字與箭頭收合群組，其他操作交給 ST
    const summary = document.createElement('summary');
    summary.addEventListener('click', (e) => {
        const name = e.target.closest(config.selectors.promptNameSpan);
        if (e.target === summary || (name && name.closest(`.${config.classNames.isGroupHeader}`) === headerItem)) {
            e.preventDefault();
            e.stopPropagation();
            details.open = !details.open;
            state.openGroups[groupKey] = details.open;
            schedulePresetSave();
        } else {
            e.preventDefault();
        }
    }, true);
    summary.appendChild(headerItem);
    details.appendChild(summary);

    // 5. 建立內容區
    const contentDiv = document.createElement('div');
    contentDiv.className = config.classNames.groupContent;
    contentItems.forEach(item => contentDiv.appendChild(item));
    details.appendChild(contentDiv);

    return details;
}

/**
 * 主函式：重建列表
 */
export function buildCollapsibleGroups(listContainer) {
  log('Building collapsible groups, mode:', state.foldingMode);

  if (!listContainer || state.isProcessing) return;
  state.isProcessing = true;

  try {
    // 1. 先把所有項目拿出來，還原成乾淨的狀態
    const allItems = Array.from(listContainer.querySelectorAll(config.selectors.promptListItem));

    allItems.forEach(item => item.classList.remove(config.classNames.isGroupHeader));

    // 保留 ST 的列表標題與其他非 prompt 節點
    const promptContainers = Array.from(listContainer.children).filter(el =>
      el.matches(config.selectors.promptListItem) || el.classList.contains(config.classNames.group));
    const anchor = document.createComment('prompt folding');
    listContainer.insertBefore(anchor, promptContainers[0] || null);
    allItems.forEach(item => item.remove());
    promptContainers.forEach(el => el.remove());
    const appendItem = item => listContainer.insertBefore(item, anchor);

    // 2. 重置狀態
    state.groupHierarchy = {};
    state.groupHeaderStatus = {};

    // 3. 沒啟用就直接塞回去
    if (!state.isEnabled) {
      allItems.forEach(item => appendItem(item));
      anchor.remove();
      return;
    }

    // --- 標準模式 (遇到標題就切分) ---
    const buildStandardGroups = () => {
      let buffer = [];
      let currentHeader = null;
      let currentHeaderInfo = null;

      const flushBuffer = () => {
        if (currentHeader) {
            appendItem(createGroupDOM(currentHeader, currentHeaderInfo, buffer));
        } else {
            buffer.forEach(i => appendItem(i)); // 沒標題的孤兒
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
          appendItem(current); // 不是標題，直接放
          continue;
        }

        // 找下一個標頭作為結束標記（不需同名，按順序兩兩配對）
        const closerIdx = remaining.findIndex(item => getGroupHeaderInfo(item) !== null);

        if (closerIdx !== -1) {
          // 抓出中間這整包 (含結束標題)
          const groupContent = remaining.splice(0, closerIdx + 1);
          appendItem(createGroupDOM(current, info, groupContent));
        } else {
          appendItem(current); // 找不到另一半，當孤兒
        }
      }
    };

    state.foldingMode === 'sandwich' ? buildSandwichGroups() : buildStandardGroups();

    anchor.remove();

    // 補上禁用樣式
    applyGroupDisabledStyles(listContainer);

    log('Groups built, total groups:', Object.keys(state.groupHierarchy).length);

  } catch (err) {
    console.error('[PF] Oops, 分組壞了:', err);
  } finally {
    state.observers.get(listContainer)?.takeRecords();
    state.isProcessing = false;
  }
}

/**
 * 全收合/展開
 */
export function toggleAllGroups(listContainer, shouldOpen) {
  const details = listContainer.querySelectorAll(`.${config.classNames.group}`);
  details.forEach(el => {
      el.open = shouldOpen;
      state.openGroups[el.dataset.groupKey] = shouldOpen;
  });
  saveToPreset().catch(console.error);
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