import { config, state, dividerRegex } from './state.js';

/**
 * 分析一個提示詞 LI 元素，判斷它是否為分組標題
 * @param {HTMLElement} promptItem - 提示詞的 LI 元素
 * @returns {object|null} 如果是標題，回傳標題資訊；否則回傳 null
 */
function getGroupHeaderInfo(promptItem) {
    const linkElement = promptItem.querySelector(config.selectors.promptLink);
    if (!linkElement) return null;

    const originalName = linkElement.textContent.trim();

    // 確保每個項目都有 originalName，即使不是標題
    if (!promptItem.dataset.originalName) {
        promptItem.dataset.originalName = originalName;
    }

    const match = dividerRegex.exec(originalName);
    if (match) {
        return {
            originalName: originalName, // 原始的完整名稱
            stableKey: originalName       // 穩定的 key，用於儲存狀態
        };
    }
    return null;
}

/**
 * 清理已不存在的群組狀態
 * @param {Array} currentHeaders - 目前存在的標題資訊列表
 */
function cleanupOldGroupStates(currentHeaders) {
    const currentKeys = new Set(currentHeaders.map(h => h.stableKey));
    const savedStates = state.openGroups;
    let needsUpdate = false;

    for (const key in savedStates) {
        if (!currentKeys.has(key)) {
            delete savedStates[key];
            needsUpdate = true;
        }
    }

    if (needsUpdate) {
        localStorage.setItem(config.storageKeys.openStates, JSON.stringify(savedStates));
    }
}

/**
 * 核心函式：將提示詞列表整理成可摺疊的群組
 * @param {HTMLElement} listContainer - 提示詞列表的 UL 容器
 */
export function buildCollapsibleGroups(listContainer) {
    if (!listContainer || state.isProcessing) return;

    state.isProcessing = true;

    try {
        // 1. 還原所有項目的原始狀態並備份
        const allItems = Array.from(listContainer.querySelectorAll(config.selectors.promptListItem));
        const currentHeaders = [];

        allItems.forEach(item => {
            item.classList.remove(config.classNames.isGroupHeader);
            const link = item.querySelector(config.selectors.promptLink);

            // 確保 originalName 存在再還原
            if (link) {
                if (!item.dataset.originalName) {
                    item.dataset.originalName = link.textContent.trim();
                } else {
                    link.textContent = item.dataset.originalName;
                }
            }

            // 收集當前的標題資訊
            const headerInfo = getGroupHeaderInfo(item);
            if (headerInfo) {
                currentHeaders.push(headerInfo);
            }
        });

        // 2. 清理舊的群組狀態
        cleanupOldGroupStates(currentHeaders);

        // 3. 清空容器
        listContainer.innerHTML = '';

        // 4. 根據功能是否啟用，決定如何重建列表
        if (!state.isEnabled) {
            allItems.forEach(item => listContainer.appendChild(item));
        } else {
            // --- 標準模式邏輯 ---
            const buildStandardGroups = () => {
                let currentGroupContent = null;
                allItems.forEach(item => {
                    const headerInfo = getGroupHeaderInfo(item);
                    if (headerInfo) {
                        // 是標題，建立一個新的 <details> 群組
                        item.classList.add(config.classNames.isGroupHeader);
                        const details = document.createElement('details');
                        details.className = config.classNames.group;
                        details.open = state.openGroups[headerInfo.stableKey] !== false; // 預設展開
                        details.dataset.groupKey = headerInfo.stableKey;
                        const summary = document.createElement('summary');
                        const link = item.querySelector(config.selectors.promptLink);
                        if (link) link.textContent = headerInfo.originalName;
                        summary.appendChild(item);
                        details.appendChild(summary);
                        currentGroupContent = document.createElement('div');
                        currentGroupContent.className = config.classNames.groupContent;
                        details.appendChild(currentGroupContent);
                        details.addEventListener('toggle', () => {
                            state.openGroups[headerInfo.stableKey] = details.open;
                            localStorage.setItem(config.storageKeys.openStates, JSON.stringify(state.openGroups));
                        });
                        listContainer.appendChild(details);
                    } else if (currentGroupContent) {
                        // 是普通項目，且前面有群組，就放進去
                        currentGroupContent.appendChild(item);
                    } else {
                        // 是普通項目，但前面沒有群組，直接放在最外層
                        listContainer.appendChild(item);
                    }
                });
            };

            // --- 包覆模式邏輯 ---
            const buildSandwichGroups = () => {
                let itemsToProcess = [...allItems];
                const nodesToAdd = [];

                while (itemsToProcess.length > 0) {
                    const currentItem = itemsToProcess.shift();
                    const headerInfo = getGroupHeaderInfo(currentItem);

                    if (!headerInfo) {
                        nodesToAdd.push(currentItem);
                        continue;
                    }

                    // 这是一個標頭，尋找配對的結束標頭
                    const closingHeaderIndex = itemsToProcess.findIndex(item => {
                        const otherHeader = getGroupHeaderInfo(item);
                        return otherHeader && otherHeader.stableKey === headerInfo.stableKey;
                    });

                    if (closingHeaderIndex !== -1) {
                        // 修正後邏輯：要摺疊的內容包含從開始到結束的所有項目(包含結束標頭)。
                        const contentItems = itemsToProcess.splice(0, closingHeaderIndex + 1);

                        currentItem.classList.add(config.classNames.isGroupHeader);
                        const details = document.createElement('details');
                        details.className = config.classNames.group;
                        details.open = state.openGroups[headerInfo.stableKey] !== false;
                        details.dataset.groupKey = headerInfo.stableKey;

                        const summary = document.createElement('summary');
                        const link = currentItem.querySelector(config.selectors.promptLink);
                        if (link) link.textContent = headerInfo.originalName;
                        
                        summary.appendChild(currentItem);
                        details.appendChild(summary);

                        const groupContent = document.createElement('div');
                        groupContent.className = config.classNames.groupContent;
                        contentItems.forEach(contentItem => groupContent.appendChild(contentItem));
                        details.appendChild(groupContent);

                        details.addEventListener('toggle', () => {
                            state.openGroups[headerInfo.stableKey] = details.open;
                            localStorage.setItem(config.storageKeys.openStates, JSON.stringify(state.openGroups));
                        });

                        nodesToAdd.push(details);
                    } else {
                        // 找不到配對的結束標頭，當作一般項目處理
                        nodesToAdd.push(currentItem);
                    }
                }
                nodesToAdd.forEach(node => listContainer.appendChild(node));
            };

            if (state.foldingMode === 'sandwich') {
                buildSandwichGroups();
            } else {
                buildStandardGroups();
            }
        }
    } catch (error) {
        console.error('[PF] 分組過程發生錯誤:', error);
    } finally {
        state.isProcessing = false;
    }
}

