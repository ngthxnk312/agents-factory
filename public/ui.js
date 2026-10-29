'use strict';
// Agents Factory's custom popups: dialogs, notifications, select menus, tooltips.
// Replaces the browser's default confirm()/prompt()/Notification/<select>/title.
(function () {
  const escH = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])';

  // ---------- dialogs ----------
  function dialog({ title, message, input, okText = t('ui.dialog.ok'), cancelText = t('ui.dialog.cancel'), danger = false, icon } = {}) {
    return new Promise(resolve => {
      closeMenu(); hideTip();
      const prevFocus = document.activeElement;
      const wrap = document.createElement('div');
      wrap.className = 'dlg-overlay';
      wrap.innerHTML = `
        <div class="dlg ${danger ? 'danger' : ''}" role="${danger ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-labelledby="dlgTitle" aria-describedby="dlgMsg">
          <div class="dlg-icon" aria-hidden="true">${icon || (danger ? '⚠️' : input ? '✏️' : '💬')}</div>
          <div class="dlg-body">
            <h3 id="dlgTitle">${escH(title)}</h3>
            ${message ? `<p id="dlgMsg">${escH(message)}</p>` : ''}
            ${input ? `<input class="input" id="dlgInput" autocomplete="off" placeholder="${escH(input.placeholder || '')}" value="${escH(input.value || '')}">
              ${input.hint ? `<div class="dlg-hint">${escH(input.hint)}</div>` : ''}` : ''}
            <div class="dlg-foot">
              <button type="button" class="btn ghost" data-dlg="cancel">${escH(cancelText)}</button>
              <button type="button" class="btn ${danger ? 'danger-solid' : 'primary'}" data-dlg="ok">${escH(okText)}</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const inp = wrap.querySelector('#dlgInput');
      (inp || wrap.querySelector('[data-dlg=ok]')).focus();
      if (inp) inp.select();

      const done = v => {
        document.removeEventListener('keydown', onKey, true);
        wrap.classList.add('closing');
        setTimeout(() => wrap.remove(), 120);
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        resolve(v);
      };
      const ok = () => done(input ? (inp.value.trim() || (input.allowEmpty ? '' : null)) : true);
      const cancel = () => done(input ? null : false);
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
        else if (e.key === 'Enter' && inp && document.activeElement === inp) { e.preventDefault(); e.stopPropagation(); ok(); }
        else if (e.key === 'Tab') { // trap focus inside the dialog
          const f = [...wrap.querySelectorAll(FOCUSABLE)];
          const i = f.indexOf(document.activeElement);
          e.preventDefault();
          f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        } else e.stopPropagation(); // block page shortcuts while a dialog is open
      }
      document.addEventListener('keydown', onKey, true);
      wrap.addEventListener('mousedown', e => { if (e.target === wrap) cancel(); });
      wrap.addEventListener('click', e => {
        const b = e.target.closest('[data-dlg]');
        if (b) (b.dataset.dlg === 'ok' ? ok : cancel)();
      });
    });
  }

  // ---------- stacked notifications ----------
  function toast(msg, type, opts = {}) {
    const kind = type === true ? 'error' : (type || 'info');
    let stack = document.getElementById('toastStack');
    if (!stack) { stack = document.createElement('div'); stack.id = 'toastStack'; stack.className = 'toast-stack'; document.body.appendChild(stack); }
    const el = document.createElement('div');
    el.className = `toast-item ${kind}`;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    const ico = { error: '⚠️', ok: '✅', info: '✦' }[kind] || '✦';
    el.innerHTML = `<span class="t-ico" aria-hidden="true">${ico}</span><span class="t-msg"></span>
      ${opts.action ? `<button type="button" class="btn sm t-act">${escH(opts.action.label)}</button>` : ''}
      <button type="button" class="t-close" aria-label="${escH(t('ui.toast.close'))}">✕</button><i class="t-bar"></i>`;
    el.querySelector('.t-msg').textContent = String(msg).replace(/^[✅⚠️]\s*/u, '');
    stack.appendChild(el);
    while (stack.children.length > 4) stack.firstElementChild.remove();
    const ms = opts.timeout || (opts.action ? 9000 : kind === 'error' ? 6000 : 3500);
    const bar = el.querySelector('.t-bar');
    bar.style.animationDuration = ms + 'ms';
    let left = ms, start = Date.now(), timer;
    const close = () => { clearTimeout(timer); el.classList.add('closing'); setTimeout(() => el.remove(), 180); };
    const run = () => { start = Date.now(); timer = setTimeout(close, left); bar.style.animationPlayState = 'running'; };
    el.addEventListener('mouseenter', () => { clearTimeout(timer); left -= Date.now() - start; bar.style.animationPlayState = 'paused'; });
    el.addEventListener('mouseleave', run);
    el.querySelector('.t-close').onclick = close;
    if (opts.action) el.querySelector('.t-act').onclick = () => { close(); opts.action.fn(); };
    run();
    return close;
  }

  // ---------- select menu replacing <select> ----------
  let menu = null;
  function closeMenu() {
    if (!menu) return;
    menu.el.remove();
    menu.btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', menu.onKey, true);
    menu = null;
  }
  function openMenu(sel, btn) {
    if (menu && menu.sel === sel) return closeMenu();
    closeMenu(); hideTip();
    const el = document.createElement('div');
    el.className = 'csel-menu';
    el.setAttribute('role', 'listbox');
    el.innerHTML = [...sel.options].map((o, i) => `<div class="csel-opt ${i === sel.selectedIndex ? 'on' : ''}" role="option" data-i="${i}" data-val="${escH(o.value)}" data-for="${escH(sel.id || '')}" ${o.hidden ? 'hidden' : ''} aria-selected="${i === sel.selectedIndex}">${escH(o.text)}</div>`).join('');
    document.body.appendChild(el);
    const r = btn.getBoundingClientRect();
    el.style.minWidth = Math.max(r.width, 170) + 'px';
    const h = el.offsetHeight, w = el.offsetWidth;
    el.style.left = Math.min(r.left, innerWidth - w - 8) + 'px';
    el.style.top = (r.bottom + 4 + h > innerHeight && r.top - h - 4 > 0 ? r.top - h - 4 : r.bottom + 4) + 'px';
    let active = sel.selectedIndex;
    const opts = [...el.children];
    const mark = () => opts.forEach((o, i) => o.classList.toggle('active', i === active));
    mark();
    const choose = i => {
      if (i !== sel.selectedIndex) { sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      closeMenu(); btn.focus();
    };
    el.addEventListener('mousedown', e => e.preventDefault());
    el.addEventListener('click', e => { const o = e.target.closest('.csel-opt'); if (o) choose(+o.dataset.i); });
    el.addEventListener('mousemove', e => { const o = e.target.closest('.csel-opt'); if (o) { active = +o.dataset.i; mark(); } });
    const onKey = e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); active = (active + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length; mark(); opts[active].scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(); btn.focus(); }
      e.stopPropagation();
    };
    document.addEventListener('keydown', onKey, true);
    btn.setAttribute('aria-expanded', 'true');
    menu = { el, btn, sel, onKey };
  }
  function enhanceSelect(sel) {
    if (sel.dataset.enhanced) return;
    sel.dataset.enhanced = '1';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'csel' + (sel.closest('.statusline') ? ' sm' : '');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    if (sel.id) btn.dataset.for = sel.id;
    const sync = () => { const o = sel.options[sel.selectedIndex]; btn.dataset.val = sel.value; btn.innerHTML = `<span>${escH(o ? o.text : '')}</span><i aria-hidden="true">▾</i>`; };
    sync();
    sel.addEventListener('change', sync);
    sel._sync = sync;
    sel.classList.add('csel-native');
    sel.tabIndex = -1;
    sel.after(btn);
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openMenu(sel, btn); });
    btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openMenu(sel, btn); } });
  }
  document.addEventListener('mousedown', e => { if (menu && !menu.el.contains(e.target) && !menu.btn.contains(e.target)) closeMenu(); });
  addEventListener('resize', closeMenu);
  document.addEventListener('scroll', e => { if (menu && !menu.el.contains(e.target)) closeMenu(); }, true);

  // ---------- tooltip replacing title ----------
  let tipEl = null, tipFor = null, tipTimer = 0;
  function hideTip() { clearTimeout(tipTimer); if (tipEl) tipEl.remove(); tipEl = null; tipFor = null; }
  function showTip(el) {
    if (!document.body.contains(el) || !el.dataset.tip) return;
    hideTip();
    tipFor = el;
    tipEl = document.createElement('div');
    tipEl.className = 'tip-pop';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.textContent = window.icons ? window.icons.stripEmoji(el.dataset.tip) : el.dataset.tip;
    document.body.appendChild(tipEl);
    const r = el.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    const left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const below = r.top - h - 8 < 4;
    tipEl.style.left = left + 'px';
    tipEl.style.top = (below ? r.bottom + 8 : r.top - h - 8) + 'px';
    tipEl.classList.add(below ? 'below' : 'above');
  }
  function adoptTitle(el) {
    if (el.hasAttribute('title')) {
      const t = el.getAttribute('title');
      el.removeAttribute('title');
      if (t) { el.dataset.tip = t; if (!el.getAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', t); }
    }
  }
  const tipTarget = n => n && n.closest && n.closest('[title],[data-tip]');
  document.addEventListener('mouseover', e => {
    const el = tipTarget(e.target);
    if (!el) return;
    adoptTitle(el);
    if (el === tipFor || !el.dataset.tip) return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => showTip(el), 380);
  });
  document.addEventListener('mouseout', e => {
    const el = tipTarget(e.target);
    if (el && !el.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener('focusin', e => {
    const el = tipTarget(e.target);
    if (el && e.target === el && el.matches(':focus-visible')) { adoptTitle(el); tipTimer = setTimeout(() => showTip(el), 380); }
  });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('mousedown', hideTip, true);
  document.addEventListener('scroll', hideTip, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });

  // Auto-attach to every newly rendered element (the chat status bar re-renders constantly)
  const enhanceAll = root => {
    root.querySelectorAll('select:not([data-enhanced])').forEach(enhanceSelect);
    root.querySelectorAll('[title]').forEach(adoptTitle);
  };
  new MutationObserver(muts => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches('select') || n.matches('[title]')) enhanceAll(n.parentNode || document); else enhanceAll(n); }
    if (tipFor && !document.body.contains(tipFor)) hideTip();
    if (menu && !document.body.contains(menu.btn)) closeMenu();
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => enhanceAll(document));
  enhanceAll(document);

  // ---------- popup menu from a button (e.g. workspace picker) ----------
  // items: [{ label, icon, active, hint, onClick, divider, danger }]
  function popMenu(btn, items) {
    if (menu && menu.btn === btn) return closeMenu();
    closeMenu(); hideTip();
    const el = document.createElement('div');
    el.className = 'csel-menu pop-menu';
    el.setAttribute('role', 'menu');
    const acts = [];
    el.innerHTML = items.map(it => {
      if (it.divider) return '<div class="pm-div" role="separator"></div>';
      // info block (not clickable): { info: { title, sub, chips: html, rows: [[label, value]] } }
      if (it.info) {
        const f = it.info;
        return `<div class="pm-info" data-noicon-skip>${f.title ? `<div class="pm-title">${escH(f.title)}</div>` : ''}${f.sub ? `<div class="pm-sub">${escH(f.sub)}</div>` : ''}${f.chips ? `<div class="pm-chips">${f.chips}</div>` : ''}${(f.rows || []).filter(r => r && r[1] !== undefined && r[1] !== null && r[1] !== '').map(r => `<div class="pm-row"><span>${escH(r[0])}</span><b class="${r[2] ? 'mono' : ''}">${escH(String(r[1]))}</b></div>`).join('')}</div>`;
      }
      if (it.section) return `<div class="pm-sec">${escH(it.section)}</div>`;
      acts.push(it);
      return `<div class="csel-opt ${it.active ? 'on' : ''} ${it.danger ? 'danger' : ''}" role="menuitem" data-a="${acts.length - 1}">
        <span class="pm-ico" aria-hidden="true">${escH(it.icon || '')}</span><span class="pm-lbl">${escH(it.label)}</span>${it.hint ? `<small>${escH(it.hint)}</small>` : ''}</div>`;
    }).join('');
    document.body.appendChild(el);
    const r = btn.getBoundingClientRect();
    el.style.minWidth = Math.max(r.width, 230) + 'px';
    el.style.left = Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8)) + 'px';
    // not enough room below → open upwards
    const mh = el.offsetHeight;
    el.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - mh - 8)) + 'px';
    const opts = [...el.querySelectorAll('[data-a]')];
    let active = Math.max(0, opts.findIndex(o => o.classList.contains('on')));
    const mark = () => opts.forEach((o, i) => o.classList.toggle('active', i === active));
    mark();
    const choose = i => { closeMenu(); btn.focus(); acts[i].onClick && acts[i].onClick(); };
    el.addEventListener('mousedown', e => e.preventDefault());
    el.addEventListener('click', e => { const o = e.target.closest('[data-a]'); if (o) choose(+o.dataset.a); });
    el.addEventListener('mousemove', e => { const o = e.target.closest('[data-a]'); if (o) { active = opts.indexOf(o); mark(); } });
    const onKey = e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); active = (active + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length; mark(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(+opts[active].dataset.a); }
      else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(); btn.focus(); }
      e.stopPropagation();
    };
    document.addEventListener('keydown', onKey, true);
    btn.setAttribute('aria-expanded', 'true');
    menu = { el, btn, sel: null, onKey };
  }

  window.ui = {
    menu: popMenu,
    dialog,
    confirm: o => dialog(typeof o === 'string' ? { title: o } : o),
    prompt: o => dialog({ ...o, input: o.input || {} }),
    toast,
  };
})();
