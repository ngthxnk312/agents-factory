'use strict';
// Right-hand File panel: directory tree of the current project (by chat / project / workspace), view & edit files inside Agents Factory.
// Shares state, api, esc, toast, $… from app.js.

const fx = {
  root: '',          // project being browsed
  manual: false,     // user picked another project in the selector → stop following the chat until the context changes
  dirs: new Map(),   // relative dir → entries
  open: new Set(['']),
  filter: '',
  file: null,        // { path, text, mtime, image, binary, tooBig, size }
  dirty: false,
  stale: false,      // file changed on disk while being edited
  preview: false,
};
const FX_MAX_ROWS = 4000;
// language switched in place → redraw the panel, keeping unsaved text in the editor
window.addEventListener('langchange', () => {
  filesBtn();
  if (layout.files === 'off' || !$('#fxEditor')) return;
  const ta = $('#fxText');
  const st = ta ? { v: ta.value, s: ta.scrollTop, a: ta.selectionStart, b: ta.selectionEnd } : null;
  renderFiles();
  const t2 = $('#fxText');
  if (st && t2) { t2.value = st.v; t2.scrollTop = st.s; t2.setSelectionRange(st.a, st.b); }
});
const fxKey = (root, rel) => root + '\u0000' + rel;

// project to show: open chat → its project; else the project selected in the left column; else the workspace's first project
function fxContextRoot() {
  const t = state.openTask && state.tasks.get(state.openTask);
  if (t) return t.projectPath;
  if (state.project) return state.project;
  const list = scopedProjects();
  return list.length ? list[0].path : '';
}
function filesCtx() {
  if (layout.files === 'off') return;
  const r = fxContextRoot();
  if (!r || r === fx.root) return;
  if (fx.dirty) return; // don't switch automatically while editing
  setRoot(r);
}
function setRoot(r) {
  fx.root = r; fx.dirs.clear(); fx.open = new Set(['']); fx.file = null; fx.dirty = false; fx.stale = false;
  document.body.dataset.files = layout.files === 'off' ? 'off' : 'tree';
  renderFiles();
  loadDir('');
}

async function loadDir(dir) {
  if (!fx.root) return;
  const root = fx.root;
  try {
    const r = await api(`/api/fs/list?root=${encodeURIComponent(root)}&dir=${encodeURIComponent(dir)}`);
    if (root !== fx.root) return;
    fx.dirs.set(dir, r.entries);
    drawTree();
  } catch (err) {
    if (dir === '') { fx.dirs.set('', []); drawTree(err.message); }
    else { fx.open.delete(dir); toast(err.message, true); }
  }
}

function renderFiles() {
  const el = $('#files');
  if (!el) return;
  const projects = scopedProjects();
  const opts = projects.some(p => p.path === fx.root) || !fx.root ? projects : [{ path: fx.root, display: fx.root }, ...projects];
  el.innerHTML = `
    <div class="fx-tree">
      <div class="fx-head">
        <b>${esc(t('files.tree.heading'))}</b>
        <button class="icon-btn sm" data-fx="newfile" title="${esc(t('files.tree.newFileTip'))}">＋</button>
        <button class="icon-btn sm" data-fx="refresh" title="${esc(t('files.tree.refreshTip'))}">🔄</button>
        <button class="icon-btn sm" data-fx="toggle" title="${esc(t('files.panel.collapseTip'))}">${fxIconHtml('panel-open', 'c-teal')}</button>
      </div>
      <select id="fxRoot" aria-label="${esc(t('files.tree.projectLabel'))}">${opts.map(p => `<option value="${esc(p.path)}" ${p.path === fx.root ? 'selected' : ''}>${esc(projName(p.path))}</option>`).join('')}</select>
      <input class="input" id="fxFilter" placeholder="${esc(t('files.tree.filterPlaceholder'))}" value="${esc(fx.filter)}" autocomplete="off">
      <div class="fx-list" id="fxList" role="tree"></div>
    </div>
    <div class="fx-editor" id="fxEditor"></div>`;
  $('#fxRoot').onchange = e => { fx.manual = true; if (fx.dirty) return guardDirty().then(ok => ok ? setRoot(e.target.value) : renderFiles()); setRoot(e.target.value); };
  $('#fxFilter').oninput = e => { fx.filter = e.target.value; drawTree(); };
  drawTree();
  drawEditor();
}
function fxIconHtml(name, cls) { return `<svg class="svg-i${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`; }

