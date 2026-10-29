'use strict';
// Open in a new page like a real link: Ctrl/⌘/Shift + click, middle click, or right click → "Open in new tab / Copy link" menu.
// Applies to tabs, projects, chat cards, the chat list, past sessions, the usage widget, the logo.

const NAV_SEL = '[data-home],[data-tab],[data-task],[data-opensess],.sess[data-sid],.proj[data-path]';
function navHref(el) {
  const d = el.dataset;
  let h = null;
  if (d.home !== undefined) h = '#tab=dashboard';
  else if (d.tab) h = '#tab=' + d.tab;
  else if (d.task) { const t = state.tasks.get(d.task); h = t ? chatLink(t).replace(/^[^#]*/, '') : '#chat=' + d.task; }
  else if (d.opensess || d.sid) h = '#session=' + (d.opensess || d.sid);
  else if (d.path !== undefined) h = '#tab=' + state.tab + (d.path ? '&project=' + encodeURIComponent(d.path) : '');
  return h && location.origin + location.pathname + h;
}
function navTarget(e) {
  const el = e.target.closest(NAV_SEL);
  // child buttons inside (★, 🗑, Fork…) keep their own behavior
  if (!el) return null;
  const inner = e.target.closest('button, a, input, [data-star], [data-hide]');
  if (inner && inner !== el && el.contains(inner) && !(e.type === 'contextmenu' && !inner.matches(NAV_SEL))) return null;
  return el;
}
const openNewTab = url => window.open(url, '_blank', 'noopener');

document.addEventListener('click', e => {
  if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return;
  const el = navTarget(e);
  const url = el && navHref(el);
  if (!url) return;
  e.preventDefault(); e.stopImmediatePropagation();
  openNewTab(url);
}, true);
document.addEventListener('auxclick', e => {
  if (e.button !== 1) return;
  const el = navTarget(e);
  const url = el && navHref(el);
  if (!url) return;
  e.preventDefault();
  openNewTab(url);
}, true);
// middle click enables autoscroll in some browsers → block it on mousedown
document.addEventListener('mousedown', e => { if (e.button === 1 && navTarget(e)) e.preventDefault(); }, true);

// ---------- context menu: info + actions per item type ----------
const copyText = async (text, what) => {
  try { await navigator.clipboard.writeText(text); toast(t('nav.copy.done', { what }), 'ok'); }
  catch { ui.prompt({ title: t('nav.copy.title', { what }), icon: '🔗', okText: t('nav.copy.close'), input: { value: text } }); }
};
const fmtTime = ts => ts ? new Date(ts).toLocaleString(i18n.locale, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) + ' · ' + ago(ts) : '';
const tokLine = tk => tk ? t('nav.tokLine', { in: fmtTok((tk.in || 0) + (tk.cw || 0)), out: fmtTok(tk.out || 0), cache: fmtTok(tk.cr || 0) }) : '';
async function openSession(id, fork) {
  const t = await api(`/api/sessions/${id}/open`, { method: 'POST', body: { fork: !!fork } });
  state.tasks.set(t.id, t);
  openChat(t.id);
}
async function renameTask(task) {
  const name = await askName(task.title, t('nav.task.renameTitle'));
  if (!name) return;
  const nt = await api(`/api/tasks/${task.id}/rename`, { method: 'POST', body: { name } });
  state.tasks.set(nt.id, { ...task, ...nt });
  if (state.openTask === task.id) { $('#chatHead').innerHTML = chatHead(state.tasks.get(task.id)); setDocTitle(); }
  scheduleRender(); toast(t('nav.toast.renamed'), 'ok');
}
// tabs with a title + description in the context menu (nav.tab.<tab>.title / .sub)
const NAV_TABS = ['dashboard', 'board', 'sessions', 'usage', 'config', 'plugins', 'mcp'];

function ctxItems(el, url) {
  const d = el.dataset;
  const common = [
    { icon: '↗', label: t('nav.common.newTab'), hint: 'Ctrl+click', onClick: () => openNewTab(url) },
    { icon: '🔗', label: t('nav.common.copyLink'), onClick: () => copyText(url, t('nav.what.link')) },
  ];
  // --- chat in Agents Factory
  if (d.task) {
    const task = state.tasks.get(d.task);
    if (!task) return common;
    const st = STATUS[task.status] || {};
    const sid = task.sessionId || task.historySessionId;
    return [
      { info: { title: task.title, sub: task.projectDisplay,
        chips: `<span class="tag ${st.tag || ''}">${esc(st.label || task.status)}</span>${modeChip(task.permissionMode)}${task.fork ? `<span class="tag">${esc(t('nav.task.chipFork'))}</span>` : ''}${task.bgConflict ? `<span class="tag warn">${esc(t('nav.task.chipBg'))}</span>` : ''}`,
        rows: [[t('nav.task.rowAgent'), agentDef(task.agent).label], [t('nav.task.rowModel'), task.activeModel || task.model || t('nav.task.defaultModel')], [t('nav.task.rowSession'), sid, true], [t('nav.task.rowTokens'), tokLine(task.tokens)], [t('nav.task.rowCost'), task.costUsd ? money(task.costUsd) : ''],
          [t('nav.task.rowRuns'), task.runs], [t('nav.task.rowCreated'), fmtTime(task.createdAt)], [t('nav.task.rowUpdated'), fmtTime(task.updatedAt)]] } },
      { icon: '💬', label: t('nav.task.openChat'), onClick: () => openChat(task.id) },
      ...common,
      { divider: true },
      { icon: '✏️', label: t('nav.task.rename'), onClick: () => renameTask(task) },
      sid && { icon: '📋', label: t('nav.task.copySessionId'), hint: sid.slice(0, 8), onClick: () => copyText(sid, t('nav.what.sessionId')) },
      { icon: '📁', label: t('nav.task.copyProjectPath'), onClick: () => copyText(task.projectPath, t('nav.what.path')) },
      sid && { icon: '🖥', label: t('nav.task.openTerminal'), onClick: () => api(`/api/tasks/${task.id}/terminal`, { method: 'POST' }).then(() => toast(t('nav.toast.terminalOpened'))) },
      isActive(task) && { icon: '⏹', label: t('nav.task.stop'), onClick: () => api(`/api/tasks/${task.id}/stop`, { method: 'POST' }).then(() => toast(t('nav.toast.stopSent'))) },
      { divider: true },
      { icon: '🗑', label: t('nav.task.remove'), danger: true, onClick: async () => {
        if (!(await ui.confirm({ title: t('nav.task.removeTitle'), danger: true, okText: t('nav.task.removeOk'), icon: '🗑', message: t('nav.task.removeMessage') }))) return;
        await api('/api/tasks/' + task.id, { method: 'DELETE' });
        state.tasks.delete(task.id); if (state.openTask === task.id) closeChat(); render(); renderSidebar();
      } },
    ].filter(Boolean);
  }
  // --- past session
  if (d.opensess || d.sid) {
    const sid = d.opensess || d.sid;
    const s = (state.sessions && state.sessions.sessions.find(x => x.id === sid)) || (state.usage && state.usage.topSessions.find(x => x.id === sid));
    if (!s) return common;
    return [
      { info: { title: s.title, sub: s.projectDisplay || s.cwd,
        chips: `${s.inHub ? `<span class="tag ok">${esc(t('nav.sess.chipInHub'))}</span>` : ''}${s.bg ? `<span class="tag warn">${esc(t('nav.sess.chipBg', { state: s.bg.state || '' }))}</span>` : ''}${s.recentlyActive && !s.inHub ? `<span class="tag warn">${esc(t('nav.sess.chipRecent'))}</span>` : ''}${s.renamed ? `<span class="tag">${esc(t('nav.sess.chipRenamed'))}</span>` : ''}${Object.keys(s.models || {}).map(m => `<span class="tag">${esc(m)}</span>`).join('')}`,
        rows: [[t('nav.sess.rowId'), s.id, true], [t('nav.sess.rowPrompts'), s.prompts], [t('nav.sess.rowTokens'), tokLine(s.tokens)], [t('nav.sess.rowCost'), s.cost ? money(s.cost) : ''], [t('nav.sess.rowSize'), s.size ? fmtSize(s.size) : ''],
          [t('nav.sess.rowStarted'), fmtTime(s.firstAt)], [t('nav.sess.rowLastActive'), fmtTime(s.lastAt)], [t('nav.sess.rowFirstPrompt'), (s.firstPrompt || '').slice(0, 120)]] } },
      { icon: '💬', label: t('nav.sess.openChat'), onClick: () => openSession(s.id) },
      ...common,
      { icon: '⑂', label: t('nav.sess.fork'), hint: t('nav.sess.forkHint'), onClick: () => openSession(s.id, true) },
      { divider: true },
      { icon: '✏️', label: t('nav.sess.rename'), onClick: async () => {
        const name = await askName(s.title, t('nav.sess.renameTitle'), s.renamed);
        if (name === null) return;
        await api(`/api/sessions/${s.id}/rename`, { method: 'POST', body: { name } }); toast(t('nav.toast.renamed'), 'ok');
      } },
      { icon: '📋', label: t('nav.sess.copySessionId'), hint: s.id.slice(0, 8), onClick: () => copyText(s.id, t('nav.what.sessionId')) },
      { icon: '📋', label: t('nav.sess.copyResume'), hint: s.agent === 'agy' ? 'agy --conversation' : s.agent === 'codex' ? 'codex resume' : s.agent === 'gemini' ? 'gemini --resume' : 'claude --resume',
        onClick: () => {
          const rcmd = s.agent === 'agy' ? `agy --conversation ${s.id}` : s.agent === 'codex' ? `codex resume ${s.id}` : s.agent === 'gemini' ? `gemini --resume ${s.id}` : `claude --resume ${s.id}`;
          copyText(`cd "${s.cwd}" && ${rcmd}`, t('nav.what.command'));
        } },
      { icon: '🖥', label: t('nav.sess.openTerminal'), onClick: () => api('/api/terminal', { method: 'POST', body: { path: s.cwd, sessionId: s.id } }).then(() => toast(t('nav.toast.sessionTerminalOpened'))) },
      { divider: true },
      { icon: '🗑', label: t('nav.sess.delete'), danger: true, onClick: () => state.sessions ? deleteSessionsUI([s.id]) : toast(t('nav.sess.deleteFromTab'), 'info') },
    ];
  }
  // --- project in the left column
  if (d.path !== undefined && el.classList.contains('proj')) {
    if (!d.path) return [{ info: { title: t('nav.proj.allTitle'), sub: (curWs() ? t('nav.proj.workspace', { name: curWs().name }) : t('nav.proj.allWorkspaces')), rows: [[t('nav.proj.rowCount'), scopedProjects().length]] } }, ...common];
    const p = state.overview.projects.find(x => x.path === d.path);
    if (!p) return common;
    const ts = [...state.tasks.values()].filter(x => x.projectPath === p.path);
    return [
      { info: { title: projName(p.path), sub: p.display,
        chips: `${p.favorite ? `<span class="tag warn">${esc(t('nav.proj.chipPinned'))}</span>` : ''}${p.branch ? `<span class="tag git">⎇ ${esc(p.branch)}</span>` : ''}${p.hasClaudeMd ? `<span class="tag">${esc(p.ruleFile || 'AGENTS.md')}</span>` : ''}`,
        rows: [[t('nav.proj.rowModel'), p.model || t('nav.proj.defaultModel')], [t('nav.proj.rowMcp'), p.mcpCount], [t('nav.proj.rowPlugins'), p.pluginCount], [t('nav.proj.rowChats'), ts.length], [t('nav.proj.rowRunning'), ts.filter(isActive).length || '']] } },
      { icon: '📁', label: t('nav.proj.view'), onClick: () => { state.project = p.path; closeChat(); renderSidebar(); filesCtx(); render(); } },
      ...common,
      { icon: '🚀', label: t('nav.proj.compose'), onClick: () => openCompose({ projects: [p.path] }) },
      { icon: '📂', label: t('nav.proj.files'), onClick: () => { toggleFiles('on'); setRoot(p.path); } },
      { icon: '🖥', label: t('nav.proj.terminal'), onClick: () => api('/api/terminal', { method: 'POST', body: { path: p.path } }).then(() => toast(t('nav.toast.terminalOpened'))) },
      { divider: true },
      { icon: p.favorite ? '☆' : '★', label: p.favorite ? t('nav.proj.unpin') : t('nav.proj.pin'), onClick: () => api('/api/projects', { method: 'POST', body: { path: p.path, action: 'favorite' } }).then(loadOverview) },
      { icon: '📋', label: t('nav.proj.copyPath'), onClick: () => copyText(p.path, t('nav.what.path')) },
      { icon: '🗂', label: t('nav.proj.remove'), danger: true, onClick: () => el.querySelector('[data-hide]') ? el.querySelector('[data-hide]').click() : null },
    ];
  }
  // --- usage widget
  if (d.tab === 'usage' && el.closest('#rlBox, .rl-group')) {
    const rows = RL_WINDOWS.map(([k, , label]) => {
      const r = rlInfo(k);
      return [label, !r ? '—' : r.expired ? t('nav.usage.reset') : t('nav.usage.resetsIn', { pct: r.pct, until: untilShort(r.reset), at: new Date(r.reset).toLocaleString(i18n.locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) })];
    });
    if (state.rateLimit) rows.push([t('nav.usage.updated'), agoEn(state.rateLimit.at)]);
    return [{ info: { title: t('nav.usage.title'), rows } }, { icon: '📊', label: t('nav.usage.openTab'), onClick: () => el.click() }, ...common];
  }
  // --- tab
  if (d.tab) {
    const [title, sub] = NAV_TABS.includes(d.tab) ? [t(`nav.tab.${d.tab}.title`), t(`nav.tab.${d.tab}.sub`)] : [d.tab, ''];
    return [{ info: { title, sub } }, { icon: '↪', label: t('nav.tab.open'), onClick: () => el.click() }, ...common];
  }
  if (d.home !== undefined) return [{ info: { title: 'Agents Factory', sub: $('#cliVersion').textContent } }, { icon: '🏠', label: t('nav.home.go'), onClick: () => goHome() }, ...common];
  return common;
}

document.addEventListener('contextmenu', e => {
  if (e.shiftKey) return; // Shift + right click = the browser's native menu
  const el = navTarget(e);
  const url = el && navHref(el);
  if (!url) return;
  e.preventDefault();
  document.querySelectorAll('.ctx-anchor').forEach(x => x.remove());
  const a = document.createElement('div'); a.className = 'ctx-anchor'; a.tabIndex = -1;
  a.style.left = e.clientX + 'px'; a.style.top = (e.clientY - 6) + 'px';
  document.body.appendChild(a);
  ui.menu(a, ctxItems(el, url).map(it => it.onClick ? { ...it, onClick: () => Promise.resolve(it.onClick()).catch(err => toast(err.message, true)) } : it));
});
