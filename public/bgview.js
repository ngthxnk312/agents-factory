'use strict';
// Background agents: Claude Code sessions running in the background (claude --bg / terminal sessions sent to background).
// List + live view like watching a terminal (reads session files only, never interferes with the agent).

const bg = { agents: {}, at: 0, viewer: null };
const BG_STATE = { working: [t('bgview.state.working'), 'run'], busy: [t('bgview.state.working'), 'run'], blocked: [t('bgview.state.blocked'), 'wait'], done: [t('bgview.state.done'), 'ok'], idle: [t('bgview.state.idle'), 'idle'] };
window.addEventListener('langchange', () => {
  for (const [k, key] of [['working', 'working'], ['busy', 'working'], ['blocked', 'blocked'], ['done', 'done'], ['idle', 'idle']]) BG_STATE[k][0] = t('bgview.state.' + key);
  if (bg.listEl) drawBgList();
});
const bgState = a => BG_STATE[a.state] || BG_STATE[a.status] || [a.state || a.status || '?', 'idle'];
const bgWorking = a => a.state === 'working' || a.status === 'busy';

async function loadBgAgents() {
  try {
    const m = await api('/api/agents');
    bg.agents = Object.fromEntries(Object.entries(m).map(([k, a]) => [k, { ...a, sessionId: a.sessionId || k }]));
    bg.at = Date.now();
  } catch { /* server doesn't support it yet */ }
  try { renderStats(); } catch { /* page not fully loaded yet */ }
  if (bg.listEl) drawBgList();
}
setInterval(loadBgAgents, 15000);

