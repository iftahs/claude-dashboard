import { existsSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import express from 'express';
import { getEvents } from './cache.ts';
import { buildRecent, buildWeekly, buildModels, buildActivity, buildTools, buildHourlyHeatmap, buildProjectStats } from './aggregate.ts';
import { claudeDir, readConfig, readCredentials, readStatsSummary, readSessionMetas, fetchLiveUsage } from './scan.ts';
import { getInsights } from './insights-scan.ts';
import {
  buildErrors, buildRetries, buildLanguages, buildBranches, buildMcp,
  buildComplexity, buildYield, buildRejections, buildSubagentStats,
} from './insights.ts';
import { getLiveSubagents } from './subagents-live.ts';
import { getVersionInfo, isDocker } from './version.ts';

const execAsync = promisify(exec);

const app = express();
const PORT = Number(process.env.SERVER_PORT ?? 8787);

function wrap(data: unknown, computedAt: number) {
  return { data, computedAt, claudeDir: claudeDir() };
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
    const merged = {
      ...config,
      subscriptionType: credentials?.claudeAiOauth?.subscriptionType ?? null,
      rateLimitTier: credentials?.claudeAiOauth?.rateLimitTier ?? null,
    };
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

app.get('/api/sessions', async (_req, res) => {
  try {
    const sessions = await readSessionMetas();
    const { events } = await getEvents();

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

    const enrichedSessions = sessions.map((s) => {
      const stats = eventStats.get(s.session_id);
      if (stats) {
        return {
          ...s,
          input_tokens: stats.inputTokens,
          output_tokens: stats.outputTokens,
          cache_create_tokens: stats.cacheCreateTokens,
          cache_read_tokens: stats.cacheReadTokens,
          effective_tokens: stats.effectiveTokens,
          total_tokens: stats.totalTokens,
        };
      } else {
        const in_tok = s.input_tokens ?? 0;
        const out_tok = s.output_tokens ?? 0;
        return {
          ...s,
          cache_create_tokens: 0,
          cache_read_tokens: 0,
          effective_tokens: in_tok + out_tok,
          total_tokens: in_tok + out_tok,
        };
      }
    });

    res.json(wrap(enrichedSessions, Date.now()));
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
    res.json(wrap(buildRecent(events, Date.now(), hours), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/usage/weekly', async (req, res) => {
  try {
    const days = Math.max(7, Math.min(28, Number(req.query.days ?? 7)));
    const { events, computedAt } = await getEvents();
    res.json(wrap(buildWeekly(events, Date.now(), days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/usage/models', async (req, res) => {
  try {
    const days = Math.max(1, Math.min(31, Number(req.query.days ?? 7)));
    const { events, computedAt } = await getEvents();
    res.json(wrap(buildModels(events, Date.now(), days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/activity', async (req, res) => {
  try {
    const days = Math.max(7, Math.min(180, Number(req.query.days ?? 126)));
    const { events, computedAt } = await getEvents();
    const stats = await readStatsSummary();
    res.json(wrap(buildActivity(events, Date.now(), days, stats), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/tools', async (req, res) => {
  try {
    const days = Math.max(1, Math.min(31, Number(req.query.days ?? 7)));
    const { events, computedAt } = await getEvents();
    res.json(wrap(buildTools(events, Date.now(), days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/heatmap', async (req, res) => {
  try {
    const days = Math.max(7, Math.min(365, Number(req.query.days ?? 90)));
    const { events, computedAt } = await getEvents();
    res.json(wrap(buildHourlyHeatmap(events, Date.now(), days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    const days = Math.max(7, Math.min(365, Number(req.query.days ?? 30)));
    const { events, computedAt } = await getEvents();
    res.json(wrap(buildProjectStats(events, Date.now(), days), computedAt));
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
    res.json(wrap(buildErrors(insights, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/retries', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    res.json(wrap(buildRetries(insights, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/languages', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    res.json(wrap(buildLanguages(insights, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/branches', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    res.json(wrap(buildBranches(insights, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/mcp', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    res.json(wrap(buildMcp(insights, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/complexity', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    res.json(wrap(buildComplexity(insights, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/yield', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    res.json(wrap(buildYield(insights, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/rejections', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    res.json(wrap(buildRejections(insights, days), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/subagents', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    res.json(wrap(buildSubagentStats(insights, days), computedAt));
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
});
