#!/usr/bin/env node
// Agents Factory — a central dashboard for assigning work to AI agents (Claude Code, Antigravity, Codex, Gemini…) on the local machine.
// No external dependencies: Node built-ins only.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');
const { spawn, execFile } = require('child_process');

const { buildAgents } = require('./agents');

const HOME = os.homedir();
// Per-machine config: hub.config.json (copied from hub.config.example.json). Environment variables take precedence.
const CFG_FILE = process.env.HUB_CONFIG || path.join(__dirname, 'hub.config.json');
const CFG = (() => { try { return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); } catch { return {}; } })();
const expandHome = p => (typeof p === 'string' ? p.replace(/^~(?=\/|$)/, HOME) : p);
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || expandHome(CFG.claudeConfigDir) || path.join(HOME, '.claude');
const CLAUDE_JSON = path.join(HOME, '.claude.json');
const SESSIONS_DIR = path.join(CLAUDE_DIR, 'projects');
const CLAUDE_BIN = process.env.CLAUDE_BIN || expandHome(CFG.agents && CFG.agents.claude && CFG.agents.claude.bin) || 'claude';
const PORT = Number(process.env.PORT) || Number(CFG.port) || 7420;
const HOST = process.env.HOST || CFG.host || '127.0.0.1';
const MAX_PARALLEL = Number(process.env.MAX_PARALLEL) || Number(CFG.maxParallel) || 4;
const IDLE_CLOSE_MS = (Number(process.env.IDLE_MINUTES) || Number(CFG.idleMinutes) || 15) * 60000;
const DATA = process.env.HUB_DATA || path.resolve(__dirname, expandHome(CFG.dataDir) || 'data');
const HUB_USER = { name: (CFG.user && CFG.user.name) || process.env.HUB_USER_NAME || os.userInfo().username.split('@')[0], avatar: (CFG.user && CFG.user.avatar) || '🧑‍💻' };
const AGENTS = buildAgents(CFG.agents || {});
if (AGENTS.claude) AGENTS.claude.bin = CLAUDE_BIN;
const LOGS = path.join(DATA, 'logs');
const UPLOADS = path.join(DATA, 'uploads');
const PUBLIC = path.join(__dirname, 'public');
const MAX_UPLOAD = 50 * 1024 * 1024;
const INLINE_IMAGE_MAX = 5 * 1024 * 1024;
fs.mkdirSync(LOGS, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

// ---------- Utilities ----------
const readJSON = (f, def = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } };
const writeJSON = (f, v) => { fs.writeFileSync(f + '.tmp', JSON.stringify(v, null, 2)); fs.renameSync(f + '.tmp', f); };
const exists = f => { try { fs.accessSync(f); return true; } catch { return false; } };
const isDir = f => { try { return fs.statSync(f).isDirectory(); } catch { return false; } };
const listDir = d => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };

// ---------- i18n for server-composed UI text ----------
// Dictionaries are public/i18n/<lang>/*.json (flat server.<area>.<name> keys); fallback order: lang → vi → key.
const LANGS = ['vi', 'en'];
const DICT = Object.fromEntries(LANGS.map(l => {
  const dir = path.join(PUBLIC, 'i18n', l);
  const d = {};
  for (const f of listDir(dir).filter(f => f.isFile() && f.name.endsWith('.json'))) {
    try { Object.assign(d, JSON.parse(fs.readFileSync(path.join(dir, f.name), 'utf8'))); } catch (e) { console.error(`i18n: cannot read ${l}/${f.name}: ${e.message}`); }
  }
  return [l, d];
}));
function tr(lang, key, params) {
  const s = (DICT[lang] && DICT[lang][key]) ?? DICT.vi[key] ?? key;
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s;
}
const reqLang = req => (String(req.headers['x-lang'] || '').toLowerCase() === 'en' ? 'en' : 'vi');
// Error carrying a translation key, translated by the request handler that catches it
const keyedError = (key, params, extra) => Object.assign(new Error(tr('vi', key, params)), { key, params }, extra);
const errBody = (lang, key, params) => ({ error: tr(lang, key, params), errorKey: key });
// Persisted / broadcast text: Vietnamese fallback plus key so the UI can re-translate it
const keyedText = (key, params) => ({ text: tr('vi', key, params), textKey: key, ...(params ? { params } : {}) });
// Same for a task field (lastText, note): <field>, <field>Key, <field>Params
const keyedField = (field, key, params) => ({ [field]: tr('vi', key, params), [field + 'Key']: key, [field + 'Params']: params || undefined });
const tilde = p => (p.startsWith(HOME) ? '~' + p.slice(HOME.length) : p);
const semverCmp = (a, b) => {
  const pa = String(a).split(/[.-]/).map(n => parseInt(n, 10) || 0), pb = String(b).split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};
const dayKey = ts => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const modelFamily = m => {
  const s = String(m || '').toLowerCase();
  return s.includes('opus') ? 'Opus' : s.includes('sonnet') ? 'Sonnet' : s.includes('haiku') ? 'Haiku' : s.includes('fable') ? 'Fable' : 'Other';
};

// Mask sensitive values in the MCP config before sending it to the browser
function maskStr(s) {
  return String(s)
    .replace(/((?:pass(?:word)?|pwd|token|secret|api[_-]?key)\s*[=:]\s*)[^\s&,;]+/gi, '$1••••')
    .replace(/(\/\/[^:/\s@]+:)[^@\s]+@/g, '$1••••@')
    .replace(/(^|[\s=])([\w.-]+\/)[^@\s/]+@/g, '$1$2••••@');
}
function maskServer(s = {}) {
  const o = { type: s.type || (s.url ? 'http' : 'stdio') };
  if (s.command) o.command = s.command;
  if (Array.isArray(s.args)) o.args = s.args.map(maskStr);
  if (s.url) o.url = maskStr(s.url);
  if (s.env) o.env = Object.keys(s.env);
  if (s.headers) o.headers = Object.keys(s.headers);
  return o;
}

// ---------- Hub config ----------
const HUB_FILE = path.join(DATA, 'hub.json');
const hubCfg = () => Object.assign({ extraProjects: [], hidden: [], favorites: [], order: [], workspaces: [], autoCleanupDays: 0, uploadsCleanupDays: 0, names: {} }, readJSON(HUB_FILE, {}));
// session name set by the user in the Hub (takes precedence over Claude's auto-generated title)
const sessTitle = (s, names = hubCfg().names, lang = 'vi') => names[s.id] || s.customTitle || s.aiTitle || s.firstPrompt || tr(lang, 'server.session.untitled');
const saveHub = c => writeJSON(HUB_FILE, c);

// ---------- Read local Claude config ----------
function gitBranch(p) {
  let d = p;
  for (let i = 0; i < 6 && d !== path.dirname(d); i++, d = path.dirname(d)) {
    const head = path.join(d, '.git', 'HEAD');
    if (exists(head)) {
      const h = fs.readFileSync(head, 'utf8').trim();
      return h.startsWith('ref:') ? h.replace(/^ref:\s*refs\/heads\//, '') : h.slice(0, 8);
    }
  }
  return null;
}

function mdFiles(dir) {
  return listDir(dir).filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name.replace(/\.md$/, ''));
}
function skillDirs(dir) {
  return listDir(dir).filter(e => (e.isDirectory() || e.isSymbolicLink()) && exists(path.join(dir, e.name, 'SKILL.md'))).map(e => e.name);
}

function installedPlugins() {
  return (readJSON(path.join(CLAUDE_DIR, 'plugins', 'installed_plugins.json'), {}) || {}).plugins || {};
}

function pluginMeta(installPath) {
  const pj = readJSON(path.join(installPath, '.claude-plugin', 'plugin.json'), {}) || {};
  const mcpFile = readJSON(path.join(installPath, '.mcp.json'), null);
  const mcp = mcpFile ? (mcpFile.mcpServers || mcpFile) : (pj.mcpServers && typeof pj.mcpServers === 'object' ? pj.mcpServers : {});
  return {
    description: pj.description || '',
    author: pj.author && (pj.author.name || pj.author) || '',
    commands: mdFiles(path.join(installPath, 'commands')),
    agents: mdFiles(path.join(installPath, 'agents')),
    skills: skillDirs(path.join(installPath, 'skills')),
    hooks: exists(path.join(installPath, 'hooks')),
    mcp: Object.keys(mcp || {}),
  };
}

function resolvePluginInstall(key, projectPath) {
  const entries = installedPlugins()[key] || [];
  const e = entries.find(x => projectPath && x.projectPath === projectPath)
    || entries.find(x => x.scope === 'user')
    || entries.slice().sort((a, b) => semverCmp(a.version, b.version)).pop();
  if (e && isDir(e.installPath)) return e;
  // fallback: look up the latest version in the cache
  const [name, market] = key.split('@');
  const base = path.join(CLAUDE_DIR, 'plugins', 'cache', market || '', name || '');
  const vers = listDir(base).filter(d => d.isDirectory()).map(d => d.name).sort(semverCmp);
  return vers.length ? { installPath: path.join(base, vers.at(-1)), version: vers.at(-1), scope: 'cache' } : null;
}

function settingsLayers(p) {
  const layers = [
    { scope: 'user', file: path.join(CLAUDE_DIR, 'settings.json') },
    { scope: 'user-local', file: path.join(CLAUDE_DIR, 'settings.local.json') },
  ];
  if (p && p !== HOME) {
    layers.push({ scope: 'project', file: path.join(p, '.claude', 'settings.json') });
    layers.push({ scope: 'local', file: path.join(p, '.claude', 'settings.local.json') });
  }
  return layers.map(l => ({ ...l, data: readJSON(l.file, null) })).filter(l => l.data);
}

function projectConfig(p) {
  const cj = readJSON(CLAUDE_JSON, {}) || {};
  const pj = (cj.projects || {})[p] || {};
  const layers = settingsLayers(p);

  // Default model / permission (later layers override earlier ones)
  let model = null, defaultMode = null;
  const enabled = {};
  for (const l of layers) {
    if (l.data.model) model = l.data.model;
    if (l.data.permissions && l.data.permissions.defaultMode) defaultMode = l.data.permissions.defaultMode;
    for (const [k, v] of Object.entries(l.data.enabledPlugins || {})) enabled[k] = { on: !!v, scope: l.scope };
  }

  const plugins = Object.entries(enabled).map(([key, v]) => {
    const inst = resolvePluginInstall(key, p);
    const meta = inst ? pluginMeta(inst.installPath) : null;
    return { key, enabled: v.on, scope: v.scope, version: inst && inst.version, installed: !!inst, ...(meta || {}) };
  });

  // MCP servers in the same order Claude Code loads them
  const mcp = [];
  for (const [name, s] of Object.entries(cj.mcpServers || {})) mcp.push({ name, scope: 'user', ...maskServer(s) });
  for (const [name, s] of Object.entries(pj.mcpServers || {})) mcp.push({ name, scope: 'local', ...maskServer(s) });
  const mcpJson = p !== HOME && readJSON(path.join(p, '.mcp.json'), null);
  if (mcpJson) {
    const approvedAll = layers.some(l => l.data.enableAllProjectMcpServers);
    for (const [name, s] of Object.entries(mcpJson.mcpServers || {})) {
      const approved = approvedAll || (pj.enabledMcpjsonServers || []).includes(name) || layers.some(l => (l.data.enabledMcpjsonServers || []).includes(name));
      const disabled = (pj.disabledMcpjsonServers || []).includes(name);
      mcp.push({ name, scope: 'project', approved, disabled, ...maskServer(s) });
    }
  }
  for (const pl of plugins.filter(x => x.enabled && x.mcp && x.mcp.length)) {
    for (const name of pl.mcp) mcp.push({ name, scope: 'plugin', plugin: pl.key, type: 'plugin' });
  }

  const claudeMd = [path.join(p, 'CLAUDE.md'), path.join(p, '.claude', 'CLAUDE.md'), path.join(p, 'CLAUDE.local.md')].filter(exists);
  let claudeMdPreview = '';
  if (claudeMd[0]) { try { claudeMdPreview = fs.readFileSync(claudeMd[0], 'utf8').slice(0, 4000); } catch { /* ignore */ } }

  return {
    path: p, display: tilde(p), name: path.basename(p) || p,
    branch: gitBranch(p), model, defaultMode,
    claudeMd: claudeMd.map(tilde), claudeMdPreview,
    settingsFiles: layers.map(l => ({ scope: l.scope, file: tilde(l.file) })),
    mcp, plugins,
    commands: { user: mdFiles(path.join(CLAUDE_DIR, 'commands')), project: p === HOME ? [] : mdFiles(path.join(p, '.claude', 'commands')) },
    agents: { user: mdFiles(path.join(CLAUDE_DIR, 'agents')), project: p === HOME ? [] : mdFiles(path.join(p, '.claude', 'agents')) },
    skills: { user: skillDirs(path.join(CLAUDE_DIR, 'skills')), project: p === HOME ? [] : skillDirs(path.join(p, '.claude', 'skills')) },
    allowedTools: [...new Set(layers.flatMap(l => (l.data.permissions && l.data.permissions.allow) || []))].length,
    lastSessionId: pj.lastSessionId || null,
  };
}

