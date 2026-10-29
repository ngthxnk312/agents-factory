'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// i18n: every UI label comes from public/i18n/<lang>/app.json. `t` is often a task variable in this file, hence `tr`.
const tr = (key, params) => i18n.t(key, params);
// count-aware label: uses "<key>.one" when n === 1 (e.g. English singular)
const trn = (key, n, params) => tr(n === 1 && i18n.has(key + '.one') ? key + '.one' : key, { n, ...params });
// server text with an optional translation key (see i18n.tx)
const lastTextOf = t => i18n.tx({ text: t.lastText, textKey: t.lastTextKey, params: t.lastTextParams });
const noteOf = t => i18n.tx({ text: t.note, textKey: t.noteKey, params: t.noteParams });

const state = {
  overview: null,
  tasks: new Map(),
  project: '',            // '' = all
  tab: 'dashboard',
  plugins: null,
  configCache: new Map(),
  openTask: null,         // id of the task whose chat is open
  toolNodes: new Map(),   // tool_use id -> <details>
  pickProjects: new Set(),
  pickPlugins: new Set(),
  att: { compose: [], chat: [] },
  live: '',               // text Claude is currently typing (stream)
  liveUsage: {},          // id -> {context, out}
  sessions: null,
  sessionQuery: '',
  sessPick: new Set(),
  sessGroup: localStorage.getItem('hub-sess-group') === '1',
  sessFolded: new Set(),
  usage: null,
  usageMetric: 'out',
  usageDays: localStorage.getItem('hub-usage-days') || '30',
  usageView: localStorage.getItem('hub-usage-view') || 'machine', // default: follow the system
  dragPath: null,
  lastPrompts: [],
};

const STATUS = {
  idle: { label: tr('app.status.idle'), tag: '', icon: '💬' },
  queued: { label: tr('app.status.queued'), tag: 'warn', icon: '⏳' },
  running: { label: tr('app.status.running'), tag: 'ok', icon: '⚡' },
  stopping: { label: tr('app.status.stopping'), tag: 'warn', icon: '⏸' },
  done: { label: tr('app.status.done'), tag: 'mcp', icon: '✅' },
  error: { label: tr('app.status.error'), tag: 'err', icon: '⚠️' },
  stopped: { label: tr('app.status.stopped'), tag: 'err', icon: '⏹' },
};
const FAMILIES = [
  { key: 'Opus', color: 'var(--s-opus)' },
  { key: 'Sonnet', color: 'var(--s-sonnet)' },
  { key: 'Haiku', color: 'var(--s-haiku)' },
  { key: 'Fable', color: 'var(--s-fable)' },
  { key: 'Gemini', color: 'var(--s-gemini)' },
  { key: 'Codex', color: 'var(--s-codex)' },
  { key: 'Other', label: tr('app.usage.familyOther'), color: 'var(--s-other)' }, // key = family name sent by the server
];
const isActive = t => ['queued', 'running', 'stopping'].includes(t.status);

async function api(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', 'X-Lang': i18n.lang }, body: opts.body && JSON.stringify(opts.body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
const toast = (msg, type, opts) => ui.toast(msg, type, opts);
const ago = ts => {
  if (!ts) return '';
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return tr('app.time.justNow');
  if (s < 3600) return trn('app.time.minAgo', Math.floor(s / 60));
  if (s < 86400) return trn('app.time.hourAgo', Math.floor(s / 3600));
  if (s < 7 * 86400) return trn('app.time.dayAgo', Math.floor(s / 86400));
  return new Date(ts).toLocaleDateString(i18n.locale);
};
const money = v => (v ? `$${v.toFixed(v < 1 ? 3 : 2)}` : '');
const dur = ms => (!ms ? '' : ms < 60000 ? tr('app.time.durS', { s: Math.round(ms / 1000) }) : tr('app.time.durMS', { m: Math.floor(ms / 60000), s: Math.round((ms % 60000) / 1000) }));
const fmtTok = n => {
  n = n || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k';
  return String(n);
};
const fmtSize = b => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B');

// ---------- light / dark theme ----------
function applyTheme(mode) {
  if (mode === 'light' || mode === 'dark') document.documentElement.dataset.theme = mode;
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem('hub-theme', mode); } catch { /* private mode */ }
  $$('#themeSwitch button').forEach(b => b.classList.toggle('on', b.dataset.themeSet === mode));
}
let themeMode = 'auto';
try { themeMode = localStorage.getItem('hub-theme') || 'auto'; } catch { /* ignore */ }
applyTheme(themeMode);

