'use strict';
// Switch the agent of the open chat (e.g. Claude → Antigravity) without leaving it. Sessions are not portable between
// CLIs, so the new agent starts a fresh session and gets a context brief of the chat — or nothing, when the user clears
// the context. Picking the current agent with "clear" is a /clear that keeps the same chat.
// Uses app.js globals at call time (state, api, esc, $, modalShell, openChat, agentDef, permInfo, toast, isActive).

function handoffDialog(task) {
  const cur = task.agent || 'claude';
  const agents = ((state.overview && state.overview.agents) || []).filter(a => a.available !== false);
  if (!agents.length) return toast(t('handoff.noAgents'), 'info');
  const st = { agent: (agents.find(a => a.key !== cur) || agents[0]).key, clear: false };
  const { wrap, close } = modalShell(`
    <div class="modal-head"><h2>⇄ ${esc(t('handoff.title'))}</h2><button type="button" class="icon-btn" data-x aria-label="${esc(t('handoff.close'))}">✕</button></div>
    <p class="hint">${esc(t('handoff.explain', { from: agentDef(task.agent).label }))}</p>
    <div class="field"><span>${esc(t('handoff.target'))}</span><div class="chips" id="hoAgents"></div></div>
    <div class="field"><span>${esc(t('handoff.context'))}</span><div class="chips" id="hoCtx"></div></div>
    <div class="grid3">
      <label class="field"><span>${esc(t('handoff.model'))}</span><select id="hoModel"></select></label>
      <label class="field"><span>${esc(t('handoff.mode'))}</span><select id="hoMode"></select></label>
    </div>
    <label class="field"><span>${esc(t('handoff.note'))}</span>
      <textarea id="hoNote" rows="3" placeholder="${esc(t('handoff.notePlaceholder'))}"></textarea></label>
    <div class="modal-foot">
      <span class="hint">${esc(t('handoff.foot'))}</span>
      <button type="button" class="btn ghost" data-x>${esc(t('handoff.cancel'))}</button>
      <button type="submit" class="btn primary">⇄ ${esc(t('handoff.submit'))}</button>
    </div>`, 'ho-modal');
  const $w = s => wrap.querySelector(s);
  const draw = () => {
    $w('#hoAgents').innerHTML = agents.map(a => `<button type="button" class="chip agent-chip ${a.key === st.agent ? 'on' : ''}" data-hoagent="${esc(a.key)}" style="--ac:${esc(a.color)}" data-noicon>${esc(a.icon)} ${esc(a.label)}${a.key === cur ? ' · ' + esc(t('handoff.current')) : ''}</button>`).join('');
    const same = st.agent === cur; // same agent → only "clear" makes sense
    if (same) st.clear = true;
    $w('#hoCtx').innerHTML = [[false, 'handoff.keep'], [true, 'handoff.clear']].map(([v, k]) =>
      `<button type="button" class="chip ${st.clear === v ? 'on' : ''}" data-hoclear="${v}" ${same && !v ? 'disabled' : ''} title="${esc(t(k + 'Tip'))}">${esc(t(k))}</button>`).join('');
    $w('.modal-foot .hint').textContent = t(st.clear ? 'handoff.footClear' : 'handoff.foot');
    $w('#hoNote').placeholder = t(st.clear ? 'handoff.notePlaceholderClear' : 'handoff.notePlaceholder');
    $w('.modal-foot .primary').textContent = (same ? '↺ ' : '⇄ ') + t(same ? 'handoff.submitClear' : 'handoff.submit');
    const ag = agentDef(st.agent);
    $w('#hoModel').innerHTML = `<option value="">${esc(t('handoff.defaultModel'))}</option>` + (ag.models || []).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
    const modes = ag.modes && ag.modes.length ? ag.modes : [''];
    if (same && task.model) $w('#hoModel').value = task.model;
    $w('#hoMode').innerHTML = modes.map(m => `<option value="${esc(m)}" ${m === (task.permissionMode || '') ? 'selected' : ''}>${esc(permInfo(m)[0])}</option>`).join('');
    for (const s of wrap.querySelectorAll('select')) if (s._sync) s._sync();
  };
  wrap.addEventListener('click', e => {
    const b = e.target.closest('[data-hoagent]');
    if (b) { st.agent = b.dataset.hoagent; st.clear = false; return draw(); }
    const c = e.target.closest('[data-hoclear]');
    if (c && !c.disabled) { st.clear = c.dataset.hoclear === 'true'; draw(); }
  });
  wrap.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const nt = await api(`/api/tasks/${task.id}/handoff`, { method: 'POST', body: { agent: st.agent, clear: st.clear, model: $w('#hoModel').value, permissionMode: $w('#hoMode').value, note: $w('#hoNote').value } });
      close();
      state.tasks.set(nt.id, nt);
      toast(t(st.agent === cur ? 'handoff.doneClear' : 'handoff.done', { agent: agentDef(st.agent).label }), 'ok');
    } catch (err) { toast(err.message, true); }
  });
  draw();
}

// Button + link bar in the chat header (added without touching app.js templates)
function decorateChatHead() {
  const head = document.getElementById('chatHead');
  if (!head || !state.openTask) return;
  const task = state.tasks.get(state.openTask);
  if (!task) return;
  if (!head.querySelector('[data-handoff]')) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn sm ghost'; b.dataset.handoff = '';
    b.title = t('handoff.buttonTip');
    b.textContent = '⇄ ' + t('handoff.button');
    const del = head.querySelector('[data-del]');
    del ? head.insertBefore(b, del) : head.appendChild(b);
  }
  const links = [];
  if (task.handoffFrom && state.tasks.has(task.handoffFrom)) links.push(`<button type="button" class="tag ho-link" data-task="${esc(task.handoffFrom)}">↩ ${esc(t('handoff.from', { agent: agentDef(state.tasks.get(task.handoffFrom).agent).label }))}</button>`);
  if (task.handoffTo && state.tasks.has(task.handoffTo)) links.push(`<button type="button" class="tag ho-link" data-task="${esc(task.handoffTo)}">↪ ${esc(t('handoff.to', { agent: agentDef(state.tasks.get(task.handoffTo).agent).label }))}</button>`);
  let bar = head.querySelector('.ho-links');
  if (links.length) {
    if (!bar) { bar = document.createElement('div'); bar.className = 'ho-links'; head.appendChild(bar); }
    bar.innerHTML = links.join('');
  } else if (bar) bar.remove();
}

document.addEventListener('click', e => {
  if (!e.target.closest('[data-handoff]')) return;
  const task = state.tasks.get(state.openTask);
  if (!task) return;
  if (isActive(task)) return toast(t('handoff.busy'), true);
  handoffDialog(task);
});
let hoRaf = 0;
new MutationObserver(() => { if (!hoRaf) hoRaf = requestAnimationFrame(() => { hoRaf = 0; decorateChatHead(); }); })
  .observe(document.body, { childList: true, subtree: true });
