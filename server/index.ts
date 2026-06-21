import { existsSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import express from 'express';
import { getEvents } from './cache.ts';
import { buildRecent, buildWeekly, buildModels, buildActivity, buildTools, buildHourlyHeatmap, buildProjectStats, filterSource, type SourceFilter } from './aggregate.ts';
import { claudeDir, readConfig, readCredentials, readStatsSummary, readSessionMetas, fetchLiveUsage, fetchLiveProfile } from './scan.ts';
import { getInsights } from './insights-scan.ts';
import {
  buildErrors, buildRetries, buildLanguages, buildBranches, buildMcp,
  buildComplexity, buildYield, buildRejections, buildSubagentStats, buildFileChurn, scopeInsights,
} from './insights.ts';
import { getCommandUsage } from './history.ts';
import { getWorkspaceTasks, getInventory } from './workspace.ts';
import { getLiveSubagents } from './subagents-live.ts';
import { getWorkflows } from './workflows.ts';
import { runAi, runAiStream, resolveBackend, AiUnavailableError, AiTokenRejectedError, AiCallError, type AiCreds } from './ai.ts';
import { buildAiContext, buildChatUserMessage, CHAT_SYSTEM, buildSectionUserMessage, SECTION_SYSTEM, SUGGEST_SYSTEM, buildSuggestMessage, type ChatTurn } from './ai-context.ts';
import { getVersionInfo, isDocker } from './version.ts';

const execAsync = promisify(exec);

const app = express();
app.use(express.json({ limit: '1mb' }));
const PORT = Number(process.env.SERVER_PORT ?? 8787);

function wrap(data: unknown, computedAt: number) {
  return { data, computedAt, claudeDir: claudeDir() };
}

/** Parse the optional ?source=all|code|cowork filter (default 'all'). */
function parseSource(raw: unknown): SourceFilter {
  return raw === 'code' || raw === 'cowork' ? raw : 'all';
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, claudeDir: claudeDir() });
});