// ---------- list ----------
function openBgList() {
  const { wrap, close } = modalShell(`
    <div class="modal-head"><h2>${esc(t('bgview.list.title'))}</h2><button type="button" class="icon-btn" data-x aria-label="${esc(t('bgview.close'))}">✕</button></div>
    <p class="hint" style="margin:-6px 0 10px">${esc(t('bgview.list.intro'))}</p>
    <div class="bg-list" id="bgList"><div class="empty">${esc(t('bgview.list.loading'))}</div></div>
    <div class="modal-foot" id="bgFoot"></div>`, 'fp-modal');
  bg.listEl = wrap.querySelector('#bgList');
  const obs = new MutationObserver(() => { if (!document.body.contains(wrap)) { bg.listEl = null; obs.disconnect(); } });
  obs.observe(document.body, { childList: true });
  wrap.addEventListener('click', async e => {
    const b = e.target.closest('[data-bgv],[data-bgatt],[data-bghub],[data-bgrm],[data-bgclean]');
    if (b && b.dataset.bgclean !== undefined) return cleanOrphans();
    if (!b) return;
    const a = Object.values(bg.agents).find(x => x.sessionId === (b.dataset.bgv || b.dataset.bgatt || b.dataset.bghub || b.dataset.bgrm));
    if (!a) return toast(t('bgview.toast.notFound'), true);
    try {
      if (b.dataset.bgv) return openBgViewer(a);
      if (b.dataset.bgatt) { await api('/api/terminal', { method: 'POST', body: { path: a.cwd || state.overview.homePath, attachId: a.id } }); return toast(t('bgview.toast.attached')); }
      if (b.dataset.bgrm) return removeAgents([a]);
      if (b.dataset.bghub) { close(); location.hash = '#session=' + a.sessionId; }
    } catch (err) { toast(err.message, true); }
  });
  drawBgList();
  loadBgAgents();
}
// remove a background agent (claude stop if still running, then claude rm). claude rm refuses on its own if there are unpushed commits.
async function removeAgents(list) {
  const working = list.filter(bgWorking);
  const ok = await ui.confirm({ title: list.length === 1 ? t('bgview.remove.titleOne', { name: list[0].name || list[0].id }) : t('bgview.remove.titleMany', { n: list.length }), danger: true, icon: '🗑', okText: t('bgview.remove.ok'),
    message: (working.length ? t('bgview.remove.working', { n: working.length }) + ' ' : '') + t('bgview.remove.message') });
  if (!ok) return;
  let done = 0;
  for (const a of list) {
    try { await api(`/api/agents/${a.id}/rm`, { method: 'POST' }); done++; }
    catch (err) { toast(`${a.name || a.id}: ${err.message}`, true); }
  }
  if (done) toast(t('bgview.remove.done', { n: done }), 'ok');
  await loadBgAgents();
}
function cleanOrphans() {
  const list = Object.values(bg.agents).filter(a => a.hasFile === false && !bgWorking(a));
  if (!list.length) return toast(t('bgview.toast.noOrphans'), 'info');
  removeAgents(list);
}
function drawBgList() {
  const list = Object.values(bg.agents).sort((x, y) => bgWorking(y) - bgWorking(x) || (y.startedAt || 0) - (x.startedAt || 0));
  bg.listEl.innerHTML = list.map(a => {
    const [lbl, cls] = bgState(a);
    return `<div class="bg-item">
      <span class="sdot ${cls}"></span>
      <div class="bg-main"><b>${esc(a.name || a.id)}</b>
        <div class="hint">${esc(a.cwd ? projName(a.cwd) : '')} · <code>${esc(a.id)}</code>${a.startedAt ? ' · ' + esc(t('bgview.list.started', { ago: ago(a.startedAt) })) : ''}</div></div>
      <span class="tag ${cls === 'run' ? 'ok' : cls === 'wait' ? 'warn' : ''}">${esc(lbl)}</span>
      ${a.hasFile === false ? `<span class="hint" title="${esc(t('bgview.list.noFileTip'))}">${esc(t('bgview.list.noFile'))}</span>` : `<button type="button" class="btn sm primary" data-bgv="${esc(a.sessionId)}">${esc(t('bgview.list.watch'))}</button>`}
      <button type="button" class="btn sm ghost" data-bgatt="${esc(a.sessionId)}" title="${esc(t('bgview.list.attachTip', { id: a.id }))}">🖥</button>
      <button type="button" class="btn sm ghost" data-bghub="${esc(a.sessionId)}" title="${esc(t('bgview.list.hubTip'))}">⇄</button>
      <button type="button" class="btn sm ghost danger-ghost" data-bgrm="${esc(a.sessionId)}" title="${esc(t('bgview.list.removeTip', { id: a.id }))}">🗑</button>
    </div>`;
  }).join('') || `<div class="empty">${esc(t('bgview.list.empty'))}</div>`;
  const orphans = list.filter(a => a.hasFile === false && !bgWorking(a)).length;
  const foot = bg.listEl.parentElement.querySelector('#bgFoot');
  if (foot) foot.innerHTML = orphans ? `<span class="hint">${esc(t('bgview.list.orphans', { n: orphans }))}</span><button type="button" class="btn sm danger-solid" data-bgclean>${esc(t('bgview.list.cleanOrphans', { n: orphans }))}</button>` : '';
}

