# Obsidian Publish Kit

Obsidian Publish Kit formats the active Markdown note into semi-automated publishing drafts for WeChat Official Account, Xiaohongshu, Zhihu, and X.

The first release focuses on safe local formatting:

- no platform login
- no API publishing
- no image hosting upload
- no token storage
- no AI rewriting

It reads the current note, resolves local image references inside the vault, and generates platform-specific previews, copy buttons, export files, image checklists, and posting checklists.

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md)

## Features

- Command: `Publish Kit: Format current note for platforms`
- Ribbon button for quick access
- WeChat: clean inline HTML for rich-text copy
- Xiaohongshu: 3:4 card plan, caption, hashtags, and image checklist
- Zhihu: conservative Markdown and rich-text preview
- X: thread draft split with weighted character counting
- Export to `exports/<note-name>/` inside the vault
- Local image asset export to `exports/<note-name>/assets/`

## Install From GitHub

### BRAT

1. Install the BRAT plugin in Obsidian.
2. Add this repository URL as a beta plugin.
3. Enable `Obsidian Publish Kit`.

### Manual Install

1. Download `manifest.json`, `main.js`, and `styles.css` from a GitHub Release.
2. Put them in:

   ```text
   <vault>/.obsidian/plugins/obsidian-publish-kit/
   ```

3. Reload Obsidian and enable the plugin.

## Platform Notes

- WeChat: the plugin produces copyable HTML with inline styles. Local images still need to be pasted or uploaded in the WeChat editor.
- Xiaohongshu: the plugin creates a visual card plan and caption draft. It does not post to Xiaohongshu.
- Zhihu: the plugin keeps Markdown conservative because editor behavior can vary.
- X: URLs are counted as 23 weighted characters and media placeholders count as zero in the thread splitter.

## Development

```bash
npm install
npm run lint
npm run build
```

On Windows PowerShell, use `npm.cmd` if `npm.ps1` is blocked by execution policy:

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run build
```

## Release

1. Update `manifest.json` and `versions.json`.
2. Commit changes.
3. Tag a version, for example `1.0.0`.
4. Push the tag.
5. GitHub Actions attaches `manifest.json`, `main.js`, and `styles.css` to the release.

## Privacy

All formatting runs locally inside Obsidian. The plugin does not send note content, images, tokens, cookies, or account data to any remote service.

## License

MIT

