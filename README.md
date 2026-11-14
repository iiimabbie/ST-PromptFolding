[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

# Prompt Folding

[![License: BY-NC-ND-LinkOnly](https://img.shields.io/badge/license-BY--NC--ND--LinkOnly-lightgrey)](LICENSE)

A SillyTavern extension that organizes the OpenAI/Chat Completion Prompt Manager into collapsible groups. Disabling a group header excludes its contents from the prompt collection.

> [!NOTE]
> The extension UI is in Traditional Chinese; labels below appear as shown in the UI.

## Features

- Choose manual headers or group prompts by name using configurable markers.
- Expand or collapse individual groups or all groups at once.
- Copy folding settings between presets and include them in preset exports.

## Folding modes

### Manual selection
In **分組設定** (⚙️), choose **手動選擇模式** and click **開始選擇資料夾**. Check the prompts to use as headers, then confirm with the green check or cancel with the red ×. Each header groups the following prompts up to the next header.

### Standard mode
Under **舊版模式**, choose **標準模式**. Prompt names starting with a configured marker become headers; the defaults are `=` and `-`. Edit **分組標示符號（一行一個）** and confirm with the check to apply changes.

### Sandwich mode
Under **舊版模式**, choose **包覆模式**. Each marked header pairs with the next marked header; the group contains everything between them, including the closing header. Names need not match.

```text
= Start
Attack / Defense
- End
```

## Usage

- Click a group's arrow or header name to expand or collapse it; the header name does not open the editor.
- The toolbar's **展開所有** and **收合所有** controls affect all groups. **🟢 / 🔴** enables or disables grouping and group filtering; **⚙️** opens settings.
- Turn off a header and every child that SillyTavern lets you toggle is treated as turned off, including character description, world info and chat history. Their own switches are not changed. Disabled styling is applied when groups are rebuilt.
- Under **從其他 Preset 複製配置**, select another preset and click **複製**. Manual headers are matched by UUID; unmatched headers are dropped.
- **折設定** folds the OpenAI settings area; its choice persists separately from presets. Preset export includes folding settings, and import loads them when present.
- **重設所有設定** restores the current preset's folding settings to defaults.

> [!WARNING]
> Dragging prompts to reorder them is not recommended.

## Install

1. In SillyTavern's **Extensions** tab, install `https://github.com/iiimabbie/ST-PromptFolding`.
2. Keep the extension folder named `ST-PromptFolding` and enable **Prompt Folding**.
3. Open the OpenAI/Chat Completion Prompt Manager; the extension works there.

See the [Custom BY-NC-ND-LinkOnly License](LICENSE) for terms.