function fileIcon(name) {
  if (/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(name)) return fxIconHtml('image');
  if (/\.(md|txt|rst|log)$/i.test(name)) return fxIconHtml('file-text');
  if (/\.(js|mjs|cjs|ts|tsx|jsx|java|kt|py|go|rs|c|cpp|h|cs|php|rb|sh|sql|json|ya?ml|xml|html|css|scss|vue|svelte|toml|gradle|properties)$/i.test(name)) return fxIconHtml('file-code');
  return fxIconHtml('file');
}
function drawTree(errMsg) {
  const list = $('#fxList');
  if (!list) return;
  if (!fx.root) { list.innerHTML = `<div class="empty">${esc(t('files.tree.pickProject'))}</div>`; return; }
  if (errMsg) { list.innerHTML = `<div class="empty">${esc(errMsg)}</div>`; return; }
  if (!fx.dirs.has('')) { list.innerHTML = `<div class="empty">${esc(t('files.tree.loadingDir'))}</div>`; return; }
  const q = fx.filter.trim().toLowerCase();
  const rows = [];
  // when filtering: only show files/folders matching the name (and their parent folders) among those loaded
  const matchCache = new Map();
  const hasMatch = (dir) => {
    if (matchCache.has(dir)) return matchCache.get(dir);
    const ents = fx.dirs.get(dir) || [];
    const ok = ents.some(e => e.name.toLowerCase().includes(q) || (e.dir && fx.dirs.has(join(dir, e.name)) && hasMatch(join(dir, e.name))));
    matchCache.set(dir, ok);
    return ok;
  };
  const walk = (dir, depth) => {
    for (const e of fx.dirs.get(dir) || []) {
      if (rows.length > FX_MAX_ROWS) return;
      const rel = join(dir, e.name);
      if (q && !e.name.toLowerCase().includes(q) && !(e.dir && fx.dirs.has(rel) && hasMatch(rel))) continue;
      const open = e.dir && (fx.open.has(rel) || (q && fx.dirs.has(rel)));
      const sel = fx.file && fx.file.path === rel;
      rows.push(`<div class="fx-row ${e.dir ? 'dir' : 'file'} ${sel ? 'sel' : ''} ${e.name.startsWith('.') ? 'fx-hid' : ''}" role="treeitem" tabindex="-1"
        ${e.dir ? `data-fxdir="${esc(rel)}" aria-expanded="${open ? 'true' : 'false'}"` : `data-fxfile="${esc(rel)}"`} style="--d:${depth}" title="${esc(rel)}${e.dir ? '' : ' · ' + fmtSize(e.size)}">
        <span class="fx-caret">${e.dir ? fxIconHtml('chevron-right') : ''}</span>
        ${e.dir ? fxIconHtml(open ? 'folder-open' : 'folder', 'c-sky') : fileIcon(e.name)}
        <span class="fx-name">${esc(e.name)}</span>${e.link ? '<span class="fx-link">↪</span>' : ''}
      </div>`);
      if (open) {
        if (fx.dirs.has(rel)) walk(rel, depth + 1);
        else rows.push(`<div class="fx-row muted" style="--d:${depth + 1}">${esc(t('files.tree.loading'))}</div>`);
      }
    }
  };
  walk('', 0);
  list.innerHTML = rows.join('') || `<div class="empty">${esc(q ? t('files.tree.noMatch') : t('files.tree.emptyDir'))}</div>`;
}
const join = (a, b) => (a ? a + '/' + b : b);

