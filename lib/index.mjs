/**
 * @file lib/index.mjs
 * @description DeepSeek Harness (DSH) 插件管理器 (dsh-plugin-manager) 宿主半边。
 *              提供插件市场搜索代理、一键安装/卸载 npm 社区插件、启用/停用已安装插件（热重载）、
 *              以及安全防护（Loopback 校验、Host 端口校验、CSRF 防御）。
 *              所有变更持久化至 cordis.patch.yml 与 plugins-store/plugin-manager.json。
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync, rmSync, mkdirSync, lstatSync, renameSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export const name = 'dsh-plugin-manager-plus';
export const inject = ['loader', 'webServer'];

const PLUGIN_VERSION = '1.3.3';

/** 读取宿主 dsh 包版本（后端进程 argv[1] 即 dsh 的 bin.js，其上级即包根） */
function readHostDshVersion() {
  try {
    const argv1 = process.argv[1] || '';
    if (argv1 && argv1.endsWith('bin.js')) {
      const pkgPath = join(dirname(dirname(argv1)), 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (typeof pkg.version === 'string') return pkg.version;
      }
    }
  } catch {}
  return null;
}
const HOST_DSH_VERSION = readHostDshVersion();

// =========================================================================
// 版本工具：社区插件的技术路线（route）与 DSH 版本兼容性（verdict）识别。
// 无第三方依赖，实现 npm semver 范围判断的实用子集（精确/^/~/>=/<=/>/</
// | |/x 通配/空格且），对无法解析的声明一律判 unknown 而非误报。
// =========================================================================

/** 解析 '1.2.3-alpha.1' → {major, minor, patch, pre}；失败返回 null */
function parseSemver(v) {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/.exec(String(v ?? '').trim());
  if (!m) return null;
  return { major: +m[1] || 0, minor: +m[2] || 0, patch: +m[3] || 0, pre: m[4] || '' };
}

/** 比较两个已解析版本：a > b → 1，a < b → -1，相等 → 0 */
function compareSemver(a, b) {
  if (!a || !b) return 0;
  for (const k of ['major', 'minor', 'patch']) {
    if (a[k] !== b[k]) return a[k] > b[k] ? 1 : -1;
  }
  if (a.pre === b.pre) return 0;
  if (!a.pre) return 1; // 正式版 > pre-release
  if (!b.pre) return -1;
  const pa = a.pre.split(/[.-]/).map(s => (/^\d+$/.test(s) ? Number(s) : s));
  const pb = b.pre.split(/[.-]/).map(s => (/^\d+$/.test(s) ? Number(s) : s));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i], y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x > y ? 1 : -1;
    if (typeof x === 'number') return 1; // 数字段 < 字母段（npm 规则相反，此处从简）
    if (typeof y === 'number') return -1;
    return x > y ? 1 : -1;
  }
  return 0;
}

/** 单个比较器（>=、^、~、=、精确、x 通配）是否满足 */
function cmpSatisfies(v, cmpRaw) {
  const vp = parseSemver(v);
  if (!vp) return false;
  let m = /^(>=|<=|>|<|\^|~|=)?\s*(.*)$/.exec(String(cmpRaw || '').trim());
  const op = m[1] || '=';
  let spec = (m[2] || '').trim();
  if (!spec || spec === '*' || spec === 'x' || spec === 'X') return true;
  // x 通配（如 1.x、1.2.x）
  if (/^(\d+)(?:\.(\d+))?\.x$/i.test(spec) || /^(\d+)$/.test(spec) && op === '=' || /^(\d+)\.(\d+)$/.test(spec) && op === '=') {
    const parts = spec.split('.');
    const wantMaj = +parts[0];
    if (vp.major !== wantMaj) return false;
    if (parts.length >= 2 && parts[1] !== 'x' && parts[1] !== 'X' && vp.minor !== +parts[1]) return false;
    if (parts.length >= 3 && parts[2] !== 'x' && parts[2] !== 'X' && vp.patch !== +parts[2]) return false;
    if (op === '>') return false; // 对 x 通配不做精细上界，从宽
    return true;
  }
  // 处理组合范围如 ">=1.2.3 <2.0.0"（外层已按空格拆分）
  const sp = parseSemver(spec);
  if (!sp) return false;
  switch (op) {
    case '=': return compareSemver(vp, sp) === 0;
    case '>': return compareSemver(vp, sp) > 0;
    case '<': return compareSemver(vp, sp) < 0;
    case '>=': return compareSemver(vp, sp) >= 0;
    case '<=': return compareSemver(vp, sp) <= 0;
    case '~': return vp.major === sp.major && vp.minor === sp.minor && compareSemver(vp, sp) >= 0;
    case '^': {
      const lower = compareSemver(vp, sp) >= 0;
      if (!lower) return false;
      if (sp.major > 0) return vp.major === sp.major;
      if (sp.minor > 0) return vp.minor === sp.minor; // 0.x.y 系列
      return vp.patch === sp.patch; // 0.0.x
    }
    default: return false;
  }
}

