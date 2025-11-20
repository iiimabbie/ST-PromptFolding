import { state, saveCustomSettings, config } from './state.js';
import { buildCollapsibleGroups } from './prompt-folding.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';

/**
 * 建立設定面板並插入到提示詞管理器中
 * @param {HTMLElement} listContainer
 */
export async function createSettingsPanel(listContainer) {
    const manager = document.getElementById('completion_prompt_manager');
    if (!manager) {
        console.warn('[PF] completion_prompt_manager 未找到');
        return;
    }

    if (document.getElementById('prompt-folding-settings')) {
        return;
    }

    // 從 manifest.json 獲取 settings.html 的路徑
    const response = await fetch('/scripts/extensions/third-party/ST-PromptFolding/settings.html');
    if (!response.ok) {
        console.error('[PF] 無法載入 settings.html');
        return;
    }
    const settingsHtml = await response.text();

    const header = manager.querySelector('.completion_prompt_manager_header');
    const listHead = manager.querySelector('.completion_prompt_manager_list_head');

    if (header) {
        header.insertAdjacentHTML('afterend', settingsHtml);
    } else if (listHead) {
        listHead.insertAdjacentHTML('beforebegin', settingsHtml);
    } else {
        listContainer.insertAdjacentHTML('beforebegin', settingsHtml);
    }
    
    initializeSettingsPanel();
}

/**
 * 初始化設定面板的事件監聽
 */
function initializeSettingsPanel() {
    const textArea = document.getElementById('prompt-folding-dividers');
    const applyButton = document.getElementById('prompt-folding-apply');
    const resetButton = document.getElementById('prompt-folding-reset');

    if (!textArea || !applyButton || !resetButton) {
        console.warn('[PF] 設定面板元素未找到');
        return;
    }

    if (!Array.isArray(state.customDividers)) {
        state.customDividers = [...config.defaultDividers];
    }

    textArea.value = state.customDividers.join('\n');

    const standardRadio = document.getElementById('prompt-folding-mode-standard');
    const sandwichRadio = document.getElementById('prompt-folding-mode-sandwich');
    if (standardRadio && sandwichRadio) {
        if (state.foldingMode === 'sandwich') {
            sandwichRadio.checked = true;
        } else {
            standardRadio.checked = true;
        }

        // 為模式切換添加即時監聽
        const modeRadios = document.getElementById('prompt-folding-mode-radios');
        if (modeRadios) {
            modeRadios.addEventListener('change', (event) => {
                if (event.target.name === 'folding-mode') {
                    state.foldingMode = event.target.value;
                    saveCustomSettings();
                    const listContainer = document.querySelector(config.selectors.promptList);
                    if (listContainer) {
                        buildCollapsibleGroups(listContainer);
                    }
                    toastr.success(`模式已切換為: ${state.foldingMode === 'standard' ? '標準模式' : '包覆模式'}`);
                }
            });
        }
    }

    const closeSettingsPanel = () => {
        const settingsPanel = document.getElementById('prompt-folding-settings');
        const settingsBtn = document.querySelector('.mingyu-settings-toggle');
        if (settingsPanel) settingsPanel.style.display = 'none';
        if (settingsBtn) settingsBtn.classList.remove('active');
    };

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

        const selectedMode = document.querySelector('input[name="folding-mode"]:checked').value;
        state.foldingMode = selectedMode || 'standard';

        saveCustomSettings();

        const listContainer = document.querySelector(config.selectors.promptList);
        if (listContainer) buildCollapsibleGroups(listContainer);

        closeSettingsPanel();
        toastr.success('設定已套用並重新分組');
    });

    resetButton.addEventListener('click', async () => {
        // 準備 HTML 內容
        const popupContent = `
            <div style="font-size: 1.1em; margin-bottom: 10px;">確定要重設所有設定嗎？</div>
            <div style="text-align: left; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px;">
                這將會執行以下操作：
                <ul style="margin: 5px 0 5px 20px; list-style-type: disc;">
                    <li>恢復預設分組標示符號 (=, -)</li>
                    <li>切換回標準模式</li>
                    <li>立即重新分組</li>
                </ul>
                <div style="color: #ff6b6b; margin-top: 10px; font-weight: bold;">⚠ 此操作無法復原！</div>
            </div>
        `;

        // 直接呼叫引入的函式，並使用引入的 Enum
        // callGenericPopup 參數順序: content, type, inputValue, options
        const result = await callGenericPopup(
            popupContent, 
            POPUP_TYPE.CONFIRM, 
            '', // inputValue (Confirm 類型不需要，但保持參數位置)
            { okButton: '確定重設', cancelButton: '取消' } // (選用) 自訂按鈕文字讓介面更清楚
        );

        // 如果使用者按取消 (result 為 false 或 null)
        if (!result) {
            return; 
        }

        // 執行重設
        state.customDividers = [...config.defaultDividers];
        state.foldingMode = 'standard';
        saveCustomSettings();

        textArea.value = state.customDividers.join('\n');
        if (standardRadio) standardRadio.checked = true;

        const listContainer = document.querySelector(config.selectors.promptList);
        if (listContainer) buildCollapsibleGroups(listContainer);

        closeSettingsPanel();
        toastr.info('設定已重設為預設值');
    });

    // 顯示版本資訊
    fetch('/scripts/extensions/third-party/ST-PromptFolding/manifest.json')
        .then(response => response.json())
        .then(manifest => {
            const versionInfoEl = document.getElementById('prompt-folding-version-info');
            if (versionInfoEl) {
                versionInfoEl.textContent = `${manifest.display_name} v${manifest.version} © ${manifest.author}`;
            }
        })
        .catch(err => console.error('[PF] 無法載入 manifest.json 獲取版本號:', err));

    // 動態載入更新日誌
    fetch('/scripts/extensions/third-party/ST-PromptFolding/changelog.json')
        .then(response => response.json())
        .then(logs => {
            const changelogIcon = document.getElementById('prompt-folding-changelog-icon');
            if (changelogIcon && Array.isArray(logs)) {
                // 格式化日誌內容
                const logText = logs.map(log => 
                    `[${log.date}] v${log.version}\n${log.changes.map(c => `• ${c}`).join('\n')}`
                ).join('\n\n');
                
                changelogIcon.title = `更新日誌\n\n${logText}`;
            }
        })
        .catch(err => {
            console.error('[PF] 無法載入 changelog.json:', err);
            const changelogIcon = document.getElementById('prompt-folding-changelog-icon');
            if (changelogIcon) changelogIcon.title = "無法載入更新日誌";
        });
}
