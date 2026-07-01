# Obsidian Publish Kit

Obsidian Publish Kit 是一个 Obsidian 插件，用来把当前 Markdown 笔记半自动排版成微信公众号、小红书、知乎、X 适合发布的草稿。

第一版只做安全的本地排版：

- 不登录平台
- 不调用平台发布 API
- 不上传图床
- 不保存 token
- 不做 AI 改写

插件会读取当前笔记，解析 vault 内本地图片，生成各平台预览、复制按钮、导出文件、图片清单和发布检查清单。

英文文档：[README.md](./README.md)

## 功能

- 命令：`Publish Kit: Format current note for platforms`
- 左侧 Ribbon 快捷按钮
- 微信公众号：生成简约内联样式 HTML，便于复制到编辑器
- 小红书：生成 3:4 图文卡片方案、正文 caption、话题标签和图片清单
- 知乎：生成保守 Markdown 和富文本预览
- X：按加权字符数拆分 thread 草稿
- 导出到 vault 内 `exports/<note-name>/`
- 本地图片复制到 `exports/<note-name>/assets/`

## 通过 GitHub 安装

### 使用 BRAT

1. 在 Obsidian 安装 BRAT 插件。
2. 把本仓库 URL 添加为 beta plugin。
3. 启用 `Obsidian Publish Kit`。

### 手动安装

1. 从 GitHub Release 下载 `manifest.json`、`main.js`、`styles.css`。
2. 放入：

   ```text
   <vault>/.obsidian/plugins/obsidian-publish-kit/
   ```

3. 重启 Obsidian 或刷新插件列表，然后启用插件。

## 平台说明

- 微信公众号：插件生成可复制 HTML 和内联样式；本地图片仍需在公众号编辑器中粘贴或上传。
- 小红书：插件生成卡片拆分方案和 caption 草稿；不自动发帖。
- 知乎：插件尽量保留 Markdown 结构，减少复杂样式，避免编辑器兼容问题。
- X：URL 按 23 个加权字符计算，图片占位不计入 thread 分段。

## 开发

```bash
npm install
npm run lint
npm run build
```

Windows PowerShell 如果因为执行策略拦截 `npm.ps1`，请使用：

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run build
```

## 发布

1. 更新 `manifest.json` 和 `versions.json`。
2. 提交代码。
3. 打版本标签，例如 `1.0.0`。
4. 推送 tag。
5. GitHub Actions 会把 `manifest.json`、`main.js`、`styles.css` 附加到 Release。

## 隐私

所有排版都在 Obsidian 本地运行。插件不会把笔记、图片、token、cookie 或账号数据发送到远程服务。

## 许可证

MIT

