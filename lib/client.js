/**
 * @file lib/client.js
 * @description DeepSeek Harness (DSH) 插件管理器 (dsh-plugin-manager-plus) 浏览器半边。
 *              在「设置 → 插件」分区分别注册「插件管理」与「插件市场」两个独立标签页。
 *              插件管理支持来源维度与用途维度的胶囊筛选、实时搜索与启停/卸载；
 *              插件市场支持 npm 社区插件搜索与一键安装。
 */

window.__ModuleLoader__.load({
  id: "dsh-plugin-manager-plus",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const react = require("react");
    const { jsx: _jsx, jsxs: _jsxs } = require("react/jsx-runtime");

    const NS = "pluginManager";

    /** 多语言词典 */
    const zh = {
      "tab.manager": "插件管理",
      "tab.market": "插件市场",
      "installedSection": "已安装插件",
      "marketSection": "社区插件市场",
      "searchInstalled": "搜索已安装插件名称或 ID...",
      "searchMarket": "搜索 npm 社区插件 (如: deepseek, bot, proxy)...",
      "searchBtn": "搜索",
      "installedTag": "已安装",
      "installBtn": "安装",
      "installing": "正在安装...",
      "uninstallBtn": "卸载",
      "uninstalling": "正在卸载...",
      "enableBtn": "启用",
      "disableBtn": "停用",
      "enabledTag": "已启用",
      "disabledTag": "已停用",
      "sourceHome": "用户安装",
      "sourceBuiltin": "官方内置",
      "loading": "正在读取数据...",
      "emptyInstalled": "暂无已安装插件",
      "emptyFiltered": "未找到匹配条件的插件",
      "emptyMarket": "未找到相关社区插件",
      "errorPrefix": "请求失败: ",
      "retry": "重试",
      "refresh": "刷新",
      "confirmInstall": "将安装插件「{name}」并获得宿主完整权限，确认安装？",
      "confirmUninstall": "确定要卸载插件「{name}」吗？",
      "confirmSelfDisable": "你正在停用插件管理器本身！停用后本管理页将立即不可用，且无法在 UI 里恢复——需手动编辑 dsh-home/cordis.patch.yml 移除 disabled 行才能重新启用。确定继续吗？",
      "statusActive": "已挂载",
      "statusLoading": "加载中",
      "statusPending": "等待依赖",
      "statusFailed": "挂载失败",
      "statusUnobserved": "未挂载",
      "builtinTip": "官方内置插件仅支持停用，不支持卸载",

      // 筛选分类
      "filter.source": "来源",
      "filter.function": "用途",
      "filter.status": "状态",
      "status.all": "全部",
      "status.enabled": "已启用",
      "status.disabled": "已停用",
      "category.all": "全部",
      "category.community": "社区插件",
      "category.core": "核心插件",
      "category.user": "用户插件",

      "func.all": "全部",
      "func.dev": "编程开发",
      "func.chat": "会话聊天",
      "func.llm": "模型智能",
      "func.ui": "界面增强",
      "func.net": "网络接入",
      "func.infra": "系统底层",
      "func.other": "其他",

      // 技术路线与版本兼容（v1.3.2）
      "route.bundle": "自动激活",
      "route.dual": "需登记",
      "route.host": "纯宿主",
      "route.local": "本地",
      "route.unknown": "",
      "route.hint.bundle": "自带 bundle 补丁：官方 CLI 安装后自动挂载激活行，无需手动登记",
      "route.hint.dual": "无 bundle 补丁：需在补丁层登记激活行（插件管理器会自动登记）",
      "route.hint.host": "纯宿主插件（无浏览器半）",
      "route.hint.local": "本地 file:// 加载",
      "verdict.ok": "✓ 适配",
      "verdict.no": "⚠ 可能不兼容",
      "verdict.unknown": "未声明版本",
      "verdict.range": "声明 DSH:",
      "tested.label": "实测",
      "tested.title": "作者实测通过的 DSH 版本",
      // v1.3.4 开机自检守卫
      "guard.bannerTitle": "开机自检发现问题",
      "guard.severityCritical": "严重",
      "guard.severityWarn": "警告",
      "guard.lostLabel": "丢失插件:",
      "guard.restore": "一键恢复",
      "guard.restoring": "恢复中...",
      "guard.dismiss": "忽略",
      "guard.restartHintShort": "恢复后需正常退出 DSH Desktop 再打开生效（勿强杀进程）",
      "guard.restoredWorkspace": "已恢复 profiles/web/pnpm-workspace.yaml",
      "guard.restoredPatch": "已恢复家级补丁插件行: {ids}",
      "guard.restoreWarnings": "恢复完成但有提醒:",
      "guard.restoreDone": "恢复完成！",
      "guard.restoreFailed": "恢复失败: ",
      "guard.restartHint": "家级补丁/host 组合变更需【正常退出 DSH Desktop 再打开】才能生效，请勿强杀进程。"
    };

    const en = {
      "tab.manager": "Manage",
      "tab.market": "Market",
      "installedSection": "Installed Plugins",
      "marketSection": "Community Marketplace",
      "searchInstalled": "Search installed plugins...",
      "searchMarket": "Search npm community plugins...",
      "searchBtn": "Search",
      "installedTag": "Installed",
      "installBtn": "Install",
      "installing": "Installing...",
      "uninstallBtn": "Uninstall",
      "uninstalling": "Uninstalling...",
      "enableBtn": "Enable",
      "disableBtn": "Disable",
      "enabledTag": "Enabled",
      "disabledTag": "Disabled",
      "sourceHome": "User",
      "sourceBuiltin": "Built-in",
      "loading": "Loading data...",
      "emptyInstalled": "No plugins installed",
      "emptyFiltered": "No matching plugins found",
      "emptyMarket": "No community plugins found",
      "errorPrefix": "Request failed: ",
      "retry": "Retry",
      "refresh": "Refresh",
      "confirmInstall": "Install plugin \"{name}\"? It will have full host permissions.",
      "confirmUninstall": "Are you sure you want to uninstall \"{name}\"?",
      "confirmSelfDisable": "You are disabling the plugin manager itself! Its UI will go away immediately and cannot be re-enabled from the UI — you would have to edit dsh-home/cordis.patch.yml manually to remove the disabled flag. Continue?",
      "statusActive": "Active",
      "statusLoading": "Loading",
      "statusPending": "Pending",
      "statusFailed": "Failed",
      "statusUnobserved": "Not mounted",
      "builtinTip": "Official built-in plugins can only be disabled, not uninstalled",

      // Filters
      "filter.source": "Source",
      "filter.function": "Function",
      "filter.status": "Status",
      "status.all": "All",
      "status.enabled": "Enabled",
      "status.disabled": "Disabled",
      "category.all": "All",
      "category.community": "Community",
      "category.core": "Core",
      "category.user": "User",

      "func.all": "All",
      "func.dev": "Development",
      "func.chat": "Chat & IM",
      "func.llm": "LLM & Models",
      "func.ui": "UI & Display",
      "func.net": "Network & Web",
      "func.infra": "Infrastructure",
      "func.other": "Other",

      // route & verdict (v1.3.2)
      "route.bundle": "auto-activate",
      "route.dual": "needs row",
      "route.host": "host-only",
      "route.local": "local",
      "route.unknown": "",
      "route.hint.bundle": "Ships a bundle patch: the row mounts automatically on official CLI install",
      "route.hint.dual": "No bundle patch: an activation row is required (the manager registers it)",
      "route.hint.host": "Host-only plugin (no browser half)",
      "route.hint.local": "Loaded via local file://",
      "verdict.ok": "✓ compatible",
      "verdict.no": "⚠ maybe incompatible",
      "verdict.unknown": "no version declared",
      "verdict.range": "Declared DSH:",
      "tested.label": "tested",
      "tested.title": "DSH versions the author tested",
      // v1.3.4 startup self-check guard
      "guard.bannerTitle": "Startup self-check found problems",
      "guard.severityCritical": "CRITICAL",
      "guard.severityWarn": "Warning",
      "guard.lostLabel": "Lost plugins:",
      "guard.restore": "Restore now",
      "guard.restoring": "Restoring...",
      "guard.dismiss": "Dismiss",
      "guard.restartHintShort": "After restoring, quit DSH Desktop normally and reopen (do not force-kill).",
      "guard.restoredWorkspace": "Restored profiles/web/pnpm-workspace.yaml",
      "guard.restoredPatch": "Restored home-patch plugin rows: {ids}",
      "guard.restoreWarnings": "Restored with notices:",
      "guard.restoreDone": "Restore complete!",
      "guard.restoreFailed": "Restore failed: ",
      "guard.restartHint": "Home-patch / host composition changes take effect only after you QUIT DSH Desktop normally and reopen it. Do not force-kill the process."
    };

    /** 模块短名提取 */
    function moduleShortName(moduleName) {
      if (!moduleName) return "";
      const s = moduleName.startsWith("@") ? moduleName.slice(moduleName.indexOf("/") + 1) : moduleName;
      return s.replace(/^cordis:/, "").replace(/^cordis-plugin-/, "").replace(/^dsh-(?:host-|client-)?/, "");
    }

    /** 状态小圆点颜色映射 */
    function getPhaseColor(phase) {
      switch (phase) {
        case "active":
          return "var(--dsw-alias-state-success-primary, #10b981)";
        case "loading":
          return "var(--dsw-alias-state-business-primary, #2563eb)";
        case "failed":
          return "var(--dsw-alias-state-error-primary, #ef4444)";
        case "pending":
        default:
          return "var(--dsw-alias-label-tertiary, #9ca3af)";
      }
    }

    /** 状态文字标签 */
    function getPhaseLabel(phase, t) {
      switch (phase) {
        case "active": return t("statusActive");
        case "loading": return t("statusLoading");
        case "pending": return t("statusPending");
        case "failed": return t("statusFailed");
        default: return t("statusUnobserved");
      }
    }

    /** 翻译工具函数 */
    function createTranslator() {
      return (key, params) => {
        let text = zh[key] || key;
        if (params) {
          for (const k of Object.keys(params)) {
            text = text.replace(new RegExp(`\\{${k}\\}`, "g"), params[k]);
          }
        }
        return text;
      };
    }

    /** 来源分类列表定义 */
    const SOURCE_CATEGORIES = [
      { id: "all", labelKey: "category.all" },
      { id: "community", labelKey: "category.community" },
      { id: "core", labelKey: "category.core" },
      { id: "user", labelKey: "category.user" }
    ];

    /** 用途分类列表定义 */
    const FUNC_CATEGORIES = [
      { id: "all", labelKey: "func.all" },
      { id: "dev", labelKey: "func.dev" },
      { id: "chat", labelKey: "func.chat" },
      { id: "llm", labelKey: "func.llm" },
      { id: "ui", labelKey: "func.ui" },
      { id: "net", labelKey: "func.net" },
      { id: "infra", labelKey: "func.infra" },
      { id: "other", labelKey: "func.other" }
    ];

    /** 状态（启用/停用）筛选列表定义 */
    const STATUS_CATEGORIES = [
      { id: "all", labelKey: "status.all" },
      { id: "enabled", labelKey: "status.enabled" },
      { id: "disabled", labelKey: "status.disabled" }
    ];

    /**
     * 技术路线徽章配色（bundle=绿 / dual=橙 / host=蓝 / local=紫）
     */
    function routeColor(route) {
      switch (route) {
        case "bundle": return { fg: "#1a7f37", bg: "rgba(26,127,55,0.12)" };
        case "dual": return { fg: "#bc4c00", bg: "rgba(188,76,0,0.13)" };
        case "host": return { fg: "#0a66c2", bg: "rgba(10,102,194,0.12)" };
        case "local": return { fg: "#8250df", bg: "rgba(130,80,223,0.12)" };
        default: return { fg: "var(--dsw-alias-label-tertiary)", bg: "var(--dsw-alias-bg-layer-1)" };
      }
    }

    /** 版本兼容徽章配色（ok=绿 / no=红 / unknown=灰） */
    function verdictColor(verdict) {
      switch (verdict) {
        case "ok": return { fg: "#1a7f37", bg: "rgba(26,127,55,0.12)" };
        case "no": return { fg: "#cf222e", bg: "rgba(207,34,46,0.13)" };
        default: return { fg: "var(--dsw-alias-label-tertiary)", bg: "var(--dsw-alias-bg-layer-1)" };
      }
    }

    /** star 数格式化：>=1000 → 1.2k */
    function formatStars(n) {
      if (typeof n !== 'number' || !isFinite(n)) return "";
      if (n >= 1000) {
        const v = n / 1000;
        return `⭐ ${(v >= 10 ? Math.round(v) : Math.round(v * 10) / 10)}k`;
      }
      return `⭐ ${n}`;
    }

    /** 路由+版本徽章小工具（市场搜索结果与已安装列表共用） */
    function badgePair(t, pkg, options) {
      return [
        pkg.route && pkg.route !== "unknown" ? _jsx("span", {
          title: t("route.hint." + pkg.route) || "",
          style: {
            fontSize: "11px",
            padding: "1px 5px",
            borderRadius: "4px",
            color: routeColor(pkg.route).fg,
            background: routeColor(pkg.route).bg,
            border: "1px solid " + routeColor(pkg.route).bg
          },
          children: t("route." + pkg.route)
        }, "r") : null,
        pkg.verdict ? _jsx("span", {
          title: pkg.dshRange ? `${t("verdict.range")} ${pkg.dshRange}` : t("verdict.noRange"),
          style: {
            fontSize: "11px",
            padding: "1px 5px",
            borderRadius: "4px",
            color: verdictColor(pkg.verdict).fg,
            background: verdictColor(pkg.verdict).bg,
            border: "1px solid " + verdictColor(pkg.verdict).bg
          },
          children: t("verdict." + pkg.verdict)
        }, "v") : null
      ];
    }

    /**
     * =========================================================================
     * 1. 插件管理标签页组件 (ManagerTab)
     * =========================================================================
     */
    function ManagerTab() {
      const t = createTranslator();

      // 状态定义
      const [inventory, setInventory] = react.useState({ loading: true, error: null, entries: [] });
      const [installedQuery, setInstalledQuery] = react.useState("");
      const [sourceFilter, setSourceFilter] = react.useState("all");
      const [funcFilter, setFuncFilter] = react.useState("all");
      const [statusFilter, setStatusFilter] = react.useState("all");
      const [busyTask, setBusyTask] = react.useState(null);
      const [actionLoading, setActionLoading] = react.useState({});
      // 开机自检守卫
      const [guard, setGuard] = react.useState({ loading: true, report: null });
      const [guardBusy, setGuardBusy] = react.useState(false);

      // 拉取自检状态
      const fetchGuard = react.useCallback(async () => {
        try {
          const res = await fetch("/plugin-manager/api/guard/status");
          const data = await res.json();
          if (data.ok) setGuard({ loading: false, report: data });
        } catch {
          setGuard(prev => ({ ...prev, loading: false }));
        }
      }, []);

      react.useEffect(() => {
        fetchGuard();
      }, [fetchGuard]);

      // 一键恢复
      const handleGuardRestore = async () => {
        setGuardBusy(true);
        setBusyTask({ action: "install", target: "self-check" });
        try {
          const res = await fetch("/plugin-manager/api/guard/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
          });
          const data = await res.json();
          const parts = [];
          if (data.restored?.workspace) parts.push(t("guard.restoredWorkspace"));
          if (Array.isArray(data.restored?.patch) && data.restored.patch.length) {
            parts.push(t("guard.restoredPatch", { ids: data.restored.patch.join(", ") }));
          }
          if (data.warnings && data.warnings.length) {
            parts.push(t("guard.restoreWarnings") + " " + data.warnings.join("; "));
          }
          await fetchGuard();
          fetchInventory();
          if (parts.length) {
            window.alert(t("guard.restoreDone") + "\n\n" + parts.join("\n") + "\n\n" + t("guard.restartHint"));
          } else {
            window.alert(t("guard.restartHint"));
          }
        } catch (e) {
          window.alert(t("guard.restoreFailed") + " " + e.message);
        } finally {
          setGuardBusy(false);
          setBusyTask(null);
        }
      };

      // 忽略告警
      const handleGuardDismiss = async (issue) => {
        try {
          await fetch("/plugin-manager/api/guard/dismiss", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issueId: issue.id, baselineSavedAt: issue.baselineSavedAt })
          });
          await fetchGuard();
        } catch {}
      };

      // 获取已安装列表
      const fetchInventory = react.useCallback(async () => {
        try {
          const res = await fetch("/plugin-manager/api/inventory");
          const data = await res.json();
          if (data.ok) {
            setInventory({ loading: false, error: null, entries: data.entries || [] });
          } else {
            setInventory(prev => ({ ...prev, loading: false, error: data.error || "获取列表失败" }));
          }
        } catch (e) {
          setInventory(prev => ({ ...prev, loading: false, error: e.message }));
        }
      }, []);

      react.useEffect(() => {
        fetchInventory();
      }, [fetchInventory]);

      // 轮询队列状态
      react.useEffect(() => {
        let timer = null;
        let active = true;

        const checkStatus = async () => {
          try {
            const res = await fetch("/plugin-manager/api/status");
            const data = await res.json();
            if (active && data.ok) {
              if (data.busy) {
                setBusyTask(data.current);
                timer = setTimeout(checkStatus, 1500);
              } else {
                if (busyTask) {
                  setBusyTask(null);
                  fetchInventory();
                }
              }
            }
          } catch {}
        };

        if (busyTask) {
          timer = setTimeout(checkStatus, 1500);
        }

        return () => {
          active = false;
          if (timer) clearTimeout(timer);
        };
      }, [busyTask, fetchInventory]);

      // 启停切换
      const handleToggle = async (entry) => {
        const id = entry.entryId;
        // 自我保护：停用本插件管理器自身会导致 API 路由随插件卸载而消失，
        // 之后无法在 UI 里再启用（需手改 cordis.patch.yml）。强警告确认。
        if (entry.enabled && (id === "plugin-manager" || id === "plugin-manager-client")) {
          if (!window.confirm(t("confirmSelfDisable"))) return;
        }
        setActionLoading(prev => ({ ...prev, [id]: true }));
        try {
          const res = await fetch("/plugin-manager/api/toggle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entryId: id, disabled: entry.enabled })
          });
          const data = await res.json();
          if (data.ok) {
            setInventory(prev => ({
              ...prev,
              entries: prev.entries.map(e => e.entryId === id ? { ...e, enabled: !e.enabled } : e)
            }));
            setTimeout(fetchInventory, 1000);
          } else {
            alert("操作失败: " + (data.error || "未知错误"));
          }
        } catch (e) {
          alert("请求异常: " + e.message);
        } finally {
          setActionLoading(prev => ({ ...prev, [id]: false }));
        }
      };

      // 卸载插件
      const handleUninstall = async (entry) => {
        const name = entry.moduleName ? moduleShortName(entry.moduleName) : entry.entryId;
        if (!window.confirm(t("confirmUninstall", { name }))) return;

        const id = entry.entryId;
        setActionLoading(prev => ({ ...prev, [id]: true }));
        setBusyTask({ action: "uninstall", target: id });

        try {
          const res = await fetch("/plugin-manager/api/uninstall", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entryId: id })
          });
          const data = await res.json();
          if (data.ok) {
            fetchInventory();
          } else {
            alert("卸载失败: " + (data.error || "未知错误"));
          }
        } catch (e) {
          alert("请求异常: " + e.message);
        } finally {
          setActionLoading(prev => ({ ...prev, [id]: false }));
        }
      };

      // 统计各分类数量
      const sourceCounts = react.useMemo(() => {
        const counts = { all: inventory.entries.length, community: 0, core: 0, user: 0 };
        for (const entry of inventory.entries) {
          const c = entry.category || "core";
          counts[c] = (counts[c] || 0) + 1;
        }
        return counts;
      }, [inventory.entries]);

      const funcCounts = react.useMemo(() => {
        const counts = { all: inventory.entries.length, dev: 0, chat: 0, llm: 0, ui: 0, net: 0, infra: 0, other: 0 };
        for (const entry of inventory.entries) {
          const f = entry.funcCategory || "other";
          counts[f] = (counts[f] || 0) + 1;
        }
        return counts;
      }, [inventory.entries]);

      const statusCounts = react.useMemo(() => {
        const counts = { all: inventory.entries.length, enabled: 0, disabled: 0 };
        for (const entry of inventory.entries) {
          if (entry.enabled) counts.enabled += 1;
          else counts.disabled += 1;
        }
        return counts;
      }, [inventory.entries]);

      // 综合过滤
      const normalizedQuery = installedQuery.trim().toLowerCase();
      const filteredEntries = react.useMemo(() => {
        return inventory.entries.filter(entry => {
          // 来源筛选
          if (sourceFilter !== "all" && (entry.category || "core") !== sourceFilter) {
            return false;
          }
          // 用途筛选
          if (funcFilter !== "all" && (entry.funcCategory || "other") !== funcFilter) {
            return false;
          }
          // 启用/停用筛选
          if (statusFilter !== "all") {
            const isEnabled = !!entry.enabled;
            if (statusFilter === "enabled" && !isEnabled) return false;
            if (statusFilter === "disabled" && isEnabled) return false;
          }
          // 文本搜索
          if (normalizedQuery) {
            const matchesModule = entry.moduleName && entry.moduleName.toLowerCase().includes(normalizedQuery);
            const matchesId = entry.entryId && entry.entryId.toLowerCase().includes(normalizedQuery);
            if (!matchesModule && !matchesId) return false;
          }
          return true;
        });
      }, [inventory.entries, sourceFilter, funcFilter, statusFilter, normalizedQuery]);

      // 开机自检：未忽略的活动告警
      const activeGuardIssues = guard.report && Array.isArray(guard.report.issues)
        ? guard.report.issues.filter(i => !i.dismissed)
        : [];
      const guardCritical = activeGuardIssues.some(i => i.severity === "critical");

      return _jsxs("div", {
        style: {
          width: "100%",
          maxWidth: "800px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          color: "var(--dsw-alias-label-primary)",
          fontSize: "13px",
          lineHeight: "1.5"
        },
        children: [
          // 顶层 Busy 进度提示条
          busyTask ? _jsxs("div", {
            style: {
              background: "color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent)",
              border: "1px solid var(--dsw-alias-state-business-primary)",
              borderRadius: "8px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "var(--dsw-alias-state-business-primary)",
              fontWeight: "500"
            },
            children: [
              _jsx("span", {
                style: {
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  border: "2px solid var(--dsw-alias-state-business-primary)",
                  borderTopColor: "transparent",
                  animation: "spin 0.8s linear infinite"
                }
              }),
              _jsx("span", {
                children: busyTask.action === "install"
                  ? `正在安装插件「${busyTask.target}」，请稍候...`
                  : `正在卸载插件「${busyTask.target}」，请稍候...`
              })
            ]
          }) : null,

          // ----------------------------------------------------
          // 开机自检守卫告警横幅
          // ----------------------------------------------------
          activeGuardIssues.length ? _jsxs("div", {
            style: {
              borderRadius: "8px",
              padding: "12px 14px",
              border: "1px solid",
              borderColor: guardCritical
                ? "var(--dsw-alias-state-error-primary, #f85149)"
                : "var(--dsw-alias-state-warning-primary, #d29922)",
              background: guardCritical
                ? "color-mix(in srgb, var(--dsw-alias-state-error-primary, #f85149) 10%, transparent)"
                : "color-mix(in srgb, var(--dsw-alias-state-warning-primary, #d29922) 10%, transparent)",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            },
            children: [
              _jsxs("div", {
                style: { display: "flex", alignItems: "center", gap: "8px", fontWeight: "600" },
                children: [
                  _jsx("span", { children: guardCritical ? "🛡️⚠️" : "🛡️" }),
                  _jsx("span", { children: t("guard.bannerTitle") }),
                  guardCritical ? _jsx("span", {
                    style: {
                      fontSize: "11px",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      background: "var(--dsw-alias-state-error-primary, #f85149)",
                      color: "#fff"
                    },
                    children: t("guard.severityCritical")
                  }) : _jsx("span", {
                    style: {
                      fontSize: "11px",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      background: "var(--dsw-alias-state-warning-primary, #d29922)",
                      color: "#fff"
                    },
                    children: t("guard.severityWarn")
                  })
                ]
              }),
              ...activeGuardIssues.map((issue) => _jsxs("div", {
                style: { fontSize: "12px", opacity: 0.92, lineHeight: 1.55 },
                children: [
                  _jsx("div", { style: { fontWeight: "500" }, children: issue.title }),
                  _jsx("div", { children: issue.detail }),
                  issue.id === "patch-lost" && issue.lost && issue.lost.length ? _jsx("div", {
                    style: { marginTop: "4px", fontFamily: "monospace", fontSize: "11px", opacity: 0.85 },
                    children: t("guard.lostLabel") + " " + issue.lost.slice(0, 12).map(x => x.id).join(", ") +
                      (issue.lost.length > 12 ? " …(+" + (issue.lost.length - 12) + ")" : "")
                  }) : null
                ]
              }, issue.id)),
              _jsxs("div", {
                style: { display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" },
                children: [
                  _jsx("button", {
                    onClick: handleGuardRestore,
                    disabled: guardBusy,
                    style: {
                      padding: "5px 14px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: guardBusy ? "wait" : "pointer",
                      fontWeight: "600",
                      fontSize: "12px",
                      color: "#fff",
                      background: guardCritical
                        ? "var(--dsw-alias-state-error-primary, #f85149)"
                        : "var(--dsw-alias-state-warning-primary, #d29922)"
                    },
                    children: guardBusy ? t("guard.restoring") : t("guard.restore")
                  }),
                  _jsx("button", {
                    onClick: () => activeGuardIssues.forEach(handleGuardDismiss),
                    disabled: guardBusy,
                    style: {
                      padding: "5px 12px",
                      borderRadius: "6px",
                      border: "1px solid currentColor",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: "12px",
                      color: "inherit"
                    },
                    children: t("guard.dismiss")
                  }),
                  _jsx("span", {
                    style: { fontSize: "11px", opacity: 0.7 },
                    children: t("guard.restartHintShort")
                  })
                ]
              })
            ]
          }) : null,

          // ----------------------------------------------------
          // 来源维度筛选 Chips
          // ----------------------------------------------------
          _jsxs("div", {
            style: { display: "flex", flexDirection: "column", gap: "8px" },
            children: [
              _jsxs("div", {
                style: { display: "flex", alignItems: "center", justifyContent: "space-between" },
                children: [
                  _jsx("span", {
                    style: { fontSize: "12px", fontWeight: "600", color: "var(--dsw-alias-label-secondary)" },
                    children: t("filter.source")
                  }),
                  _jsx("button", {
                    type: "button",
                    onClick: fetchInventory,
                    style: {
                      background: "transparent",
                      border: "1px solid var(--dsw-alias-border-l2)",
                      borderRadius: "6px",
                      padding: "2px 8px",
                      color: "var(--dsw-alias-label-secondary)",
                      fontSize: "11px",
                      cursor: "pointer"
                    },
                    children: t("refresh")
                  })
                ]
              }),
              _jsx("div", {
                style: { display: "flex", flexWrap: "wrap", gap: "6px" },
                children: SOURCE_CATEGORIES.map(cat => {
                  const active = sourceFilter === cat.id;
                  const count = sourceCounts[cat.id] ?? 0;
                  return _jsxs("button", {
                    type: "button",
                    onClick: () => setSourceFilter(cat.id),
                    style: {
                      borderRadius: "999px",
                      fontSize: "12px",
                      padding: "3px 10px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      border: active
                        ? "1px solid var(--dsw-alias-state-business-primary)"
                        : "1px solid var(--dsw-alias-border-l2)",
                      color: active
                        ? "var(--dsw-alias-state-business-primary)"
                        : "var(--dsw-alias-label-tertiary)",
                      background: active
                        ? "color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)"
                        : "var(--dsw-alias-bg-layer-1)"
                    },
                    children: [
                      _jsx("span", { children: t(cat.labelKey) }),
                      _jsxs("span", {
                        style: {
                          fontSize: "11px",
                          opacity: active ? 0.9 : 0.6,
                          fontWeight: active ? "600" : "normal"
                        },
                        children: ["(", count, ")"]
                      })
                    ]
                  }, cat.id);
                })
              })
            ]
          }),

          // ----------------------------------------------------
          // 用途维度筛选 Chips
          // ----------------------------------------------------
          _jsxs("div", {
            style: { display: "flex", flexDirection: "column", gap: "8px" },
            children: [
              _jsx("span", {
                style: { fontSize: "12px", fontWeight: "600", color: "var(--dsw-alias-label-secondary)" },
                children: t("filter.function")
              }),
              _jsx("div", {
                style: { display: "flex", flexWrap: "wrap", gap: "6px" },
                children: FUNC_CATEGORIES.map(cat => {
                  const active = funcFilter === cat.id;
                  const count = funcCounts[cat.id] ?? 0;
                  return _jsxs("button", {
                    type: "button",
                    onClick: () => setFuncFilter(cat.id),
                    style: {
                      borderRadius: "999px",
                      fontSize: "12px",
                      padding: "3px 10px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      border: active
                        ? "1px solid var(--dsw-alias-state-business-primary)"
                        : "1px solid var(--dsw-alias-border-l2)",
                      color: active
                        ? "var(--dsw-alias-state-business-primary)"
                        : "var(--dsw-alias-label-tertiary)",
                      background: active
                        ? "color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)"
                        : "var(--dsw-alias-bg-layer-1)"
                    },
                    children: [
                      _jsx("span", { children: t(cat.labelKey) }),
                      _jsxs("span", {
                        style: {
                          fontSize: "11px",
                          opacity: active ? 0.9 : 0.6,
                          fontWeight: active ? "600" : "normal"
                        },
                        children: ["(", count, ")"]
                      })
                    ]
                  }, cat.id);
                })
              })
            ]
          }),

          // ----------------------------------------------------
          // 状态（启用/停用）维度筛选 Chips
          // ----------------------------------------------------
          _jsxs("div", {
            style: { display: "flex", flexDirection: "column", gap: "8px" },
            children: [
              _jsx("span", {
                style: { fontSize: "12px", fontWeight: "600", color: "var(--dsw-alias-label-secondary)" },
                children: t("filter.status")
              }),
              _jsx("div", {
                style: { display: "flex", flexWrap: "wrap", gap: "6px" },
                children: STATUS_CATEGORIES.map(cat => {
                  const active = statusFilter === cat.id;
                  const count = statusCounts[cat.id] ?? 0;
                  return _jsxs("button", {
                    type: "button",
                    onClick: () => setStatusFilter(cat.id),
                    style: {
                      borderRadius: "999px",
                      fontSize: "12px",
                      padding: "3px 10px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      border: active
                        ? (cat.id === "disabled"
                          ? "1px solid var(--dsw-alias-state-error-primary)"
                          : cat.id === "enabled"
                            ? "1px solid var(--dsw-alias-state-success-primary)"
                            : "1px solid var(--dsw-alias-state-business-primary)")
                        : "1px solid var(--dsw-alias-border-l2)",
                      color: active
                        ? (cat.id === "disabled"
                          ? "var(--dsw-alias-state-error-primary)"
                          : cat.id === "enabled"
                            ? "var(--dsw-alias-state-success-primary)"
                            : "var(--dsw-alias-state-business-primary)")
                        : "var(--dsw-alias-label-tertiary)",
                      background: active
                        ? (cat.id === "disabled"
                          ? "color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent)"
                          : cat.id === "enabled"
                            ? "color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)"
                            : "color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)")
                        : "var(--dsw-alias-bg-layer-1)"
                    },
                    children: [
                      _jsx("span", { children: t(cat.labelKey) }),
                      _jsxs("span", {
                        style: {
                          fontSize: "11px",
                          opacity: active ? 0.9 : 0.6,
                          fontWeight: active ? "600" : "normal"
                        },
                        children: ["(", count, ")"]
                      })
                    ]
                  }, cat.id);
                })
              })
            ]
          }),

          // ----------------------------------------------------
          // 搜索框与列表标题
          // ----------------------------------------------------
          _jsxs("div", {
            style: { display: "flex", flexDirection: "column", gap: "10px" },
            children: [
              _jsx("input", {
                type: "search",
                value: installedQuery,
                onChange: (e) => setInstalledQuery(e.target.value),
                placeholder: t("searchInstalled"),
                style: {
                  width: "100%",
                  height: "36px",
                  padding: "0 12px",
                  background: "var(--dsw-alias-bg-layer-1)",
                  border: "1px solid var(--dsw-alias-border-l2)",
                  borderRadius: "8px",
                  color: "var(--dsw-alias-label-primary)",
                  outline: "none",
                  fontSize: "13px",
                  boxSizing: "border-box"
                }
              }),

              _jsxs("div", {
                style: { display: "flex", alignItems: "baseline", gap: "6px", padding: "0 2px" },
                children: [
                  _jsx("span", {
                    style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)" },
                    children: "匹配插件"
                  }),
                  _jsxs("span", {
                    style: { fontSize: "12px", fontWeight: "600", color: "var(--dsw-alias-label-primary)" },
                    children: [filteredEntries.length, " / ", inventory.entries.length]
                  })
                ]
              })
            ]
          }),

          // ----------------------------------------------------
          // 已安装插件列表内容
          // ----------------------------------------------------
          inventory.loading ? _jsx("div", {
            style: { color: "var(--dsw-alias-label-tertiary)", padding: "16px 0", textAlign: "center" },
            children: t("loading")
          }) : inventory.error ? _jsxs("div", {
            style: { color: "var(--dsw-alias-state-error-primary)", display: "flex", gap: "10px", alignItems: "center" },
            children: [
              _jsx("span", { children: t("errorPrefix") + inventory.error }),
              _jsx("button", {
                type: "button",
                onClick: fetchInventory,
                style: {
                  background: "transparent",
                  border: "1px solid var(--dsw-alias-border-l2)",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  cursor: "pointer",
                  color: "inherit"
                },
                children: t("retry")
              })
            ]
          }) : filteredEntries.length === 0 ? _jsx("div", {
            style: { color: "var(--dsw-alias-label-tertiary)", padding: "24px 0", textAlign: "center" },
            children: inventory.entries.length === 0 ? t("emptyInstalled") : t("emptyFiltered")
          }) : _jsx("div", {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: "10px"
            },
            children: filteredEntries.map((entry) => {
              const title = entry.moduleName ? moduleShortName(entry.moduleName) : entry.entryId;
              const isBusy = Boolean(actionLoading[entry.entryId]) || (busyTask && busyTask.target === entry.entryId);
              const isUser = entry.category === "user";
              const isCommunity = entry.category === "community";
              const funcKey = `func.${entry.funcCategory || "other"}`;

              return _jsxs("div", {
                style: {
                  background: "var(--dsw-alias-bg-layer-3)",
                  border: "1px solid var(--dsw-alias-border-l2)",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  minWidth: 0
                },
                children: [
                  // 头部：标题与状态标签
                  _jsxs("div", {
                    style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" },
                    children: [
                      _jsx("div", {
                        style: {
                          fontWeight: "600",
                          fontSize: "14px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        },
                        title: entry.moduleName || entry.entryId,
                        children: title
                      }),
                      _jsxs("div", {
                        style: { display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 },
                        children: [
                          // 挂载点
                          entry.enabled ? _jsx("span", {
                            title: getPhaseLabel(entry.phase, t),
                            style: {
                              width: "7px",
                              height: "7px",
                              borderRadius: "50%",
                              background: getPhaseColor(entry.phase),
                              display: "inline-block"
                            }
                          }) : null,
                          // 启停状态徽章
                          _jsx("span", {
                            style: {
                              fontSize: "11px",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              background: entry.enabled
                                ? "color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent)"
                                : "var(--dsw-alias-bg-layer-1)",
                              color: entry.enabled
                                ? "var(--dsw-alias-state-success-primary)"
                                : "var(--dsw-alias-label-tertiary)"
                            },
                            children: entry.enabled ? t("enabledTag") : t("disabledTag")
                          })
                        ]
                      })
                    ]
                  }),

                  // 技术路线 + 版本兼容徽章（v1.3.2）
                  entry.route || entry.verdict ? _jsxs("div", {
                    style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" },
                    children: [
                      ...badgePair(t, entry),
                      entry.tested && entry.tested.length ? _jsx("span", {
                        title: t("tested.title"),
                        style: {
                          fontSize: "11px",
                          color: "var(--dsw-alias-label-tertiary)",
                          background: "var(--dsw-alias-bg-layer-1)",
                          padding: "1px 5px",
                          borderRadius: "4px"
                        },
                        children: `${t("tested.label")} ${entry.tested.join(", ")}`
                      }) : null
                    ]
                  }) : null,

                  // 标识与双分类标签
                  _jsxs("div", {
                    style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" },
                    children: [
                      _jsx("code", {
                        style: {
                          color: "var(--dsw-alias-label-tertiary)",
                          fontFamily: "monospace",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "200px"
                        },
                        title: entry.entryId,
                        children: entry.entryId
                      }),
                      _jsxs("div", {
                        style: { display: "flex", alignItems: "center", gap: "5px" },
                        children: [
                          // 用途徽标
                          _jsx("span", {
                            style: {
                              color: "var(--dsw-alias-label-secondary)",
                              background: "var(--dsw-alias-bg-layer-1)",
                              padding: "1px 5px",
                              borderRadius: "4px"
                            },
                            children: t(funcKey)
                          }),
                          // 来源徽标
                          _jsx("span", {
                            style: {
                              color: isUser
                                ? "var(--dsw-alias-state-business-primary)"
                                : isCommunity
                                  ? "var(--dsw-alias-state-success-primary)"
                                  : "var(--dsw-alias-label-tertiary)",
                              background: "var(--dsw-alias-bg-layer-1)",
                              padding: "1px 5px",
                              borderRadius: "4px"
                            },
                            children: isUser
                              ? t("category.user")
                              : isCommunity
                                ? t("category.community")
                                : t("category.core")
                          })
                        ]
                      })
                    ]
                  }),

                  // 底部操作按钮
                  _jsxs("div", {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: "8px",
                      marginTop: "4px",
                      paddingTop: "8px",
                      borderTop: "1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 40%, transparent)"
                    },
                    children: [
                      // 启停 Toggle 按钮
                      _jsx("button", {
                        type: "button",
                        disabled: isBusy,
                        onClick: () => handleToggle(entry),
                        style: {
                          background: "transparent",
                          border: "1px solid var(--dsw-alias-border-l2)",
                          borderRadius: "6px",
                          padding: "3px 10px",
                          fontSize: "12px",
                          color: entry.enabled ? "var(--dsw-alias-label-secondary)" : "var(--dsw-alias-state-business-primary)",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          opacity: isBusy ? 0.6 : 1
                        },
                        children: entry.enabled ? t("disableBtn") : t("enableBtn")
                      }),

                      // 卸载按钮
                      entry.manageable ? _jsx("button", {
                        type: "button",
                        disabled: isBusy,
                        onClick: () => handleUninstall(entry),
                        style: {
                          background: "transparent",
                          border: "1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, transparent)",
                          borderRadius: "6px",
                          padding: "3px 10px",
                          fontSize: "12px",
                          color: "var(--dsw-alias-state-error-primary)",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          opacity: isBusy ? 0.6 : 1
                        },
                        children: t("uninstallBtn")
                      }) : null
                    ]
                  })
                ]
              }, entry.entryId);
            })
          })
        ]
      });
    }

    /**
     * =========================================================================
     * 2. 插件市场标签页组件 (MarketTab)
     * =========================================================================
     */
    function MarketTab() {
      const t = createTranslator();

      // 状态定义
      const [market, setMarket] = react.useState({ loading: true, error: null, results: [], query: "" });
      const [marketInput, setMarketInput] = react.useState("");
      const [busyTask, setBusyTask] = react.useState(null);
      const [actionLoading, setActionLoading] = react.useState({});

      // 搜索市场
      const fetchMarket = react.useCallback(async (keyword = "") => {
        setMarket(prev => ({ ...prev, loading: true, error: null }));
        try {
          const url = `/plugin-manager/api/search?q=${encodeURIComponent(keyword)}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.ok) {
            setMarket({ loading: false, error: null, results: data.results || [], query: keyword });
          } else {
            setMarket(prev => ({ ...prev, loading: false, error: data.error || "搜索失败" }));
          }
        } catch (e) {
          setMarket(prev => ({ ...prev, loading: false, error: e.message }));
        }
      }, []);

      react.useEffect(() => {
        fetchMarket("");
      }, [fetchMarket]);

      // 轮询队列状态
      react.useEffect(() => {
        let timer = null;
        let active = true;

        const checkStatus = async () => {
          try {
            const res = await fetch("/plugin-manager/api/status");
            const data = await res.json();
            if (active && data.ok) {
              if (data.busy) {
                setBusyTask(data.current);
                timer = setTimeout(checkStatus, 1500);
              } else {
                if (busyTask) {
                  setBusyTask(null);
                  fetchMarket(market.query);
                }
              }
            }
          } catch {}
        };

        if (busyTask) {
          timer = setTimeout(checkStatus, 1500);
        }

        return () => {
          active = false;
          if (timer) clearTimeout(timer);
        };
      }, [busyTask, fetchMarket, market.query]);

      // 安装插件
      const handleInstall = async (pkg) => {
        if (!window.confirm(t("confirmInstall", { name: pkg.name }))) return;

        const key = `install-${pkg.name}`;
        setActionLoading(prev => ({ ...prev, [key]: true }));
        setBusyTask({ action: "install", target: pkg.name });

        try {
          const res = await fetch("/plugin-manager/api/install", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: pkg.name, version: pkg.version })
          });
          const data = await res.json();
          if (data.ok) {
            fetchMarket(market.query);
          } else {
            alert("安装失败: " + (data.error || "未知错误"));
          }
        } catch (e) {
          alert("请求异常: " + e.message);
        } finally {
          setActionLoading(prev => ({ ...prev, [key]: false }));
        }
      };

      return _jsxs("div", {
        style: {
          width: "100%",
          maxWidth: "800px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          color: "var(--dsw-alias-label-primary)",
          fontSize: "13px",
          lineHeight: "1.5"
        },
        children: [
          // 顶层 Busy 进度提示条
          busyTask ? _jsxs("div", {
            style: {
              background: "color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent)",
              border: "1px solid var(--dsw-alias-state-business-primary)",
              borderRadius: "8px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "var(--dsw-alias-state-business-primary)",
              fontWeight: "500"
            },
            children: [
              _jsx("span", {
                style: {
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  border: "2px solid var(--dsw-alias-state-business-primary)",
                  borderTopColor: "transparent",
                  animation: "spin 0.8s linear infinite"
                }
              }),
              _jsx("span", {
                children: `正在安装插件「${busyTask.target}」，这可能需要 1~2 分钟，请稍候...`
              })
            ]
          }) : null,

          // 头部说明
          _jsxs("div", {
            style: { display: "flex", alignItems: "baseline", gap: "8px" },
            children: [
              _jsx("h3", {
                style: { margin: 0, fontSize: "14px", fontWeight: "600" },
                children: t("marketSection")
              }),
              _jsx("span", {
                style: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px" },
                children: "通过 NPM 检索并一键安装社区开发的 DSH 插件"
              })
            ]
          }),

          // 搜索栏
          _jsxs("form", {
            onSubmit: (e) => {
              e.preventDefault();
              fetchMarket(marketInput);
            },
            style: { display: "flex", gap: "8px" },
            children: [
              _jsx("input", {
                type: "search",
                value: marketInput,
                onChange: (e) => setMarketInput(e.target.value),
                placeholder: t("searchMarket"),
                style: {
                  flex: 1,
                  height: "36px",
                  padding: "0 12px",
                  background: "var(--dsw-alias-bg-layer-1)",
                  border: "1px solid var(--dsw-alias-border-l2)",
                  borderRadius: "8px",
                  color: "var(--dsw-alias-label-primary)",
                  outline: "none",
                  fontSize: "13px",
                  boxSizing: "border-box"
                }
              }),
              _jsx("button", {
                type: "submit",
                style: {
                  background: "var(--dsw-alias-state-business-primary)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0 16px",
                  fontSize: "13px",
                  fontWeight: "500",
                  cursor: "pointer"
                },
                children: t("searchBtn")
              })
            ]
          }),

          // 市场列表
          market.loading ? _jsx("div", {
            style: { color: "var(--dsw-alias-label-tertiary)", padding: "20px 0", textAlign: "center" },
            children: t("loading")
          }) : market.error ? _jsxs("div", {
            style: { color: "var(--dsw-alias-state-error-primary)", display: "flex", gap: "10px", alignItems: "center" },
            children: [
              _jsx("span", { children: t("errorPrefix") + market.error }),
              _jsx("button", {
                type: "button",
                onClick: () => fetchMarket(market.query),
                style: {
                  background: "transparent",
                  border: "1px solid var(--dsw-alias-border-l2)",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  cursor: "pointer",
                  color: "inherit"
                },
                children: t("retry")
              })
            ]
          }) : market.results.length === 0 ? _jsx("div", {
            style: { color: "var(--dsw-alias-label-tertiary)", padding: "24px 0", textAlign: "center" },
            children: t("emptyMarket")
          }) : _jsx("div", {
            style: { display: "flex", flexDirection: "column", gap: "10px" },
            children: market.results.map((pkg) => {
              const isInstalling = Boolean(actionLoading[`install-${pkg.name}`]) || (busyTask && busyTask.target === pkg.name);

              return _jsxs("div", {
                style: {
                  background: "var(--dsw-alias-bg-layer-3)",
                  border: "1px solid var(--dsw-alias-border-l2)",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px"
                },
                children: [
                  // 左侧信息
                  _jsxs("div", {
                    style: { display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, flex: 1 },
                    children: [
                      _jsxs("div", {
                        style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
                        children: [
                          _jsx("code", {
                            style: {
                              fontWeight: "600",
                              fontSize: "13px",
                              color: "var(--dsw-alias-label-primary)",
                              fontFamily: "monospace"
                            },
                            children: pkg.name
                          }),
                          _jsx("span", {
                            style: {
                              fontSize: "11px",
                              color: "var(--dsw-alias-label-tertiary)",
                              background: "var(--dsw-alias-bg-layer-1)",
                              padding: "1px 5px",
                              borderRadius: "4px"
                            },
                            children: `v${pkg.version}`
                          }),
                          ...badgePair(t, pkg),
                          // GitHub star（社区热度，点击打开仓库）
                          typeof pkg.stars === "number" ? _jsx("a", {
                            href: pkg.repoUrl || `https://github.com/${pkg.name}`,
                            target: "_blank",
                            rel: "noreferrer",
                            title: pkg.repoUrl || "",
                            style: {
                              fontSize: "11px",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              color: "#e3b341",
                              background: "rgba(227,179,65,0.12)",
                              border: "1px solid rgba(227,179,65,0.25)",
                              textDecoration: "none",
                              cursor: "pointer"
                            },
                            children: formatStars(pkg.stars)
                          }, "s") : null,
                          pkg.date ? _jsx("span", {
                            style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary)" },
                            children: pkg.date.slice(0, 10)
                          }) : null
                        ]
                      }),
                      pkg.description ? _jsx("div", {
                        style: {
                          fontSize: "12px",
                          color: "var(--dsw-alias-label-secondary)",
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          lineHeight: "1.4"
                        },
                        children: pkg.description
                      }) : null
                    ]
                  }),

                  // 右侧操作
                  _jsx("div", {
                    style: { flexShrink: 0 },
                    children: pkg.installed ? _jsx("span", {
                      style: {
                        fontSize: "12px",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        background: "var(--dsw-alias-bg-layer-1)",
                        color: "var(--dsw-alias-label-tertiary)"
                      },
                      children: t("installedTag")
                    }) : _jsx("button", {
                      type: "button",
                      disabled: isInstalling || Boolean(busyTask),
                      onClick: () => handleInstall(pkg),
                      style: {
                        background: "var(--dsw-alias-state-business-primary)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "5px 12px",
                        fontSize: "12px",
                        fontWeight: "500",
                        cursor: (isInstalling || busyTask) ? "not-allowed" : "pointer",
                        opacity: (isInstalling || busyTask) ? 0.6 : 1
                      },
                      children: isInstalling ? t("installing") : t("installBtn")
                    })
                  })
                ]
              }, pkg.name);
            })
          })
        ]
      });
    }

    /** 客户端依赖注入 */
    const inject = ["slots", "locale"];

    /** 插件应用入口 */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-plugin-manager-plus: dictionaries");
      const t = ctx.locale.bind(NS);

      // 注册「插件管理」Tab (order: 15)
      ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
        name: "settings.plugins.tab",
        id: "manager",
        order: 15,
        label: () => t("tab.manager"),
        locale: NS
      }, ManagerTab));

      // 注册「插件市场」Tab (order: 20)
      ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
        name: "settings.plugins.tab",
        id: "market",
        order: 20,
        label: () => t("tab.market"),
        locale: NS
      }, MarketTab));
    }

    exports.NS = NS;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