/**
 * 展開或收合所有群組
 * @param {HTMLElement} listContainer
 * @param {boolean} shouldOpen - true 展開，false 收合
 */
export function toggleAllGroups(listContainer, shouldOpen) {
    const allGroups = listContainer.querySelectorAll(`.${config.classNames.group}`);
    if (!allGroups.length) return;

    allGroups.forEach(details => {
        details.open = shouldOpen;
        const groupKey = details.dataset.groupKey;
        if (groupKey) state.openGroups[groupKey] = shouldOpen;
    });

    localStorage.setItem(config.storageKeys.openStates, JSON.stringify(state.openGroups));
}

/**
 * 設置拖曳事件處理
 * @param {HTMLElement} listContainer
 */
export function setupDragHandlers(listContainer) {
    let isDraggingHeader = false;
    let draggedElement = null;
    let dragStartTime = 0;
    let isDragging = false; // 全域拖曳狀態標記

    listContainer.addEventListener('dragstart', (event) => {
        const draggedLi = event.target.closest(config.selectors.promptListItem);
        if (!draggedLi) return;

        isDragging = true; // 標記正在拖曳
        draggedElement = draggedLi;
        dragStartTime = Date.now();

        // 拖曳開始時，立即停用 MutationObserver
        const observer = state.observers.get(listContainer);
        if (observer) {
            observer.disconnect();
        }

        // 檢查是否在拖曳標題
        const summary = draggedLi.closest('summary');
        isDraggingHeader = !!summary;

        if (isDraggingHeader) {
            draggedLi.classList.add('dragging');

            const details = summary.closest('details');
            if (details) {
                details.classList.add('dragging-group');
            }
        } else {
            draggedLi.classList.add('dragging');
        }
    });

    listContainer.addEventListener('dragover', (event) => {
        event.preventDefault();
    });

    listContainer.addEventListener('drop', (event) => {
        event.preventDefault();
    });

    listContainer.addEventListener('dragend', (event) => {

        // 清理視覺狀態
        const draggingItems = listContainer.querySelectorAll('.dragging');
        draggingItems.forEach(item => item.classList.remove('dragging'));

        const draggingGroups = listContainer.querySelectorAll('.dragging-group');
        draggingGroups.forEach(group => group.classList.remove('dragging-group'));

        // 計算拖曳時間
        const dragDuration = Date.now() - dragStartTime;
        const wasActualDrag = dragDuration > 100;

        if (!wasActualDrag) {
            isDragging = false;
            isDraggingHeader = false;
            draggedElement = null;

            // 重新啟動 observer
            restartObserver(listContainer);
            return;
        }

        // 延遲處理，確保原生拖曳完成
        setTimeout(() => {

            try {
                // 重新分組
                buildCollapsibleGroups(listContainer);
            } finally {
                // 重新啟動 observer
                restartObserver(listContainer);
            }

            isDragging = false;
            isDraggingHeader = false;
            draggedElement = null;
        }, 150);
    });

    listContainer.addEventListener('dragcancel', () => {

        // 清理視覺狀態
        const draggingItems = listContainer.querySelectorAll('.dragging');
        draggingItems.forEach(item => item.classList.remove('dragging'));

        const draggingGroups = listContainer.querySelectorAll('.dragging-group');
        draggingGroups.forEach(group => group.classList.remove('dragging-group'));

        isDragging = false;
        isDraggingHeader = false;
        draggedElement = null;
        dragStartTime = 0;

        // 重新啟動 observer
        restartObserver(listContainer);
    });

    // 輔助函式：重新啟動 observer
    function restartObserver(container) {
        const observer = state.observers.get(container);
        if (observer) {
            observer.observe(container, { childList: true, subtree: true });
        }
    }
}