function projectSummary(p) {
  const c = projectConfig(p);
  return {
    path: p, display: c.display, name: c.name, branch: c.branch, model: c.model,
    hasClaudeMd: c.claudeMd.length > 0,
    mcpCount: c.mcp.filter(m => !m.disabled).length,
    pluginCount: c.plugins.filter(x => x.enabled).length,
    lastSessionId: c.lastSessionId,
  };
}

function allProjectPaths() {
  const cj = readJSON(CLAUDE_JSON, {}) || {};
  const hub = hubCfg();
  return [...new Set([...Object.keys(cj.projects || {}), ...hub.extraProjects])].filter(isDir);
}

function discoverProjects() {
  const hub = hubCfg();
  const rank = p => { const i = hub.order.indexOf(p); return i < 0 ? 1e6 : i; };
  return allProjectPaths()
    .filter(p => !hub.hidden.includes(p))
    .map(p => ({ ...projectSummary(p), favorite: hub.favorites.includes(p) }))
    // order: user drag-and-drop order first, then unsorted new projects by name
    .sort((a, b) => (rank(a.path) - rank(b.path)) || (b.favorite - a.favorite) || a.name.localeCompare(b.name));
}

function pluginCatalog() {
  const base = path.join(CLAUDE_DIR, 'plugins', 'cache');
  const inst = installedPlugins();
  const userEnabled = Object.assign({}, ...settingsLayers(null).map(l => l.data.enabledPlugins || {}));
  const enabledIn = {};
  for (const p of allProjectPaths()) {
    for (const l of settingsLayers(p).filter(l => l.scope === 'project' || l.scope === 'local')) {
      for (const [k, v] of Object.entries(l.data.enabledPlugins || {})) if (v) (enabledIn[k] = enabledIn[k] || new Set()).add(tilde(p));
    }
  }
  const out = [];
  for (const m of listDir(base).filter(d => d.isDirectory())) {
    for (const pl of listDir(path.join(base, m.name)).filter(d => d.isDirectory())) {
      const vers = listDir(path.join(base, m.name, pl.name)).filter(d => d.isDirectory()).map(d => d.name).sort(semverCmp);
      if (!vers.length) continue;
      const key = `${pl.name}@${m.name}`;
      out.push({
        key, name: pl.name, marketplace: m.name, version: vers.at(-1), versions: vers,
        installed: !!inst[key], userEnabled: !!userEnabled[key],
        enabledIn: [...(enabledIn[key] || [])],
        ...pluginMeta(path.join(base, m.name, pl.name, vers.at(-1))),
      });
    }
  }
  return out.sort((a, b) => (b.userEnabled - a.userEnabled) || a.key.localeCompare(b.key));
}

let claudeVersion = '', claudeMissing = false;
execFile(CLAUDE_BIN, ['--version'], (e, out) => { claudeMissing = !!e; claudeVersion = e ? '' : out.trim(); });
// detect which agents are installed (and their versions)
const agentInfo = {};
for (const a of Object.values(AGENTS)) {
  execFile(expandHome(a.bin), ['--version'], { timeout: 15000 }, (e, out, err) => {
    agentInfo[a.key] = e && e.code === 'ENOENT' ? { available: false } : { available: true, version: String(out || err || '').trim().split('\n')[0].slice(0, 60) };
  });
}
const agentList = () => Object.values(AGENTS).map(a => ({ key: a.key, label: a.label, icon: a.icon, color: a.color, models: a.models, modes: a.modes, custom: !!a.custom,
  available: agentInfo[a.key] ? agentInfo[a.key].available : null, version: agentInfo[a.key] && agentInfo[a.key].version }));

function curLimit() {
  const a = currentAccount();
  if (!a) return rateLimit;
  return acct.limits[a.email] || (rateLimit && !rateLimit.account ? rateLimit : null);
}
function overview(lang = 'vi') {
  const user = projectConfig(HOME);
  return {
    claudeVersion: claudeVersion || (claudeMissing ? tr(lang, 'server.overview.claudeNotFound') : ''), home: tilde(HOME), homePath: HOME, maxParallel: MAX_PARALLEL, me: HUB_USER, agents: agentList(),
    user: { model: user.model, mcp: user.mcp.filter(m => m.scope === 'user'), plugins: user.plugins },
    projects: discoverProjects(),
    hiddenProjects: hubCfg().hidden.filter(isDir).map(p => ({ path: p, name: path.basename(p), display: tilde(p) })),
    workspaces: hubCfg().workspaces,
    rateLimit: curLimit(),
    account: currentAccount(),
    settings: { autoCleanupDays: hubCfg().autoCleanupDays, uploadsCleanupDays: hubCfg().uploadsCleanupDays },
  };
}

// ---------- Past sessions (~/.claude/projects/*/*.jsonl) ----------
// Incremental scan: jsonl files are append-only, so store the offset and read only new data.
const SCAN_CACHE_FILE = path.join(DATA, 'sessions-cache.json');
const SCAN_V = 2; // bump when aggregation changes → rescan from scratch
const scanCache = readJSON(SCAN_CACHE_FILE, {}) || {};
for (const k of Object.keys(scanCache)) if (scanCache[k].v !== SCAN_V) delete scanCache[k];

// ---------- Claude accounts: the user switches accounts often → record which account was logged in when, to split tokens per account ----------
const ACCT_FILE = path.join(DATA, 'accounts.json');
const acct = Object.assign({ timeline: [], limits: {} }, readJSON(ACCT_FILE, {}));
function currentAccount() {
  const a = (readJSON(CLAUDE_JSON, {}) || {}).oauthAccount;
  if (!a || !a.emailAddress) return null;
  return { email: a.emailAddress, name: a.displayName || a.fullName || '', org: a.organizationName || '', plan: a.organizationType || a.billingType || '', tier: a.userRateLimitTier || a.organizationRateLimitTier || '', since: a.profileFetchedAt ? Date.parse(a.profileFetchedAt) || null : null };
}
function trackAccount() {
  const a = currentAccount();
  if (!a) return;
  const last = acct.timeline[acct.timeline.length - 1];
  if (last && last.email === a.email) return;
  // Claude Code doesn't store the account per session → only known since the Hub started recording; earlier is "unknown"
  const at = Date.now();
  const { since, ...info } = a;
  acct.timeline.push({ at, ...info });
  writeJSON(ACCT_FILE, acct);
  if (last) broadcast({ type: 'account', account: info });
}
const accountAt = ts => { let r = null; for (const e of acct.timeline) { if (e.at <= ts) r = e.email; else break; } return r; };
trackAccount();
setInterval(trackAccount, 20000);
let scanning = false, lastScanAt = 0;

function newSessionState(id, file) {
  return {
    id, file, offset: 0, cwd: null, aiTitle: null, customTitle: null, firstPrompt: null,
    firstAt: null, lastAt: null, prompts: 0, models: {},
    tokens: { in: 0, out: 0, cr: 0, cw: 0 }, days: {}, runs: {}, recentIds: [], acct: {}, v: SCAN_V,
  };
}
function addUsage(s, msg, ts) {
  const u = msg.usage;
  if (!u || !msg.id || msg.model === '<synthetic>') return;
  if (s.recentIds.includes(msg.id)) return; // each content block is its own line with the same message id
  s.recentIds.push(msg.id);
  if (s.recentIds.length > 40) s.recentIds.shift();
  const add = { in: u.input_tokens || 0, out: u.output_tokens || 0, cr: u.cache_read_input_tokens || 0, cw: u.cache_creation_input_tokens || 0 };
  for (const k in add) s.tokens[k] += add[k];
  const fam = modelFamily(msg.model);
  s.models[fam] = (s.models[fam] || 0) + add.out;
  if (ts) {
    const d = (s.days[dayKey(ts)] = s.days[dayKey(ts)] || {});
    const b = (d[fam] = d[fam] || { in: 0, out: 0, cr: 0, cw: 0 });
    for (const k in add) b[k] += add[k];
    // by the account logged in at that time ('?' = before the Hub started tracking)
    const ak = accountAt(ts) || '?';
    const ad = ((s.acct[ak] = s.acct[ak] || {})[dayKey(ts)] = s.acct[ak][dayKey(ts)] || { in: 0, out: 0, cr: 0, cw: 0 });
    for (const k in add) ad[k] += add[k];
  }
}
function userText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  return '';
}
function isRealPrompt(o) {
  if (o.isMeta || o.isSidechain || !o.message) return false;
  const c = o.message.content;
  if (Array.isArray(c) && c.some(b => b.type === 'tool_result')) return false;
  const t = userText(c).trim();
  return t && !t.startsWith('<local-command') && !t.startsWith('<system-reminder') && !t.startsWith('Caveat:');
}

function eachLine(file, start, fn) {
  return new Promise(resolve => {
    let bytes = start;
    const rl = readline.createInterface({ input: fs.createReadStream(file, { start }), crlfDelay: Infinity });
    rl.on('line', line => { bytes += Buffer.byteLength(line) + 1; fn(line); });
    rl.on('close', () => resolve(bytes));
    rl.on('error', () => resolve(bytes));
  });
}

function scanLine(s, line, usageOnly) {
  // skip large, unneeded lines before parsing
  if (line.length > 200000 && !line.includes('"type":"assistant"')) return;
  if (line.includes('"type":"api-request') || line.includes('"type":"attachment"') || line.includes('"type":"file-history')) return;
  let o;
  try { o = JSON.parse(line); } catch { return; }
  const ts = o.timestamp ? Date.parse(o.timestamp) : null;
  if (o.type === 'assistant' && o.message) { addUsage(s, o.message, ts); if (!usageOnly && ts) s.lastAt = ts; return; }
  if (usageOnly) return;
  if (o.type === 'user') {
    if (!s.cwd && o.cwd) s.cwd = o.cwd;
    if (ts) { s.firstAt = s.firstAt || ts; s.lastAt = ts; }
    if (isRealPrompt(o)) {
      s.prompts++;
      if (!s.firstPrompt) {
        const t = userText(o.message.content).trim();
        const cmd = t.match(/<command-name>([^<]+)<\/command-name>/);
        s.firstPrompt = (cmd ? cmd[1] : t).slice(0, 160);
      }
    }
  } else if (o.type === 'ai-title') s.aiTitle = o.aiTitle;
  else if (o.type === 'custom-title') s.customTitle = o.customTitle;
  else if (o.type === 'cost-state' && o.startTime) s.runs[o.startTime] = Math.max(s.runs[o.startTime] || 0, o.totalCostUSD || 0);
}

async function scanFile(file, id) {
  const st = fs.statSync(file);
  let s = scanCache[file];
  if (s && s.offset === st.size) return s;
  if (!s || st.size < s.offset) s = newSessionState(id, file); // file was rewritten -> rescan from the start
  s.offset = await eachLine(file, s.offset, line => scanLine(s, line, false));
  // sub-agent tokens live in <id>/subagents/*.jsonl
  const subdir = path.join(path.dirname(file), id, 'subagents');
  s.sub = s.sub || {};
  for (const e of listDir(subdir).filter(e => e.name.endsWith('.jsonl'))) {
    const f = path.join(subdir, e.name);
    const size = fs.statSync(f).size;
    const prev = s.sub[e.name] || 0;
    if (size > prev) s.sub[e.name] = await eachLine(f, prev, line => scanLine(s, line, true));
  }
  s.size = st.size;
  s.mtime = st.mtimeMs;
  scanCache[file] = s;
  return s;
}

async function scanSessions() {
  if (scanning) return;
  scanning = true;
  try {
    for (const d of listDir(SESSIONS_DIR).filter(d => d.isDirectory())) {
      for (const f of listDir(path.join(SESSIONS_DIR, d.name)).filter(f => f.isFile() && f.name.endsWith('.jsonl'))) {
        try { await scanFile(path.join(SESSIONS_DIR, d.name, f.name), f.name.slice(0, -6)); } catch { /* file is mid-write */ }
      }
    }
    for (const f of Object.keys(scanCache)) if (!exists(f)) delete scanCache[f];
    writeJSON(SCAN_CACHE_FILE, scanCache);
    lastScanAt = Date.now();
    broadcast({ type: 'sessions-updated' });
  } finally { scanning = false; }
}