app.get('/api/version', async (_req, res) => {
  try {
    res.json(wrap(await getVersionInfo(), Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Dev-only self-update: pull latest code (tsx watch + Vite HMR then reload).
// Docker users can't do this from inside the container — they get instructions.
app.post('/api/update/pull', async (_req, res) => {
  if (isDocker()) {
    res.status(400).json({ ok: false, error: 'Running in Docker — run `git pull && npm run docker:up` on the host.' });
    return;
  }
  try {
    const { stdout, stderr } = await execAsync('git pull && npm install', {
      cwd: process.cwd(),
      timeout: 120_000,
    });
    res.json({ ok: true, output: (stdout + stderr).trim() });
  } catch (e: any) {
    res.json({ ok: false, error: e?.stderr?.trim() || e?.message || String(e) });
  }
});

app.get('/api/config', async (_req, res) => {
  try {
    const config = await readConfig();
    const credentials = await readCredentials();

    // Start from the local credentials file, then override with the live profile
    // from Anthropic — `.credentials.json` keeps a stale `subscriptionType` after
    // a plan change until the next login, whereas the profile endpoint is current.
    let subscriptionType: string | null = credentials?.claudeAiOauth?.subscriptionType ?? null;
    let rateLimitTier: string | null = credentials?.claudeAiOauth?.rateLimitTier ?? null;

    // Auth mode — a Claude.ai subscription stores an OAuth token under
    // `claudeAiOauth` (used for live usage/profile); API / pay-as-you-go users
    // have no such block, so the subscription/plan framing doesn't apply.
    // File-based so it works identically in dev and Docker.
    const authMode: 'api' | 'subscription' = credentials?.claudeAiOauth?.accessToken
      ? 'subscription'
      : 'api';
    try {
      const profile = await fetchLiveProfile();
      const account = profile?.account ?? {};
      const org = profile?.organization ?? {};
      const tier = String(org.rate_limit_tier ?? '');
      if (account.has_claude_max) {
        subscriptionType = /20x/.test(tier) ? 'max_20x' : /5x/.test(tier) ? 'max_5x' : 'max';
      } else if (account.has_claude_pro) {
        subscriptionType = 'pro';
      } else if (account.uuid) {
        subscriptionType = 'free';
      }
      if (org.rate_limit_tier) rateLimitTier = org.rate_limit_tier;
    } catch {
      // Offline or expired token — keep the values read from the local file.
    }

    const merged = { ...config, subscriptionType, rateLimitTier, authMode };
    res.json(wrap(merged, Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/stats/summary', async (_req, res) => {
  try {
    const stats = await readStatsSummary();
    res.json(wrap(stats, Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Session history is derived live from the JSONL transcripts (insights scan)
// joined with token stats from the main event scan. The legacy
// `usage-data/session-meta/*.json` sidecar is used only as optional enrichment
// for fields the transcript can't reconstruct (lines added/removed, languages),
// because Claude Code stopped writing those sidecars — relying on them froze
// this list. See readSessionMetas() / scan.ts.
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

app.get('/api/sessions', async (req, res) => {
  try {
    const source = parseSource(req.query.source);
    const { events } = await getEvents();
    const { insights } = await getInsights();
    const sidecar = await readSessionMetas();

    // Token splits per session from the main event scan.
    const eventStats = new Map<string, {
      inputTokens: number;
      outputTokens: number;
      cacheCreateTokens: number;
      cacheReadTokens: number;
      totalTokens: number;
      effectiveTokens: number;
    }>();

    for (const e of events) {
      if (!e.sessionId) continue;
      let stats = eventStats.get(e.sessionId);
      if (!stats) {
        stats = {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreateTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 0,
          effectiveTokens: 0,
        };
        eventStats.set(e.sessionId, stats);
      }
      stats.inputTokens += e.inputTokens;
      stats.outputTokens += e.outputTokens;
      stats.cacheCreateTokens += e.cacheCreateTokens;
      stats.cacheReadTokens += e.cacheReadTokens;
      stats.totalTokens += e.inputTokens + e.outputTokens + e.cacheCreateTokens + e.cacheReadTokens;
      stats.effectiveTokens += e.inputTokens + e.outputTokens + e.cacheCreateTokens;
    }

    // Per-session tool counts + distinct modified files from main-thread tool calls.
    const toolAgg = new Map<string, { counts: Record<string, number>; files: Set<string> }>();
    for (const tc of insights.toolCalls) {
      if (tc.isSidechain || !tc.sessionId) continue; // count main thread only
      let a = toolAgg.get(tc.sessionId);
      if (!a) { a = { counts: {}, files: new Set() }; toolAgg.set(tc.sessionId, a); }
      a.counts[tc.name] = (a.counts[tc.name] ?? 0) + 1;
      if (WRITE_TOOLS.has(tc.name) && tc.filePath) a.files.add(tc.filePath);
    }

    const sidecarById = new Map(sidecar.map((s) => [s.session_id, s]));

    const result = [];
    for (const sm of insights.sessionsMeta.values()) {
      if (sm.isSidechain || !sm.sessionId) continue; // skip subagent-only sessions
      if (sm.assistantMsgs === 0) continue;           // skip empty/aborted shells
      if (source !== 'all' && sm.source !== source) continue; // surface filter

      const stats = eventStats.get(sm.sessionId);
      const agg = toolAgg.get(sm.sessionId);
      const side = sidecarById.get(sm.sessionId);

      const input = stats?.inputTokens ?? 0;
      const output = stats?.outputTokens ?? 0;
      const cacheCreate = stats?.cacheCreateTokens ?? 0;
      const cacheRead = stats?.cacheReadTokens ?? 0;
      const effective = stats?.effectiveTokens ?? sm.effectiveTokens;
      const total = stats?.totalTokens ?? sm.effectiveTokens;

      result.push({
        session_id: sm.sessionId,
        source: sm.source,
        project_path: sm.projectPath,
        start_time: new Date(sm.firstTs).toISOString(),
        duration_minutes: Math.max(0, Math.round((sm.lastTs - sm.firstTs) / 60000)),
        user_message_count: sm.turns,
        assistant_message_count: sm.assistantMsgs,
        tool_counts: agg?.counts ?? {},
        languages: side?.languages ?? {},
        git_commits: sm.gitCommits,
        git_pushes: sm.gitPushes,
        input_tokens: input,
        output_tokens: output,
        cache_create_tokens: cacheCreate,
        cache_read_tokens: cacheRead,
        effective_tokens: effective,
        total_tokens: total,
        first_prompt: (side?.first_prompt as string) || sm.firstPrompt || '',
        user_interruption_count: side?.user_interruptions,
        tool_errors: sm.errorCount,
        files_modified: agg?.files.size ?? side?.files_modified ?? 0,
        lines_added: side?.lines_added ?? 0,
        lines_removed: side?.lines_removed ?? 0,
      });
    }

    // Preserve older sessions whose transcripts are gone from disk but whose
    // sidecar metadata survives — append them so the list never regresses.
    // Sidecars are Claude Code only, so skip them when scoped to Cowork.
    const liveIds = new Set(result.map((r) => r.session_id));
    for (const s of sidecar) {
      if (source === 'cowork') break;
      if (liveIds.has(s.session_id)) continue;
      const stats = eventStats.get(s.session_id);
      const in_tok = s.input_tokens ?? 0;
      const out_tok = s.output_tokens ?? 0;
      result.push({
        session_id: s.session_id,
        source: 'code' as const,
        project_path: s.project_path,
        start_time: s.start_time,
        duration_minutes: s.duration_minutes ?? 0,
        user_message_count: s.user_message_count ?? 0,
        assistant_message_count: s.assistant_message_count ?? 0,
        tool_counts: s.tool_counts ?? {},
        languages: s.languages ?? {},
        git_commits: s.git_commits ?? 0,
        git_pushes: s.git_pushes ?? 0,
        input_tokens: stats?.inputTokens ?? in_tok,
        output_tokens: stats?.outputTokens ?? out_tok,
        cache_create_tokens: stats?.cacheCreateTokens ?? 0,
        cache_read_tokens: stats?.cacheReadTokens ?? 0,
        effective_tokens: stats?.effectiveTokens ?? in_tok + out_tok,
        total_tokens: stats?.totalTokens ?? in_tok + out_tok,
        first_prompt: (s.first_prompt as string) ?? '',
        user_interruption_count: s.user_interruptions,
        tool_errors: s.tool_errors,
        files_modified: s.files_modified ?? 0,
        lines_added: s.lines_added ?? 0,
        lines_removed: s.lines_removed ?? 0,
      });
    }

    result.sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time));
    res.json(wrap(result, Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Reports which usage surfaces have local data. The frontend gates all Cowork
// UI (source toggle, Sources card, ?source= params) on cowork.available so that
// Code-only users see exactly the original dashboard.
app.get('/api/sources', async (_req, res) => {
  try {
    const { events, computedAt } = await getEvents();
    let codeN = 0, coworkN = 0, codeLast = 0, coworkLast = 0;
    for (const e of events) {
      if (e.source === 'cowork') { coworkN++; if (e.ts > coworkLast) coworkLast = e.ts; }
      else { codeN++; if (e.ts > codeLast) codeLast = e.ts; }
    }
    res.json(wrap({
      code: { events: codeN, lastTs: codeLast },
      cowork: { available: coworkN > 0, events: coworkN, lastTs: coworkLast },
    }, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/usage/live', async (_req, res) => {
  try {
    const liveUsage = await fetchLiveUsage();
    res.json(wrap(liveUsage, Date.now()));
  } catch (e: any) {
    res.json(wrap({ error: e.message || String(e) }, Date.now()));
  }
});


app.get('/api/usage/recent', async (req, res) => {
  try {
    const hours = Math.max(1, Math.min(72, Number(req.query.hours ?? 12)));
    const { events, computedAt } = await getEvents();
    const scoped = filterSource(events, parseSource(req.query.source));
    res.json(wrap(buildRecent(scoped, Date.now(), hours), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/usage/weekly', async (req, res) => {
  try {
    const days = Math.max(7, Math.min(28, Number(req.query.days ?? 7)));
    const { events, computedAt } = await getEvents();
    const scoped = filterSource(events, parseSource(req.query.source));
    res.json(wrap(buildWeekly(scoped, Date.now(), days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/usage/models', async (req, res) => {
  try {
    const days = Math.max(1, Math.min(31, Number(req.query.days ?? 7)));
    const { events, computedAt } = await getEvents();
    const scoped = filterSource(events, parseSource(req.query.source));
    res.json(wrap(buildModels(scoped, Date.now(), days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/activity', async (req, res) => {
  try {
    const days = Math.max(7, Math.min(180, Number(req.query.days ?? 126)));
    const { events, computedAt } = await getEvents();
    const scoped = filterSource(events, parseSource(req.query.source));
    const stats = await readStatsSummary();
    res.json(wrap(buildActivity(scoped, Date.now(), days, stats), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/tools', async (req, res) => {
  try {
    const days = Math.max(1, Math.min(31, Number(req.query.days ?? 7)));
    const { events, computedAt } = await getEvents();
    const scoped = filterSource(events, parseSource(req.query.source));
    res.json(wrap(buildTools(scoped, Date.now(), days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/heatmap', async (req, res) => {
  try {
    const days = Math.max(7, Math.min(365, Number(req.query.days ?? 90)));
    const { events, computedAt } = await getEvents();
    const scoped = filterSource(events, parseSource(req.query.source));
    res.json(wrap(buildHourlyHeatmap(scoped, Date.now(), days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    const days = Math.max(7, Math.min(365, Number(req.query.days ?? 30)));
    const { events, computedAt } = await getEvents();
    // buildProjectStats already drops cowork; the source filter keeps behavior
    // consistent when the UI explicitly scopes to one surface.
    const scoped = filterSource(events, parseSource(req.query.source));
    res.json(wrap(buildProjectStats(scoped, Date.now(), days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ---------------------------------------------------------------------------
// Insights routes
// ---------------------------------------------------------------------------

function clampDays(raw: unknown, def = 7): number {
  return Math.max(1, Math.min(90, Number(raw ?? def)));
}

app.get('/api/insights/errors', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const scoped = scopeInsights(insights, parseSource(req.query.source));
    res.json(wrap(buildErrors(scoped, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/retries', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const scoped = scopeInsights(insights, parseSource(req.query.source));
    res.json(wrap(buildRetries(scoped, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/languages', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const scoped = scopeInsights(insights, parseSource(req.query.source));
    res.json(wrap(buildLanguages(scoped, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/branches', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const scoped = scopeInsights(insights, parseSource(req.query.source));
    res.json(wrap(buildBranches(scoped, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/mcp', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const scoped = scopeInsights(insights, parseSource(req.query.source));
    res.json(wrap(buildMcp(scoped, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/complexity', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const scoped = scopeInsights(insights, parseSource(req.query.source));
    res.json(wrap(buildComplexity(scoped, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/yield', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const scoped = scopeInsights(insights, parseSource(req.query.source));
    res.json(wrap(buildYield(scoped, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/rejections', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const scoped = scopeInsights(insights, parseSource(req.query.source));
    res.json(wrap(buildRejections(scoped, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/subagents', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const scoped = scopeInsights(insights, parseSource(req.query.source));
    res.json(wrap(buildSubagentStats(scoped, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// File churn — most-edited files (Edit/Write/MultiEdit) over the window.
app.get('/api/insights/churn', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const scoped = scopeInsights(insights, parseSource(req.query.source));
    res.json(wrap(buildFileChurn(scoped, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Slash-command / skill usage from history.jsonl (no source filter).
app.get('/api/insights/commands', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    res.json(wrap(await getCommandUsage(days), Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/subagents/live', async (_req, res) => {
  try {
    const data = await getLiveSubagents();
    res.json(wrap(data, Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Dynamic workflows: live runs + recent completed runs (code root only).
app.get('/api/workflows', async (_req, res) => {
  try {
    const data = await getWorkflows();
    res.json(wrap(data, Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ---------------------------------------------------------------------------
// AI Insights — chat over usage aggregates + per-section "explain this".
// Backend: `claude -p` CLI when available, else Anthropic API (OAuth/api-key).
// ---------------------------------------------------------------------------

const MAX_QUESTION = 2000;
const MAX_HISTORY = 12;
const MAX_SECTION_BYTES = 64 * 1024;

function sendAiError(res: express.Response, e: unknown) {
  if (e instanceof AiUnavailableError) return void res.status(503).json({ error: e.message });
  if (e instanceof AiTokenRejectedError) return void res.status(502).json({ error: e.message });
  if (e instanceof AiCallError) return void res.status(502).json({ error: e.message });
  const msg = e instanceof Error ? e.message : String(e);
  if (/fetch failed|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|aborted|timeout/i.test(msg))
    return void res.status(502).json({ error: 'Could not reach the AI provider (network error or timeout). Check your connection and API key.' });
  res.status(500).json({ error: msg });
}

/** Parse + clamp a client-supplied chat history array. */
function parseHistory(raw: any): ChatTurn[] {
  return (Array.isArray(raw) ? raw : [])
    .slice(-MAX_HISTORY)
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
}

/** Best-effort extraction of a string[] of follow-up questions from model text. */
function parseSuggestions(text: string): string[] {
  if (!text) return [];
  let arr: unknown;
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try {
      arr = JSON.parse(text.slice(start, end + 1));
    } catch {
      /* fall through to line parsing */
    }
  }
  let out: string[];
  if (Array.isArray(arr)) {
    out = arr.filter((x): x is string => typeof x === 'string');
  } else {
    out = text
      .split('\n')
      .map((l) => l.replace(/^[\s\-*\d.)"']+/, '').replace(/["',]+$/, '').trim())
      .filter((l) => l.length > 0 && l.length < 120);
  }
  return out.map((s) => s.trim()).filter(Boolean).slice(0, 4);
}

/** Validate client-supplied AI credentials (Settings → AI Insights). */
function parseAiCreds(raw: any): AiCreds | null {
  if (!raw || typeof raw !== 'object') return null;
  const provider = raw.provider;
  const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '';
  const model = typeof raw.model === 'string' ? raw.model.trim() : '';
  if ((provider === 'claude' || provider === 'openai' || provider === 'gemini') && apiKey && model) {
    return { provider, model, apiKey };
  }
  return null;
}

app.get('/api/ai/status', async (_req, res) => {
  try {
    res.json(wrap(await resolveBackend(), Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const question = String(req.body?.question ?? '').trim().slice(0, MAX_QUESTION);
    if (question.length < 2) {
      res.status(400).json({ error: 'question required' });
      return;
    }
    const history = parseHistory(req.body?.history);
    const ctx = await buildAiContext();
    const creds = parseAiCreds(req.body?.config);
    // Stream the answer as chunked text/plain. Headers flush on the first delta;
    // an error before any delta is still sent as JSON (headers not yet sent).
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    await runAiStream(
      { system: CHAT_SYSTEM, user: buildChatUserMessage(ctx, question, history) },
      creds,
      {
        onStart: (backend) => res.setHeader('X-AI-Backend', backend),
        onDelta: (t) => res.write(t),
      },
    );
    res.end();
  } catch (e) {
    if (!res.headersSent) sendAiError(res, e);
    else res.end();
  }
});

app.post('/api/ai/insight', async (req, res) => {
  try {
    const section = String(req.body?.section ?? '').trim().slice(0, 40);
    if (!section) {
      res.status(400).json({ error: 'section required' });
      return;
    }
    const data = req.body?.data;
    if (JSON.stringify(data ?? null).length > MAX_SECTION_BYTES) {
      res.status(413).json({ error: 'section data too large' });
      return;
    }
    const creds = parseAiCreds(req.body?.config);
    const { text, backend } = await runAi(
      {
        system: SECTION_SYSTEM,
        user: buildSectionUserMessage(section, data),
        maxTokens: 400,
      },
      creds,
    );
    res.json(wrap({ insight: text, backend }, Date.now()));
  } catch (e) {
    sendAiError(res, e);
  }
});

// Conversation-aware follow-up question suggestions (chips under the chat).
app.post('/api/ai/suggestions', async (req, res) => {
  try {
    const history = parseHistory(req.body?.history);
    if (history.length === 0) {
      res.json(wrap({ suggestions: [] }, Date.now()));
      return;
    }
    const ctx = await buildAiContext();
    const creds = parseAiCreds(req.body?.config);
    const { text } = await runAi(
      { system: SUGGEST_SYSTEM, user: buildSuggestMessage(ctx, history), maxTokens: 200 },
      creds,
    );
    res.json(wrap({ suggestions: parseSuggestions(text) }, Date.now()));
  } catch (e) {
    sendAiError(res, e);
  }
});

// ---------------------------------------------------------------------------
// Workspace: tasks + plans, and plugin / MCP inventory.
// ---------------------------------------------------------------------------

app.get('/api/workspace/tasks', async (_req, res) => {
  try {
    res.json(wrap(await getWorkspaceTasks(), Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/workspace/inventory', async (_req, res) => {
  try {
    res.json(wrap(await getInventory(), Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ---------------------------------------------------------------------------
// Session transcript route
// ---------------------------------------------------------------------------

app.get('/api/sessions/:id/transcript', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { insights } = await getInsights();
    const sm = insights.sessionsMeta.get(sessionId);
    if (!sm) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Parse the JSONL file on demand
    const file = sm.file;
    interface Turn {
      role: 'user' | 'assistant';
      ts: number;
      text: string;
      tools: { name: string; brief: string }[];
      model?: string;
      effectiveTokens?: number;
    }
    const turns: Turn[] = [];
    let compactions = 0;

    const rl = createInterface({
      input: createReadStream(file, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line || line.length < 2) continue;
      let obj: any;
      try { obj = JSON.parse(line); } catch { continue; }
      if (obj.sessionId !== sessionId && obj.session_id !== sessionId) continue;

      const ts = Date.parse(obj.timestamp ?? '');
      if (Number.isNaN(ts)) continue;

      if (obj.type === 'summary') {
        compactions++;
        continue;
      }

      if (obj.type === 'user' && obj.message?.role === 'user') {
        const content = obj.message.content;
        let text = '';
        let hasToolResultOnly = true;

        if (typeof content === 'string') {
          text = content.slice(0, 600);
          hasToolResultOnly = false;
          if (/continued from a previous conversation/i.test(content)) compactions++;
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === 'text' && typeof block.text === 'string') {
              text += block.text.slice(0, 600 - text.length);
              hasToolResultOnly = false;
              if (/continued from a previous conversation/i.test(block.text)) compactions++;
            }
          }
          const hasNonResult = content.some((b: any) => b?.type !== 'tool_result');
          hasToolResultOnly = !hasNonResult;
        }

        // Skip user entries that are tool_result-only
        if (hasToolResultOnly) continue;

        turns.push({ role: 'user', ts, text: text.slice(0, 600), tools: [] });
      }

      if (obj.type === 'assistant' && obj.message?.role === 'assistant') {
        const usage = obj.message?.usage;
        const model: string | undefined = obj.message?.model;
        const inTok = usage ? (usage.input_tokens ?? 0) : 0;
        const outTok = usage ? (usage.output_tokens ?? 0) : 0;
        const cacheCreate = usage ? (usage.cache_creation_input_tokens ?? 0) : 0;
        const effectiveTokens = inTok + outTok + cacheCreate;

        let text = '';
        const tools: { name: string; brief: string }[] = [];
        const msgContent = obj.message?.content;

        if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            if (block?.type === 'text' && typeof block.text === 'string') {
              text += block.text.slice(0, 600 - text.length);
            }
            if (block?.type === 'tool_use') {
              const brief = block.input?.description ?? block.input?.command ?? block.input?.file_path ?? '';
              tools.push({ name: block.name ?? '', brief: String(brief).slice(0, 80) });
            }
          }
        } else if (typeof msgContent === 'string') {
          text = msgContent.slice(0, 600);
        }

        turns.push({ role: 'assistant', ts, text: text.slice(0, 600), tools, model, effectiveTokens });
      }
    }

    const totalTurns = turns.length;
    let finalTurns = turns;
    let truncated = false;

    if (totalTurns > 300) {
      finalTurns = [...turns.slice(0, 50), ...turns.slice(totalTurns - 250)];
      truncated = true;
    }

    res.json(wrap({ sessionId, turns: finalTurns, compactions, totalTurns, truncated: truncated || undefined }, Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ---------------------------------------------------------------------------
// Search route
// ---------------------------------------------------------------------------

app.get('/api/search', async (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) {
      res.status(400).json({ error: 'q must be at least 2 characters' });
      return;
    }
    const days = clampDays(req.query.days, 30);
    const from = Date.now() - days * 24 * 3600_000;

    const { insights } = await getInsights();
    const results: Array<{ sessionId: string; project: string; date: string; snippet: string; matches: number }> = [];

    const qLower = q.toLowerCase();

    for (const [sessionId, corpus] of insights.searchCorpus) {
      const sm = insights.sessionsMeta.get(sessionId);
      if (!sm) continue;
      if (sm.lastTs < from) continue;

      const corpusLower = corpus.toLowerCase();
      let count = 0;
      let idx = 0;
      let firstIdx = -1;
      while ((idx = corpusLower.indexOf(qLower, idx)) !== -1) {
        count++;
        if (firstIdx === -1) firstIdx = idx;
        idx += qLower.length;
      }
      if (count === 0) continue;

      // Build snippet: match ±60 chars
      const start = Math.max(0, firstIdx - 60);
      const end = Math.min(corpus.length, firstIdx + q.length + 60);
      const snippet = (start > 0 ? '…' : '') + corpus.slice(start, end) + (end < corpus.length ? '…' : '');

      const projectName = sm.projectPath
        ? sm.projectPath.split(/[\\\/]/).filter(Boolean).pop() ?? sm.projectPath
        : 'unknown';
      const d = new Date(sm.firstTs);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      results.push({ sessionId, project: projectName, date, snippet, matches: count });
    }

    results.sort((a, b) => b.matches - a.matches);
    res.json(wrap(results.slice(0, 30), Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Serve the built frontend when present (production / Docker). In dev the Vite
// server handles the UI and proxies /api here, so dist usually won't exist.
const distDir = join(process.cwd(), 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback: any non-/api route returns index.html.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT} (claudeDir=${claudeDir()})`);
  // Prime the event + insights caches in the background so the first request
  // (often /api/sessions, which needs both) doesn't pay the full cold-scan cost
  // — that scan of ~100MB+ of JSONL can take several seconds. Errors are ignored;
  // the endpoints will simply scan on demand if this fails.
  void getEvents().catch(() => {});
  void getInsights().catch(() => {});
});