// ---------- editor ----------
async function openFile(rel, keepScroll) {
  if (fx.file && fx.file.path === rel && !keepScroll) return;
  if (!keepScroll && !(await guardDirty())) return;
  const root = fx.root;
  try {
    const f = await api(`/api/fs/read?root=${encodeURIComponent(root)}&path=${encodeURIComponent(rel)}`);
    if (root !== fx.root) return;
    const ta = $('#fxText');
    const pos = keepScroll && ta ? [ta.scrollTop, ta.selectionStart, ta.selectionEnd] : null;
    fx.file = f; fx.dirty = false; fx.stale = false;
    if (!keepScroll) fx.preview = /\.md$/i.test(rel);
    document.body.dataset.files = 'edit';
    drawTree(); drawEditor();
    if (pos && $('#fxText')) { const t2 = $('#fxText'); t2.scrollTop = pos[0]; t2.setSelectionRange(pos[1], pos[2]); }
  } catch (err) { toast(err.message, true); }
}
function drawEditor() {
  const ed = $('#fxEditor');
  if (!ed) return;
  const f = fx.file;
  if (!f) { ed.innerHTML = ''; return; }
  const parts = f.path.split('/');
  const isMd = /\.md$/i.test(f.path);
  const canEdit = f.text !== undefined;
  ed.innerHTML = `
    <div class="fx-ehead">
      <div class="fx-crumb" title="${esc(f.path)}">${parts.map((p, i) => `<span class="${i === parts.length - 1 ? 'last' : ''}">${esc(p)}</span>`).join('<i>/</i>')}${fx.dirty ? `<span class="fx-dirty" title="${esc(t('files.editor.unsaved'))}"></span>` : ''}</div>
      ${isMd && canEdit ? `<span class="seg sm"><button type="button" data-fx="edit" class="${fx.preview ? '' : 'on'}">${esc(t('files.editor.edit'))}</button><button type="button" data-fx="preview" class="${fx.preview ? 'on' : ''}">${esc(t('files.editor.preview'))}</button></span>` : ''}
      <button class="btn sm ghost" data-fx="tochat" title="${esc(t('files.editor.toChatTip'))}">${esc(t('files.editor.toChat'))}</button>
      ${canEdit ? `<button class="btn sm primary" data-fx="save" ${fx.dirty ? '' : 'disabled'} title="${esc(t('files.editor.saveTip'))}">${esc(t('files.editor.save'))}</button>` : ''}
      <button class="icon-btn sm" data-fx="reload" title="${esc(t('files.editor.reloadTip'))}">🔄</button>
      <button class="icon-btn sm" data-fx="close" title="${esc(t('files.editor.closeTip'))}">✕</button>
    </div>
    ${fx.stale ? `<div class="fx-stale">${esc(t('files.editor.staleMsg'))}
      <button class="btn sm ghost" data-fx="reload">${esc(t('files.editor.useDisk'))}</button><button class="btn sm ghost" data-fx="force">${esc(t('files.editor.keepMine'))}</button></div>` : ''}
    <div class="fx-body">${
      f.image ? `<div class="fx-img"><img src="/api/fs/raw?root=${encodeURIComponent(fx.root)}&path=${encodeURIComponent(f.path)}&t=${f.mtime}" alt="${esc(f.path)}"></div>`
      : f.binary ? `<div class="empty">${esc(t('files.editor.binary', { size: fmtSize(f.size) }))}</div>`
      : f.tooBig ? `<div class="empty">${esc(t('files.editor.tooBig', { size: fmtSize(f.size) }))}</div>`
      : fx.preview ? `<div class="md fx-md">${md(f.text)}</div>`
      : `<textarea id="fxText" class="fx-text" spellcheck="false" wrap="off" data-noicon>${esc(f.text)}</textarea>`
    }</div>
    <div class="fx-foot"><span id="fxPos"></span><span>${fmtSize(f.size)}</span><span>${f.mtime ? esc(t('files.editor.modified', { ago: ago(f.mtime) })) : ''}</span></div>`;
  const ta = $('#fxText');
  if (ta) {
    ta.oninput = () => { if (!fx.dirty) { fx.dirty = true; markDirty(); } };
    ta.onkeyup = ta.onclick = () => updatePos(ta);
    ta.onkeydown = e => {
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); ta.oninput(); }
    };
    updatePos(ta);
  }
}
function markDirty() {
  const c = $('.fx-crumb');
  if (c && !c.querySelector('.fx-dirty')) c.insertAdjacentHTML('beforeend', `<span class="fx-dirty" title="${esc(t('files.editor.unsaved'))}"></span>`);
  const b = $('[data-fx="save"]');
  if (b) b.disabled = false;
}
function updatePos(ta) {
  const before = ta.value.slice(0, ta.selectionStart);
  const line = before.split('\n').length, col = before.length - before.lastIndexOf('\n');
  const p = $('#fxPos');
  if (p) p.textContent = t('files.editor.position', { line, col, lines: ta.value.split('\n').length });
}
async function saveFile(force) {
  const f = fx.file;
  const ta = $('#fxText');
  if (!f || !ta) return;
  const text = ta.value;
  const res = await fetch('/api/fs/write', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root: fx.root, path: f.path, text, baseMtime: f.mtime, force: !!force }) });
  const r = await res.json().catch(() => ({}));
  if (res.status === 409) { fx.stale = true; drawEditorKeep(); return toast(r.error, 'error'); }
  if (!res.ok) return toast(r.error || t('files.editor.saveFailed'), true);
  Object.assign(f, { text, mtime: r.mtime, size: r.size });
  fx.dirty = false; fx.stale = false;
  drawEditorKeep();
  toast(t('files.editor.saved', { name: f.path.split('/').pop() }), 'ok');
}
// re-render the editor but keep the typed content + cursor position
function drawEditorKeep() {
  const ta = $('#fxText');
  const st = ta ? { v: ta.value, s: ta.scrollTop, a: ta.selectionStart, b: ta.selectionEnd } : null;
  drawEditor();
  const t2 = $('#fxText');
  if (st && t2) { t2.value = st.v; t2.scrollTop = st.s; t2.setSelectionRange(st.a, st.b); }
}
async function guardDirty() {
  if (!fx.dirty) return true;
  const ok = await ui.confirm({ title: t('files.discard.title'), danger: true, okText: t('files.discard.ok'), icon: '⚠',
    message: t('files.discard.message', { path: fx.file.path }) });
  if (ok) fx.dirty = false;
  return ok;
}
async function closeFile() {
  if (!(await guardDirty())) return;
  fx.file = null; fx.stale = false;
  document.body.dataset.files = 'tree';
  drawTree(); drawEditor();
}

