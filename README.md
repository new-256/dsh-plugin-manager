# dsh-plugin-manager · DSH 插件管理器

[English](#english) | 中文

DeepSeek Harness (DSH) Desktop 宿主插件：把「插件市场」与「插件管理」装进 Web GUI 的 **设置 → 插件** 面板 —— 搜索并一键安装 npm 社区插件，启停/卸载已安装插件（含你自研的），所有变更持久化、热生效。

零 npm 依赖 · 纯 Node 内置模块 + 原生 React · 中文/英文双语界面

---

## ✨ 功能

### 🛒 插件市场（标签页）

- 实时检索 npm 上的 DSH 社区插件（npmmirror 主源 + npmjs 兜底，大陆网络友好）
- 展示包名 / 版本 / 描述 / 发布日期，已安装的包自动标记
- 一键安装：`dsh plugin --profile web add`（pnpm 官方路径，npm 兜底）→ 自动在家级补丁层登记 → **watchUserPatches 热重载，无需重启后端**

### 🗂 插件管理（标签页）

聚合 Cordis Loader 运行时与家级补丁账本（`$DSH_HOME/cordis.patch.yml`），**三维度筛选 + 搜索交集过滤**：

| 维度 | 选项 |
|---|---|
| **来源** | 全部 · 社区插件（npm 安装）· 核心插件（官方 bundle）· 用户插件（自研 file:///junction） |
| **用途** | 全部 · 编程开发 · 会话聊天 · 模型智能 · 界面增强 · 网络接入 · 系统底层 · 其他（规则引擎自动归类） |
| **状态** | 全部 · 已启用 · 已停用 |

每张卡片：模块短名 / Loader entry id / 挂载状态点（绿=已挂载，红=失败，灰=未挂载）/ 来源标签，以及——

- **启用 / 停用**：写入家级补丁层的 `disabled`（内置行自动生成覆盖块），热重载即时生效
- **卸载**（仅用户层插件）：
  - npm 社区插件 → 删补丁行 + `pnpm remove`
  - 自研 junction 插件 → 删补丁行 + 清理三处 junction
  - 本地 `file://` 插件 → 仅删补丁行（源码保留）
  - 官方内置插件受保护，只能停用

### 🛡 安全

- **Loopback 校验**：仅 127.0.0.1 / ::1 可访问 API
- **Host 端口比对** + **CSRF 防护**（Sec-Fetch-Site / Origin）
- 补丁文件编辑 **fail-safe**：块级文本操作保留全部注释与格式，解析失败绝不落盘；每次写入前滚动备份 `cordis.patch.yml.bak-pm`
- 安装/卸载任务**串行队列**，带超时与进程清理

---

## 📦 安装

### 方式一：git clone + 接线脚本（推荐）

```powershell
git clone https://github.com/new-256/dsh-plugin-manager.git
cd dsh-plugin-manager
pwsh -File install.ps1
```

脚本会：① 建立三处 junction（`$DSH_HOME/node_modules`、`$DSH_HOME/profiles/node_modules`、`$DSH_HOME/profiles/web/node_modules`）；② 打印需要追加到家级补丁层 `$DSH_HOME\cordis.patch.yml` 的行（含按本机路径生成的 `file://` URL）。

### 方式二：从其他插件市场安装

在 DSH 的任意插件市场里搜索 `dsh-plugin-manager` 安装。

### 生效

- 家级补丁层写入并保存后，dsh 后端的 `watchUserPatches` 会自动热重载（约几秒）
- 浏览器**刷新页面**后即可在「设置 → 插件」看到「插件管理」「插件市场」两个新标签页

---

## 🧩 包结构

```
dsh-plugin-manager/
├── package.json          # dsh.client 声明 + exports（浏览器花名册入口）
├── lib/
│   ├── index.mjs         # 宿主半：API 路由、分类引擎、补丁编辑器、任务队列
│   ├── client.js         # 浏览器半：插件管理/插件市场两个 settings.plugins.tab
│   └── client-entry.mjs  # 空操作占位（防止双行名加载两份实例）
├── install.ps1           # 幂等接线脚本（junction 三处 + 补丁行检查）
└── README.md
```

**宿主半 API**（`/plugin-manager/api/*`，前缀路由挂载于 webServer）：
`version` · `status` · `inventory`（含 category/funcCategory/enabled）· `search` · `install` · `toggle` · `uninstall`

**接线原理**：家级补丁层（`$DSH_HOME/cordis.patch.yml`）是 dsh 原生的、对所有 profile 生效的最高用户层——两条行：host 行用 `file://` URL 指向 `lib/index.mjs?v=N`，client 行用裸包名（宿主 client-modules 扫描 `package.json` 的 `dsh.client` 声明把 `lib/client.js` 纳入浏览器花名册，经 `/plugins/dsh-plugin-manager/client.js` 分发）。

---

## 🔧 开发与热更新

- 改 `lib/client.js` → **刷新浏览器**即生效（client bundle rev 自动变化）
- 改 `lib/index.mjs` → 把补丁行里的 `?v=N` **bump 一次**（绕过 ESM 模块缓存），或重启 DSH Desktop
- profiles 目录被 DSH Desktop 隔离重建后 junction 会丢 → 重跑 `install.ps1`
- 用途分类规则在 `lib/index.mjs` 顶部的 `FUNC_RULES`（官方包前缀表）与 `COMMUNITY_FUNC_RULES`（社区包关键词表），可自行增删

## ⚠️ 安全须知

插件以宿主完整权限运行。本管理器只做了安装来源的便利性，**不会**审计第三方插件代码——安装社区插件前请自行确认信任度（同手动 `dsh plugin add` 的信任模型）。

---

## English

A DeepSeek Harness (DSH) Desktop host plugin that puts a **Plugin Marketplace** and a **Plugin Manager** into the Web GUI's *Settings → Plugins* panel: search & one-click-install community plugins from npm, toggle/uninstall installed plugins (including your own), with all changes persisted and hot-reloaded.

- **Market tab**: live npm search (npmmirror + npmjs fallback), one-click install via the official `dsh plugin add` path, auto-registered into the home-level patch layer, hot-reloaded without backend restart.
- **Manager tab**: three filter dimensions (source: community/core/user · function: coding/chat/models/UI/network/infra/other · status: enabled/disabled) + search; per-plugin mount state, hot enable/disable, and categorized uninstall (npm package / junction / local file; core rows are protected).
- **Security**: loopback-only API, host-port & CSRF checks, fail-safe comment-preserving patch editor with rolling backup, serialized task queue.
- Zero npm dependencies; bilingual UI (zh/en).

Install: `git clone` + `pwsh -File install.ps1` (creates the three junctions and prints the patch rows to append to `$DSH_HOME\cordis.patch.yml`), then refresh the browser.

License: MIT