// ---------- minimal markdown ----------
function md(src) {
  const blocks = [];
  let s = String(src || '').replace(/```(\w*)\n?([\s\S]*?)(```|$)/g, (_, lang, code) => { blocks.push(`<pre><code>${esc(code.replace(/\n$/, ''))}</code></pre>`); return `\u0000${blocks.length - 1}\u0000`; });
  // links: reserve placeholders first so bold / italic rules don't break URLs
  const links = [];
  const keep = html => { links.push(html); return `\u0001${links.length - 1}\u0001`; };
  s = esc(s)
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (all, text, url) => linkHtml(url, text, keep) || all)
    .replace(/`([^`\n]+)`/g, (_, c) => keep(linkHtml(c, `<code>${c}</code>`, null, true) || `<code>${c}</code>`))
    .replace(/\bhttps?:\/\/[^\s<>"'`\u0001]+/g, u => { const m = u.match(/[.,;:!?)\]*_]+$/); const url = m ? u.slice(0, -m[0].length) : u; return keep(linkHtml(url, url)) + (m ? m[0] : ''); })
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:]|$)/g, '$1<i>$2</i>');
  const out = [];
  let list = null;
  const flush = () => { if (list) { out.push(`<${list.t}>${list.items.map(i => `<li>${i}</li>`).join('')}</${list.t}>`); list = null; } };
  const lines = s.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if ((m = line.match(/^\s*[-*]\s+(.*)/))) { if (!list || list.t !== 'ul') { flush(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { if (!list || list.t !== 'ol') { flush(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    flush();
    if ((m = line.match(/^(#{1,4})\s+(.*)/))) { out.push(`<h${m[1].length}>${m[2]}</h${m[1].length}>`); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      i--;
      out.push('<table>' + rows.filter(r => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map(r => '<tr>' + r.trim().slice(1, -1).split('|').map(c => `<td>${c.trim()}</td>`).join('') + '</tr>').join('') + '</table>');
      continue;
    }
    if (!line.trim()) continue;
    out.push(`<p>${line}</p>`);
  }
  flush();
  return out.join('\n').replace(/\u0001(\d+)\u0001/g, (_, i) => links[+i]).replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i]);
}
// url is already escaped. Web → open in a new tab; file:// or a file path → open in the File panel.
// codeOnly: text inside `code` — only linkified if it is clearly a URL / file path.
function linkHtml(url, label, keep, codeOnly) {
  const wrap = h => (keep ? keep(h) : h);
  if (/^https?:\/\/[^\s]+$/.test(url)) return wrap(`<a href="${url}" target="_blank" rel="noopener" class="md-link">${label}</a>`);
  let p = url.replace(/^file:\/\//, '');
  try { p = decodeURIComponent(p); } catch { /* keep as is */ }
  const isPath = /^(~?\/|\.{1,2}\/)?[\w@.\-]+(\/[\w@.\-]+)*\.[A-Za-z0-9]{1,8}(:\d+(:\d+)?)?$/.test(p) && (p.includes('/') || /^file:/.test(url));
  if (!isPath || (codeOnly && !p.includes('/'))) return '';
  return wrap(`<a href="#" class="md-link file-link" data-openfile="${p}" title="${tr('app.md.openInFiles')}">${label}</a>`);
}
// clicking a file link in a reply → find the project containing the file, open it in the File panel
async function openFileLink(p) {
  const t = state.tasks.get(state.openTask);
  const line = (p.match(/:(\d+)(?::\d+)?$/) || [])[1];
  let file = p.replace(/:\d+(:\d+)?$/, '').replace(/^~(?=\/)/, state.overview.homePath);
  const roots = [t && t.projectPath, fx.root, ...state.overview.projects.map(x => x.path)].filter(Boolean);
  let root, rel;
  if (file.startsWith('/')) {
    root = roots.filter(r => file === r || file.startsWith(r + '/')).sort((a, b) => b.length - a.length)[0];
    rel = root && file.slice(root.length + 1);
  } else { root = (t && t.projectPath) || fx.root; rel = file.replace(/^\.\//, ''); }
  if (!root) {
    try { await navigator.clipboard.writeText(file); } catch { /* ignore */ }
    return toast(tr('app.fileLink.outside', { file }), 'info');
  }
  toggleFiles('on');
  if (fx.root !== root) setRoot(root);
  const segs = rel.split('/');
  for (let i = 1; i < segs.length; i++) { const d = segs.slice(0, i).join('/'); fx.open.add(d); if (!fx.dirs.has(d)) await loadDir(d); }
  await openFile(rel);
  if (line && $('#fxText')) {
    const ta = $('#fxText'), lines = ta.value.split('\n');
    const pos = lines.slice(0, Math.max(0, line - 1)).reduce((n, l) => n + l.length + 1, 0);
    ta.focus(); ta.setSelectionRange(pos, pos + (lines[line - 1] || '').length);
    ta.scrollTop = Math.max(0, (line - 5) * parseFloat(getComputedStyle(ta).lineHeight || 20));
  }
}

// ---------- data loading ----------
function renderCliVersion() {
  const ags = (state.overview.agents || []).filter(a => a.available);
  $('#cliVersion').textContent = `${ags.length ? ags.map(a => a.label).join(' · ') : (state.overview.claudeVersion || 'Claude Code')} · ${trn('app.header.projects', state.overview.projects.length)}`;
  setTip($('#cliVersion'), ags.map(a => `${a.label}: ${a.version || ''}`).join('\n') || state.overview.claudeVersion || '');
}
async function loadOverview() {
  state.overview = await api('/api/overview');
  renderCliVersion();
  if (activeWs && !curWs()) activeWs = '';
  state.rateLimit = state.overview.rateLimit;
  renderRl();
  renderWsBtn();
  renderSidebar();
}
async function loadTasks() {
  const list = await api('/api/tasks');
  state.tasks = new Map(list.map(t => [t.id, t]));
  fixOldCosts();
}
// Older servers summed cost incorrectly (total_cost_usd is cumulative per session) → recompute from the turns in chat history
const costFix = new Map(); // id → { base, last }
function costFrom(events) {
  let base = 0, last = 0;
  for (const e of events) if (e.k === 'result' && e.costTotal === undefined) { const c = e.cost || 0; if (c < last) base += last; last = c; }
  return { base, last };
}
async function fixOldCosts() {
  const todo = [...state.tasks.values()].filter(t => !t.costFixed && t.costUsd && !costFix.has(t.id));
  await Promise.all(todo.map(t => api('/api/tasks/' + t.id).then(full => { costFix.set(t.id, costFrom(full.events || [])); }).catch(() => {})));
  for (const [id, f] of costFix) { const t = state.tasks.get(id); if (t && !t.costFixed) t.costUsd = f.base + f.last; }
  if (todo.length) { renderStats(); if (state.tab === 'board') renderBoard(); }
}
async function projectCfg(p, fresh) {
  if (!fresh && state.configCache.has(p)) return state.configCache.get(p);
  const c = await api('/api/project?path=' + encodeURIComponent(p));
  state.configCache.set(p, c);
  return c;
}
const projName = p => (state.overview && p === state.overview.homePath ? tr('app.project.home') : p.split('/').pop());

// ---------- collapsible layout (project column / chat column) ----------
const layout = Object.assign({ side: 'full', rail: 'full', userCfg: false }, (() => { try { return JSON.parse(localStorage.getItem('hub-layout') || '{}'); } catch { return {}; } })());
const saveLayout = () => { try { localStorage.setItem('hub-layout', JSON.stringify(layout)); } catch { /* ignore */ } };
function setTip(el, text) { if (el) { el.dataset.tip = text; el.setAttribute('aria-label', text); } }
function applyLayout() {
  document.body.dataset.side = layout.side;
  document.body.dataset.rail = layout.rail;
  saveLayout();
  const bs = $('#btnSide'), bd = $('#btnDensity'), br = $('#btnRail');
  if (bs) { bs.innerHTML = fxIconHtml(layout.side === 'mini' ? 'proj-open' : 'proj-close', 'c-sky'); setTip(bs, tr(layout.side === 'mini' ? 'app.layout.sideExpand' : 'app.layout.sideCollapse')); }
  if (bd) { bd.classList.toggle('on', layout.side === 'compact'); setTip(bd, tr(layout.side === 'compact' ? 'app.layout.densityFull' : 'app.layout.densityCompact')); }
  if (br) { br.innerHTML = fxIconHtml(layout.rail === 'mini' ? 'chat-open' : 'chat-close', 'c-violet'); setTip(br, tr(layout.rail === 'mini' ? 'app.layout.railExpand' : 'app.layout.railCollapse')); }
}
// abbreviation badge for the minimized mode
function initials(p) {
  const n = projName(p).replace(/^🏠\s*/, '');
  const parts = n.split(/[-_ .]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : n.slice(0, 2)).toUpperCase();
}
function avatarHue(p) { let h = 0; for (const c of p) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

// ---------- sidebar ----------
function renderSidebar() {
  const o = state.overview;
  if (!o) return;
  const q = $('#projectSearch').value.trim().toLowerCase();
  const running = {};
  for (const t of state.tasks.values()) if (isActive(t)) running[t.projectPath] = (running[t.projectPath] || 0) + 1;
  const scoped = scopedProjects();
  $('#projectList').innerHTML = (scoped.length ? '' : `<div class="empty">${tr('app.sidebar.wsEmpty')}<br><button class="btn sm ghost" data-editws style="margin-top:8px">${tr('app.sidebar.addProject')}</button></div>`) + scoped
    .filter(p => !q || (p.name + p.display).toLowerCase().includes(q))
    .map(p => `
      <button class="proj ${state.project === p.path ? 'active' : ''}" data-path="${esc(p.path)}" title="${esc(projName(p.path) + ' — ' + p.display)}" draggable="${q ? 'false' : 'true'}">
        <span class="proj-av" style="--av:${avatarHue(p.path)}" aria-hidden="true">${esc(initials(p.path))}${running[p.path] ? '<i class="av-run"></i>' : ''}</span>
        <span class="proj-name">${running[p.path] ? '<span class="dot pulse running-dot"></span>' : '📁'} ${esc(projName(p.path))}</span>
        <span class="proj-path">${esc(p.display === '~' ? tr('app.sidebar.homeDir') : p.display.split('/').slice(-3, -1).join('/'))}</span>
        <span class="proj-badges">
          ${p.branch ? `<span class="tag git">⎇ ${esc(p.branch)}</span>` : ''}
          ${p.mcpCount ? `<span class="tag mcp">🔌 ${p.mcpCount}</span>` : ''}
          ${p.pluginCount ? `<span class="tag plugin">🧩 ${p.pluginCount}</span>` : ''}
          ${p.hasClaudeMd ? `<span class="tag md">${esc(p.ruleFile || 'AGENTS.md')}</span>` : ''}
        </span>
        <span class="proj-tools">
          <span class="star ${p.favorite ? 'on' : ''}" data-star="${esc(p.path)}" title="${tr('app.sidebar.star')}">${p.favorite ? '★' : '☆'}</span>
          <span data-hide="${esc(p.path)}" title="${tr('app.sidebar.hide')}">🗑</span>
          <span class="grip" title="${tr('app.sidebar.drag')}">⠿</span>
        </span>
      </button>`).join('');
  $('.proj.all').classList.toggle('active', !state.project);
  const w = curWs();
  $('.proj.all .proj-name').textContent = w ? tr('app.sidebar.allInWs', { icon: w.icon, name: w.name }) : tr('app.ws.allProjects');
  const nTask = scopedTasks().length;
  $('#allCount').textContent = nTask ? trn('app.sidebar.chats', nTask) : '';
  const u = o.user;
  $('#userCfg').innerHTML = `
    ${o.hiddenProjects.length ? `<details><summary>${tr('app.sidebar.hiddenProjects', { n: o.hiddenProjects.length })}</summary>
      ${o.hiddenProjects.map(h => `<div class="hidden-item"><span title="${esc(h.display)}">${esc(h.name)}</span><button class="btn sm ghost" data-restore="${esc(h.path)}">${tr('app.sidebar.restore')}</button></div>`).join('')}
    </details>` : ''}
    <details class="user-cfg" ${layout.userCfg ? 'open' : ''}><summary><b>${tr('app.sidebar.userCfg')}</b> · 🧠 ${esc(u.model || tr('app.common.default'))} · 🔌 ${u.mcp.length} · 🧩 ${u.plugins.filter(p => p.enabled).length}</summary>
      <div class="row">${u.mcp.map(m => `<span class="tag mcp">${esc(m.name)}</span>`).join('') || '—'}</div>
      <div class="row">${u.plugins.filter(p => p.enabled).map(p => `<span class="tag plugin">${esc(p.key.split('@')[0])}</span>`).join('')}</div>
    </details>`;
  const uc = $('#userCfg .user-cfg');
  if (uc) uc.ontoggle = () => { layout.userCfg = uc.open; saveLayout(); };
}

// drag and drop to reorder projects
document.addEventListener('dragstart', e => {
  const el = e.target.closest && e.target.closest('.proj[data-path]:not(.all)');
  if (!el) return;
  state.dragPath = el.dataset.path;
  el.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', state.dragPath);
});
document.addEventListener('dragend', () => {
  state.dragPath = null;
  $$('.proj').forEach(x => x.classList.remove('dragging', 'drop-before', 'drop-after'));
});
$('#projectList').addEventListener('dragover', e => {
  if (!state.dragPath) return;
  const el = e.target.closest('.proj[data-path]');
  if (!el || el.dataset.path === state.dragPath) return;
  e.preventDefault();
  const r = el.getBoundingClientRect();
  const after = e.clientY > r.top + r.height / 2;
  $$('.proj').forEach(x => x.classList.remove('drop-before', 'drop-after'));
  el.classList.add(after ? 'drop-after' : 'drop-before');
});
$('#projectList').addEventListener('drop', async e => {
  if (!state.dragPath) return;
  e.preventDefault();
  const el = e.target.closest('.proj[data-path]');
  if (!el || el.dataset.path === state.dragPath) return;
  const after = el.classList.contains('drop-after');
  const list = state.overview.projects;
  const from = list.findIndex(p => p.path === state.dragPath);
  const [moved] = list.splice(from, 1);
  const to = list.findIndex(p => p.path === el.dataset.path) + (after ? 1 : 0);
  list.splice(to, 0, moved);
  renderSidebar();
  try { await api('/api/projects', { method: 'POST', body: { action: 'order', order: list.map(p => p.path) } }); } catch (err) { toast(err.message, true); }
});

function renderStats() {
  setDocTitle();
  const c = { running: 0, queued: 0, done: 0, error: 0 };
  let cost = 0;
  for (const t of scopedTasks()) {
    if (t.status === 'running' || t.status === 'stopping') c.running++;
    else if (t.status === 'queued') c.queued++;
    else if (t.status === 'done' || t.status === 'idle') c.done++;
    else c.error++;
    cost += t.costUsd || 0;
  }
  $('#stats').innerHTML = `
    ${(() => { const ags = Object.values((typeof bg !== 'undefined' && bg.agents) || {}); const w = ags.filter(x => x.state === 'working' || x.status === 'busy').length; return ags.length ? `<button type="button" class="stat stat-btn c-violet" data-bglist title="${tr('app.stats.bgTip')}">${w ? '<span class="spin"></span>' : '🛰'} <b>${w}/${ags.length}</b> ${tr('app.stats.bg')}</button>` : ''; })()}
    <button type="button" class="stat c-teal stat-btn" data-runlist title="${tr('app.stats.runTip')}"><span class="dot ${c.running ? 'pulse' : ''}"></span><b>${c.running}</b> ${tr('app.stats.running')}</button>
    ${c.queued ? `<span class="stat c-amber">⏳ <b>${c.queued}</b> ${tr('app.stats.queued')}</span>` : ''}
    <span class="stat c-sky">✅ <b>${c.done}</b> ${tr('app.stats.done')}</span>
    ${c.error ? `<span class="stat c-rose">⚠️ <b>${c.error}</b> ${tr('app.stats.failed')}</span>` : ''}
    ${machineCostStat(cost)}`;
}
// 💰 in the header = MACHINE-WIDE cost: every Claude Code session (terminal and Agents Factory), same as Token tab → All
const mcost = { total: null, out: 0, n: 0, at: 0, busy: false };
async function loadMachineCost() {
  if (mcost.busy) return;
  mcost.busy = true;
  try {
    const r = await api('/api/sessions');
    mcost.total = r.sessions.reduce((s, x) => s + (x.cost || 0), 0);
    mcost.out = r.sessions.reduce((s, x) => s + ((x.tokens && x.tokens.out) || 0), 0);
    mcost.n = r.sessions.length; mcost.at = Date.now();
    renderStats();
    if (state.tab === 'dashboard' && !state.openTask) renderDashboard();
  } catch { /* retry next time */ } finally { mcost.busy = false; }
}
function machineCostStat(hubCost) {
  if (mcost.total === null) { loadMachineCost(); return `<span class="stat" data-tab="usage">💰 <b>…</b></span>`; }
  const tip = tr('app.stats.costTip', { n: mcost.n, hub: money(hubCost) || '$0', ago: ago(mcost.at) });
  if (!mcost.total && mcost.out) return `<button type="button" class="stat stat-btn" data-tab="usage" title="${esc(tip)}">🪙 <b>${fmtTok(mcost.out)} tok</b></button>`;
  return `<button type="button" class="stat stat-btn" data-tab="usage" title="${esc(tip)}">💰 <b>${money(mcost.total) || '$0'}</b></button>`;
}
setInterval(loadMachineCost, 60000);

// ---------- views ----------
function render() {
  renderStats();
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
  ({ dashboard: renderDashboard, board: renderBoard, sessions: renderSessions, usage: renderUsage, config: renderConfig, plugins: renderPlugins, mcp: renderMcp })[state.tab]();
}

// ---------- agents (Claude / Antigravity / Codex / Gemini / custom) ----------
const agentDef = k => ((state.overview && state.overview.agents) || []).find(a => a.key === (k || 'claude')) || { key: k || 'claude', label: k === 'claude' || !k ? 'Claude Code' : k, icon: '✦', color: '#d97757', models: [['opus', 'Opus'], ['opus[1m]', 'Opus 1M'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku'], ['fable', 'Fable']], modes: ['', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'] };
const curAgent = () => agentDef((state.tasks.get(state.openTask) || {}).agent);
const agentName = a => (a.key === 'claude' ? 'Claude' : a.label);
// agent badge: Claude is the default, so only shown when always = true
function agentBadge(t, always) {
  const key = typeof t === 'string' ? t : (t && t.agent);
  if (!always && (!key || key === 'claude')) return '';
  const a = agentDef(key);
  return `<span class="tag agent-tag" style="--ac:${esc(a.color)}" title="${esc(tr('app.agent.tip', { label: a.label }))}">${esc(a.icon)} ${esc(a.label)}</span>`;
}
const meLabel = () => { const me = (state.overview && state.overview.me) || { name: tr('app.me.you'), avatar: '🧑‍💻' }; return `${me.avatar ? esc(me.avatar) + ' ' : ''}${esc(me.name)}`; };

function taskCard(t) {
  const st = STATUS[t.status] || STATUS.error;
  return `
    <div class="card s-${t.status}" data-task="${t.id}">
      <div class="card-title">${isUnread(t) ? `<span class="unread" title="${tr('app.task.unread')}"></span>` : ''}${t.historySessionId ? '🕘 ' : ''}${esc(t.title)}</div>
      <div class="card-last">${esc(lastTextOf(t) || noteOf(t))}</div>
      <div class="card-meta">
        <span class="tag ${st.tag}">${t.status === 'running' ? '<span class="dot pulse"></span>' : st.icon} ${st.label}</span>
        ${agentBadge(t)}${skillBadge(t)}
        ${state.project ? '' : `<span class="tag">📁 ${esc(t.projectName)}</span>`}
        ${t.model ? `<span class="tag coral">${esc(t.model)}</span>` : ''}
        ${t.plugins && t.plugins.length ? `<span class="tag plugin">🧩 +${t.plugins.length}</span>` : ''}
        ${t.denials ? `<span class="tag warn" title="${tr('app.task.denials')}">🚫 ${t.denials}</span>` : ''}
        <span class="sp">${t.tokens && t.tokens.out ? tr('app.task.tokens', { n: fmtTok(t.tokens.out) }) + ' · ' : ''}${money(t.costUsd)} ${ago(t.updatedAt || t.createdAt)}</span>
      </div>
    </div>`;
}

function renderBoard() {
  const list = scopedTasks()
    .filter(t => !state.project || t.projectPath === state.project)
    .sort(byRecent);
  const cols = [
    { key: 'running', title: tr('app.board.colRunning'), items: list.filter(isActive), empty: tr('app.board.emptyRunning') },
    { key: 'done', title: tr('app.board.colDone'), items: list.filter(t => t.status === 'done' || t.status === 'idle'), empty: tr('app.board.emptyDone') },
    { key: 'error', title: tr('app.board.colError'), items: list.filter(t => ['error', 'stopped'].includes(t.status)), empty: tr('app.board.emptyError') },
  ];
  const proj = state.project && state.overview.projects.find(p => p.path === state.project);
  $('#view').innerHTML = `
    ${!list.length ? `
      <div class="hero">
        <div style="font-size:40px">🪄</div>
        <div>
          <h1>${proj ? esc(tr('app.board.heroProj', { name: projName(proj.path) })) : tr('app.board.heroAll')}</h1>
          <p>${tr('app.board.heroText')}</p>
        </div>
        <button class="btn primary" data-compose>${tr('app.common.assign')}</button>
      </div>` : ''}
    <div class="board-bar">
      <span class="hint">${curWs() ? esc(trn('app.board.countIn', list.length, { ws: curWs().icon + ' ' + curWs().name })) : trn('app.board.count', list.length)}</span>
      <button class="btn sm ghost" data-quick title="${tr('app.board.quickTip')}">${tr('app.board.quick')} <kbd>Ctrl K</kbd></button>
      <button class="btn sm ghost" data-cleanup>${tr('app.board.cleanup')}</button>
    </div>
    <div class="board">
      ${cols.map(c => `
        <div class="col ${c.key}">
          <div class="col-head">${c.title}<span class="n">${c.items.length}</span></div>
          <div class="cards">${c.items.map(taskCard).join('') || `<div class="empty">${c.empty}</div>`}</div>
        </div>`).join('')}
    </div>`;
}

// ---------- past sessions ----------
async function renderSessions(refreshOnly) {
  if (!refreshOnly || !$('#sessList')) {
    $('#view').innerHTML = `
      <div class="section-title"><h2>${tr('app.sessions.title')}</h2>
        <span class="hint">${tr('app.sessions.hint')}</span></div>
      <div class="toolbar">
        <input class="input" id="sessSearch" placeholder="${tr('app.sessions.search')}" value="${esc(state.sessionQuery)}">
        <span class="hint" id="sessInfo"></span>
        <button type="button" class="btn sm ghost ${state.sessGroup ? 'on' : ''}" id="sessGroupBtn" title="${tr('app.sessions.groupTip')}">${tr('app.sessions.group')}</button>
        <span class="seg sess-quick" aria-label="${tr('app.sessions.quickAria')}">
          <button type="button" data-sesspick="7">${tr('app.sessions.pick7')}</button>
          <button type="button" data-sesspick="30">${tr('app.sessions.pick30')}</button>
          <button type="button" data-sesspick="all">${tr('app.common.selectAll')}</button>
        </span>
      </div>
      <div class="bulk-bar" id="sessBulk" hidden></div>
      <div class="sess-list" id="sessList"><div class="empty">${tr('app.sessions.scanning')}</div></div>`;
    $('#sessSearch').oninput = e => { state.sessionQuery = e.target.value; drawSessions(); };
    $('#sessGroupBtn').onclick = e => {
      state.sessGroup = !state.sessGroup;
      localStorage.setItem('hub-sess-group', state.sessGroup ? '1' : '');
      e.currentTarget.classList.toggle('on', state.sessGroup);
      drawSessions();
    };
    $('#sessList').addEventListener('toggle', e => {
      const p = e.target.dataset && e.target.dataset.group;
      if (p !== undefined) e.target.open ? state.sessFolded.delete(p) : state.sessFolded.add(p);
    }, true);
    $('#sessList').onchange = e => {
      const id = e.target.dataset.spick;
      if (!id) return;
      e.target.checked ? state.sessPick.add(id) : state.sessPick.delete(id);
      drawSessions();
    };
  }
  const data = await api('/api/sessions' + (state.project ? '?project=' + encodeURIComponent(state.project) : ''));
  if (state.tab !== 'sessions') return;
  state.sessions = data;
  drawSessions();
}
const sessLocked = s => s.inHub || s.recentlyActive;
function sessRows() {
  const d = state.sessions;
  const q = state.sessionQuery.trim().toLowerCase();
  return d ? d.sessions.filter(s => inScope(s.cwd) && (!q || `${s.title} ${s.firstPrompt || ''} ${s.project} ${s.id} ${(s.parts || []).map(x => x.id).join(' ')}`.toLowerCase().includes(q))) : [];
}
function drawSessions() {
  const d = state.sessions;
  if (!d || !$('#sessList')) return;
  const rows = sessRows();
  const ids = new Set(d.sessions.map(s => s.id));
  for (const id of state.sessPick) if (!ids.has(id)) state.sessPick.delete(id);
  $('#sessInfo').textContent = trn('app.sessions.count', rows.length) + (d.scanning ? tr('app.sessions.scanningMore') : d.scannedAt ? tr('app.sessions.scannedAt', { time: new Date(d.scannedAt).toLocaleTimeString(i18n.locale) }) : '');
  const picked = d.sessions.filter(s => state.sessPick.has(s.id));
  const bulk = $('#sessBulk');
  bulk.hidden = !picked.length;
  bulk.innerHTML = picked.length ? `<b>${trn('app.sessions.picked', picked.length)}</b><span class="hint">${fmtSize(picked.reduce((a, s) => a + (s.size || 0), 0))} · ${tr('app.sessions.output', { n: fmtTok(picked.reduce((a, s) => a + s.tokens.out, 0)) })}</span>
    <button class="btn sm ghost" data-sessclear>${tr('app.common.deselect')}</button><button class="btn sm danger-solid" data-sessdel>${trn('app.sessions.deleteN', picked.length)}</button>` : '';
  const grouped = state.sessGroup && !state.project;
  let html;
  if (grouped) {
    const groups = new Map();
    for (const s of rows) { if (!groups.has(s.cwd)) groups.set(s.cwd, []); groups.get(s.cwd).push(s); }
    html = [...groups].map(([cwd, list]) => `
      <details class="sess-group" data-group="${esc(cwd)}" ${state.sessFolded.has(cwd) ? '' : 'open'}>
        <summary><span class="sg-name">📁 ${esc(projName(cwd))}</span><span class="hint">${esc(list[0].projectDisplay)}</span>
          <span class="n">${trn('app.sessions.count', list.length)}</span><span class="hint">${ago(list[0].lastAt)}</span>
          <button type="button" class="btn sm ghost" data-sessproj="${esc(cwd)}" title="${tr('app.sessions.onlyProjTip')}">${tr('app.sessions.onlyProj')}</button></summary>
        ${list.map(sessRow).join('')}
      </details>`).join('');
  } else html = rows.map(sessRow).join('');
  $('#sessList').innerHTML = html || `<div class="empty"><span class="big">🫙</span>${tr('app.sessions.empty')}</div>`;
}
function sessRow(s) {
    const lock = sessLocked(s);
    return `
    <div class="sess ${state.sessPick.has(s.id) ? 'picked' : ''}" data-sid="${s.id}">
      <input type="checkbox" class="sess-check" data-spick="${s.id}" ${state.sessPick.has(s.id) ? 'checked' : ''} ${lock ? 'disabled' : ''}
        aria-label="${esc(tr('app.sessions.pickAria', { title: s.title }))}" ${lock ? `title="${tr(s.inHub ? 'app.sessions.lockHub' : 'app.sessions.lockRecent')}"` : ''}>
      <div class="sess-main">
        <div class="sess-title"><span title="${esc(s.firstPrompt || '')}">${esc(s.title)}</span>
          <button class="icon-btn xs" data-sessren="${s.id}" title="${tr('app.sessions.rename')}">✏️</button>
          <span class="sess-id" title="${tr('app.sessions.id')}">${(s.originId || s.id).slice(0, 8)}</span></div>
        <div class="sess-sub">
          ${agentBadge(s)}
          ${state.project || state.sessGroup ? '' : `<button class="tag git tag-btn" data-sessproj="${esc(s.cwd)}" title="${esc(tr('app.sessions.projTip', { path: s.projectDisplay }))}">📁 ${esc(projName(s.cwd))}</button>`}
          <span>${ago(s.lastAt)}</span> · <span>${trn('app.sessions.prompts', s.prompts)}</span>
          ${s.tokens.out ? `· <span title="${tr('app.sessions.outTip')}">${tr('app.sessions.output', { n: fmtTok(s.tokens.out) })}</span>` : ''}
          ${s.cost ? `· <span>${money(s.cost)}</span>` : ''}
          · <span>${fmtSize(s.size || 0)}</span>
          ${Object.keys(s.models || {}).map(m => `<span class="tag">${esc(m)}</span>`).join('')}
          ${s.recentlyActive && !s.inHub ? `<span class="tag warn" title="${tr('app.sessions.recentTip')}">${tr('app.sessions.recent')}</span>` : ''}
          ${s.hubTask ? `<span class="tag coral">${tr('app.common.inHub')}</span>` : ''}
          ${s.parts ? `<span class="tag" title="${esc(tr('app.sessions.clearedTip', { id: s.id.slice(0, 8) }) + '\n' + s.parts.map(x => `${x.id.slice(0, 8)} · ${ago(x.lastAt)} · ${trn('app.sessions.prompts', x.prompts)}`).join('\n'))}">🧹 ${tr('app.sessions.cleared', { n: s.parts.length - 1 })}</span>` : ''}
          ${s.bg ? `<span class="tag warn" title="${esc(tr('app.sessions.bgTip', { id: s.bg.id + (s.bg.name ? ' · ' + s.bg.name : '') }))}">${tr('app.sessions.bgTag')} · ${esc(s.bg.state || '')}</span>` : ''}
        </div>
      </div>
      <div class="sess-actions">
        <button class="btn sm primary" data-opensess="${s.id}">${tr('app.sessions.open')}</button>
        <a class="btn sm ghost" href="#session=${s.id}" target="_blank" rel="noopener" title="${tr('app.sessions.newTab')}">↗</a>
        <button class="btn sm ghost" data-forksess="${s.id}" title="${tr('app.sessions.forkTip')}">${tr('app.common.fork')}</button>
        <button class="btn sm ghost" data-termsess="${s.id}" data-cwd="${esc(s.cwd)}" title="${tr('app.sessions.termTip')}">🖥</button>
        <button class="btn sm ghost danger-ghost" data-sessdel1="${s.id}" ${lock ? 'disabled' : ''} title="${tr(lock ? 'app.sessions.delLocked' : 'app.sessions.delTip')}">🗑</button>
      </div>
    </div>`;
}
// Empty name = restore the original name (only for renamed sessions)
async function askName(cur, title, canReset) {
  const v = await ui.prompt({ title, icon: '✏️', okText: tr('app.rename.save'),
    input: { value: cur, allowEmpty: !!canReset, placeholder: tr('app.rename.placeholder'), hint: tr(canReset ? 'app.rename.hintReset' : 'app.rename.hint') } });
  if (v === null || v === undefined || v === false) return null;
  const n = String(v).trim();
  return n || (canReset ? '' : null);
}
function quickPickSessions(mode) {
  const rows = sessRows().filter(s => !sessLocked(s));
  const cut = mode === 'all' ? Infinity : Date.now() - Number(mode) * 86400000;
  const hits = rows.filter(s => mode === 'all' || (s.lastAt || 0) < cut);
  if (!hits.length) return toast(mode === 'all' ? tr('app.sessions.noneDeletable') : tr('app.sessions.noneOlder', { n: mode }), 'info');
  hits.forEach(s => state.sessPick.add(s.id));
  drawSessions();
}
async function deleteSessionsUI(ids) {
  const list = state.sessions.sessions.filter(s => ids.includes(s.id));
  if (!list.length) return;
  const size = list.reduce((a, s) => a + (s.size || 0), 0);
  const chats = list.filter(s => s.hubTask).length;
  const ok = await ui.confirm({
    title: list.length === 1 ? tr('app.sessions.delOneTitle', { title: list[0].title.slice(0, 60) }) : tr('app.sessions.delManyTitle', { n: list.length }),
    danger: true, icon: '🗑', okText: list.length === 1 ? tr('app.sessions.delOne') : tr('app.sessions.delMany', { n: list.length }),
    message: tr('app.sessions.delMsg', { size: fmtSize(size) }) +
      (chats ? ' ' + trn('app.sessions.delMsgChats', chats) : ''),
  });
  if (!ok) return;
  try {
    const r = await api('/api/sessions/delete', { method: 'POST', body: { ids } });
    ids.forEach(id => state.sessPick.delete(id));
    toast(tr('app.sessions.deleted', { n: r.deleted, size: fmtSize(r.freed) }) + (r.chats ? tr('app.sessions.deletedChats', { n: r.chats }) : ''), 'ok');
    if (r.skipped.length) toast(tr('app.sessions.skipped', { n: r.skipped.length, reasons: [...new Set(r.skipped.map(x => x.reason))].join('; ') }), 'error');
    await loadTasks();
    renderSessions(true); renderStats(); renderSidebar();
  } catch (err) { toast(err.message, true); }
}

// ---------- permission modes: labels + colors matching the Claude Code terminal ----------
const PERM_MODES = {
  default: [tr('app.perm.default'), 'm-default'],
  '': [tr('app.perm.default'), 'm-default'],
  auto: [tr('app.perm.auto'), 'm-auto'],
  acceptEdits: [tr('app.perm.acceptEdits'), 'm-accept'],
  plan: [tr('app.perm.plan'), 'm-plan'],
  bypassPermissions: [tr('app.perm.bypass'), 'm-bypass'],
  dontAsk: [tr('app.perm.dontAsk'), 'm-bypass'],
};
const permInfo = m => PERM_MODES[m || ''] || [String(m), 'm-default'];
const modeChip = m => { const [l, c] = permInfo(m); return `<span class="mode-chip ${c}" title="${esc(tr('app.perm.chipTip', { mode: m || tr('app.perm.projectDefault') }))}">${esc(l)}</span>`; };

// Shift+Tab in the chat input: default → accept edits → plan → auto → default (like the Claude Code terminal; bypass is manual only)
const PERM_CYCLE = ['', 'acceptEdits', 'plan', 'auto'];
function cyclePermMode() {
  const sel = $('#chatPerm');
  if (!sel) return;
  const i = PERM_CYCLE.indexOf(sel.value);
  sel.value = PERM_CYCLE[(i + 1) % PERM_CYCLE.length];
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}
// changing the model or permission mode in the bottom bar → save immediately to task state & server
document.addEventListener('change', async e => {
  const id = e.target && e.target.id;
  if (id !== 'chatPerm' && id !== 'chatModel') return;
  const t = state.tasks.get(state.openTask);
  if (!t) return;
  if (id === 'chatPerm') {
    const perm = e.target.value;
    if (perm === 'bypassPermissions' && !(await confirmBypass())) {
      e.target.value = t.permissionMode || '';
      if (e.target._sync) e.target._sync();
      return;
    }
    t.permissionMode = perm || null;
    t._cfgAt = Date.now();
    if (state.chatCache && state.chatCache.id === t.id) state.chatCache.t.permissionMode = t.permissionMode;
    const chip = $('.chat-head .mode-chip');
    if (chip) { chip.outerHTML = modeChip(perm); const c2 = $('.chat-head .mode-chip'); if (c2) { c2.title = tr('app.perm.nextMsg'); c2.classList.add('flash'); } }
    api(`/api/tasks/${t.id}/config`, { method: 'POST', body: { permissionMode: t.permissionMode } }).catch(err => toast(err.message, true));
  } else if (id === 'chatModel') {
    t.model = e.target.value || null;
    t._cfgAt = Date.now();
    if (state.chatCache && state.chatCache.id === t.id) state.chatCache.t.model = t.model;
    scheduleRender();
    api(`/api/tasks/${t.id}/config`, { method: 'POST', body: { model: t.model } }).catch(err => toast(err.message, true));
  }
});

// ---------- compact usage limits (header + chat) ----------
const RL_WINDOWS = [['five_hour', tr('app.rl.short5h'), tr('app.rl.fiveHour')], ['seven_day', tr('app.rl.short7d'), tr('app.rl.weekly')]];
function rlInfo(key) {
  const w = state.rateLimit && state.rateLimit.unifiedWindows && state.rateLimit.unifiedWindows[key];
  if (!w) return null;
  const reset = (w.resetsAt || 0) * 1000;
  const expired = reset && reset < Date.now(); // past the reset time -> old numbers are no longer valid
  const pct = expired ? 0 : Math.round((w.utilization || 0) * 100);
  return { pct, reset, expired };
}
function untilText(ts) {
  const m = Math.max(0, Math.round((ts - Date.now()) / 60000));
  if (m < 60) return tr('app.time.untilMin', { m });
  if (m < 1440) return tr('app.time.untilHour', { h: Math.floor(m / 60), mm: String(m % 60).padStart(2, '0') });
  return tr('app.time.untilDay', { d: Math.floor(m / 1440), h: Math.floor((m % 1440) / 60) });
}
// short form for the widget: 35m · 2h10 · 4d12h
function agoEn(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  return s < 60 ? tr('app.time.agoEn.now') : s < 3600 ? tr('app.time.agoEn.min', { n: Math.floor(s / 60) }) : s < 86400 ? tr('app.time.agoEn.hour', { n: Math.floor(s / 3600) }) : tr('app.time.agoEn.day', { n: Math.floor(s / 86400) });
}
function untilShort(ts) {
  const m = Math.max(0, Math.round((ts - Date.now()) / 60000));
  if (m < 60) return tr('app.time.short.min', { m });
  if (m < 1440) return tr('app.time.short.hour', { h: Math.floor(m / 60), mm: String(m % 60).padStart(2, '0') });
  return tr('app.time.short.day', { d: Math.floor(m / 1440), h: Math.floor((m % 1440) / 60) });
}
function rlTip() {
  if (!state.rateLimit) return tr('app.rl.tipNoData', { account: (state.overview && state.overview.account && state.overview.account.email) || tr('app.rl.thisAccount') });
  const lines = RL_WINDOWS.map(([k, , label]) => {
    const r = rlInfo(k);
    if (!r) return tr('app.rl.tipNone', { label });
    if (r.expired) return tr('app.rl.tipReset', { label });
    return tr('app.rl.tipUsed', { label, pct: r.pct, until: untilShort(r.reset), at: new Date(r.reset).toLocaleString(i18n.locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) });
  });
  const ac = state.overview && state.overview.account;
  if (ac) lines.unshift(tr('app.rl.tipAccount', { email: ac.email, org: ac.org ? ' (' + ac.org + ')' : '' }));
  lines.push(tr('app.rl.tipUpdated', { ago: agoEn(state.rateLimit.at) }));
  return lines.join('\n');
}
// cls: 'hd' for the header, 'sl' for the chat status bar
function rlMini(cls) {
  if (!state.rateLimit) return cls === 'hd' ? `<span class="rl"><span class="rl-l">${tr('app.rl.limits')}</span><b>—</b></span>` : '';
  return `<span class="rl-group ${cls}" ${cls === 'sl' ? `data-tab="usage" title="${esc(rlTip())}" role="button" tabindex="0"` : ''}>` + RL_WINDOWS.map(([k, short]) => {
    const r = rlInfo(k);
    if (!r) return '';
    return `<span class="rl ${meterCls(r.pct)}"><span class="rl-l">${short}</span><span class="meter mini ${meterCls(r.pct)}"><i style="width:${Math.max(2, Math.min(100, r.pct))}%"></i></span><b>${r.expired ? '↺' : r.pct + '%'}</b>${!r.expired && r.reset ? `<small class="rl-reset">↺${untilShort(r.reset)}</small>` : ''}</span>`;
  }).join('') + '</span>';
}
function renderRl() {
  const box = $('#rlBox');
  if (!box) return;
  box.innerHTML = rlMini('hd');
  box.dataset.tip = rlTip();
  const worst = Math.max(0, ...RL_WINDOWS.map(([k]) => (rlInfo(k) || { pct: 0 }).pct));
  box.className = 'rl-box ' + meterCls(worst);
}
setInterval(renderRl, 60000);

// ---------- tokens ----------
function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
function metricOf(u, metric) { return metric === 'out' ? u.out : metric === 'in' ? u.in + u.cw : u.cr; }

function stackedChart(days, metric) {
  const present = FAMILIES.filter(f => days.some(d => d.models[f.key] && metricOf(d.models[f.key], metric) > 0));
  const totals = days.map(d => present.reduce((a, f) => a + (d.models[f.key] ? metricOf(d.models[f.key], metric) : 0), 0));
  const max = niceMax(Math.max(...totals));
  const W = 960, H = 260, L = 52, B = 26, T = 8, R = 6;
  const ph = H - B - T, slot = (W - L - R) / days.length, bw = Math.min(26, slot * 0.64);
  const y = v => T + ph - (v / max) * ph;
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i, yy = y(v);
    g += `<line class="gridline" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="axis" x="${L - 8}" y="${yy + 4}" text-anchor="end">${fmtTok(v)}</text>`;
  }
  let bars = '', hits = '', labels = '';
  const step = Math.max(1, Math.ceil(days.length / 12)); // ~12 day labels whether viewing 7 or 365 days
  days.forEach((d, i) => {
    const x = L + slot * i + (slot - bw) / 2;
    let acc = 0;
    const segs = present.map(f => ({ f, v: d.models[f.key] ? metricOf(d.models[f.key], metric) : 0 })).filter(s => s.v > 0);
    segs.forEach((s, j) => {
      const y0 = y(acc), y1 = y(acc + s.v);
      acc += s.v;
      let h = y0 - y1 - (j < segs.length - 1 ? 2 : 0); // 2px gap between segments
      if (h < 1) h = 1;
      const top = y1;
      if (j === segs.length - 1) {
        const r = Math.min(4, h, bw / 2);
        bars += `<path d="M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${top + h} Z" fill="${s.f.color}"/>`;
      } else bars += `<rect x="${x}" y="${top + (j < segs.length - 1 ? 0 : 0)}" width="${bw}" height="${h}" fill="${s.f.color}"/>`;
    });
    hits += `<rect class="hit" data-i="${i}" x="${L + slot * i}" y="${T}" width="${slot}" height="${ph}" rx="6"/>`;
    if (i % step === (days.length - 1) % step) {
      const [, mo, da] = d.day.split('-');
      labels += `<text class="axis" x="${L + slot * i + slot / 2}" y="${H - 6}" text-anchor="middle">${da}/${mo}</text>`;
    }
  });
  return {
    present,
    svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr('app.usage.chartAria')}">${g}${hits}${bars}<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" stroke="var(--line)"/>${labels}</svg>`,
  };
}

function meterCls(p) { return p >= 90 ? 'crit' : p >= 70 ? 'warn' : ''; }
function rateTile(label, w) {
  if (!w) return `<div class="kpi"><div class="lbl">${label}</div><div class="val">—</div><div class="sub">${tr('app.usage.rlNoData')}</div></div>`;
  const reset = (w.resetsAt || 0) * 1000, expired = reset && reset < Date.now();
  if (expired) return `<div class="kpi"><div class="lbl">${label}</div><div class="val">↺</div><div class="sub">${tr('app.usage.rlResetAt', { at: new Date(reset).toLocaleString(i18n.locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) })}</div></div>`;
  const pct = Math.round((w.utilization || 0) * 100);
  return `<div class="kpi"><div class="lbl">${label}</div><div class="val">${pct}%</div>
    <div class="meter ${meterCls(pct)}"><i style="width:${Math.min(100, pct)}%"></i></div>
    <div class="sub">${pct >= 90 ? tr('app.usage.rlCrit') : pct >= 70 ? tr('app.usage.rlWarn') : ''}${reset ? tr('app.usage.rlResetIn', { until: `<b>${untilText(reset)}</b>`, at: new Date(reset).toLocaleString(i18n.locale, { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }) : ''}</div></div>`;
}

async function renderUsage(refreshOnly) {
  if (!refreshOnly) $('#view').innerHTML = `<div class="empty">${tr('app.usage.loading')}</div>`;
  const u = await api('/api/usage?days=' + state.usageDays);
  if (state.tab !== 'usage') return;
  state.usage = u;
  const days = u.days;
  const sum = (arr, f) => arr.reduce((a, d) => a + Object.values(d.models).reduce((b, m) => b + f(m), 0), 0);
  const today = days.slice(-1);
  const rangeLbl = state.usageDays === 'all' ? tr('app.usage.rangeAll', { n: u.rangeDays }) : trn('app.common.days', u.rangeDays);
  const rl = u.rateLimit && u.rateLimit.unifiedWindows || {};
  const ch = stackedChart(days, state.usageMetric);
  const running = [...state.tasks.values()].filter(t => t.status === 'running');
  u.projects = u.projects.filter(p => inScope(p.path));
  u.topSessions = u.topSessions.filter(s => inScope(s.cwd));
  const projMax = Math.max(1, ...u.projects.map(p => p.out));
  $('#view').innerHTML = `
    <div class="section-title"><h2>${tr('app.usage.title')}</h2>
      <span class="hint" title="${tr('app.usage.hintTip')}">${tr('app.usage.hint')}${u.scannedAt ? tr('app.usage.updated', { ago: ago(u.scannedAt) }) : ''}${u.scanning ? tr('app.usage.scanning') : ''}</span>
      <span class="seg" style="margin-left:auto" aria-label="${tr('app.usage.viewAria')}">${[['machine', tr('app.usage.byMachine')], ['account', tr('app.usage.byAccount')]].map(([v, l]) => `<button data-uview="${v}" class="${state.usageView === v ? 'on' : ''}">${l}</button>`).join('')}</span>
      <span class="seg" aria-label="${tr('app.usage.rangeAria')}">${[['7', trn('app.common.days', 7)], ['30', trn('app.common.days', 30)], ['90', trn('app.common.days', 90)], ['all', tr('app.common.all')]].map(([v, l]) => `<button data-udays="${v}" class="${state.usageDays === v ? 'on' : ''}">${l}</button>`).join('')}</span></div>
    <div class="kpis">
      ${rateTile(tr('app.usage.rl5h'), rl.five_hour)}
      ${rateTile(tr('app.usage.rl7d'), rl.seven_day)}
      ${Object.keys(rl).filter(k => k !== 'five_hour' && k !== 'seven_day').map(k => rateTile(tr('app.usage.rlOther', { name: k.replace(/_/g, ' ') }), rl[k])).join('')}
      <div class="kpi"><div class="lbl">${tr('app.usage.outToday')}</div><div class="val">${fmtTok(sum(today, m => m.out))}</div><div class="sub">${tr('app.usage.outTodaySub')}</div></div>
      <div class="kpi"><div class="lbl">${tr('app.usage.outRange', { range: rangeLbl })}</div><div class="val">${fmtTok(sum(days, m => m.out))}</div><div class="sub">${tr('app.usage.inRange', { n: fmtTok(sum(days, m => m.in + m.cw + m.cr)) })}</div></div>
      <div class="kpi"><div class="lbl">${tr('app.usage.costRange', { range: rangeLbl })}</div><div class="val">${money(u.totalCost) || '$0'}</div><div class="sub">${tr('app.usage.costSub')}</div></div>
    </div>

    ${running.length ? `<div class="panel" style="margin-bottom:16px"><h3><span class="dot pulse" style="color:var(--teal)"></span> ${tr('app.usage.live')} <span class="n">${trn('app.common.tasks', running.length)}</span></h3>
      ${running.map(t => { const lu = state.liveUsage[t.id] || {}; const ctx = lu.context || t.context || 0; const win = t.contextWindow || 1000000; const pct = Math.round(ctx / win * 100);
        return `<div class="live-row" data-task="${t.id}"><span class="name"><b>${esc(t.projectName)}</b> · ${esc(t.title)}</span>
          <span class="hint">${tr('app.usage.ctx', { used: fmtTok(ctx), win: fmtTok(win) })}</span><span class="meter ${meterCls(pct)}" style="width:90px;margin:0"><i style="width:${Math.max(2, pct)}%"></i></span>
          <span class="tag ok">${tr('app.usage.out', { n: fmtTok((t.tokens && t.tokens.out || 0) + (lu.out || 0)) })}</span></div>`; }).join('')}</div>` : ''}

    <div class="panel" style="margin-bottom:16px">
      <h3>${tr('app.usage.perDay', { range: rangeLbl })}
        <span class="seg" style="margin-left:auto">
          <button data-metric="out" class="${state.usageMetric === 'out' ? 'on' : ''}">${tr('app.usage.output')}</button>
          <button data-metric="in" class="${state.usageMetric === 'in' ? 'on' : ''}">${tr('app.usage.inputNew')}</button>
          <button data-metric="cr" class="${state.usageMetric === 'cr' ? 'on' : ''}">${tr('app.usage.cacheRead')}</button>
        </span></h3>
      <div class="legend">${ch.present.map(f => `<span><i style="background:${f.color}"></i>${f.label || f.key}</span>`).join('') || `<span>${tr('app.usage.noData')}</span>`}</div>
      <div class="chart-wrap" id="chartWrap">${ch.svg}<div class="tip" id="chartTip" hidden></div></div>
    </div>

    ${state.usageView === 'account' ? accountPanel(u) : machinePanel(u.machine)}
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(420px,1fr))">
      <div class="panel"><h3>${tr('app.usage.byProject')} <span class="n">${rangeLbl}</span></h3>
        <table class="table"><thead><tr><th>${tr('app.usage.thProject')}</th><th>${tr('app.usage.output')}</th><th class="num">${tr('app.usage.thSessions')}</th><th class="num">${tr('app.usage.thCost')}</th></tr></thead><tbody>
        ${u.projects.map(p => `<tr><td>${esc(projName(p.path))}</td><td><span class="bar-cell"><i style="width:${Math.round(p.out / projMax * 120)}px"></i>${fmtTok(p.out)}</span></td><td class="num">${p.sessions}</td><td class="num">${money(p.cost)}</td></tr>`).join('')}
        </tbody></table></div>
      <div class="panel"><h3>${tr('app.usage.topSessions')} <span class="n">${rangeLbl}</span></h3>
        <table class="table"><thead><tr><th>${tr('app.usage.thSession')}</th><th class="num">${tr('app.usage.output')}</th><th class="num">${tr('app.usage.thCost')}</th><th></th></tr></thead><tbody>
        ${u.topSessions.map(s => `<tr><td><div style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(s.title)}">${esc(s.title)}</div><div class="hint">${esc(projName(s.cwd))} · ${ago(s.lastAt)}</div></td><td class="num">${fmtTok(s.tokens.out)}</td><td class="num">${money(s.cost)}</td><td><button class="btn sm ghost" data-opensess="${s.id}">💬</button></td></tr>`).join('')}
        </tbody></table></div>
    </div>`;
  bindChartTip(days, ch.present);
}

// ---------- tokens per account (on this machine) ----------
function limitCell(l) {
  if (!l || !l.unifiedWindows) return `<span class="hint">${tr('app.usage.noNumber')}</span>`;
  return ['five_hour', 'seven_day'].map(k => {
    const w = l.unifiedWindows[k];
    if (!w) return '';
    const reset = (w.resetsAt || 0) * 1000, exp = reset && reset < Date.now(), pct = Math.round((w.utilization || 0) * 100);
    return `<div class="acc-lim"><span class="rl-l">${k === 'five_hour' ? tr('app.rl.short5h') : tr('app.rl.short7d')}</span><span class="meter mini ${meterCls(exp ? 0 : pct)}"><i style="width:${exp ? 0 : Math.max(2, pct)}%"></i></span><b>${exp ? '↺' : pct + '%'}</b><small class="hint">${exp ? tr('app.usage.wasReset') : tr('app.usage.resetIn', { until: untilShort(reset) })}</small></div>`;
  }).join('') + `<div class="hint" style="font-size:11px">${tr('app.usage.updatedAgo', { ago: ago(l.at) })}</div>`;
}
function accountPanel(u) {
  const A = u.accounts;
  if (!A || !A.list.length) return '';
  const rows = A.list.filter(x => x.out || x.in || x.cr || x.email === A.current || x.limit);
  const tot = rows.reduce((s, x) => s + x.out, 0) || 1;
  return `<div class="panel" style="margin-bottom:16px">
    <h3>${tr('app.usage.accTitle')} <span class="n">${tr('app.usage.accSub', { range: trn('app.common.days', u.rangeDays) })}</span></h3>
    <p class="hint" style="margin:-4px 0 10px">${tr('app.usage.accHint', { since: A.trackedSince ? new Date(A.trackedSince).toLocaleString(i18n.locale) : '—' })}</p>
    <table class="table"><thead><tr><th>${tr('app.usage.thAccount')}</th><th>${tr('app.usage.output')}</th><th class="num">${tr('app.usage.inputNew')}</th><th class="num">${tr('app.usage.cacheRead')}</th><th class="num">${tr('app.usage.thSessions')}</th><th>${tr('app.usage.thLimit')}</th></tr></thead><tbody>
    ${rows.map(x => `<tr class="${x.email === A.current ? 'acc-cur' : ''}">
      <td>${x.email === '?' ? `<b>${tr('app.usage.accUnknown')}</b><div class="hint">${tr('app.usage.accUnknownSub')}</div>` : `<b>${esc(x.email)}</b>${x.email === A.current ? ` <span class="tag ok">${tr('app.usage.accCurrent')}</span>` : ''}<div class="hint">${esc([x.name, x.org, x.plan, x.tier].filter(Boolean).join(' · '))}</div>`}</td>
      <td><span class="bar-cell"><i style="width:${Math.round(x.out / tot * 120)}px"></i>${fmtTok(x.out)}</span><div class="hint">${Math.round(x.out / tot * 100)}%</div></td>
      <td class="num">${fmtTok(x.in + x.cw)}</td><td class="num">${fmtTok(x.cr)}</td><td class="num">${x.sessions}</td>
      <td>${x.email === '?' ? '' : limitCell(x.limit)}</td></tr>`).join('')}
    </tbody></table>
    ${A.switches.length > 1 ? `<details class="more" style="margin-top:8px"><summary>${tr('app.usage.accHistory', { n: A.switches.length })}</summary><div class="hint">${A.switches.slice().reverse().map(s => `${new Date(s.at).toLocaleString(i18n.locale)} → ${esc(s.email)}`).join('<br>')}</div></details>` : ''}
  </div>`;
}
// Long-term history from ~/.claude/stats-cache.json (like /stats): includes deleted sessions
function machinePanel(m) {
  if (!m || !m.models.length) return '';
  const sum = k => m.models.reduce((s, x) => s + x[k], 0);
  return `<div class="panel" style="margin-bottom:16px">
    <h3>${tr('app.usage.machTitle')} <span class="n">${tr('app.usage.machSub', { since: m.since ? new Date(m.since).toLocaleDateString(i18n.locale) : '—' })}</span></h3>
    <p class="hint" style="margin:-4px 0 10px">${tr('app.usage.machHint', { at: esc(m.computed || ''), sessions: m.sessions, messages: (m.messages || 0).toLocaleString(i18n.locale) })}</p>
    <table class="table"><thead><tr><th>${tr('app.usage.thModel')}</th><th class="num">${tr('app.usage.output')}</th><th class="num">${tr('app.usage.inputNew')}</th><th class="num">${tr('app.usage.cacheWrite')}</th><th class="num">${tr('app.usage.cacheRead')}</th></tr></thead><tbody>
    ${m.models.map(x => `<tr><td>${esc(x.model)}</td><td class="num">${fmtTok(x.out)}</td><td class="num">${fmtTok(x.in)}</td><td class="num">${fmtTok(x.cw)}</td><td class="num">${fmtTok(x.cr)}</td></tr>`).join('')}
    <tr class="acc-cur"><td><b>${tr('app.usage.total')}</b></td><td class="num"><b>${fmtTok(sum('out'))}</b></td><td class="num">${fmtTok(sum('in'))}</td><td class="num">${fmtTok(sum('cw'))}</td><td class="num">${fmtTok(sum('cr'))}</td></tr>
    </tbody></table></div>`;
}

function bindChartTip(days, present) {
  const wrap = $('#chartWrap'), tip = $('#chartTip');
  if (!wrap) return;
  wrap.addEventListener('mousemove', e => {
    const hit = e.target.closest('.hit');
    if (!hit) { tip.hidden = true; return; }
    const d = days[+hit.dataset.i];
    const rows = present.map(f => ({ f, v: d.models[f.key] ? metricOf(d.models[f.key], state.usageMetric) : 0 }));
    const total = rows.reduce((a, r) => a + r.v, 0);
    const [y, m, dd] = d.day.split('-');
    tip.innerHTML = `<div style="font-weight:600;margin-bottom:4px">${dd}/${m}/${y} · ${fmtTok(total)}</div>` +
      rows.filter(r => r.v).map(r => `<div class="r"><span><i style="width:9px;height:9px;border-radius:3px;background:${r.f.color};display:inline-block"></i>${r.f.label || r.f.key}</span><b>${r.v.toLocaleString(i18n.locale)}</b></div>`).join('') ||
      `<div class="hint">${tr('app.usage.tipNone')}</div>`;
    tip.hidden = false;
    const wr = wrap.getBoundingClientRect();
    let x = e.clientX - wr.left + 14;
    if (x + 190 > wr.width) x = e.clientX - wr.left - 200;
    tip.style.left = x + 'px';
    tip.style.top = Math.max(0, e.clientY - wr.top - 30) + 'px';
  });
  wrap.addEventListener('mouseleave', () => (tip.hidden = true));
}

// ---------- config / plugins / mcp ----------
function mcpItem(m) {
  const scopeTag = { user: 'tag', local: 'tag warn', project: 'tag git', plugin: 'tag plugin' }[m.scope] || 'tag';
  const where = m.command ? [m.command, ...(m.args || [])].join(' ') : m.url || (m.plugin ? tr('app.mcp.fromPlugin', { name: m.plugin }) : '');
  return `
    <div class="item">
      <div class="item-head">🔌 ${esc(m.name)}
        ${m.agent ? agentBadge(m.agent, true) : ''}
        <span class="${scopeTag}">${esc(m.scope)}</span>
        <span class="tag">${esc(m.type)}</span>
        ${m.scope === 'project' ? (m.disabled ? `<span class="tag err">${tr('app.mcp.disabled')}</span>` : m.approved ? `<span class="tag ok">${tr('app.mcp.approved')}</span>` : `<span class="tag warn">${tr('app.mcp.unapproved')}</span>`) : ''}
      </div>
      ${where ? `<div class="item-sub">${esc(where)}</div>` : ''}
      ${m.env && m.env.length ? `<div class="item-desc">env: ${m.env.map(esc).join(', ')} <i>${tr('app.mcp.hidden')}</i></div>` : ''}
    </div>`;
}

function pluginItem(p, extra = '') {
  const parts = [
    p.skills && p.skills.length ? trn('app.plugin.skills', p.skills.length) : '',
    p.commands && p.commands.length ? trn('app.plugin.commands', p.commands.length) : '',
    p.agents && p.agents.length ? trn('app.plugin.agents', p.agents.length) : '',
    p.mcp && p.mcp.length ? tr('app.plugin.mcp', { n: p.mcp.length }) : '',
    p.hooks ? tr('app.plugin.hooks') : '',
  ].filter(Boolean);
  return `
    <div class="item">
      <div class="item-head">🧩 ${esc(p.name || p.key.split('@')[0])}
        ${p.agent ? agentBadge(p.agent, true) : ''}
        <span class="tag">@${esc(p.marketplace || p.key.split('@')[1] || '')}</span>
        ${p.version ? `<span class="tag">v${esc(p.version)}</span>` : ''}
        ${p.scope ? `<span class="tag ${p.enabled ? 'ok' : 'err'}">${tr(p.enabled ? 'app.plugin.on' : 'app.plugin.off')} · ${esc(p.scope)}</span>` : ''}
        ${p.installed === false ? `<span class="tag err">${tr('app.plugin.notInstalled')}</span>` : ''}
        ${extra}
      </div>
      ${p.description ? `<div class="item-desc">${esc(p.description)}</div>` : ''}
      ${parts.length ? `<div class="item-desc">${parts.join(' · ')}</div>` : ''}
    </div>`;
}

async function renderConfig() {
  // No project selected: show the machine-level (user) config, plus shortcuts to each project
  const target = state.project || state.overview.homePath;
  const machine = !state.project;
  $('#view').innerHTML = `<div class="empty">${tr('app.cfg.loading')}</div>`;
  const c = await projectCfg(target, true);
  if (state.tab !== 'config' || (state.project || state.overview.homePath) !== c.path) return;
  const list = (arr, cls) => arr.length ? arr.map(x => `<span class="tag ${cls}">${esc(x)}</span>`).join(' ') : '<span class="hint">—</span>';
  const ruleLabel = esc(c.ruleFile || 'AGENTS.md');
  $('#view').innerHTML = `
    <div class="section-title">
      <h2>${machine ? tr('app.cfg.machineTitle') : '📁 ' + esc(projName(c.path))}</h2>
      ${c.branch ? `<span class="tag git">⎇ ${esc(c.branch)}</span>` : ''}
      <span class="hint">${tr(machine ? 'app.cfg.machineHint' : 'app.cfg.projectHint')}</span>
      <button class="btn sm ghost" data-terminal="${esc(c.path)}">${tr('app.cfg.terminal')}</button>
      <button class="btn sm primary" data-compose>${tr('app.common.assign')}</button>
    </div>
    ${machine ? `<div class="cfg-projects"><span class="hint">${tr('app.cfg.perProject')}</span>${scopedProjects().map(p => `<button class="chip" data-path="${esc(p.path)}" data-cfgproj>📁 ${esc(projName(p.path))}</button>`).join('')}</div>` : ''}
    <div class="grid">
      <div class="panel">
        <h3>${tr('app.cfg.overview')}</h3>
        <dl class="kv">
          <dt>${tr('app.cfg.dir')}</dt><dd>${esc(c.display)}</dd>
          <dt>${tr('app.cfg.model')}</dt><dd>${esc(c.model || tr('app.common.default'))}</dd>
          <dt>${tr('app.cfg.defaultMode')}</dt><dd>${esc(c.defaultMode || tr('app.common.default'))}</dd>
          <dt>${tr('app.cfg.allowed')}</dt><dd>${tr('app.cfg.allowRules', { n: c.allowedTools })}</dd>
          <dt>${tr('app.cfg.settings')}</dt><dd>${c.settingsFiles.map(f => `<div><span class="tag">${esc(f.scope)}</span> ${esc(f.file)}</div>`).join('')}</dd>
          <dt>${ruleLabel}</dt><dd>${c.claudeMd.map(esc).join('<br>') || '—'}</dd>
        </dl>
      </div>
      <div class="panel">
        <h3>${tr('app.cfg.mcp')} <span class="n">${c.mcp.length}</span></h3>
        <div class="list">${c.mcp.map(mcpItem).join('') || `<div class="hint">${tr('app.cfg.noMcp')}</div>`}</div>
      </div>
      <div class="panel">
        <h3>${tr('app.cfg.plugins')} <span class="n">${tr('app.cfg.pluginsOn', { n: c.plugins.filter(x => x.enabled).length })}</span></h3>
        <div class="list">${c.plugins.map(x => pluginItem(x)).join('') || `<div class="hint">${tr('app.cfg.noPlugins')}</div>`}</div>
      </div>
      <div class="panel">
        <h3>${tr('app.cfg.skillsTitle')}</h3>
        <dl class="kv">
          <dt>${tr('app.cfg.skillsProject')}</dt><dd>${list(c.skills.project, 'coral')}</dd>
          <dt>${tr('app.cfg.skillsUser')}</dt><dd>${list(c.skills.user, '')}</dd>
          <dt>${tr('app.cfg.cmdProject')}</dt><dd>${list(c.commands.project.map(x => '/' + x), 'coral')}</dd>
          <dt>${tr('app.cfg.cmdUser')}</dt><dd>${list(c.commands.user.map(x => '/' + x), '')}</dd>
          <dt>${tr('app.cfg.agents')}</dt><dd>${list([...c.agents.project, ...c.agents.user], 'plugin')}</dd>
        </dl>
      </div>
      ${c.claudeMdPreview ? `<div class="panel" style="grid-column:1/-1"><h3>📘 ${ruleLabel}</h3><pre class="mdprev">${esc(c.claudeMdPreview)}</pre></div>` : ''}
    </div>`;
}

async function renderPlugins() {
  if (!state.plugins) { $('#view').innerHTML = `<div class="empty">${tr('app.plugins.loading')}</div>`; state.plugins = await api('/api/plugins'); }
  if (state.tab !== 'plugins') return;
  $('#view').innerHTML = `
    <div class="section-title"><h2>${tr('app.plugins.title')}</h2><span class="hint">${tr('app.plugins.hint')}</span></div>
    <div class="grid">${state.plugins.map(p => `<div class="panel" style="padding:12px">${pluginItem(p,
      (p.userEnabled ? `<span class="tag ok">${tr('app.plugins.userEnabled')}</span>` : '') +
      `<button class="btn sm teal" data-useplugin="${esc(p.key)}" style="margin-left:auto">${tr('app.plugins.use')}</button>`)}
      ${p.enabledIn.length ? `<div class="item-desc" style="padding:0 12px">${tr('app.plugins.enabledIn')} ${p.enabledIn.map(x => `<span class="tag git">${esc(x.split('/').pop())}</span>`).join(' ')}</div>` : ''}
      ${p.skills.length ? `<div class="item-desc" style="padding:4px 12px 0">${p.skills.slice(0, 14).map(s => `<span class="tag">${esc(s)}</span>`).join(' ')}${p.skills.length > 14 ? ' …' : ''}</div>` : ''}
    </div>`).join('')}</div>`;
}

async function renderMcp() {
  $('#view').innerHTML = `<div class="empty">${tr('app.mcp.loading')}</div>`;
  const projects = state.project ? state.overview.projects.filter(p => p.path === state.project) : state.overview.projects;
  const cfgs = await Promise.all(projects.map(p => projectCfg(p.path)));
  if (state.tab !== 'mcp') return;
  const byName = new Map();
  for (const c of cfgs) for (const m of c.mcp) {
    const k = `${m.name}|${m.scope}`;
    if (!byName.has(k)) byName.set(k, { ...m, projects: [] });
    byName.get(k).projects.push(projName(c.path));
  }
  const rows = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  $('#view').innerHTML = `
    <div class="section-title"><h2>${tr('app.cfg.mcp')}</h2><span class="hint">${tr('app.mcp.hint')}</span></div>
    <div class="grid">${rows.map(m => `<div class="panel" style="padding:12px">${mcpItem(m)}
      <div class="item-desc" style="padding:4px 12px 0">${m.scope === 'user' ? tr('app.mcp.allProjects') : tr('app.mcp.projects') + ' ' + [...new Set(m.projects)].map(x => `<span class="tag git">${esc(x)}</span>`).join(' ')}</div></div>`).join('')}</div>`;
}

// ---------- file attachments ----------
function renderAtt(target) {
  const box = target === 'compose' ? $('#composeAtt') : $('#chatAtt');
  if (!box) return;
  box.innerHTML = state.att[target].map((f, i) => `
    <span class="att ${f.uploading ? 'uploading' : ''}" title="${esc(f.name)} · ${fmtSize(f.size || 0)}">
      ${f.preview ? `<img src="${f.preview}" alt="">` : '<span class="ic">📄</span>'}
      <span class="nm">${f.uploading ? '⏫ ' : ''}${esc(f.name)}</span>
      <button type="button" data-rmatt="${target}:${i}" title="${tr('app.att.remove')}">✕</button>
    </span>`).join('');
}
async function addFiles(target, files) {
  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) { toast(tr('app.att.tooBig', { name: file.name }), true); continue; }
    const name = file.name && file.name !== 'image.png' ? file.name : tr('app.att.pastedName', { ts: Date.now() });
    const item = { name, size: file.size, mime: file.type, uploading: true, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null };
    state.att[target].push(item);
    renderAtt(target);
    try {
      const res = await fetch('/api/upload?name=' + encodeURIComponent(name), { method: 'POST', headers: { 'X-Lang': i18n.lang }, body: file });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || tr('app.att.uploadFailed'));
      Object.assign(item, j, { uploading: false });
    } catch (err) {
      state.att[target] = state.att[target].filter(x => x !== item);
      toast(err.message, true);
    }
    renderAtt(target);
  }
}
const attPayload = target => state.att[target].map(f => ({ path: f.path, name: f.name, mime: f.mime, url: f.url }));
const attBusy = target => state.att[target].some(f => f.uploading);

let dropTimer;
document.addEventListener('dragover', e => {
  if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
  if (e.target.closest && e.target.closest('#files')) return;
  e.preventDefault();
  const zone = !$('#composeOverlay').hidden ? $('#composeDrop') : state.openTask ? $('#chatDrop') : null;
  if (zone) zone.hidden = false;
  clearTimeout(dropTimer);
  dropTimer = setTimeout(() => { $('#composeDrop').hidden = true; const z = $('#chatDrop'); if (z) z.hidden = true; }, 150);
});
document.addEventListener('drop', e => {
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  if (e.target.closest && e.target.closest('#files')) return;
  e.preventDefault();
  if (!$('#composeOverlay').hidden) addFiles('compose', [...e.dataTransfer.files]);
  else if (state.openTask) addFiles('chat', [...e.dataTransfer.files]);
  else { openCompose(); addFiles('compose', [...e.dataTransfer.files]); }
});
document.addEventListener('paste', e => {
  const files = [...(e.clipboardData && e.clipboardData.files || [])];
  if (!files.length) return;
  if (!$('#composeOverlay').hidden) { e.preventDefault(); addFiles('compose', files); }
  else if (state.openTask) { e.preventDefault(); addFiles('chat', files); }
});
let pickTarget = 'compose';
$('#filePicker').onchange = e => { addFiles(pickTarget, [...e.target.files]); e.target.value = ''; };

// ---------- task assignment ----------
// choosing an agent in the new-task dialog: switch model / permission mode lists, hide Claude-only parts
let claudeModelOpts = null;
function applyComposeAgent() {
  const ag = agentDef(state.pickAgent);
  $('#agentPicker').innerHTML = ((state.overview.agents && state.overview.agents.length) ? state.overview.agents : [agentDef('claude')]).map(x => `<button type="button" class="chip agent-chip ${x.key === ag.key ? 'on' : ''}" data-agent="${esc(x.key)}" style="--ac:${esc(x.color)}" ${x.available === false ? 'disabled' : ''} title="${esc(x.available === false ? tr('app.compose.notInstalledTip', { key: x.key }) : (x.version || x.label))}">${esc(x.icon)} ${esc(x.label)}${x.available === false ? ' · ' + tr('app.plugin.notInstalled') : ''}</button>`).join('');
  const msel = $('#model');
  const prevAgent = msel.dataset.agent, prevModel = msel.value;
  if (!claudeModelOpts) claudeModelOpts = msel.innerHTML;
  msel.innerHTML = ag.key === 'claude' ? claudeModelOpts : `<option value="">${tr('app.compose.agentDefault')}</option>` + ag.models.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  msel.dataset.agent = ag.key;
  if (prevAgent === ag.key && prevModel && [...msel.options].some(o => o.value === prevModel)) msel.value = prevModel;
  const psel = $('#permissionMode');
  [...psel.options].forEach(o => { o.hidden = ag.key !== 'claude' && !ag.modes.includes(o.value); });
  if (psel.selectedOptions[0] && psel.selectedOptions[0].hidden) psel.value = ag.modes[0] || '';
  for (const sel of [msel, psel]) if (sel._sync) sel._sync();
  $('#effort').closest('.field').hidden = !['claude', 'agy', 'codex'].includes(ag.key);
  $$('#composeForm details.more').forEach(d => { d.hidden = false; });
}
// ---------- SDLC skills ----------
// Skills resolved per project: project skills first → machine/plugin skills → factory copy (fallback)
const skillCache = new Map();
async function loadSkillList(project = '') {
  if (!skillCache.has(project)) { try { skillCache.set(project, await api('/api/skills?project=' + encodeURIComponent(project))); } catch { skillCache.set(project, []); } }
  state.skills = skillCache.get(project);
  return state.skills;
}
const skillDef = n => (state.skills || []).find(s => s.name === n);
const SKILL_SRC = {
  project: [tr('app.skill.src.project'), tr('app.skill.src.projectTip')],
  user: [tr('app.skill.src.user'), tr('app.skill.src.userTip')],
  native: [tr('app.skill.src.native'), tr('app.skill.src.nativeTip')],
  factory: [tr('app.skill.src.factory'), tr('app.skill.src.factoryTip')],
};
function skillBadge(t) {
  const s = t.skill && skillDef(t.skill);
  return t.skill ? `<span class="tag skill-tag" title="${esc(s ? s.description : t.skill)}" data-noicon>${esc(s ? s.icon : '✦')} ${esc(t.skill)}</span>` : '';
}
// Roles of the SDLC skill set, in delivery order
const SKILL_ROLES = [['', tr('app.skill.role.all')], ['lead', tr('app.skill.role.lead')], ['pm', tr('app.skill.role.pm')], ['ba', tr('app.skill.role.ba')], ['sa', tr('app.skill.role.sa')],
  ['dev', tr('app.skill.role.dev')], ['be', tr('app.skill.role.be')], ['fe', tr('app.skill.role.fe')], ['mobile', tr('app.skill.role.mobile')], ['qa', tr('app.skill.role.qa')], ['devops', tr('app.skill.role.devops')]];
function renderSkillPicker() {
  const el = $('#skillPicker');
  if (!el) return;
  const all = state.skills || [];
  if (state.skillRole === undefined) state.skillRole = localStorage.getItem('hub-skill-role') || '';
  const roles = SKILL_ROLES.filter(([k]) => !k || all.some(s => s.role === k));
  const list = all.filter(s => !state.skillRole || s.role === state.skillRole || s.name === state.pickSkill);
  el.innerHTML = `<div class="seg sm skill-roles">${roles.map(([k, l]) => `<button type="button" data-skillrole="${k}" class="${state.skillRole === k ? 'on' : ''}">${esc(l)} <small>${k ? all.filter(s => s.role === k).length : all.length}</small></button>`).join('')}</div>` +
    `<button type="button" class="chip ${state.pickSkill ? '' : 'on'}" data-skillpick="">${tr('app.skill.none')}</button>` + list.map(s => {
    const [src, srcTip] = SKILL_SRC[s.source] || [s.source, ''];
    const label = s.use && s.use !== s.name ? `${s.name.replace(/^sdlc-/, '')} → ${s.use}` : s.name.replace(/^sdlc-/, '');
    return `<button type="button" class="chip skill-chip src-${esc(s.source)} ${state.pickSkill === s.name ? 'on' : ''}" data-skillpick="${esc(s.name)}" title="${esc(s.description + '\n\n' + tr('app.skill.useTip', { use: s.use || s.name, src: srcTip }))}" data-noicon><small>${esc((s.stage || '').split('-')[0])}</small> ${esc(s.icon)} ${esc(label)} <em>${esc(src)}</em></button>`;
  }).join('');
}
function pickSkill(name) {
  state.pickSkill = name || '';
  const s = skillDef(name);
  // mode suggested by skill (ideate / review → plan, code / test → accept edits); the user can still change it
  if (s && s.mode) { const sel = $('#permissionMode'); const o = [...sel.options].find(x => x.value === s.mode && !x.hidden); if (o) { sel.value = s.mode; if (sel._sync) sel._sync(); } }
  renderSkillPicker();
}
async function openCompose(prefill = {}) {
  state.pickSkill = prefill.skill || '';
  loadSkillList(prefill.projects ? prefill.projects[0] : state.project || '').then(renderSkillPicker);
  const availAgents = ((state.overview && state.overview.agents) || []).filter(a => a.available !== false);
  const fallbackAgent = (availAgents[0] && availAgents[0].key) || 'claude';
  state.pickAgent = prefill.agent || state.pickAgent || localStorage.getItem('hub-agent') || fallbackAgent;
  if (!agentDef(state.pickAgent) || agentDef(state.pickAgent).available === false) state.pickAgent = fallbackAgent;
  applyComposeAgent();
  state.pickProjects = new Set(prefill.projects || (state.project ? [state.project] : []));
  if (prefill.plugin) state.pickPlugins.add(prefill.plugin);
  const o = state.overview;
  $('#projectPicker').innerHTML = scopedProjects().map(p => `<button type="button" class="chip ${state.pickProjects.has(p.path) ? 'on' : ''}" data-pick="${esc(p.path)}" title="${esc(p.display)}">📁 ${esc(projName(p.path))}</button>`).join('');
  renderAtt('compose');
  $('#composeOverlay').hidden = false;
  setTimeout(() => $('#prompt').focus(), 30);
  if (!state.plugins) state.plugins = await api('/api/plugins').catch(() => []);
  renderPluginPicker();
}
function renderPluginPicker() {
  $('#pluginPicker').innerHTML = (state.plugins || []).filter(p => p.name !== 'claude-hud').map(p => `<button type="button" class="chip violet ${state.pickPlugins.has(p.key) ? 'on' : ''}" data-pplug="${esc(p.key)}" title="${esc(p.description)}">🧩 ${esc(p.name)} <small>${esc(p.marketplace)}</small></button>`).join('') || `<span class="hint">${tr('app.compose.noPlugins')}</span>`;
  $('#pluginPickCount').textContent = state.pickPlugins.size ? tr('app.common.pickedN', { n: state.pickPlugins.size }) : '';
}
function closeCompose() { $('#composeOverlay').hidden = true; }

async function submitCompose(e) {
  e.preventDefault();
  if (!state.pickProjects.size) return toast(tr('app.compose.needProject'), true);
  if (!$('#prompt').value.trim()) return toast(tr('app.compose.emptyPrompt'), true);
  if (attBusy('compose')) return toast(tr('app.att.wait'), true);
  const body = {
    projects: [...state.pickProjects],
    agent: state.pickAgent || 'claude',
    skill: state.pickSkill || '',
    prompt: $('#prompt').value,
    model: $('#model').value,
    permissionMode: $('#permissionMode').value,
    effort: $('#effort').value,
    plugins: [...state.pickPlugins],
    appendSystemPrompt: $('#appendSystemPrompt').value.trim(),
    files: attPayload('compose'),
  };
  if (body.permissionMode === 'bypassPermissions' && !(await confirmBypass())) return;
  $('#btnSubmit').disabled = true;
  try {
    const created = await api('/api/tasks', { method: 'POST', body });
    for (const t of created) state.tasks.set(t.id, t);
    $('#prompt').value = '';
    state.pickPlugins.clear();
    state.att.compose = [];
    closeCompose();
    toast(trn('app.compose.created', created.length), 'ok');
    if (state.tab !== 'board') state.tab = 'board';
    render(); renderSidebar();
    if (created.length === 1) openChat(created[0].id);
  } catch (err) { toast(err.message, true); } finally { $('#btnSubmit').disabled = false; }
}

// ---------- chat window ----------
function toolSummary(name, input = {}) {
  return input.command || input.file_path || input.path || input.pattern || input.url || input.query || input.description || input.prompt || input.skill || input.CommandLine || input.Path || input.TargetFile || input.SearchPath || input.DirectoryPath || input.toolSummary || input.Role || input.cmd || (Object.keys(input).length ? JSON.stringify(input) : '');
}
function toolLabel(name) {
  const m = name.match(/^mcp__(.+?)__(.+)$/);
  return m ? `<span class="tag mcp">${esc(m[1])}</span> <span class="tname">${esc(m[2])}</span>` : `<span class="tname">${esc(name)}</span>`;
}

function evNode(ev) {
  const div = document.createElement('div');
  switch (ev.k) {
    case 'user': {
      div.className = 'ev user';
      div.innerHTML = `<span class="who">${meLabel()}</span>${esc(ev.text)}` + (ev.files && ev.files.length ? `<div class="files">${ev.files.map(f => f.isImage && f.url ? `<a href="${esc(f.url)}" target="_blank"><img src="${esc(f.url)}" alt="${esc(f.name)}"></a>` : `<span class="tag">${f.isImage ? '🖼' : '📄'} ${esc(i18n.tx({ text: f.name, textKey: f.nameKey, params: f.params }))}</span>`).join('')}</div>` : '');
      if (ev.text) state.lastPrompts.push(ev.text);
      break;
    }
    case 'text': { const ag = state.evAgent ? agentDef(state.evAgent) : curAgent(); div.className = 'ev text md'; div.innerHTML = `<span class="who" data-noicon>${esc(ag.icon)} ${esc(agentName(ag))}</span>` + md(ev.text); break; }
    case 'thinking': {
      const d = document.createElement('details'); d.className = 'ev thinking';
      d.innerHTML = `<summary>${tr('app.chat.thinking')}</summary><div style="white-space:pre-wrap;margin-top:6px">${esc(ev.text)}</div>`;
      return d;
    }
    case 'init':
      div.className = 'ev init';
      div.innerHTML = `🟢 ${tr('app.chat.ready', { agent: esc(ev.agent ? agentDef(ev.agent).label : 'Claude') })} · <b>${esc(ev.model || '')}</b> · ${tr('app.chat.tools', { n: ev.tools })} · ${modeChip(ev.permissionMode || 'default')}
        ${(ev.mcp || []).filter(m => m.status === 'connected' || !m.name.startsWith('claude.ai ')).map(m => `<span class="tag ${m.status === 'connected' ? 'mcp' : m.status === 'pending' ? 'warn' : 'err'}" title="${esc(m.status)}">🔌 ${esc(m.name)}${m.status === 'connected' ? '' : ' · ' + esc(m.status)}</span>`).join('')}
        ${(() => { const off = (ev.mcp || []).filter(m => m.status !== 'connected' && m.name.startsWith('claude.ai ')); return off.length ? `<span class="tag" title="${esc(off.map(m => m.name.slice(10) + ' · ' + m.status).join('\n'))}">${tr('app.chat.connectorsOff', { n: off.length })}</span>` : ''; })()}
        ${(ev.plugins || []).map(p => `<span class="tag plugin">🧩 ${esc(p)}</span>`).join('')}`;
      break;
    case 'tool': {
      // subagent steps: don't render each line, just count them on the running Agent/Task tool line
      if (ev.sub) {
        const host = state.subHost;
        if (host && host.isConnected) {
          host._sub = (host._sub || 0) + 1;
          const c = host.querySelector('.subcount');
          if (c) { c.textContent = tr('app.chat.substeps', { n: host._sub }); c.title = tr('app.chat.lastSubstep', { step: `${ev.name} ${toolSummary(ev.name, ev.input || {})}` }).slice(0, 200); }
        }
        return null;
      }
      const d = document.createElement('details');
      d.className = 'ev tool' + (ev.sub ? ' sub' : '');
      d.innerHTML = `<summary>${ev.sub ? '↳ ' : '🔧 '}${toolLabel(ev.name)}<span class="tsum">${esc(toolSummary(ev.name, ev.input))}</span><span class="tstate">${ev.sub ? '' : '<span class="tag warn">…</span>'}</span></summary><pre>${esc(JSON.stringify(ev.input, null, 2))}</pre>`;
      state.toolNodes.set(ev.id, d);
      if (/^(Agent|Task)$/.test(ev.name)) { state.subHost = d; d._sub = 0; d.querySelector('.tstate').insertAdjacentHTML('beforebegin', '<span class="subcount"></span>'); }
      return d;
    }
    case 'tool_result': {
      const d = state.toolNodes.get(ev.id);
      if (d) {
        const s = d.querySelector('.tstate');
        if (s) s.innerHTML = ev.isError ? `<span class="tag err">${tr('app.chat.toolErr')}</span>` : `<span class="tag ok">${tr('app.chat.toolOk')}</span>`;
        const pre = document.createElement('pre'); pre.textContent = ev.text || tr('app.chat.empty'); d.appendChild(pre);
      }
      return null;
    }
    case 'result':
      div.className = 'ev result md ' + (ev.ok ? 'ok' : 'bad');
      div.innerHTML = `<div class="rhead"><span class="tag ${ev.ok ? 'ok' : 'err'}">${ev.ok ? tr('app.chat.turnDone') : tr('app.chat.turnErr')}</span>
        ${ev.in || ev.cr ? `<span class="tag">↑${fmtTok((ev.in || 0) + (ev.cr || 0))}</span>` : ''}${ev.out ? `<span class="tag">${tr('app.chat.outTokens', { n: fmtTok(ev.out) })}</span>` : ''}${ev.costTotal !== undefined ? `<span class="tag" title="${tr('app.chat.costTip', { total: money(ev.costTotal) })}">💰 +${money(ev.cost) || '$0'}</span>` : ev.cost ? `<span class="tag" title="${tr('app.chat.costCumTip')}">${tr('app.chat.costSession', { cost: money(ev.cost) })}</span>` : ''}${ev.duration ? `<span class="tag">⏱ ${dur(ev.duration)}</span>` : ''}
        ${ev.denials && ev.denials.length ? `<span class="tag warn" title="${tr('app.chat.deniedTip')}">${tr('app.chat.denied', { list: esc([...new Set(ev.denials)].join(', ')) })}</span>` : ''}</div>
        ${ev.ok ? '' : md((ev.textKey ? i18n.tx(ev) : ev.text) || '')}`;
      break;
    case 'stderr': {
      const bg = /running in the background \(([\w-]+)\)/.exec(ev.text || '');
      div.className = 'ev stderr';
      div.textContent = bg ? tr('app.chat.bgStderr', { id: bg[1] }) : i18n.tx(ev);
      break;
    }
    case 'system': div.className = 'ev system'; div.textContent = 'ℹ ' + i18n.tx(ev); if (ev.agentSwitch) state.evAgent = ev.agentSwitch.to; break;
    default: return null;
  }
  return div;
}

function chatHead(t) {
  const st = STATUS[t.status] || STATUS.error;
  const active = isActive(t);
  return `
    <button class="icon-btn" data-closechat title="${tr('app.chat.close')}">←</button>
    <h2 class="chat-title" data-renchat title="${tr('app.chat.renameTip')}">${esc(t.title)}<span class="ren-ico">✏️</span></h2>
    <div class="meta">
      <span class="tag ${st.tag}">${t.status === 'running' ? '<span class="dot pulse"></span>' : st.icon} ${st.label}</span>
      <span class="tag git" title="${esc(t.projectDisplay)}">📁 ${esc(projName(t.projectPath))}</span>
      ${agentBadge(t, true)}${skillBadge(t)}
      ${modeChip(t.permissionMode)}
      ${(t.plugins || []).map(p => `<span class="tag plugin">🧩 ${esc(p.split('@')[0])}</span>`).join('')}
    </div>
    ${active ? `<button class="btn sm danger" data-stop title="${tr('app.chat.stopTip')}">${tr('app.chat.stop')}</button>` : ''}
    <a class="btn sm ghost" href="${esc(chatLink(t))}" target="_blank" rel="noopener" title="${tr('app.chat.newTabTip')}">↗</a>
    <button class="btn sm ghost" data-copylink title="${tr('app.chat.copyLink')}${chatSid(t) ? tr('app.chat.copyLinkSid', { sid: chatSid(t).slice(0, 8) }) : ''}">🔗</button>
    ${t.sessionId ? `<button class="btn sm ghost" data-term title="${tr('app.chat.termTip')}">${tr('app.chat.term')}</button>` : ''}
    <button class="btn sm ghost" data-del title="${tr('app.chat.delTip')}">🗑</button>`;
}

function statusLine(t) {
  const lu = state.liveUsage[t.id] || {};
  const ctx = lu.context || t.context || 0, win = t.contextWindow || 1000000;
  const pct = Math.round(ctx / win * 100);
  const inTok = (t.tokens ? (t.tokens.in || 0) + (t.tokens.cw || 0) : 0) + (lu.in || 0);
  const crTok = (t.tokens ? (t.tokens.cr || 0) : 0) + (lu.cr || 0);
  const outTok = (t.tokens ? (t.tokens.out || 0) : 0) + (lu.out || 0);
  const sel = (id, cur, opts) => `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}" ${String(cur || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return `
    ${(() => { const ag = agentDef(t.agent); const ms = [['', tr('app.chat.defaultModel')], ...ag.models.map(([v, l]) => [v, '🧠 ' + l])]; if (t.model && !ms.some(m => m[0] === t.model)) ms.push([t.model, '🧠 ' + t.model]); return sel('chatModel', t.model, ms); })()}
    ${sel('chatPerm', t.permissionMode, (agentDef(t.agent).modes.length ? agentDef(t.agent).modes : ['']).concat(agentDef(t.agent).modes.includes(t.permissionMode || '') ? [] : [t.permissionMode || '']).map(m => [m, permInfo(m)[0]]))}
    <span class="ctx" title="${tr('app.chat.ctxTip')}">${tr('app.chat.ctx', { used: fmtTok(ctx), win: fmtTok(win) })} <span class="meter ${meterCls(pct)}"><i style="width:${Math.max(1, pct)}%"></i></span></span>
    <span title="${esc(tr('app.chat.tokTip') + (crTok ? ` · Cache: ${fmtTok(crTok)}` : ''))}">↑${fmtTok(inTok + crTok)} ↓${fmtTok(outTok)}</span>
    ${t.costUsd ? `<span>💰 ${money(t.costUsd)}</span>` : ''}
    <span class="sp"></span>${rlMini('sl')}`;
}

// reuse = redraw from the cached payload of the open chat (language switch) instead of fetching it again
async function openChat(id, reuse) {
  state.openTask = id;
  state.toolNodes.clear();
  state.live = '';
  state.lastPrompts = [];
  state.att.chat = [];
  const c = reuse && state.chatCache && state.chatCache.id === id ? state.chatCache : null;
  const t = c ? { ...c.t, ...state.tasks.get(id), events: c.t.events } : await api('/api/tasks/' + id);
  if (state.openTask !== id) return;
  state.chatCache = { id, t, hist: c ? c.hist : null }; // live events are appended to it by the stream handler
  markSeen(id);
  setChatHash(t); setDocTitle(); filesCtx();
  const chat = $('#chat');
  if (!$('#chatMain')) {
    chat.innerHTML = `
      <aside class="chat-rail" aria-label="${tr('app.rail.aria')}">
        <div class="rail-head"><b class="rail-title">${tr('app.rail.title')}</b><span class="n" id="railCount"></span>
          <button class="icon-btn sm" data-compose title="${tr('app.rail.newTip')}">＋</button>
          <button class="icon-btn sm" data-railtoggle id="btnRail" title="${tr('app.layout.railCollapse')}">«</button></div>
        <div class="rail-ws" id="railWs"></div>
        <input class="input" id="railSearch" placeholder="${tr('app.rail.search')}" autocomplete="off">
        <div class="rail-list" id="railList"></div>
        <button class="btn sm ghost rail-clean" data-cleanup title="${tr('app.rail.clean')}">🧹 <span>${tr('app.rail.clean')}</span></button>
      </aside>
      <div class="chat-main" id="chatMain"></div>`;
    $('#railSearch').oninput = renderRail;
    applyLayout();
  }
  renderRail();
  $('#chatMain').innerHTML = `
    <div class="chat-head" id="chatHead"></div>
    <div class="prog" id="progBar" hidden></div>
    <button type="button" class="new-pill" id="newPill" data-newpill hidden></button>
    <div class="timeline" id="timeline"><div class="empty">${tr('app.chat.loading')}</div></div>
    <div class="composer-wrap">
      <div id="bgBanner"></div>
      <div class="slash-pop" id="slashPop" role="listbox" aria-label="${tr('app.chat.slashAria')}" hidden></div>
      <div class="attach-row" id="chatAtt"></div>
      <form class="composer" id="followForm">
        <button type="button" class="icon-btn" data-pickfile="chat" title="${tr('app.chat.attachTip')}">📎</button>
        <textarea id="followText" rows="1" placeholder="${tr('app.chat.placeholder')}"></textarea>
        <button type="button" class="icon-btn big-edit" data-bigedit title="${tr('app.chat.bigEditTip')}">⤢</button>
        <button class="btn primary" type="submit">${tr('app.chat.send')}</button>
      </form>
      <div class="statusline" id="statusline"></div>
    </div>
    <div class="dropzone" id="chatDrop" hidden>${tr('app.chat.drop')}</div>`;
  chat.hidden = false;
  $('#chatHead').innerHTML = chatHead(t);
  $('#statusline').innerHTML = statusLine(t);
  renderBgBanner(t);
  const sid = t.sessionId || t.historySessionId;
  if (sid && !isActive(t)) api('/api/agents').then(m => {
    const ag = m[sid];
    const cur = state.tasks.get(id);
    if (!ag || state.openTask !== id || !cur || isActive(cur)) return;
    Object.assign(cur, { bgConflict: ag.id, bgState: ag.state, bgStatus: ag.status, bgLocal: !cur.bgConflict });
    renderBgBanner(cur);
  }).catch(() => {});
  const tl = $('#timeline');
  tl.innerHTML = '';
  bindTimelineScroll(tl);
  // the chat may have switched agents: replies are labelled with the agent active at that point
  const sw = (t.events || []).find(e => e.agentSwitch);
  state.evAgent = sw ? sw.agentSwitch.from : (t.agent || 'claude');
  // older server didn't store progress → rebuild it from the event history of the latest turn
  if (t.steps === undefined && t.events) {
    let lastUser = -1;
    t.events.forEach((e, i) => { if (e.k === 'user') lastUser = i; });
    const tools = t.events.slice(lastUser + 1).filter(e => e.k === 'tool' && !e.sub);
    t.steps = tools.length;
    const last = tools[tools.length - 1];
    if (last) t.step = { name: last.name, brief: String(toolSummary(last.name, last.input || {})).replace(/\s+/g, ' ').slice(0, 140), at: last.at };
    const tw = t.events.filter(e => e.k === 'tool' && e.name === 'TodoWrite' && e.input && Array.isArray(e.input.todos)).pop();
    if (tw) t.todos = tw.input.todos.map(x => ({ text: x.activeForm && x.status === 'in_progress' ? x.activeForm : (x.content || ''), status: x.status || 'pending' }));
    if (lastUser >= 0 && !t.lastRunAt) t.lastRunAt = t.events[lastUser].at;
    const keep = state.tasks.get(id);
    if (keep) { Object.assign(keep, { steps: t.steps, step: t.step, todos: t.todos, lastRunAt: t.lastRunAt }); renderRail(); }
  }
  renderProg(t);
  if (t.historySessionId) {
    try {
      const hist = state.chatCache.hist || await api(`/api/sessions/${t.historySessionId}/transcript?before=${t.createdAt}`);
      if (state.openTask !== id) return;
      state.chatCache.hist = hist;
      if (hist.length) {
        const dv = document.createElement('div'); dv.className = 'divider'; dv.textContent = hist.length >= 500 ? tr('app.chat.histLatest') : tr('app.chat.histN', { n: hist.length }); tl.appendChild(dv);
        for (const ev of hist) { const n = evNode(ev); if (n) tl.appendChild(n); }
        const dv2 = document.createElement('div'); dv2.className = 'divider'; dv2.textContent = tr('app.chat.continueHub'); tl.appendChild(dv2);
      }
    } catch (err) { toast(tr('app.chat.histErr', { msg: err.message }), true); }
  }
  for (const ev of t.events) { const n = evNode(ev); if (n) tl.appendChild(n); }
  updateTyping(t);
  tl.scrollTop = tl.scrollHeight;
  $('#followText').focus();
}
// Session is running in the background (claude --bg) → CLI won't allow --resume. Let the user choose how to proceed.
function renderBgBanner(t) {
  const el = $('#bgBanner');
  if (!el) return;
  if (!t.bgConflict || isActive(t)) { el.innerHTML = ''; return; }
  const working = t.bgState === 'working' || t.bgStatus === 'busy';
  el.innerHTML = `<div class="bg-banner">
    <div><b>${tr('app.bg.title')}</b> <code>${esc(t.bgConflict)}</code> ${t.bgState ? `<span class="tag ${working ? 'warn' : ''}">${working ? tr('app.bg.working') : esc(({ done: tr('app.bg.done'), blocked: tr('app.bg.blocked'), idle: tr('app.bg.idle') })[t.bgState] || t.bgState)}</span>` : ''}
      <span class="hint">${tr('app.bg.hint', { extra: working ? tr('app.bg.hintWorking') : '' })}</span></div>
    <div class="bg-acts">
      <button class="btn sm primary" data-bg="stop" title="${esc(tr('app.bg.stopTip', { id: t.bgConflict }))}">${tr('app.bg.stop')}</button>
      <button class="btn sm ghost" data-bg="fork" title="${tr('app.bg.forkTip')}">${tr('app.common.fork')}</button>
      <button class="btn sm ghost" data-bg="attach" title="${esc(tr('app.bg.attachTip', { id: t.bgConflict }))}">${tr('app.bg.attach')}</button>
    </div></div>`;
}
async function resolveBg(mode, resend = true) {
  const t = state.tasks.get(state.openTask);
  if (!t) return false;
  if (mode === 'stop' && !(await ui.confirm({ title: tr('app.bg.confirmTitle', { id: t.bgConflict }), okText: tr('app.bg.confirmOk'), icon: '⇄', danger: t.bgState === 'working',
    message: tr('app.bg.confirmMsg') + (t.bgState === 'working' ? ' ' + tr('app.bg.confirmWorking') : '') }))) return false;
  const r = await api(`/api/tasks/${t.id}/bg`, { method: 'POST', body: { mode, resend } });
  if (mode === 'attach') { toast(tr('app.bg.attached')); return false; }
  if (resend && !r.resent) toast(tr(mode === 'stop' ? 'app.bg.moved' : 'app.bg.forked'), 'ok');
  for (const k of ['bgState', 'bgStatus', 'bgLocal', 'bgConflict']) delete t[k];
  renderBgBanner(t);
  return true;
}
// ---------- progress of running tasks ----------
function localProgress(id, ev) {
  const t = state.tasks.get(id);
  if (!t) return;
  const input = ev.input || {};
  t.step = { name: ev.name, brief: String(toolSummary(ev.name, input)).replace(/\s+/g, ' ').slice(0, 140), at: ev.at || Date.now() };
  if (!t._stepIds) t._stepIds = new Set();
  if (!t._stepIds.has(ev.id)) { t._stepIds.add(ev.id); t.steps = (t.steps || 0) + 1; }
  if (ev.name === 'TodoWrite' && Array.isArray(input.todos)) t.todos = input.todos.map(x => ({ text: x.activeForm && x.status === 'in_progress' ? x.activeForm : (x.content || ''), status: x.status || 'pending' }));
  if (state.openTask === id) renderProg(t);
  scheduleRender();
}
function todoBlock(todos) {
  if (!todos || !todos.length) return '';
  const done = todos.filter(x => x.status === 'completed').length;
  const cur = todos.find(x => x.status === 'in_progress');
  const pct = Math.round(done / todos.length * 100);
  return `<details class="prog-todos" ${state.todoOpen ? 'open' : ''} data-noicon>
    <summary><span class="meter ${pct === 100 ? 'ok' : ''}" style="width:90px;margin:0"><i style="width:${Math.max(3, pct)}%"></i></span>
      <b>${tr('app.prog.todos', { done, n: todos.length })}</b>${cur ? ' · ' + tr('app.prog.current', { text: esc(cur.text.slice(0, 80)) }) : ''}</summary>
    <ul>${todos.map(x => `<li class="td-${x.status}"><span>${x.status === 'completed' ? '✔' : x.status === 'in_progress' ? '▶' : '○'}</span>${esc(x.text)}</li>`).join('')}</ul>
  </details>`;
}
function renderProg(t) {
  const el = $('#progBar');
  if (!el || !t) return;
  const active = isActive(t);
  if (!active && !t.todos && !t.lastRunAt) { el.hidden = true; return; }
  el.hidden = false;
  el.className = 'prog ' + (active ? 'run' : t.status === 'error' ? 'bad' : 'idle');
  const runMs = (active ? Date.now() : (t.endedAt || t.updatedAt || Date.now())) - (t.lastRunAt || t.startedAt || Date.now());
  const step = t.step && active ? `<span class="prog-step" data-noicon>🔧 <b>${toolLabel(t.step.name)}</b> <code>${esc((t.step.brief || '').slice(0, 110))}</code></span>` : '';
  el.innerHTML = `<div class="prog-line">
    ${active ? `<span class="dot pulse"></span><b>${tr('app.prog.running')}</b>` : `<b>${tr(t.status === 'error' ? 'app.prog.lastErr' : t.status === 'stopped' ? 'app.prog.stopped' : 'app.prog.done')}</b>`}
    <span class="prog-meta">⏱ <span data-elapsed="${active ? t.lastRunAt || '' : ''}">${dur(Math.max(0, runMs)) || tr('app.time.durS', { s: 0 })}</span> · ${trn('app.prog.steps', t.steps || 0)}</span>
    ${step}${!active && lastTextOf(t) ? `<span class="prog-last">${esc(lastTextOf(t).slice(0, 120))}</span>` : ''}
  </div>${todoBlock(t.todos)}`;
  const det = el.querySelector('.prog-todos');
  if (det) det.ontoggle = () => { state.todoOpen = det.open; };
}
// timer: update elapsed time every second
setInterval(() => { for (const s of document.querySelectorAll('[data-elapsed]')) { const v = +s.dataset.elapsed; if (v) s.textContent = dur(Date.now() - v); } }, 1000);
// panel of tasks running in the background (click the "running" badge in the header)
function runningMenu(btn) {
  const run = [...state.tasks.values()].filter(isActive).sort((a, b) => (a.lastRunAt || 0) - (b.lastRunAt || 0));
  if (!run.length) return toast(tr('app.run.none'), 'info');
  ui.menu(btn, run.flatMap((t, i) => {
    const td = t.todos && t.todos.length ? tr('app.prog.todos', { done: t.todos.filter(x => x.status === 'completed').length, n: t.todos.length }) : '';
    return [
      ...(i ? [{ divider: true }] : []),
      { info: { title: t.title, sub: projName(t.projectPath) + ' · ' + agentDef(t.agent).label,
        rows: [[tr('app.run.doing'), t.step ? `${t.step.name} ${(t.step.brief || '').slice(0, 70)}` : tr(t.status === 'queued' ? 'app.run.queued' : 'app.run.thinking')], [tr('app.run.time'), dur(Date.now() - (t.lastRunAt || Date.now()))], [tr('app.run.steps'), t.steps || 0], [tr('app.run.progress'), td]] } },
      { icon: '💬', label: tr('app.run.open'), onClick: () => openChat(t.id) },
    ];
  }));
}
function updateTyping(t) {
  const tl = $('#timeline');
  if (!tl) return;
  let ty = $('#typing');
  if (isActive(t)) {
    if (!ty) { ty = document.createElement('div'); ty.id = 'typing'; ty.className = 'typing'; }
    ty.innerHTML = t.status === 'queued' ? tr('app.run.waitSlot') : t.status === 'stopping' ? tr('app.run.stopping') : `<span class="dot pulse"></span> ${tr('app.run.working', { agent: esc(agentName(agentDef(t.agent))) })}`;
    tl.appendChild(ty);
  } else if (ty) ty.remove();
}
// Click the logo → go Home: task board, all projects in the workspace, close the chat
function goHome() {
  state.project = '';
  state.tab = 'dashboard';
  if (state.openTask) closeChat(); else setChatHash(null);
  renderSidebar(); render(); filesCtx();
  window.scrollTo(0, 0);
}
function closeChat() { state.openTask = null; $('#chat').hidden = true; $('#chat').innerHTML = ''; setChatHash(null); setDocTitle(); filesCtx(); scheduleRender(); }
// Chat link carries the session ID (#session=…) to open it in another tab / share it
const chatSid = t => t && (t.sessionId || (!t.fork && t.historySessionId)) || null;
const chatLink = t => location.origin + location.pathname + (chatSid(t) ? '#session=' + chatSid(t) : '#chat=' + t.id);
function setChatHash(t) {
  const h = t ? (chatSid(t) ? '#session=' + chatSid(t) : '#chat=' + t.id) : '#tab=' + state.tab + (state.project ? '&project=' + encodeURIComponent(state.project) : '');
  if (location.hash !== h) history.replaceState(null, '', h);
}
// Open chat from hash: #chat=<taskId> or #session=<sessionId> (sessions not yet in Agents Factory are imported like "Open chat")
async function openFromHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const sid = h.get('session') || h.get('s'), tid = h.get('chat');
  if (!sid && !tid) {
    const tab = h.get('tab'), proj = h.get('project');
    let changed = false;
    if (tab && tab !== state.tab) { state.tab = tab; changed = true; }
    if (proj !== null && proj !== state.project && (!proj || state.overview.projects.some(p => p.path === proj))) { state.project = proj; changed = true; }
    if (state.openTask) closeChat();
    if (changed) { renderSidebar(); render(); filesCtx(); }
    return;
  }
  if (tid && state.tasks.has(tid)) return state.openTask !== tid && openChat(tid);
  if (!sid) { if (state.openTask && !tid) closeChat(); return; }
  const tasks = [...state.tasks.values()];
  const t = tasks.find(x => x.sessionId === sid) || tasks.find(x => x.historySessionId === sid && !x.fork);
  if (t) return state.openTask !== t.id && openChat(t.id);
  try {
    const nt = await api(`/api/sessions/${sid}/open`, { method: 'POST', body: {} });
    state.tasks.set(nt.id, nt);
    openChat(nt.id);
  } catch (err) { toast(tr('app.chat.linkErr', { msg: err.message }), true); }
}
window.addEventListener('hashchange', openFromHash);

// Stick to the bottom of the chat only when the user is already there; if they scrolled up, keep position and count new updates
const atBottom = tl => tl.scrollHeight - tl.scrollTop - tl.clientHeight < 48;
function followScroll(tl) {
  if (state.follow !== false) { tl.scrollTop = tl.scrollHeight; return; }
  state.unseenEv = (state.unseenEv || 0) + 1;
  showNewPill();
}
function showNewPill() {
  const p = $('#newPill');
  if (!p) return;
  p.hidden = !state.unseenEv;
  p.innerHTML = trn('app.chat.newUpdates', state.unseenEv);
}
function bindTimelineScroll(tl) {
  state.follow = true; state.unseenEv = 0;
  tl.addEventListener('scroll', () => {
    const b = atBottom(tl);
    if (b !== state.follow) state.follow = b;
    if (b && state.unseenEv) { state.unseenEv = 0; showNewPill(); }
  }, { passive: true });
}
function appendToTimeline(node) {
  const tl = $('#timeline');
  if (!tl || !node) return;
  const anchor = $('#liveBubble') || $('#typing');
  anchor ? tl.insertBefore(node, anchor) : tl.appendChild(node);
  followScroll(tl);
}
let liveRaf = 0;
function renderLive() {
  liveRaf = 0;
  const tl = $('#timeline');
  if (!tl) return;
  let b = $('#liveBubble');
  if (!state.live) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('div'); b.id = 'liveBubble'; b.className = 'ev live md'; const ty = $('#typing'); ty ? tl.insertBefore(b, ty) : tl.appendChild(b); }
  b.innerHTML = `<span class="who" data-noicon>${tr('app.chat.typing', { agent: `${esc(curAgent().icon)} ${esc(agentName(curAgent()))}` })}</span>` + md(state.live) + '<span class="caret"></span>';
  if (state.follow !== false) tl.scrollTop = tl.scrollHeight;
}

async function sendChat() {
  const ta = $('#followText');
  const text = ta.value.trim();
  if (!text && !state.att.chat.length) return;
  if (attBusy('chat')) return toast(tr('app.att.wait'), true);
  // "/" commands: Agents Factory commands run locally, the rest are sent verbatim to Claude Code as if typed in the terminal
  let oneSkill = '', sendText = text;
  const sm = /^\/([\w-]+)(?:\s+([\s\S]*))?$/.exec(text);
  if (sm && (await loadSkillList((state.tasks.get(state.openTask) || {}).projectPath || ''), skillDef(sm[1]))) { oneSkill = sm[1]; sendText = (sm[2] || '').trim() || 'Apply this skill to the current task and conversation context.'; }
  else if (text.startsWith('/') && !state.att.chat.length) {
    try {
      const r = await runHubCommand(text);
      if (r) { if (r !== 'keep') { ta.value = ''; autoGrow(ta); } return; }
    } catch (err) { return toast(err.message, true); }
    const name = text.slice(1).split(/\s/)[0];
    if (TTY_ONLY.has(name)) toast(tr('app.chat.ttyOnly', { name }), 'info');
  }
  const t = state.tasks.get(state.openTask);
  // session running in the background: move it into Agents Factory first (with confirmation), then send this message
  if (t && t.bgConflict && !isActive(t)) {
    try { if (!(await resolveBg('stop', false))) return; } catch (err) { return toast(err.message, true); }
  }
  const body = { text: sendText, files: attPayload('chat'), ...(oneSkill ? { skill: oneSkill } : {}) };
  const model = $('#chatModel').value, perm = $('#chatPerm').value;
  if (t && model !== (t.model || '')) body.model = model;
  if (t && perm !== (t.permissionMode || '')) {
    if (perm === 'bypassPermissions' && !(await confirmBypass())) return;
    body.permissionMode = perm;
  }
  ta.value = ''; ta.style.height = ''; $('#followForm').classList.remove('big');
  const saved = state.att.chat; state.att.chat = []; renderAtt('chat');
  try { await api(`/api/tasks/${state.openTask}/message`, { method: 'POST', body }); }
  catch (err) { toast(err.message, true); ta.value = text; state.att.chat = saved; renderAtt('chat'); }
}

// ---------- realtime ----------
function canRedrawStatusline() {
  const sl = $('#statusline');
  if (!sl) return false;
  if (sl.contains(document.activeElement)) return false;
  if (sl.querySelector('[aria-expanded="true"]')) return false;
  return true;
}
function connectStream() {
  const es = new EventSource('/api/stream');
  es.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'event' && msg.ev.k === 'tool_result') filesRefreshSoon();
    if (msg.type === 'event' && msg.ev.k === 'result') setTimeout(loadMachineCost, 4000);
    if (msg.type === 'event' && msg.ev.k === 'result' && msg.ev.costTotal === undefined && costFix.has(msg.id)) { const f = costFix.get(msg.id), c = msg.ev.cost || 0; if (c < f.last) f.base += f.last; f.last = c; }
    if (msg.type === 'event' && msg.ev.k === 'tool' && !msg.ev.sub) localProgress(msg.id, msg.ev);
    if (msg.type === 'task') {
      const prev = state.tasks.get(msg.task.id);
      // keep background-session info detected in the browser (unknown to the server) until the chat runs again
      if (prev && prev.bgLocal && !msg.task.bgConflict && !isActive(msg.task)) Object.assign(msg.task, { bgConflict: prev.bgConflict, bgState: prev.bgState, bgStatus: prev.bgStatus, bgLocal: true });
      // older server doesn't send progress → keep the browser's own count
      if (prev && msg.task.steps === undefined) for (const k of ['step', 'steps', 'todos', '_stepIds']) if (prev[k] !== undefined) msg.task[k] = prev[k];
      // keep model / permissionMode just changed by the user while the config request is in flight
      if (prev && prev._cfgAt && Date.now() - prev._cfgAt < 5000) {
        msg.task.model = prev.model;
        msg.task.permissionMode = prev.permissionMode;
        msg.task._cfgAt = prev._cfgAt;
      }
      if (!msg.task.costFixed && costFix.has(msg.task.id)) msg.task.costUsd = costFix.get(msg.task.id).base + costFix.get(msg.task.id).last;
      state.tasks.set(msg.task.id, msg.task);
      if (prev && isActive(prev) && !isActive(msg.task)) {
        const ok = msg.task.status === 'done';
        notify(msg.task);
        delete state.liveUsage[msg.task.id];
      }
      scheduleRender();
      if (state.openTask === msg.task.id && $('#chatHead')) {
        markSeen(msg.task.id);
        if (chatSid(msg.task) && !location.hash.includes(chatSid(msg.task))) setChatHash(msg.task);
        setDocTitle();
        $('#chatHead').innerHTML = chatHead(msg.task);
        renderBgBanner(msg.task);
        renderProg(msg.task);
        updateTyping(msg.task);
        if (canRedrawStatusline()) $('#statusline').innerHTML = statusLine(msg.task);
        if (!isActive(msg.task)) { state.live = ''; renderLive(); }
      }
    } else if (msg.type === 'event' && msg.id === state.openTask) {
      if (state.chatCache && state.chatCache.id === msg.id) state.chatCache.t.events.push(msg.ev);
      if (msg.ev.k === 'text') { state.live = ''; renderLive(); }
      appendToTimeline(evNode(msg.ev));
    } else if (msg.type === 'delta' && msg.id === state.openTask) {
      if (msg.reset) state.live = ''; else state.live += msg.text;
      if (!liveRaf) liveRaf = requestAnimationFrame(renderLive);
    } else if (msg.type === 'usage') {
      const lu = (state.liveUsage[msg.id] = state.liveUsage[msg.id] || { in: 0, cr: 0, out: 0 });
      lu.context = msg.context;
      if (msg.turnOut !== undefined) { lu.in = msg.turnIn || 0; lu.cr = msg.turnCr || 0; lu.out = msg.turnOut || 0; }
      else lu.out += msg.out || 0;
      const t = state.tasks.get(msg.id);
      if (t) t.context = msg.context;
      if (msg.id === state.openTask && t && canRedrawStatusline()) $('#statusline').innerHTML = statusLine(t);
    } else if (msg.type === 'account') {
      toast(tr('app.account.switched', { email: msg.account.email }), 'info');
      loadOverview().then(() => { renderRl(); if (state.tab === 'usage') renderUsage(true); });
    } else if (msg.type === 'ratelimit') {
      state.rateLimit = msg.rateLimit;
      renderRl();
      if (state.tab === 'usage' && state.usage) state.usage.rateLimit = msg.rateLimit;
      const ot = state.openTask && state.tasks.get(state.openTask);
      if (ot && canRedrawStatusline()) $('#statusline').innerHTML = statusLine(ot);
    } else if (msg.type === 'removed') {
      state.tasks.delete(msg.id);
      if (state.openTask === msg.id) closeChat();
      scheduleRender();
    } else if (msg.type === 'sessions-updated') {
      if (state.tab === 'sessions') renderSessions(true);
      loadMachineCost();
    }
  };
}
let renderTimer;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderStats(); renderSidebar();
    if (state.tab === 'board') renderBoard();
    if (state.tab === 'dashboard' && !state.openTask && !document.querySelector('.dlg-overlay, .pop-menu')) renderDashboard();
    if (state.openTask) renderRail();
    if (state.tab === 'usage' && !$('#chartWrap:hover')) renderUsage(true);
  }, 300);
}
// In-page notifications (no OS Notification); when the tab is hidden, show a count in the title
let unread = 0;
function setDocTitle() {
  const t = state.openTask && state.tasks.get(state.openTask);
  const busy = [...state.tasks.values()].some(isActive);
  document.title = `${busy ? '⏳ ' : ''}${unread ? `(${unread}) ` : ''}${t ? t.title.slice(0, 50) + ' · ' : ''}Agents Factory`;
}
function notify(t) {
  const ok = t.status === 'done';
  if (document.hidden) { unread++; setDocTitle(); }
  if (state.openTask === t.id && !document.hidden) return;
  toast(`${projName(t.projectPath)} · ${ok ? STATUS.done.label : (STATUS[t.status] || {}).label || t.status}: ${t.title.slice(0, 70)}`, ok ? 'ok' : 'error',
    { action: { label: tr('app.run.openChat'), fn: () => openChat(t.id) } });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { unread = 0; setDocTitle(); } });
const confirmBypass = () => ui.confirm({
  title: tr('app.bypass.title'), danger: true, okText: tr('app.bypass.ok'),
  message: tr('app.bypass.msg'),
});

// ---------- workspace ----------
const WS_ICONS = ['🗂', '💳', '🏢', '🧪', '🚀', '📦', '🛠', '🌐', '📚', '🔐'];
let activeWs = '';
try { activeWs = localStorage.getItem('hub-ws') || ''; } catch { /* ignore */ }
const curWs = () => (state.overview && state.overview.workspaces.find(w => w.id === activeWs)) || null;
const inScope = p => { const w = curWs(); return !w || w.projects.includes(p); };
const scopedProjects = () => state.overview.projects.filter(p => inScope(p.path));
const scopedTasks = () => [...state.tasks.values()].filter(t => inScope(t.projectPath));

function renderWsBtn() {
  const w = curWs();
  $('#wsBtn').innerHTML = `<span class="ws-ico">${w ? esc(w.icon) : '🌈'}</span><span class="ws-name">${w ? esc(w.name) : tr('app.ws.allProjectsPlain')}</span><i aria-hidden="true">▾</i>`;
}
function setWorkspace(id) {
  activeWs = id;
  try { localStorage.setItem('hub-ws', id); } catch { /* ignore */ }
  if (state.project && !inScope(state.project)) state.project = '';
  renderWsBtn(); renderSidebar(); render();
  if (state.openTask) renderRail();
  if (fx.root && !inScope(fx.root)) fx.root = '';
  filesCtx(); if (!state.openTask && !state.project) setRoot(fxContextRoot());
}
function wsMenu(btn) {
  const o = state.overview, w = curWs();
  const visible = x => x.projects.filter(p => o.projects.some(q => q.path === p)).length;
  const items = [{ icon: '🌈', label: tr('app.ws.allProjectsPlain'), hint: String(o.projects.length), active: !w, onClick: () => setWorkspace('') }];
  for (const x of o.workspaces) items.push({ icon: x.icon, label: x.name, hint: String(visible(x)), active: !!w && w.id === x.id, onClick: () => setWorkspace(x.id) });
  items.push({ divider: true }, { icon: '＋', label: tr('app.ws.new'), onClick: () => editWorkspace() });
  if (w) items.push({ icon: '✏️', label: tr('app.ws.editName', { name: w.name }), onClick: () => editWorkspace(w) });
  ui.menu(btn, items);
}
function modalShell(html, cls) {
  const wrap = document.createElement('div');
  wrap.className = 'dlg-overlay';
  wrap.innerHTML = `<form class="modal ${cls}" role="dialog" aria-modal="true">${html}</form>`;
  document.body.appendChild(wrap);
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey, true); };
  document.addEventListener('keydown', onKey, true);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  wrap.addEventListener('click', e => { if (e.target.closest('[data-x]')) close(); });
  return { wrap, close };
}
function editWorkspace(w) {
  const o = state.overview;
  const draft = w ? { ...w, projects: [...w.projects] } : { name: '', icon: '🗂', projects: state.project ? [state.project] : [] };
  const { wrap, close } = modalShell(`
    <div class="modal-head"><h2>${tr(w ? 'app.ws.editTitle' : 'app.ws.createTitle')}</h2><button type="button" class="icon-btn" data-x aria-label="${tr('app.common.close')}">✕</button></div>
    <label class="field"><span>${tr('app.ws.name')}</span><input class="input" id="wsName" maxlength="40" placeholder="${tr('app.ws.namePh')}" value="${esc(draft.name)}"></label>
    <div class="field"><span>${tr('app.ws.icon')}</span><div class="chips" id="wsIcons">${WS_ICONS.map(i => `<button type="button" class="chip ${i === draft.icon ? 'on' : ''}" data-icon="${i}">${i}</button>`).join('')}</div></div>
    <div class="field"><span>${tr('app.ws.projects')} <small id="wsCount"></small></span>
      <div class="chips" style="max-height:240px">${o.projects.map(p => `<button type="button" class="chip ${draft.projects.includes(p.path) ? 'on' : ''}" data-wp="${esc(p.path)}" title="${esc(p.display)}">📁 ${esc(projName(p.path))}</button>`).join('')}</div></div>
    <div class="modal-foot">
      ${w ? `<button type="button" class="btn danger" data-delws>${tr('app.ws.delete')}</button>` : ''}
      <span class="hint"></span>
      <button type="button" class="btn ghost" data-x>${tr('app.common.cancel')}</button>
      <button type="submit" class="btn primary">${tr(w ? 'app.common.save' : 'app.ws.createTitle')}</button>
    </div>`, 'ws-modal');
  const count = () => ($('#wsCount', wrap).textContent = tr('app.common.pickedN', { n: draft.projects.length }));
  count();
  $('#wsName', wrap).focus();
  wrap.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.icon) { draft.icon = b.dataset.icon; $$('#wsIcons .chip', wrap).forEach(c => c.classList.toggle('on', c === b)); return; }
    if (b.dataset.wp) {
      const i = draft.projects.indexOf(b.dataset.wp);
      i >= 0 ? draft.projects.splice(i, 1) : draft.projects.push(b.dataset.wp);
      b.classList.toggle('on'); return count();
    }
    if (b.dataset.delws !== undefined) {
      if (!(await ui.confirm({ title: tr('app.ws.delTitle', { name: w.name }), danger: true, okText: tr('app.common.delete'), icon: '🗂', message: tr('app.ws.delMsg') }))) return;
      await api('/api/workspaces', { method: 'POST', body: { action: 'delete', id: w.id } });
      close();
      await loadOverview();
      setWorkspace(activeWs === w.id ? '' : activeWs);
      toast(tr('app.ws.deleted'), 'ok');
    }
  });
  wrap.addEventListener('submit', async e => {
    e.preventDefault();
    draft.name = $('#wsName', wrap).value.trim();
    if (!draft.name) return toast(tr('app.ws.needName'), true);
    try {
      const saved = await api('/api/workspaces', { method: 'POST', body: { workspace: draft } });
      close();
      await loadOverview();
      setWorkspace(saved.id);
      toast(w ? tr('app.ws.saved') : tr('app.ws.created', { name: saved.name }), 'ok');
    } catch (err) { toast(err.message, true); }
  });
}

// ---------- chat list + quick switcher ----------
let seen = {};
try { seen = JSON.parse(localStorage.getItem('hub-seen') || '{}'); } catch { /* ignore */ }
const saveSeen = () => { try { localStorage.setItem('hub-seen', JSON.stringify(seen)); } catch { /* ignore */ } };
function markSeen(id) { seen[id] = Date.now(); saveSeen(); }
function initSeen() {
  let changed = false;
  for (const t of state.tasks.values()) if (!(t.id in seen)) { seen[t.id] = Date.now(); changed = true; }
  for (const id of Object.keys(seen)) if (!state.tasks.has(id)) { delete seen[id]; changed = true; }
  if (changed) saveSeen();
}
const isUnread = t => state.openTask !== t.id && !isActive(t) && (t.endedAt || 0) > (seen[t.id] || 0);
const dotCls = t => ({ running: 'run', stopping: 'run', queued: 'wait', done: 'ok', idle: 'idle', error: 'err', stopped: 'err' }[t.status] || 'idle');
const byRecent = (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
const chatRow = (t, cls, attrs) => `
  <${cls === 'qs-item' ? 'div' : 'button'} class="${cls} ${t.id === state.openTask ? 'on' : ''}" ${attrs} ${cls === 'rail-item' ? `title="${esc(t.title + ' — ' + projName(t.projectPath) + ' · ' + ((STATUS[t.status] || {}).label || ''))}"` : ''}>
    <span class="sdot ${dotCls(t)}" aria-hidden="true"></span>
    <span class="ri-main"><span class="ri-title">${esc(t.title)}</span>
      <span class="ri-sub">${isActive(t) && t.step ? `<span class="ri-step" data-noicon>🔧 ${toolLabel(t.step.name)} ${esc((t.step.brief || '').slice(0, 40))}</span> · <span data-elapsed="${t.lastRunAt || ''}">${dur(Date.now() - (t.lastRunAt || Date.now()))}</span>` : `${esc(projName(t.projectPath))} · ${(STATUS[t.status] || {}).label || ''} · ${ago(t.updatedAt || t.createdAt)}`}</span></span>
    ${isUnread(t) ? `<span class="unread" title="${tr('app.task.unread')}"></span>` : ''}
  </${cls === 'qs-item' ? 'div' : 'button'}>`;

function renderRail() {
  const list = $('#railList');
  if (!list) return;
  const q = $('#railSearch').value.trim().toLowerCase();
  const rows = scopedTasks().filter(t => !q || `${t.title} ${t.projectName}`.toLowerCase().includes(q)).sort(byRecent);
  list.innerHTML = rows.map(t => chatRow(t, 'rail-item', `data-task="${t.id}"`)).join('') || `<div class="empty">${tr('app.rail.empty')}</div>`;
  $('#railCount').textContent = rows.length;
  $('#railWs').textContent = curWs() ? `${curWs().icon} ${curWs().name}` : tr('app.ws.allProjects');
}

function quickSwitch() {
  if ($('.qs-overlay')) return;
  const wrap = document.createElement('div');
  wrap.className = 'dlg-overlay qs-overlay';
  wrap.innerHTML = `
    <div class="qs" role="dialog" aria-modal="true" aria-label="${tr('app.qs.aria')}">
      <input class="input" id="qsInput" placeholder="${tr('app.qs.search')}" autocomplete="off">
      <div class="qs-list" id="qsList" role="listbox"></div>
      <div class="qs-foot"><span>${tr('app.qs.foot')}</span><span>${curWs() ? esc(curWs().icon + ' ' + curWs().name) : tr('app.ws.allProjects')}</span></div>
    </div>`;
  document.body.appendChild(wrap);
  let rows = [], active = 0;
  const draw = () => {
    const q = $('#qsInput', wrap).value.trim().toLowerCase();
    rows = scopedTasks().filter(t => !q || `${t.title} ${t.projectName} ${lastTextOf(t)}`.toLowerCase().includes(q)).sort(byRecent).slice(0, 60);
    active = Math.min(active, Math.max(0, rows.length - 1));
    $('#qsList', wrap).innerHTML = rows.map((t, i) => chatRow(t, 'qs-item', `data-i="${i}" role="option" aria-selected="${i === active}"`).replace('class="qs-item', `class="qs-item ${i === active ? 'active' : ''}`)).join('') || `<div class="empty">${tr('app.qs.empty')}</div>`;
    const a = $('.qs-item.active', wrap);
    if (a) a.scrollIntoView({ block: 'nearest' });
  };
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey, true); };
  const go = i => { const t = rows[i]; close(); if (t) openChat(t.id); };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); if (rows.length) { active = (active + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length; draw(); } }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(active); }
    else if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); close(); }
  };
  document.addEventListener('keydown', onKey, true);
  $('#qsInput', wrap).addEventListener('input', () => { active = 0; draw(); });
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  wrap.addEventListener('click', e => { const it = e.target.closest('.qs-item'); if (it) go(+it.dataset.i); });
  draw();
  $('#qsInput', wrap).focus();
}

// ---------- old chat cleanup ----------
function openCleanup() {
  const o = state.overview;
  const st = { days: 7, statuses: new Set(['done', 'idle', 'error', 'stopped']), scope: curWs() ? 'ws' : 'all', picked: new Set() };
  const STATUS_OPTS = ['done', 'idle', 'error', 'stopped'].map(s => [s, `${STATUS[s].icon} ${STATUS[s].label}`]);
  const seg = (name, cur, opts) => `<span class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</span>`;
  const { wrap, close } = modalShell(`
    <div class="modal-head"><h2>${tr('app.clean.title')}</h2><button type="button" class="icon-btn" data-x aria-label="${tr('app.common.close')}">✕</button></div>
    <div class="cl-row"><span class="cl-lbl">${tr('app.clean.inactive')}</span>${seg('days', st.days, [[1, trn('app.common.days', 1)], [3, trn('app.common.days', 3)], [7, trn('app.common.days', 7)], [30, trn('app.common.days', 30)], [0, tr('app.clean.any')]])}</div>
    <div class="cl-row"><span class="cl-lbl">${tr('app.clean.status')}</span><span class="chips" id="clStatus">${STATUS_OPTS.map(([v, l]) => `<button type="button" class="chip on" data-st="${v}">${l}</button>`).join('')}</span></div>
    ${curWs() ? `<div class="cl-row"><span class="cl-lbl">${tr('app.clean.scope')}</span>${seg('scope', st.scope, [['ws', esc(curWs().icon + ' ' + curWs().name)], ['all', tr('app.clean.scopeAll')]])}</div>` : ''}
    <div class="cl-preview">
      <div class="cl-phead"><b id="clCount"></b><span class="hint">${tr('app.clean.runningSafe')}</span><button type="button" class="btn sm ghost" data-allpick>${tr('app.common.selectAll')}</button></div>
      <div class="cl-list" id="clList"></div>
    </div>
    <details class="field more"><summary>${tr('app.clean.auto')}</summary>
      <div class="cl-row"><span class="cl-lbl">${tr('app.clean.autoChats')}</span>${seg('auto', o.settings.autoCleanupDays, [[0, tr('app.common.off')], ...[3, 7, 14, 30].map(n => [n, trn('app.common.days', n)])])}</div>
      <div class="cl-row"><span class="cl-lbl">${tr('app.clean.autoUploads')}</span>${seg('uploads', o.settings.uploadsCleanupDays, [[0, tr('app.common.off')], ...[7, 30, 90].map(n => [n, trn('app.common.days', n)])])}</div>
      <p class="hint">${tr('app.clean.autoHint')}</p>
    </details>
    <div class="modal-foot"><span class="hint">${tr('app.clean.footHint')}</span>
      <button type="button" class="btn ghost" data-x>${tr('app.common.cancel')}</button>
      <button type="submit" class="btn danger-solid" id="clGo">${tr('app.clean.go')}</button></div>`, 'cleanup-modal');

  const candidates = () => [...state.tasks.values()].filter(t =>
    !isActive(t) && st.statuses.has(t.status) && (st.scope === 'all' || inScope(t.projectPath)) &&
    (!st.days || (t.updatedAt || t.createdAt) < Date.now() - st.days * 86400000)).sort(byRecent);
  const refresh = () => { st.picked = new Set(candidates().map(t => t.id)); draw(); };
  const draw = () => {
    const rows = candidates();
    $('#clList', wrap).innerHTML = rows.map(t => `
      <label class="cl-item"><input type="checkbox" data-cid="${t.id}" ${st.picked.has(t.id) ? 'checked' : ''}>
        <span class="sdot ${dotCls(t)}" aria-hidden="true"></span>
        <span class="ri-main"><span class="ri-title">${esc(t.title)}</span><span class="ri-sub">${esc(projName(t.projectPath))} · ${(STATUS[t.status] || {}).label} · ${ago(t.updatedAt || t.createdAt)}${t.costUsd ? ' · ' + money(t.costUsd) : ''}</span></span>
      </label>`).join('') || `<div class="empty"><span class="big">✨</span>${tr('app.clean.empty')}</div>`;
    $('#clCount', wrap).textContent = tr('app.clean.count', { n: st.picked.size, total: rows.length });
    $('#clGo', wrap).textContent = trn('app.clean.goN', st.picked.size);
    $('#clGo', wrap).disabled = !st.picked.size;
    $('[data-allpick]', wrap).textContent = tr(st.picked.size === rows.length && rows.length ? 'app.common.deselectAll' : 'app.common.selectAll');
  };
  wrap.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    const sg = b.closest('[data-seg]');
    if (sg) {
      $$('button', sg).forEach(x => x.classList.toggle('on', x === b));
      const k = sg.dataset.seg, v = b.dataset.v;
      if (k === 'days') { st.days = +v; return refresh(); }
      if (k === 'scope') { st.scope = v; return refresh(); }
      const key = k === 'auto' ? 'autoCleanupDays' : 'uploadsCleanupDays';
      try {
        o.settings = await api('/api/settings', { method: 'POST', body: { [key]: +v } });
        toast(+v ? tr('app.clean.autoOn', { what: tr(k === 'auto' ? 'app.clean.whatChats' : 'app.clean.whatFiles'), n: v }) : tr('app.clean.autoOff'), 'ok');
      } catch (err) { toast(err.message, true); }
      return;
    }
    if (b.dataset.st) { b.classList.toggle('on'); st.statuses.has(b.dataset.st) ? st.statuses.delete(b.dataset.st) : st.statuses.add(b.dataset.st); return refresh(); }
    if (b.dataset.allpick !== undefined) {
      const rows = candidates();
      st.picked = st.picked.size === rows.length ? new Set() : new Set(rows.map(t => t.id));
      return draw();
    }
  });
  wrap.addEventListener('change', e => {
    const c = e.target.dataset.cid;
    if (!c) return;
    e.target.checked ? st.picked.add(c) : st.picked.delete(c);
    draw();
  });
  wrap.addEventListener('submit', async e => {
    e.preventDefault();
    if (!st.picked.size) return;
    try {
      const r = await api('/api/cleanup', { method: 'POST', body: { ids: [...st.picked] } });
      for (const id of st.picked) { state.tasks.delete(id); if (state.openTask === id) closeChat(); }
      close();
      toast(trn('app.clean.done', r.deleted), 'ok');
      render(); renderSidebar(); if (state.openTask) renderRail();
    } catch (err) { toast(err.message, true); }
  });
  refresh();
}