// Claude just ran a tool (edited a file, ran a command) → reload the open folders and the file being viewed
let fxRefreshT = 0;
function filesRefreshSoon() {
  if (layout.files === 'off' || !fx.root) return;
  clearTimeout(fxRefreshT);
  fxRefreshT = setTimeout(refreshFiles, 900);
}
async function refreshFiles() {
  const root = fx.root;
  const dirs = [...fx.dirs.keys()].filter(d => d === '' || fx.open.has(d));
  for (const d of [...fx.dirs.keys()]) if (!dirs.includes(d)) fx.dirs.delete(d);
  await Promise.all(dirs.map(d => api(`/api/fs/list?root=${encodeURIComponent(root)}&dir=${encodeURIComponent(d)}`)
    .then(r => root === fx.root && fx.dirs.set(d, r.entries)).catch(() => { fx.dirs.delete(d); fx.open.delete(d); })));
  if (root !== fx.root) return;
  drawTree();
  const f = fx.file;
  if (!f) return;
  const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
  const ents = fx.dirs.get(dir) || (await api(`/api/fs/list?root=${encodeURIComponent(root)}&dir=${encodeURIComponent(dir)}`).then(r => r.entries).catch(() => []));
  const e = ents.find(x => x.name === f.path.split('/').pop());
  if (!e || Math.abs(e.mtime - f.mtime) <= 1) return;
  if (fx.dirty) { if (!fx.stale) { fx.stale = true; drawEditorKeep(); } }
  else openFile(f.path, true);
}

