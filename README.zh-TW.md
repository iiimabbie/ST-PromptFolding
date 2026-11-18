<div align="center">

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md)

# Prompt Folding

**把 SillyTavern 提示詞管理器整理成可摺疊群組**

這個 SillyTavern 擴充功能能將 OpenAI／Chat Completion 的提示詞管理器整理成可摺疊群組。停用群組標題後，組內可開關的提示詞會從提示詞清單中排除。

![Version](https://img.shields.io/github/manifest-json/v/iiimabbie/ST-PromptFolding?label=version&color=8a5cf6)
![SillyTavern](https://img.shields.io/badge/SillyTavern-extension-e8a87c)
![i18n](https://img.shields.io/badge/i18n-繁中%20·%20简中%20·%20EN-2ea44f)
![License](https://img.shields.io/badge/license-CC%20BY--NC--ND%204.0-lightgrey)

[功能](#功能) · [摺疊模式](#摺疊模式) · [使用方式](#使用方式) · [安裝](#安裝)

</div>

> [!NOTE]
> 介面語言會跟隨 SillyTavern 的語言設定。

## 功能

- 手動選擇標題，或使用自訂標示符號依名稱分組。
- 個別展開、收合群組，或一次展開、收合全部群組。
- 在預設設定檔之間複製摺疊設定，並隨預設設定檔一同匯出。

## 摺疊模式

### 手動選擇
在 **分組設定**（⚙️）中選擇 **手動選擇模式**，按 **開始選擇資料夾**，勾選要當標題的提示詞，再用綠色勾勾確認或紅色 × 取消。每個標題會收進後續提示詞，直到下一個標題為止。

### 標準模式
在 **舊版模式** 中選擇 **標準模式**。名稱以指定符號開頭的提示詞會成為標題；預設符號是 `=` 和 `-`。修改 **分組標示符號（一行一個）** 後，按勾勾套用。

### 包覆模式
在 **舊版模式** 中選擇 **包覆模式**。每個標題會與下一個標題配對，中間的項目與結尾標題都屬於該群組；兩個標題的名稱不必相同。

```text
= 開始
攻擊／防禦
- 結束
```

## 使用方式

- 點群組箭頭或標題名稱即可展開、收合；點標題名稱不會開啟編輯器。
- 工具列的 **展開所有**、**收合所有** 會控制全部群組。**🟢／🔴** 切換分組與群組過濾功能；**⚙️** 開啟設定。
- 停用標題後，組內所有 SillyTavern 允許開關的子項都視為關閉，例如可開關的角色描述與世界書；子項本身的開關不會被改動。重建分組時會套用停用樣式。
- 在 **從其他預設設定檔複製配置** 中選擇來源並按 **複製**。手動標題依 UUID 配對，無法配對的標題會被捨棄。
- **折設定** 可收合 OpenAI 設定區，其狀態獨立於預設設定檔儲存。匯出預設設定檔會包含摺疊設定；匯入時若有設定則會載入。
- **重設所有設定** 會將目前預設設定檔的摺疊設定恢復預設值。

## 安裝

1. 在 SillyTavern 的 **擴充功能** 分頁中，選擇 **安裝擴充功能**，輸入 `https://github.com/iiimabbie/ST-PromptFolding` 安裝。
2. 保持擴充功能資料夾名稱為 `ST-PromptFolding`，並啟用 **Prompt Folding**。
3. 開啟 OpenAI／Chat Completion 提示詞管理器，擴充功能會在此運作。
