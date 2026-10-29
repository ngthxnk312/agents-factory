'use strict';
// "/" commands in the chat input like the terminal: type / to show the list (CLI commands, skills, plugins, project commands).
// Some commands are handled by Agents Factory itself (stop, terminal, rename, change model…); the rest are sent verbatim to Claude Code.

const HUB_CMDS = Object.fromEntries(['stop', 'rename', 'model', 'terminal', 'files', 'new', 'help'].map(k => [k, t('slash.hub.' + k)]));
const CMD_DESC = Object.fromEntries([
  'compact', 'clear', 'context', 'usage', 'cost', 'init', 'review', 'code-review', 'security-review', 'simplify',
  'recap', 'insights', 'effort', 'debug', 'mcp', 'agents', 'config', 'doctor', 'output-style',
  'loop', 'schedule', 'reload-plugins', 'reload-skills', 'autocompact', 'fast', 'goal', 'batch',
].map(k => [k, t('slash.cmd.' + k)]));
// commands that need the terminal's interactive UI — suggest opening 🖥 Terminal
const TTY_ONLY = new Set(['config', 'mcp', 'agents', 'doctor', 'color', 'output-style', 'focus', 'heapdump', 'import', 'team-onboarding', 'auto-mode-setup', 'list-agents']);

const slash = { list: [], project: null, pick: 0, shown: [] };
async function loadSlash(project) {
  const ag = (state.tasks.get(state.openTask) || {}).agent || 'claude';
  const key = project + '|' + ag;
  if (slash.project === key && slash.list.length) return;
  slash.project = key;
  let cli = [];
  // CLI / commands only work with Claude Code; other agents only get Agents Factory commands
  if (ag === 'claude') {
    try { cli = (await api('/api/commands?project=' + encodeURIComponent(project || ''))).commands; } catch { /* not available yet */ }
    if (!cli.length) cli = Object.keys(CMD_DESC);
  }
  const hub = Object.entries(HUB_CMDS).map(([name, desc]) => ({ name, desc, hub: true }));
  // Agents Factory SDLC skills — usable with any agent: /ideate <request>
  const skills = (await loadSkillList(project || '')).map(k => ({ name: k.name, desc: `${k.icon} ${k.use && k.use !== k.name ? '→ ' + k.use + ' (' + k.source + ') · ' : ''}${k.description}`, skill: true }));
  slash.list = hub.concat(skills, cli.filter(n => !HUB_CMDS[n] && !n.startsWith('__') && !skills.some(k => k.name === n)).map(name => ({
    name, desc: CMD_DESC[name] || (name.includes(':') ? t('slash.list.pluginSkill', { plugin: name.split(':')[0] }) : t('slash.list.command')), tty: TTY_ONLY.has(name),
  })));
}

function slashQuery(ta) {
  const m = /^\/([^\s]*)$/.exec(ta.value.slice(0, ta.selectionStart));
  return m && !ta.value.slice(ta.selectionStart).includes('\n') ? m[1].toLowerCase() : null;
}
function slashUpdate(ta) {
  const pop = $('#slashPop');
  if (!pop) return;
  const q = slashQuery(ta);
  if (q === null) return slashClose();
  const starts = slash.list.filter(c => c.name.toLowerCase().startsWith(q));
  const has = slash.list.filter(c => !starts.includes(c) && c.name.toLowerCase().includes(q));
  slash.shown = starts.concat(has).slice(0, 40);
  if (!slash.shown.length) return slashClose();
  slash.pick = Math.min(slash.pick, slash.shown.length - 1);
  pop.hidden = false;
  pop.innerHTML = `<div class="sp-head">${esc(t('slash.pop.title'))} <kbd>↑↓</kbd> ${esc(t('slash.pop.select'))} <kbd>Tab</kbd> ${esc(t('slash.pop.fill'))} <kbd>Enter</kbd> ${esc(t('slash.pop.run'))} <kbd>Esc</kbd> ${esc(t('slash.pop.close'))}</div>` + slash.shown.map((c, i) => `
    <div class="sp-item ${i === slash.pick ? 'on' : ''}" data-slash="${esc(c.name)}" role="option" aria-selected="${i === slash.pick}">
      <span class="sp-name">/${esc(c.name)}</span>
      ${c.skill ? '<span class="tag skill-tag">SDLC</span>' : c.hub ? '<span class="tag coral">Hub</span>' : c.tty ? `<span class="tag warn" title="${esc(t('slash.pop.ttyTip'))}">${esc(t('slash.pop.ttyTag'))}</span>` : ''}
      <span class="sp-desc">${esc(c.desc)}</span>
    </div>`).join('');
  const on = pop.querySelector('.sp-item.on');
  if (on) on.scrollIntoView({ block: 'nearest' });
}
function slashClose() { const p = $('#slashPop'); if (p) { p.hidden = true; p.innerHTML = ''; } slash.shown = []; slash.pick = 0; }
function slashFill(name) {
  const ta = $('#followText');
  ta.value = '/' + name + ' ' + ta.value.slice(ta.selectionStart).replace(/^\S*\s?/, '');
  ta.setSelectionRange(name.length + 2, name.length + 2);
  slashClose();
  ta.focus();
  autoGrow(ta);
}

