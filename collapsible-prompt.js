// (c) 2024 mingyu
// 核心思路：
// 1. 用 MutationObserver 監控整個頁面，等待提示詞列表（#completion_prompt_manager_list）出現。
// 2. 列表出現後，立即進行一次分組整理，並為這個列表掛上第二個 MutationObserver。
// 3. 第二個 Observer 專門監控列表內部的項目增減，一旦有變化就重新觸發分組整理。
// 4. 分組的依據是提示詞名稱是否以特定符號（如 ====）開頭。
// 5. 將作為標題的提示詞轉換為 <summary>，並隱藏其附帶的星號圖示。
// 6. 將其下的普通提示詞移動到 <details> 的內容區。
// 7. 所有狀態（摺疊/展開、功能開關）都儲存在 localStorage，以便刷新後保持原樣。

(function() {
    'use strict';

    // --- 全域設定 ---
    const config = {
        // CSS 選擇器
        selectors: {
            appBody: 'body',
            promptList: '#completion_prompt_manager_list',
            promptListItem: 'li.completion_prompt_manager_prompt',
            promptLink: 'a.prompt-manager-inspect-action',
            promptAsterisk: '.fa-asterisk', // 標題列要隱藏的星號
            listHeader: '.completion_prompt_manager_list_head',
        },
        // 用來識別標題的正規表示式
        dividerRegex: new RegExp(`^(=+|⭐─\+|━\+)`),
        // localStorage 的鍵值
        storageKeys: {
            openStates: 'mingyu_collapsible_openStates',
            featureEnabled: 'mingyu_collapsible_isEnabled',
        },
        // CSS class 名稱
        classNames: {
            group: 'mingyu-prompt-group',
            groupContent: 'mingyu-prompt-group-content',
            isGroupHeader: 'is-group-header', // 加到作為標題的 li 元素上
        }
    };

    // --- 狀態管理 ---
    let state = {
        openGroups: JSON.parse(localStorage.getItem(config.storageKeys.openStates) || '{}'),
        isEnabled: localStorage.getItem(config.storageKeys.featureEnabled) !== 'false',
        isProcessing: false, // 防止重複執行的標記
        observers: new WeakMap(), // 儲存每個 listContainer 的 observer
    };

    // --- 主要功能函式 ---

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

        const match = config.dividerRegex.exec(originalName);
        if (match) {
            const cleanName = originalName.substring(match[0].length).trim();
            // 使用更穩定的 key：結合索引位置
            const stableKey = `${match[0]}_${cleanName}`;
            return {
                cleanName: cleanName,      // 整理過的標題名稱
                originalName: originalName, // 原始的完整名稱
                stableKey: stableKey       // 穩定的 key，用於儲存狀態
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
    function buildCollapsibleGroups(listContainer) {
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
                let currentGroupContent = null;

                allItems.forEach(item => {
                    const headerInfo = getGroupHeaderInfo(item);

                    if (headerInfo) {
                        // 這是個標題，建立一個新的 <details> 群組
                        item.classList.add(config.classNames.isGroupHeader);

                        const details = document.createElement('details');
                        details.className = config.classNames.group;
                        details.open = state.openGroups[headerInfo.stableKey] !== false; // 預設展開
                        details.dataset.groupKey = headerInfo.stableKey;

                        const summary = document.createElement('summary');
                        const link = item.querySelector(config.selectors.promptLink);
                        if (link) link.textContent = headerInfo.cleanName;

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
                        // 這是個普通項目，且前面有群組，就放進去
                        currentGroupContent.appendChild(item);
                    } else {
                        // 這是個普通項目，但前面沒有群組，直接放在最外層
                        listContainer.appendChild(item);
                    }
                });
            }
        } catch (error) {
            console.error('[PF] 分組過程發生錯誤:', error);
        } finally {
            state.isProcessing = false;
        }
    }

    /**
     * 建立並掛載「啟用/停用」功能的切換按鈕
     * @param {HTMLElement} listContainer
     */
    function setupToggleButton(listContainer) {
        const header = document.querySelector(config.selectors.listHeader);
        if (!header) return;

        // 使用 data 屬性檢查，避免重複建立
        if (listContainer.dataset.mingyuButtonAdded) return;

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'menu_button';
        toggleBtn.style.marginLeft = '10px';

        const updateBtnText = () => {
            toggleBtn.textContent = state.isEnabled ? '分組:開' : '分組:關';
        };

        toggleBtn.addEventListener('click', () => {
            state.isEnabled = !state.isEnabled;
            localStorage.setItem(config.storageKeys.featureEnabled, state.isEnabled);
            updateBtnText();
            buildCollapsibleGroups(listContainer);
        });

        updateBtnText();
        header.appendChild(toggleBtn);
        listContainer.dataset.mingyuButtonAdded = 'true';
    }

    /**
     * 設置拖曳事件處理
     * @param {HTMLElement} listContainer
     */
    function setupDragHandlers(listContainer) {
        let draggedHeaderInfo = null;
        let isDraggingHeader = false;

        listContainer.addEventListener('dragstart', (event) => {
            const draggedLi = event.target.closest(config.selectors.promptListItem);
            if (!draggedLi) return;

            // 加入拖曳 class
            draggedLi.classList.add('dragging');

            const summary = draggedLi.closest('summary');
            if (summary) {
                console.log('[PF] 開始拖曳標頭...');
                isDraggingHeader = true;
                const details = summary.closest('details');
                if (details) {
                    // 儲存拖曳資訊
                    draggedHeaderInfo = {
                        details,
                        li: draggedLi,
                        groupKey: details.dataset.groupKey,
                        wasOpen: details.open
                    };
                    // 將 li 暫時移到 details 前面，成為 ul 的直接子項
                    details.parentElement.insertBefore(draggedLi, details);
                    // 隱藏舊的 details 容器
                    details.style.display = 'none';
                }
            } else {
                isDraggingHeader = false;
            }
        });

        // 處理拖曳取消的情況
        listContainer.addEventListener('dragcancel', () => {
            // 移除拖曳 class
            const draggingItem = listContainer.querySelector('.dragging');
            if (draggingItem) draggingItem.classList.remove('dragging');

            if (draggedHeaderInfo) {
                console.log('[PF] 拖曳被取消，恢復原狀...');
                restoreDraggedHeader();
            }
        });

        listContainer.addEventListener('dragend', (event) => {
            // 移除拖曳 class
            const draggedLi = event.target.closest(config.selectors.promptListItem);
            if (draggedLi) draggedLi.classList.remove('dragging');

            if (draggedHeaderInfo) {
                console.log('[PF] 標頭拖曳結束，清理並重整');
                // 移除我們隱藏的舊 details 元素
                draggedHeaderInfo.details.remove();
                draggedHeaderInfo = null;
            }

            // 只在拖曳標題時才重新分組
            if (isDraggingHeader) {
                console.log('[PF] 標頭拖曳結束，強制重新分組...');
                setTimeout(() => buildCollapsibleGroups(listContainer), 50);
            } else {
                console.log('[PF] 普通項目拖曳結束，不需重新分組');
            }

            isDraggingHeader = false;
        });

        function restoreDraggedHeader() {
            if (!draggedHeaderInfo) return;

            const { details, li, wasOpen } = draggedHeaderInfo;
            details.style.display = '';
            details.open = wasOpen;

            const summary = details.querySelector('summary');
            if (summary && li.parentElement !== summary) {
                summary.appendChild(li);
            }

            draggedHeaderInfo = null;
            isDraggingHeader = false;
        }
    }

    /**
     * 初始化所有功能：整理列表、加上按鈕、啟動列表內部監控
     * @param {HTMLElement} listContainer
     */
    function initialize(listContainer) {
        if (listContainer.dataset.mingyuInitialized) return;
        console.log('[PF]初始化提示詞分組功能...');

        buildCollapsibleGroups(listContainer);
        setupToggleButton(listContainer);
        createListContentObserver(listContainer);
        setupDragHandlers(listContainer);

        listContainer.dataset.mingyuInitialized = 'true';
    }

    // --- 監控器 (Mutation Observers) ---

    /**
     * 監控器 #1: 監控列表「內部」的變化 (項目增刪)
     * @param {HTMLElement} listContainer
     */
    function createListContentObserver(listContainer) {
        // 清理舊的 observer (如果存在)
        const oldObserver = state.observers.get(listContainer);
        if (oldObserver) {
            oldObserver.disconnect();
        }

        const observer = new MutationObserver((mutations) => {
            if (state.isProcessing) return;

            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    const hasChangedNodes = (nodes) => Array.from(nodes).some(node =>
                        node.nodeType === 1 && node.matches(config.selectors.promptListItem)
                    );

                    if (hasChangedNodes(mutation.addedNodes) || hasChangedNodes(mutation.removedNodes)) {
                        console.log('[PF]偵測到列表項目變動 (拖曳或刪除)，重新分組...');
                        observer.disconnect(); // 暫停監控
                        try {
                            buildCollapsibleGroups(listContainer);
                        } finally {
                            observer.observe(listContainer, { childList: true, subtree: false }); // 重新開始
                        }
                        return; // 找到變動就處理
                    }
                }
            }
        });

        observer.observe(listContainer, { childList: true, subtree: false });
        state.observers.set(listContainer, observer);
    }

    /**
     * 監控器 #2: 監控「整個頁面」，等待列表容器出現
     */
    function createContainerWatcher() {
        const appBody = document.querySelector(config.selectors.appBody);
        if (!appBody) return;

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;

                    if (node.matches(config.selectors.promptList)) {
                        initialize(node); // 目標本身被加入了
                        return;
                    }
                    const list = node.querySelector(config.selectors.promptList);
                    if (list) {
                        initialize(list); // 目標在被加入的某個節點裡面
                        return;
                    }
                }
            }
        });

        observer.observe(appBody, { childList: true, subtree: true });
        console.log('[PF]提示詞分組監控已啟動。');
    }

    // --- 程式進入點 ---

    // 1. 立即檢查列表是否已存在
    const initialList = document.querySelector(config.selectors.promptList);
    if (initialList) {
        initialize(initialList);
    }

    // 2. 啟動全域監控，以防列表是動態載入的
    createContainerWatcher();

})();