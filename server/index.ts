import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import { getEvents } from './cache.ts';
import { buildRecent, buildWeekly, buildModels, buildActivity, buildTools } from './aggregate.ts';
import { claudeDir, readConfig, readCredentials, readStatsSummary, readSessionMetas, fetchLiveUsage } from './scan.ts';

const app = express();
const PORT = Number(process.env.SERVER_PORT ?? 8787);

function wrap(data: unknown, computedAt: number) {
  return { data, computedAt, claudeDir: claudeDir() };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, claudeDir: claudeDir() });
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
