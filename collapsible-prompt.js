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
        // localStorage 的鍵值
        storageKeys: {
            openStates: 'mingyu_collapsible_openStates',
            featureEnabled: 'mingyu_collapsible_isEnabled',
            customDividers: 'mingyu_collapsible_customDividers',
            caseSensitive: 'mingyu_collapsible_caseSensitive',
        },
        // CSS class 名稱
        classNames: {
            group: 'mingyu-prompt-group',
            groupContent: 'mingyu-prompt-group-content',
            isGroupHeader: 'is-group-header', // 加到作為標題的 li 元素上
        },
        // 預設的分組標示
        defaultDividers: ['=', '-']
    };

    // --- 狀態管理 ---
    let state = {
        openGroups: JSON.parse(localStorage.getItem(config.storageKeys.openStates) || '{}'),
        isEnabled: localStorage.getItem(config.storageKeys.featureEnabled) !== 'false',
        isProcessing: false, // 防止重複執行的標記
        observers: new WeakMap(), // 儲存每個 listContainer 的 observer
        customDividers: JSON.parse(localStorage.getItem(config.storageKeys.customDividers) || 'null') || config.defaultDividers,
        caseSensitive: localStorage.getItem(config.storageKeys.caseSensitive) === 'true',
    };

    /**
     * 符號匹配
     * @returns {RegExp}
     */
    function buildDividerRegex() {
        const patterns = state.customDividers.map(pattern => {
            // 完全轉義所有特殊字元，當作普通字串處理
            return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        });
        const flags = state.caseSensitive ? '' : 'i';
        return new RegExp(`^(${patterns.join('|')})`, flags);
    }

    // 動態生成 dividerRegex
    let dividerRegex = buildDividerRegex();

    /**
     * 儲存自訂設定
     */
    function saveCustomSettings() {
        localStorage.setItem(config.storageKeys.customDividers, JSON.stringify(state.customDividers));
        localStorage.setItem(config.storageKeys.caseSensitive, state.caseSensitive);
        dividerRegex = buildDividerRegex();
    }

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

        const match = dividerRegex.exec(originalName);
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
     * 展開或收合所有群組
     * @param {HTMLElement} listContainer
     * @param {boolean} shouldOpen - true 展開，false 收合
     */
    function toggleAllGroups(listContainer, shouldOpen) {
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
     * 建立設定面板並插入到提示詞管理器中
     * @param {HTMLElement} listContainer
     */
    function createSettingsPanel(listContainer) {
        const manager = document.getElementById('completion_prompt_manager');
        if (!manager) {
            console.warn('[PF] completion_prompt_manager 未找到');
            return;
        }

        // 如果設定面板已存在，不要重複建立
        let existingPanel = document.getElementById('prompt-folding-settings');
        if (existingPanel) {
            console.log('[PF] 設定面板已存在，跳過建立');
            return;
        }

        const settingsHtml = `
        <div id="prompt-folding-settings" class="range-block marginBot10" style="display: none; width: 100%; box-sizing: border-box;">
            <div class="inline-drawer-content" style="display: block;">
                <div style="position: relative;">
                    <h3>分組標示設定</h3>
                    <span class="mingyu-help-icon" title="輸入用於標識群組標題的符號或文字。&#10;&#10;範例：&#10;• 輸入「=」會匹配「=」開頭的提示詞&#10;• 輸入「===」會匹配「===」開頭的提示詞&#10;• 輸入「---」會匹配「---」開頭的提示詞&#10;&#10;每行一個符號，可設定多個不同的分組標示。&#10;被當作標頭的符號不會出現在標題上。">?</span>
                </div>
                <label for="prompt-folding-dividers">
                    <span>分組標示符號（一行一個）</span>
                </label>
                <textarea id="prompt-folding-dividers" class="text_pole textarea_compact" rows="4" placeholder="=&#10;-"></textarea>
                
                <label class="checkbox_label marginTop10" for="prompt-folding-case-sensitive">
                    <input id="prompt-folding-case-sensitive" type="checkbox" />
                    <span>區分大小寫</span>
                </label>

                <div class="flex-container justifyCenter marginTop10">
                    <div id="prompt-folding-apply" class="menu_button menu_button_icon">
                        <i class="fa-solid fa-check"></i> 套用
                    </div>
                    <div id="prompt-folding-reset" class="menu_button menu_button_icon">
                        <i class="fa-solid fa-rotate-left"></i> 重設
                    </div>
                </div>
            </div>
        </div>
    `;

        // Debug: 列出 manager 的所有子元素
        console.log('[PF] Manager 子元素:', Array.from(manager.children).map(el => el.className || el.tagName));

        // 嘗試多種方式找到插入位置
        const header = manager.querySelector('.completion_prompt_manager_header');
        const footer = manager.querySelector('.completion_prompt_manager_footer');
        const listHead = manager.querySelector('.completion_prompt_manager_list_head');
        
        console.log('[PF] 找到的元素:', { 
            header: !!header, 
            footer: !!footer, 
            listHead: !!listHead 
        });

        // 優先順序：header > listHead > footer
        if (header) {
            console.log('[PF] 使用 header.afterend 插入');
            header.insertAdjacentHTML('afterend', settingsHtml);
        } else if (listHead) {
            console.log('[PF] 使用 listHead.beforebegin 插入');
            listHead.insertAdjacentHTML('beforebegin', settingsHtml);
        } else if (footer) {
            console.log('[PF] 使用 footer.beforebegin 插入');
            footer.insertAdjacentHTML('beforebegin', settingsHtml);
        } else {
            // 最後的備用方案：插在 list 之前
            console.log('[PF] 使用 listContainer.beforebegin 插入');
            listContainer.insertAdjacentHTML('beforebegin', settingsHtml);
        }
        
        initializeSettingsPanel();
    }

    /**
     * 建立並掛載「啟用/停用」功能的切換按鈕 + 全部展開/收合按鈕 + 設定按鈕
     * @param {HTMLElement} listContainer
     */
    function setupToggleButton(listContainer) {
        const header = document.querySelector('.completion_prompt_manager_header');
        if (!header) return;

        // 使用 data 屬性檢查，避免重複建立
        if (listContainer.dataset.mingyuButtonAdded) return;

        // === 建立按鈕容器 ===
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'mingyu-collapse-controls';

        // === 全部展開按鈕 (Emoji) ===
        const expandAllBtn = document.createElement('button');
        expandAllBtn.className = 'menu_button mingyu-expand-all';
        expandAllBtn.title = '展開所有群組';
        expandAllBtn.textContent = '⬇️';
        expandAllBtn.addEventListener('click', () => toggleAllGroups(listContainer, true));

        // === 全部收合按鈕 (Emoji) ===
        const collapseAllBtn = document.createElement('button');
        collapseAllBtn.className = 'menu_button mingyu-collapse-all';
        collapseAllBtn.title = '收合所有群組';
        collapseAllBtn.textContent = '⬆️';
        collapseAllBtn.addEventListener('click', () => toggleAllGroups(listContainer, false));

        // === 設定按鈕 (Emoji 齒輪) ===
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'menu_button mingyu-settings-toggle';
        settingsBtn.title = '分組設定';
        settingsBtn.textContent = '⚙️';
        
        // 儲存設定按鈕的引用到 listContainer，方便其他函數存取
        listContainer.dataset.settingsBtn = 'true';
        settingsBtn.addEventListener('click', () => {
            const settingsPanel = document.getElementById('prompt-folding-settings');
            if (settingsPanel) {
                const isVisible = settingsPanel.style.display !== 'none';
                settingsPanel.style.display = isVisible ? 'none' : 'block';
                settingsBtn.classList.toggle('active', !isVisible);
            }
        });

        // === 原有的分組開關按鈕 ===
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'menu_button';
        const updateBtnText = () => {
            toggleBtn.title = state.isEnabled ? '點擊停用' : '點擊啟用';
            toggleBtn.textContent = state.isEnabled ? '🟢' : '🔴';
        };
        toggleBtn.addEventListener('click', () => {
            state.isEnabled = !state.isEnabled;
            localStorage.setItem(config.storageKeys.featureEnabled, state.isEnabled);
            updateBtnText();
            buildCollapsibleGroups(listContainer);
        });
        updateBtnText();

        // === 組裝按鈕（順序：展開、收合、分組開關、設定）===
        buttonContainer.appendChild(expandAllBtn);
        buttonContainer.appendChild(collapseAllBtn);
        buttonContainer.appendChild(toggleBtn);
        buttonContainer.appendChild(settingsBtn);

        // === 插入到 header 中，作為第二個子元素（在「提示」和「代幣總數」之間）===
        const firstChild = header.firstElementChild;
        if (firstChild && firstChild.nextSibling) {
            header.insertBefore(buttonContainer, firstChild.nextSibling);
        } else {
            header.appendChild(buttonContainer);
        }

        listContainer.dataset.mingyuButtonAdded = 'true';
    }

    /**
     * 設置拖曳事件處理
     * @param {HTMLElement} listContainer
     */
    function setupDragHandlers(listContainer) {
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

    /**
     * 初始化所有功能：整理列表、加上按鈕、啟動列表內部監控
     * @param {HTMLElement} listContainer
     */
    function initialize(listContainer) {
        if (listContainer.dataset.mingyuInitialized) return;

        createSettingsPanel(listContainer);
        buildCollapsibleGroups(listContainer);
        setupToggleButton(listContainer);
        createListContentObserver(listContainer);
        setupDragHandlers(listContainer);

        listContainer.dataset.mingyuInitialized = 'true';
    }

    /**
     * 初始化設定面板的事件監聽
     */
    function initializeSettingsPanel() {
        const textArea = document.getElementById('prompt-folding-dividers');
        const caseCheckbox = document.getElementById('prompt-folding-case-sensitive');
        const applyButton = document.getElementById('prompt-folding-apply');
        const resetButton = document.getElementById('prompt-folding-reset');

        if (!textArea || !caseCheckbox || !applyButton || !resetButton) {
            console.warn('[PF] 設定面板元素未找到');
            return;
        }

        // 確保 customDividers 存在
        if (!Array.isArray(state.customDividers)) {
            state.customDividers = [...config.defaultDividers];
        }

        // 載入當前設定
        textArea.value = state.customDividers.join('\n');
        caseCheckbox.checked = state.caseSensitive;

        // 小工具：關閉設定面板並同步按鈕狀態
        const closeSettingsPanel = () => {
            const settingsPanel = document.getElementById('prompt-folding-settings');
            const settingsBtn = document.querySelector('.mingyu-settings-toggle');
            if (settingsPanel) settingsPanel.style.display = 'none';
            if (settingsBtn) settingsBtn.classList.remove('active');
        };

        // 套用按鈕
        applyButton.addEventListener('click', () => {
            const newDividers = textArea.value
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            if (newDividers.length === 0) {
                toastr.warning('請至少輸入一個分組標示符號');
                return;
            }

            state.customDividers = newDividers;
            state.caseSensitive = caseCheckbox.checked;
            saveCustomSettings();

            const listContainer = document.querySelector(config.selectors.promptList);
            if (listContainer) buildCollapsibleGroups(listContainer);

            closeSettingsPanel();
            toastr.success('設定已套用並重新分組');
        });

        // 重設按鈕
        resetButton.addEventListener('click', () => {
            state.customDividers = [...config.defaultDividers];
            state.caseSensitive = false;
            saveCustomSettings();

            textArea.value = state.customDividers.join('\n');
            caseCheckbox.checked = false;

            const listContainer = document.querySelector(config.selectors.promptList);
            if (listContainer) buildCollapsibleGroups(listContainer);

            closeSettingsPanel();
            toastr.info('設定已重設為預設值');
        });
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
            // 如果正在處理中或正在拖曳，忽略所有變動
            if (state.isProcessing) {
                return;
            }

            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    const hasChangedNodes = (nodes) => Array.from(nodes).some(node =>
                        node.nodeType === 1 && (
                            node.matches(config.selectors.promptListItem) ||
                            node.querySelector(config.selectors.promptListItem)
                        )
                    );

                    if (hasChangedNodes(mutation.addedNodes) || hasChangedNodes(mutation.removedNodes)) {

                        // 暫停監控避免循環觸發
                        observer.disconnect();

                        try {
                            buildCollapsibleGroups(listContainer);
                        } finally {
                            // 延遲重新啟動，確保所有 DOM 操作完成
                            setTimeout(() => {
                                observer.observe(listContainer, { childList: true, subtree: true });
                            }, 100);
                        }
                        return;
                    }
                }
            }
        });

        // 監控整個子樹，但只在非拖曳狀態下處理
        observer.observe(listContainer, { childList: true, subtree: true });
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