// ---------- events ----------
const CLICK_SEL = '[data-star],[data-hide],[data-restore],[data-path],[data-tab],[data-task],[data-compose],[data-close],[data-pick],[data-pplug],[data-useplugin],[data-closechat],[data-stop],[data-term],[data-del],[data-terminal],[data-opensess],[data-forksess],[data-termsess],[data-metric],[data-theme-set],[data-pickfile],[data-rmatt],[data-cleanup],[data-quick],[data-editws],[data-sesspick],[data-sessclear],[data-sessdel],[data-sessdel1],[data-railtoggle],[data-udays],[data-uview],[data-newpill],[data-runlist],[data-agent],[data-skillpick],[data-skillrole],[data-openfile],[data-renchat],[data-copylink],[data-bigedit],[data-bg],[data-home],[data-sessren],[data-sessproj]';
document.addEventListener('click', async e => {
  const el = e.target.closest(CLICK_SEL);
  if (!el) { if (e.target.id === 'composeOverlay') closeCompose(); return; }
  const d = el.dataset;
  try {
    if (d.themeSet) return applyTheme(d.themeSet);
    if (d.railtoggle !== undefined) { layout.rail = layout.rail === 'mini' ? 'full' : 'mini'; return applyLayout(); }
    if (d.cleanup !== undefined) return openCleanup();
    if (d.sesspick) return quickPickSessions(d.sesspick);
    if (d.sessclear !== undefined) { state.sessPick.clear(); return drawSessions(); }
    if (d.sessdel !== undefined) return deleteSessionsUI([...state.sessPick]);
    if (d.sessdel1) return deleteSessionsUI([d.sessdel1]);
    if (d.sessproj) { e.preventDefault(); state.project = d.sessproj; renderSidebar(); filesCtx(); return render(); }
    if (d.sessren) {
      const s = state.sessions.sessions.find(x => x.id === d.sessren);
      const name = await askName(s.title, tr('app.sessions.rename'), s.renamed);
      if (name === null) return;
      await api(`/api/sessions/${s.id}/rename`, { method: 'POST', body: { name } });
      return toast(tr(name ? 'app.sessions.renamed' : 'app.sessions.renameReset'), 'ok');
    }
    if (d.renchat !== undefined) {
      const t = state.tasks.get(state.openTask);
      const name = await askName(t.title, tr('app.chat.rename'));
      if (!name) return;
      const nt = await api(`/api/tasks/${t.id}/rename`, { method: 'POST', body: { name } });
      state.tasks.set(nt.id, { ...t, ...nt }); $('#chatHead').innerHTML = chatHead(state.tasks.get(nt.id)); setDocTitle();
      return toast(tr('app.chat.renamed'), 'ok');
    }
    if (d.bigedit !== undefined) return toggleBigEdit();
    if (d.bg) return resolveBg(d.bg);
    if (d.home !== undefined) return goHome();
    if (d.copylink !== undefined) {
      const link = chatLink(state.tasks.get(state.openTask));
      try { await navigator.clipboard.writeText(link); toast(tr('app.chat.linkCopied', { link }), 'ok'); }
      catch { await ui.prompt({ title: tr('app.chat.linkTitle'), icon: '🔗', okText: tr('app.common.close'), input: { value: link, hint: tr('app.chat.linkHint') } }); }
      return;
    }
    if (d.quick !== undefined) return quickSwitch();
    if (d.editws !== undefined) return editWorkspace(curWs());
    if (d.star) { e.stopPropagation(); await api('/api/projects', { method: 'POST', body: { path: d.star, action: 'favorite' } }); return loadOverview(); }
    if (d.hide) {
      e.stopPropagation();
      if (!(await ui.confirm({ title: tr('app.project.hideTitle', { name: projName(d.hide) }), icon: '🗂', okText: tr('app.project.hideOk'),
        message: tr('app.project.hideMsg') }))) return;
      await api('/api/projects', { method: 'POST', body: { path: d.hide, action: 'hide' } });
      if (state.project === d.hide) state.project = '';
      await loadOverview(); render(); return toast(tr('app.project.hidden'), 'ok');
    }
    if (d.restore) { await api('/api/projects', { method: 'POST', body: { path: d.restore } }); await loadOverview(); return toast(tr('app.project.restored'), 'ok'); }
    if (d.path !== undefined && (el.classList.contains('proj') || d.cfgproj !== undefined)) { state.project = d.path; closeChat(); renderSidebar(); filesCtx(); return render(); }
    if (d.tab) { state.tab = d.tab; history.replaceState(null, '', '#tab=' + d.tab); closeChat(); return render(); }
    if (d.task) return openChat(d.task);
    if (d.compose !== undefined) return openCompose();
    if (d.close !== undefined) return closeCompose();
    if (d.pick) { state.pickProjects.has(d.pick) ? state.pickProjects.delete(d.pick) : state.pickProjects.add(d.pick); el.classList.toggle('on'); loadSkillList([...state.pickProjects][0] || '').then(renderSkillPicker); return; }
    if (d.pplug) { state.pickPlugins.has(d.pplug) ? state.pickPlugins.delete(d.pplug) : state.pickPlugins.add(d.pplug); return renderPluginPicker(); }
    if (d.useplugin) return openCompose({ plugin: d.useplugin });
    if (d.pickfile) { pickTarget = d.pickfile; return $('#filePicker').click(); }
    if (d.rmatt) { const [tg, i] = d.rmatt.split(':'); state.att[tg].splice(+i, 1); return renderAtt(tg); }
    if (d.metric) { state.usageMetric = d.metric; return renderUsage(true); }
    if (d.openfile) { e.preventDefault(); return openFileLink(d.openfile); }
    if (d.skillpick !== undefined) return pickSkill(d.skillpick);
    if (d.skillrole !== undefined) { state.skillRole = d.skillrole; localStorage.setItem('hub-skill-role', d.skillrole); return renderSkillPicker(); }
    if (d.agent) { state.pickAgent = d.agent; localStorage.setItem('hub-agent', d.agent); return applyComposeAgent(); }
    if (d.newpill !== undefined) { const tl = $('#timeline'); tl.scrollTo({ top: tl.scrollHeight, behavior: 'smooth' }); state.unseenEv = 0; return showNewPill(); }
    if (d.runlist !== undefined) return runningMenu(el);
    if (d.uview) { state.usageView = d.uview; localStorage.setItem('hub-usage-view', d.uview); return renderUsage(true); }
    if (d.udays) { state.usageDays = d.udays; localStorage.setItem('hub-usage-days', d.udays); return renderUsage(true); }
    if (d.closechat !== undefined) return closeChat();
    if (d.stop !== undefined) { await api(`/api/tasks/${state.openTask}/stop`, { method: 'POST' }); return toast(tr('app.chat.stopSent')); }
    if (d.term !== undefined) { await api(`/api/tasks/${state.openTask}/terminal`, { method: 'POST' }); return toast(tr('app.common.termOpened')); }
    if (d.terminal) { await api('/api/terminal', { method: 'POST', body: { path: d.terminal } }); return toast(tr('app.common.termOpened')); }
    if (d.termsess) { await api('/api/terminal', { method: 'POST', body: { path: d.cwd, sessionId: d.termsess } }); return toast(tr('app.sessions.termOpened')); }
    if (d.opensess || d.forksess) {
      const t = await api(`/api/sessions/${d.opensess || d.forksess}/open`, { method: 'POST', body: { fork: !!d.forksess } });
      state.tasks.set(t.id, t);
      return openChat(t.id);
    }
    if (d.del !== undefined) {
      if (!(await ui.confirm({ title: tr('app.chat.delTitle'), danger: true, okText: tr('app.common.delete'), icon: '🗑',
        message: tr('app.chat.delMsg') }))) return;
      await api('/api/tasks/' + state.openTask, { method: 'DELETE' });
      state.tasks.delete(state.openTask); closeChat(); return render();
    }
  } catch (err) { toast(err.message, true); }
});

