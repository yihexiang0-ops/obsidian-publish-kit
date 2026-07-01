# Obsidian Publish Kit

Obsidian Publish Kit 现在聚焦一个主流程：把当前 Obsidian 笔记整理成更接近可直接发布的小红书内容包。

`0.2.0` 版本重点解决三件事：

- 尽量保留原始 Markdown 结构
- 正确识别本地图片嵌入和 Markdown 图片
- 导出小红书正文、配图资源和卡片图

英文文档：[README.md](./README.md)

## 导出内容

针对当前笔记，插件会导出：

- `caption.md`
- `publish.json`
- `assets/`：识别成功的本地原图
- `cards/`：生成好的小红书卡片图

## 当前范围

这一版是小红书优先版本。

- 微信、知乎、X 暂时从主流程中下线
- 不登录平台
- 不上传图片
- 不自动发布

## 安装

### BRAT

把这个仓库作为 beta plugin 添加：

```text
https://github.com/yihexiang0-ops/obsidian-publish-kit
```

### 手动安装

从 GitHub Release 下载 `manifest.json`、`main.js`、`styles.css`，放到：

```text
<vault>/.obsidian/plugins/obsidian-publish-kit/
```

然后在社区插件中启用 `Obsidian Publish Kit`。

## 使用

打开一篇 Markdown 笔记后，运行：

```text
Publish Kit: Prepare current note for Xiaohongshu
```

工作台会显示：

- caption 预览
- 卡片渲染预览
- 已生成的卡片图
- 原文结构
- 图片资源列表
- 渲染问题列表

## 开发

```bash
npm install
npm run lint
npm run build
```

Windows PowerShell 如果被 `npm.ps1` 拦截，请使用：

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run build
```

## 发布

更新 `manifest.json` 和 `versions.json`，打 tag 并推送。GitHub Actions 会把 `manifest.json`、`main.js`、`styles.css` 附加到 Release。

## 许可证

MIT

