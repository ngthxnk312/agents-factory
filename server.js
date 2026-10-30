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
const GEMINI_DIR = process.env.GEMINI_CONFIG_DIR || expandHome(CFG.geminiConfigDir) || path.join(HOME, '.gemini');
const AGY_DIR = process.env.AGY_CONFIG_DIR || expandHome(CFG.agyConfigDir) || path.join(GEMINI_DIR, 'antigravity-cli');
const CODEX_DIR = process.env.CODEX_HOME || expandHome(CFG.codexConfigDir) || path.join(HOME, '.codex');
const AGENTS_DIR = path.join(HOME, '.agents');
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
  if (s.includes('opus')) return 'Opus';
  if (s.includes('sonnet')) return 'Sonnet';
  if (s.includes('haiku')) return 'Haiku';
  if (s.includes('fable')) return 'Fable';
  if (s.includes('gemini') || s.includes('argon') || s.includes('agy') || s.includes('antigravity')) return 'Gemini';
  if (s.includes('gpt') || s.includes('codex') || /^o[134]/.test(s)) return 'Codex';
  return 'Other';
};
// API list price per 1M tokens (USD) for estimating cost when the CLI doesn't emit total_cost_usd
const PRICE_PER_M = {
  Opus:   { in: 15,   out: 75,  cr: 1.5,   cw: 18.75 },
  Sonnet: { in: 3,    out: 15,  cr: 0.3,   cw: 3.75  },
  Haiku:  { in: 0.8,  out: 4,   cr: 0.08,  cw: 1     },
  Fable:  { in: 3,    out: 15,  cr: 0.3,   cw: 3.75  },
  Gemini: { in: 1.25, out: 10,  cr: 0.31,  cw: 1.25  },
  Codex:  { in: 1.5,  out: 6,   cr: 0.375, cw: 1.5   },
  Other:  { in: 2,    out: 8,   cr: 0.2,   cw: 2     },
};
const estimateCost = (u = {}, fam = 'Other') => {
  const p = PRICE_PER_M[fam] || PRICE_PER_M.Other;
  return ((u.in || 0) * p.in + (u.out || 0) * p.out + (u.cr || 0) * p.cr + (u.cw || 0) * p.cw) / 1e6;
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

// ---------- Read local agent configs (.claude, .gemini, .agents, .codex) ----------
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
function skillDirs(dir, depth = 0) {
  const out = [];
  for (const e of listDir(dir)) {
    if (!e.isDirectory() && !e.isSymbolicLink()) continue;
    const sub = path.join(dir, e.name);
    if (exists(path.join(sub, 'SKILL.md'))) out.push(e.name);
    else if (depth < 2) out.push(...skillDirs(sub, depth + 1));
  }
  return [...new Set(out)];
}
const uniq = arr => [...new Set((arr || []).filter(Boolean))];

// Lightweight parser for ~/.codex/config.toml (extracts model, approval_policy, [plugins.*], [mcp_servers.*])
function readCodexConfig(file) {
  if (!exists(file)) return null;
  let raw = '';
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const out = { model: null, defaultMode: null, enabledPlugins: {}, mcpServers: {} };
  let sec = '';
  for (const line of raw.split(/\r?\n/)) {
    const s = line.replace(/\s+#.*$/, '').trim();
    if (!s || s.startsWith('#')) continue;
    const sm = s.match(/^\[(.+)\]$/);
    if (sm) { sec = sm[1].trim(); continue; }
    const kv = s.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!kv) continue;
    const k = kv[1], vRaw = kv[2].trim();
    let v = vRaw;
    try { v = JSON.parse(vRaw); } catch { v = vRaw.replace(/^['"]|['"]$/g, ''); }
    if (!sec) {
      if (k === 'model' && typeof v === 'string') out.model = v;
      if ((k === 'approval_policy' || k === 'sandbox_mode') && typeof v === 'string' && !out.defaultMode) out.defaultMode = v;
      continue;
    }
    const pm = sec.match(/^plugins\.(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_.@-]+))$/);
    if (pm && k === 'enabled') {
      const pk = pm[1] || pm[2] || pm[3];
      out.enabledPlugins[pk] = !!v;
      continue;
    }
    const mm = sec.match(/^mcp_servers\.(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_.-]+))(?:\.env)?$/);
    if (mm) {
      const mk = mm[1] || mm[2] || mm[3];
      const srv = (out.mcpServers[mk] = out.mcpServers[mk] || {});
      if (sec.endsWith('.env')) { srv.env = srv.env || {}; srv.env[k] = v; }
      else srv[k] = v;
    }
  }
  return out;
}

function pluginMeta(installPath, fallback = {}) {
  if (!installPath || !isDir(installPath)) {
    return {
      description: fallback.description || '',
      author: (fallback.author && (fallback.author.name || fallback.author)) || '',
      version: fallback.version || '',
      commands: [], agents: [], skills: [], hooks: false, mcp: [], mcpDefs: {},
    };
  }
  const manifests = [
    path.join(installPath, '.claude-plugin', 'plugin.json'),
    path.join(installPath, '.codex-plugin', 'plugin.json'),
    path.join(installPath, '.antigravity', 'plugin.json'),
    path.join(installPath, 'plugin.json'),
    path.join(installPath, 'gemini-extension.json'),
    path.join(installPath, 'package.json'),
  ].map(f => readJSON(f, null)).filter(Boolean);
  const pj = Object.assign({}, fallback, ...manifests.slice().reverse());
  const mcpFile = readJSON(path.join(installPath, '.mcp.json'), null) || readJSON(path.join(installPath, 'mcp_config.json'), null);
  const mcpDefs = mcpFile ? (mcpFile.mcpServers || mcpFile) : (pj.mcpServers && typeof pj.mcpServers === 'object' && !Array.isArray(pj.mcpServers) ? pj.mcpServers : {});
  const authorObj = pj.author || (pj.interface && pj.interface.developerName);
  return {
    description: pj.description || (pj.interface && pj.interface.shortDescription) || fallback.description || '',
    author: (authorObj && (authorObj.name || authorObj)) || '',
    version: pj.version || fallback.version || '',
    commands: mdFiles(path.join(installPath, 'commands')),
    agents: mdFiles(path.join(installPath, 'agents')),
    skills: skillDirs(path.join(installPath, 'skills')),
    hooks: exists(path.join(installPath, 'hooks')) || exists(path.join(installPath, 'hooks.json')) || isDir(path.join(installPath, 'runtime')),
    mcp: Object.keys(mcpDefs || {}),
    mcpDefs: mcpDefs || {},
  };
}

function installedPlugins() {
  const rawClaude = (readJSON(path.join(CLAUDE_DIR, 'plugins', 'installed_plugins.json'), {}) || {}).plugins || {};
  const out = {};
  for (const [k, list] of Object.entries(rawClaude)) {
    out[k] = (list || []).map(x => ({ agent: 'claude', ...x }));
  }
  const add = (key, entry) => {
    out[key] = out[key] || [];
    if (!out[key].some(x => x.installPath === entry.installPath)) out[key].push(entry);
  };
  // Claude cache plugins
  const claudeCache = path.join(CLAUDE_DIR, 'plugins', 'cache');
  for (const m of listDir(claudeCache).filter(d => d.isDirectory())) {
    for (const pl of listDir(path.join(claudeCache, m.name)).filter(d => d.isDirectory())) {
      const vers = listDir(path.join(claudeCache, m.name, pl.name)).filter(d => d.isDirectory()).map(d => d.name).sort(semverCmp);
      if (vers.length) add(`${pl.name}@${m.name}`, { installPath: path.join(claudeCache, m.name, pl.name, vers.at(-1)), version: vers.at(-1), scope: 'user', agent: 'claude' });
    }
  }
  // Antigravity / Gemini plugins (~/.gemini/config/plugins/*, ~/.gemini/antigravity-cli/plugins/*, ~/.agents/plugins/*)
  for (const [dir, market] of [
    [path.join(GEMINI_DIR, 'config', 'plugins'), 'antigravity'],
    [path.join(AGY_DIR, 'plugins'), 'antigravity'],
    [path.join(AGENTS_DIR, 'plugins'), 'agents'],
  ]) {
    for (const pl of listDir(dir).filter(d => d.isDirectory() && !d.name.startsWith('.'))) {
      const ip = path.join(dir, pl.name);
      const meta = pluginMeta(ip);
      add(`${pl.name}@${market}`, { installPath: ip, version: meta.version || 'local', scope: 'user', agent: 'agy' });
    }
  }
  // Codex cached plugins (~/.codex/plugins/cache/<market>/<plugin>/<version>)
  const codexCache = path.join(CODEX_DIR, 'plugins', 'cache');
  for (const m of listDir(codexCache).filter(d => d.isDirectory())) {
    for (const pl of listDir(path.join(codexCache, m.name)).filter(d => d.isDirectory())) {
      const vers = listDir(path.join(codexCache, m.name, pl.name)).filter(d => d.isDirectory()).map(d => d.name).sort(semverCmp);
      if (!vers.length) continue;
      const ip = path.join(codexCache, m.name, pl.name, vers.at(-1));
      const meta = pluginMeta(ip);
      add(`${pl.name}@${m.name}`, { installPath: ip, version: meta.version || vers.at(-1).slice(0, 8), scope: 'user', agent: 'codex' });
    }
  }
  return out;
}

