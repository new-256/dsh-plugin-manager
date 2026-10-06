# dsh-plugin-manager-plus —— DSH 插件管理器增强（开发档案）

> 本目录为**开发记录档案**（补建于 2026-10 盘点）。
> 插件包存在于本机 node_modules，但**未声明为 profile 依赖、当前未加载**（疑似历史安装残留或待启用状态）。

## 基本信息

| 项 | 值 |
|---|---|
| 包名 | `dsh-plugin-manager-plus` |
| 版本 | 1.3.4 |
| 许可证 | MIT |
| 安装位置 | `%APPDATA%\DSH Desktop\dsh-home\profiles\web\node_modules\dsh-plugin-manager-plus` |
| 加载状态 | ⚠️ **未加载**：不在 profile `package.json` 的 dependencies/bundles 中，插件列表无对应 row |
| 入口 | `./lib/index.mjs` |

## 功能

DeepSeek Harness (DSH) 插件管理器增强：

- 设置面板内的**社区插件市场**（npm 搜索一键安装）
- 已安装插件管理：来源/用途/状态三维筛选
- 启停热重载、一键卸载、持久化

## 备注

- 与官方 `@deepseek-ai/dsh-plugin-manager`（插件管理工具）不同：本包是社区市场增强版，官方工具仍正常加载。
- 由于未在 profile 声明，`pnpm install` 重新安装依赖时可能被清理；如需使用，应加入 profile `package.json` 的 `dependencies` 或 `dsh.profile.bundles`。
- 本档案保留其用途说明，避免日后被误当垃圾清理。
