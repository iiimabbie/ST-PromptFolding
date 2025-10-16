# Prompt Folding for SillyTavern

An extension that groups prompts in the Prompt Manager into collapsible sections using simple header markers. Keeps your prompt list tidy and easier to navigate.

## Features

- Group prompts by adding a header marker at the beginning of a prompt name (e.g., `=Title`, `--- Utilities`).
- Each header becomes a collapsible section; items below it are grouped inside.
- Expand/Collapse all groups with one click.
- Enable/Disable grouping instantly.
- Customizable header markers and case sensitivity (persisted in localStorage).
- Lightweight and dependency-free. Styles provided by `collapsible-prompt.css`.

## Usage

- Create a prompt with a name that starts with one of your header markers.
  - Example: `= Tools` will create a group named `Tools`.
  - All following prompts until the next header belong to that group.
- Click the buttons in the Prompt Manager header to Expand All, Collapse All, open Settings, or toggle grouping.
- Open Settings to configure header markers (one per line) and whether matching is case-sensitive.

## Installation

1. Copy the repository URL: `https://github.com/iiimabbie/ST-PromptFolding`
2. In SillyTavern, open the **Extensions** tab.
3. Click **Install Extension** (top-right).
4. Paste the repository URL into the first input field.
5. Click either **Install for all users** or **Install just for me**.
6. After installation, go to **Manage Extensions**.
7. Find **Prompt Folding** and ensure it is enabled.

## License

This project is licensed under the terms of the [LICENSE](LICENSE) file.

---

[中文 (繁體)](README.zh-TW.md)
