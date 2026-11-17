#!/usr/bin/env node
// Clone traffic chart for the README.
// GitHub keeps only 14 days of daily clone/view counts, so every run merges them into <out>/history.json and redraws
// <out>/clones.svg and <out>/clones-dark.svg from the whole history (last 30 days drawn, totals over everything).
// Usage: TRAFFIC_TOKEN=<token with push access> REPO=owner/name node traffic-chart.mjs <out-dir>
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'traffic';
const REPO = process.env.REPO || process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.TRAFFIC_TOKEN;
const DAYS = 30;
if (!REPO || !TOKEN) { console.error('REPO and TRAFFIC_TOKEN are required'); process.exit(1); }

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
for (const kind of ['clones', 'views']) {
  const d = await gh(`repos/${REPO}/traffic/${kind}`);
  for (const x of d[kind] || []) hist[kind][x.timestamp.slice(0, 10)] = { count: x.count, uniques: x.uniques };
  hist[kind + '14'] = { count: d.count, uniques: d.uniques }; // GitHub's 14-day totals; uniques are distinct, not summed
}
const sortKeys = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
hist.clones = sortKeys(hist.clones); hist.views = sortKeys(hist.views);
fs.writeFileSync(histFile, JSON.stringify(hist, null, 2) + '\n');

// ---------- chart ----------
// Same validated pair as the Hub's charts (categorical slots 1–2): clones = blue bars, unique cloners = orange line.
const THEMES = {
  light: { bg: '#ffffff', border: '#dedbd2', ink: '#1d1c1a', muted: '#5f5c55', grid: '#e9e6de', s1: '#2a78d6', s2: '#eb6834' },
  dark: { bg: '#0d1117', border: '#30363d', ink: '#e6edf3', muted: '#9198a1', grid: '#21262d', s1: '#3987e5', s2: '#d95926' },
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

function svg(th) {
  const c = THEMES[th];
  const W = 820, H = 320, L = 44, R = 16, T = 118, B = 30;
  const ph = H - T - B, slot = (W - L - R) / days.length, bw = Math.min(16, slot * 0.6);
  const y = v => T + ph - (v / max) * ph;
  let grid = '', bars = '', line = '', dots = '', labels = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${c.grid}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="ax">${Math.round(v)}</text>`;
  }
  const peak = days.reduce((m, d, i) => (d.count > days[m].count ? i : m), 0);
  days.forEach((d, i) => {
    const cx = L + slot * i + slot / 2, x = cx - bw / 2;
    if (d.count) {
      const top = y(d.count), h = Math.max(2, T + ph - top), r = Math.min(4, h, bw / 2);
      bars += `<path d="M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${top + h}Z" fill="${c.s1}"><title>${fmtDay(d.day)}: ${d.count} clones, ${d.uniques} unique</title></path>`;
    }
    if (since && d.day >= since) line += `${line ? 'L' : 'M'}${cx.toFixed(1)},${y(d.uniques).toFixed(1)}`; // no line before tracking began
    if (d.uniques) dots += `<circle cx="${cx.toFixed(1)}" cy="${y(d.uniques).toFixed(1)}" r="3.5" fill="${c.s2}" stroke="${c.bg}" stroke-width="2"/>`;
    if (i % 5 === (days.length - 1) % 5) labels += `<text x="${cx}" y="${H - 10}" text-anchor="middle" class="ax">${fmtDay(d.day)}</text>`;
  });
  const pk = days[peak];
  const peakLbl = pk.count ? `<text x="${L + slot * peak + slot / 2}" y="${y(pk.count) - 7}" text-anchor="middle" class="pk">${pk.count}</text>` : '';
  const c14 = hist.clones14 || { count: 0, uniques: 0 }, v14 = hist.views14 || { count: 0, uniques: 0 };
  const stat = (x, value, label) => `<text x="${x}" y="62" class="val">${value}</text><text x="${x}" y="84" class="lbl">${esc(label)}</text>`;
  const updated = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`${REPO}: ${c14.count} clones in the last 14 days`)}">
<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;fill:${c.ink}}.ax,.lbl,.sub{fill:${c.muted};font-size:11px}.lbl{font-size:12px}.val{font-size:26px;font-weight:600}.pk{font-size:11px;font-weight:600}.ttl{font-size:14px;font-weight:600}</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${c.bg}" stroke="${c.border}"/>
<text x="20" y="28" class="ttl">Clone traffic · ${esc(REPO)}</text>
<text x="${W - 20}" y="28" text-anchor="end" class="sub">updated ${updated}</text>
${stat(20, c14.count, `clones, last 14 days (${c14.uniques} unique)`)}
${stat(290, total, `clones recorded since ${since ? fmtDay(since) + '/' + since.slice(0, 4) : '—'}`)}
${stat(560, v14.count, `views, last 14 days (${v14.uniques} unique)`)}
<rect x="${W - 196}" y="${T - 22}" width="10" height="10" rx="2" fill="${c.s1}"/><text x="${W - 182}" y="${T - 13}" class="ax">Clones</text>
<rect x="${W - 124}" y="${T - 18}" width="12" height="3" rx="1.5" fill="${c.s2}"/><text x="${W - 106}" y="${T - 13}" class="ax">Unique cloners</text>
${grid}${bars}<path d="${line}" fill="none" stroke="${c.s2}" stroke-width="2" stroke-linejoin="round"/>${dots}
<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" stroke="${c.border}"/>${peakLbl}${labels}
</svg>
`;
}
fs.writeFileSync(path.join(OUT, 'clones.svg'), svg('light'));
fs.writeFileSync(path.join(OUT, 'clones-dark.svg'), svg('dark'));
console.log(`${REPO}: ${hist.clones14.count} clones / 14 days, ${total} recorded since ${since}`);
