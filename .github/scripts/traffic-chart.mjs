#!/usr/bin/env node
// Clone traffic chart for the README (illustrated cartoon style, light & dark themes).
// GitHub keeps only 14 days of daily clone/view counts, so every run merges them into <out>/history.json and redraws
// <out>/clones.svg and <out>/clones-dark.svg from the whole history (last 30 days drawn, totals over everything).
// Usage:
//   TRAFFIC_TOKEN=<token with push access> REPO=owner/name node traffic-chart.mjs <out-dir>
//   REPO=owner/name node traffic-chart.mjs <out-dir> --render-only   (redraw from existing history.json)
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const renderOnly = args.includes('--render-only');
const OUT = args.find(a => !a.startsWith('-')) || 'traffic';
const REPO = process.env.REPO || process.env.GITHUB_REPOSITORY || 'ngthxnk312/agents-factory';
const TOKEN = process.env.TRAFFIC_TOKEN;
const DAYS = 30;
if (!renderOnly && (!REPO || !TOKEN)) { console.error('REPO and TRAFFIC_TOKEN are required'); process.exit(1); }

async function gh(url) {
  const res = await fetch(`https://api.github.com/${url}`, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'traffic-chart' } });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

fs.mkdirSync(OUT, { recursive: true });
const histFile = path.join(OUT, 'history.json');
// an empty or unreadable history (first run, damaged branch) starts over instead of failing the run
let hist;
try { hist = JSON.parse(fs.readFileSync(histFile, 'utf8')); } catch { hist = {}; }
hist.clones = hist.clones || {}; hist.views = hist.views || {};
if (!renderOnly) {
  for (const kind of ['clones', 'views']) {
    const d = await gh(`repos/${REPO}/traffic/${kind}`);
    for (const x of d[kind] || []) hist[kind][x.timestamp.slice(0, 10)] = { count: x.count, uniques: x.uniques };
    hist[kind + '14'] = { count: d.count, uniques: d.uniques }; // GitHub's 14-day totals; uniques are distinct, not summed
  }
  const sortKeys = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  hist.clones = sortKeys(hist.clones); hist.views = sortKeys(hist.views);
  fs.writeFileSync(histFile, JSON.stringify(hist, null, 2) + '\n');
}

// ---------- chart ----------
// Cartoon / illustrated style aligned with the Agents Factory pixel-mascot palette.
const THEMES = {
  light: {
    bg: '#fffdf7',
    plotBg: '#f6f3ea',
    dotPattern: '#dcd5c5',
    outline: '#232136',
    barOutline: '#232136',
    cardShadow: '#d7d0e6',
    softShadow: '#e2dcca',
    ink: '#232136',
    muted: '#66607a',
    grid: '#dcd5c6',
    pillBg: '#f2ecff',
    kpi1: '#e6f3ff', kpi1Icon: '#3b82f6',
    kpi2: '#f1eaff', kpi2Icon: '#7c5cff',
    kpi3: '#fff2dc', kpi3Icon: '#f59e0b',
    barTop: '#56a8ff', barBot: '#2f74e8',
    peakTop: '#9476ff', peakBot: '#5b56f0',
    line: '#ff6b35',
    bubbleBg: '#fde047', bubbleInk: '#232136',
    sparkle: '#f59e0b',
    liveDot: '#10b981',
    glossOpacity: '0.52',
  },
  dark: {
    bg: '#161b2a',
    plotBg: '#101421',
    dotPattern: '#242c44',
    outline: '#8c9bc2',
    barOutline: '#090d18',
    cardShadow: '#070a12',
    softShadow: '#090c16',
    ink: '#f1f5ff',
    muted: '#9ca7c4',
    grid: '#28314a',
    pillBg: '#232942',
    kpi1: '#1a2740', kpi1Icon: '#60a5fa',
    kpi2: '#251f42', kpi2Icon: '#a78bfa',
    kpi3: '#31251b', kpi3Icon: '#fbbf24',
    barTop: '#60b0ff', barBot: '#3478eb',
    peakTop: '#b094ff', peakBot: '#7c5cff',
    line: '#ff7e47',
    bubbleBg: '#fbbf24', bubbleInk: '#1b1830',
    sparkle: '#fde047',
    liveDot: '#34d399',
    glossOpacity: '0.42',
  },
};

