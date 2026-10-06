# dsh-plugin-manager-plus 交接文档

> **交接日期**: 2026-10-07
> **插件版本**: 1.3.4
> **适配 DSH 版本**: 0.1.7-rc.1（当前）→ 0.2.0-rc.2（升级目标，已兼容）
> **源码位置**: `C:\Users\lcl\Desktop\DSH插件开发\dsh-plugin-manager-plus`
> **npm**: https://www.npmjs.com/package/dsh-plugin-manager-plus
> **GitHub**: https://github.com/new-256/dsh-plugin-manager

---

## 一、这个插件是什么

DSH 的插件管理器与社区插件市场，在设置面板内提供：

| 能力 | 作用 |
|---|---|
| 社区插件市场 | npm 搜索插件，一键安装 |
| 已安装插件管理 | 按来源/用途/状态三维筛选 |
| 启停热重载 | 运行中启用/停用插件（patchReload: live） |
| 一键卸载 | 移除插件并持久化 |

---

## 二、运行/加载机制

1. profile `package.json` → `dsh.profile.bundles` 环境
2. 入口（`main`）：`lib/index.mjs`
3. 经 `cordis.patch.yml` 注册，挂载到设置面板（Client 面 Slot）
4. 安装脚本 `install.ps1` 用于初始化；日常经 `dsh plugin --profile web add` 安装

---

## 三、0.2.0 兼容性

| 检查项 | 结论 |
|---|---|
| peerDependencies | **无声明** → 0.2.0 强制校验通过，**无需 version-exemption** |
| 金标准验证 | 本插件作为管理工具不直接参与 0.2.0 bundle 启动链；无 peer 声明即不受拦截 |
| 功能联动 | 负责管理其它插件的豁免/启停，0.2.0 的 version-exemption 机制可由此操作 |

---

## 四、构建 / 测试 / 发布

- 无独立编译步骤（`lib/index.mjs`）
- **发布流程**：
  ```bash
  # 改代码 → bump version → git commit + tag
  git tag vX.Y.Z && git push --tags
  npm publish --registry=https://registry.npmjs.org
  ```
- npm 2FA：用勾选 "Bypass 2FA" 的 Granular Token，或 `--otp=xxxxxx`

---

## 五、接手注意事项

1. 这是管理其它插件的核心工具，改动启停/安装逻辑需谨慎，避免误删用户插件。
2. `README-archive.md` 是历史归档说明，当前以 `README.md` 为准。
3. 插件安装走 npm registry；网络/registry 配置影响市场可用性。
4. 相关文档：`README.md`、`README-archive.md`。
