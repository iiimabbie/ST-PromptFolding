# SillyTavern 提示詞分組（可摺疊）擴充功能

將提示詞管理器中的項目，透過簡單的「標頭標記」分組為可摺疊區塊，讓清單更整齊、瀏覽更高效。

## 功能

- 在提示詞名稱開頭加入標記（例如：`=標題`、`--- 工具`）即可建立群組。
- 標記所在的項目會成為可摺疊的群組標題，其後的項目自動歸入該群組。
- 一鍵「全部展開 / 全部收合」。
- 可即時開關「分組」功能。
- 可自訂標頭標記與是否區分大小寫（設定會保存在 localStorage）。
- 輕量、零相依；樣式由 `collapsible-prompt.css` 提供。

## 使用方式

- 建立一個以標頭標記開頭的提示詞名稱。
  - 範例：`= 工具` 會建立名為「工具」的群組。
  - 在下一個標頭出現之前的提示詞都會歸屬於該群組。
- 在提示詞管理器的標題列，可點擊按鈕來全部展開、全部收合、開啟設定或切換是否啟用分組。
- 打開設定面板可自訂標記（每行一個）及是否區分大小寫。

## 安裝

1. 複製儲存庫連結：`https://github.com/iiimabbie/ST-PromptFolding`
2. 在 SillyTavern 介面中開啟【Extensions】分頁。
3. 點擊右上角【Install Extension】。
4. 在跳出的視窗中，將儲存庫連結貼到第一個輸入框。
5. 點擊 **Install for all users** 或 **Install just for me**。
6. 安裝完成後，前往【Manage Extensions】。
7. 找到 **Prompt Folding** 並確保已啟用。

## 授權

本專案依 [LICENSE](LICENSE) 條款授權。

---

[English](README.md)