// sessions running in the background (claude --bg / backgrounded terminal sessions) — from `claude agents --json`
let bgAgents = { at: 0, map: {}, pending: null };
function loadBgAgents() {
  if (bgAgents.pending) return bgAgents.pending;
  bgAgents.at = Date.now();
  bgAgents.pending = new Promise(done => execFile(CLAUDE_BIN, ['agents', '--json'], { timeout: 20000, maxBuffer: 4e6 }, (e, out) => {
    bgAgents.pending = null;
    if (!e) try {
      const map = {};
      for (const a of JSON.parse(out)) if (a.sessionId && a.kind === 'background') map[a.sessionId] = { id: a.id, sessionId: a.sessionId, state: a.state, status: a.status, name: a.name, pid: a.pid || null, cwd: a.cwd || null, startedAt: a.startedAt || null };
      bgAgents.map = map;
    } catch { /* ignore */ }
    done(bgAgents.map);
  }));
  return bgAgents.pending;
}
function refreshBgAgents() { if (Date.now() - bgAgents.at >= 30000) loadBgAgents(); }
const bgFresh = maxAge => (Date.now() - bgAgents.at < maxAge ? Promise.resolve(bgAgents.map) : loadBgAgents());
const sessionCost = s => Object.values(s.runs || {}).reduce((a, b) => a + b, 0);
// Every CLI session a Hub chat has gone through: the session it was opened from (unless forked — the original then
// lives on separately), the ones left behind by /clear or an agent switch, and the current one. One chat = one entry.
const sessionChain = t => [...new Set([t.fork ? null : t.historySessionId, ...(t.pastSessions || []).map(x => x.sessionId), t.sessionId].filter(Boolean))];
const taskOfSession = id => [...tasks.values()].find(t => sessionChain(t).includes(id));
// a chat moved on to a new session id (/clear in the CLI, agent switch …) → keep the old one in the chain
function noteSessionChange(t, id) {
  if (t.sessionId && id && id !== t.sessionId && !(t.pastSessions || []).some(x => x.sessionId === t.sessionId))
    t.pastSessions = [...(t.pastSessions || []), { agent: t.agent || 'claude', sessionId: t.sessionId, until: Date.now() }];
}
function sessionList(project, lang = 'vi') {
  refreshBgAgents();
  const live = new Set([...tasks.values()].filter(t => procs.has(t.id)).flatMap(sessionChain));
  const names = hubCfg().names;
  const list = Object.values(scanCache)
    .filter(s => s.cwd && (s.prompts > 0 || s.tokens.out > 0) && (!project || s.cwd === project))
    .map(s => ({
      id: s.id, cwd: s.cwd, project: path.basename(s.cwd), projectDisplay: tilde(s.cwd),
      title: sessTitle(s, names, lang), renamed: !!names[s.id],
      firstPrompt: s.firstPrompt, firstAt: s.firstAt, lastAt: s.lastAt || s.mtime, prompts: s.prompts,
      tokens: s.tokens, cost: sessionCost(s), models: s.models, size: s.size,
      recentlyActive: Date.now() - s.mtime < 120000, inHub: live.has(s.id),
      hubTask: (taskOfSession(s.id) || {}).id || null,
      bg: bgAgents.map[s.id] || null,
    }))
    .sort((a, b) => b.lastAt - a.lastAt);
  return mergeChains(list);
}
// Sessions of the same Hub chat collapse into the most recent one, with totals summed and the others in `parts`
function mergeChains(list) {
  const byTask = new Map();
  for (const x of list) if (x.hubTask) { if (!byTask.has(x.hubTask)) byTask.set(x.hubTask, []); byTask.get(x.hubTask).push(x); }
  const drop = new Set();
  for (const group of byTask.values()) {
    if (group.length < 2) continue;
    const [head, ...rest] = group; // list is newest first
    const t = tasks.get(head.hubTask);
    head.parts = group.map(x => ({ id: x.id, title: x.title, firstAt: x.firstAt, lastAt: x.lastAt, prompts: x.prompts, size: x.size, cost: x.cost }))
      .sort((a, b) => (a.firstAt || a.lastAt) - (b.firstAt || b.lastAt));
    head.originId = head.parts[0].id; // shown as the session's ID; `id` stays the live file (resume, terminal)
    head.title = t ? t.title : head.title;
    for (const x of rest) {
      drop.add(x);
      head.prompts += x.prompts; head.size += x.size || 0; head.cost += x.cost;
      for (const k of Object.keys(head.tokens)) head.tokens[k] = (head.tokens[k] || 0) + (x.tokens[k] || 0);
      for (const [m, n] of Object.entries(x.models || {})) head.models[m] = (head.models[m] || 0) + n;
      head.firstAt = Math.min(head.firstAt || Infinity, x.firstAt || Infinity);
      head.recentlyActive = head.recentlyActive || x.recentlyActive; head.inHub = head.inHub || x.inHub;
    }
  }
  return list.filter(x => !drop.has(x));
}
const findSession = id => Object.values(scanCache).find(s => s.id === id);

// Replay a past session's conversation as chat panel events
async function sessionTranscript(id, before) {
  const s = findSession(id);
  if (!s || !exists(s.file)) return [];
  const evs = [];
  await eachLine(s.file, 0, line => lineToEvents(line, evs, before));
  return evs.slice(-500);
}
// Live-view a background session (terminal / claude --bg): read newly appended data from the previous byte offset
function sessionTail(id, offset, lang = 'vi') {
  const s = findSession(id);
  if (!s || !exists(s.file)) return null;
  const size = fs.statSync(s.file).size;
  let start = offset >= 0 && offset <= size ? offset : Math.max(0, size - 600 * 1024); // first time: last ~600KB
  const len = Math.min(size - start, 4 * 1024 * 1024);
  const buf = Buffer.alloc(len);
  const fd = fs.openSync(s.file, 'r');
  try { fs.readSync(fd, buf, 0, len, start); } finally { fs.closeSync(fd); }
  let text = buf.toString('utf8');
  let skip = 0;
  if (offset < 0 && start > 0) { skip = text.indexOf('\n') + 1; text = text.slice(skip); } // drop the truncated first line
  const end = text.lastIndexOf('\n'); // last line may be mid-write → leave it for next time
  if (end < 0) return { offset: start + skip, size, events: [], mtime: fs.statSync(s.file).mtimeMs };
  const evs = [];
  for (const line of text.slice(0, end).split('\n')) if (line) lineToEvents(line, evs, 0);
  return { offset: start + skip + Buffer.byteLength(text.slice(0, end + 1)), size, events: evs.slice(-600), mtime: fs.statSync(s.file).mtimeMs, title: sessTitle(s, undefined, lang), cwd: s.cwd };
}
function lineToEvents(line, evs, before) {
  {
    if (!(line.includes('"type":"user"') || line.includes('"type":"assistant"'))) return;
    if (line.includes('"type":"api-request')) return;
    let o;
    try { o = JSON.parse(line); } catch { return; }
    if (o.isSidechain || !o.message || (o.type !== 'user' && o.type !== 'assistant')) return;
    const at = o.timestamp ? Date.parse(o.timestamp) : 0;
    if (before && at > before) return;
    const c = o.message.content;
    if (o.type === 'user') {
      if (Array.isArray(c)) {
        for (const b of c) if (b.type === 'tool_result') evs.push({ k: 'tool_result', id: b.tool_use_id, isError: !!b.is_error, text: clip(toolResultText(b.content), 3000), at });
      }
      if (!isRealPrompt(o)) return;
      let t = userText(c).trim();
      const cmd = t.match(/<command-name>([^<]+)<\/command-name>[\s\S]*?(?:<command-args>([\s\S]*?)<\/command-args>)?/);
      if (cmd) t = `${cmd[1]} ${cmd[2] || ''}`.trim();
      const imgs = Array.isArray(c) ? c.filter(b => b.type === 'image').length : 0;
      evs.push({ k: 'user', text: t, files: imgs ? [{ name: tr('vi', 'server.history.images', { n: imgs }), nameKey: 'server.history.images', params: { n: imgs }, isImage: true }] : undefined, at });
    } else {
      for (const b of c || []) {
        if (b.type === 'text' && b.text.trim()) evs.push({ k: 'text', text: b.text, at });
        else if (b.type === 'thinking' && b.thinking) evs.push({ k: 'thinking', text: clip(b.thinking, 3000), at });
        else if (b.type === 'tool_use') evs.push({ k: 'tool', id: b.id, name: b.name, input: b.input, at });
      }
    }
  }
}

// ---------- Token stats ----------
const RATE_FILE = path.join(DATA, 'ratelimit.json');
let rateLimit = readJSON(RATE_FILE, null);

// Local token usage split by account over the selected date range
function accountUsage(sessions, keys) {
  const inRange = new Set(keys);
  const by = {};
  for (const s of sessions) for (const [email, days] of Object.entries(s.acct || {})) {
    for (const [day, u] of Object.entries(days)) {
      if (!inRange.has(day)) continue;
      const b = (by[email] = by[email] || { email, in: 0, out: 0, cr: 0, cw: 0, sessions: new Set(), lastDay: '' });
      for (const k of ['in', 'out', 'cr', 'cw']) b[k] += u[k] || 0;
      b.sessions.add(s.id);
      if (day > b.lastDay) b.lastDay = day;
    }
  }
  const cur = currentAccount();
  const info = {};
  for (const e of acct.timeline) info[e.email] = e;
  const emails = new Set([...Object.keys(by), ...acct.timeline.map(e => e.email)]);
  return {
    current: cur && cur.email,
    trackedSince: acct.timeline.length ? acct.timeline[0].at : null,
    switches: acct.timeline.map(e => ({ at: e.at, email: e.email })),
    list: [...emails].map(email => {
      const b = by[email] || { in: 0, out: 0, cr: 0, cw: 0, sessions: new Set(), lastDay: '' };
      const i = info[email] || {};
      return { email, name: i.name || '', org: i.org || '', plan: i.plan || '', tier: i.tier || '', in: b.in, out: b.out, cr: b.cr, cw: b.cw, sessions: b.sessions.size, lastDay: b.lastDay, limit: acct.limits[email] || null };
    }).sort((a, b) => (b.email === (cur && cur.email)) - (a.email === (cur && cur.email)) || b.out - a.out),
  };
}
// Claude Code's own long-term stats (~/.claude/stats-cache.json, like the /stats command) — kept even after session files are deleted
function machineStats() {
  const st = readJSON(path.join(CLAUDE_DIR, 'stats-cache.json'), null);
  if (!st) return null;
  const models = Object.entries(st.modelUsage || {}).map(([m, u]) => ({ model: m, in: u.inputTokens || 0, out: u.outputTokens || 0, cr: u.cacheReadInputTokens || 0, cw: u.cacheCreationInputTokens || 0 }))
    .filter(m => m.in + m.out + m.cr + m.cw > 0).sort((a, b) => b.out - a.out);
  return { since: st.firstSessionDate, computed: st.lastComputedDate, sessions: st.totalSessions, messages: st.totalMessages, models,
    daily: (st.dailyModelTokens || []).map(d => ({ day: d.date, total: Object.values(d.tokensByModel || {}).reduce((a, b) => a + b, 0) })) };
}