document.addEventListener('submit', e => {
  if (e.target.id === 'composeForm') return submitCompose(e);
  if (e.target.id === 'followForm') { e.preventDefault(); sendChat(); }
});

// Input auto-grows with content (max ~70% of the screen, scrolls inside beyond that); the ⤢ button fully expands it
function autoGrow(ta) {
  if (ta.closest('.composer.big')) return;
  ta.style.height = 'auto';
  ta.style.height = Math.min(Math.round(innerHeight * 0.7), ta.scrollHeight + 2) + 'px';
  const btn = ta.parentElement.querySelector('[data-bigedit]');
  if (btn) btn.classList.toggle('show', ta.scrollHeight > 120);
}
function toggleBigEdit() {
  const f = $('#followForm');
  if (!f) return;
  const ta = $('#followText');
  f.classList.toggle('big');
  ta.style.height = '';
  if (!f.classList.contains('big')) autoGrow(ta);
  ta.focus();
}
document.addEventListener('input', e => {
  if (e.target.id === 'followText' || e.target.id === 'prompt' || e.target.id === 'appendSystemPrompt') autoGrow(e.target);
});

document.addEventListener('keydown', e => {
  const a = document.activeElement;
  if (a && a.id === 'followText' && e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
    return cyclePermMode();
  }
  if (a && a.id === 'followText') {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); return sendChat(); }
    if (e.key === 'ArrowUp' && !a.value && state.lastPrompts.length) { e.preventDefault(); a.value = state.lastPrompts.at(-1); return; }
  }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !$('#composeOverlay').hidden) { e.preventDefault(); $('#composeForm').requestSubmit(); }
  if (e.key.toLowerCase() === 'e' && e.ctrlKey && e.shiftKey && $('#followForm')) { e.preventDefault(); return toggleBigEdit(); }
  if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); return quickSwitch(); }
  if (e.key === 'Escape') { if (!$('#composeOverlay').hidden) closeCompose(); else if (state.openTask) closeChat(); }
  if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(a.tagName) && $('#composeOverlay').hidden) { e.preventDefault(); openCompose(); }
});

