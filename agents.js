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
    models: [
      ['gemini-4-argon-high', 'Gemini 4 Argon (High)'],
      ['gemini-4-argon-medium', 'Gemini 4 Argon (Medium)'],
      ['gemini-4-argon-low', 'Gemini 4 Argon (Low)'],
      ['gemini-3.8-flash-high', 'Gemini 3.8 Flash (High)'],
      ['gemini-3.8-flash-medium', 'Gemini 3.8 Flash (Medium)'],
      ['gemini-3.8-flash-low', 'Gemini 3.8 Flash (Low)'],
      ['claude-opus-5-5-high', 'Claude Opus 5.5 (High)'],
      ['claude-opus-5-5-medium', 'Claude Opus 5.5 (Medium)'],
      ['claude-sonnet-5-5-high', 'Claude Sonnet 5.5 (High)'],
      ['claude-sonnet-5-5-medium', 'Claude Sonnet 5.5 (Medium)'],
      ['gpt-oss-120b-medium', 'GPT-OSS 120B (Medium)'],
    ],
    modes: ['', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'],
    args(t, text, ctx) {
      return ['--output-format', 'stream-json',
        ...(t.sessionId ? ['--conversation', t.sessionId] : []),
        ...(t.model ? ['--model', t.model] : []),
        ...(t.effort ? ['--effort', t.effort] : []),
        ...permArgs(t, { '': ['--mode', 'accept-edits'], plan: ['--mode', 'plan'], acceptEdits: ['--mode', 'accept-edits'], auto: ['--mode', 'auto'], bypassPermissions: ['--dangerously-skip-permissions'] }),
        '--add-dir', ctx.uploads,
        `-p=${text}`];
    },
    parse(m, h) {
      if (m.event === 'init') return h.session(m.conversation_id, m.init && m.init.model, { tools: (m.init && m.init.tools || []).length });
      if (m.event === 'step_update') {
        const s = m.step_update || {};
        if (s.usage || m.usage) {
          const u = s.usage || m.usage;
          h.usage && h.usage({ in: u.input_tokens, out: (u.output_tokens || 0) + (u.thinking_tokens || 0), cr: u.cache_read_tokens || u.cache_read_input_tokens });
        }
        if (s.step_type === 'agent_response') {
          if (s.text_delta) h.delta(s.text_delta);
          if (s.thinking_delta) h.thinkingDelta(s.thinking_delta);
          if (s.state === 'DONE') h.flush();
        } else if (s.step_type === 'tool') {
          const info = s.tool_info || {};
          if (s.state === 'ACTIVE') h.tool('s' + s.step_index, s.tool_name || info.name, info.parameters || {});
          else if (s.state === 'DONE' || s.state === 'ERROR' || s.state === 'CANCELED') h.toolResult('s' + s.step_index, s.state !== 'DONE', info.output || info.result || '');
        }
        if (h.pollTranscript) h.pollTranscript();
        return;
      }
      if (m.event === 'result') {
        const r = m.result || {}, u = r.usage || m.usage || {};
        h.result({ ok: r.status === 'SUCCESS', text: r.error || r.response || '', in: u.input_tokens || u.total_input_tokens, out: (u.output_tokens || 0) + (u.thinking_tokens || 0), cr: u.cache_read_tokens || u.cache_read_input_tokens, cw: u.cache_creation_input_tokens,
          duration: (r.duration_seconds || 0) * 1000, turns: r.num_turns, denials: (r.denied_actions || []).map(d => d.display_name || d.action) });
      }
    },
    resumeCmd: t => (t.sessionId ? `agy --conversation ${t.sessionId}` : 'agy'),
  },

  // OpenAI Codex CLI — `codex exec --json`
  codex: {
    label: 'Codex', icon: '◎', color: '#10a37f', bin: 'codex',
    models: [['gpt-5.3-codex', 'GPT-5.3 Codex'], ['gpt-5.2-codex', 'GPT-5.2 Codex'], ['gpt-5', 'GPT-5'], ['o3', 'o3'], ['o4-mini', 'o4-mini']],
    modes: ['', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'],
    args(t, text, ctx) {
      const common = ['--json', '--skip-git-repo-check',
        ...(t.model ? ['-m', t.model] : []),
        ...(t.effort ? ['-c', `model_reasoning_effort="${t.effort === 'max' ? 'xhigh' : t.effort}"`] : []),
        ...permArgs(t, { plan: ['-c', 'sandbox_mode="read-only"'], acceptEdits: ['--full-auto'], auto: ['--full-auto'], '': ['--full-auto'], bypassPermissions: ['--dangerously-bypass-approvals-and-sandbox'] })];
      for (const img of (ctx && ctx.images) || []) common.push('-i', img);
      return t.sessionId
        ? ['exec', 'resume', ...common, t.sessionId, text]
        : ['exec', ...(ctx && ctx.uploads ? ['--add-dir', ctx.uploads] : []), ...common, text];
    },
    parse(m, h) {
      const it = m.item || {};
      if (m.type === 'thread.started') return h.session(m.thread_id, m.model);
      if (m.type === 'item.started') {
        if (it.type === 'command_execution') return h.tool(it.id, 'shell', { command: it.command });
        if (it.type === 'web_search') return h.tool(it.id, 'web_search', { query: it.query });
        if (it.type === 'todo_list' && Array.isArray(it.items) && h.todos) return h.todos(it.items);
      }
      if (m.type === 'item.updated' && it.type === 'todo_list' && Array.isArray(it.items) && h.todos) return h.todos(it.items);
      if (m.type === 'item.completed') {
        if (it.type === 'agent_message') return h.text(it.text || '');
        if (it.type === 'reasoning') return h.thinking(it.text || (Array.isArray(it.summary) ? it.summary.map(s => s.text || s).join('\n') : ''));
        if (it.type === 'command_execution') return h.toolResult(it.id, it.exit_code !== 0 && it.exit_code !== undefined, it.aggregated_output || '');
        if (it.type === 'file_change') { h.tool(it.id, 'edit', { changes: it.changes }); return h.toolResult(it.id, it.status === 'failed', (it.changes || []).map(c => `${c.kind} ${c.path}`).join('\n')); }
        if (it.type === 'mcp_tool_call') { h.tool(it.id, `${it.server}.${it.tool}`, it.arguments || {}); return h.toolResult(it.id, it.status === 'failed', JSON.stringify(it.result || it.error || '')); }
        if (it.type === 'web_search') return h.toolResult(it.id, false, it.query || '');
        if (it.type === 'todo_list' && Array.isArray(it.items) && h.todos) return h.todos(it.items);
        if (it.type === 'error') return h.stderr(it.message || JSON.stringify(it));
        return;
      }
      if (m.type === 'token_count' || (m.type === 'event_msg' && m.payload && m.payload.type === 'token_count')) {
        const info = (m.payload && m.payload.info) || m.info || {};
        const last = info.last_token_usage || info.total_token_usage || {};
        const ctx = (last.input_tokens || 0) + (last.cached_input_tokens || 0);
        if (ctx && h.usage) h.usage({ context: ctx });
        return;
      }
      if (m.type === 'turn.completed') {
        const u = m.usage || {};
        const inTok = u.input_tokens || 0, crTok = u.cached_input_tokens || 0;
        const outTok = (u.output_tokens || 0) + (u.reasoning_output_tokens || 0);
        return h.result({ ok: true, in: inTok, out: outTok, cr: crTok, context: inTok + crTok });
      }
      if (m.type === 'turn.failed' || m.type === 'error') return h.result({ ok: false, text: (m.error && m.error.message) || m.message, textKey: 'server.agent.failed', params: { agent: 'Codex' } });
    },
    resumeCmd: t => (t.sessionId ? `codex resume ${t.sessionId}` : 'codex'),
  },

  // Google Gemini CLI — `gemini -p ... --output-format stream-json`
  gemini: {
    label: 'Gemini CLI', icon: '✧', color: '#8e75ff', bin: 'gemini',
    models: [['gemini-2.5-pro', 'Gemini 2.5 Pro'], ['gemini-2.5-flash', 'Gemini 2.5 Flash']],
    modes: ['', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'],
    args(t, text, ctx) {
      return ['--output-format', 'stream-json', '--skip-trust',
        ...(ctx && ctx.uploads ? ['--include-directories', ctx.uploads] : []),
        ...(t.sessionId ? ['--resume', t.sessionId] : []),
        ...(t.model ? ['-m', t.model] : []),
        ...permArgs(t, { '': ['--approval-mode', 'auto_edit'], plan: ['--approval-mode', 'plan'], acceptEdits: ['--approval-mode', 'auto_edit'], auto: ['--approval-mode', 'auto_edit'], bypassPermissions: ['--yolo'] }),
        '-p', text];
    },
    parse(m, h) {
      if (m.type === 'init') return h.session(m.session_id, m.model);
      if (m.type === 'message' && m.role === 'assistant') return m.delta ? h.delta(m.content || '') : h.text(m.content || '');
      if (m.type === 'tool_use') return h.tool(m.tool_id, m.tool_name, m.parameters || {});
      if (m.type === 'tool_result') return h.toolResult(m.tool_id, m.status === 'error', typeof m.output === 'string' ? m.output : JSON.stringify(m.output || m.error || ''));
      if (m.type === 'error') return h.stderr(m.message || JSON.stringify(m));
      if (m.type === 'result') {
        const s = m.stats || {};
        const inTok = s.input ?? Math.max(0, (s.input_tokens || 0) - (s.cached || 0));
        const crTok = s.cached || 0;
        const outTok = Math.max(s.output_tokens || 0, (s.total_tokens || 0) - (s.input_tokens || 0));
        return h.result({ ok: m.status !== 'error', text: m.error && m.error.message, in: inTok, out: outTok, cr: crTok, context: s.input_tokens || (inTok + crTok), duration: s.duration_ms });
      }
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