// Agents Factory runs its own commands; returns true if handled
async function runHubCommand(text) {
  const m = /^\/(\S+)\s*([\s\S]*)$/.exec(text.trim());
  if (!m || !HUB_CMDS[m[1]]) return false;
  const [, name, arg] = m;
  const task = state.tasks.get(state.openTask);
  switch (name) {
    case 'stop': await api(`/api/tasks/${task.id}/stop`, { method: 'POST' }); toast(t('slash.toast.stopSent')); break;
    case 'terminal': await api(`/api/tasks/${task.id}/terminal`, { method: 'POST' }); toast(t('slash.toast.terminalOpened')); break;
    case 'files': toggleFiles(); break;
    case 'new': openCompose({ projects: [task.projectPath] }); break;
    case 'help': { const ta = $('#followText'); ta.value = '/'; ta.setSelectionRange(1, 1); slashUpdate(ta); return 'keep'; }
    case 'rename': {
      if (!arg.trim()) { $('[data-renchat]') && $('[data-renchat]').click(); break; }
      const nt = await api(`/api/tasks/${task.id}/rename`, { method: 'POST', body: { name: arg.trim() } });
      state.tasks.set(nt.id, { ...task, ...nt }); $('#chatHead').innerHTML = chatHead(state.tasks.get(nt.id)); setDocTitle();
      toast(t('slash.toast.renamed'), 'ok'); break;
    }
    case 'model': {
      const sel = $('#chatModel');
      const v = arg.trim().toLowerCase();
      const opt = [...sel.options].find(o => o.value === v || (v === 'default' && o.value === ''));
      if (!opt) { toast(t('slash.toast.badModel', { list: [...sel.options].map(o => o.value || 'default').join(', ') }), true); return 'keep'; }
      sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
      toast(t('slash.toast.modelSet', { model: opt.textContent.replace(/^\S+\s/, '') }), 'ok'); break;
    }
  }
  return true;
}

document.addEventListener('input', e => {
  if (e.target.id !== 'followText') return;
  slash.pick = 0;
  const t = state.tasks.get(state.openTask);
  if (slashQuery(e.target) !== null && t && slash.project !== t.projectPath + '|' + (t.agent || 'claude')) loadSlash(t.projectPath).then(() => slashUpdate(e.target));
  else slashUpdate(e.target);
});
document.addEventListener('click', e => {
  const it = e.target.closest('[data-slash]');
  if (it) { e.preventDefault(); return slashFill(it.dataset.slash); }
  if (!e.target.closest('#slashPop, #followText')) slashClose();
});
document.addEventListener('focusin', e => {
  if (e.target.id === 'followText') { const t = state.tasks.get(state.openTask); if (t) loadSlash(t.projectPath); }
});
// capture keys before the shared handler (Enter sends, ↑ recalls the previous message)
document.addEventListener('keydown', e => {
  if (!slash.shown.length || document.activeElement.id !== 'followText') return;
  const n = slash.shown.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); e.stopPropagation();
    slash.pick = (slash.pick + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
    return slashUpdate(document.activeElement);
  }
  if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); return slashFill(slash.shown[slash.pick].name); }
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return slashClose(); }
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    const c = slash.shown[slash.pick];
    const typed = slashQuery(document.activeElement);
    // commands needing arguments are prefilled; others run immediately like the terminal
    if (typed !== c.name.toLowerCase() || c.name === 'rename' || c.name === 'model' || c.skill) {
      e.preventDefault(); e.stopPropagation();
      if (c.name !== 'rename' && c.name !== 'model' && !c.tty && !c.skill) { document.activeElement.value = '/' + c.name; slashClose(); return sendChat(); }
      return slashFill(c.name);
    }
    slashClose();
  }
}, true);