$('#btnCompose').onclick = () => openCompose();
$('#btnDensity').onclick = () => { layout.side = layout.side === 'compact' ? 'full' : 'compact'; applyLayout(); };
$('#btnSide').onclick = () => {
  if (layout.side === 'mini') layout.side = layout.sidePrev || 'full';
  else { layout.sidePrev = layout.side; layout.side = 'mini'; }
  applyLayout();
};
$('#wsBtn').onclick = e => wsMenu(e.currentTarget);
$('#projectSearch').oninput = renderSidebar;
$('#btnAddProject').onclick = () => openFolderPicker();

// ---------- open an existing project: browse local folders to pick one (no new folder created) ----------
async function openFolderPicker(start) {
  const st = { dir: start || localStorage.getItem('hub-browse-dir') || '', dot: false, q: '', data: null, pick: null };
  const { wrap, close } = modalShell(`
    <div class="modal-head"><h2>${tr('app.fp.title')}</h2><button type="button" class="icon-btn" data-x aria-label="${tr('app.common.close')}">✕</button></div>
    <div class="fp-bar">
      <button type="button" class="icon-btn sm" data-fp="up" title="${tr('app.fp.up')}">↑</button>
      <button type="button" class="icon-btn sm" data-fp="home" title="${tr('app.fp.home')}">🏠</button>
      <div class="fp-crumbs" id="fpCrumbs"></div>
    </div>
    <div class="fp-tools">
      <input class="input" id="fpPath" placeholder="${tr('app.fp.pathPh')}" autocomplete="off">
      <input class="input" id="fpQ" placeholder="${tr('app.fp.filterPh')}" autocomplete="off">
      <label class="fp-dot"><input type="checkbox" id="fpDot"> ${tr('app.fp.showHidden')}</label>
    </div>
    <div class="fp-list" id="fpList"><div class="empty">${tr('app.fp.loading')}</div></div>
    <div class="modal-foot">
      <span class="hint" id="fpInfo"></span>
      <button type="button" class="btn ghost" data-x>${tr('app.common.cancel')}</button>
      <button type="submit" class="btn primary" id="fpOk">${tr('app.fp.open')}</button>
    </div>`, 'fp-modal');
  const $w = s => wrap.querySelector(s);
  const target = () => st.pick || (st.data && st.data.dir);
  const badge = d => `${d.git ? '<span class="tag git">git</span>' : ''}${d.claude ? '<span class="tag">AGENT</span>' : ''}${d.inHub ? `<span class="tag ok">${tr('app.common.inHub')}</span>` : ''}${d.hidden ? `<span class="tag warn">${tr('app.fp.removed')}</span>` : ''}`;
  const draw = () => {
    const d = st.data;
    if (!d) return;
    const parts = d.display.split('/').filter(Boolean);
    let acc = d.display.startsWith('~') ? d.home : '';
    $w('#fpCrumbs').innerHTML = parts.map((p, i) => {
      acc = i === 0 && p === '~' ? d.home : acc + '/' + p;
      return `<button type="button" class="fp-crumb" data-fpgo="${esc(acc)}">${esc(p)}</button>`;
    }).join('<i>/</i>') || '<button type="button" class="fp-crumb" data-fpgo="/">/</button>';
    const q = st.q.trim().toLowerCase();
    const rows = d.dirs.filter(x => !q || x.name.toLowerCase().includes(q));
    $w('#fpList').innerHTML = rows.map(x => `
      <div class="fp-row ${st.pick === x.path ? 'on' : ''}" data-fppick="${esc(x.path)}" title="${tr('app.fp.rowTip')}">
        <span class="fp-ico">${x.git || x.claude ? '📦' : '📁'}</span><span class="fp-name">${esc(x.name)}</span>${badge(x)}
        <button type="button" class="icon-btn xs" data-fpgo="${esc(x.path)}" title="${tr('app.fp.enter')}">▸</button>
      </div>`).join('') || `<div class="empty">${tr(q ? 'app.fp.noMatch' : 'app.fp.noSub')}</div>`;
    const t = target(), sel = st.pick ? d.dirs.find(x => x.path === st.pick) : { ...d.self, path: d.dir };
    $w('#fpInfo').innerHTML = `${tr('app.fp.target')} <b>${esc(t.replace(d.home, '~'))}</b> ${badge(sel || {})}`;
    $w('#fpOk').textContent = tr(sel && sel.inHub ? 'app.fp.goto' : sel && sel.hidden ? 'app.fp.restore' : 'app.fp.open');
  };
  const go = async dir => {
    try {
      st.data = await api('/api/browse?dir=' + encodeURIComponent(dir || '') + (st.dot ? '&dot=1' : ''));
      st.pick = null; st.q = ''; $w('#fpQ').value = '';
      localStorage.setItem('hub-browse-dir', st.data.dir);
      draw();
    } catch (err) {
      // older server has no /api/browse → fall back to entering a path
      if (/not found/i.test(err.message) && !st.data) {
        close();
        const p = await ui.prompt({ title: tr('app.fp.titlePlain'), icon: '📁', okText: tr('app.fp.ok'), input: { placeholder: '~/code/my-app', hint: tr('app.fp.fallbackHint') } });
        if (!p) return;
        try { await api('/api/projects', { method: 'POST', body: { path: p } }); await loadOverview(); toast(tr('app.fp.opened'), 'ok'); } catch (e2) { toast(e2.message, true); }
        return;
      }
      toast(err.message, true);
    }
  };
  wrap.addEventListener('click', e => {
    const el = e.target.closest('[data-fpgo],[data-fppick],[data-fp]');
    if (!el) return;
    if (el.dataset.fpgo) return go(el.dataset.fpgo);
    if (el.dataset.fp === 'up') return st.data && st.data.parent && go(st.data.parent);
    if (el.dataset.fp === 'home') return go('');
    if (el.dataset.fppick) { st.pick = st.pick === el.dataset.fppick ? null : el.dataset.fppick; draw(); }
  });
  wrap.addEventListener('dblclick', e => { const r = e.target.closest('[data-fppick]'); if (r) go(r.dataset.fppick); });
  $w('#fpQ').oninput = e => { st.q = e.target.value; draw(); };
  $w('#fpDot').onchange = e => { st.dot = e.target.checked; go(st.data ? st.data.dir : ''); };
  $w('#fpPath').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(e.target.value.trim()); } };
  wrap.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && st.data && st.data.parent) { e.preventDefault(); go(st.data.parent); }
  });
  wrap.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const p = target();
    if (!p) return;
    try {
      await api('/api/projects', { method: 'POST', body: { path: p } });
      await loadOverview();
      close();
      state.project = p; closeChat(); renderSidebar(); filesCtx(); render();
      toast(tr('app.fp.openedName', { name: projName(p) }), 'ok');
    } catch (err) { toast(err.message, true); }
  });
  go(st.dir);
}