// days = 0 → the entire local history. Project / session / cost tables cover exactly the selected range.
function usageReport(days = 30) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sessions = Object.values(scanCache).filter(s => s.cwd);
  if (!days) {
    let first = dayKey(today.getTime());
    for (const s of sessions) for (const d of Object.keys(s.days || {})) if (d < first) first = d;
    const [y, m, d] = first.split('-').map(Number);
    days = Math.max(1, Math.round((today - new Date(y, m - 1, d)) / 86400000) + 1);
  }
  const keys = [];
  for (let i = days - 1; i >= 0; i--) keys.push(dayKey(today.getTime() - i * 86400000));
  const startMs = today.getTime() - (days - 1) * 86400000;
  const byDay = Object.fromEntries(keys.map(k => [k, {}]));
  const projects = {};
  const perSession = [];
  let totalCost = 0;
  // a Hub chat is one session even when the CLI split it into several files (/clear, agent switch)
  const list = Object.fromEntries(sessionList().map(x => [x.id, x]));
  const rowOf = Object.fromEntries(Object.values(list).flatMap(x => [[x.id, x.id], ...(x.parts || []).map(q => [q.id, x.id])]));
  const counted = new Set();
  for (const s of sessions) {
    const tok = { in: 0, out: 0, cr: 0, cw: 0 };
    for (const [day, fams] of Object.entries(s.days || {})) {
      if (!byDay[day]) continue;
      for (const [fam, u] of Object.entries(fams)) {
        const b = (byDay[day][fam] = byDay[day][fam] || { in: 0, out: 0, cr: 0, cw: 0 });
        for (const k in u) { b[k] += u[k]; tok[k] += u[k]; }
      }
    }
    const cost = Object.entries(s.runs || {}).filter(([ts]) => Number(ts) >= startMs).reduce((a, [, c]) => a + c, 0);
    if (!tok.out && !tok.in && !tok.cr && !cost) continue;
    totalCost += cost;
    const p = (projects[s.cwd] = projects[s.cwd] || { path: s.cwd, name: path.basename(s.cwd), display: tilde(s.cwd), sessions: 0, out: 0, in: 0, cr: 0, cw: 0, cost: 0 });
    const row = rowOf[s.id] || s.id;
    if (!counted.has(row)) { counted.add(row); p.sessions++; }
    p.cost += cost;
    for (const k in tok) p[k] += tok[k];
    const prev = perSession.find(x => x.id === row);
    if (prev) { for (const k in tok) prev.tok[k] += tok[k]; prev.cost += cost; } else perSession.push({ id: row, tok, cost });
  }
  return {
    scannedAt: lastScanAt, scanning, rateLimit: curLimit(), rangeDays: days,
    accounts: accountUsage(sessions, keys),
    machine: machineStats(),
    days: keys.map(k => ({ day: k, models: byDay[k] })),
    projects: Object.values(projects).sort((a, b) => b.out - a.out),
    topSessions: perSession.filter(x => list[x.id]).sort((a, b) => b.tok.out - a.tok.out).slice(0, 12)
      .map(x => ({ ...list[x.id], tokens: x.tok, cost: x.cost })),
    totalCost,
  };
}

// ---------- Task management (each task = one chat window) ----------
const TASKS_FILE = path.join(DATA, 'tasks.json');
const tasks = new Map();
const BG_RE = /running in the background \(([\w-]+)\)/;
for (const t of readJSON(TASKS_FILE, []) || []) {
  if (['running', 'queued', 'stopping'].includes(t.status)) { t.status = 'stopped'; Object.assign(t, keyedField('note', 'server.task.hubRestarted')); }
  // "session running in background" error from before the Hub restarted → still show the resolution panel
  if (t.status === 'error' && !t.bgConflict) {
    let evs = []; try { evs = fs.readFileSync(path.join(LOGS, t.id + '.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)); } catch { /* no log yet */ }
    const last = evs.filter(e => e.k === 'stderr' || e.k === 'text' || e.k === 'result').pop();
    if (last && last.k === 'stderr' && BG_RE.test(last.text || '')) t.bgConflict = BG_RE.exec(last.text)[1];
  }
  if (!t.costFixed) {
    let base = 0, last = 0;
    try {
      for (const l of fs.readFileSync(path.join(LOGS, t.id + '.jsonl'), 'utf8').split('\n')) {
        if (!l.includes('"k":"result"')) continue;
        const c = (JSON.parse(l).cost) || 0;
        if (c < last) base += last;
        last = c;
      }
    } catch { /* no log yet */ }
    Object.assign(t, { costUsd: base + last, costBase: base, costLast: last, costFixed: 1 });
  }
  tasks.set(t.id, t);
}
const procs = new Map();   // id -> { child, idleTimer, restartWith }
const queue = [];          // ids of tasks waiting their turn
let saveTimer = null;
const saveTasks = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => writeJSON(TASKS_FILE, [...tasks.values()]), 300); };

const clients = new Set();
function broadcast(obj) {
  const data = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of clients) res.write(data);
}
const publicTask = t => { const { queued, after, ...pub } = t; return pub; };
function renameSession(id, name) {
  name = String(name || '').trim().slice(0, 120);
  const hub = hubCfg();
  if (name) hub.names[id] = name; else delete hub.names[id];
  saveHub(hub);
  const s = findSession(id);
  const title = name || (s ? sessTitle(s, hub.names) : null);
  if (title) for (const t of tasks.values()) if (t.sessionId === id || t.historySessionId === id) updateTask(t, { title });
  broadcast({ type: 'sessions-updated' });
  return { id, title };
}
// ---------- Progress: current step, step count, agent todo list ----------
const briefOf = (name, i = {}) => clip(String(i.command || i.file_path || i.path || i.pattern || i.url || i.query || i.description || i.subject || i.prompt || i.skill || i.CommandLine || i.Path || ''), 140).replace(/\s+/g, ' ');
function progressPatch(t, name, input = {}) {
  const p = { step: { name, brief: briefOf(name, input), at: Date.now() }, steps: (t.steps || 0) + 1 };
  // Claude Code: TodoWrite replaces the whole list; TaskCreate/TaskUpdate add / edit single items
  if (name === 'TodoWrite' && Array.isArray(input.todos)) p.todos = input.todos.map(x => ({ text: x.activeForm && x.status === 'in_progress' ? x.activeForm : (x.content || x.subject || ''), status: x.status || 'pending' }));
  else if (name === 'TaskCreate' && (input.subject || input.description)) p.todos = [...(t.todos || []), { id: String((t.todos || []).length + 1), text: input.subject || input.description, status: 'pending' }];
  else if (name === 'TaskUpdate' && input.taskId && t.todos) p.todos = t.todos.map(x => (x.id === String(input.taskId) ? { ...x, status: input.status || x.status, text: input.subject || x.text } : x));
  return p;
}
function updateTask(t, patch) {
  // new plain text replaces keyed text → drop the stale key/params
  for (const f of ['lastText', 'note']) if (f in patch && patch[f] !== t[f] && !(f + 'Key' in patch)) { delete t[f + 'Key']; delete t[f + 'Params']; }
  Object.assign(t, patch, { updatedAt: Date.now() });
  saveTasks();
  broadcast({ type: 'task', task: publicTask(t) });
}

const logFile = id => path.join(LOGS, `${id}.jsonl`);
function pushEvent(t, ev) {
  ev.at = ev.at || Date.now();
  if (ev.k === 'stderr' && BG_RE.test(ev.text || '')) t.bgConflict = BG_RE.exec(ev.text)[1];
  fs.appendFileSync(logFile(t.id), JSON.stringify(ev) + '\n');
  broadcast({ type: 'event', id: t.id, ev });
}
function readEvents(id) {
  try { return fs.readFileSync(logFile(id), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; }
}

const clip = (s, n = 6000) => (s && s.length > n ? s.slice(0, n) + `\n… (truncated ${s.length - n} chars)` : s);
function toolResultText(c) {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(x => (x.type === 'text' ? x.text : x.type === 'image' ? '[image]' : JSON.stringify(x))).join('\n');
  return JSON.stringify(c);
}

// Convert Claude CLI stream-json into compact UI events
function handleLine(t, line) {
  let m;
  try { m = JSON.parse(line); } catch { return pushEvent(t, { k: 'stderr', text: line }); }
  if (m.type === 'stream_event') {
    const e = m.event || {};
    if (m.parent_tool_use_id) return;
    if (e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta') broadcast({ type: 'delta', id: t.id, text: e.delta.text });
    else if (e.type === 'message_start') {
      broadcast({ type: 'delta', id: t.id, reset: true });
      if (t.status !== 'running' && t.status !== 'stopping') updateTask(t, { status: 'running' }); // new turn from a queued message
    }
    return;
  }
  if (m.type === 'rate_limit_event' && m.rate_limit_info) {
    const who = currentAccount();
    rateLimit = { ...m.rate_limit_info, at: Date.now(), account: who && who.email };
    if (who) { acct.limits[who.email] = rateLimit; writeJSON(ACCT_FILE, acct); }
    writeJSON(RATE_FILE, rateLimit);
    broadcast({ type: 'ratelimit', rateLimit });
    return;
  }
  if (m.type === 'system' && m.subtype === 'init') {
    noteSessionChange(t, m.session_id);
    updateTask(t, { sessionId: m.session_id, activeModel: m.model });
    if (Array.isArray(m.slash_commands) && m.slash_commands.length) { slashByProject[t.projectPath] = m.slash_commands; slashByProject[''] = m.slash_commands; writeJSON(SLASH_FILE, slashByProject); }
    // the CLI emits init every turn; only show it again when model / MCP / permissions change
    const key = JSON.stringify([m.model, m.permissionMode, (m.mcp_servers || []).map(s => s.name + s.status)]);
    if (key === t.lastInitKey) return;
    t.lastInitKey = key;
    pushEvent(t, {
      k: 'init', model: m.model, permissionMode: m.permissionMode,
      mcp: (m.mcp_servers || []).map(s => ({ name: s.name, status: s.status })),
      tools: (m.tools || []).length,
      plugins: (m.plugins || []).map(p => p.name || p),
    });
    return;
  }
  if (m.type === 'assistant' && m.message) {
    if (m.parent_tool_use_id) { // sub-agent
      for (const b of m.message.content || []) if (b.type === 'tool_use') pushEvent(t, { k: 'tool', id: b.id, name: b.name, input: b.input, sub: true });
      return;
    }
    const u = m.message.usage;
    if (u) {
      const ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      if (ctx) { t.context = ctx; broadcast({ type: 'usage', id: t.id, context: ctx, out: u.output_tokens || 0 }); }
    }
    for (const b of m.message.content || []) {
      if (b.type === 'text' && b.text.trim()) { pushEvent(t, { k: 'text', text: b.text }); updateTask(t, { lastText: b.text.slice(0, 300) }); }
      else if (b.type === 'thinking' && b.thinking) pushEvent(t, { k: 'thinking', text: clip(b.thinking, 4000) });
      else if (b.type === 'tool_use') { pushEvent(t, { k: 'tool', id: b.id, name: b.name, input: b.input }); updateTask(t, { lastText: `🔧 ${b.name}`, ...progressPatch(t, b.name, b.input) }); }
    }
    return;
  }
  if (m.type === 'user' && m.message && Array.isArray(m.message.content)) {
    if (m.parent_tool_use_id) return;
    for (const b of m.message.content) {
      if (b.type === 'tool_result') pushEvent(t, { k: 'tool_result', id: b.tool_use_id, isError: !!b.is_error, text: clip(toolResultText(b.content)) });
    }
    return;
  }
  if (m.type === 'result') {
    const ok = !m.is_error && m.subtype === 'success';
    const u = m.usage || {};
    const tk = t.tokens || { in: 0, out: 0, cr: 0, cw: 0 };
    tk.in += u.input_tokens || 0; tk.out += u.output_tokens || 0;
    tk.cr += u.cache_read_input_tokens || 0; tk.cw += u.cache_creation_input_tokens || 0;
    const mu = Object.values(m.modelUsage || {})[0] || {};
    const cum = m.total_cost_usd || 0;
    // total_cost_usd is the session's CUMULATIVE cost (resume reloads earlier turns) → take the delta, don't add it directly
    if (cum < (t.costLast || 0)) t.costBase = (t.costBase || 0) + t.costLast; // a new process starts again from 0
    const turnCost = Math.max(0, cum - (cum >= (t.costLast || 0) ? (t.costLast || 0) : 0));
    t.costLast = cum;
    pushEvent(t, { k: 'result', ok, text: m.result || m.subtype, cost: turnCost, costTotal: (t.costBase || 0) + cum, duration: m.duration_ms, turns: m.num_turns, out: u.output_tokens, denials: (m.permission_denials || []).map(d => d.tool_name) });
    updateTask(t, {
      status: ok ? 'done' : 'error',
      costUsd: (t.costBase || 0) + cum,
      durationMs: (t.durationMs || 0) + (m.duration_ms || 0),
      tokens: tk, contextWindow: mu.contextWindow || t.contextWindow,
      lastText: (m.result || '').slice(0, 300) || t.lastText,
      denials: (t.denials || 0) + (m.permission_denials || []).length,
      endedAt: Date.now(),
    });
    armIdle(t);
    schedule();
  }
}

function pluginDirsFor(keys, projectPath) {
  return (keys || []).map(k => resolvePluginInstall(k, projectPath)).filter(Boolean).map(e => e.installPath);
}

// The claude process lives for the whole chat: stdin is stream-json, so the user can send messages at any time
function spawnProc(t) {
  const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--add-dir', UPLOADS];
  if (t.model) args.push('--model', t.model);
  if (t.effort) args.push('--effort', t.effort);
  if (t.permissionMode === 'bypassPermissions') args.push('--dangerously-skip-permissions');
  else if (t.permissionMode) args.push('--permission-mode', t.permissionMode);
  for (const d of pluginDirsFor(t.plugins, t.projectPath)) args.push('--plugin-dir', d);
  const taskSkill = skillOf(t.skill, t.projectPath);
  const sys = [t.appendSystemPrompt, taskSkill && taskSkill.source === 'factory' && `You are working in the "${taskSkill.use}" stage of the SDLC. Follow this skill for the whole conversation unless told otherwise:\n\n${taskSkill.body}`].filter(Boolean).join('\n\n');
  if (sys) args.push('--append-system-prompt', sys);
  if (t.sessionId) { args.push('--resume', t.sessionId); if (t.fork && !t.forked) { args.push('--fork-session'); t.forked = true; } }
  else args.push('--name', `hub: ${t.title}`.slice(0, 80));

  const env = { ...process.env };
  for (const k of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT', 'CLAUDE_AGENT_SDK_VERSION']) delete env[k];

  const child = spawn(CLAUDE_BIN, args, { cwd: t.projectPath, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const entry = { child, idleTimer: null, settings: procSettings(t) };
  procs.set(t.id, entry);

  let buf = '';
  child.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) handleLine(t, line); }
  });
  let errBuf = '';
  child.stderr.on('data', d => { errBuf += d; });
  child.stdin.on('error', () => { /* process already exited */ });
  child.on('error', e => pushEvent(t, { k: 'stderr', text: String(e) }));
  child.on('close', code => {
    if (buf.trim()) handleLine(t, buf.trim());
    if (errBuf.trim() && code !== 0 && t.status !== 'stopping') pushEvent(t, { k: 'stderr', text: clip(errBuf.trim(), 4000) });
    clearTimeout(entry.idleTimer);
    procs.delete(t.id);
    // if the session is running in the background (claude --bg) the CLI rejects --resume → let the user choose: fork / stop the background session / attach
    const bg = BG_RE.exec(errBuf);
    if (bg) t.bgConflict = bg[1];
    if (t.status === 'stopping') updateTask(t, { status: 'stopped' });
    else if (t.status === 'running') updateTask(t, { status: 'error', exitCode: code });
    else updateTask(t, {});
    if (entry.restart) entry.restart();
    schedule();
  });
  return entry;
}
const procSettings = t => JSON.stringify([t.model, t.effort, t.permissionMode, t.plugins, t.appendSystemPrompt]);

function armIdle(t) {
  const e = procs.get(t.id);
  if (!e) return;
  clearTimeout(e.idleTimer);
  e.idleTimer = setTimeout(() => { if (t.status !== 'running') e.child.stdin.end(); }, IDLE_CLOSE_MS);
}

// Build the message content: images are sent directly to Claude, other files are passed as paths for Claude to read
function buildContent(text, files) {
  const content = [];
  const refs = [];
  for (const f of files || []) {
    const abs = path.resolve(f.path);
    if (!abs.startsWith(UPLOADS + path.sep) || !exists(abs)) continue;
    const size = fs.statSync(abs).size;
    const mime = f.mime || '';
    if (/^image\/(png|jpeg|gif|webp)$/.test(mime) && size <= INLINE_IMAGE_MAX) {
      content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: fs.readFileSync(abs).toString('base64') } });
      refs.push(`- ${f.name} (image, attached inline; original: ${abs})`);
    } else refs.push(`- ${f.name}: ${abs}`);
  }
  let body = text || '';
  if (refs.length) body += `\n\n[Files attached by the user — use Read to open them when needed]\n${refs.join('\n')}`;
  content.unshift({ type: 'text', text: body });
  return content;
}

