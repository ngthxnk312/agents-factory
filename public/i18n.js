'use strict';
// Internationalisation. Every UI label lives in key → value dictionaries, never hard-coded in the code:
//   public/i18n/<lang>/<namespace>.json   e.g. public/i18n/en/dashboard.json  { "dashboard.running": "Running", … }
// Usage:
//   t('dashboard.running')                    → "Running"
//   t('sessions.count', { n: 5 })             → "5 sessions"   (placeholders: {name})
//   <span data-i18n="tabs.board"></span>       → text content
//   <input data-i18n-attr="placeholder:sidebar.search;title:sidebar.searchTip">
// Missing keys fall back to Vietnamese (the reference language), then to the key itself.
// Server-generated text carries { textKey, params } (see tx()) so stored events follow the current language.
// Switching language happens in place (no reload): the dictionary is swapped, static markup re-applied, then a
// 'langchange' event lets each module rebuild its translated constants and re-render (see the 'langchange' listeners in app.js, files.js, bgview.js, resize.js).
(function () {
  const LANGS = { vi: { label: 'Tiếng Việt', locale: 'vi-VN' }, en: { label: 'English', locale: 'en-GB' } };
  // One file per namespace and language; keep in sync with the files in public/i18n/<lang>/
  const NAMESPACES = ['common', 'index', 'app', 'dashboard', 'files', 'slash', 'nav', 'bgview', 'ui', 'resize', 'handoff', 'server'];
  let lang = 'vi';
  try { const l = localStorage.getItem('hub-lang'); if (LANGS[l]) lang = l; } catch { /* storage unavailable */ }
  document.documentElement.lang = lang;

  // Dictionaries are loaded synchronously so render code can call t() immediately (local app, tiny files).
  function loadLang(l) {
    const out = {};
    for (const ns of NAMESPACES) {
      try {
        const x = new XMLHttpRequest();
        x.open('GET', `/i18n/${l}/${ns}.json`, false);
        x.send();
        if (x.status === 200) Object.assign(out, JSON.parse(x.responseText));
      } catch { /* missing namespace file → fallback */ }
    }
    return out;
  }
  const base = loadLang('vi');
  let dict = lang === 'vi' ? base : loadLang(lang);
  // the other languages are fetched in the background so a switch is instant
  const dicts = { vi: base, [lang]: dict };
  const prefetch = l => Promise.all(NAMESPACES.map(ns => fetch(`/i18n/${l}/${ns}.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({}))))
    .then(parts => { if (!dicts[l]) dicts[l] = Object.assign({}, ...parts); });
  setTimeout(() => Object.keys(LANGS).forEach(l => dicts[l] || prefetch(l)), 1500);

  function t(key, params) {
    let s = dict[key];
    if (s === undefined) s = base[key];
    if (s === undefined) return key;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined && params[k] !== null ? String(params[k]) : m));
    return s;
  }
  const has = key => dict[key] !== undefined || base[key] !== undefined;
  // Server text: { textKey, params, text } → translated text (falls back to the stored text)
  const tx = o => (o && o.textKey && has(o.textKey) ? t(o.textKey, o.params) : (o && o.text) || '');

  // Static markup: data-i18n / data-i18n-attr
  function apply(root) {
    if (!root || root.nodeType !== 1) return;
    const els = root.matches && root.matches('[data-i18n],[data-i18n-attr]') ? [root] : [];
    els.push(...root.querySelectorAll('[data-i18n],[data-i18n-attr]'));
    for (const el of els) {
      if (el.dataset.i18n) el.textContent = t(el.dataset.i18n);
      if (el.dataset.i18nAttr) for (const pair of el.dataset.i18nAttr.split(';')) {
        const [attr, key] = pair.split(':').map(s => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      }
    }
  }

  function setLang(l) {
    if (!LANGS[l] || l === lang) return;
    try { localStorage.setItem('hub-lang', l); } catch { /* ignore */ }
    const next = dicts[l] || (dicts[l] = loadLang(l));
    const swap = () => {
      lang = l; dict = next;
      Object.assign(window.i18n, { lang, locale: LANGS[lang].locale });
      document.documentElement.lang = lang;
      apply(document.body);
      for (const b of document.querySelectorAll('#langSwitch [data-lang]')) { const on = b.dataset.lang === lang; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
      const sw = document.getElementById('langSwitch');
      if (sw) sw.setAttribute('aria-label', t('common.language'));
      const wait = []; // listeners push promises for async re-renders, so the cross-fade waits for them
      window.dispatchEvent(new CustomEvent('langchange', { detail: { lang, wait } }));
      return Promise.all(wait).catch(() => {});
    };
    // cross-fade old → new text, like the theme switch; plain swap where View Transitions aren't supported
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduce) document.startViewTransition(swap); else swap();
  }
  // Language switch in the top bar (SVG icon from the sprite)
  function mountSwitch() {
    const theme = document.getElementById('themeSwitch');
    if (!theme || document.getElementById('langSwitch')) return;
    const box = document.createElement('div');
    box.id = 'langSwitch';
    box.className = 'theme-switch lang-switch';
    box.setAttribute('aria-label', t('common.language'));
    box.innerHTML = '<svg class="svg-i" aria-hidden="true"><use href="#i-globe"/></svg>' +
      Object.entries(LANGS).map(([l, x]) => `<button type="button" data-lang="${l}" class="${l === lang ? 'on' : ''}" aria-pressed="${l === lang}" title="${x.label}">${l.toUpperCase()}</button>`).join('');
    theme.after(box);
    box.addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); });
  }

  window.t = t;
  window.i18n = { lang, locale: LANGS[lang].locale, langs: Object.keys(LANGS), t, tx, has, setLang, apply };
  const boot = () => {
    apply(document.body);
    mountSwitch();
    new MutationObserver(muts => { for (const m of muts) m.addedNodes.forEach(n => n.nodeType === 1 && apply(n)); })
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