async function newFile() {
  if (!fx.root) return;
  const base = fx.file ? fx.file.path.replace(/[^/]*$/, '') : '';
  const p = await ui.prompt({ title: t('files.new.title'), icon: '📄', okText: t('files.new.ok'),
    input: { value: base, placeholder: 'src/utils/helper.js', hint: t('files.new.hint', { project: projName(fx.root) }) } });
  if (!p) return;
  const isDir = p.endsWith('/');
  const rel = p.replace(/^\/+|\/+$/g, '');
  const res = await fetch('/api/fs/write', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root: fx.root, path: rel, text: '', create: true, mkdir: isDir }) });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) return toast(r.error || t('files.new.failed'), true);
  // expand parent folders to reveal the new file
  const segs = rel.split('/');
  for (let i = 1; i < segs.length + (isDir ? 1 : 0); i++) fx.open.add(segs.slice(0, i).join('/'));
  await refreshFilesAll();
  if (!isDir) openFile(rel);
  toast(t('files.new.created', { path: rel }), 'ok');
}
async function refreshFilesAll() {
  const root = fx.root;
  await Promise.all([...fx.open].map(d => api(`/api/fs/list?root=${encodeURIComponent(root)}&dir=${encodeURIComponent(d)}`)
    .then(r => fx.dirs.set(d, r.entries)).catch(() => fx.open.delete(d))));
  drawTree();
}

function fileToChat() {
  const f = fx.file;
  if (!f) return;
  const task = state.openTask && state.tasks.get(state.openTask);
  const ref = task && task.projectPath === fx.root ? '@' + f.path : fx.root.replace(/\/$/, '') + '/' + f.path;
  const ta = $('#followText');
  if (!ta) { navigator.clipboard && navigator.clipboard.writeText(ref).catch(() => {}); return toast(t('files.toChat.copied', { ref }), 'info'); }
  ta.setRangeText((ta.value && !/\s$/.test(ta.value) ? ' ' : '') + ref + ' ', ta.selectionStart, ta.selectionEnd, 'end');
  ta.focus();
  autoGrow(ta);
}

function toggleFiles(force) {
  layout.files = force || (layout.files === 'off' ? 'on' : 'off');
  saveLayout();
  filesBtn();
  if (layout.files === 'off') { document.body.dataset.files = 'off'; return; }
  const r = fxContextRoot();
  if (!fx.root || (r !== fx.root && !fx.dirty)) return setRoot(r);
  document.body.dataset.files = fx.file ? 'edit' : 'tree';
  renderFiles();
}
function filesBtn() {
  const b = $('#btnFiles');
  if (!b) return;
  b.classList.toggle('on', layout.files !== 'off');
  setTip(b, layout.files === 'off' ? t('files.panel.openTip') : t('files.panel.collapseTip'));
}

// ---------- events ----------
document.addEventListener('click', async e => {
  const row = e.target.closest('[data-fxdir],[data-fxfile],[data-fx]');
  if (!row) return;
  const d = row.dataset;
  try {
    if (d.fxdir !== undefined) {
      const rel = d.fxdir;
      if (fx.open.has(rel)) fx.open.delete(rel);
      else { fx.open.add(rel); if (!fx.dirs.has(rel)) loadDir(rel); }
      return drawTree();
    }
    if (d.fxfile !== undefined) return openFile(d.fxfile);
    switch (d.fx) {
      case 'toggle': return toggleFiles('off');
      case 'refresh': return refreshFiles();
      case 'newfile': return newFile();
      case 'save': return saveFile();
      case 'force': return saveFile(true);
      case 'reload': if (fx.dirty && !(await guardDirty())) return; fx.dirty = false; return openFile(fx.file.path, true);
      case 'close': return closeFile();
      case 'tochat': return fileToChat();
      case 'preview': fx.preview = true; return drawEditorKeep();
      case 'edit': fx.preview = false; return drawEditor();
    }
  } catch (err) { toast(err.message, true); }
});
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey) && fx.file && $('#fxText')) { e.preventDefault(); return saveFile(); }
  if (e.key.toLowerCase() === 'b' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); return toggleFiles(); }
  if (e.key === 'Escape' && document.activeElement && document.activeElement.id === 'fxText') { e.stopPropagation(); closeFile(); }
}, true);
window.addEventListener('beforeunload', e => { if (fx.dirty) { e.preventDefault(); e.returnValue = ''; } });

function initFiles() {
  if (!layout.files) layout.files = 'on';
  document.body.dataset.files = layout.files === 'off' ? 'off' : 'tree';
  const b = $('#btnFiles');
  if (b) { b.innerHTML = fxIconHtml('folder-tree', 'c-teal'); b.onclick = () => toggleFiles(); }
  filesBtn();
  if (layout.files !== 'off') setRoot(fxContextRoot());
}