function resolvePluginInstall(key, projectPath) {
  const inst = installedPlugins();
  const [name, market] = String(key || '').split('@');
  let entries = inst[key];
  if (!entries) {
    const matchKey = Object.keys(inst).find(k => k === key || k.split('@')[0] === name);
    if (matchKey) entries = inst[matchKey];
  }
  entries = entries || [];
  const e = entries.find(x => projectPath && x.projectPath === projectPath)
    || entries.find(x => x.scope === 'user')
    || entries.slice().sort((a, b) => semverCmp(a.version, b.version)).pop();
  if (e && isDir(e.installPath)) return e;
  for (const root of [path.join(CLAUDE_DIR, 'plugins', 'cache'), path.join(CODEX_DIR, 'plugins', 'cache')]) {
    const base = path.join(root, market || '', name || '');
    const vers = listDir(base).filter(d => d.isDirectory()).map(d => d.name).sort(semverCmp);
    if (vers.length) {
      const ip = path.join(base, vers.at(-1));
      const meta = pluginMeta(ip);
      return { installPath: ip, version: meta.version || vers.at(-1).slice(0, 8), scope: 'cache' };
    }
  }
  if (projectPath) {
    for (const sub of ['.agents/plugins', '.agent/plugins', '.claude/plugins']) {
      const pDir = path.join(projectPath, sub, name);
      if (isDir(pDir)) {
        const meta = pluginMeta(pDir);
        return { installPath: pDir, version: meta.version || 'project', scope: 'project' };
      }
    }
  }
  return null;
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

// Collect enabled plugins across Claude settings, Antigravity (~/.gemini/config/config.json), Codex (config.toml), and project .agents/plugins
function collectEnabledPlugins(p, claudeLayers = settingsLayers(p)) {
  const inst = installedPlugins();
  const resolveKey = rawKey => {
    if (inst[rawKey]) return rawKey;
    const base = String(rawKey).split('@')[0];
    return Object.keys(inst).find(k => k.split('@')[0] === base) || (rawKey.includes('@') ? rawKey : `${rawKey}@antigravity`);
  };
  const enabled = {};
  for (const l of claudeLayers) {
    for (const [k, v] of Object.entries(l.data.enabledPlugins || {})) enabled[resolveKey(k)] = { on: !!v, scope: l.scope, agent: 'claude' };
  }
  const agyCfg = readJSON(path.join(GEMINI_DIR, 'config', 'config.json'), null);
  if (agyCfg && agyCfg.plugins && typeof agyCfg.plugins === 'object') {
    for (const [k, v] of Object.entries(agyCfg.plugins)) {
      const on = typeof v === 'object' && v !== null ? v.enabled !== false : !!v;
      enabled[resolveKey(k)] = { on, scope: 'user', agent: 'agy' };
    }
  }
  const codexUser = readCodexConfig(path.join(CODEX_DIR, 'config.toml'));
  if (codexUser) {
    for (const [k, v] of Object.entries(codexUser.enabledPlugins)) enabled[resolveKey(k)] = { on: !!v, scope: 'user', agent: 'codex' };
  }
  if (p && p !== HOME) {
    const codexProj = readCodexConfig(path.join(p, '.codex', 'config.toml'));
    if (codexProj) {
      for (const [k, v] of Object.entries(codexProj.enabledPlugins)) enabled[resolveKey(k)] = { on: !!v, scope: 'project', agent: 'codex' };
    }
    for (const sub of ['.agents/plugins', '.agent/plugins']) {
      for (const d of listDir(path.join(p, sub)).filter(x => x.isDirectory() && !x.name.startsWith('.'))) {
        enabled[`${d.name}@project`] = { on: true, scope: 'project', agent: 'agy' };
      }
    }
  }
  return enabled;
}

function projectConfig(p) {
  const cj = readJSON(CLAUDE_JSON, {}) || {};
  const pj = (cj.projects || {})[p] || {};
  const layers = settingsLayers(p);
  const codexUser = readCodexConfig(path.join(CODEX_DIR, 'config.toml'));
  const codexProj = p && p !== HOME ? readCodexConfig(path.join(p, '.codex', 'config.toml')) : null;

  // Default model / permission (Claude settings → Codex config → Antigravity default)
  let model = null, defaultMode = null;
  for (const l of layers) {
    if (l.data.model) model = l.data.model;
    if (l.data.permissions && l.data.permissions.defaultMode) defaultMode = l.data.permissions.defaultMode;
  }
  if (!model) model = (codexProj && codexProj.model) || (codexUser && codexUser.model) || agyMetaMap().defaultModel || null;
  if (!defaultMode) defaultMode = (codexProj && codexProj.defaultMode) || (codexUser && codexUser.defaultMode) || null;

  const enabled = collectEnabledPlugins(p, layers);
  const plugins = Object.entries(enabled).map(([key, v]) => {
    const inst = resolvePluginInstall(key, p);
    const { mcpDefs, ...meta } = inst ? pluginMeta(inst.installPath) : { mcpDefs: {} };
    const agent = v.agent || (inst && inst.agent) || 'claude';
    return { key, name: key.split('@')[0], marketplace: key.split('@')[1] || '', agent, enabled: v.on, scope: v.scope, version: (meta && meta.version) || (inst && inst.version), installed: !!inst, ...meta, _mcpDefs: mcpDefs };
  });

  // MCP servers across Claude (.claude.json, .mcp.json), Antigravity (.gemini/antigravity-cli/mcp_config.json, .gemini/config/mcp_config.json, .agents/mcp_config.json), Gemini (.gemini/settings.json), Codex (config.toml), and enabled plugins
  const mcp = [];
  const seenMcp = new Set();
  const pushMcp = (name, scope, srv, extra = {}) => {
    if (!name || !srv || typeof srv !== 'object') return;
    const k = `${name}|${scope}`;
    if (seenMcp.has(k)) return;
    seenMcp.add(k);
    mcp.push({ name, scope, ...extra, ...maskServer(srv) });
  };
  for (const [name, s] of Object.entries(cj.mcpServers || {})) pushMcp(name, 'user', s, { agent: 'claude' });
  for (const [f, ag] of [
    [path.join(AGY_DIR, 'mcp_config.json'), 'agy'],
    [path.join(GEMINI_DIR, 'config', 'mcp_config.json'), 'agy'],
    [path.join(GEMINI_DIR, 'settings.json'), 'gemini'],
    [path.join(AGENTS_DIR, 'mcp_config.json'), 'agy'],
  ]) {
    const j = readJSON(f, null);
    if (j && j.mcpServers) for (const [name, s] of Object.entries(j.mcpServers)) pushMcp(name, 'user', s, { agent: ag });
  }
  if (codexUser && codexUser.mcpServers) {
    for (const [name, s] of Object.entries(codexUser.mcpServers)) pushMcp(name, 'user', s, { agent: 'codex' });
  }
  for (const [name, s] of Object.entries(pj.mcpServers || {})) pushMcp(name, 'local', s, { agent: 'claude' });
  if (p && p !== HOME) {
    const mcpJson = readJSON(path.join(p, '.mcp.json'), null);
    if (mcpJson && mcpJson.mcpServers) {
      const approvedAll = layers.some(l => l.data.enableAllProjectMcpServers);
      for (const [name, s] of Object.entries(mcpJson.mcpServers)) {
        const approved = approvedAll || (pj.enabledMcpjsonServers || []).includes(name) || layers.some(l => (l.data.enabledMcpjsonServers || []).includes(name));
        const disabled = (pj.disabledMcpjsonServers || []).includes(name);
        pushMcp(name, 'project', s, { agent: 'claude', approved, disabled });
      }
    }
    for (const [rel, ag] of [
      ['.agents/mcp_config.json', 'agy'],
      ['.agent/mcp_config.json', 'agy'],
      ['mcp_config.json', 'agy'],
      ['.gemini/settings.json', 'gemini'],
      ['.gemini/mcp_config.json', 'gemini'],
    ]) {
      const j = readJSON(path.join(p, rel), null);
      if (j && j.mcpServers) for (const [name, s] of Object.entries(j.mcpServers)) pushMcp(name, 'project', s, { agent: ag, approved: true, disabled: false });
    }
    if (codexProj && codexProj.mcpServers) {
      for (const [name, s] of Object.entries(codexProj.mcpServers)) pushMcp(name, 'project', s, { agent: 'codex', approved: true, disabled: false });
    }
  }
  for (const pl of plugins.filter(x => x.enabled && x.mcp && x.mcp.length)) {
    for (const name of pl.mcp) {
      const def = (pl._mcpDefs && pl._mcpDefs[name]) || {};
      pushMcp(name, 'plugin', def, { agent: pl.agent, plugin: pl.key, type: def.type || (def.url ? 'http' : def.command ? 'stdio' : 'plugin') });
    }
  }
  for (const pl of plugins) delete pl._mcpDefs;

  // Rule / instruction files: AGENTS.md first (unified multi-agent instructions), then CLAUDE.md, GEMINI.md, .agents/rules/*.md
  const ruleCandidates = [
    path.join(p, 'AGENTS.md'), path.join(p, '.agents', 'AGENTS.md'), path.join(p, '.agent', 'AGENTS.md'),
    path.join(p, 'CLAUDE.md'), path.join(p, '.claude', 'CLAUDE.md'), path.join(p, 'CLAUDE.local.md'),
    path.join(p, 'GEMINI.md'), path.join(p, '.gemini', 'GEMINI.md'),
    ...listDir(path.join(p, '.agents', 'rules')).filter(e => e.isFile() && e.name.endsWith('.md')).map(e => path.join(p, '.agents', 'rules', e.name)),
  ];
  const claudeMd = uniq(ruleCandidates.filter(exists));
  const ruleFile = claudeMd[0] ? path.basename(claudeMd[0]) : 'AGENTS.md';
  let claudeMdPreview = '';
  if (claudeMd[0]) { try { claudeMdPreview = fs.readFileSync(claudeMd[0], 'utf8').slice(0, 4000); } catch { /* ignore */ } }

  // Settings files across all agents
  const settingsCandidates = [
    ...layers.map(l => ({ scope: l.scope, file: l.file })),
    { scope: 'user', file: path.join(GEMINI_DIR, 'config', 'config.json') },
    { scope: 'user', file: path.join(GEMINI_DIR, 'settings.json') },
    { scope: 'user', file: path.join(AGY_DIR, 'mcp_config.json') },
    { scope: 'user', file: path.join(CODEX_DIR, 'config.toml') },
    ...(p && p !== HOME ? [
      { scope: 'project', file: path.join(p, '.agents', 'mcp_config.json') },
      { scope: 'project', file: path.join(p, '.gemini', 'settings.json') },
      { scope: 'project', file: path.join(p, '.codex', 'config.toml') },
    ] : []),
  ].filter(x => exists(x.file));
  const seenSf = new Set();
  const settingsFiles = settingsCandidates.filter(x => !seenSf.has(x.file) && seenSf.add(x.file)).map(x => ({ scope: x.scope, file: tilde(x.file) }));

  // Commands, subagents, and skills across .claude, .gemini, .agents, .codex, and enabled plugins
  const plugCmds = plugins.filter(x => x.enabled).flatMap(x => x.commands || []);
  const plugAgents = plugins.filter(x => x.enabled).flatMap(x => x.agents || []);
  const plugSkills = plugins.filter(x => x.enabled).flatMap(x => x.skills || []);
  const userCmds = uniq([
    ...mdFiles(path.join(CLAUDE_DIR, 'commands')),
    ...mdFiles(path.join(GEMINI_DIR, 'config', 'commands')),
    ...mdFiles(path.join(AGENTS_DIR, 'commands')),
    ...plugCmds,
  ]);
  const projCmds = p === HOME ? [] : uniq([
    ...mdFiles(path.join(p, '.claude', 'commands')),
    ...mdFiles(path.join(p, '.agents', 'commands')),
    ...mdFiles(path.join(p, '.agent', 'commands')),
    ...mdFiles(path.join(p, '.gemini', 'commands')),
  ]);
  const userAgents = uniq([
    ...mdFiles(path.join(CLAUDE_DIR, 'agents')),
    ...mdFiles(path.join(GEMINI_DIR, 'config', 'agents')),
    ...mdFiles(path.join(AGENTS_DIR, 'agents')),
    ...plugAgents,
  ]);
  const projAgents = p === HOME ? [] : uniq([
    ...mdFiles(path.join(p, '.claude', 'agents')),
    ...mdFiles(path.join(p, '.agents', 'agents')),
    ...mdFiles(path.join(p, '.agent', 'agents')),
    ...mdFiles(path.join(p, '.gemini', 'agents')),
  ]);
  const userSkills = uniq([
    ...skillDirs(path.join(CLAUDE_DIR, 'skills')),
    ...skillDirs(path.join(GEMINI_DIR, 'config', 'skills')),
    ...skillDirs(path.join(AGY_DIR, 'builtin', 'skills')),
    ...skillDirs(path.join(AGENTS_DIR, 'skills')),
    ...skillDirs(path.join(CODEX_DIR, 'skills')),
    ...plugSkills,
  ]);
  const projSkills = p === HOME ? [] : uniq([
    ...skillDirs(path.join(p, '.claude', 'skills')),
    ...skillDirs(path.join(p, '.agents', 'skills')),
    ...skillDirs(path.join(p, '.agent', 'skills')),
    ...skillDirs(path.join(p, '.gemini', 'skills')),
    ...skillDirs(path.join(p, '.codex', 'skills')),
  ]);

  return {
    path: p, display: tilde(p), name: path.basename(p) || p,
    branch: gitBranch(p), model, defaultMode,
    ruleFile, claudeMd: claudeMd.map(tilde), claudeMdPreview,
    settingsFiles,
    mcp, plugins,
    commands: { user: userCmds, project: projCmds },
    agents: { user: userAgents, project: projAgents },
    skills: { user: userSkills, project: projSkills },
    allowedTools: [...new Set(layers.flatMap(l => (l.data.permissions && l.data.permissions.allow) || []))].length,
    lastSessionId: pj.lastSessionId || null,
  };
}

function projectSummary(p) {
  const c = projectConfig(p);
  return {
    path: p, display: c.display, name: c.name, branch: c.branch, model: c.model,
    hasClaudeMd: c.claudeMd.length > 0, ruleFile: c.ruleFile,
    mcpCount: c.mcp.filter(m => !m.disabled).length,
    pluginCount: c.plugins.filter(x => x.enabled).length,
    lastSessionId: c.lastSessionId,
  };
}

// Projects = folders the user actually chatted in: any agent's past sessions (temp dirs excluded), folders opened
// with Claude Code (~/.claude.json), Hub chats, and folders added by hand. Never guessed from sub-folders or
// marker files (CLAUDE.md / AGENTS.md / .git) — that listed every child repo of a workspace.
function allProjectPaths() {
  const cj = readJSON(CLAUDE_JSON, {}) || {};
  const tmp = fs.realpathSync(os.tmpdir());
  const sessionDirs = Object.values(scanCache)
    .filter(s => s.cwd && (s.prompts > 0 || (s.tokens && s.tokens.out > 0)) && s.cwd !== tmp && !s.cwd.startsWith(tmp + path.sep))
    .map(s => s.cwd);
  return [...new Set([
    ...sessionDirs,
    ...Object.keys(cj.projects || {}),
    ...[...tasks.values()].map(t => t.projectPath),
    ...hubCfg().extraProjects,
  ])].filter(isDir);
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
  const inst = installedPlugins();
  const userEnabledMap = collectEnabledPlugins(HOME);
  const enabledIn = {};
  for (const p of allProjectPaths()) {
    if (p === HOME) continue;
    const projEnabled = collectEnabledPlugins(p);
    for (const [k, v] of Object.entries(projEnabled)) {
      if (v.on && (v.scope === 'project' || v.scope === 'local')) (enabledIn[k] = enabledIn[k] || new Set()).add(tilde(p));
    }
  }
  const out = [];
  const seenKeys = new Set();
  const pushPlugin = (key, name, marketplace, ver, versions, installPath, fallbackMeta = {}, isInstalled = true, agent = 'claude') => {
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    const { mcpDefs, ...meta } = pluginMeta(installPath, fallbackMeta);
    const ue = userEnabledMap[key] || Object.entries(userEnabledMap).find(([k]) => k.split('@')[0] === name)?.[1];
    out.push({
      key, name, marketplace,
      agent: (ue && ue.agent) || agent,
      version: meta.version || ver || '',
      versions: versions && versions.length ? versions : (meta.version || ver ? [meta.version || ver] : []),
      installed: isInstalled,
      userEnabled: !!(ue && ue.on),
      enabledIn: [...(enabledIn[key] || [])],
      ...meta,
    });
  };
  // 1. All installed/cached plugins across Claude, Antigravity, and Codex
  for (const [key, entries] of Object.entries(inst)) {
    const [name, marketplace = 'local'] = key.split('@');
    const sorted = (entries || []).slice().sort((a, b) => semverCmp(a.version, b.version));
    const latest = sorted.at(-1);
    if (!latest || !isDir(latest.installPath)) continue;
    pushPlugin(key, name, marketplace, latest.version, sorted.map(x => x.version).filter(Boolean), latest.installPath, {}, true, latest.agent || 'claude');
  }
  // 2. Antigravity marketplace catalogs (~/.gemini/antigravity-cli/cache/marketplaces/*/marketplace.json)
  const agyMarkets = path.join(AGY_DIR, 'cache', 'marketplaces');
  for (const m of listDir(agyMarkets).filter(d => d.isDirectory())) {
    const mj = readJSON(path.join(agyMarkets, m.name, 'marketplace.json'), null);
    if (!mj || !Array.isArray(mj.plugins)) continue;
    for (const p of mj.plugins) {
      if (!p || !p.name) continue;
      const key = `${p.name}@${m.name}`;
      if (seenKeys.has(key) || [...seenKeys].some(k => k.split('@')[0] === p.name)) continue;
      pushPlugin(key, p.name, m.name, p.version, p.version ? [p.version] : [], null, p, false, 'agy');
    }
  }
  return out.sort((a, b) => (b.userEnabled - a.userEnabled) || (b.installed - a.installed) || a.key.localeCompare(b.key));
}

let claudeVersion = '', claudeMissing = false;
execFile(CLAUDE_BIN, ['--version'], (e, out) => { claudeMissing = !!e; claudeVersion = e ? '' : out.trim(); });
// detect which agents are installed (and their versions)
const agentInfo = {};
for (const a of Object.values(AGENTS)) {
  execFile(expandHome(a.bin), ['--version'], { timeout: 15000 }, (e, out, err) => {
    agentInfo[a.key] = e && e.code === 'ENOENT' ? { available: false } : { available: true, version: String(out || err || '').trim().split('\n')[0].slice(0, 60) };
    if (a.key === 'agy' && agentInfo[a.key].available && !(CFG.agents && CFG.agents.agy && CFG.agents.agy.models)) {
      execFile(expandHome(a.bin), ['models'], { timeout: 15000 }, (me, mout) => {
        if (me || !mout) return;
        const clean = String(mout).replace(/\x1b\[[0-9;]*[a-zA-Z]|\r[^\n]*\r/g, '');
        const parsed = [];
        for (const line of clean.split('\n')) {
          const m = line.trim().match(/^([a-z0-9][a-z0-9._-]+)\s{2,}(.+)$/i);
          if (m) parsed.push([m[1].trim(), m[2].trim()]);
        }
        if (parsed.length) a.models = parsed;
      });
    }
  });
}
const defaultAgentKey = () => {
  if (agentInfo.claude && agentInfo.claude.available) return 'claude';
  const first = Object.values(AGENTS).find(a => agentInfo[a.key] && agentInfo[a.key].available);
  return first ? first.key : 'claude';
};
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

// ---------- Past sessions (~/.claude/projects/*/*.jsonl, ~/.gemini/antigravity-cli/brain/*, ~/.codex/sessions/*, ~/.gemini/tmp/*/chats/*) ----------
// Incremental scan: jsonl files are append-only, so store the offset and read only new data.
const SCAN_CACHE_FILE = path.join(DATA, 'sessions-cache.json');
const SCAN_V = 5; // bump when aggregation changes → rescan from scratch
const scanCache = readJSON(SCAN_CACHE_FILE, {}) || {};
for (const k of Object.keys(scanCache)) if (scanCache[k].v !== SCAN_V) delete scanCache[k];

// ---------- Accounts: the user switches accounts often → record which account was logged in when, to split tokens per account ----------
const ACCT_FILE = path.join(DATA, 'accounts.json');
const acct = Object.assign({ timeline: [], limits: {} }, readJSON(ACCT_FILE, {}));
function currentAccount() {
  const a = (readJSON(CLAUDE_JSON, {}) || {}).oauthAccount;
  if (a && a.emailAddress) {
    return { email: a.emailAddress, name: a.displayName || a.fullName || '', org: a.organizationName || '', plan: a.organizationType || a.billingType || '', tier: a.userRateLimitTier || a.organizationRateLimitTier || '', since: a.profileFetchedAt ? Date.parse(a.profileFetchedAt) || null : null };
  }
  const ga = readJSON(path.join(GEMINI_DIR, 'google_accounts.json'), null);
  if (ga && ga.active && typeof ga.active === 'string') {
    return { email: ga.active, name: ga.active.split('@')[0], org: 'Google / Antigravity', plan: 'Google OAuth', tier: '', since: null };
  }
  return null;
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

function newSessionState(id, file, agent = 'claude') {
  return {
    id, file, agent, offset: 0, cwd: null, aiTitle: null, customTitle: null, firstPrompt: null,
    firstAt: null, lastAt: null, prompts: 0, models: {},
    tokens: { in: 0, out: 0, cr: 0, cw: 0 }, days: {}, runs: {}, recentIds: [], acct: {}, v: SCAN_V,
  };
}
function recordUsage(s, idKey, add, model, ts) {
  if (idKey) {
    if (s.recentIds.includes(idKey)) return;
    s.recentIds.push(idKey);
    if (s.recentIds.length > 60) s.recentIds.shift();
  }
  for (const k of ['in', 'out', 'cr', 'cw']) s.tokens[k] = (s.tokens[k] || 0) + (add[k] || 0);
  const fam = modelFamily(model || s.agent);
  if (add.out) s.models[fam] = (s.models[fam] || 0) + add.out;
  if (ts) {
    const dk = dayKey(ts);
    const d = (s.days[dk] = s.days[dk] || {});
    const b = (d[fam] = d[fam] || { in: 0, out: 0, cr: 0, cw: 0 });
    for (const k of ['in', 'out', 'cr', 'cw']) b[k] += add[k] || 0;
    const ak = accountAt(ts) || '?';
    const ad = ((s.acct[ak] = s.acct[ak] || {})[dk] = s.acct[ak][dk] || { in: 0, out: 0, cr: 0, cw: 0 });
    for (const k of ['in', 'out', 'cr', 'cw']) ad[k] += add[k] || 0;
  }
}
function addUsage(s, msg, ts) {
  const u = msg.usage;
  if (!u || !msg.id || msg.model === '<synthetic>') return;
  const add = { in: u.input_tokens || 0, out: u.output_tokens || 0, cr: u.cache_read_input_tokens || 0, cw: u.cache_creation_input_tokens || 0 };
  recordUsage(s, msg.id, add, msg.model, ts);
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
  if (!s || st.size < s.offset) s = newSessionState(id, file, 'claude'); // file was rewritten -> rescan from the start
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

// ---------- Antigravity (`agy`) & Codex session scanners ----------
let sqliteMod = undefined;
function getSqlite() {
  if (sqliteMod !== undefined) return sqliteMod;
  const origEmit = process.emitWarning;
  process.emitWarning = (w, ...args) => {
    if (args[0] === 'ExperimentalWarning' || (w && w.name === 'ExperimentalWarning')) return;
    return origEmit.call(process, w, ...args);
  };
  try { sqliteMod = require('node:sqlite'); } catch { sqliteMod = null; }
  return sqliteMod;
}
function agyMetaMap() {
  const byId = {};
  const settings = readJSON(path.join(AGY_DIR, 'settings.json'), {}) || {};
  const defaultModel = settings.model || 'Gemini';
  const defaultWs = Array.isArray(settings.trustedWorkspaces) && settings.trustedWorkspaces[0] ? settings.trustedWorkspaces[0] : null;
  const histFile = path.join(AGY_DIR, 'history.jsonl');
  if (exists(histFile)) {
    try {
      for (const l of fs.readFileSync(histFile, 'utf8').split('\n')) {
        if (!l.trim()) continue;
        const o = JSON.parse(l);
        if (o.conversationId) {
          byId[o.conversationId] = byId[o.conversationId] || {};
          if (o.workspace) byId[o.conversationId].cwd = o.workspace;
          if (o.display && !byId[o.conversationId].title) byId[o.conversationId].title = String(o.display).slice(0, 140);
        }
      }
    } catch { /* ignore */ }
  }
  const dbFile = path.join(AGY_DIR, 'conversation_summaries.db');
  const sq = exists(dbFile) && getSqlite();
  if (sq && sq.DatabaseSync) {
    let db;
    try {
      db = new sq.DatabaseSync(dbFile, { open: true, readOnly: true });
      const rows = db.prepare('SELECT conversation_id, title, preview, workspace_uris FROM conversation_summaries').all();
      for (const r of rows) {
        const cur = (byId[r.conversation_id] = byId[r.conversation_id] || {});
        if (r.title || r.preview) cur.title = r.title || r.preview;
        if (r.workspace_uris) {
          try {
            const uris = JSON.parse(r.workspace_uris);
            if (uris && uris[0]) cur.cwd = decodeURIComponent(String(uris[0]).replace(/^file:\/\//, ''));
          } catch { /* ignore */ }
        }
      }
    } catch { /* db busy */ } finally { try { db && db.close(); } catch { /* ignore */ } }
  }
  return { defaultModel, defaultWs, byId };
}
function cleanAgyPrompt(raw) {
  const s = String(raw || '');
  const m = s.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/);
  const body = m ? m[1] : s.replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/g, '').replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '').replace(/<SYSTEM_MESSAGE>[\s\S]*?<\/SYSTEM_MESSAGE>/g, '');
  return body.trim();
}
function scanAgyLine(s, line, defaultModel) {
  let o;
  try { o = JSON.parse(line); } catch { return; }
  const ts = o.created_at ? Date.parse(o.created_at) : null;
  if (o.type === 'USER_INPUT') {
    if (ts) { s.firstAt = s.firstAt || ts; s.lastAt = ts; }
    if (!s.cwd && typeof o.content === 'string') {
      const cw = o.content.match(/Command Working Directory:\s*([^\r\n<]+)/) || o.content.match(/Active Workspaces:\s*\r?\n-\s*([^\r\n<]+)/);
      if (cw && cw[1]) s.cwd = cw[1].trim();
    }
    const p = cleanAgyPrompt(o.content);
    if (p) {
      s.prompts++;
      if (!s.firstPrompt) s.firstPrompt = p.slice(0, 160);
    }
    return;
  }
  if (o.type === 'PLANNER_RESPONSE') {
    if (ts) s.lastAt = ts;
    const hasTok = o.input_tokens !== undefined || o.output_tokens !== undefined || o.cache_read_tokens !== undefined;
    const inp = o.input_tokens || 0, cr = o.cache_read_tokens || 0;
    const out = hasTok
      ? (o.output_tokens || 0) + (o.thinking_tokens || 0)
      : Math.ceil(((o.content || '').length + (o.thinking || '').length + (o.tool_calls ? JSON.stringify(o.tool_calls).length : 0)) / 4);
    if (inp + cr > 0) s.context = inp + cr;
    if (inp || out || cr) recordUsage(s, 'step-' + o.step_index, { in: inp, out, cr, cw: 0 }, o.model || defaultModel || 'Gemini', ts || s.lastAt);
  }
}
async function scanAgyFile(file, id, meta, defaultModel, defaultWs) {
  const st = fs.statSync(file);
  let s = scanCache[file];
  if (!s || st.size < s.offset || s.agent !== 'agy') s = newSessionState(id, file, 'agy');
  if (s.offset < st.size) s.offset = await eachLine(file, s.offset, line => scanAgyLine(s, line, defaultModel));
  const t = taskOfSession(id);
  if (t && t.projectPath) s.cwd = t.projectPath;
  else if (meta && meta.cwd) s.cwd = meta.cwd;
  else if (!s.cwd && defaultWs) s.cwd = defaultWs;
  if (meta && meta.title) s.aiTitle = meta.title;
  else if (t && t.title && !s.aiTitle) s.aiTitle = t.title;
  s.size = st.size;
  s.mtime = st.mtimeMs;
  scanCache[file] = s;
  return s;
}
function codexFiles(dir, depth = 0) {
  if (depth > 4 || !isDir(dir)) return [];
  const out = [];
  for (const d of listDir(dir)) {
    const f = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...codexFiles(f, depth + 1));
    else if (d.isFile() && d.name.endsWith('.jsonl')) out.push(f);
  }
  return out;
}
function scanCodexLine(s, line) {
  let o;
  try { o = JSON.parse(line); } catch { return; }
  const ts = o.timestamp ? Date.parse(o.timestamp) : null;
  if (ts) { s.firstAt = s.firstAt || ts; s.lastAt = ts; }
  if (o.type === 'session_meta' && o.payload) {
    if (o.payload.id) s.id = o.payload.id;
    if (o.payload.cwd && !s.cwd) s.cwd = o.payload.cwd;
    return;
  }
  if (o.type === 'turn_context' && o.payload) {
    if (o.payload.cwd && !s.cwd) s.cwd = o.payload.cwd;
    if (o.payload.model) s.lastModel = o.payload.model;
    return;
  }
  if (o.type === 'event_msg' && o.payload) {
    const p = o.payload;
    if (p.type === 'user_message' && p.message) {
      s.prompts++;
      if (!s.firstPrompt) s.firstPrompt = String(p.message).trim().slice(0, 160);
    } else if (p.type === 'token_count' && p.info) {
      const u = p.info.last_token_usage || p.info.total_token_usage;
      if (u) {
        const inp = u.input_tokens || 0, cr = u.cached_input_tokens || 0, out = (u.output_tokens || 0) + (u.reasoning_output_tokens || 0);
        if (inp + cr > 0) s.context = inp + cr;
        const key = 'tc-' + ((p.info.total_token_usage && p.info.total_token_usage.total_tokens) || ts || s.recentIds.length);
        if (inp || out || cr) recordUsage(s, key, { in: inp, out, cr, cw: 0 }, s.lastModel || 'Codex', ts || s.lastAt);
      }
    }
  }
}
async function scanCodexFile(file) {
  const st = fs.statSync(file);
  let s = scanCache[file];
  const m = path.basename(file, '.jsonl').match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  const fallbackId = m ? m[1] : path.basename(file, '.jsonl');
  if (!s || st.size < s.offset || s.agent !== 'codex') s = newSessionState(fallbackId, file, 'codex');
  if (s.offset < st.size) s.offset = await eachLine(file, s.offset, line => scanCodexLine(s, line));
  const t = taskOfSession(s.id);
  if (t && t.projectPath) s.cwd = t.projectPath;
  s.size = st.size;
  s.mtime = st.mtimeMs;
  scanCache[file] = s;
  return s;
}
function scanGeminiFile(file, fallbackCwd) {
  const st = fs.statSync(file);
  let s = scanCache[file];
  if (s && s.offset === st.size && s.agent === 'gemini') return s;
  const o = readJSON(file, null);
  if (!o || !o.sessionId) return null;
  s = newSessionState(o.sessionId, file, 'gemini');
  s.offset = st.size;
  s.size = st.size;
  s.mtime = st.mtimeMs;
  s.firstAt = o.startTime ? Date.parse(o.startTime) : st.mtimeMs;
  s.lastAt = o.lastUpdated ? Date.parse(o.lastUpdated) : st.mtimeMs;
  const t = taskOfSession(s.id);
  s.cwd = (t && t.projectPath) || fallbackCwd || HOME;
  for (const m of o.messages || []) {
    const ts = m.timestamp ? Date.parse(m.timestamp) : s.lastAt;
    if (ts) s.lastAt = ts;
    if (m.type === 'user') {
      const txt = Array.isArray(m.content) ? m.content.map(c => c.text || '').join('\n').trim() : String(m.content || '').trim();
      if (txt) {
        s.prompts++;
        if (!s.firstPrompt) s.firstPrompt = txt.slice(0, 160);
      }
    } else if (m.type === 'gemini' && m.tokens) {
      const inp = m.tokens.input || 0, cr = m.tokens.cached || 0, out = (m.tokens.output || 0) + (m.tokens.thoughts || 0);
      if (inp + cr > 0) s.context = inp + cr;
      if (inp || out || cr) recordUsage(s, m.id || ('gm-' + ts), { in: inp, out, cr, cw: 0 }, m.model || 'Gemini', ts);
    }
  }
  scanCache[file] = s;
  return s;
}

async function scanSessions() {
  if (scanning) return;
  scanning = true;
  try {
    // 1. Claude Code sessions (~/.claude/projects/*/*.jsonl)
    for (const d of listDir(SESSIONS_DIR).filter(d => d.isDirectory())) {
      for (const f of listDir(path.join(SESSIONS_DIR, d.name)).filter(f => f.isFile() && f.name.endsWith('.jsonl'))) {
        try { await scanFile(path.join(SESSIONS_DIR, d.name, f.name), f.name.slice(0, -6)); } catch { /* file is mid-write */ }
      }
    }
    // 2. Antigravity sessions (~/.gemini/antigravity-cli/brain/*/.system_generated/logs/transcript.jsonl)
    const agyBrain = path.join(AGY_DIR, 'brain');
    if (isDir(agyBrain)) {
      const { defaultModel, defaultWs, byId } = agyMetaMap();
      for (const d of listDir(agyBrain).filter(d => d.isDirectory())) {
        const tf = path.join(agyBrain, d.name, '.system_generated', 'logs', 'transcript.jsonl');
        if (exists(tf)) {
          try { await scanAgyFile(tf, d.name, byId[d.name], defaultModel, defaultWs); } catch { /* file is mid-write */ }
        }
      }
    }
    // 3. Codex sessions (~/.codex/sessions/**/*.jsonl)
    for (const cf of codexFiles(path.join(CODEX_DIR, 'sessions'))) {
      try { await scanCodexFile(cf); } catch { /* file is mid-write */ }
    }
    // 4. Gemini CLI sessions (~/.gemini/tmp/*/chats/session-*.json)
    const gmTmp = path.join(GEMINI_DIR, 'tmp');
    for (const d of listDir(gmTmp).filter(e => e.isDirectory())) {
      const prFile = path.join(gmTmp, d.name, '.project_root');
      let cwd = null;
      if (exists(prFile)) { try { cwd = fs.readFileSync(prFile, 'utf8').trim(); } catch { /* ignore */ } }
      const chatsDir = path.join(gmTmp, d.name, 'chats');
      for (const f of listDir(chatsDir).filter(e => e.isFile() && e.name.endsWith('.json'))) {
        try { scanGeminiFile(path.join(chatsDir, f.name), cwd); } catch { /* ignore */ }
      }
    }
    // 4. Clean up deleted files, then ensure every Hub task with tokens is represented
    for (const f of Object.keys(scanCache)) if (!f.startsWith('hub-task:') && !exists(f)) delete scanCache[f];
    for (const t of tasks.values()) {
      if (!t.projectPath) continue;
      const sid = t.sessionId || t.historySessionId || ('task-' + t.id);
      let s = Object.values(scanCache).find(x => x.id === sid);
      const tk = t.tokens || { in: 0, out: 0, cr: 0, cw: 0 };
      if (!s && (tk.out || tk.in || tk.cr || t.runs)) {
        const key = 'hub-task:' + sid;
        s = scanCache[key] = newSessionState(sid, logFile(t.id), t.agent || 'claude');
        s.cwd = t.projectPath; s.aiTitle = t.title; s.firstPrompt = t.title;
        s.firstAt = t.createdAt; s.lastAt = t.updatedAt || t.createdAt; s.mtime = s.lastAt;
        s.prompts = Math.max(1, t.runs || 1);
      }
      if (s) {
        if (!s.cwd) s.cwd = t.projectPath;
        const diff = {
          in: Math.max(0, (tk.in || 0) - (s.tokens.in || 0)),
          out: Math.max(0, (tk.out || 0) - (s.tokens.out || 0)),
          cr: Math.max(0, (tk.cr || 0) - (s.tokens.cr || 0)),
          cw: Math.max(0, (tk.cw || 0) - (s.tokens.cw || 0)),
        };
        if (diff.in || diff.out || diff.cr || diff.cw) {
          recordUsage(s, null, diff, t.model || t.activeModel || t.agent, t.updatedAt || t.createdAt || Date.now());
        }
        if (t.context && !s.context) s.context = t.context;
        else if (s.context && !t.context) t.context = s.context;
      }
    }
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
const sessionCost = s => {
  const runSum = Object.values(s.runs || {}).reduce((a, b) => a + b, 0);
  if (runSum > 0) return runSum;
  let est = 0;
  for (const fams of Object.values(s.days || {})) {
    for (const [fam, u] of Object.entries(fams)) est += estimateCost(u, fam);
  }
  return est || estimateCost(s.tokens, modelFamily(s.agent));
};
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
      id: s.id, agent: s.agent || 'claude', cwd: s.cwd, project: path.basename(s.cwd), projectDisplay: tilde(s.cwd),
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
  if (s.agent === 'gemini' || s.file.endsWith('.json')) {
    const o = readJSON(s.file, null);
    for (const m of (o && o.messages) || []) {
      const at = m.timestamp ? Date.parse(m.timestamp) : 0;
      if (before && at > before) continue;
      if (m.type === 'user') {
        const txt = Array.isArray(m.content) ? m.content.map(c => c.text || '').join('\n').trim() : String(m.content || '').trim();
        if (txt) evs.push({ k: 'user', text: txt, at });
      } else if (m.type === 'gemini') {
        if (Array.isArray(m.thoughts) && m.thoughts.length) {
          const th = m.thoughts.map(x => (x.subject ? `**${x.subject}**\n` : '') + (x.description || '')).join('\n\n').trim();
          if (th) evs.push({ k: 'thinking', text: clip(th, 3000), at });
        }
        for (const tc of m.toolCalls || []) {
          evs.push({ k: 'tool', id: tc.id || tc.name, name: tc.name || 'tool', input: tc.args || {}, at });
          const out = Array.isArray(tc.result) ? tc.result.map(r => (r.functionResponse && r.functionResponse.response && r.functionResponse.response.output) || '').join('\n') : '';
          if (out) evs.push({ k: 'tool_result', id: tc.id || tc.name, isError: false, text: clip(String(out), 3000), at });
        }
        const txt = typeof m.content === 'string' ? m.content.trim() : Array.isArray(m.content) ? m.content.map(c => c.text || '').join('\n').trim() : '';
        if (txt) evs.push({ k: 'text', text: txt, at });
      }
    }
    return evs.slice(-500);
  }
  await eachLine(s.file, 0, line => lineToEvents(line, evs, before, s.id));
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
  for (const line of text.slice(0, end).split('\n')) if (line) lineToEvents(line, evs, 0, s.id);
  return { offset: start + skip + Buffer.byteLength(text.slice(0, end + 1)), size, events: evs.slice(-600), mtime: fs.statSync(s.file).mtimeMs, title: sessTitle(s, undefined, lang), cwd: s.cwd };
}
// Image k of the user message with this uuid, decoded from the session file (null if not found).
// Session files run to tens of MB, so each message's images are read once and kept in a small LRU cache.
const sessionImageCache = new Map(); // `${file}|${uuid}` → Promise<[{ mime, data }]>
function sessionImage(s, uuid, k) {
  const key = `${s.file}|${uuid}`;
  let p = sessionImageCache.get(key);
  if (p) sessionImageCache.delete(key); // re-insert below = most recently used
  else {
    p = (async () => {
      let found = [];
      const needle = `"uuid":"${uuid}"`;
      await eachLine(s.file, 0, line => {
        if (found.length || !line.includes(needle)) return;
        try {
          const o = JSON.parse(line);
          if (o.uuid !== uuid) return;
          found = ((o.message && Array.isArray(o.message.content) && o.message.content) || [])
            .filter(x => x.type === 'image') // same numbering as lineToEvents
            .map(x => (x.source && x.source.type === 'base64' ? { mime: x.source.media_type || 'image/png', data: Buffer.from(x.source.data, 'base64') } : null));
        } catch { /* not JSON */ }
      });
      return found;
    })();
  }
  sessionImageCache.set(key, p);
  while (sessionImageCache.size > 40) sessionImageCache.delete(sessionImageCache.keys().next().value);
  return p.then(list => list[k] || null);
}
function lineToEvents(line, evs, before, sid) {
  if (line.includes('"type":"api-request')) return;
  let o;
  try { o = JSON.parse(line); } catch { return; }
  // Antigravity (`agy`) transcript.jsonl format
  if (o.type === 'USER_INPUT' || o.type === 'PLANNER_RESPONSE' || o.type === 'GENERIC') {
    const at = o.created_at ? Date.parse(o.created_at) : 0;
    if (before && at > before) return;
    if (o.type === 'USER_INPUT') {
      const t = cleanAgyPrompt(o.content);
      if (t) evs.push({ k: 'user', text: t, at });
    } else if (o.type === 'PLANNER_RESPONSE') {
      if (o.thinking && String(o.thinking).trim()) evs.push({ k: 'thinking', text: clip(String(o.thinking), 3000), at });
      if (Array.isArray(o.tool_calls)) {
        o.tool_calls.forEach((tc, idx) => evs.push({ k: 'tool', id: `s${o.step_index}_${idx}`, name: tc.name || 'tool', input: tc.args || {}, at }));
      }
      if (o.content && String(o.content).trim()) evs.push({ k: 'text', text: String(o.content), at });
    }
    return;
  }
  // Codex rollout jsonl format
  if (o.type === 'event_msg' && o.payload) {
    const at = o.timestamp ? Date.parse(o.timestamp) : 0;
    if (before && at > before) return;
    const p = o.payload;
    if (p.type === 'user_message' && p.message) evs.push({ k: 'user', text: String(p.message), at });
    else if (p.type === 'agent_message' && p.message) evs.push({ k: 'text', text: String(p.message), at });
    else if (p.type === 'agent_reasoning' && p.text) evs.push({ k: 'thinking', text: clip(String(p.text), 3000), at });
    return;
  }
  // Claude Code session jsonl format
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
    // images live base64-encoded in the session file → each one gets a URL served from it (see sessionImage)
    const imgs = Array.isArray(c) ? c.filter(b => b.type === 'image') : [];
    const names = [...t.matchAll(/^- (.+?) \(image, attached inline/gm)].map(m => m[1]);
    t = t.replace(/\n*\[Files attached by the user[^\]]*\][\s\S]*$/, '').trim(); // the Hub's own file list, already shown as thumbnails
    const files = imgs.map((b, i) => ({ name: names[i] || `image-${i + 1}`, isImage: true,
      url: sid && o.uuid && b.source && b.source.type === 'base64' ? `/api/sessions/${sid}/image/${o.uuid}/${i}` : undefined }));
    evs.push({ k: 'user', text: t, files: files.length ? files : undefined, at });
  } else {
    for (const b of c || []) {
      if (b.type === 'text' && b.text.trim()) evs.push({ k: 'text', text: b.text, at });
      else if (b.type === 'thinking' && b.thinking) evs.push({ k: 'thinking', text: clip(b.thinking, 3000), at });
      else if (b.type === 'tool_use') evs.push({ k: 'tool', id: b.id, name: b.name, input: b.input, at });
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
// Machine-wide long-term stats (~/.claude/stats-cache.json + scanned sessions from Antigravity/Codex/Claude)
function machineStats() {
  const st = readJSON(path.join(CLAUDE_DIR, 'stats-cache.json'), null);
  const byModel = {};
  if (st && st.modelUsage) {
    for (const [m, u] of Object.entries(st.modelUsage)) {
      byModel[m] = { model: m, in: u.inputTokens || 0, out: u.outputTokens || 0, cr: u.cacheReadInputTokens || 0, cw: u.cacheCreationInputTokens || 0 };
    }
  }
  const nonClaude = Object.values(scanCache).filter(s => (s.agent && s.agent !== 'claude') || !st);
  let minFirst = st && st.firstSessionDate ? Date.parse(st.firstSessionDate) : Infinity;
  let extraSessions = 0, extraPrompts = 0;
  for (const s of nonClaude) {
    if (!s.tokens || !(s.tokens.in || s.tokens.out || s.tokens.cr || s.tokens.cw)) continue;
    extraSessions++;
    extraPrompts += s.prompts || 0;
    if (s.firstAt && s.firstAt < minFirst) minFirst = s.firstAt;
    const label = (AGENTS[s.agent] && AGENTS[s.agent].label) || s.agent || 'Claude Code';
    const b = (byModel[label] = byModel[label] || { model: label, in: 0, out: 0, cr: 0, cw: 0 });
    for (const k of ['in', 'out', 'cr', 'cw']) b[k] += s.tokens[k] || 0;
  }
  const models = Object.values(byModel).filter(m => m.in + m.out + m.cr + m.cw > 0).sort((a, b) => b.out - a.out);
  if (!models.length) return null;
  return {
    since: minFirst < Infinity ? new Date(minFirst).toISOString() : (st && st.firstSessionDate) || null,
    computed: (st && st.lastComputedDate) || dayKey(Date.now()),
    sessions: ((st && st.totalSessions) || 0) + extraSessions,
    messages: ((st && st.totalMessages) || 0) + extraPrompts,
    models,
    daily: st && st.dailyModelTokens ? st.dailyModelTokens.map(d => ({ day: d.date, total: Object.values(d.tokensByModel || {}).reduce((a, b) => a + b, 0) })) : [],
  };
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
    let estCost = 0;
    for (const [day, fams] of Object.entries(s.days || {})) {
      if (!byDay[day]) continue;
      for (const [fam, u] of Object.entries(fams)) {
        const b = (byDay[day][fam] = byDay[day][fam] || { in: 0, out: 0, cr: 0, cw: 0 });
        for (const k in u) { b[k] += u[k]; tok[k] += u[k]; }
        estCost += estimateCost(u, fam);
      }
    }
    const runCost = Object.entries(s.runs || {}).filter(([ts]) => Number(ts) >= startMs).reduce((a, [, c]) => a + c, 0);
    const cost = runCost > 0 ? runCost : estCost;
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
  if (!t.costUsd && t.tokens && (t.tokens.in || t.tokens.out || t.tokens.cr)) {
    t.costUsd = estimateCost(t.tokens, modelFamily(t.model || t.activeModel || t.agent));
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
const briefOf = (name, i = {}) => clip(String(i.command || i.file_path || i.path || i.pattern || i.url || i.query || i.description || i.subject || i.prompt || i.skill || i.CommandLine || i.Path || i.TargetFile || i.SearchPath || i.DirectoryPath || i.toolSummary || i.Role || i.cmd || ''), 140).replace(/\s+/g, ' ');
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
  if (t.appendSystemPrompt && !t.sysSent) { text = `<system_instructions>\n${t.appendSystemPrompt}\n</system_instructions>\n\n${text}`; t.sysSent = true; }
  const images = (msg.files || []).filter(f => /^image\/(png|jpeg|gif|webp)$/.test(f.mime || '') && f.path && f.path.startsWith(UPLOADS + path.sep) && exists(f.path)).map(f => f.path);
  const args = [...(a.extraArgs || []), ...a.args(t, text, { uploads: UPLOADS, images })];
  const env = { ...process.env };
  for (const k of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT', 'CLAUDE_AGENT_SDK_VERSION']) delete env[k];
  const child = spawn(expandHome(a.bin), args, { cwd: t.projectPath, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const entry = { child, oneShot: true };
  procs.set(t.id, entry);
  updateTask(t, { status: 'running', startedAt: t.startedAt || Date.now(), lastRunAt: Date.now(), runs: (t.runs || 0) + 1, steps: 0, step: null });
  broadcast({ type: 'delta', id: t.id, reset: true });
  const started = Date.now();
  let live = '', liveThink = '', gotResult = false, rawOut = '';
  let turnUsage = { in: 0, out: 0, cr: 0, cw: 0, context: 0 };
  const tools = new Set();
  const flush = () => {
    if (liveThink.trim()) { pushEvent(t, { k: 'thinking', text: clip(liveThink, 4000) }); liveThink = ''; }
    if (live.trim()) { pushEvent(t, { k: 'text', text: live }); updateTask(t, { lastText: live.slice(0, 300) }); }
    live = ''; broadcast({ type: 'delta', id: t.id, reset: true });
  };
  // Antigravity writes step-level token counts to ~/.gemini/antigravity-cli/brain/<sessionId>/.system_generated/logs/transcript.jsonl while running
  let agyOffset = -1;
  const agySeenSteps = new Set();
  const pollTranscript = () => {
    if (t.agent !== 'agy' || !t.sessionId) return;
    const tf = path.join(AGY_DIR, 'brain', t.sessionId, '.system_generated', 'logs', 'transcript.jsonl');
    if (!exists(tf)) return;
    try {
      const sz = fs.statSync(tf).size;
      if (agyOffset < 0) agyOffset = Math.max(0, sz - 65536);
      if (sz <= agyOffset) return;
      const fd = fs.openSync(tf, 'r');
      const chunk = Buffer.alloc(sz - agyOffset);
      fs.readSync(fd, chunk, 0, chunk.length, agyOffset);
      fs.closeSync(fd);
      const raw = chunk.toString('utf8');
      const lastNl = raw.lastIndexOf('\n');
      if (lastNl < 0) return;
      agyOffset += Buffer.byteLength(raw.slice(0, lastNl + 1));
      let updated = false;
      for (const l of raw.slice(0, lastNl).split('\n')) {
        if (!l.trim()) continue;
        let o;
        try { o = JSON.parse(l); } catch { continue; }
        if (o.type !== 'PLANNER_RESPONSE') continue;
        const ts = o.created_at ? Date.parse(o.created_at) : 0;
        if (ts && ts < started - 5000) continue;
        const stepKey = `${o.step_index ?? ''}:${o.created_at || ''}`;
        if (agySeenSteps.has(stepKey)) continue;
        agySeenSteps.add(stepKey);
        const inp = o.input_tokens || 0, cr = o.cache_read_tokens || 0, out = (o.output_tokens || 0) + (o.thinking_tokens || 0);
        turnUsage.in += inp; turnUsage.cr += cr; turnUsage.out += out;
        if (inp + cr > 0) turnUsage.context = inp + cr;
        updated = true;
      }
      if (updated) {
        if (turnUsage.context) t.context = turnUsage.context;
        broadcast({ type: 'usage', id: t.id, context: t.context || 0, turnIn: turnUsage.in, turnCr: turnUsage.cr, turnOut: turnUsage.out });
      }
    } catch { /* ignore concurrent writes */ }
  };
  const pollTimer = t.agent === 'agy' ? setInterval(pollTranscript, 2000) : null;
  const h = {
    session(id, model, extra = {}) {
      const resolvedModel = model || t.model || (t.agent === 'agy' && agyMetaMap().defaultModel) || a.label;
      if (id && id !== t.sessionId) { noteSessionChange(t, id); updateTask(t, { sessionId: id, activeModel: resolvedModel }); }
      else if (resolvedModel && resolvedModel !== t.activeModel) updateTask(t, { activeModel: resolvedModel });
      if (t.agent === 'agy' && id) {
        const tf = path.join(AGY_DIR, 'brain', id, '.system_generated', 'logs', 'transcript.jsonl');
        if (agyOffset < 0) try { agyOffset = exists(tf) ? fs.statSync(tf).size : 0; } catch { agyOffset = 0; }
      }
      const key = JSON.stringify([t.agent, resolvedModel]);
      if (key !== t.lastInitKey) { t.lastInitKey = key; pushEvent(t, { k: 'init', agent: t.agent, model: resolvedModel, permissionMode: t.permissionMode, tools: extra.tools || 0, mcp: [], plugins: [] }); }
    },
    delta(x) { live += x; broadcast({ type: 'delta', id: t.id, text: x }); },
    thinkingDelta(x) { liveThink += x; },
    flush,
    pollTranscript,
    usage(u = {}) {
      if (u.in != null) turnUsage.in = u.in;
      if (u.cr != null) turnUsage.cr = u.cr;
      if (u.out != null) turnUsage.out = u.out;
      if (u.context) { turnUsage.context = u.context; t.context = u.context; }
      broadcast({ type: 'usage', id: t.id, context: t.context || 0, turnIn: turnUsage.in, turnCr: turnUsage.cr, turnOut: turnUsage.out });
    },
    todos(items) {
      if (Array.isArray(items)) updateTask(t, { todos: items });
    },
    text(x) { flush(); if (String(x).trim()) { pushEvent(t, { k: 'text', text: x }); updateTask(t, { lastText: String(x).slice(0, 300) }); } },
    thinking(x) { if (String(x).trim()) pushEvent(t, { k: 'thinking', text: clip(x, 4000) }); },
    tool(id, name, input) { if (tools.has(id)) return; tools.add(id); flush(); pushEvent(t, { k: 'tool', id, name, input }); updateTask(t, { lastText: `🔧 ${name}`, ...progressPatch(t, name, input) }); },
    toolResult(id, isError, out) { pushEvent(t, { k: 'tool_result', id, isError: !!isError, text: clip(String(out || '')) }); },
    stderr(x) { pushEvent(t, { k: 'stderr', text: clip(String(x), 4000) }); },
    result(r) {
      flush(); pollTranscript(); gotResult = true;
      const inTok = r.in || turnUsage.in || 0;
      const outTok = r.out || turnUsage.out || 0;
      const crTok = r.cr || turnUsage.cr || 0;
      const cwTok = r.cw || turnUsage.cw || 0;
      const tk = t.tokens || { in: 0, out: 0, cr: 0, cw: 0 };
      tk.in += inTok; tk.out += outTok; tk.cr += crTok; tk.cw += cwTok;
      const ctx = r.context || turnUsage.context || (inTok + crTok) || t.context || 0;
      if (ctx) t.context = ctx;
      const duration = r.duration || Date.now() - started;
      const turnCost = r.cost || estimateCost({ in: inTok, out: outTok, cr: crTok, cw: cwTok }, modelFamily(t.model || t.activeModel || t.agent));
      const costUsd = (t.costUsd || 0) + turnCost;
      pushEvent(t, { k: 'result', ok: r.ok, ...(r.ok ? { text: '' } : r.text ? { text: r.text } : keyedText(r.textKey || 'server.result.error', r.params)), cost: turnCost, costTotal: costUsd, duration, turns: r.turns, in: inTok, cr: crTok, out: outTok, denials: r.denials || [] });
      updateTask(t, { status: r.ok ? 'done' : 'error', costUsd, tokens: tk, context: t.context || 0, durationMs: (t.durationMs || 0) + duration, denials: (t.denials || 0) + (r.denials || []).length, endedAt: Date.now() });
      scanSessions();
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
    if (pollTimer) clearInterval(pollTimer);
    if (buf.trim()) onLine(buf.trim());
    pollTranscript();
    procs.delete(t.id);
    if (!a.parse && !gotResult) { live = rawOut; h.result({ ok: code === 0, text: errBuf.trim() }); }
    if (!gotResult && (turnUsage.in || turnUsage.out || turnUsage.cr)) {
      const tk = t.tokens || { in: 0, out: 0, cr: 0, cw: 0 };
      tk.in += turnUsage.in; tk.out += turnUsage.out; tk.cr += turnUsage.cr;
      t.tokens = tk;
      t.costUsd = (t.costUsd || 0) + estimateCost(turnUsage, modelFamily(t.model || t.activeModel || t.agent));
      if (turnUsage.context) t.context = turnUsage.context;
    }
    if (missingBin && t.status !== 'stopping') pushEvent(t, { k: 'stderr', ...keyedText('server.agent.binNotFound', { bin: a.bin, label: a.label, agent: t.agent }) });
    if (errBuf.trim() && (code !== 0 || !gotResult) && t.status !== 'stopping') pushEvent(t, { k: 'stderr', text: clip(errBuf.trim(), 4000) });
    if (t.status === 'stopping') updateTask(t, { status: 'stopped', tokens: t.tokens, context: t.context || 0 });
    else if (!gotResult) updateTask(t, { status: code === 0 ? 'done' : 'error', exitCode: code, tokens: t.tokens, context: t.context || 0 });
    if (!gotResult) scanSessions();
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
  const user = Object.assign(
    {},
    skillDir(path.join(AGY_DIR, 'builtin', 'skills'), 'user'),
    skillDir(path.join(CODEX_DIR, 'skills'), 'user'),
    skillDir(path.join(AGENTS_DIR, 'skills'), 'user'),
    skillDir(path.join(GEMINI_DIR, 'config', 'skills'), 'user'),
    skillDir(path.join(CLAUDE_DIR, 'skills'), 'user'),
  );
  const proj = project ? Object.assign(
    {},
    skillDir(path.join(project, '.codex', 'skills'), 'project'),
    skillDir(path.join(project, '.gemini', 'skills'), 'project'),
    skillDir(path.join(project, '.agent', 'skills'), 'project'),
    skillDir(path.join(project, '.agents', 'skills'), 'project'),
    skillDir(path.join(project, '.claude', 'skills'), 'project'),
  ) : {};
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
    agent: AGENTS[body.agent] ? body.agent : defaultAgentKey(),
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
  const defAg = AGENTS[defaultAgentKey()];
  const defBin = (defAg && defAg.bin) || 'claude';
  const cmd = cmdOverride || (attachId ? `claude attach ${attachId}` : sessionId ? (defAg && defAg.resumeCmd ? defAg.resumeCmd({ sessionId }) : `claude --resume ${sessionId}`) : defBin);
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
function fsMove(root, b) {
  const src = fsResolve(root, b.from, true);
  if (!src.rel) throw keyedError('server.fs.outsideProject');
  const toDir = String(b.toDir || '').replace(/^\/+|\/+$/g, '');
  const dstRel = toDir ? toDir + '/' + path.basename(src.rel) : path.basename(src.rel);
  const dst = fsResolve(root, dstRel, false);
  if (src.real === dst.real) return { from: src.rel, path: dst.rel };
  if (dst.real.startsWith(src.real + path.sep)) throw keyedError('server.fs.moveIntoSelf');
  if (exists(dst.real)) throw keyedError('server.fs.alreadyExists', null, { code: 409 });
  fs.mkdirSync(path.dirname(dst.real), { recursive: true });
  fs.renameSync(src.real, dst.real);
  return { from: src.rel, path: dst.rel };
}
function fsUpload(req, root, dir, name) {
  return new Promise((resolve, reject) => {
    const safe = path.basename(String(name || 'file')).replace(/[\0/\\]/g, '_').slice(-180) || 'file';
    const cleanDir = String(dir || '').replace(/^\/+|\/+$/g, '');
    const relTarget = cleanDir ? cleanDir + '/' + safe : safe;
    let resolved;
    try { resolved = fsResolve(root, relTarget, false); } catch (e) { return reject(e); }
    const { real, rel } = resolved;
    try { fs.mkdirSync(path.dirname(real), { recursive: true }); } catch (e) { return reject(e); }
    const tmp = real + '.hub-tmp-' + process.pid + '-' + crypto.randomBytes(2).toString('hex');
    const out = fs.createWriteStream(tmp);
    let size = 0;
    req.on('data', d => {
      size += d.length;
      if (size > MAX_UPLOAD) { req.destroy(); out.destroy(); fs.rm(tmp, () => {}); reject(keyedError('server.upload.tooLarge')); }
    });
    req.pipe(out);
    out.on('finish', () => {
      try {
        fs.renameSync(tmp, real);
        const st = fs.statSync(real);
        resolve({ path: rel, name: safe, size: st.size, mtime: st.mtimeMs });
      } catch (e) { fs.rm(tmp, () => {}); reject(e); }
    });
    out.on('error', e => { fs.rm(tmp, () => {}); reject(e); });
  });
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
      const hasAgentCfg = dir => ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md'].some(f => exists(path.join(dir, f))) || ['.claude', '.agents', '.agent', '.gemini', '.codex'].some(d => isDir(path.join(dir, d)));
      const dirs = listDir(want)
        .filter(d => (d.isDirectory() || (d.isSymbolicLink() && isDir(path.join(want, d.name)))) && (showDot || !d.name.startsWith('.')) && d.name !== 'node_modules')
        .map(d => {
          const full = path.join(want, d.name);
          return { name: d.name, path: full, git: exists(path.join(full, '.git')), claude: hasAgentCfg(full),
            inHub: inHub.has(full), hidden: hidden.has(full) };
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      return send(res, 200, { dir: want, display: tilde(want), parent: want === path.dirname(want) ? null : path.dirname(want), home: HOME,
        self: { git: exists(path.join(want, '.git')), claude: hasAgentCfg(want), inHub: inHub.has(want), hidden: hidden.has(want) },
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
    const im = p.match(/^\/api\/sessions\/([\w-]+)\/image\/([\w-]+)\/(\d+)$/);
    if (im) {
      const s = findSession(im[1]);
      const img = s && exists(s.file) ? await sessionImage(s, im[2], Number(im[3])) : null;
      if (!img || !/^image\/(png|jpeg|gif|webp)$/.test(img.mime)) return fail(404, 'server.session.notFound');
      res.writeHead(200, { 'Content-Type': img.mime, 'Cache-Control': 'private, max-age=31536000, immutable' });
      return res.end(img.data);
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
        const t = newTask(s.cwd, { title: sessTitle(s, undefined, lang), agent: s.agent || defaultAgentKey(), resumeSessionId: s.id, fork: !!b.fork, permissionMode: b.permissionMode || 'auto' }, lang);
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
      if (action === 'config' && req.method === 'POST') {
        const b = await body(req);
        const patch = {};
        for (const k of ['permissionMode', 'model', 'effort']) if (k in b) patch[k] = b[k] || null;
        updateTask(t, patch);
        return send(res, 200, publicTask(t));
      }
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
      const cfg = isDir(proj) ? projectConfig(proj) : projectConfig(HOME);
      const discovered = uniq([...(slashByProject[proj] || slashByProject[''] || []), ...(cfg.commands.project || []), ...(cfg.commands.user || []), ...(cfg.skills.project || []), ...(cfg.skills.user || [])]);
      return send(res, 200, { commands: discovered, exact: !!(slashByProject[proj] || isDir(proj)) });
    }
    // images an agent shows by absolute path (screenshots in ~/.claude/jobs/…/tmp, /tmp …): image files only, under $HOME or /tmp
    if (p === '/api/localimg') {
      let real;
      try { real = fs.realpathSync(path.resolve(expandHome(String(url.searchParams.get('path') || '')))); } catch { return fail(404, 'server.fs.notFound'); }
      const type = MIME[path.extname(real).toLowerCase()];
      if (!type || !/^image\//.test(type)) return fail(415, 'server.fs.imagesOnly');
      if (![HOME, os.tmpdir()].some(r => real.startsWith(fs.realpathSync(r) + path.sep)) || !fs.statSync(real).isFile()) return fail(403, 'server.fs.outsideProject');
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
      return fs.createReadStream(real).pipe(res);
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
        if (p === '/api/fs/move' && req.method === 'POST') { const b = await body(req); return send(res, 200, fsMove(b.root, b)); }
        if (p === '/api/fs/upload' && req.method === 'POST') {
          return send(res, 200, await fsUpload(req, root, url.searchParams.get('dir') || '', url.searchParams.get('name')));
        }
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
      const s = b.sessionId ? findSession(b.sessionId) : null;
      const ag = AGENTS[(s && s.agent) || b.agent || defaultAgentKey()];
      const cmd = !b.attachId && b.sessionId && ag && ag.resumeCmd ? ag.resumeCmd({ sessionId: b.sessionId }) : null;
      openTerminal(b.path, b.sessionId || null, b.attachId || null, cmd);
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
    if (mtime && Date.now() - mtime < 120000) { skip(id, 'server.cleanup.recentlyActive'); continue; }
    if (s.agent === 'agy') {
      const brainDir = path.join(AGY_DIR, 'brain', id);
      const size = isDir(brainDir) ? dirSize(brainDir) : 0;
      if (isDir(brainDir) && !(await moveToTrash(brainDir))) { skip(id, 'server.cleanup.trashFailed'); continue; }
      delete scanCache[s.file];
      for (const t of linked) { deleteTask(t); out.chats++; }
      out.deleted++;
      out.freed += size;
      continue;
    }
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
  console.log(`   Agent configs: .claude · .gemini · .agents · .codex · up to ${MAX_PARALLEL} tasks in parallel`);
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
