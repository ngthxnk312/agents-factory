'use strict';
// Home dashboard: what is running right now, what needs attention, usage at a glance, recent work.
// Uses globals from app.js at call time (state, api, esc, $, fmtTok, money, ago, dur, …).

const dash = { usage: null, at: 0, loading: false };

async function loadDashUsage() {
  if (dash.loading || Date.now() - dash.at < 60000) return;
  dash.loading = true;
  try { dash.usage = await api('/api/usage?days=14'); dash.at = Date.now(); } catch { /* keep the last value */ }
  dash.loading = false;
  if (state.tab === 'dashboard' && !state.openTask) renderDashboard();
}

function dashTile(label, value, sub, cls = '', attrs = '') {
  return `<div class="kpi dash-kpi ${cls}" ${attrs}><div class="lbl">${label}</div><div class="val">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
}

function renderDashboard() {
  const tasks = scopedTasks();
  const running = tasks.filter(isActive);
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const doneToday = tasks.filter(task => !isActive(task) && (task.endedAt || task.updatedAt || 0) >= dayStart && (task.status === 'done' || task.status === 'idle'));
  const failed = tasks.filter(task => task.status === 'error' || task.status === 'stopped');
  const u = dash.usage;
  const today = u && u.days.length ? u.days[u.days.length - 1] : null;
  const sumOut = d => Object.values(d.models).reduce((s, m) => s + m.out, 0);
  const outToday = today ? sumOut(today) : null;
  const out7 = u ? u.days.slice(-7).reduce((s, d) => s + sumOut(d), 0) : null;
  const bgAll = Object.values((typeof bg !== 'undefined' && bg.agents) || {});
  const bgWork = bgAll.filter(a => a.state === 'working' || a.status === 'busy');

  // Needs attention: failures, background conflicts, permission denials, unread results
  const attention = [
    ...tasks.filter(task => task.bgConflict && !isActive(task)).map(task => ({ task, why: t('dashboard.attention.bgHeld'), cls: 'warn' })),
    ...failed.filter(task => !task.bgConflict).map(task => ({ task, why: task.status === 'error' ? t('dashboard.attention.lastFailed') : t('dashboard.attention.stopped'), cls: 'err' })),
    ...tasks.filter(task => !isActive(task) && task.denials && task.status !== 'error').map(task => ({ task, why: t('dashboard.attention.denials', { n: task.denials }), cls: 'warn' })),
    ...tasks.filter(task => isUnread(task) && task.status === 'done').map(task => ({ task, why: t('dashboard.attention.unread'), cls: 'ok' })),
  ].filter((x, i, arr) => arr.findIndex(y => y.task.id === x.task.id) === i).slice(0, 8);

  const recent = tasks.filter(task => !isActive(task)).sort(byRecent).slice(0, 8);
  const rl = state.rateLimit && state.rateLimit.unifiedWindows || {};
  const limitTile = (k, label) => {
    const w = rl[k];
    if (!w) return dashTile(label, '—', esc(t('dashboard.limit.noData')));
    const reset = (w.resetsAt || 0) * 1000, exp = reset && reset < Date.now(), pct = exp ? 0 : Math.round((w.utilization || 0) * 100);
    return dashTile(label, exp ? '↺' : pct + '%', `<span class="meter ${meterCls(pct)}"><i style="width:${Math.max(2, Math.min(100, pct))}%"></i></span>${esc(exp ? t('dashboard.limit.reset') : t('dashboard.limit.resetsIn', { until: untilText(reset) }))}`, '', 'data-tab="usage" role="button"');
  };

  const ws = curWs();
  $('#view').innerHTML = `
    <div class="section-title"><h2>${esc(t('dashboard.title'))}</h2>
      <span class="hint">${ws ? esc(ws.icon + ' ' + ws.name) + ' · ' : ''}${esc(t('dashboard.summary', { projects: scopedProjects().length, chats: tasks.length }))}</span>
      <span class="sp"></span>
      <button class="btn sm ghost" data-quick>${esc(t('dashboard.quickSwitch'))} <kbd>Ctrl K</kbd></button>
      <button class="btn sm primary" data-compose>${esc(t('dashboard.compose'))}</button>
    </div>

    <div class="kpis dash-kpis">
      ${dashTile(esc(t('dashboard.tile.running')), running.length, esc(running.length ? t('dashboard.tile.queued', { n: running.filter(task => task.status === 'queued').length }) : t('dashboard.tile.noneRunning')), running.length ? 'live' : '', 'data-runlist role="button"')}
      ${dashTile(esc(t('dashboard.tile.doneToday')), doneToday.length, esc(t('dashboard.tile.failed', { n: failed.length })))}
      ${dashTile(esc(t('dashboard.tile.bgAgents')), bgAll.length ? `${bgWork.length}/${bgAll.length}` : '0', esc(bgAll.length ? t('dashboard.tile.bgWorkingTotal') : t('dashboard.tile.bgNone')), '', bgAll.length ? 'data-bglist role="button"' : '')}
      ${dashTile(esc(t('dashboard.tile.outputToday')), outToday === null ? '…' : fmtTok(outToday), out7 === null ? '' : esc(t('dashboard.tile.output7d', { n: fmtTok(out7) })), '', 'data-tab="usage" role="button"')}
      ${dashTile(esc(t('dashboard.tile.machineCost')), mcost.total === null ? '…' : mcost.total ? money(mcost.total) : mcost.out ? fmtTok(mcost.out) + ' tok' : '$0', esc(t('dashboard.tile.machineCostSub')), '', 'data-tab="usage" role="button"')}
      ${limitTile('five_hour', esc(t('dashboard.tile.limit5h')))}
      ${limitTile('seven_day', esc(t('dashboard.tile.limit7d')))}
    </div>

    <div class="dash-grid">
      <div class="panel dash-running">
        <h3><span class="spin-if">${running.length ? '<span class="spin"></span>' : '⚡'}</span> ${esc(t('dashboard.running.title'))} <span class="n">${running.length}</span></h3>
        ${running.length ? running.map(dashRunRow).join('') : `<div class="empty">${esc(t('dashboard.running.empty'))}<br><button class="btn sm primary" data-compose style="margin-top:10px">${esc(t('dashboard.running.newTask'))}</button></div>`}
      </div>

      <div class="panel">
        <h3>${esc(t('dashboard.attention.title'))} <span class="n">${attention.length}</span></h3>
        ${attention.length ? attention.map(({ task, why, cls }) => `
          <div class="dash-row" data-task="${task.id}" role="button">
            <span class="sdot ${dotCls(task)}"></span>
            <div class="dash-main"><b>${esc(task.title)}</b><div class="hint"><span class="tag ${cls}">${esc(why)}</span> ${esc(projName(task.projectPath))} · ${ago(task.updatedAt || task.createdAt)}</div></div>
          </div>`).join('') : `<div class="empty">${esc(t('dashboard.attention.empty'))}</div>`}
      </div>

      <div class="panel dash-chart">
        <h3>${esc(t('dashboard.chart.title'))} <span class="n">${esc(t('dashboard.chart.output'))}</span><span class="sp"></span><button class="btn sm ghost" data-tab="usage">${esc(t('dashboard.chart.details'))}</button></h3>
        ${u ? (() => { const ch = stackedChart(u.days, 'out'); return `<div class="legend">${ch.present.map(f => `<span><i style="background:${f.color}"></i>${esc(f.label || f.key)}</span>`).join('') || `<span>${esc(t('dashboard.chart.noData'))}</span>`}</div><div class="chart-wrap" id="chartWrap">${ch.svg}<div class="tip" id="chartTip" hidden></div></div>`; })() : `<div class="empty">${esc(t('dashboard.chart.loading'))}</div>`}
      </div>

      <div class="panel">
        <h3>${esc(t('dashboard.projects.title'))} <span class="n">${esc(t('dashboard.projects.period'))}</span></h3>
        ${u && u.projects.filter(p => inScope(p.path)).length ? (() => {
          const ps = u.projects.filter(p => inScope(p.path)).slice(0, 6);
          const max = Math.max(1, ...ps.map(p => p.out));
          return ps.map(p => `<div class="dash-row" data-path="${esc(p.path)}" data-cfgproj role="button"><div class="dash-main"><b>${esc(projName(p.path))}</b><div class="hint">${esc(t('dashboard.projects.sessions', { n: p.sessions }))} · ${money(p.cost) || '$0'}</div></div><span class="bar-cell"><i style="width:${Math.round(p.out / max * 110)}px"></i>${fmtTok(p.out)}</span></div>`).join('');
        })() : `<div class="empty">${esc(t('dashboard.projects.empty'))}</div>`}
      </div>

      <div class="panel dash-recent">
        <h3>${esc(t('dashboard.recent.title'))} <span class="n">${recent.length}</span><span class="sp"></span><button class="btn sm ghost" data-tab="board">${esc(t('dashboard.recent.board'))}</button></h3>
        ${recent.length ? recent.map(task => `
          <div class="dash-row" data-task="${task.id}" role="button">
            <span class="sdot ${dotCls(task)}"></span>
            <div class="dash-main"><b>${esc(task.title)}</b><div class="hint">${esc(projName(task.projectPath))} · ${(STATUS[task.status] || {}).label || task.status} · ${ago(task.updatedAt || task.createdAt)}</div></div>
            ${agentBadge(task)}${skillBadge(task)}
          </div>`).join('') : `<div class="empty">${esc(t('dashboard.recent.empty'))}</div>`}
      </div>
    </div>`;
  if (u) bindChartTip(u.days, stackedChart(u.days, 'out').present);
  loadDashUsage();
}

function dashRunRow(task) {
  const todos = task.todos && task.todos.length ? task.todos : null;
  const done = todos ? todos.filter(x => x.status === 'completed').length : 0;
  const pct = todos ? Math.round(done / todos.length * 100) : 0;
  return `<div class="dash-row run" data-task="${task.id}" role="button">
    <span class="sdot ${dotCls(task)}"></span>
    <div class="dash-main">
      <b>${esc(task.title)}</b>
      <div class="hint">${esc(projName(task.projectPath))} · ⏱ <span data-elapsed="${task.lastRunAt || ''}">${dur(Date.now() - (task.lastRunAt || Date.now()))}</span> · ${esc(t('dashboard.run.steps', { n: task.steps || 0 }))}</div>
      ${task.step ? `<div class="dash-step" data-noicon>🔧 ${toolLabel(task.step.name)} <code>${esc((task.step.brief || '').slice(0, 90))}</code></div>` : task.status === 'queued' ? `<div class="hint">${esc(t('dashboard.run.queued'))}</div>` : `<div class="hint">${esc(t('dashboard.run.thinking'))}</div>`}
      ${todos ? `<div class="dash-todo"><span class="meter ${pct === 100 ? 'ok' : ''}" style="width:120px;margin:0"><i style="width:${Math.max(3, pct)}%"></i></span> ${esc(t('dashboard.run.todos', { done, total: todos.length }))}</div>` : ''}
    </div>
    ${agentBadge(task)}${skillBadge(task)}
  </div>`;
}

// Refresh the dashboard while it is visible (running steps change often)
setInterval(() => { if (state.tab === 'dashboard' && !state.openTask && !document.hidden && !document.querySelector('.dlg-overlay, .pop-menu')) renderDashboard(); }, 5000);