// ---------- live view ----------
function openBgViewer(a) {
  if (bg.viewer) bg.viewer.close();
  const { wrap, close } = modalShell(`
    <div class="modal-head"><h2 class="bgv-title">👁 ${esc(a.name || a.id)}</h2>
      <span class="tag" id="bgvState"></span>
      <button type="button" class="icon-btn" data-x aria-label="${esc(t('bgview.close'))}">✕</button></div>
    <div class="hint bgv-sub">${esc(a.cwd || '')} · <code>${esc(a.id)}</code> · ${esc(t('bgview.viewer.readOnly'))}</div>
    <div class="timeline bgv-tl" id="bgvTl"><div class="empty">${esc(t('bgview.viewer.loading'))}</div></div>
    <div class="bgv-foot"><span id="bgvLive" class="hint"></span>
      <button type="button" class="btn sm ghost" data-bgvatt>${esc(t('bgview.viewer.openTerminal'))}</button>
      <button type="button" class="btn sm primary" data-bgvhub>${esc(t('bgview.viewer.openHub'))}</button></div>`, 'bgv-modal');
  const tl = wrap.querySelector('#bgvTl');
  const v = { a, offset: -1, nodes: new Map(), timer: 0, first: true, follow: true, close: null, lastSize: 0, lastGrow: Date.now() };
  bg.viewer = v;
  tl.addEventListener('scroll', () => { v.follow = tl.scrollHeight - tl.scrollTop - tl.clientHeight < 48; }, { passive: true });
  const stop = () => { clearTimeout(v.timer); if (bg.viewer === v) bg.viewer = null; };
  v.close = () => { stop(); close(); };
  new MutationObserver((_, o) => { if (!document.body.contains(wrap)) { stop(); o.disconnect(); } }).observe(document.body, { childList: true });
  wrap.addEventListener('click', async e => {
    if (e.target.closest('[data-bgvatt]')) { try { await api('/api/terminal', { method: 'POST', body: { path: a.cwd || state.overview.homePath, attachId: a.id } }); toast(t('bgview.toast.terminalOpened')); } catch (err) { toast(err.message, true); } }
    if (e.target.closest('[data-bgvhub]')) { v.close(); location.hash = '#session=' + a.sessionId; }
  });
  const showState = () => {
    const cur = bg.agents[a.sessionId] || a;
    const [lbl, cls] = bgState(cur);
    const st = wrap.querySelector('#bgvState');
    st.className = 'tag ' + (cls === 'run' ? 'ok' : cls === 'wait' ? 'warn' : '');
    st.innerHTML = (cls === 'run' ? '<span class="spin"></span> ' : '') + esc(lbl);
    const live = wrap.querySelector('#bgvLive');
    live.innerHTML = bgWorking(cur) || Date.now() - v.lastGrow < 8000
      ? `<span class="spin"></span> ${esc(t('bgview.viewer.live', { time: new Date().toLocaleTimeString(i18n.locale) }))}`
      : esc(t('bgview.viewer.idle', { ago: ago(v.lastGrow) }));
  };
  const tick = async () => {
    try {
      const r = await api(`/api/sessions/${a.sessionId}/tail?offset=${v.offset}`);
      if (bg.viewer !== v) return;
      if (!r) { tl.innerHTML = `<div class="empty">${esc(t('bgview.viewer.fileNotFound'))}</div>`; return; }
      if (v.first) { tl.innerHTML = ''; v.first = false; }
      if (r.size !== v.lastSize) { v.lastSize = r.size; v.lastGrow = Date.now(); }
      v.offset = r.offset;
      // evNode uses state.toolNodes to match tool results → use a separate map for the viewer
      const keep = state.toolNodes; state.toolNodes = v.nodes;
      const keepAg = state.evAgent; state.evAgent = 'claude'; // background sessions are always Claude Code
      try { for (const ev of r.events) { const n = evNode(ev); if (n) tl.appendChild(n); } } finally { state.toolNodes = keep; state.evAgent = keepAg; }
      if (!tl.children.length) tl.innerHTML = `<div class="empty">${esc(t('bgview.viewer.noContent'))}</div>`;
      if (v.follow) tl.scrollTop = tl.scrollHeight;
      if (Date.now() - bg.at > 5000) loadBgAgents();
      showState();
    } catch (err) {
      // server 404 "session not found" (matches the Vietnamese and English server text)
      if (/kh\u00f4ng th\u1ea5y phi\u00ean|session not found/i.test(err.message)) {
        tl.innerHTML = `<div class="empty">${esc(t('bgview.viewer.fileGone'))}<br><br>${t('bgview.viewer.fileGoneHint', { state: esc(bgState(bg.agents[a.sessionId] || a)[0]), button: `<b>${esc(t('bgview.viewer.openTerminal'))}</b>`, id: esc(a.id) })}</div>`;
        wrap.querySelector('#bgvLive').textContent = t('bgview.viewer.noFile');
        return;
      }
      wrap.querySelector('#bgvLive').textContent = t('bgview.viewer.readError', { error: err.message });
    }
    v.timer = setTimeout(tick, 2000);
  };
  tick();
}

document.addEventListener('click', e => { if (e.target.closest('[data-bglist]')) openBgList(); });
loadBgAgents();
