import { config, state } from './state.js';
import { buildCollapsibleGroups, toggleAllGroups } from './prompt-folding.js';
import { createSettingsPanel } from './settings-ui.js';

let promptManagerInstance = null;
let isHooked = false;

// --- 1. 觀察者邏輯 ---

// 監控列表「內部」CRUD 變化
function createListContentObserver(listContainer) {
    if (state.observers.has(listContainer)) state.observers.get(listContainer).disconnect();

    const observer = new MutationObserver((mutations) => {
        if (state.isProcessing) return;

        // 檢查是否有相關節點變動
        const isPromptNode = (n) => n.nodeType === 1 && (n.matches(config.selectors.promptListItem) || n.querySelector(config.selectors.promptListItem));
        
        const shouldRebuild = mutations.some(m => 
            m.type === 'childList' && (Array.from(m.addedNodes).some(isPromptNode) || Array.from(m.removedNodes).some(isPromptNode))
        );

        if (shouldRebuild) {
            observer.disconnect();
            buildCollapsibleGroups(listContainer);
            // 稍微延遲後重新掛載，避免連續觸發
            setTimeout(() => observer.observe(listContainer, { childList: true, subtree: true }), 100);
        }
    });

    observer.observe(listContainer, { childList: true, subtree: true });
    state.observers.set(listContainer, observer);
}

// 處理拖曳 (拖曳時暫停監控，拖完重整)
function setupDragHandlers(listContainer) {
    listContainer.addEventListener('dragstart', (e) => {
        if (e.target.closest(config.selectors.promptListItem)) {
            state.observers.get(listContainer)?.disconnect();
        }
    });

    listContainer.addEventListener('dragend', () => {
        setTimeout(() => {
            buildCollapsibleGroups(listContainer);
            state.observers.get(listContainer)?.observe(listContainer, { childList: true, subtree: true });
        }, 150);
    });
}

// --- 2. UI 按鈕邏輯 ---

// Helper: 快速建立按鈕
function createBtn(icon, title, onClick, className = '') {
    const btn = document.createElement('button');
    btn.className = `menu_button ${className}`;
    btn.textContent = icon;
    btn.title = title;
    btn.onclick = onClick;
    return btn;
}

/**
 * 建立並掛載功能按鈕與搜尋框
 */
function setupToggleButton(listContainer) {
    // 1. 找到外層容器與 Header
    const manager = listContainer.closest('#completion_prompt_manager');
    const header = manager?.querySelector('.completion_prompt_manager_header');
    if (!manager || !header) return;

    // 2. 移除舊的控制列
    manager.querySelector('.mingyu-collapse-controls')?.remove();

    // 3. 建立新的工具列容器
    const container = document.createElement('div');
    container.className = 'mingyu-collapse-controls';

    // --- 搜尋框 ---
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '搜尋...(或是輸入 on / off)'; // 簡短一點
    searchInput.className = 'mingyu-prompt-search text_pole'; // 使用 ST 原生樣式 text_pole
    searchInput.value = state.searchQuery;
    
    // 監聽輸入：更新 state -> 重繪
    searchInput.addEventListener('input', (e) => {
        // 轉小寫，這樣輸入 ON/On/off 都能通
        state.searchQuery = e.target.value.toLowerCase().trim();
        buildCollapsibleGroups(listContainer);
    });

    container.appendChild(searchInput);

    // 功能按鈕
    container.append(
        createBtn('⬇️', '展開所有', () => toggleAllGroups(listContainer, true), 'mingyu-expand-all'),
        createBtn('⬆️', '收合所有', () => toggleAllGroups(listContainer, false), 'mingyu-collapse-all')
    );

    // 開關按鈕
    const toggleBtn = createBtn('', '', () => {
        state.isEnabled = !state.isEnabled;
        localStorage.setItem(config.storageKeys.featureEnabled, state.isEnabled);
        updateToggleState();
        buildCollapsibleGroups(listContainer);
    });
    
    const updateToggleState = () => {
        toggleBtn.textContent = state.isEnabled ? '🟢' : '🔴';
        toggleBtn.title = state.isEnabled ? '點擊停用' : '點擊啟用';
    };
    updateToggleState();
    container.append(toggleBtn);

    // --- 設定按鈕 ---
    const settingsBtn = createBtn('⚙️', '分組設定', () => {
        const panel = document.getElementById('prompt-folding-settings');
        if (panel) {
            const isHidden = panel.style.display === 'none';
            panel.style.display = isHidden ? 'block' : 'none';
            settingsBtn.classList.toggle('active', isHidden);
        }
    }, 'mingyu-settings-toggle');
    container.append(settingsBtn);

    // 4. 插入到 Header 的「後面」，成為獨立的一行
    header.insertAdjacentElement('afterend', container);
}

// --- 3. Hook 核心邏輯 (效能優化版) ---

function hookPromptManager(pm) {
    const originalGet = pm.getPromptCollection.bind(pm);
    
    pm.getPromptCollection = function(type) {
        const collection = originalGet(type);
        if (!state.isEnabled) return collection;

        // 1. 更新 Header 狀態 (這步很快)
        updateGroupHeaderStatus(pm);

        // 2. 建立「被禁用 ID」的 Set (Lookup O(1))
        const disabledIds = new Set();
        for (const [groupKey, childIds] of Object.entries(state.groupHierarchy)) {
            // 如果這個群組被關閉 (false)，把它的孩子都加入黑名單
            if (state.groupHeaderStatus[groupKey] === false) {
                childIds.forEach(id => disabledIds.add(id));
            }
        }

        // 3. 過濾
        if (disabledIds.size > 0) {
            collection.collection = collection.collection.filter(p => !disabledIds.has(p.identifier));
        }

        return collection;
    };
    console.log('[PF] Hook installed.');
}

function updateGroupHeaderStatus(pm) {
    const char = pm.activeCharacter;
    if (!char) return;
    
    // 從 Prompt Order 檢查 Header 目前有沒有被啟用
    const order = pm.getPromptOrderForCharacter(char);
    Object.keys(state.groupHierarchy).forEach(headerId => {
        const entry = order.find(e => e.identifier === headerId);
        if (entry) state.groupHeaderStatus[headerId] = entry.enabled;
    });
}

// --- 4. 初始化與進入點 ---

function initialize(listContainer) {
    const pmWrapper = listContainer.closest('#completion_prompt_manager');
    if (!pmWrapper) return;

    createSettingsPanel(pmWrapper);
    setupToggleButton(listContainer);
    buildCollapsibleGroups(listContainer);
    createListContentObserver(listContainer);
    setupDragHandlers(listContainer);
    
    // 嘗試 Hook
    if (!isHooked) {
        import('../../../../scripts/openai.js').then(m => {
            const check = setInterval(() => {
                if (m.promptManager?.serviceSettings) {
                    clearInterval(check);
                    promptManagerInstance = m.promptManager;
                    hookPromptManager(m.promptManager);
                    isHooked = true;
                }
            }, 100);
            setTimeout(() => clearInterval(check), 5000); // 5秒超時
        });
    }
}

// 全域監控：等 ST 畫出列表
const globalObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
        for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.matches(config.selectors.promptList)) return initialize(node);
            const list = node.querySelector(config.selectors.promptList);
            if (list) return initialize(list);
        }
    }
});
globalObserver.observe(document.body, { childList: true, subtree: true });

// 如果腳本跑太慢，列表已經在畫面上了，就手動觸發一次
const initialList = document.querySelector(config.selectors.promptList);
if (initialList) initialize(initialList);