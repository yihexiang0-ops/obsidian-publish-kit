# Research Notes

## Obsidian Plugin Distribution

- The implementation follows the official Obsidian sample plugin shape: `manifest.json`, bundled `main.js`, and `styles.css`.
- GitHub Release assets should include `manifest.json`, `main.js`, and `styles.css`.
- BRAT can install beta plugins from a GitHub repository, so the first public distribution path can use GitHub before community plugin submission.

## Mature Markdown Formatting Projects

- `obsidianmd/obsidian-sample-plugin` is used as the structural reference for the plugin skeleton.
- `doocs/md` is a mature Markdown-to-WeChat style editor. It is useful as a product and style reference, but the first version here does not copy its web application code.
- `mdnice/markdown-nice` is useful as a WeChat/Zhihu formatting reference, but its GPL-3.0 license makes direct source reuse inappropriate for this MIT plugin unless the project intentionally adopts GPL-compatible licensing later.

## Platform Defaults

- WeChat Official Account: generate inline HTML for editor paste. Local images remain user-managed because upload and platform media URLs require authenticated platform workflows.
- Xiaohongshu: generate a 3:4 card plan, caption, hashtags, and image checklist. The plugin does not automate posting.
- Zhihu: keep Markdown conservative and avoid complex CSS to reduce editor incompatibility.
- X: split drafts by weighted character count. URLs are treated as 23 weighted characters and media placeholders as 0.

