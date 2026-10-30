'use strict';
// Drag edges to resize columns: project column, chat list, File panel, directory tree while editing a file.
// Stored in layout.sizes (localStorage hub-layout). Double-click the handle to reset to default.

const RS = {
  side:   { sel: '.sidebar', edge: 'right', min: 180, max: 560, title: t('resize.target.side') },
  rail:   { sel: '.chat-rail', edge: 'right', min: 170, max: 520, title: t('resize.target.rail') },
  files:  { sel: '#files', edge: 'left', min: 220, max: 1600, title: t('resize.target.files') },
  fxtree: { sel: '.fx-tree', edge: 'right', min: 150, max: 600, title: t('resize.target.fxtree') },
};
window.addEventListener('langchange', () => {
  for (const [key, r] of Object.entries(RS)) {
    r.title = t('resize.target.' + key);
    for (const h of document.querySelectorAll(`.rs-h[data-rs="${key}"]`)) h.title = t('resize.handleTip', { target: r.title });
  }
});
// the File panel has 2 separate sizes: tree only, and with a file open
const filesKey = () => (document.body.dataset.files === 'edit' ? 'filesEdit' : 'filesTree');

function applySizes() {
  const z = (layout.sizes = layout.sizes || {});
  let css = '';
  if (z.side) css += `body:not([data-side="mini"]) { --side-w: ${z.side}px !important; }\n`;
  if (z.rail) css += `body:not([data-rail="mini"]) .chat-rail { width: ${z.rail}px !important; }\n`;
  if (z.filesTree) css += `body[data-files="tree"] { --files-w: ${z.filesTree}px !important; }\n`;
  if (z.filesEdit) css += `body[data-files="edit"] { --files-w: ${z.filesEdit}px !important; }\n`;
  if (z.fxtree) css += `body[data-files="edit"] .fx-tree { width: ${z.fxtree}px !important; }\n`;
  let st = document.getElementById('rsStyle');
  if (!st) { st = document.createElement('style'); st.id = 'rsStyle'; document.head.appendChild(st); }
  st.textContent = css;
}

function ensureHandles() {
  for (const [key, r] of Object.entries(RS)) {
    const el = document.querySelector(r.sel);
    if (!el || el.querySelector(':scope > .rs-h')) continue;
    const h = document.createElement('div');
    h.className = 'rs-h rs-' + r.edge;
    h.dataset.rs = key;
    h.title = t('resize.handleTip', { target: r.title });
    el.appendChild(h);
  }
}

let drag = null;
document.addEventListener('pointerdown', e => {
  const h = e.target.closest('.rs-h');
  if (!h || e.button !== 0) return;
  const key = h.dataset.rs, r = RS[key];
  const el = h.parentElement;
  // when minimized (mini), dragging expands it first
  if (key === 'side' && layout.side === 'mini') { layout.side = layout.sidePrev || 'full'; applyLayout(); }
  if (key === 'rail' && layout.rail === 'mini') { layout.rail = 'full'; applyLayout(); }
  e.preventDefault();
  h.setPointerCapture(e.pointerId);
  drag = { key, r, h, x: e.clientX, w: el.getBoundingClientRect().width, store: key === 'files' ? filesKey() : key };
  document.body.classList.add('resizing');
  h.classList.add('on');
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  let w = drag.r.edge === 'right' ? drag.w + dx : drag.w - dx;
  // reserve at least ~380px for the middle area
  const max = drag.key === 'files' ? Math.min(drag.r.max, innerWidth - 380 - (document.querySelector('.sidebar') || { offsetWidth: 0 }).offsetWidth) : drag.r.max;
  w = Math.round(Math.max(drag.r.min, Math.min(max, w)));
  layout.sizes = layout.sizes || {};
  layout.sizes[drag.store] = w;
  applySizes();
});
const endDrag = () => {
  if (!drag) return;
  drag.h.classList.remove('on');
  document.body.classList.remove('resizing');
  drag = null;
  saveLayout();
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
document.addEventListener('dblclick', e => {
  const h = e.target.closest('.rs-h');
  if (!h) return;
  const key = h.dataset.rs;
  delete (layout.sizes || {})[key === 'files' ? filesKey() : key];
  applySizes(); saveLayout();
  toast(t('resize.reset', { target: RS[key].title }), 'info');
});

let rsRaf = 0;
new MutationObserver(() => { if (!rsRaf) rsRaf = requestAnimationFrame(() => { rsRaf = 0; ensureHandles(); }); }).observe(document.body, { childList: true, subtree: true });
applySizes();
ensureHandles();
