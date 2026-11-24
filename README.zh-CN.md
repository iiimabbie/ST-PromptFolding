<div align="center">

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md)

# Prompt Folding

**把 SillyTavern 提示词管理器整理成可折叠分组**

这个 SillyTavern 扩展可以把 OpenAI／Chat Completion 的提示词管理器整理成可折叠分组。停用分组标题后，组内可开关的提示词会从提示词列表中排除。

![Version](https://img.shields.io/github/manifest-json/v/iiimabbie/ST-PromptFolding?label=version&color=8a5cf6)
![SillyTavern](https://img.shields.io/badge/SillyTavern-extension-e8a87c)
![i18n](https://img.shields.io/badge/i18n-繁中%20·%20简中%20·%20EN-2ea44f)
![License](https://img.shields.io/badge/license-CC%20BY--NC--ND%204.0-lightgrey)

[功能](#功能) · [折叠模式](#折叠模式) · [使用](#使用) · [安装](#安装)

</div>

> [!NOTE]
> 界面语言跟随 SillyTavern 的语言设置。

## 功能

- 手动选择标题，或使用自定义标记按名称分组。
- 单独展开、折叠分组，也可以一次展开、折叠全部分组。
- 在预设之间复制折叠设置，并随预设一起导出。

## 折叠模式

### 手动选择
在 **分组设置**（齿轮图标）中选择 **手动选择模式**，点击 **开始选择文件夹**，勾选要作为标题的提示词，再用绿色勾确认或红色 × 取消。每个标题会收起后续提示词，直到下一个标题为止。

### 标准模式
在 **旧版模式** 中选择 **标准模式**。名称以指定符号开头的提示词会成为标题；默认符号是 `=` 和 `-`。修改 **分组标记符号（每行一个）** 后，点击勾应用。

### 包覆模式
在 **旧版模式** 中选择 **包覆模式**。每个标题会与下一个标题配对，中间的条目和结尾标题都属于该分组；两个标题的名称不必相同。

```text
= 开始
攻击／防御
- 结束
```

## 使用

- 点击分组箭头或标题名称即可展开、折叠；点击标题名称不会打开编辑器。
- 工具栏的 **展开全部**、**折叠全部** 控制全部分组。**开关图标** 切换分组和组内过滤功能；**齿轮** 打开设置。
- 停用标题后，组内所有 SillyTavern 允许开关的子项都视为关闭，例如可开关的角色描述和世界书；子项本身的开关不会被改动。重建分组时会应用停用样式。
- 在 **从其他预设复制配置** 中选择来源并点击 **复制**。手动标题按 UUID 匹配，无法匹配的标题会被丢弃。
- **折叠设置** 可以折叠 OpenAI 设置区，其状态独立于预设保存。导出预设会包含折叠设置；导入时如果有设置则会加载。
- **重置所有设置** 会将当前预设的折叠设置恢复为默认值。

## 安装

1. 在 SillyTavern 的 **扩展程序** 标签页中，选择 **安装扩展程序**，输入 `https://github.com/iiimabbie/ST-PromptFolding` 安装。
2. 保持扩展文件夹名为 `ST-PromptFolding`，并启用 **Prompt Folding**。
3. 打开 OpenAI／Chat Completion 提示词管理器，扩展会在此运行。
