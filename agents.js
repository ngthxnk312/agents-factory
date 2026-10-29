'use strict';
// AI agents the Hub can drive. Claude Code runs as a process that lives for the whole chat (see server.js);
// other agents run once per message in non-interactive mode, emit line-delimited JSON, and resume sessions by ID.
//
// Each adapter:
//   args(t, text, ctx)  → command-line argument array for one turn
//   parse(obj, h)       → converts one JSON line into events via h: session/delta/text/thinking/tool/toolResult/result
//                         h.result({ ok, text, textKey?, params? }): textKey is a server.* i18n key used when text is empty
//   resumeCmd(t)        → command to reopen the session in a terminal
//   modes               → supported permission modes (same names as Claude so the UI can share them)
// Add custom agents in hub.config.json → agents.<name> = { bin, args: [..."{prompt}"], resumeArgs: [..."{session}", "{prompt}"] }
// (custom agents print plain text to stdout; the Hub shows it verbatim).

const permArgs = (t, map) => map[t.permissionMode || ''] || [];

const ADAPTERS = {
  claude: {
    label: 'Claude Code', icon: '✦', color: '#d97757', bin: 'claude', builtin: true,
    models: [['opus', 'Opus'], ['opus[1m]', 'Opus 1M'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku'], ['fable', 'Fable']],
    modes: ['', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'],
    resumeCmd: t => (t.sessionId ? `claude --resume ${t.sessionId}` : 'claude'),
  },

  // Google Antigravity CLI — tested on this machine: `agy --output-format stream-json -p=...`
  agy: {
    label: 'Antigravity', icon: '🪐', color: '#4f7cff', bin: 'agy',
    models: [],
    modes: ['', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'],
    args(t, text, ctx) {
      return ['--output-format', 'stream-json',
        ...(t.sessionId ? ['--conversation', t.sessionId] : []),
        ...(t.model ? ['--model', t.model] : []),
        ...(t.effort ? ['--effort', t.effort] : []),
        ...permArgs(t, { plan: ['--mode', 'plan'], acceptEdits: ['--mode', 'accept-edits'], auto: ['--mode', 'accept-edits'], bypassPermissions: ['--dangerously-skip-permissions'] }),
        '--add-dir', ctx.uploads,
        `-p=${text}`];
    },
    parse(m, h) {
      if (m.event === 'init') return h.session(m.conversation_id, m.init && m.init.model, { tools: (m.init && m.init.tools || []).length });
      if (m.event === 'step_update') {
        const s = m.step_update || {};
        if (s.step_type === 'agent_response') {
          if (s.text_delta) h.delta(s.text_delta);
          if (s.thinking_delta) h.thinkingDelta(s.thinking_delta);
          if (s.state === 'DONE') h.flush();
        } else if (s.step_type === 'tool') {
          const info = s.tool_info || {};
          if (s.state === 'ACTIVE') h.tool('s' + s.step_index, s.tool_name || info.name, info.parameters || {});
          else if (s.state === 'DONE' || s.state === 'ERROR' || s.state === 'CANCELED') h.toolResult('s' + s.step_index, s.state !== 'DONE', info.output || info.result || '');
        }
        return;
      }
      if (m.event === 'result') {
        const r = m.result || {}, u = r.usage || {};
        h.result({ ok: r.status === 'SUCCESS', text: r.error || r.response || '', in: u.input_tokens, out: (u.output_tokens || 0) + (u.thinking_tokens || 0), cr: u.cache_read_tokens,
          duration: (r.duration_seconds || 0) * 1000, turns: r.num_turns, denials: (r.denied_actions || []).map(d => d.display_name || d.action) });
      }
    },
    resumeCmd: t => (t.sessionId ? `agy --conversation ${t.sessionId}` : 'agy'),
  },

  // OpenAI Codex CLI — per the `codex exec --json` docs (not installed on this machine, so untested)
  codex: {
    label: 'Codex', icon: '◎', color: '#10a37f', bin: 'codex',
    models: [],
    modes: ['', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'],
    args(t, text) {
      const common = ['--json', '--skip-git-repo-check',
        ...(t.model ? ['-m', t.model] : []),
        ...permArgs(t, { plan: ['--sandbox', 'read-only'], acceptEdits: ['--full-auto'], auto: ['--full-auto'], '': ['--full-auto'], bypassPermissions: ['--dangerously-bypass-approvals-and-sandbox'] })];
      return t.sessionId ? ['exec', 'resume', t.sessionId, ...common, text] : ['exec', ...common, text];
    },
    parse(m, h) {
      const it = m.item || {};
      if (m.type === 'thread.started') return h.session(m.thread_id);
      if (m.type === 'item.started' && it.type === 'command_execution') return h.tool(it.id, 'shell', { command: it.command });
      if (m.type === 'item.completed') {
        if (it.type === 'agent_message') return h.text(it.text || '');
        if (it.type === 'reasoning') return h.thinking(it.text || '');
        if (it.type === 'command_execution') return h.toolResult(it.id, it.exit_code !== 0 && it.exit_code !== undefined, it.aggregated_output || '');
        if (it.type === 'file_change') { h.tool(it.id, 'edit', { changes: it.changes }); return h.toolResult(it.id, it.status === 'failed', (it.changes || []).map(c => `${c.kind} ${c.path}`).join('\n')); }
        if (it.type === 'mcp_tool_call') { h.tool(it.id, `${it.server}.${it.tool}`, it.arguments || {}); return h.toolResult(it.id, it.status === 'failed', JSON.stringify(it.result || it.error || '')); }
        return;
      }
      if (m.type === 'turn.completed') { const u = m.usage || {}; return h.result({ ok: true, in: u.input_tokens, out: u.output_tokens, cr: u.cached_input_tokens }); }
      if (m.type === 'turn.failed' || m.type === 'error') return h.result({ ok: false, text: (m.error && m.error.message) || m.message, textKey: 'server.agent.failed', params: { agent: 'Codex' } });
    },
    resumeCmd: t => (t.sessionId ? `codex resume ${t.sessionId}` : 'codex'),
  },

  // Google Gemini CLI — per the `gemini -p ... --output-format stream-json` docs (not installed on this machine, so untested)
  gemini: {
    label: 'Gemini CLI', icon: '✧', color: '#8e75ff', bin: 'gemini',
    models: [['gemini-2.5-pro', 'Gemini 2.5 Pro'], ['gemini-2.5-flash', 'Gemini 2.5 Flash']],
    modes: ['', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'],
    args(t, text) {
      return ['--output-format', 'stream-json',
        ...(t.sessionId ? ['--resume', t.sessionId] : []),
        ...(t.model ? ['-m', t.model] : []),
        ...permArgs(t, { plan: ['--approval-mode', 'plan'], acceptEdits: ['--approval-mode', 'auto_edit'], auto: ['--approval-mode', 'auto_edit'], bypassPermissions: ['--yolo'] }),
        '-p', text];
    },
    parse(m, h) {
      if (m.type === 'init') return h.session(m.session_id, m.model);
      if (m.type === 'message' && m.role === 'assistant') return m.delta ? h.delta(m.content || '') : h.text(m.content || '');
      if (m.type === 'tool_use') return h.tool(m.tool_id, m.tool_name, m.parameters || {});
      if (m.type === 'tool_result') return h.toolResult(m.tool_id, m.status === 'error', typeof m.output === 'string' ? m.output : JSON.stringify(m.output || m.error || ''));
      if (m.type === 'error') return h.stderr(m.message || JSON.stringify(m));
      if (m.type === 'result') { const s = m.stats || {}; return h.result({ ok: m.status !== 'error', text: m.error && m.error.message, in: s.input_tokens, out: s.output_tokens, cr: s.cached, duration: s.duration_ms }); }
    },
    resumeCmd: t => (t.sessionId ? `gemini --resume ${t.sessionId}` : 'gemini'),
  },
};

// Custom agent declared in the config: prints text to stdout
function customAdapter(key, c) {
  const fill = (arr, t, text) => arr.map(a => a.replace('{prompt}', text).replace('{session}', t.sessionId || '').replace('{model}', t.model || ''));
  return {
    label: c.label || key, icon: c.icon || '◆', color: c.color || '#888', bin: c.bin || key, custom: true,
    models: c.models || [], modes: [''],
    args: (t, text) => fill(t.sessionId && c.resumeArgs ? c.resumeArgs : (c.args || ['{prompt}']), t, text),
    parse: null, // plain text
    resumeCmd: () => c.bin || key,
  };
}

function buildAgents(cfg = {}) {
  const out = {};
  for (const [k, a] of Object.entries(ADAPTERS)) {
    const c = cfg[k] || {};
    if (c.enabled === false) continue;
    out[k] = { ...a, key: k, bin: c.bin || a.bin, models: c.models || a.models, extraArgs: c.extraArgs || [] };
  }
  for (const [k, c] of Object.entries(cfg)) if (!ADAPTERS[k] && c && c.enabled !== false && (c.bin || c.args)) out[k] = { ...customAdapter(k, c), key: k };
  return out;
}

module.exports = { buildAgents };
