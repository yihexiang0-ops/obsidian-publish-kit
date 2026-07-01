# Obsidian Publish Kit

Obsidian Publish Kit prepares the active note as a Xiaohongshu-ready package.

Version `0.2.0` focuses on one workflow only:

- preserve the original Obsidian markdown structure
- resolve local image embeds and markdown images
- render Xiaohongshu card previews from the note
- export a publish package with caption, assets, card images, and manifest

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md)

## What It Exports

For the active note, the plugin creates:

- `caption.md`
- `publish.json`
- `assets/` for resolved local source images
- `cards/` for generated Xiaohongshu card images

## Current Scope

This version is Xiaohongshu-first.

- WeChat, Zhihu, and X are intentionally removed from the main workflow for now.
- The plugin does not log in to any platform.
- The plugin does not upload images.
- The plugin does not publish automatically.

## Install

### BRAT

Add this repository as a beta plugin:

```text
https://github.com/yihexiang0-ops/obsidian-publish-kit
```

### Manual

Download `manifest.json`, `main.js`, and `styles.css` from a GitHub release and place them in:

```text
<vault>/.obsidian/plugins/obsidian-publish-kit/
```

Then enable `Obsidian Publish Kit` in Community Plugins.

## Usage

Open a markdown note and run:

```text
Publish Kit: Prepare current note for Xiaohongshu
```

The workspace shows:

- caption preview
- rendered card preview
- generated card images
- original structure
- asset list
- rendering issues

## Development

```bash
npm install
npm run lint
npm run build
```

On Windows PowerShell, use `npm.cmd` if `npm.ps1` is blocked:

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run build
```

## Release

Update `manifest.json` and `versions.json`, create a tag, and push it. GitHub Actions attaches `manifest.json`, `main.js`, and `styles.css` to the release.

## License

MIT