const days = [];
const end = new Date(); end.setUTCHours(0, 0, 0, 0);
for (let i = DAYS - 1; i >= 0; i--) {
  const day = new Date(end.getTime() - i * 86400000).toISOString().slice(0, 10);
  days.push({ day, ...(hist.clones[day] || { count: 0, uniques: 0 }) });
}
const total = Object.values(hist.clones).reduce((a, d) => a + d.count, 0);
const since = Object.keys(hist.clones)[0];
// 4 gridlines on whole, round steps (1, 2, 5 × 10ⁿ)
const raw = Math.max(4, ...days.map(d => d.count)) / 4, mag = 10 ** Math.floor(Math.log10(raw));
const max = 4 * [1, 2, 5, 10].map(k => k * mag).find(st => st >= raw);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDay = d => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// Smooth monotone-ish cubic spline clamped to [minY, maxY] so cartoon curves stay playful without dipping below zero
function smoothPath(pts, minY, maxY) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  const clamp = v => Math.max(minY, Math.min(maxY, v));
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const dx = (p2.x - p1.x) / 3;
    let c1y = p1.y + (p2.y - p0.y) / 6;
    let c2y = p2.y - (p3.y - p1.y) / 6;
    // Keep flat zero segments cleanly pinned on the baseline
    if (p1.v === 0 && p2.v === 0) { c1y = p1.y; c2y = p2.y; }
    else {
      const lo = Math.min(p1.y, p2.y), hi = Math.max(p1.y, p2.y);
      c1y = clamp(Math.max(lo - 4, Math.min(hi + 4, c1y)));
      c2y = clamp(Math.max(lo - 4, Math.min(hi + 4, c2y)));
    }
    d += ` C${(p1.x + dx).toFixed(1)},${c1y.toFixed(1)} ${(p2.x - dx).toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function sparkle(x, y, size, color, cls = '') {
  const n = v => Number(v).toFixed(1);
  const s = size, q = size * 0.28;
  return `<path class="${cls}" d="M${n(x)},${n(y - s)} Q${n(x + q)},${n(y - q)} ${n(x + s)},${n(y)} Q${n(x + q)},${n(y + q)} ${n(x)},${n(y + s)} Q${n(x - q)},${n(y + q)} ${n(x - s)},${n(y)} Q${n(x - q)},${n(y - q)} ${n(x)},${n(y - s)}Z" fill="${color}"/>`;
}

// Mini pixel-cartoon factory badge matching public/img/logo.svg
function mascotBadge(x, y, outline) {
  return `<g transform="translate(${x},${y})">
    <rect x="2.5" y="2.5" width="38" height="38" rx="11" fill="${outline}" opacity="0.22"/>
    <rect x="0" y="0" width="38" height="38" rx="11" fill="url(#afLogoBg)" stroke="${outline}" stroke-width="2"/>
    <g transform="translate(3,3)" shape-rendering="crispEdges">
      <g class="puff">
        <rect x="22" y="5" width="4" height="2" fill="#e0f2fe"/>
        <rect x="23" y="4" width="2" height="1" fill="#ffffff"/>
        <rect x="17" y="3" width="4" height="2" fill="#bae6fd"/>
        <rect x="18" y="2" width="2" height="1" fill="#ffffff"/>
      </g>
      <rect x="8" y="4" width="2" height="4" fill="#fde047"/>
      <rect x="7" y="5" width="4" height="2" fill="#fde047"/>
      <rect x="8" y="5" width="2" height="2" fill="#ffffff"/>
      <rect x="21" y="8" width="6" height="2" fill="#e0e7ff"/>
      <rect x="22" y="10" width="4" height="2" fill="#fbbf24"/>
      <rect x="22" y="12" width="4" height="4" fill="#ffffff"/>
      <rect x="25" y="12" width="1" height="4" fill="#cbd5e1"/>
      <rect x="10" y="10" width="2" height="2" fill="#ffffff"/>
      <rect x="8" y="12" width="4" height="2" fill="#ffffff"/>
      <rect x="6" y="14" width="6" height="2" fill="#ffffff"/>
      <rect x="18" y="10" width="2" height="2" fill="#ffffff"/>
      <rect x="16" y="12" width="4" height="2" fill="#ffffff"/>
      <rect x="14" y="14" width="6" height="2" fill="#ffffff"/>
      <rect x="5" y="16" width="22" height="11" fill="#ffffff"/>
      <rect x="26" y="16" width="1" height="11" fill="#cbd5e1"/>
      <rect x="4" y="27" width="24" height="2" fill="#cbd5e1"/>
      <rect x="7" y="18" width="2" height="2" fill="#f59e0b"/>
      <rect x="7" y="22" width="2" height="2" fill="#f59e0b"/>
      <rect x="23" y="18" width="2" height="2" fill="#f59e0b"/>
      <rect x="23" y="22" width="2" height="2" fill="#f59e0b"/>
      <rect x="11" y="18" width="10" height="9" fill="#1e1b4b"/>
      <rect x="15" y="19" width="2" height="1" fill="#fde047"/>
      <rect x="13" y="20" width="6" height="5" fill="#2dd4bf"/>
      <rect x="13" y="20" width="6" height="1" fill="#99f6e4"/>
      <rect x="14" y="22" width="1" height="2" fill="#1e1b4b"/>
      <rect x="17" y="22" width="1" height="2" fill="#1e1b4b"/>
      <rect x="12" y="25" width="8" height="2" fill="#6d5dfc"/>
    </g>
  </g>`;
}

function kpiCard(x, y, w, h, fill, shadow, outline, iconOutline, iconColor, iconSvg, value, label) {
  return `<g transform="translate(${x},${y})">
    <rect x="3" y="3" width="${w}" height="${h}" rx="14" fill="${shadow}"/>
    <rect x="0" y="0" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="${outline}" stroke-width="2"/>
    <circle cx="29" cy="${h / 2}" r="16" fill="${iconColor}" stroke="${iconOutline}" stroke-width="1.8"/>
    <g transform="translate(17,${h / 2 - 12})">${iconSvg}</g>
    <text x="55" y="29" class="val">${esc(value)}</text>
    <text x="55" y="47" class="lbl">${esc(label)}</text>
  </g>`;
}

function svg(th) {
  const c = THEMES[th];
  const W = 860, H = 388;
  const plotX = 24, plotY = 142, plotW = 804, plotH = 222;
  const L = 66, R = 48, T = 196, B = 52;
  const ph = H - T - B; // 140
  const slot = (W - L - R) / days.length;
  const bw = Math.min(16, slot * 0.64);
  const y = v => T + ph - (v / max) * ph;
  const baseY = T + ph;

  let grid = '', barShadows = '', bars = '', dots = '', labels = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    const yy = y(v);
    if (i > 0) grid += `<line x1="${L}" x2="${W - R}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${c.grid}" stroke-width="1.4" stroke-dasharray="4 5"/>`;
    grid += `<text x="${L - 10}" y="${(yy + 4).toFixed(1)}" text-anchor="end" class="ax">${Math.round(v)}</text>`;
  }

  const peak = days.reduce((m, d, i) => (d.count > days[m].count ? i : m), 0);
  const linePts = [];

  days.forEach((d, i) => {
    const cx = L + slot * i + slot / 2;
    const x = cx - bw / 2;
    if (d.count) {
      const top = y(d.count);
      const h = Math.max(4, baseY - top);
      const r = Math.min(6, h / 2, bw / 2);
      const isPeak = i === peak;
      const barPath = (ox = 0) => `M${(x + ox).toFixed(1)},${baseY.toFixed(1)}V${(top + r).toFixed(1)}Q${(x + ox).toFixed(1)},${top.toFixed(1)} ${(x + ox + r).toFixed(1)},${top.toFixed(1)}H${(x + ox + bw - r).toFixed(1)}Q${(x + ox + bw).toFixed(1)},${top.toFixed(1)} ${(x + ox + bw).toFixed(1)},${(top + r).toFixed(1)}V${baseY.toFixed(1)}Z`;
      barShadows += `<path d="${barPath(2.8)}" fill="${c.softShadow}"/>`;
      const gloss = h >= 14 ? `<rect x="${(x + 3.2).toFixed(1)}" y="${(top + 3.5).toFixed(1)}" width="3.2" height="${Math.min(18, Math.max(4, h - 8)).toFixed(1)}" rx="1.6" fill="#ffffff" opacity="${c.glossOpacity}"/>` : '';
      bars += `<g><path d="${barPath(0)}" fill="url(#${isPeak ? 'peakGrad' : 'barGrad'})" stroke="${c.barOutline}" stroke-width="1.8" stroke-linejoin="round"><title>${fmtDay(d.day)}: ${d.count} clones, ${d.uniques} unique</title></path>${gloss}</g>`;
    }
    if (since && d.day >= since) linePts.push({ x: cx, y: y(d.uniques), v: d.uniques, day: d.day });
    if (d.uniques) {
      const cy = y(d.uniques);
      dots += `<g><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.6" fill="${c.line}" stroke="${c.barOutline}" stroke-width="1.8"><title>${fmtDay(d.day)}: ${d.uniques} unique cloners</title></circle><circle cx="${(cx - 1.4).toFixed(1)}" cy="${(cy - 1.4).toFixed(1)}" r="1.4" fill="#ffffff" opacity="0.88"/></g>`;
    }
    if (i % 5 === (days.length - 1) % 5) {
      labels += `<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${baseY.toFixed(1)}" y2="${(baseY + 4).toFixed(1)}" stroke="${c.outline}" stroke-width="1.6" stroke-linecap="round"/><text x="${cx.toFixed(1)}" y="${(baseY + 18).toFixed(1)}" text-anchor="middle" class="ax">${fmtDay(d.day)}</text>`;
    }
  });

  const lineD = smoothPath(linePts, T, baseY);
  const pk = days[peak];
  let peakBubble = '';
  if (pk.count) {
    const pcx = L + slot * peak + slot / 2;
    const ptop = y(pk.count);
    const labelStr = `★ ${pk.count}`;
    const pillW = Math.max(48, 24 + String(pk.count).length * 8.5);
    const pillH = 22;
    const bx = Math.max(L + 4, Math.min(W - R - pillW - 4, pcx - pillW / 2));
    const by = Math.max(plotY + 26, ptop - pillH - 11);
    const tailX = Math.max(bx + 10, Math.min(bx + pillW - 10, pcx));
    peakBubble = `<g class="peak-pop">
      <rect x="${(bx + 2.2).toFixed(1)}" y="${(by + 2.5).toFixed(1)}" width="${pillW}" height="${pillH}" rx="11" fill="${c.barOutline}" opacity="0.28"/>
      <path d="M${(tailX - 5).toFixed(1)},${(by + pillH - 1).toFixed(1)} L${tailX.toFixed(1)},${(by + pillH + 6).toFixed(1)} L${(tailX + 5).toFixed(1)},${(by + pillH - 1).toFixed(1)} Z" fill="${c.bubbleBg}" stroke="${c.barOutline}" stroke-width="1.8" stroke-linejoin="round"/>
      <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${pillW}" height="${pillH}" rx="11" fill="${c.bubbleBg}" stroke="${c.barOutline}" stroke-width="1.8"/>
      <path d="M${(tailX - 3.6).toFixed(1)},${(by + pillH - 1.5).toFixed(1)} H${(tailX + 3.6).toFixed(1)}" stroke="${c.bubbleBg}" stroke-width="2.4"/>
      <text x="${(bx + pillW / 2).toFixed(1)}" y="${(by + 15).toFixed(1)}" text-anchor="middle" class="pk">${labelStr}</text>
      ${sparkle(bx - 8, by + 4, 4.6, c.sparkle, 'twinkle')}
      ${sparkle(bx + pillW + 8, by + 3, 3.8, c.sparkle, 'twinkle2')}
    </g>`;
  }

  const c14 = hist.clones14 || { count: 0, uniques: 0 }, v14 = hist.views14 || { count: 0, uniques: 0 };
  const updated = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const sinceLabel = since ? `${fmtDay(since)}/${since.slice(0, 4)}` : '—';

  // Cute custom cartoon icons for the 3 KPI sticker cards
  const icoClone = `<rect x="4" y="7" width="11" height="11" rx="3" fill="#ffffff" stroke="${c.barOutline}" stroke-width="1.6"/><rect x="9" y="4" width="11" height="11" rx="3" fill="#dbeafe" stroke="${c.barOutline}" stroke-width="1.6"/><path d="M12.5,9.5 H16.5 M14.5,7.5 V11.5" stroke="${c.barOutline}" stroke-width="1.6" stroke-linecap="round"/>`;
  const icoStar = `<path d="M12,3.5 L14.6,8.7 L20.3,9.5 L16.1,13.5 L17.1,19.2 L12,16.5 L6.9,19.2 L7.9,13.5 L3.7,9.5 L9.4,8.7 Z" fill="#fde047" stroke="${c.barOutline}" stroke-width="1.6" stroke-linejoin="round"/>`;
  const icoEye = `<path d="M3,12 Q12,4.5 21,12 Q12,19.5 3,12 Z" fill="#ffffff" stroke="${c.barOutline}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.6" fill="#232136"/><circle cx="10.9" cy="10.8" r="1.2" fill="#ffffff"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`${REPO}: ${c14.count} clones in the last 14 days`)}">
<defs>
  <linearGradient id="afLogoBg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7c5cff"/><stop offset="0.55" stop-color="#3b82f6"/><stop offset="1" stop-color="#14b8a6"/>
  </linearGradient>
  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${c.barTop}"/><stop offset="1" stop-color="${c.barBot}"/>
  </linearGradient>
  <linearGradient id="peakGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${c.peakTop}"/><stop offset="1" stop-color="${c.peakBot}"/>
  </linearGradient>
  <pattern id="plotDots" width="14" height="14" patternUnits="userSpaceOnUse">
    <circle cx="3" cy="3" r="1.15" fill="${c.dotPattern}" opacity="0.7"/>
  </pattern>
</defs>
<style>
  text{font-family:ui-rounded,"SF Pro Rounded","Nunito","Fredoka","Quicksand","Segoe UI",Helvetica,Arial,sans-serif;fill:${c.ink}}
  .ttl{font-size:17px;font-weight:800;letter-spacing:-0.2px}
  .repo{font-size:11.5px;font-weight:600;fill:${c.muted}}
  .sub{font-size:11px;font-weight:600;fill:${c.muted}}
  .val{font-size:23px;font-weight:800;letter-spacing:-0.4px}
  .lbl{font-size:11.5px;font-weight:600;fill:${c.muted}}
  .ax{font-size:11px;font-weight:700;fill:${c.muted}}
  .leg{font-size:11.5px;font-weight:700;fill:${c.ink}}
  .pk{font-size:11.5px;font-weight:800;fill:${c.bubbleInk}}
  @keyframes puffFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.2px)}}
  @keyframes twinkle{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}
  .puff{animation:puffFloat 2.8s ease-in-out infinite}
  .twinkle{transform-box:fill-box;transform-origin:center;animation:twinkle 2.4s ease-in-out infinite}
  .twinkle2{transform-box:fill-box;transform-origin:center;animation:twinkle 2.4s ease-in-out 1.1s infinite}
</style>

<!-- Outer cartoon sticker card -->
<rect x="10" y="10" width="${W - 16}" height="${H - 16}" rx="20" fill="${c.cardShadow}"/>
<rect x="4" y="4" width="${W - 16}" height="${H - 16}" rx="20" fill="${c.bg}" stroke="${c.outline}" stroke-width="2.5"/>

<!-- Header -->
${mascotBadge(24, 16, c.barOutline)}
<text x="74" y="34" class="ttl">Clone Traffic</text>
${sparkle(192, 26, 5.2, c.sparkle, 'twinkle')}
<text x="74" y="51" class="repo">${esc(REPO)}</text>

<!-- Updated timestamp pill -->
<g transform="translate(618,21)">
  <rect x="2.5" y="2.5" width="210" height="26" rx="13" fill="${c.softShadow}"/>
  <rect x="0" y="0" width="210" height="26" rx="13" fill="${c.pillBg}" stroke="${c.outline}" stroke-width="1.6"/>
  <circle cx="15" cy="13" r="4" fill="${c.liveDot}" stroke="${c.barOutline}" stroke-width="1.2"/>
  <text x="26" y="17" class="sub">updated ${updated}</text>
</g>

<!-- KPI sticker cards -->
${kpiCard(24, 68, 258, 60, c.kpi1, c.softShadow, c.outline, c.barOutline, c.kpi1Icon, icoClone, c14.count, `clones, 14d (${c14.uniques} unique)`)}
${kpiCard(297, 68, 258, 60, c.kpi2, c.softShadow, c.outline, c.barOutline, c.kpi2Icon, icoStar, total, `recorded since ${sinceLabel}`)}
${kpiCard(570, 68, 258, 60, c.kpi3, c.softShadow, c.outline, c.barOutline, c.kpi3Icon, icoEye, v14.count, `views, 14d (${v14.uniques} unique)`)}

<!-- Plot container -->
<rect x="${plotX}" y="${plotY}" width="${plotW}" height="${plotH}" rx="15" fill="${c.plotBg}" stroke="${c.outline}" stroke-width="2"/>
<rect x="${plotX + 1}" y="${plotY + 1}" width="${plotW - 2}" height="${plotH - 2}" rx="14" fill="url(#plotDots)"/>

<!-- Plot caption & legend pills -->
<text x="${plotX + 16}" y="${plotY + 23}" class="ax">LAST ${DAYS} DAYS</text>
<g transform="translate(${plotX + plotW - 236},${plotY + 9})">
  <rect x="0" y="0" width="84" height="22" rx="11" fill="${c.bg}" stroke="${c.outline}" stroke-width="1.5"/>
  <rect x="10" y="5" width="11" height="12" rx="3.5" fill="url(#barGrad)" stroke="${c.barOutline}" stroke-width="1.4"/>
  <text x="27" y="15" class="leg">Clones</text>
  <rect x="92" y="0" width="132" height="22" rx="11" fill="${c.bg}" stroke="${c.outline}" stroke-width="1.5"/>
  <line x1="101" y1="11" x2="119" y2="11" stroke="${c.line}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="110" cy="11" r="4" fill="${c.line}" stroke="${c.barOutline}" stroke-width="1.5"/>
  <text x="125" y="15" class="leg">Unique cloners</text>
</g>

<!-- Chart series -->
${grid}
${barShadows}
${bars}
<line x1="${L - 4}" x2="${W - R + 4}" y1="${baseY.toFixed(1)}" y2="${baseY.toFixed(1)}" stroke="${c.outline}" stroke-width="2.2" stroke-linecap="round"/>
${lineD ? `<path d="${lineD}" fill="none" stroke="${c.plotBg}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/><path d="${lineD}" fill="none" stroke="${c.line}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
${dots}
${peakBubble}
${labels}
</svg>
`;
}

fs.writeFileSync(path.join(OUT, 'clones.svg'), svg('light'));
fs.writeFileSync(path.join(OUT, 'clones-dark.svg'), svg('dark'));
console.log(`${REPO}: ${(hist.clones14 || {}).count || 0} clones / 14 days, ${total} recorded since ${since || '—'}`);