// slash commands reported by the CLI in init (including skills, plugins, project-specific commands)
const SLASH_FILE = path.join(DATA, 'commands.json');
const slashByProject = readJSON(SLASH_FILE, {}) || {};
const lastMsg = new Map(); // task id → latest message (to resend after resolving a background-session conflict)
// Claude task with a local (non-factory) skill: invoke it natively on the first message only
function firstTurnSkill(t, text) {
  if (!t.skill || t.skillSent) return text;
  t.skillSent = true;
  const sk = skillOf(t.skill, t.projectPath);
  return sk && sk.source !== 'factory' ? `/${sk.use} ${text}` : text;
}
function deliver(t, msg) {
  lastMsg.set(t.id, msg);
  if (t.agent && t.agent !== 'claude') return deliverOneShot(t, msg);
  let entry = procs.get(t.id);
  // changing model / permissions / plugins -> the process must restart (the session is kept via --resume)
  if (entry && entry.settings !== procSettings(t) && t.status !== 'running') {
    entry.restart = () => deliver(t, msg);
    entry.child.stdin.end();
    setTimeout(() => procs.has(t.id) && entry.child.kill('SIGTERM'), 3000);
    return;
  }
  if (!entry) entry = spawnProc(t);
  clearTimeout(entry.idleTimer);
  updateTask(t, { status: 'running', startedAt: t.startedAt || Date.now(), lastRunAt: Date.now(), runs: (t.runs || 0) + 1, steps: 0, step: null });
  entry.child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: buildContent(msg.skill ? withSkill(msg.text, msg.skill, t) : firstTurnSkill(t, msg.text), msg.files) } }) + '\n');
}

// ---------- Other agents (agy, codex, gemini, custom): one process per message, sessions resumed by ID ----------
function plainText(msg) {
  const refs = [];
  for (const f of msg.files || []) {
    const abs = path.resolve(f.path);
    if (abs.startsWith(UPLOADS + path.sep) && exists(abs)) refs.push(`- ${f.name}: ${abs}`);
  }
  return (msg.text || '') + (refs.length ? `\n\n[Attached files — read them by path when needed]\n${refs.join('\n')}` : '');
}
function deliverOneShot(t, msg) {
  const a = AGENTS[t.agent];
  if (!a) { pushEvent(t, { k: 'stderr', ...keyedText('server.agent.notConfigured', { agent: t.agent }) }); return updateTask(t, { status: 'error' }); }
  if (procs.has(t.id)) { (t.after = t.after || []).push(msg); return; } // previous turn still running → wait
  let text = plainText(msg);
  if (msg.skill) text = withSkill(text, msg.skill, t);
  else if (t.skill && !t.skillSent) { text = withSkill(text, t.skill, t); t.skillSent = true; }
  const args = [...(a.extraArgs || []), ...a.args(t, text, { uploads: UPLOADS })];
  const env = { ...process.env };
  for (const k of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT', 'CLAUDE_AGENT_SDK_VERSION']) delete env[k];
  const child = spawn(expandHome(a.bin), args, { cwd: t.projectPath, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const entry = { child, oneShot: true };
  procs.set(t.id, entry);
  updateTask(t, { status: 'running', startedAt: t.startedAt || Date.now(), lastRunAt: Date.now(), runs: (t.runs || 0) + 1, steps: 0, step: null });
  broadcast({ type: 'delta', id: t.id, reset: true });
  const started = Date.now();
  let live = '', liveThink = '', gotResult = false, rawOut = '';
  const tools = new Set();
  const flush = () => {
    if (liveThink.trim()) { pushEvent(t, { k: 'thinking', text: clip(liveThink, 4000) }); liveThink = ''; }
    if (live.trim()) { pushEvent(t, { k: 'text', text: live }); updateTask(t, { lastText: live.slice(0, 300) }); }
    live = ''; broadcast({ type: 'delta', id: t.id, reset: true });
  };
  const h = {
    session(id, model, extra = {}) {
      if (id && id !== t.sessionId) { noteSessionChange(t, id); updateTask(t, { sessionId: id }); }
      const key = JSON.stringify([t.agent, model]);
      if (key !== t.lastInitKey) { t.lastInitKey = key; pushEvent(t, { k: 'init', agent: t.agent, model: model || t.model || a.label, permissionMode: t.permissionMode, tools: extra.tools || 0, mcp: [], plugins: [] }); }
    },
    delta(x) { live += x; broadcast({ type: 'delta', id: t.id, text: x }); },
    thinkingDelta(x) { liveThink += x; },
    flush,
    text(x) { flush(); if (String(x).trim()) { pushEvent(t, { k: 'text', text: x }); updateTask(t, { lastText: String(x).slice(0, 300) }); } },
    thinking(x) { if (String(x).trim()) pushEvent(t, { k: 'thinking', text: clip(x, 4000) }); },
    tool(id, name, input) { if (tools.has(id)) return; tools.add(id); flush(); pushEvent(t, { k: 'tool', id, name, input }); updateTask(t, { lastText: `🔧 ${name}`, ...progressPatch(t, name, input) }); },
    toolResult(id, isError, out) { pushEvent(t, { k: 'tool_result', id, isError: !!isError, text: clip(String(out || '')) }); },
    stderr(x) { pushEvent(t, { k: 'stderr', text: clip(String(x), 4000) }); },
    result(r) {
      flush(); gotResult = true;
      const tk = t.tokens || { in: 0, out: 0, cr: 0, cw: 0 };
      tk.in += r.in || 0; tk.out += r.out || 0; tk.cr += r.cr || 0;
      const duration = r.duration || Date.now() - started;
      pushEvent(t, { k: 'result', ok: r.ok, ...(r.ok ? { text: '' } : r.text ? { text: r.text } : keyedText(r.textKey || 'server.result.error', r.params)), duration, turns: r.turns, out: r.out, denials: r.denials || [] });
      updateTask(t, { status: r.ok ? 'done' : 'error', tokens: tk, durationMs: (t.durationMs || 0) + duration, denials: (t.denials || 0) + (r.denials || []).length, endedAt: Date.now() });
    },
  };
  let buf = '';
  const onLine = line => {
    if (!a.parse) { rawOut += line + '\n'; return h.delta(line + '\n'); }
    let m;
    try { m = JSON.parse(line); } catch { return h.stderr(line); }
    try { a.parse(m, h); } catch (e) { pushEvent(t, { k: 'stderr', ...keyedText('server.agent.parseError', { error: clip(String(e.message), 4000) }) }); }
  };
  child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); if (l.trim() || !a.parse) onLine(l); } });
  let errBuf = '', missingBin = false;
  child.stderr.on('data', d => { errBuf += d; });
  child.on('error', e => { if (e.code === 'ENOENT') missingBin = true; else errBuf += String(e); });
  child.on('close', code => {
    if (buf.trim()) onLine(buf.trim());
    procs.delete(t.id);
    if (!a.parse && !gotResult) { live = rawOut; h.result({ ok: code === 0, text: errBuf.trim() }); }
    if (missingBin && t.status !== 'stopping') pushEvent(t, { k: 'stderr', ...keyedText('server.agent.binNotFound', { bin: a.bin, label: a.label, agent: t.agent }) });
    if (errBuf.trim() && (code !== 0 || !gotResult) && t.status !== 'stopping') pushEvent(t, { k: 'stderr', text: clip(errBuf.trim(), 4000) });
    if (t.status === 'stopping') updateTask(t, { status: 'stopped' });
    else if (!gotResult) updateTask(t, { status: code === 0 ? 'done' : 'error', exitCode: code });
    const next = (t.after || []).shift();
    if (next) deliverOneShot(t, next);
    schedule();
  });
}

const busyCount = () => [...tasks.values()].filter(t => t.status === 'running' && procs.has(t.id)).length;

