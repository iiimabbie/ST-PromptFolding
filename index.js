import { config, state } from './state.js';
import { buildCollapsibleGroups, toggleAllGroups } from './prompt-folding.js';
import { createSettingsPanel } from './settings-ui.js';

// This file is now a direct, modularized translation of the original, successful logic.

/**
 * 監控器 #1: 監控列表「內部」的變化 (項目增刪等)
 * @param {HTMLElement} listContainer 
 */
function createListContentObserver(listContainer) {
    const existingObserver = state.observers.get(listContainer);
    if (existingObserver) {
        existingObserver.disconnect();
    }

    const observer = new MutationObserver((mutations) => {
        // 如果正在處理中，則忽略所有變動，防止無限循環
        if (state.isProcessing) return;

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                // 檢查變動的節點是否是我們關心的提示詞項目
                const hasChangedNodes = (nodes) => Array.from(nodes).some(node => 
                    node.nodeType === 1 && (node.matches(config.selectors.promptListItem) || node.querySelector(config.selectors.promptListItem))
                );

                if (hasChangedNodes(mutation.addedNodes) || hasChangedNodes(mutation.removedNodes)) {
                    // 暫停監控，避免在我們自己修改DOM時觸發自己
                    observer.disconnect();
                    try {
                        // 核心功能：重新整理分組
                        buildCollapsibleGroups(listContainer);
                    } finally {
                        // 延遲後重新啟動監控，確保DOM操作已完全穩定
                        setTimeout(() => observer.observe(listContainer, { childList: true, subtree: true }), 100);
                    }
                    return; // 處理完第一個相關的變動就退出，提高效率
                }
            }
        }
    });

    observer.observe(listContainer, { childList: true, subtree: true });
    state.observers.set(listContainer, observer);
}

/**
 * 設置拖曳事件處理，主要用於在拖曳時暫停/重啟內部監控器
 * @param {HTMLElement} listContainer 
 */
function setupDragHandlers(listContainer) {
    const restartObserver = () => {
        const observer = state.observers.get(listContainer);
        if (observer) {
            observer.observe(listContainer, { childList: true, subtree: true });
        }
    };

    listContainer.addEventListener('dragstart', (event) => {
        const draggedLi = event.target.closest(config.selectors.promptListItem);
        if (!draggedLi) return;

        // 拖曳開始時，立即停用內部監控器，防止其在拖曳過程中被觸發
        const observer = state.observers.get(listContainer);
        if (observer) {
            observer.disconnect();
        }
    });

    listContainer.addEventListener('dragend', (event) => {
        // SillyTavern 的原生拖曳會自動處理DOM排序。
        // 我們只需等待一小段時間，讓DOM穩定下來，然後重新執行分組即可。
        // 監控器會在 buildCollapsibleGroups -> createListContentObserver 的流程中被重啟
        setTimeout(() => {
            buildCollapsibleGroups(listContainer);
            restartObserver(); // 重新掛載監控器
        }, 150);
    });
}

/**
 * 建立並掛載「啟用/停用」功能的切換按鈕 + 全部展開/收合按鈕 + 設定按鈕
 * @param {HTMLElement} listContainer
 */
function setupToggleButton(listContainer) {
    const header = document.querySelector('.completion_prompt_manager_header');
    // 如果找不到標頭，或按鈕已存在，則不執行
    if (!header || header.dataset.mingyuButtonAdded) return;
    header.dataset.mingyuButtonAdded = 'true';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'mingyu-collapse-controls';

    // --- 全部展開按鈕 ---
    const expandAllBtn = document.createElement('button');
    expandAllBtn.className = 'menu_button mingyu-expand-all';
    expandAllBtn.title = '展開所有群組';
    expandAllBtn.textContent = '⬇️';
    expandAllBtn.addEventListener('click', () => toggleAllGroups(listContainer, true));

    // --- 全部收合按鈕 ---
    const collapseAllBtn = document.createElement('button');
    collapseAllBtn.className = 'menu_button mingyu-collapse-all';
    collapseAllBtn.title = '收合所有群組';
    collapseAllBtn.textContent = '⬆️';
    collapseAllBtn.addEventListener('click', () => toggleAllGroups(listContainer, false));

    // --- 設定按鈕 ---
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'menu_button mingyu-settings-toggle';
    settingsBtn.title = '分組設定';
    settingsBtn.textContent = '⚙️';
    settingsBtn.addEventListener('click', () => {
        const settingsPanel = document.getElementById('prompt-folding-settings');
        if (settingsPanel) {
            const isVisible = settingsPanel.style.display !== 'none';
            settingsPanel.style.display = isVisible ? 'none' : 'block';
            settingsBtn.classList.toggle('active', !isVisible);
        }
    });

    // --- 功能啟用/停用按鈕 ---
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

    // --- 組裝所有按鈕 ---
    buttonContainer.appendChild(expandAllBtn);
    buttonContainer.appendChild(collapseAllBtn);
    buttonContainer.appendChild(toggleBtn);
    buttonContainer.appendChild(settingsBtn);

    // --- 將按鈕容器插入到標頭中 ---
    const firstChild = header.firstElementChild;
    if (firstChild && firstChild.nextSibling) {
        header.insertBefore(buttonContainer, firstChild.nextSibling);
    } else {
        header.appendChild(buttonContainer);
    }
}

/**
 * 核心初始化函式，當找到提示詞列表時被呼叫
 * @param {HTMLElement} listContainer 
 */
function initialize(listContainer) {
    // 原始程式碼的精髓在於，每次列表被SillyTavern重新渲染時，
    // 全域監控器都會找到新的列表並重新觸發一次完整的初始化流程，
    // 因此我們不需要在這裡檢查是否已初始化，直接執行即可。
    createSettingsPanel(listContainer.closest('#completion_prompt_manager'));
    setupToggleButton(listContainer);
    buildCollapsibleGroups(listContainer);
    createListContentObserver(listContainer);
    setupDragHandlers(listContainer);
}

/**
 * 監控器 #2: 全域、永續性的監控器，監控提示詞列表容器的出現。
 * 這是確保擴充功能在SillyTavern的動態UI中能穩定運作的關鍵。
 */
function createContainerWatcher() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;

                // 檢查被加入的節點是否是列表本身，或是包含了列表
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

    observer.observe(document.body, { childList: true, subtree: true });
}

// --- 程式進入點 ---
// 1. 立即檢查列表是否已存在，以應對頁面載入時列表就已經開啟的情況
const initialList = document.querySelector(config.selectors.promptList);
if (initialList) {
    initialize(initialList);
}

// 2. 啟動全域監控，以應對動態載入和SillyTavern的重新渲染。
createContainerWatcher();