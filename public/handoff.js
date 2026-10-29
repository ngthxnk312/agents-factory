'use strict';
// Switch a chat to another agent (e.g. Claude → Antigravity). Sessions are not portable between CLIs, so the server
// starts a new chat with the target agent and sends it a context brief of this one; both chats link to each other.
// Uses app.js globals at call time (state, api, esc, $, modalShell, openChat, agentDef, permInfo, toast, isActive).

function handoffDialog(task) {
  const agents = ((state.overview && state.overview.agents) || []).filter(a => a.key !== (task.agent || 'claude') && a.available !== false);
  if (!agents.length) return toast(t('handoff.noAgents'), 'info');
  const st = { agent: agents[0].key };
  const { wrap, close } = modalShell(`
    <div class="modal-head"><h2>⇄ ${esc(t('handoff.title'))}</h2><button type="button" class="icon-btn" data-x aria-label="${esc(t('handoff.close'))}">✕</button></div>
    <p class="hint">${esc(t('handoff.explain', { from: agentDef(task.agent).label }))}</p>
    <div class="field"><span>${esc(t('handoff.target'))}</span><div class="chips" id="hoAgents"></div></div>
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
    $w('#hoAgents').innerHTML = agents.map(a => `<button type="button" class="chip agent-chip ${a.key === st.agent ? 'on' : ''}" data-hoagent="${esc(a.key)}" style="--ac:${esc(a.color)}" data-noicon>${esc(a.icon)} ${esc(a.label)}</button>`).join('');
    const ag = agentDef(st.agent);
    $w('#hoModel').innerHTML = `<option value="">${esc(t('handoff.defaultModel'))}</option>` + (ag.models || []).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
    const modes = ag.modes && ag.modes.length ? ag.modes : [''];
    $w('#hoMode').innerHTML = modes.map(m => `<option value="${esc(m)}" ${m === (task.permissionMode || '') ? 'selected' : ''}>${esc(permInfo(m)[0])}</option>`).join('');
    for (const s of wrap.querySelectorAll('select')) if (s._sync) s._sync();
  };
  wrap.addEventListener('click', e => { const b = e.target.closest('[data-hoagent]'); if (b) { st.agent = b.dataset.hoagent; draw(); } });
  wrap.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const nt = await api(`/api/tasks/${task.id}/handoff`, { method: 'POST', body: { agent: st.agent, model: $w('#hoModel').value, permissionMode: $w('#hoMode').value, note: $w('#hoNote').value } });
      close();
      state.tasks.set(nt.id, nt);
      toast(t('handoff.done', { agent: agentDef(st.agent).label }), 'ok');
      openChat(nt.id);
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