// ---------- SDLC skills ----------
// Factory skills (skills/sdlc-*/SKILL.md) are only a FALLBACK. Resolution order for each skill:
//   1. the project's own skill   <project>/.claude/skills/<name>/SKILL.md
//   2. the user's skill          ~/.claude/skills/**/<name>/SKILL.md
//   3. a native Claude Code skill/command (built-in or plugin) listed in the skill's "prefer:" field
//   4. the factory's own SKILL.md
// Steps 1-3 also match any name in "prefer:" (equivalent skills), so local conventions always win.
function parseSkill(file, source) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const meta = {};
    if (m) for (const line of m[1].split(/\r?\n/)) { const i = line.indexOf(':'); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
    return { name: meta.name || path.basename(path.dirname(file)), description: meta.description || '', stage: meta.stage || '', role: meta.role || '', icon: meta.icon || '✦', mode: meta.mode || '',
      prefer: (meta.prefer || '').split(',').map(x => x.trim()).filter(Boolean), body: (m ? m[2] : raw).trim(), file, source };
  } catch { return null; }
}
// SKILL.md files under a skills dir (one or two levels deep — ~/.claude/skills may hold synced/<id>/<skill>/)
function skillDir(dir, source, depth = 0) {
  const out = {};
  for (const d of listDir(dir).filter(d => d.isDirectory())) {
    const f = path.join(dir, d.name, 'SKILL.md');
    if (exists(f)) { const k = parseSkill(f, source); if (k) out[k.name] = k; }
    else if (depth < 2) Object.assign(out, skillDir(path.join(dir, d.name), source, depth + 1));
  }
  return out;
}
const FACTORY_SKILLS = path.join(__dirname, 'skills');
let plugSkillCache = { at: 0, map: {} };
function pluginSkills() {
  if (Date.now() - plugSkillCache.at < 60000) return plugSkillCache.map;
  const map = {};
  for (const [id, entries] of Object.entries(installedPlugins())) {
    const plugin = id.split('@')[0];
    for (const e of [].concat(entries || [])) for (const k of Object.values(skillDir(path.join(e.installPath || '', 'skills'), 'native'))) map[`${plugin}:${k.name}`] = k;
  }
  plugSkillCache = { at: Date.now(), map };
  return map;
}
function resolveSkills(project) {
  const factory = skillDir(FACTORY_SKILLS, 'factory');
  for (const extra of (CFG.skillsDirs || []).map(expandHome)) Object.assign(factory, skillDir(extra, 'factory'));
  const user = skillDir(path.join(CLAUDE_DIR, 'skills'), 'user');
  const proj = project ? skillDir(path.join(project, '.claude', 'skills'), 'project') : {};
  // native: skills of installed plugins (<plugin>:<skill>, readable SKILL.md) + commands the CLI reported for this project
  const plug = pluginSkills();
  const native = [...new Set([...(slashByProject[project] || slashByProject[''] || []), ...Object.keys(plug)])];
  const nativeFind = n => native.find(c => c === n || c.endsWith(':' + n));
  const out = {};
  for (const k of Object.values(factory)) {
    const names = [k.name, ...k.prefer];
    const local = names.map(n => proj[n]).find(Boolean) || names.map(n => user[n]).find(Boolean);
    const nat = !local && k.prefer.map(nativeFind).find(Boolean);
    const { file, ...pub } = k;
    out[k.name] = local ? { ...pub, source: local.source, use: local.name, body: local.body, file: local.file }
      : nat ? { ...pub, source: 'native', use: nat, ...(plug[nat] ? { body: plug[nat].body, file: plug[nat].file } : { file }) }
      : { ...pub, source: 'factory', use: k.name, file };
  }
  return out;
}
const skillOf = (name, project) => (name ? resolveSkills(project)[name] || null : null);
const skillText = (sk, text) => `<skill name="${sk.use}">\n${sk.body}\n</skill>\n\nApply the "${sk.use}" skill above to the following request:\n\n${text}`;
// Text actually sent to the agent for a message that carries a skill
function withSkill(text, name, t) {
  const sk = skillOf(name, t && t.projectPath);
  if (!sk) return text;
  // Claude Code already knows native/user/project skills → call it the native way so its own version runs
  if ((!t || !t.agent || t.agent === 'claude') && sk.source !== 'factory') return `/${sk.use} ${text}`;
  return skillText(sk, text);
}

