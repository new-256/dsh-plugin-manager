# dsh-plugin-manager-plus · DSH 插件管理器

[English](#english) | 中文

DeepSeek Harness (DSH) Desktop 宿主插件：把「插件市场」与「插件管理」装进 Web GUI 的 **设置 → 插件** 面板 —— 搜索并一键安装 npm 社区插件，启停/卸载已安装插件（含你自研的），所有变更持久化、热生效。

零 npm 依赖 · 纯 Node 内置模块 + 原生 React · 中文/英文双语界面

## 📐 适配版本

| 项 | 值 |
|---|---|
| DSH CLI（`@deepseek-ai/dsh`） | `>=0.1.1-rc.2`（声明于 `peerDependencies` 与 `dsh.compatibility`） |
| 实测通过 | `0.1.1-rc.2`、`0.1.2-alpha.5`、`0.1.3-alpha.2` |
| DSH Desktop | `>=0.3.15`（实测 0.3.15） |
| Node | `>=20`（`engines`） |

- **标准分发形态（npm）**：patch 层只需**一条裸包名行** —— 包 `main`（`lib/index.mjs`）加载宿主半，`dsh.client` 声明让 client-modules 自动把 `lib/client.js` 纳入浏览器花名册（combo URL 分发）；再写一条裸包名 client 行反而会触发「同包双 Loader 源」组合错误（DSH 0.1.2-alpha.x 起）。
- **DSH 0.1.1-rc.x（旧版）**：除 host 行外还需第二条裸包名 client 行（旧版靠 `require.resolve` 扫描花名册）。
- 安装后包内 `cordis.patch.yml`（`dsh.bundle.patch`）自动挂载为 profile 的 bundle 层。
- `GET /plugin-manager/api/version` 同时上报插件版本、宿主 DSH 版本与兼容性声明，便于核对。

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

### 🩺 开机自检守卫（v1.3.4）

防御两类真实事故，开机自动巡检，发现问题在「插件管理」页顶部弹告警横幅，提供**一键恢复**：

1. **`profiles/web/pnpm-workspace.yaml` 缺失**：桌面壳后端崩溃会隔离重建 profiles，该文件（`nodeLinker: hoisted` / `autoInstallPeers: false`）随之丢失，pnpm 退回默认强制解析 peerDeps，撞上 npm dist-tag 陷阱后**任何插件都装不上**（`ERR_PNPM_NO_MATCHING_VERSION`）。守卫补回标准内容。
2. **家级补丁插件行丢失**：桌面壳的隔离轮测可能把【已经残缺的补丁】当基线快照保存再恢复，导致激活行阶梯式永久消失。

守卫的关键设计：

- **基线只在健康时保存，检测到丢失绝不降级**——这正是桌面壳自带快照失效的根因。首次健康启动时播种基线，之后只在插件数增长或管理器自身安装/卸载后刷新。
- **区分事故丢失与正常卸载**：基线里有、当前缺失的行，只有当其加载物料（`file://` 脚本 / 裸包名包目录 / MCP server 脚本）仍在时才告警；物料已删则静默从基线剔除。
- **骤降判级**：当前健康插件数 ≤ 基线一半时标为「严重」（红），否则「警告」（琥珀色）。
- **恢复只合并不覆盖**：把缺失块从历史快照（`plugins-store/guard/guard-snapshots/`，轮转留 8 份）或基线追加到补丁末尾，恢复前自动备份 `cordis.patch.yml.bak-guard-<时间戳>`，绝不重复加入仍存在的 id，并跑一次 `dsh --dump-config` 软校验。
- 守卫状态全部存放在 `$DSH_HOME/plugins-store/guard/`（家级，**不随 profiles 隔离丢失**）。
- API：`GET /plugin-manager/api/guard/status`、`POST /plugin-manager/api/guard/restore`、`POST /plugin-manager/api/guard/dismiss`。
- 恢复的是 host 组合，**需正常退出 DSH Desktop 再打开生效，切勿强杀进程**。

### 🛡 安全

- **Loopback 校验**：仅 127.0.0.1 / ::1 可访问 API
- **Host 端口比对** + **CSRF 防护**（Sec-Fetch-Site / Origin）
- 补丁文件编辑 **fail-safe**：块级文本操作保留全部注释与格式，解析失败绝不落盘；每次写入前滚动备份 `cordis.patch.yml.bak-pm`
- 补丁写入带 **mtime 乐观锁**：与其他会话/手工编辑并发冲突时自动重读重试（3 次），多次冲突才报错，不覆盖他人修改
- 安装/卸载任务**串行队列**，带超时与进程清理
- UI 层防自锁：停用插件管理器自身前强警告（停用后需手改补丁文件恢复）

---

## 📦 安装

### 方式一：npm 标准安装（推荐）

插件已发布到 npm，用 DSH 官方插件命令直接安装（转发 pnpm，跨设备可重复）：

```powershell
dsh plugin --profile web add dsh-plugin-manager-plus
```

安装后包内 `cordis.patch.yml`（`dsh.bundle.patch`）自动作为 profile 的 bundle 层挂载通用默认行（host 半裸包名解析，client 半自动进浏览器花名册），刷新浏览器即可在「设置 → 插件」看到两个新标签页。**无需任何手动接线**。

> 需要手动写家级补丁行时（如为了用户层覆写/持久化），追加：
> ```yaml
> - insert:
>     - id: plugin-manager
>       name: dsh-plugin-manager-plus
> ```

**bundle 形态插件（自带 `dsh.bundle.patch` 的包）**：v1.3.1 起自动识别——安装时**不再**写入家级插入行（bundle 层已由官方 CLI 自动挂载，再写一条会触发同包双 Loader 源致命错误），只记录到 manifest 供 UI 管理。此类插件在「插件管理」中显示为社区来源、可启停/卸载，其激活行随包安装/卸载自动存在/消失。

### 方式二：git clone + 接线脚本（本地开发）

```powershell
git clone https://github.com/new-256/dsh-plugin-manager.git
cd dsh-plugin-manager
pwsh -File install.ps1
```

脚本会：① 建立三处 junction（`$DSH_HOME/node_modules`、`$DSH_HOME/profiles/node_modules`、`$DSH_HOME/profiles/web/node_modules`）；② 检查/提示家级补丁层 `$DSH_HOME\cordis.patch.yml` 的裸包名行。

### 方式三：从其他插件市场安装

在 DSH 的任意插件市场里搜索 `dsh-plugin-manager-plus` 安装（npmmirror 已同步）。

### 生效

- 家级补丁层写入并保存后，dsh 后端的 `watchUserPatches` 会自动热重载（约几秒）
- 浏览器**刷新页面**后即可在「设置 → 插件」看到「插件管理」「插件市场」两个新标签页

---

## 🧩 包结构

```
dsh-plugin-manager/
├── package.json          # dsh.client 声明（花名册入口）+ dsh.bundle.patch + exports
├── cordis.patch.yml      # bundle 补丁层（安装后自动挂载通用默认行）
├── lib/
│   ├── index.mjs         # 宿主半：API 路由、分类引擎、补丁编辑器、任务队列（package main）
│   └── client.js         # 浏览器半：插件管理/插件市场两个 settings.plugins.tab
├── install.ps1           # 本地开发接线脚本（junction 三处 + 补丁行检查）
└── README.md
```

**宿主半 API**（`/plugin-manager/api/*`，前缀路由挂载于 webServer）：
`version`（含插件版本/宿主 DSH 版本/兼容性声明）· `status` · `inventory`（含 category/funcCategory/enabled）· `search` · `install` · `toggle` · `uninstall`

**接线原理（标准形态）**：patch 层只需**一条裸包名行** `name: dsh-plugin-manager-plus` —— loader 按包 `main`（`lib/index.mjs`）加载宿主半；client 半靠 `package.json` 的 `dsh.client` 声明被宿主 client-modules 自动纳入浏览器花名册（combo URL 分发），无需单独一行。包内 `cordis.patch.yml` 经 `dsh.bundle.patch` 在安装后自动挂载为 profile 的 bundle 层。

---

## 🔧 开发与热更新

- 改 `lib/client.js` → **刷新浏览器**即生效（client bundle rev 自动变化）
- 改 `lib/index.mjs` → **重启 DSH Desktop** 生效；或临时把补丁行 `name` 改成 `dsh-plugin-manager-plus?v=N` 触发热重载（N 递增），验证后改回
- profiles 目录被 DSH Desktop 隔离重建后 junction 会丢 → 重跑 `install.ps1`
- 用途分类规则在 `lib/index.mjs` 顶部的 `FUNC_RULES`（官方包前缀表）与 `COMMUNITY_FUNC_RULES`（社区包关键词表），可自行增删

## ⚠️ 安全须知

插件以宿主完整权限运行。本管理器只做了安装来源的便利性，**不会**审计第三方插件代码——安装社区插件前请自行确认信任度（同手动 `dsh plugin add` 的信任模型）。

---

## English

A DeepSeek Harness (DSH) Desktop host plugin that puts a **Plugin Marketplace** and a **Plugin Manager** into the Web GUI's *Settings → Plugins* panel: search & one-click-install community plugins from npm, toggle/uninstall installed plugins (including your own), with all changes persisted and hot-reloaded.

- **Market tab**: live npm search (npmmirror + npmjs fallback), one-click install via the official `dsh plugin add` path, auto-registered into the home-level patch layer, hot-reloaded without backend restart.
- **Manager tab**: three filter dimensions (source: community/core/user · function: coding/chat/models/UI/network/infra/other · status: enabled/disabled) + search; per-plugin mount state, hot enable/disable, and categorized uninstall (npm package / junction / local file; core rows are protected).
- **Security**: loopback-only API, host-port & CSRF checks, fail-safe comment-preserving patch editor with rolling backup and mtime optimistic locking (auto re-read/retry on concurrent writers), serialized task queue.
- Zero npm dependencies; bilingual UI (zh/en).

Compatibility: DSH `>=0.1.1-rc.2` (declared in `peerDependencies` and `dsh.compatibility`; tested on `0.1.1-rc.2`, `0.1.2-alpha.5` and `0.1.3-alpha.2`, DSH Desktop 0.3.15, Node >= 20). Standard npm distribution: **one bare-package patch row** — the loader resolves the package `main` (`lib/index.mjs`) for the host half, and client-modules picks up `lib/client.js` from the `dsh.client` declaration automatically (combo-URL roster); a second bare-package client row is a composition error on DSH `0.1.2-alpha.x+`. The in-package `cordis.patch.yml` is mounted automatically as the profile's bundle layer via `dsh.bundle.patch`.

Install: `dsh plugin --profile web add dsh-plugin-manager-plus` (npm), or `git clone` + `pwsh -File install.ps1` for local development (creates the three junctions and checks the bare-package row in `$DSH_HOME\cordis.patch.yml`), then refresh the browser.

License: MIT
