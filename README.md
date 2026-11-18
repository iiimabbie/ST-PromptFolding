<div align="center">

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md)

# Prompt Folding

**Collapsible groups for the SillyTavern Prompt Manager**

A SillyTavern extension that organizes the OpenAI/Chat Completion Prompt Manager into collapsible groups. Disabling a group header excludes its toggleable contents from the prompt collection.

![Version](https://img.shields.io/github/manifest-json/v/iiimabbie/ST-PromptFolding?label=version&color=8a5cf6)
![SillyTavern](https://img.shields.io/badge/SillyTavern-extension-e8a87c)
![i18n](https://img.shields.io/badge/i18n-繁中%20·%20简中%20·%20EN-2ea44f)
![License](https://img.shields.io/badge/license-CC%20BY--NC--ND%204.0-lightgrey)

[Features](#features) · [Folding modes](#folding-modes) · [Usage](#usage) · [Install](#install)

</div>

> [!NOTE]
> The interface follows SillyTavern's language setting.

## Features

- Choose manual headers or group prompts by name using configurable markers.
- Expand or collapse individual groups or all groups at once.
- Copy folding settings between presets and include them in preset exports.

## Folding modes

### Manual selection
In **Group settings** (⚙️), choose **Manual selection mode** and click **Start selecting folders**. Check the prompts to use as headers, then confirm with the green check or cancel with the red ×. Each header groups the following prompts up to the next header.

### Standard mode
Under **Legacy modes**, choose **Standard mode**. Prompt names starting with a configured marker become headers; the defaults are `=` and `-`. Edit **Group markers (one per line)** and confirm with the check to apply changes.

### Sandwich mode
Under **Legacy modes**, choose **Sandwich mode**. Each marked header pairs with the next marked header; the group contains everything between them, including the closing header. Names need not match.

```text
= Start
Attack / Defense
- End
```

## Usage

- Click a group's arrow or header name to expand or collapse it; the header name does not open the editor.
- The toolbar's **Expand all** and **Collapse all** controls affect all groups. **🟢 / 🔴** enables or disables grouping and group filtering; **⚙️** opens settings.
- Turn off a header and every child that SillyTavern lets you toggle is treated as turned off, such as toggleable character descriptions and world info. Their own switches are not changed. Disabled styling is applied when groups are rebuilt.
- Under **Copy settings from another preset**, select another preset and click **Copy**. Manual headers are matched by UUID; unmatched headers are dropped.
- **Fold settings** folds the OpenAI settings area; its choice persists separately from presets. Preset export includes folding settings, and import loads them when present.
- **Reset all settings** restores the current preset's folding settings to defaults.

## Install

1. In SillyTavern's **Extensions** tab, choose **Install extension** and enter `https://github.com/iiimabbie/ST-PromptFolding`.
2. Keep the extension folder named `ST-PromptFolding` and enable **Prompt Folding**.
3. Open the OpenAI/Chat Completion Prompt Manager; the extension works there.