/** 版本是否满足范围（支持 || 与空格分隔的多个比较器） */
function versionSatisfies(version, range) {
  const r = String(range ?? '').trim();
  if (!r || r === '*' || r === 'latest' || /^[a-zA-Z]/.test(r)) return true; // tag/无约束
  const v = parseSemver(version);
  if (!v) return false;
  for (const or of r.split('||')) {
    const parts = or.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;
    let ok = true;
    for (const part of parts) {
      if (part !== '' && !cmpSatisfies(version, part)) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * 提取包的 DSH 版本约束（多个声明源，按优先级取首个非空）。
 * 0 = dsh.compatibility.dsh（自定义声明，最明确）
 * 1 = peerDependencies['@deepseek-ai/dsh']
 * 2 = peerDependencies['@deepseek-ai/dsh-settings']（dshmarket 风格）
 * 3 = peerDependencies['@deepseek-ai/cordis']（仅作参考，不判 verdict）
 */
function extractDshRange(pkg) {
  if (!pkg || typeof pkg !== 'object') return null;
  if (pkg.dsh?.compatibility?.dsh) return String(pkg.dsh.compatibility.dsh);
  const peer = pkg.peerDependencies || {};
  if (peer['@deepseek-ai/dsh']) return String(peer['@deepseek-ai/dsh']);
  if (peer['@deepseek-ai/dsh-settings']) return String(peer['@deepseek-ai/dsh-settings']);
  return null;
}

/**
 * 判定社区插件安装技术路线：
 * 'bundle'  — 带 dsh.bundle.patch，官方 CLI add 后 bundle 层自动挂载激活行，
 *             插件管理器安装时**不写**家级行（写则双源致命错误）
 * 'dual'    — 有 dsh.client（浏览器半）但无 bundle patch，需在 patch 层登记
 *             激活行（裸包名或 file:// + client 行），插件管理器会登记
 * 'host'    — 纯宿主插件（无 dsh.client），仅需宿主激活行
 * 'local'   — file:// 本地加载（非 npm 包）
 */
function detectRoute(moduleName, pkg) {
  if (typeof moduleName === 'string' && moduleName.startsWith('file://')) return 'local';
  if (pkg?.dsh?.bundle?.patch) return 'bundle';
  if (pkg?.dsh?.client?.platform) return 'dual';
  if (pkg && typeof pkg === 'object') return 'host';
  return 'unknown';
}

/**
 * 组装某包的路线 + 版本兼容信息。
 * @param {string} moduleName 加载 specifier（可能为 file:// URL）
 * @param {object|null} pkg 已解析的 package.json（无则为 null）
 * @returns {{route, dshRange, tested, enginesNode, verdict}}
 */
function assessPackage(moduleName, pkg) {
  const route = detectRoute(moduleName, pkg);
  const tested = pkg?.dsh?.compatibility?.tested?.length
    ? pkg.dsh.compatibility.tested.map(String)
    : null;
  const enginesNode = pkg?.engines?.node ? String(pkg.engines.node) : null;
  const dshRange = extractDshRange(pkg);
  let verdict = 'unknown';
  if (dshRange && HOST_DSH_VERSION) {
    verdict = versionSatisfies(HOST_DSH_VERSION, dshRange) ? 'ok' : 'no';
  }
  return { route, dshRange, tested, enginesNode, verdict };
}

/** 从已安装目录读取包 metadata（读不到返回 null）；支持 file:// 本地插件向上找 package.json */
function readInstalledPkg(moduleName) {
  try {
    if (typeof moduleName === 'string' && moduleName.startsWith('file://')) {
      let dir = dirname(fileURLToPath(moduleName.split('?')[0]));
      for (let i = 0; i < 4; i++) {
        const cand = join(dir, 'package.json');
        if (existsSync(cand)) return JSON.parse(readFileSync(cand, 'utf8'));
        const parent = dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return null;
    }
    if (!moduleName || moduleName.startsWith('@deepseek-ai/')) return null; // 官方 bundle 行不读
    const p = join(WEB_PROFILE_DIR, 'node_modules', ...String(moduleName).split('/'), 'package.json');
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch { return null; }
}

// =========================================================================
// GitHub star 数（社区热度）查询：metadata 的 repository 字段 → GitHub API。
// 内存缓存 30 分钟 + 并发池 6 + 失败静默降级（不阻塞搜索结果）。
// =========================================================================

const GITHUB_STAR_CACHE = new Map();
const STAR_TTL_MS = 30 * 60 * 1000;

/** 从 package.json 的 repository 字段提取 GitHub 仓库 'owner/name'，非 GitHub 返回 null */
function extractGitHubRepo(pkg) {
  if (!pkg || typeof pkg !== 'object') return null;
  let raw = pkg.repository;
  if (raw && typeof raw === 'object') raw = raw.url || raw.repository || '';
  if (!raw || typeof raw !== 'string') {
    // 部分包只写了 homepage (github 链接)
    raw = typeof pkg.homepage === 'string' ? pkg.homepage : '';
  }
  raw = raw.trim();
  if (!raw) return null;
  let m = /^github:([^/\s]+\/[^/\s]+)/.exec(raw);
  if (m) return m[1];
  m = /^([\w.-]+\/[\w.-]+)$/.exec(raw); // npm 短格式 owner/repo
  if (m) return m[1];
  try {
    const u = new URL(raw);
    if (u.hostname === 'github.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) return parts[0] + '/' + parts[1].replace(/\.git$/i, '');
    }
  } catch {}
  return null;
}

/** 组装 GitHub 仓库主页 URL（供客户端跳转）；非 GitHub 返回 null */
function gitHubRepoUrl(pkg) {
  const repo = extractGitHubRepo(pkg);
  if (!repo) return null;
  return 'https://github.com/' + repo;
}

/** 查询 GitHub star 数（带缓存；失败返回 null 且短暂缓存避免反复打 API） */
async function fetchGitHubStars(repo) {
  const key = String(repo).toLowerCase();
  const hit = GITHUB_STAR_CACHE.get(key);
  if (hit && Date.now() - hit.at < STAR_TTL_MS) return hit.stars;
  try {
    const enc = String(repo).split('/').map(encodeURIComponent).join('/'); // 斜杠必须保留，%2F 会 404
    const resp = await fetch(`https://api.github.com/repos/${enc}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'dsh-plugin-manager-plus',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      signal: AbortSignal.timeout(6000)
    });
    let stars = null;
    if (resp.ok) {
      const j = await resp.json();
      if (typeof j.stargazers_count === 'number') stars = j.stargazers_count;
    }
    GITHUB_STAR_CACHE.set(key, { stars, at: Date.now() });
    return stars;
  } catch {
    GITHUB_STAR_CACHE.set(key, { stars: null, at: Date.now() });
    return null;
  }
}

/** 简单并发池：最多 limit 个并发执行 fn */
async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try { results[idx] = await fn(items[idx], idx); } catch { results[idx] = undefined; }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

/** Fiber 状态常量映射 */
const FIBER_PHASE = {
  0: 'pending',
  1: 'loading',
  2: 'active',
  3: 'failed',
  4: null,
  5: 'unloading'
};

/** 官方包（@deepseek-ai/ 前缀）用途分类规则表 */
const FUNC_RULES = [
  { id: 'net',   patterns: [/^@deepseek-ai\/dsh-web($|-)/, /^@deepseek-ai\/dsh-mcp/, /^@deepseek-ai\/dsh-api-/, /^@deepseek-ai\/dsh-host-webserver/, /^@deepseek-ai\/dsh-host-apiproxy/, /^@deepseek-ai\/dsh-client-connection/, /^@deepseek-ai\/dsh-cordis-(host|client)-runner/] },
  { id: 'dev',   patterns: [/^@deepseek-ai\/dsh-tool-/, /^@deepseek-ai\/dsh-fs($|-)/, /^@deepseek-ai\/dsh-(bash|pwsh|terminal|tmux)/, /^@deepseek-ai\/dsh-subagent/, /^@deepseek-ai\/dsh-workflow/, /^@deepseek-ai\/dsh-(goal|plan-mode|ralph)/, /^@deepseek-ai\/dsh-code-runtime/, /^@deepseek-ai\/dsh-skill($|-)/, /^@deepseek-ai\/dsh-jobs($|-)/, /^@deepseek-ai\/dsh-(cmdline|native-command|headless|spill)/] },
  { id: 'llm',   patterns: [/^@deepseek-ai\/dsh-llm/, /^@deepseek-ai\/dsh-agent($|-)/, /^@deepseek-ai\/dsh-model/, /^@deepseek-ai\/dsh-persona/, /^@deepseek-ai\/dsh-system-prompt/, /^@deepseek-ai\/dsh-agent-instructions/, /^@deepseek-ai\/dsh-token-meter/] },
  { id: 'chat',  patterns: [/^@deepseek-ai\/dsh-session/, /^@deepseek-ai\/dsh-compaction/, /^@deepseek-ai\/dsh-message/, /^@deepseek-ai\/dsh-attachment/, /^@deepseek-ai\/dsh-command/, /^@deepseek-ai\/dsh-repeat/, /^@deepseek-ai\/dsh-(session|file)-reference/, /^@deepseek-ai\/dsh-conversation/] },
  { id: 'ui',    patterns: [/^@deepseek-ai\/dsh-client-ui/, /^@deepseek-ai\/dsh-client-/, /^@deepseek-ai\/dsh-web-app/, /^@deepseek-ai\/dsh-brand/] },
  { id: 'infra', patterns: [/^@deepseek-ai\/dsh-(storage|sandbox|credentials|settings|subprocess|telemetry|scope|typert|invariants|shell|home-paths|launch|anonymous|time-context|host-frontend|workspace|output|timeout|user-questions|user-approval|permission|client-modules|repeat-tool)/, /^@deepseek-ai\/cordis/, /^cordis:/] },
];

/** 非 @deepseek-ai 包名 / file:// 路径（社区与自研）按关键词启发归类 */
const COMMUNITY_FUNC_RULES = [
  { id: 'dev',  patterns: [/code|codex|claude|copilot|edit|test|git|terminal|shell|debug|build|review|lint|format|commit/i] },
  { id: 'chat', patterns: [/chat|im\b|bot|telegram|feishu|lark|dingtalk|qq|wechat|napcat|message|notify|gateway/i] },
  { id: 'ui',   patterns: [/theme|skin|wallpaper|widget|panel|dashboard|status|indicator|icon|sound|sfx|market|manager/i] },
  { id: 'llm',  patterns: [/model|llm|router|provider|memory|ocr|agent/i] },
  { id: 'net',  patterns: [/proxy|network|remote|mobile|sync|import|export|web|server/i] },
];

/**
 * 判定插件用途分类 (funcCategory)
 * @param {string} moduleName
 * @returns {'net' | 'dev' | 'llm' | 'chat' | 'ui' | 'infra' | 'other'}
 */
function determineFuncCategory(moduleName) {
  if (!moduleName) return 'other';
  if (moduleName.startsWith('@deepseek-ai/') || moduleName.startsWith('cordis:') || moduleName.startsWith('@deepseek-ai/cordis')) {
    for (const rule of FUNC_RULES) {
      for (const pat of rule.patterns) {
        if (pat.test(moduleName)) return rule.id;
      }
    }
  }
  // 社区或自研包 / file://
  for (const rule of COMMUNITY_FUNC_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(moduleName)) return rule.id;
    }
  }
  // 官方包未匹配上专有规则时 fallback
  for (const rule of FUNC_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(moduleName)) return rule.id;
    }
  }
  return 'other';
}

/**
 * 判定插件来源分类 (category)
 * @param {'builtin' | 'home'} source
 * @param {string} entryId
 * @param {string} moduleName
 * @param {Set<string>} manifestEntryIds
 * @returns {'core' | 'community' | 'user'}
 */
function determineCategory(source, entryId, moduleName, manifestEntryIds) {
  if (source === 'builtin') {
    return 'core';
  }
  // source === 'home'
  if (manifestEntryIds.has(entryId)) {
    return 'community';
  }
  if (moduleName && moduleName.startsWith('file://')) {
    return 'user';
  }
  if (moduleName && !moduleName.startsWith('file://') && !moduleName.startsWith('http://') && !moduleName.startsWith('https://')) {
    const webJunctionPath = join(DSH_HOME, 'profiles', 'web', 'node_modules', ...moduleName.split('/'));
    try {
      if (existsSync(webJunctionPath)) {
        const stat = lstatSync(webJunctionPath);
        if (stat.isSymbolicLink() || (stat.isDirectory() && process.platform === 'win32')) {
          return 'user';
        }
      }
    } catch {}
    return 'community';
  }
  return 'community';
}

/** 路径配置（可移植：环境变量优先，其余按 DSH Desktop 标准布局推导） */
function detectDshHome() {
  if (process.env.DSH_HOME) return process.env.DSH_HOME;
  // DSH Desktop 桌面壳标准布局：%APPDATA%\DSH Desktop\dsh-home（Windows）；
  // 其他平台回退 ~/.dsh（dsh CLI 的默认 DSH_HOME）。
  const appData = process.env.APPDATA || (homedir() && join(homedir(), 'AppData', 'Roaming'));
  if (appData) {
    const desktopHome = join(appData, 'DSH Desktop', 'dsh-home');
    if (existsSync(desktopHome)) return desktopHome;
  }
  return join(homedir(), '.dsh');
}

/** 从后端进程 argv（node .../@deepseek-ai/dsh/lib/bin.js）推导 backend 根目录 */
function detectBackendDir() {
  const argv1 = process.argv[1] || '';
  if (argv1) {
    // bin.js → lib → dsh(pkg) → @deepseek-ai → node_modules → dsh(dir) → backend
    let dir = dirname(argv1);
    for (let i = 0; i < 5; i++) dir = dirname(dir);
    if (existsSync(join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js'))) return dir;
  }
  const appData = process.env.APPDATA || (homedir() && join(homedir(), 'AppData', 'Roaming'));
  if (appData) {
    const backend = join(appData, 'DSH Desktop', 'backend');
    if (existsSync(backend)) return backend;
  }
  return '';
}

const DSH_HOME = detectDshHome();
const PATCH_PATH = join(DSH_HOME, 'cordis.patch.yml');
const BACKUP_PATCH_PATH = join(DSH_HOME, 'cordis.patch.yml.bak-pm');
const STORE_DIR = join(DSH_HOME, 'plugins-store');
const MANIFEST_PATH = join(STORE_DIR, 'plugin-manager.json');
const WEB_PROFILE_DIR = join(DSH_HOME, 'profiles', 'web');
const WEB_PKG_JSON_PATH = join(WEB_PROFILE_DIR, 'package.json');
const BACKEND_DIR = detectBackendDir();
const DEFAULT_NPM_CLI = BACKEND_DIR ? join(BACKEND_DIR, 'node_modules', 'npm', 'bin', 'npm-cli.js') : '';

/**
 * 串行任务队列状态
 */
const queueStatus = {
  busy: false,
  current: null, // { action, target, startedAt }
  last: null     // { action, target, ok, error, finishedAt }
};

/** 串行锁 Promise 链 */
let queueLock = Promise.resolve();

function runInQueue(action, target, taskFn) {
  if (queueStatus.busy) {
    return Promise.reject(new Error(`当前有任务 [${queueStatus.current?.action}: ${queueStatus.current?.target}] 正在执行，请稍候...`));
  }
  queueStatus.busy = true;
  queueStatus.current = { action, target, startedAt: Date.now() };

  const taskPromise = queueLock.then(async () => {
    try {
      const res = await taskFn();
      queueStatus.last = { action, target, ok: true, finishedAt: Date.now() };
      return res;
    } catch (err) {
      queueStatus.last = { action, target, ok: false, error: err.message, finishedAt: Date.now() };
      throw err;
    } finally {
      queueStatus.busy = false;
      queueStatus.current = null;
    }
  });

  queueLock = taskPromise.catch(() => {});
  return taskPromise;
}

/**
 * 确保目录存在
 */
function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 读取 manifest 数据
 */
function readManifest() {
  try {
    if (!existsSync(MANIFEST_PATH)) return [];
    const content = readFileSync(MANIFEST_PATH, 'utf8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * 原子保存 manifest 数据
 */
function saveManifest(manifest) {
  ensureDir(STORE_DIR);
  const tmpPath = `${MANIFEST_PATH}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), 'utf8');
  renameSync(tmpPath, MANIFEST_PATH);
}

/**
 * 将 npm 包名转为安全的 entryId
 * 如 @1e0zj/dsh-plugin-mall -> 1e0zj-dsh-plugin-mall
 * 如 dsh-plugin-demo -> dsh-plugin-demo
 */
function packageNameToEntryId(pkgName) {
  return pkgName
    .replace(/^@/, '')
    .replace(/[\/@_]/g, '-')
    .toLowerCase();
}

/**
 * 提取模块简短名称
 */
function moduleShortName(moduleName) {
  if (!moduleName) return '';
  const s = (moduleName.startsWith('@') ? moduleName.slice(moduleName.indexOf('/') + 1) : moduleName);
  return s.replace(/^cordis:/, '').replace(/^cordis-plugin-/, '').replace(/^dsh-(?:host-|client-)?/, '');
}

/**
 * 安全校验：Loopback、Host 端口与 CSRF 防御
 */
function validateRequestSecurity(req) {
  // 1. Loopback 地址校验
  const remoteAddr = req.socket.remoteAddress || '';
  const isLoopback = remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
  if (!isLoopback) {
    return { ok: false, status: 403, message: 'Forbidden: Loopback access only' };
  }

  // 2. Host 端口校验
  const hostHeader = req.headers.host || '';
  const localPort = req.socket.localPort;
  if (localPort) {
    const hostPortMatch = hostHeader.match(/:(\d+)$/);
    const hostPort = hostPortMatch ? Number(hostPortMatch[1]) : (req.socket.encrypted ? 443 : 80);
    if (hostPort !== localPort) {
      return { ok: false, status: 403, message: `Forbidden: Host port mismatch (expected ${localPort})` };
    }
  }

  // 3. CSRF 防护 (仅 POST/PUT/DELETE 请求)
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    const secFetchSite = req.headers['sec-fetch-site'];
    if (secFetchSite) {
      if (secFetchSite !== 'same-origin' && secFetchSite !== 'same-site' && secFetchSite !== 'none') {
        return { ok: false, status: 403, message: 'Forbidden: CSRF blocked (sec-fetch-site)' };
      }
    } else {
      const origin = req.headers.origin;
      if (origin) {
        try {
          const originUrl = new URL(origin);
          if (originUrl.host !== hostHeader) {
            return { ok: false, status: 403, message: 'Forbidden: CSRF origin mismatch' };
          }
        } catch {
          return { ok: false, status: 403, message: 'Forbidden: Invalid Origin header' };
        }
      }
    }
  }

  return { ok: true };
}

/**
 * 读取 HTTP 请求 Body JSON
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error(`JSON 格式非法: ${e.message}`));
      }
    });
    req.on('error', reject);
  });
}

/**
 * =========================================================================
 * 家级 Patch (cordis.patch.yml) 解析与精确行级编辑核心
 * =========================================================================
 */

/**
 * 解析 cordis.patch.yml 顶层块
 */
function parsePatchYaml(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 顶层块标记：行首是 "- " 开头
    if (/^-\s+/.test(line)) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {
        startLine: i,
        endLine: i,
        lines: [line],
        type: line.trim().startsWith('- insert:') ? 'insert' : 'override',
        entries: []
      };
    } else {
      if (currentBlock) {
        currentBlock.lines.push(line);
        currentBlock.endLine = i;
      } else {
        // 文件头部注释/空行
        blocks.push({
          startLine: i,
          endLine: i,
          lines: [line],
          type: 'header',
          entries: []
        });
      }
    }
  }
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // 深入解析每个 insert / override 块中的 entries
  for (const block of blocks) {
    if (block.type === 'insert') {
      let currentEntry = null;
      for (let j = 0; j < block.lines.length; j++) {
        const l = block.lines[j];
        // 子项格式通常为 4 空格缩进：'    - id: xxx' 或 '  - id: xxx'
        const idMatch = l.match(/^(\s+)-\s+id:\s*(['"]?)(.+?)\2\s*$/);
        if (idMatch) {
          if (currentEntry) block.entries.push(currentEntry);
          currentEntry = {
            id: idMatch[3].trim(),
            name: '',
            disabled: false,
            indent: idMatch[1],
            startIdx: j,
            endIdx: j,
            lines: [l]
          };
        } else if (currentEntry) {
          currentEntry.lines.push(l);
          currentEntry.endIdx = j;
          const nameMatch = l.match(/^\s+name:\s*(['"]?)(.+?)\1\s*$/);
          if (nameMatch) currentEntry.name = nameMatch[2].trim();
          const disabledMatch = l.match(/^\s+disabled:\s*(true|false)\s*$/);
          if (disabledMatch) currentEntry.disabled = disabledMatch[1] === 'true';
        }
      }
      if (currentEntry) block.entries.push(currentEntry);
    } else if (block.type === 'override') {
      // 覆盖块格式：'- id: xxx'
      const firstLine = block.lines[0];
      const idMatch = firstLine.match(/^-\s+id:\s*(['"]?)(.+?)\1\s*$/);
      let id = idMatch ? idMatch[2].trim() : '';
      let disabled = false;
      for (let j = 1; j < block.lines.length; j++) {
        const l = block.lines[j];
        const idSubMatch = l.match(/^\s+id:\s*(['"]?)(.+?)\1\s*$/);
        if (!id && idSubMatch) id = idSubMatch[2].trim();
        const disabledMatch = l.match(/^\s+disabled:\s*(true|false)\s*$/);
        if (disabledMatch) disabled = disabledMatch[1] === 'true';
      }
      if (id) {
        block.entries.push({
          id,
          name: '',
          disabled,
          startIdx: 0,
          endIdx: block.lines.length - 1,
          lines: block.lines
        });
      }
    }
  }

  return { lines, blocks };
}

/**
 * 读出家级 patch 中登记的所有条目（用于 inventory 对账）
 */
function getHomePatchEntries() {
  if (!existsSync(PATCH_PATH)) return { insertEntries: new Map(), overrideEntries: new Map() };
  try {
    const text = readFileSync(PATCH_PATH, 'utf8');
    const { blocks } = parsePatchYaml(text);
    const insertEntries = new Map();
    const overrideEntries = new Map();

    for (const block of blocks) {
      if (block.type === 'insert') {
        for (const entry of block.entries) {
          insertEntries.set(entry.id, entry);
        }
      } else if (block.type === 'override') {
        for (const entry of block.entries) {
          overrideEntries.set(entry.id, entry);
        }
      }
    }
    return { insertEntries, overrideEntries };
  } catch {
    return { insertEntries: new Map(), overrideEntries: new Map() };
  }
}

/**
 * 原子保存 Patch 文件并建立滚动备份。
 * 带乐观并发保护：expectedMtimeMs 提供时，写前比对当前 mtime——期间有其他写入者
 * （其他 agent 会话 / 手工编辑）动过文件则拒绝写入返回 false，由调用方重读重试，
 * 避免双方基于各自内存副本互相覆盖对方的修改。
 */
function safeWritePatchFile(newContent, expectedMtimeMs) {
  if (typeof expectedMtimeMs === 'number' && existsSync(PATCH_PATH)) {
    const currentMtime = statSync(PATCH_PATH).mtimeMs;
    if (currentMtime !== expectedMtimeMs) {
      return false; // 并发修改，调用方应重读重试
    }
  }
  if (!existsSync(PATCH_PATH)) {
    writeFileSync(PATCH_PATH, newContent, 'utf8');
    return true;
  }
  // 备份原文件
  try {
    copyFileSync(PATCH_PATH, BACKUP_PATCH_PATH);
  } catch {}

  const tmpPath = `${PATCH_PATH}.tmp`;
  writeFileSync(tmpPath, newContent, 'utf8');
  renameSync(tmpPath, PATCH_PATH);
  return true;
}

/** 读取 patch 文本并记录 mtime 戳（供 safeWritePatchFile 乐观锁比对） */
function readPatchStamped() {
  const text = existsSync(PATCH_PATH) ? readFileSync(PATCH_PATH, 'utf8') : '';
  const mtimeMs = existsSync(PATCH_PATH) ? statSync(PATCH_PATH).mtimeMs : 0;
  return { text, mtimeMs };
}

/**
 * 乐观锁重试执行一次 patch 读-改-写：并发冲突时自动重读最新文件重试（最多 attempts 次）。
 * @param {string} label 日志标签
 * @param {(text: string) => string|null} transform 纯文本变换，返回 null 表示无需写入
 * @returns {{changed: boolean}} 抛错表示多次尝试后仍冲突
 */
function mutatePatchStamped(label, transform, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const { text, mtimeMs } = readPatchStamped();
    const newText = transform(text);
    if (newText === null) return { changed: false };
    if (newText === text) return { changed: false };
    if (safeWritePatchFile(newText, mtimeMs)) {
      return { changed: true };
    }
    // mtime 已变：其他写入者抢先——重读重试
  }
  throw new Error(`家级补丁文件并发修改冲突（${label}），请稍后重试`);
}

/**
 * 计算块 lines 中最后一个内容行（非注释、非空白）的索引；整块皆注释/空行返回 -1。
 */
function contentEndIndex(lines) {
  for (let k = lines.length - 1; k >= 0; k--) {
    const t = lines[k].trim();
    if (t !== '' && !t.startsWith('#')) return k;
  }
  return -1;
}

/**
 * 安全删除一个顶层块：块 lines 的尾部可能吸附了跟随其后、实际属于下一个块的
 * 注释与空行（parsePatchYaml 把非顶格 "- " 行全部归入当前块）。删除时只删除到
 * 最后一个内容行为止，把尾随注释保留为独立的注释块，避免误删下一块的注释头。
 */
function spliceBlockSafely(blocks, idx) {
  const block = blocks[idx];
  const endIdx = contentEndIndex(block.lines);
  if (endIdx < 0) {
    // 纯注释/空行块：直接整体删除
    blocks.splice(idx, 1);
    return;
  }
  const retained = block.lines.slice(endIdx + 1);
  const retainedComments = retained.filter((l) => l.trim() !== '');
  if (retainedComments.length > 0) {
    // 尾部吸附了注释行：保留它们（前面补一个空行分隔）
    blocks[idx] = {
      ...block,
      type: 'retained-comments',
      lines: ['', ...retainedComments],
      entries: []
    };
  } else {
    // 尾部只有空行：整块删除即可
    blocks.splice(idx, 1);
  }
}

/**
 * 从前一个块的尾部剪掉本管理器自动登记的停用注释行（'# ── dsh-plugin-manager 停用…'）
 * 及其前导空行——启用/卸载删除覆盖块时调用，避免残留孤儿注释。
 */
function stripAutoDisableComment(blocks, removedIdx) {
  if (removedIdx <= 0) return;
  const prev = blocks[removedIdx - 1];
  if (!prev || !Array.isArray(prev.lines)) return;
  const lines = prev.lines;
  for (let k = lines.length - 1; k >= 0; k--) {
    if (lines[k].includes('dsh-plugin-manager 停用')) {
      let cut = k;
      while (cut > 0 && lines[cut - 1].trim() === '') cut--;
      prev.lines = lines.slice(0, cut);
      return;
    }
  }
}

/**
 * 修改 Patch 中的条目启用/停用状态
 */
function patchToggleEntry(entryId, disabled) {
  if (!existsSync(PATCH_PATH)) {
    throw new Error(`找不到补丁文件: ${PATCH_PATH}`);
  }
  const transform = (originalText) => {
  const { blocks } = parsePatchYaml(originalText);

  let modified = false;
  let inHomeInsert = false;

  // 1. 查找是否存在于某个 insert 块中
  for (const block of blocks) {
    if (block.type === 'insert') {
      for (const entry of block.entries) {
        if (entry.id === entryId) {
          inHomeInsert = true;
          // 在 entry 的 lines 中调整 disabled
          const entryLines = entry.lines;
          let disabledLineIdx = -1;
          for (let k = 0; k < entryLines.length; k++) {
            if (/^\s+disabled:\s*(true|false)\s*$/.test(entryLines[k])) {
              disabledLineIdx = k;
              break;
            }
          }

          const fieldIndent = (entry.indent || '    ') + '  '; // 默认为 6 空格

          if (disabled) {
            if (disabledLineIdx >= 0) {
              entryLines[disabledLineIdx] = `${fieldIndent}disabled: true`;
            } else {
              // 插入到 name 后面或末尾
              let insertAt = 1;
              for (let k = 0; k < entryLines.length; k++) {
                if (/^\s+name:/.test(entryLines[k])) {
                  insertAt = k + 1;
                  break;
                }
              }
              entryLines.splice(insertAt, 0, `${fieldIndent}disabled: true`);
            }
          } else {
            // 启用：移除 disabled 行
            if (disabledLineIdx >= 0) {
              entryLines.splice(disabledLineIdx, 1);
            }
          }

          // 将修改同步回 block.lines
          const before = block.lines.slice(0, entry.startIdx);
          const after = block.lines.slice(entry.endIdx + 1);
          block.lines = [...before, ...entryLines, ...after];
          modified = true;
          break;
        }
      }
    }
    if (modified) break;
  }

  // 2. 如果不在家级 insert 块中（说明是内置插件/底层插件）
  if (!inHomeInsert) {
    // 查找是否已有独立覆盖块
    let overrideBlockIdx = -1;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.type === 'override' && block.entries.some(e => e.id === entryId)) {
        overrideBlockIdx = i;
        break;
      }
    }

    if (disabled) {
      // 停用内置插件：若已有覆盖块则确保 disabled: true，若无则追加新覆盖块
      if (overrideBlockIdx >= 0) {
        const block = blocks[overrideBlockIdx];
        let hasDisabled = false;
        for (let k = 0; k < block.lines.length; k++) {
          if (/^\s+disabled:\s*(true|false)/.test(block.lines[k])) {
            block.lines[k] = '  disabled: true';
            hasDisabled = true;
            break;
          }
        }
        if (!hasDisabled) {
          block.lines.push('  disabled: true');
        }
      } else {
        // 末尾追加独立覆盖块
        blocks.push({
          type: 'override',
          lines: [
            '',
            `# ── dsh-plugin-manager 停用（自动登记） ──`,
            `- id: ${entryId}`,
            `  disabled: true`
          ],
          entries: [{ id: entryId, disabled: true }]
        });
      }
      modified = true;
    } else {
      // 启用内置插件：移除对应的独立覆盖块（连带清理自动登记注释）
      if (overrideBlockIdx >= 0) {
        stripAutoDisableComment(blocks, overrideBlockIdx);
        spliceBlockSafely(blocks, overrideBlockIdx);
        modified = true;
      }
    }
  }

  if (modified) {
    // 重组文本
    const newLines = [];
    for (const b of blocks) {
      newLines.push(...b.lines);
    }
    return newLines.join('\n');
  }
  return null; // 无需变更
  };
  mutatePatchStamped(`toggle ${entryId}`, transform);
  return true;
}

/**
 * 追加安装插件到 Patch 末尾
 */
function patchAddInstallEntry(pkgName, entryId) {
  const transform = (originalText) => {
    const addition = [
      '',
      `# ── dsh-plugin-manager 安装的插件（自动登记，可删除本块） ──`,
      `- insert:`,
      `    - id: ${entryId}`,
      `      name: ${pkgName}`
    ].join('\n');

    return originalText.trimEnd() + '\n' + addition + '\n';
  };
  mutatePatchStamped(`install ${pkgName}`, transform);
}

/**
 * 从 Patch 中移除插件条目
 */
function patchRemoveEntry(entryId) {
  if (!existsSync(PATCH_PATH)) return;
  const transform = (originalText) => {
  const { blocks } = parsePatchYaml(originalText);

  let modified = false;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'insert') {
      const matchIdx = block.entries.findIndex(e => e.id === entryId);
      if (matchIdx >= 0) {
        if (block.entries.length === 1) {
          // 整个 insert 块只有这一个条目，整块安全删除（保留尾随注释）
          spliceBlockSafely(blocks, i);
          i--;
          modified = true;
        } else {
          // 仅删除该 entry 的行
          const entry = block.entries[matchIdx];
          const before = block.lines.slice(0, entry.startIdx);
          const after = block.lines.slice(entry.endIdx + 1);
          block.lines = [...before, ...after];
          block.entries.splice(matchIdx, 1);
          modified = true;
        }
      }
    } else if (block.type === 'override') {
      if (block.entries.some(e => e.id === entryId)) {
        stripAutoDisableComment(blocks, i);
        spliceBlockSafely(blocks, i);
        i--;
        modified = true;
      }
    }
  }

  if (modified) {
    const newLines = [];
    for (const b of blocks) {
      newLines.push(...b.lines);
    }
    return newLines.join('\n');
  }
  return null; // 未找到相关条目
  };
  mutatePatchStamped(`remove ${entryId}`, transform);
}

/**
 * =========================================================================
 * 包管理操作（spawn 执行器）
 * =========================================================================
 */

/**
 * 寻找可用的 dsh CLI 路径或 npm CLI 路径
 */
function resolveCliBin() {
  const dshArgvBin = process.argv[1];
  if (dshArgvBin && existsSync(dshArgvBin) && dshArgvBin.endsWith('bin.js')) {
    return { type: 'dsh', path: dshArgvBin };
  }
  const backendDshBin = join(BACKEND_DIR, 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
  if (existsSync(backendDshBin)) {
    return { type: 'dsh', path: backendDshBin };
  }
  if (existsSync(DEFAULT_NPM_CLI)) {
    return { type: 'npm', path: DEFAULT_NPM_CLI };
  }
  return { type: 'npm', path: 'npm' };
}

/**
 * 执行命令并捕获尾部输出
 */
function execCommand(command, args, cwd, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const logs = [];
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let timer = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        try { child.kill('SIGTERM'); } catch {}
        reject(new Error(`命令执行超时 (${Math.round(timeoutMs / 1000)}s): ${command} ${args.join(' ')}`));
      }, timeoutMs);
    }

    const appendLog = (data) => {
      const text = data.toString('utf8');
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (line.trim()) {
          logs.push(line);
          if (logs.length > 200) logs.shift();
        }
      }
    };

    child.stdout.on('data', appendLog);
    child.stderr.on('data', appendLog);

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) {
        resolve({ ok: true, log: logs.join('\n') });
      } else {
        reject(new Error(`命令退出异常 (code ${code}):\n${logs.slice(-30).join('\n')}`));
      }
    });
  });
}

/**
 * 探测已安装的所有模块名称（用于搜索结果对照）
 */
function getInstalledModuleNames() {
  const names = new Set();

  // 1. web profile package.json 依赖
  try {
    if (existsSync(WEB_PKG_JSON_PATH)) {
      const pkg = JSON.parse(readFileSync(WEB_PKG_JSON_PATH, 'utf8'));
      if (pkg.dependencies) Object.keys(pkg.dependencies).forEach(k => names.add(k));
      if (pkg.devDependencies) Object.keys(pkg.devDependencies).forEach(k => names.add(k));
    }
  } catch {}

  // 2. cordis.patch.yml 中的 name 属性
  try {
    const { insertEntries } = getHomePatchEntries();
    for (const entry of insertEntries.values()) {
      if (entry.name && !entry.name.startsWith('file://')) {
        names.add(entry.name);
      }
    }
  } catch {}

  return names;
}

/**
 * =========================================================================
 * Cordis 插件入口
 * =========================================================================
 */
export function apply(ctx) {
  const logger = ctx.logger ? ctx.logger('plugin-manager') : console;
  logger.info(`正在加载 dsh-plugin-manager 插件管理器 (v${PLUGIN_VERSION})...`);

  // 挂载 Web 路由
  const mountRoutes = (webCtx) => {
    const webServer = webCtx.get('webServer');
    if (!webServer || typeof webServer.register !== 'function') {
      logger.warn('webServer 服务尚未就绪或缺少 register 方法');
      return;
    }

    const handler = async (req, res) => {
      const urlObj = new URL(req.url, 'http://127.0.0.1');
      const pathname = urlObj.pathname;

      // 安全拦截校验
      const sec = validateRequestSecurity(req);
      if (!sec.ok) {
        logger.warn(`安全拦截 (${pathname}): ${sec.message}`);
        res.writeHead(sec.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: sec.message }));
        return;
      }

      const jsonRes = (statusCode, data) => {
        res.writeHead(statusCode, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        });
        res.end(JSON.stringify(data));
      };

      try {
        // 1. GET /plugin-manager/api/version
        if (pathname === '/plugin-manager/api/version' && req.method === 'GET') {
          return jsonRes(200, {
            ok: true,
            version: PLUGIN_VERSION,
            hostDshVersion: HOST_DSH_VERSION,
            compatibility: { dsh: '>=0.1.1-rc.2', tested: ['0.1.1-rc.2', '0.1.2-alpha.5', '0.1.3-alpha.2'] }
          });
        }

        // 2. GET /plugin-manager/api/status
        if (pathname === '/plugin-manager/api/status' && req.method === 'GET') {
          return jsonRes(200, {
            ok: true,
            busy: queueStatus.busy,
            current: queueStatus.current,
            last: queueStatus.last
          });
        }

        // 3. GET /plugin-manager/api/inventory
        if (pathname === '/plugin-manager/api/inventory' && req.method === 'GET') {
          const { insertEntries, overrideEntries } = getHomePatchEntries();
          const manifest = readManifest();
          const manifestEntryIds = new Set();
          for (const m of manifest) {
            manifestEntryIds.add(m.entryId);
            for (const rid of (m.bundleRowIds || [])) manifestEntryIds.add(rid);
          }

          const list = [];
          const seenCleanIds = new Set();
          const cleanId = (id) => (id || '').replace(/^include:/, '');

          // A. 遍历 ctx.loader.entries()
          const loader = ctx.get('loader') || ctx.loader;
          if (loader && typeof loader.entries === 'function') {
            for (const entry of loader.entries()) {
              if (entry.options?.group) continue;
              const entryId = entry.id;
              const cId = cleanId(entryId);
              const moduleName = entry.options?.name || '';
              const rawFiberPhase = entry.fiber?.state !== undefined ? FIBER_PHASE[entry.fiber.state] : null;
              const isHomeInsert = insertEntries.has(entryId) || insertEntries.has(cId);
              const override = overrideEntries.get(entryId) || overrideEntries.get(cId);

              // 启用状态判定：若 home patch 针对内置项有 disabled: true，则判定为 false
              let enabled = !entry.disabled;
              if (override && override.disabled) {
                enabled = false;
              }

              seenCleanIds.add(cId);
              seenCleanIds.add(entryId);

              const source = isHomeInsert ? 'home' : 'builtin';
              const cat = determineCategory(source, cId || entryId, moduleName, manifestEntryIds);
              const funcCat = determineFuncCategory(moduleName);
              // bundle 形态插件（行由包内 bundle 层挂载、经 manifest 跟踪）也可管理
              const manifestTracked = manifestEntryIds.has(cId || entryId);
              const assess = assessPackage(moduleName, readInstalledPkg(moduleName));

              list.push({
                entryId: cId || entryId,
                moduleName,
                enabled,
                phase: rawFiberPhase ?? 'unobserved',
                source,
                manageable: isHomeInsert || manifestTracked,
                category: cat,
                funcCategory: funcCat,
                route: assess.route,
                verdict: assess.verdict,
                dshRange: assess.dshRange,
                tested: assess.tested,
                enginesNode: assess.enginesNode
              });
            }
          }

          // B. 补充仅存在于 home patch 中但 loader 未加载（如 disabled: true）的条目
          for (const [id, item] of insertEntries.entries()) {
            if (!seenCleanIds.has(id) && !seenCleanIds.has(cleanId(id))) {
              const cat = determineCategory('home', id, item.name, manifestEntryIds);
              const funcCat = determineFuncCategory(item.name);
              const assess = assessPackage(item.name, readInstalledPkg(item.name));

              list.push({
                entryId: id,
                moduleName: item.name,
                enabled: !item.disabled,
                phase: item.disabled ? 'unobserved' : 'pending',
                source: 'home',
                manageable: true,
                category: cat,
                funcCategory: funcCat,
                route: assess.route,
                verdict: assess.verdict,
                dshRange: assess.dshRange,
                tested: assess.tested,
                enginesNode: assess.enginesNode
              });
            }
          }

          return jsonRes(200, { ok: true, entries: list });
        }

        // 4. GET /plugin-manager/api/search?q=xxx
        if (pathname === '/plugin-manager/api/search' && req.method === 'GET') {
          const q = urlObj.searchParams.get('q') || '';
          const searchQuery = q.trim() ? `${q.trim()} dsh` : 'dsh-plugin';
          const installedNames = getInstalledModuleNames();

          const fetchFromRegistry = async (registryUrl) => {
            const endpoint = `${registryUrl}/-/v1/search?text=${encodeURIComponent(searchQuery)}&size=25`;
            const response = await fetch(endpoint, {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(8000)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          };

          let data = null;
          try {
            data = await fetchFromRegistry('https://registry.npmmirror.com');
          } catch (e1) {
            logger.warn(`npmmirror 搜索失败 (${e1.message})，正在降级回退至 npmjs.org...`);
            try {
              data = await fetchFromRegistry('https://registry.npmjs.org');
            } catch (e2) {
              return jsonRes(500, { ok: false, error: `NPM 搜索请求失败: ${e2.message}` });
            }
          }

          const rawResults = data?.objects || [];
          // 并发拉取候选包 metadata（npmmirror 快），用于判定技术路线与版本兼容；
          // 单个失败不影响整体（unknown 兜底）。
          const metaBy = new Map();
          const NAMES = rawResults.map(i => i.package?.name).filter(Boolean).slice(0, 25);
          await Promise.all(NAMES.map(async (n) => {
            try {
              const enc = n.split('/').map(encodeURIComponent).join('/');
              const resp = await fetch(`https://registry.npmmirror.com/${enc}`, {
                signal: AbortSignal.timeout(6000)
              });
              if (resp.ok) {
                const meta = await resp.json();
                const latest = meta['dist-tags']?.latest || meta.version;
                const ver = meta.versions?.[latest] || meta;
                metaBy.set(n, ver);
              }
            } catch {}
          }));

          // GitHub star 数（社区热度）：从 repo 字段提取 GitHub 仓库，
          // 走 GitHub API + 内存缓存 + 并发池；限流/无 repo/失败一律静默降级。
          const starBy = new Map();
          await mapPool(NAMES, 6, async (n) => {
            const meta = metaBy.get(n);
            const repo = meta ? extractGitHubRepo(meta) : null;
            if (!repo) return;
            const stars = await fetchGitHubStars(repo);
            if (typeof stars === 'number') starBy.set(n, stars);
          });

          const results = rawResults.map((item) => {
            const pkg = item.package || {};
            const isInstalled = installedNames.has(pkg.name);
            const meta = metaBy.get(pkg.name) || null;
            const assess = assessPackage(pkg.name, meta);
            return {
              name: pkg.name,
              version: pkg.version,
              description: pkg.description || '',
              date: pkg.date || '',
              installed: isInstalled,
              route: assess.route,
              verdict: assess.verdict,
              dshRange: assess.dshRange,
              tested: assess.tested,
              enginesNode: assess.enginesNode,
              stars: starBy.get(pkg.name) ?? null,
              repoUrl: meta ? gitHubRepoUrl(meta) : null
            };
          });

          return jsonRes(200, { ok: true, results });
        }

        // 5. POST /plugin-manager/api/install
        if (pathname === '/plugin-manager/api/install' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const { name: pkgName, version } = body;
          if (!pkgName || typeof pkgName !== 'string') {
            return jsonRes(400, { ok: false, error: '缺少必需参数 name (npm 包名)' });
          }

          const pkgSpec = version ? `${pkgName}@${version}` : pkgName;
          const entryId = packageNameToEntryId(pkgName);

          const result = await runInQueue('install', pkgName, async () => {
            logger.info(`开始安装插件: ${pkgSpec} 到 ${WEB_PROFILE_DIR}`);
            const cli = resolveCliBin();
            let installRes;

            if (cli.type === 'dsh') {
              try {
                installRes = await execCommand(process.execPath, [cli.path, 'plugin', '--profile', 'web', 'add', pkgSpec], WEB_PROFILE_DIR);
              } catch (dshErr) {
                logger.warn(`dsh plugin add 执行失败 (${dshErr.message})，尝试 npm 安装兜底...`);
                installRes = await execCommand(process.execPath, [DEFAULT_NPM_CLI, 'install', pkgSpec, '--no-audit', '--no-fund', '--loglevel=error'], WEB_PROFILE_DIR);
              }
            } else {
              installRes = await execCommand(process.execPath, [cli.path, 'install', pkgSpec, '--no-audit', '--no-fund', '--loglevel=error'], WEB_PROFILE_DIR);
            }

            // 确认安装成功：检查 profiles/web/node_modules/<pkg>/package.json
            const targetPkgJsonPath = join(WEB_PROFILE_DIR, 'node_modules', ...pkgName.split('/'), 'package.json');
            if (!existsSync(targetPkgJsonPath)) {
              throw new Error(`安装完成后未找到 package.json: ${targetPkgJsonPath}`);
            }

            let installedVersion = version || '';
            let isBundle = false;
            let bundleRowIds = [];
            try {
              const installedPkg = JSON.parse(readFileSync(targetPkgJsonPath, 'utf8'));
              installedVersion = installedPkg.version || installedVersion;
              // 探测 bundle 形态：包内 dsh.bundle.patch 由官方 CLI 自动挂载为
              // profile 的 bundle 层，行随包安装/卸载自动存在/消失——此时
              // **不得**再写家级插入行（同包双 Loader 源 = 致命错误）。
              const bundlePatchRel = installedPkg?.dsh?.bundle?.patch;
              if (typeof bundlePatchRel === 'string' && bundlePatchRel) {
                const bundlePatchPath = join(WEB_PROFILE_DIR, 'node_modules', ...pkgName.split('/'), bundlePatchRel.replace(/^\.\//, ''));
                if (existsSync(bundlePatchPath)) {
                  const { blocks } = parsePatchYaml(readFileSync(bundlePatchPath, 'utf8'));
                  for (const b of blocks) {
                    if (b.type === 'insert') for (const e of b.entries) bundleRowIds.push(e.id);
                  }
                }
                if (bundleRowIds.length > 0) isBundle = true;
              }
            } catch {}

            if (!isBundle) {
              // 非 bundle 形态：包装上没有激活行，需要插件管理器在家级补丁登记激活
              patchAddInstallEntry(pkgName, entryId);
              logger.info(`插件 ${pkgSpec} 已登记至家级补丁 (${entryId})`);
            } else {
              // bundle 形态：bundle 层已自动挂载激活行，绝不写家级插入行
              logger.info(`插件 ${pkgSpec} 为 bundle 形态（bundle 层行 id: ${bundleRowIds.join(', ')}），跳过家级登记（避免双 Loader 源）`);
            }

            // 更新 Manifest 记录
            const manifest = readManifest();
            const filtered = manifest.filter(m => m.entryId !== entryId && !(m.bundleRowIds || []).includes(entryId));
            filtered.push({
              entryId,
              packageName: pkgName,
              version: installedVersion,
              installedAt: new Date().toISOString(),
              bundle: isBundle,
              bundleRowIds
            });
            saveManifest(filtered);

            logger.info(`插件 ${pkgSpec} 安装成功${isBundle ? '（bundle 形态，无家级登记）' : '并已登记至 cordis.patch.yml'}`);
            return { ok: true, version: installedVersion, log: installRes.log };
          });

          return jsonRes(200, result);
        }

        // 6. POST /plugin-manager/api/toggle
        if (pathname === '/plugin-manager/api/toggle' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const { entryId, disabled } = body;
          if (!entryId || typeof disabled !== 'boolean') {
            return jsonRes(400, { ok: false, error: '参数非法 (需要 entryId 与 disabled)' });
          }

          logger.info(`执行插件启停: ${entryId} -> ${disabled ? '停用' : '启用'}`);
          patchToggleEntry(entryId, disabled);
          return jsonRes(200, { ok: true });
        }

        // 7. POST /plugin-manager/api/uninstall
        if (pathname === '/plugin-manager/api/uninstall' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const { entryId } = body;
          if (!entryId) {
            return jsonRes(400, { ok: false, error: '缺少参数 entryId' });
          }

          const result = await runInQueue('uninstall', entryId, async () => {
            logger.info(`开始卸载插件: ${entryId}`);
            const { insertEntries } = getHomePatchEntries();
            const homeEntry = insertEntries.get(entryId);
            const manifest = readManifest();
            const manifestRecord = manifest.find(m => m.entryId === entryId || (m.bundleRowIds || []).includes(entryId));

            // 1. 由插件管理器安装的 npm 包
            if (manifestRecord) {
              const pkgName = manifestRecord.packageName;
              patchRemoveEntry(entryId);

              const cli = resolveCliBin();
              try {
                if (cli.type === 'dsh') {
                  await execCommand(process.execPath, [cli.path, 'plugin', '--profile', 'web', 'remove', pkgName], WEB_PROFILE_DIR);
                } else {
                  await execCommand(process.execPath, [cli.path, 'uninstall', pkgName, '--loglevel=error'], WEB_PROFILE_DIR);
                }
              } catch (e) {
                logger.warn(`卸载 npm 依赖警告 (${pkgName}): ${e.message}`);
              }

              const newManifest = manifest.filter(m => m.entryId !== entryId);
              saveManifest(newManifest);
              logger.info(`npm 插件 ${pkgName} (${entryId}) 已成功卸载`);
              return { ok: true };
            }

            // 2. 检查是否为本地自研 Junction 插件
            if (homeEntry && homeEntry.name && !homeEntry.name.startsWith('file://')) {
              const pkgName = homeEntry.name;
              const webJunction = join(DSH_HOME, 'profiles', 'web', 'node_modules', ...pkgName.split('/'));
              let isJunction = false;
              try {
                if (existsSync(webJunction)) {
                  const stat = lstatSync(webJunction);
                  isJunction = stat.isSymbolicLink() || (stat.isDirectory() && process.platform === 'win32');
                }
              } catch {}

              if (isJunction) {
                patchRemoveEntry(entryId);
                // 删除三处 junction（rmSync 不会深入递归目标，安全）
                const j1 = join(DSH_HOME, 'node_modules', ...pkgName.split('/'));
                const j2 = join(DSH_HOME, 'profiles', 'node_modules', ...pkgName.split('/'));
                const j3 = join(DSH_HOME, 'profiles', 'web', 'node_modules', ...pkgName.split('/'));
                [j1, j2, j3].forEach(p => {
                  try { if (existsSync(p)) rmSync(p, { recursive: true, force: true }); } catch {}
                });
                logger.info(`自研 Junction 插件 ${pkgName} (${entryId}) 接线已清除`);
                return { ok: true };
              }
            }

            // 3. 本地 file:// 插件
            if (homeEntry && homeEntry.name && homeEntry.name.startsWith('file://')) {
              patchRemoveEntry(entryId);
              logger.info(`本地 file:// 插件 ${entryId} 行已从补丁中移除（源码保留）`);
              return { ok: true };
            }

            // 4. 家级 insert 登记的其他插件
            if (homeEntry) {
              patchRemoveEntry(entryId);
              return { ok: true };
            }

            // 5. 官方内置插件
            throw new Error('官方内置插件只能停用，不支持卸载。');
          });

          return jsonRes(200, result);
        }

        // 默认 404
        return jsonRes(404, { ok: false, error: 'Endpoint Not Found' });
      } catch (err) {
        logger.error(`API 处理异常 (${pathname}):`, err);
        return jsonRes(500, { ok: false, error: err.message });
      }
    };

    webCtx.effect(() => {
      return webServer.register({
        kind: 'prefix',
        path: '/plugin-manager',
        handler
      });
    }, 'dsh-plugin-manager: routes');
  };

  // 依赖注入或兜底探测
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], mountRoutes);
  } else {
    mountRoutes(ctx);
  }
}

// 工具函数导出（供单测/外部复用；cordis 插件加载仅取 name/inject/apply，额外导出无害）
export { versionSatisfies, extractDshRange, assessPackage, parseSemver, extractGitHubRepo, fetchGitHubStars, mapPool };


