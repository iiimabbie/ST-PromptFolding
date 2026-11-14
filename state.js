import { oai_settings } from '../../../../scripts/openai.js';
import { getPresetManager } from '../../../../scripts/preset-manager.js';

// --- 全域設定 ---
export const config = {
    // CSS 選擇器
    selectors: {
        appBody: 'body',
        promptList: '#completion_prompt_manager_list',
        promptListItem: 'li.completion_prompt_manager_prompt',
        promptLink: 'a.prompt-manager-inspect-action',  // 真正包含文字的 <a> 標籤
        promptNameSpan: 'span.completion_prompt_manager_prompt_name',  // 外層容器
        promptAsterisk: '.fa-asterisk', // 標題列要隱藏的星號
        listHeader: '.completion_prompt_manager_list_head',
    },
    // CSS class 名稱
    classNames: {
        group: 'mingyu-prompt-group',
        groupContent: 'mingyu-prompt-group-content',
        isGroupHeader: 'is-group-header', // 加到作為標題的 li 元素上
    },
    // 預設的分組標示
    defaultDividers: ['=', '-'],
};

// 獲取當前 preset 名稱（從 DOM，不依賴全域 oai_settings）
export function getCurrentPresetName() {
    const select = document.querySelector('#settings_preset_openai');
    if (select) {
        const selected = select.querySelector(':checked');
        if (selected) return selected.textContent.trim();
    }
    return 'default';
}

// --- 狀態（初始為預設值，實際資料由 loadFromPreset 填入）---
export let state = {
    openGroups: {},
    isEnabled: true,
    customDividers: [...config.defaultDividers],
    foldingMode: 'manual',
    debugMode: false,
    manualHeaders: new Set(),

    // Runtime 狀態
    isProcessing: false,
    observers: new WeakMap(),
    groupHierarchy: {},
    groupHeaderStatus: {},
    isSelectingHeaders: false,
};

// 建立分隔線 Regex (特殊字元自動跳脫)
function _buildRegex() {
    const patterns = state.customDividers.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`^(${patterns.join('|')})`, 'i');
}

// 初始化 Regex
export let dividerRegex = _buildRegex();

// 重建並更新 module-level 的 dividerRegex
export function buildDividerRegex() {
    dividerRegex = _buildRegex();
    return dividerRegex;
}

// Debug log 函式
export function log(...args) {
    if (state.debugMode) {
        console.log('[PF]', ...args);
    }
}

// --- 從 preset extensions 載入 state ---
export function loadFromPreset(pfData) {
    const data = normalizePfData(pfData);
    state.openGroups     = data.openStates;
    state.isEnabled      = data.featureEnabled;
    state.customDividers = data.customDividers;
    state.foldingMode    = data.foldingMode;
    state.debugMode      = data.debugMode;
    state.manualHeaders  = new Set(data.manualHeaders);

    buildDividerRegex();
    log('loadFromPreset:', pfData ? `mode=${state.foldingMode}, headers=${state.manualHeaders.size}` : 'no data, using defaults');
}

// --- 補齊預設值並統一 manualHeaders 格式 ---
function normalizePfData(pfData) {
    pfData ??= {};
    return {
        openStates:     pfData.openStates     ?? {},
        featureEnabled: pfData.featureEnabled  ?? true,
        foldingMode:    pfData.foldingMode     ?? 'manual',
        customDividers: pfData.customDividers  ?? [...config.defaultDividers],
        debugMode:      pfData.debugMode       ?? false,
        manualHeaders:  (pfData.manualHeaders ?? []).map(h => (typeof h === 'string' ? h : h?.uuid)).filter(Boolean),
    };
}

// --- 序列化 state 為可存進 preset 的格式 ---
export function getStateForSave() {
    return {
        openStates:     state.openGroups,
        featureEnabled: state.isEnabled,
        foldingMode:    state.foldingMode,
        customDividers: state.customDividers,
        debugMode:      state.debugMode,
        manualHeaders:  [...state.manualHeaders], // 純 UUID 陣列
    };
}

