import express from 'express';
import { getEvents } from './cache.ts';
import { buildRecent, buildWeekly, buildModels, buildActivity, buildTools } from './aggregate.ts';
import { claudeDir } from './scan.ts';

const app = express();
const PORT = Number(process.env.SERVER_PORT ?? 8787);

function wrap(data: unknown, computedAt: number) {
  return { data, computedAt, claudeDir: claudeDir() };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, claudeDir: claudeDir() });
});

app.get('/api/usage/recent', async (_req, res) => {
  try {
    const { events, computedAt } = await getEvents();
    res.json(wrap(buildRecent(events, Date.now()), computedAt));
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
    res.json(wrap(buildActivity(events, Date.now(), days), computedAt));
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

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT} (claudeDir=${claudeDir()})`);
});