function sendMessage(t, msg) {
  pushEvent(t, { k: 'user', text: msg.displayText || (msg.skill ? `/${msg.skill} ${msg.text}` : msg.text), ...(msg.displayKey ? { textKey: msg.displayKey, params: msg.displayParams } : {}), skill: msg.skill || undefined, files: (msg.files || []).map(f => ({ name: f.name, isImage: /^image\//.test(f.mime || ''), url: f.url })) });
  if (procs.has(t.id) || busyCount() < MAX_PARALLEL) return deliver(t, msg);
  (t.queued = t.queued || []).push(msg);
  queue.push(t.id);
  updateTask(t, { status: 'queued', ...keyedField('lastText', 'server.task.queued') });
}

function schedule() {
  while (queue.length && busyCount() < MAX_PARALLEL) {
    const t = tasks.get(queue.shift());
    if (!t || t.status !== 'queued' || !(t.queued || []).length) continue;
    const msgs = t.queued; t.queued = [];
    t.status = 'idle';
    for (const m of msgs) deliver(t, m);
  }
}

// ---------- Agent switch: continue a chat with another agent (Claude → agy, …) in the same chat ----------
// CLI sessions are not portable between agents, so the new agent starts a fresh session and gets a compact brief
// of the chat so far — or nothing at all when the user asks to clear the context.
async function handoffBrief(t, toAgent, note) {
  let evs = readEvents(t.id);
  const reset = evs.map(e => !!(e.agentSwitch && e.agentSwitch.clear)).lastIndexOf(true);
  if (reset >= 0) evs = evs.slice(reset + 1); // context was cleared → only what came after
  else if (t.historySessionId) { try { evs = [...(await sessionTranscript(t.historySessionId, t.createdAt)), ...evs]; } catch { /* history unavailable */ } }
  // who said what: the chat may have passed through several agents already
  const firstSwitch = evs.find(e => e.agentSwitch);
  let speaker = firstSwitch ? firstSwitch.agentSwitch.from : (t.agent || 'claude');
  const firstUser = evs.find(e => e.k === 'user');
  const files = new Map();
  for (const e of evs) if (e.k === 'tool' && e.input) {
    const f = e.input.file_path || e.input.path || e.input.notebook_path || e.input.Path;
    if (typeof f === 'string') files.set(f, /Write|Edit|write|replace/.test(e.name) ? 'changed' : (files.get(f) || 'read'));
  }
  // most recent dialogue, newest last, within a size budget
  const turns = [];
  let budget = 14000;
  const lines = [];
  for (const e of evs) {
    if (e.agentSwitch) { speaker = e.agentSwitch.to; continue; }
    if (e.k !== 'user' && e.k !== 'text') continue;
    lines.push(`**${e.k === 'user' ? 'User' : (AGENTS[speaker] || { label: speaker }).label}:** ${clip(String(e.text || ''), 1800)}`);
  }
  for (const line of lines.reverse()) {
    if (budget - line.length < 0) break;
    budget -= line.length; turns.unshift(line);
  }
  const todos = (t.todos || []).map(x => `- [${x.status === 'completed' ? 'x' : ' '}] ${x.text}${x.status === 'in_progress' ? ' (in progress)' : ''}`).join('\n');
  const changed = [...files].filter(([, k]) => k === 'changed').map(([f]) => f);
  const read = [...files].filter(([, k]) => k === 'read').map(([f]) => f).slice(0, 30);
  return [
    `# Handoff: continue this work (from ${AGENTS[t.agent || 'claude'].label} to ${AGENTS[toAgent].label})`,
    `You are taking over an ongoing task in the project at ${t.projectPath}. The previous agent's session cannot be transferred, so this brief carries its context. Treat it as a summary — verify the current state of files before relying on it.`,
    `## Original request\n${firstUser ? clip(String(firstUser.text || ''), 3000) : t.title}`,
    todos && `## Task list at handoff\n${todos}`,
    changed.length && `## Files changed so far\n${changed.map(f => '- ' + f).join('\n')}`,
    read.length && `## Files consulted\n${read.map(f => '- ' + f).join('\n')}`,
    turns.length && `## Recent conversation (oldest first)\n${turns.join('\n\n')}`,
    `## What to do now\n${note ? note : 'First summarise in a few lines where the work stands, then continue with the next step. Ask before doing anything destructive.'}`,
  ].filter(Boolean).join('\n\n');
}

// Stop the chat's long-lived claude process (if any) and run fn once it has exited
function afterProcExit(t, fn) {
  const e = procs.get(t.id);
  if (!e) return fn();
  clearTimeout(e.idleTimer);
  e.restart = fn;
  e.child.stdin.end();
  setTimeout(() => procs.has(t.id) && e.child.kill('SIGTERM'), 3000);
}

// Switch the agent of an existing chat. clear → the new agent starts with no context; otherwise it gets the brief.
async function switchAgent(t, b) {
  const from = t.agent || 'claude', to = b.agent, clear = !!b.clear || from === to;
  const note = String(b.note || '').trim();
  const brief = clear ? null : await handoffBrief(t, to, note);
  await new Promise(r => afterProcExit(t, r));
  const past = [...(t.pastSessions || [])];
  if (t.sessionId) past.push({ agent: from, sessionId: t.sessionId, until: Date.now() });
  updateTask(t, {
    agent: to, model: b.model || null, effort: from === to ? t.effort : null, permissionMode: b.permissionMode ?? t.permissionMode,
    sessionId: null, fork: false, forked: false, lastInitKey: null, skillSent: false, bgConflict: null,
    activeModel: null, context: 0, contextWindow: null, pastSessions: past,
    costBase: (t.costBase || 0) + (t.costLast || 0), costLast: 0, // the next claude session counts its cost from 0
  });
  const fromLabel = AGENTS[from] ? AGENTS[from].label : from;
  pushEvent(t, { k: 'system', ...keyedText(from === to ? 'server.handoff.cleared' : clear ? 'server.handoff.switchedClear' : 'server.handoff.switched', { from: fromLabel, agent: AGENTS[to].label }), agentSwitch: { from, to, clear } });
  if (brief) sendMessage(t, { text: brief, displayText: tr('vi', 'server.handoff.briefShown', { agent: fromLabel }), displayKey: 'server.handoff.briefShown', displayParams: { agent: fromLabel } });
  else if (note) sendMessage(t, { text: note });
}

function newTask(p, body, lang = 'vi') {
  const t = {
    id: crypto.randomBytes(6).toString('hex'),
    title: (body.title || body.prompt || tr(lang, 'server.task.defaultTitle')).split('\n')[0].slice(0, 90),
    projectPath: p, projectName: path.basename(p), projectDisplay: tilde(p),
    agent: AGENTS[body.agent] ? body.agent : 'claude',
    model: body.model || null, effort: body.effort || null,
    permissionMode: body.permissionMode || null,
    plugins: Array.isArray(body.plugins) ? body.plugins : [],
    appendSystemPrompt: body.appendSystemPrompt || null,
    skill: body.skill && skillOf(body.skill, p) ? body.skill : null,
    sessionId: body.resumeSessionId || null, historySessionId: body.resumeSessionId || null, fork: !!body.fork,
    status: 'idle', createdAt: Date.now(), costUsd: 0, durationMs: 0, runs: 0,
    tokens: { in: 0, out: 0, cr: 0, cw: 0 },
  };
  tasks.set(t.id, t);
  return t;
}

function createTasks(body, lang = 'vi') {
  const projects = (body.projects || []).filter(isDir);
  if (!projects.length) throw keyedError('server.task.noProject');
  if (!body.prompt || !body.prompt.trim()) throw keyedError('server.task.emptyPrompt');
  return projects.map(p => {
    const t = newTask(p, body, lang);
    sendMessage(t, { text: body.prompt, files: body.files });
    return publicTask(t);
  });
}

// ---------- HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
};

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', d => { b += d; if (b.length > 50e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
  });
}
function saveUpload(req, name) {
  return new Promise((resolve, reject) => {
    const safe = path.basename(String(name || 'file')).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(-120) || 'file';
    const dir = path.join(UPLOADS, dayKey(Date.now()));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${crypto.randomBytes(3).toString('hex')}-${safe}`);
    const out = fs.createWriteStream(file);
    let size = 0;
    req.on('data', d => {
      size += d.length;
      if (size > MAX_UPLOAD) { req.destroy(); out.destroy(); fs.rm(file, () => {}); reject(keyedError('server.upload.tooLarge')); }
    });
    req.pipe(out);
    out.on('finish', () => resolve({ path: file, name: safe, size, url: '/uploads/' + path.relative(UPLOADS, file).split(path.sep).map(encodeURIComponent).join('/') }));
    out.on('error', reject);
  });
}

function openTerminal(cwd, sessionId, attachId, cmdOverride) {
  const cmd = cmdOverride || (attachId ? `claude attach ${attachId}` : sessionId ? `claude --resume ${sessionId}` : 'claude');
  // for a different terminal on another machine: hub.config.json → "terminal": ["konsole", "--workdir", "{cwd}", "-e", "bash", "-lc", "{cmd}; exec bash"]
  if (Array.isArray(CFG.terminal) && CFG.terminal.length) {
    const [bin, ...rest] = CFG.terminal.map(x => String(x).replace('{cwd}', cwd).replace('{cmd}', cmd));
    const c = spawn(bin, rest, { detached: true, stdio: 'ignore' }); c.on('error', () => {}); c.unref(); return;
  }
  const child = spawn('gnome-terminal', ['--working-directory', cwd, '--', 'bash', '-lc', `${cmd}; exec bash`], { detached: true, stdio: 'ignore' });
  child.on('error', () => spawn('x-terminal-emulator', ['-e', `bash -lc 'cd "${cwd}" && ${cmd}; exec bash'`], { detached: true, stdio: 'ignore' }).unref());
  child.unref();
}

// ---------- Browse / edit project files (only within project folders known to the Hub) ----------
const FS_MAX_READ = 3 * 1024 * 1024;
const FS_HIDE = new Set(); // show every file/folder, including .git, .env…
// Return the real path inside root; throw if it is outside root (including via symlinks)
function fsResolve(root, rel, mustExist = true) {
  const hub = hubCfg();
  if (!root || !allProjectPaths().includes(root) || hub.hidden.includes(root)) throw keyedError('server.fs.notInHub');
  const realRoot = fs.realpathSync(root);
  const abs = path.resolve(root, String(rel || '').replace(/^\/+/, ''));
  let real;
  if (mustExist) real = fs.realpathSync(abs);
  else {
    // new file/folder: use the real path of the nearest existing parent folder
    let base = abs, rest = [];
    while (!exists(base) && base !== path.dirname(base)) { rest.unshift(path.basename(base)); base = path.dirname(base); }
    real = path.join(fs.realpathSync(base), ...rest);
  }
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw keyedError('server.fs.outsideProject');
  return { abs, real, rel: path.relative(root, abs) };
}
function fsList(root, dir) {
  const { real, rel } = fsResolve(root, dir);
  const out = [];
  for (const d of fs.readdirSync(real, { withFileTypes: true })) {
    if (FS_HIDE.has(d.name)) continue;
    let st = null;
    try { st = fs.statSync(path.join(real, d.name)); } catch { /* broken symlink */ }
    out.push({ name: d.name, dir: st ? st.isDirectory() : false, size: st ? st.size : 0, mtime: st ? st.mtimeMs : 0, link: d.isSymbolicLink() || undefined });
  }
  out.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { root, dir: rel, entries: out.slice(0, 3000), truncated: out.length > 3000 };
}
function fsRead(root, file) {
  const { real, rel } = fsResolve(root, file);
  const st = fs.statSync(real);
  if (!st.isFile()) throw keyedError('server.fs.notAFile');
  const ext = path.extname(real).toLowerCase();
  const base = { path: rel, size: st.size, mtime: st.mtimeMs };
  if (/^\.(png|jpe?g|gif|webp|svg|ico)$/.test(ext)) return { ...base, image: true };
  if (st.size > FS_MAX_READ) return { ...base, tooBig: true };
  const buf = fs.readFileSync(real);
  if (buf.subarray(0, 8000).includes(0)) return { ...base, binary: true };
  return { ...base, text: buf.toString('utf8') };
}
function fsWrite(root, b) {
  const { real, rel } = fsResolve(root, b.path, false);
  const ex = exists(real);
  if (b.create) fs.mkdirSync(path.dirname(real), { recursive: true });
  if (b.create && ex) throw keyedError('server.fs.alreadyExists', null, { code: 409 });
  if (!b.create && !ex) throw keyedError('server.fs.fileGone');
  if (b.mkdir) { fs.mkdirSync(real, { recursive: true }); return { path: rel }; }
  if (ex && !b.force && b.baseMtime && Math.abs(fs.statSync(real).mtimeMs - b.baseMtime) > 1)
    throw keyedError('server.fs.modifiedElsewhere', null, { code: 409 });
  const tmp = real + '.hub-tmp-' + process.pid;
  fs.writeFileSync(tmp, String(b.text ?? ''));
  if (ex) try { fs.chmodSync(tmp, fs.statSync(real).mode); } catch { /* keep default permissions */ }
  fs.renameSync(tmp, real);
  return { path: rel, size: fs.statSync(real).size, mtime: fs.statSync(real).mtimeMs };
}

function serveFile(res, root, rel) {
  const f = path.join(root, path.normalize(decodeURIComponent(rel)).replace(/^(\.\.[/\\])+/, ''));
  if (!f.startsWith(root) || !exists(f) || !fs.statSync(f).isFile()) return false;
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  // Only accept requests from this machine (blocks DNS rebinding / calls from foreign websites)
  const lang = reqLang(req);
  const fail = (code, key, params) => send(res, code, errBody(lang, key, params));
  const host = (req.headers.host || '').split(':')[0];
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) return fail(403, 'server.http.forbiddenHost');
  const origin = req.headers.origin;
  if (req.method !== 'GET' && origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) return fail(403, 'server.http.forbiddenOrigin');

  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  try {
    if (p === '/api/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 2000\n\n');
      clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 25000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }
    if (p === '/api/overview' && req.method === 'GET') return send(res, 200, overview(lang));
    if (p === '/api/project' && req.method === 'GET') {
      const pp = url.searchParams.get('path');
      if (!pp || !isDir(pp)) return fail(404, 'server.project.notFound');
      return send(res, 200, projectConfig(pp));
    }
    if (p === '/api/plugins' && req.method === 'GET') return send(res, 200, pluginCatalog());
    // browse folders to pick an existing local project (lists subfolders only, never reads file contents)
    if (p === '/api/browse' && req.method === 'GET') {
      const want = path.resolve(String(url.searchParams.get('dir') || HOME).replace(/^~(?=$|\/)/, HOME));
      if (!isDir(want)) return fail(400, 'server.dir.notFound');
      const hub = hubCfg();
      const inHub = new Set(allProjectPaths().filter(x => !hub.hidden.includes(x)));
      const hidden = new Set(hub.hidden);
      const showDot = url.searchParams.get('dot') === '1';
      const dirs = listDir(want)
        .filter(d => (d.isDirectory() || (d.isSymbolicLink() && isDir(path.join(want, d.name)))) && (showDot || !d.name.startsWith('.')) && d.name !== 'node_modules')
        .map(d => {
          const full = path.join(want, d.name);
          return { name: d.name, path: full, git: exists(path.join(full, '.git')), claude: exists(path.join(full, 'CLAUDE.md')) || isDir(path.join(full, '.claude')),
            inHub: inHub.has(full), hidden: hidden.has(full) };
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      return send(res, 200, { dir: want, display: tilde(want), parent: want === path.dirname(want) ? null : path.dirname(want), home: HOME,
        self: { git: exists(path.join(want, '.git')), claude: exists(path.join(want, 'CLAUDE.md')) || isDir(path.join(want, '.claude')), inHub: inHub.has(want), hidden: hidden.has(want) },
        dirs: dirs.slice(0, 500), truncated: dirs.length > 500 });
    }
    if (p === '/api/projects' && req.method === 'POST') {
      const b = await body(req);
      const hub = hubCfg();
      if (b.action === 'order') {
        hub.order = (b.order || []).filter(x => typeof x === 'string');
        saveHub(hub);
        return send(res, 200, { ok: true });
      }
      const pp = path.resolve(String(b.path || '').replace(/^~(?=$|\/)/, HOME));
      if (b.action === 'favorite') {
        hub.favorites = hub.favorites.includes(pp) ? hub.favorites.filter(x => x !== pp) : [...hub.favorites, pp];
      } else if (b.action === 'hide') {
        hub.hidden = [...new Set([...hub.hidden, pp])];
        hub.extraProjects = hub.extraProjects.filter(x => x !== pp);
      } else {
        if (!isDir(pp)) return fail(400, 'server.dir.notFound');
        hub.hidden = hub.hidden.filter(x => x !== pp);
        if (!allProjectPaths().includes(pp)) hub.extraProjects = [...new Set([...hub.extraProjects, pp])];
      }
      saveHub(hub);
      return send(res, 200, { ok: true });
    }
    if (p === '/api/workspaces' && req.method === 'POST') {
      const b = await body(req);
      const hub = hubCfg();
      if (b.action === 'delete') hub.workspaces = hub.workspaces.filter(w => w.id !== b.id);
      else {
        const w = b.workspace || {};
        const name = String(w.name || '').trim().slice(0, 40);
        if (!name) return fail(400, 'server.workspace.nameRequired');
        const ws = { id: w.id || crypto.randomBytes(4).toString('hex'), name, icon: String(w.icon || '🗂').slice(0, 4), projects: (w.projects || []).filter(x => typeof x === 'string') };
        const i = hub.workspaces.findIndex(x => x.id === ws.id);
        if (i >= 0) hub.workspaces[i] = ws; else hub.workspaces.push(ws);
        saveHub(hub);
        return send(res, 200, ws);
      }
      saveHub(hub);
      return send(res, 200, { ok: true });
    }
    if (p === '/api/settings' && req.method === 'POST') {
      const b = await body(req);
      const hub = hubCfg();
      for (const k of ['autoCleanupDays', 'uploadsCleanupDays']) if (k in b) hub[k] = Math.max(0, Math.min(365, Number(b[k]) || 0));
      saveHub(hub);
      autoCleanup();
      return send(res, 200, { autoCleanupDays: hub.autoCleanupDays, uploadsCleanupDays: hub.uploadsCleanupDays });
    }
    if (p === '/api/cleanup' && req.method === 'POST') {
      const b = await body(req);
      let n = 0;
      for (const id of b.ids || []) {
        const t = tasks.get(id);
        if (t && !isActiveTask(t)) { deleteTask(t); n++; }
      }
      const files = b.uploadsOlderThanDays ? cleanUploads(b.uploadsOlderThanDays) : 0;
      return send(res, 200, { deleted: n, files });
    }
    if (p === '/api/upload' && req.method === 'POST') {
      return send(res, 200, await saveUpload(req, url.searchParams.get('name')));
    }
    if (p === '/api/usage' && req.method === 'GET') {
      if (Date.now() - lastScanAt > 30000) scanSessions();
      return send(res, 200, usageReport(url.searchParams.get('days') === 'all' ? 0 : Number(url.searchParams.get('days')) || 30));
    }
    if (p === '/api/sessions' && req.method === 'GET') {
      if (Date.now() - lastScanAt > 30000) scanSessions();
      return send(res, 200, { scanning, scannedAt: lastScanAt, sessions: sessionList(url.searchParams.get('project') || null, lang) });
    }
    if (p === '/api/sessions/delete' && req.method === 'POST') {
      const b = await body(req);
      return send(res, 200, await deleteSessions(b.ids || [], lang));
    }
    const sm = p.match(/^\/api\/sessions\/([\w-]+)\/(transcript|open|rename|tail)$/);
    if (sm) {
      if (!findSession(sm[1])) await scanSessions(); // session created after the last scan
      const s = findSession(sm[1]);
      if (!s) return fail(404, 'server.session.notFound');
      if (sm[2] === 'rename' && req.method === 'POST') return send(res, 200, renameSession(s.id, (await body(req)).name));
      if (sm[2] === 'tail') return send(res, 200, sessionTail(s.id, Number(url.searchParams.get('offset') ?? -1), lang));
      if (sm[2] === 'transcript') return send(res, 200, await sessionTranscript(s.id, Number(url.searchParams.get('before')) || 0));
      if (req.method === 'POST') {
        const b = await body(req);
        const existing = taskOfSession(s.id);
        if (existing && !b.fork) return send(res, 200, publicTask(existing));
        if (!isDir(s.cwd)) return fail(400, 'server.session.dirGone');
        const t = newTask(s.cwd, { title: sessTitle(s, undefined, lang), resumeSessionId: s.id, fork: !!b.fork, permissionMode: b.permissionMode || 'auto' }, lang);
        updateTask(t, keyedField('lastText', 'server.task.pastSession'));
        return send(res, 200, publicTask(t));
      }
    }
    if (p === '/api/tasks' && req.method === 'GET') {
      return send(res, 200, [...tasks.values()].map(publicTask).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)));
    }
    if (p === '/api/tasks' && req.method === 'POST') return send(res, 200, createTasks(await body(req), lang));
    const m = p.match(/^\/api\/tasks\/([a-f0-9]+)(?:\/(\w+))?$/);
    if (m) {
      const t = tasks.get(m[1]);
      if (!t) return fail(404, 'server.task.notFound');
      const action = m[2];
      if (!action && req.method === 'GET') return send(res, 200, { ...publicTask(t), events: readEvents(t.id), alive: procs.has(t.id) });
      if (!action && req.method === 'DELETE') { deleteTask(t); return send(res, 200, { ok: true }); }
      if (action === 'message' && req.method === 'POST') {
        const b = await body(req);
        if ((!b.text || !b.text.trim()) && !(b.files || []).length) return fail(400, 'server.task.emptyMessage');
        for (const k of ['permissionMode', 'model', 'effort']) if (k in b) t[k] = b[k] || null;
        if (t.status === 'stopping') return fail(409, 'server.task.stopping');
        sendMessage(t, { text: b.text || '', files: b.files, skill: b.skill && skillOf(b.skill, t.projectPath) ? b.skill : undefined });
        return send(res, 200, { ok: true });
      }
      if (action === 'stop' && req.method === 'POST') {
        const qi = queue.indexOf(t.id);
        if (qi >= 0) { queue.splice(qi, 1); t.queued = []; updateTask(t, { status: 'stopped' }); }
        const e = procs.get(t.id);
        if (e) {
          updateTask(t, { status: 'stopping' });
          e.child.kill('SIGINT');
          setTimeout(() => procs.has(t.id) && e.child.kill('SIGKILL'), 5000);
        }
        return send(res, 200, { ok: true });
      }
      if (action === 'bg' && req.method === 'POST') {
        // no error yet but the session is running in the background → allow resolving it up front
        if (!t.bgConflict) { const a = (await bgFresh(5000))[t.sessionId || t.historySessionId]; if (a) t.bgConflict = a.id; }
        const id = t.bgConflict;
        if (!id || !/^[\w-]+$/.test(id)) return fail(400, 'server.bg.noConflict');
        if (procs.has(t.id)) return fail(409, 'server.bg.chatRunning');
        const b = await body(req).catch(() => ({}));
        const mode = b.mode;
        const lastUser = () => { const u = readEvents(t.id).filter(e => e.k === 'user').pop(); return u && u.text ? { text: u.text, files: [] } : null; };
        const pending = lastMsg.get(t.id) || lastUser();
        const resend = () => { if (pending && b.resend !== false) deliver(t, pending); };
        if (mode === 'attach') { openTerminal(t.projectPath, null, id); return send(res, 200, { ok: true }); }
        if (mode === 'fork') {
          updateTask(t, { fork: true, forked: false, bgConflict: null });
          pushEvent(t, { k: 'system', ...keyedText('server.bg.forked') });
          resend();
          return send(res, 200, { ok: true, resent: !!pending && b.resend !== false });
        }
        if (mode === 'stop') {
          const r = await new Promise(ok => execFile(CLAUDE_BIN, ['stop', id], { timeout: 20000 }, (e, out, err) => ok({ e, out: String(out || '') + String(err || '') })));
          if (r.e) return fail(500, 'server.bg.stopFailed', { detail: clip(r.out.trim() || String(r.e.message), 300) });
          updateTask(t, { bgConflict: null });
          bgAgents.at = 0;
          pushEvent(t, { k: 'system', ...keyedText('server.bg.moved', { id }) });
          // wait for the background process to fully exit before --resume
          for (let i = 0; i < 20; i++) {
            const m = await loadBgAgents();
            const a = Object.values(m).find(x => x.id === id);
            if (!a || !a.pid || a.status !== 'busy') break;
            await new Promise(r => setTimeout(r, 500));
          }
          setTimeout(resend, 300);
          return send(res, 200, { ok: true, resent: !!pending && b.resend !== false });
        }
        return fail(400, 'server.bg.invalidMode');
      }
      if (action === 'handoff' && req.method === 'POST') {
        const b = await body(req);
        if (!AGENTS[b.agent]) return fail(400, 'server.handoff.unknownAgent', { agent: String(b.agent || '') });
        if (isActiveTask(t)) return fail(409, 'server.handoff.busy');
        await switchAgent(t, b);
        return send(res, 200, publicTask(t));
      }
      if (action === 'rename' && req.method === 'POST') {
        const name = String((await body(req)).name || '').trim().slice(0, 120);
        if (!name) return fail(400, 'server.task.nameEmpty');
        if (t.sessionId || t.historySessionId) renameSession(t.sessionId || t.historySessionId, name);
        else updateTask(t, { title: name });
        return send(res, 200, publicTask(t));
      }
      if (action === 'terminal' && req.method === 'POST') {
        const ag = AGENTS[t.agent || 'claude'];
        openTerminal(t.projectPath, t.sessionId, null, ag && ag.resumeCmd ? ag.resumeCmd(t) : null);
        return send(res, 200, { ok: true });
      }
    }
    // remove a background agent: claude stop (if still running) then claude rm — triggered by a Hub button, with confirmation
    const am = p.match(/^\/api\/agents\/([\w-]+)\/rm$/);
    if (am && req.method === 'POST') {
      const id = am[1];
      const known = Object.values(await bgFresh(0)).find(x => x.id === id);
      if (!known) return fail(404, 'server.bg.agentNotFound');
      const run = args => new Promise(ok => execFile(CLAUDE_BIN, args, { timeout: 30000 }, (e, out, err) => ok({ e, out: (String(out || '') + String(err || '')).trim() })));
      if (known.pid) await run(['stop', id]);
      let r = await run(['rm', id]);
      // Claude Code's background daemon only runs when there is work → start it temporarily and retry
      if (r.e && /restarting|unreachable|not running/i.test(r.out)) {
        spawn(CLAUDE_BIN, ['daemon', 'run'], { detached: true, stdio: 'ignore' }).unref();
        for (let i = 0; i < 15; i++) { await new Promise(x => setTimeout(x, 700)); r = await run(['rm', id]); if (!r.e || !/restarting|unreachable|not running/i.test(r.out)) break; }
      }
      bgAgents.at = 0;
      if (r.e) return send(res, 500, { error: clip(r.out || String(r.e.message), 600) });
      return send(res, 200, { ok: true, out: clip(r.out, 600) });
    }
    if (p === '/api/agents') {
      const m = await bgFresh(5000);
      // sessions whose file was deleted cannot be live-viewed
      return send(res, 200, Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v, hasFile: !!findSession(k) }])));
    }
    if (p === '/api/skills') {
      const proj = url.searchParams.get('project') || '';
      return send(res, 200, Object.values(resolveSkills(proj)).sort((a, b) => a.stage.localeCompare(b.stage)).map(({ file, body, ...k }) => ({ ...k, path: file ? tilde(file) : null })));
    }
    if (p === '/api/commands') {
      const proj = url.searchParams.get('project') || '';
      return send(res, 200, { commands: slashByProject[proj] || slashByProject[''] || [], exact: !!slashByProject[proj] });
    }
    if (p.startsWith('/api/fs/')) {
      const root = url.searchParams.get('root');
      try {
        if (p === '/api/fs/list') return send(res, 200, fsList(root, url.searchParams.get('dir') || ''));
        if (p === '/api/fs/read') return send(res, 200, fsRead(root, url.searchParams.get('path')));
        if (p === '/api/fs/raw') {
          const { real } = fsResolve(root, url.searchParams.get('path'));
          const type = MIME[path.extname(real).toLowerCase()];
          if (!type || !/^image\//.test(type)) return fail(415, 'server.fs.imagesOnly');
          // project images must not run scripts in the Hub's origin (svg)
          res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
          return fs.createReadStream(real).pipe(res);
        }
        if (p === '/api/fs/write' && req.method === 'POST') { const b = await body(req); return send(res, 200, fsWrite(b.root, b)); }
      } catch (e) {
        const code = e.code === 409 ? 409 : 400;
        if (e.key) return fail(code, e.key, e.params);
        return e.code === 'ENOENT' ? fail(code, 'server.fs.notFound') : send(res, code, { error: e.message });
      }
    }
    if (p === '/api/terminal' && req.method === 'POST') {
      const b = await body(req);
      if (!isDir(b.path)) return fail(400, 'server.dir.notFound');
      if (b.attachId && !/^[\w-]+$/.test(b.attachId)) return fail(400, 'server.terminal.invalidId');
      openTerminal(b.path, b.sessionId || null, b.attachId || null);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET') {
      if (p.startsWith('/uploads/') && serveFile(res, UPLOADS, p.slice(9))) return;
      if (serveFile(res, PUBLIC, p === '/' ? 'index.html' : p.slice(1))) return;
    }
    fail(404, 'server.http.notFound');
  } catch (e) {
    if (e.key) fail(400, e.key, e.params);
    else send(res, 400, { error: e.message || String(e) });
  }
});

// ---------- Delete past sessions (moved to the system Trash so they can be restored) ----------
function dirSize(d) {
  let n = 0;
  for (const e of listDir(d)) {
    const f = path.join(d, e.name);
    try { n += e.isDirectory() ? dirSize(f) : fs.statSync(f).size; } catch { /* ignore */ }
  }
  return n;
}
function moveToTrash(f) {
  return new Promise(resolve => {
    execFile('gio', ['trash', f], err => {
      if (!err) return resolve(true);
      // no gio -> move into the Hub's data/trash
      try {
        const dest = path.join(DATA, 'trash', dayKey(Date.now()), path.basename(path.dirname(f)));
        fs.mkdirSync(dest, { recursive: true });
        fs.renameSync(f, path.join(dest, path.basename(f)));
        resolve(true);
      } catch { resolve(false); }
    });
  });
}
async function deleteSessions(ids, lang = 'vi') {
  const out = { deleted: 0, freed: 0, chats: 0, skipped: [] };
  const skip = (id, key) => out.skipped.push({ id, reason: tr(lang, key), reasonKey: key });
  // deleting a chat's entry deletes every session in its chain
  const asked = new Set(ids);
  ids = [...new Set(ids.flatMap(id => { const t = taskOfSession(id); return t ? [id, ...sessionChain(t)] : [id]; }))];
  for (const id of ids) {
    const s = findSession(id);
    if (!s) { if (asked.has(id)) skip(id, 'server.cleanup.gone'); continue; } // older parts of a chain may be gone already
    const linked = [...tasks.values()].filter(t => sessionChain(t).includes(id) || t.sessionId === id || t.historySessionId === id);
    if (linked.some(t => procs.has(t.id) || isActiveTask(t))) { skip(id, 'server.cleanup.runningInHub'); continue; }
    let mtime = 0;
    try { mtime = fs.statSync(s.file).mtimeMs; } catch { /* already gone */ }
    if (Date.now() - mtime < 120000) { skip(id, 'server.cleanup.recentlyActive'); continue; }
    const extra = path.join(path.dirname(s.file), id); // subagents, tool-results
    const size = (exists(s.file) ? fs.statSync(s.file).size : 0) + (isDir(extra) ? dirSize(extra) : 0);
    if (exists(s.file) && !(await moveToTrash(s.file))) { skip(id, 'server.cleanup.trashFailed'); continue; }
    if (isDir(extra)) await moveToTrash(extra);
    delete scanCache[s.file];
    for (const t of linked) { deleteTask(t); out.chats++; }
    out.deleted++;
    out.freed += size;
  }
  writeJSON(SCAN_CACHE_FILE, scanCache);
  broadcast({ type: 'sessions-updated' });
  return out;
}

// ---------- Cleanup ----------
const isActiveTask = t => ['queued', 'running', 'stopping'].includes(t.status);
function deleteTask(t) {
  const e = procs.get(t.id);
  if (e) e.child.kill('SIGTERM');
  const qi = queue.indexOf(t.id);
  if (qi >= 0) queue.splice(qi, 1);
  tasks.delete(t.id);
  saveTasks();
  try { fs.unlinkSync(logFile(t.id)); } catch { /* already deleted */ }
  broadcast({ type: 'removed', id: t.id });
}
// Delete uploads/<date> folders older than N days; returns the number of files deleted
function cleanUploads(days) {
  const limit = dayKey(Date.now() - days * 86400000);
  let n = 0;
  for (const d of listDir(UPLOADS).filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name) && d.name < limit)) {
    n += listDir(path.join(UPLOADS, d.name)).length;
    fs.rmSync(path.join(UPLOADS, d.name), { recursive: true, force: true });
  }
  return n;
}
function autoCleanup() {
  const hub = hubCfg();
  if (hub.autoCleanupDays > 0) {
    const cut = Date.now() - hub.autoCleanupDays * 86400000;
    const old = [...tasks.values()].filter(t => !isActiveTask(t) && (t.updatedAt || t.createdAt) < cut);
    old.forEach(deleteTask);
    if (old.length) console.log(`   🧹 Auto-cleaned ${old.length} chats older than ${hub.autoCleanupDays} days`);
  }
  if (hub.uploadsCleanupDays > 0) cleanUploads(hub.uploadsCleanupDays);
}

server.listen(PORT, HOST, () => {
  console.log(`✨ Agents Factory running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`   Claude config: ${CLAUDE_DIR} · up to ${MAX_PARALLEL} tasks in parallel`);
  scanSessions().then(() => console.log(`   Scanned ${Object.keys(scanCache).length} past sessions`));
  setInterval(scanSessions, 60000);
  autoCleanup();
  setInterval(autoCleanup, 3600000);
});

function shutdown() {
  for (const e of procs.values()) e.child.kill('SIGTERM');
  writeJSON(TASKS_FILE, [...tasks.values()]);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