// --- 存到 preset JSON ---
let pendingSave = null;

function capturePresetSave() {
    return {
        name: oai_settings.preset_settings_openai || getCurrentPresetName(),
        value: structuredClone(getStateForSave()),
    };
}

function writePresetSave({ name, value }) {
    return getPresetManager('openai').writePresetExtensionField({ name, path: 'prompt_folding', value });
}

export function flushPresetSave() {
    if (!pendingSave) return Promise.resolve();
    clearTimeout(pendingSave.timer);
    const saved = pendingSave;
    pendingSave = null;
    return writePresetSave(saved);
}

export function schedulePresetSave() {
    const saved = capturePresetSave();
    if (pendingSave && pendingSave.name !== saved.name) flushPresetSave().catch(err => console.error('[PF] Save failed:', err));
    if (pendingSave) clearTimeout(pendingSave.timer);
    pendingSave = saved;
    saved.timer = setTimeout(() => flushPresetSave().catch(err => console.error('[PF] Save failed:', err)), 1500);
}

export function saveToPreset() {
    schedulePresetSave();
    return flushPresetSave();
}

// saveCustomSettings：向下相容，呼叫 saveToPreset（fire-and-forget）
export function saveCustomSettings() {
    saveToPreset().catch(err => console.error('[PF] Save failed:', err));
}

// --- 從 in-memory preset 讀取 folding data（頁面載入時用）---
export async function getCurrentPresetFoldingData() {
    try {
        const { oai_settings, openai_settings, openai_setting_names } = await import('../../../../scripts/openai.js');
        const name = oai_settings.preset_settings_openai || getCurrentPresetName();
        const idx = openai_setting_names[name];
        if (idx === undefined) return null;
        return openai_settings[idx]?.extensions?.prompt_folding ?? null;
    } catch (err) {
        console.error('[PF] getCurrentPresetFoldingData failed:', err);
        return null;
    }
}

// --- 列出所有 preset 名稱（從 DOM dropdown）---
export function getAllPresetNames() {
    return Array.from(
        document.querySelectorAll('#settings_preset_openai option'),
    ).map(opt => opt.textContent.trim()).filter(Boolean);
}

// --- 取得指定 preset 的 folding config（供 copy 功能用）---
// 回傳值永遠是新格式（等同 getStateForSave 結構），舊格式會經 loadFromPreset 正規化
export async function exportConfigFromPreset(presetName) {
    const currentName = getCurrentPresetName();

    // 當前 preset：直接從 runtime state 取（已是新格式）
    if (presetName === currentName) {
        return getStateForSave();
    }

    // 其他 preset：從 in-memory 讀取，經 normalizePfData 正規化
    try {
        const { openai_settings, openai_setting_names } = await import('../../../../scripts/openai.js');
        const idx        = openai_setting_names[presetName];
        const presetData = openai_settings?.[idx];
        const pfData     = presetData?.extensions?.prompt_folding;
        return pfData ? normalizePfData(pfData) : null;
    } catch (err) {
        console.error('[PF] exportConfigFromPreset failed:', err);
        return null;
    }
}

// --- 將來源 preset 的設定套用到當前 preset（UUID 匹配）---
export async function importConfigToCurrentPreset(configData, currentPromptItems) {
    log('Importing config from another preset to', getCurrentPresetName());

    // 載入設定，並由 loadFromPreset 統一格式
    loadFromPreset(configData);

    // manualHeaders UUID 匹配：只保留當前 preset 中存在的
    const currentUuids = new Set(
        currentPromptItems.map(item => item.dataset.pmIdentifier).filter(Boolean),
    );

    const matched = [];
    const failed  = [];
    state.manualHeaders.forEach(uuid => {
        if (currentUuids.has(uuid)) {
            matched.push(uuid);
        } else {
            failed.push(uuid);
        }
    });

    state.manualHeaders = new Set(matched);

    await saveToPreset();

    log('Import completed: matched', matched.length, 'failed', failed.length);
    return { byUuid: matched.length, failed };
}