// ---------- language switch in place (i18n.setLang → 'langchange') ----------
// Labels captured in constants at load are rebuilt, then everything visible is re-rendered with the user's
// in-progress state kept (draft, attachments, scroll, live text, unsaved file).
function relabelConstants() {
  for (const k of Object.keys(STATUS)) STATUS[k].label = tr('app.status.' + k);
  FAMILIES.find(f => f.key === 'Other').label = tr('app.usage.familyOther');
  const perm = { default: 'default', '': 'default', auto: 'auto', acceptEdits: 'acceptEdits', plan: 'plan', bypassPermissions: 'bypass', dontAsk: 'dontAsk' };
  for (const [k, key] of Object.entries(perm)) PERM_MODES[k][0] = tr('app.perm.' + key);
  RL_WINDOWS[0][1] = tr('app.rl.short5h'); RL_WINDOWS[0][2] = tr('app.rl.fiveHour');
  RL_WINDOWS[1][1] = tr('app.rl.short7d'); RL_WINDOWS[1][2] = tr('app.rl.weekly');
  for (const k of Object.keys(SKILL_SRC)) SKILL_SRC[k] = [tr('app.skill.src.' + k), tr('app.skill.src.' + k + 'Tip')];
  for (const r of SKILL_ROLES) r[1] = tr('app.skill.role.' + (r[0] || 'all'));
}
async function rerenderChat() {
  const id = state.openTask, ta = $('#followText'), tl = $('#timeline'), rs = $('#railSearch');
  const keep = { draft: ta ? ta.value : '', att: state.att.chat, live: state.live, rail: rs ? rs.value : '',
    scroll: tl && !atBottom(tl) ? tl.scrollTop : null };
  $('#chat').innerHTML = ''; // the rail head is only built when #chatMain is missing
  await openChat(id, true);
  if (state.openTask !== id) return;
  const ta2 = $('#followText');
  if (ta2 && keep.draft) { ta2.value = keep.draft; ta2.dispatchEvent(new Event('input')); }
  state.att.chat = keep.att; renderAtt('chat');
  if (keep.rail && $('#railSearch')) { $('#railSearch').value = keep.rail; renderRail(); }
  if (keep.live) { state.live = keep.live; renderLive(); }
  if (keep.scroll !== null && $('#timeline')) { $('#timeline').scrollTop = keep.scroll; state.follow = false; }
}
window.addEventListener('langchange', e => {
  relabelConstants();
  if (!state.overview) return;
  renderCliVersion(); applyLayout(); renderWsBtn(); renderRl(); renderStats(); renderSidebar(); render();
  if (!$('#composeOverlay').hidden) { applyComposeAgent(); renderSkillPicker(); renderPluginPicker(); renderAtt('compose'); }
  for (const sel of $$('select')) if (sel._sync) sel._sync();
  if (state.openTask) e.detail.wait.push(rerenderChat());
});

(async function init() {
  try {
    await Promise.all([loadOverview(), loadTasks()]);
    initSeen();
    applyLayout();
    renderWsBtn();
    // navigation via #tab=usage / #chat=<id> / #session=<sessionId> / #theme=dark (theme here is not persisted)
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('tab')) state.tab = h.get('tab');
    if (h.get('project') && state.overview.projects.some(p => p.path === h.get('project'))) state.project = h.get('project');
    if (h.get('theme')) document.documentElement.dataset.theme = h.get('theme');
    render(); renderSidebar(); initFiles();
    if (h.get('chat') || h.get('session') || h.get('s')) openFromHash();
    connectStream();
    setInterval(() => state.tab === 'board' && renderBoard(), 60000);
  } catch (err) { toast(tr('app.init.loadErr', { msg: err.message }), true); }
})();
