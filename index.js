import { config, state } from './state.js';
import { buildCollapsibleGroups, toggleAllGroups, setupDragHandlers } from './prompt-folding.js';
import { createSettingsPanel } from './settings-ui.js';

/**
 * 建立並掛載「啟用/停用」功能的切換按鈕 + 全部展開/收合按鈕 + 設定按鈕
 * @param {HTMLElement} listContainer
 */
function setupToggleButton(listContainer) {
    const header = document.querySelector('.completion_prompt_manager_header');
    if (!header) return;

    if (listContainer.dataset.mingyuButtonAdded) return;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'mingyu-collapse-controls';

    const expandAllBtn = document.createElement('button');
    expandAllBtn.className = 'menu_button mingyu-expand-all';
    expandAllBtn.title = '展開所有群組';
    expandAllBtn.textContent = '⬇️';
    expandAllBtn.addEventListener('click', () => toggleAllGroups(listContainer, true));

    const collapseAllBtn = document.createElement('button');
    collapseAllBtn.className = 'menu_button mingyu-collapse-all';
    collapseAllBtn.title = '收合所有群組';
    collapseAllBtn.textContent = '⬆️';
    collapseAllBtn.addEventListener('click', () => toggleAllGroups(listContainer, false));

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'menu_button mingyu-settings-toggle';
    settingsBtn.title = '分組設定';
    settingsBtn.textContent = '⚙️';
    
    listContainer.dataset.settingsBtn = 'true';
    settingsBtn.addEventListener('click', () => {
        const settingsPanel = document.getElementById('prompt-folding-settings');
        if (settingsPanel) {
            const isVisible = settingsPanel.style.display !== 'none';
            settingsPanel.style.display = isVisible ? 'none' : 'block';
            settingsBtn.classList.toggle('active', !isVisible);
        }
    });

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

    buttonContainer.appendChild(expandAllBtn);
    buttonContainer.appendChild(collapseAllBtn);
    buttonContainer.appendChild(toggleBtn);
    buttonContainer.appendChild(settingsBtn);

    const firstChild = header.firstElementChild;
    if (firstChild && firstChild.nextSibling) {
        header.insertBefore(buttonContainer, firstChild.nextSibling);
    } else {
        header.appendChild(buttonContainer);
    }

    listContainer.dataset.mingyuButtonAdded = 'true';
}

/**
 * 監控器 #1: 監控列表「內部」的變化 (項目增刪)
 * @param {HTMLElement} listContainer
 */
function createListContentObserver(listContainer) {
    const oldObserver = state.observers.get(listContainer);
    if (oldObserver) {
        oldObserver.disconnect();
    }

    const observer = new MutationObserver((mutations) => {
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
                    observer.disconnect();
                    try {
                        buildCollapsibleGroups(listContainer);
                    } finally {
                        setTimeout(() => {
                            observer.observe(listContainer, { childList: true, subtree: true });
                        }, 100);
                    }
                    return;
                }
            }
        }
    });

    observer.observe(listContainer, { childList: true, subtree: true });
    state.observers.set(listContainer, observer);
}

/**
 * 初始化所有功能
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
                    initialize(node);
                    return;
                }
                const list = node.querySelector(config.selectors.promptList);
                if (list) {
                    initialize(list);
                    return;
                }
            }
        }
    });

    observer.observe(appBody, { childList: true, subtree: true });
}

// --- 程式進入點 ---
(function() {
    const initialList = document.querySelector(config.selectors.promptList);
    if (initialList) {
        initialize(initialList);
    }
    createContainerWatcher();
})();
