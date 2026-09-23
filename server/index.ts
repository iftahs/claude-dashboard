import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import express from 'express';
import { getEvents, eventsFingerprint } from './cache.ts';
import { buildRecent, buildWeekly, buildModels, buildActivity, buildHourlyHeatmap, buildProjectStats, buildUsageSummary, buildEffort, filterSource, statsCacheApplies, type SourceFilter, type UsageSummaryData } from './aggregate.ts';
import { claudeDir, readConfig, readCredentials, readStatsSummary, readSessionMetas, fetchLiveUsage, fetchLiveProfile, fetchLiveUsageFor, fetchLiveProfileFor, readAccountCredentials, expiredTokenMessage, detectLitellm, fetchLiteLlmSpend, MAX_WINDOW_DAYS } from './scan.ts';
import { getInsights, insightsFingerprint } from './insights-scan.ts';
import { archiveSummary, forgetArchivedHistory, primeData } from './data.ts';
import { memoBuilder } from './builder-cache.ts';
import {
  buildErrors, buildRetries, buildLanguages, buildBranches, buildMcp,
  buildComplexity, buildYield, buildRejections, buildSubagentStats, buildFileChurn, scopeInsights,
  buildTurnLatency, buildInsightsSummary, buildToolUsage, knownProjectRoots,
} from './insights.ts';
import { buildContributors } from './contributors.ts';
import { getCommandUsage } from './history.ts';
import { getWorkspaceTasks, getInventory, workspaceScope, type WorkspaceScope } from './workspace.ts';
import { readCodexConfig } from './codex-config.ts';
import { getLiveSubagents } from './subagents-live.ts';
import { fetchCodexUsage, fetchCodexProfile } from './codex-live.ts';
import { getLiveCodexAgents } from './codex-agents-live.ts';
import { readFile } from 'node:fs/promises';
import { computeCodexBlock, buildLimitHits } from './aggregate.ts';
import { codexDir, scanRoots } from './scan.ts';
import { hasCodexEvents, summarizeSources } from './sources.ts';
import type { CodexLiveData } from './codex-live.ts';
import { getWorkflows, getWorkflowStats } from './workflows.ts';
import { readCodexTitles } from './codex-titles.ts';
import { buildSessionRows, buildSessionSummary, legacyProjectPaths, searchSessions } from './sessions.ts';
import { readTranscript } from './transcript.ts';
import { getAgentDetail } from './workflow-agent-detail.ts';
import { runAi, runAiStream, resolveBackend, AiUnavailableError, AiTokenRejectedError, AiCallError, type AiCreds } from './ai.ts';
import { buildAiPayload, buildChatUserMessage, chatSystem, buildSectionUserMessage, sectionSystem, suggestSystem, buildSuggestMessage, type AiScope, type ChatTurn } from './ai-context.ts';
import { routeDatasets } from './ai-router.ts';
import { aiSource } from './ai-datasets.ts';
import { getVersionInfo, isDocker } from './version.ts';
import { allowedHosts, checkRequest, publicSettings } from './http-guard.ts';

const execAsync = promisify(exec);

const app = express();
const PORT = Number(process.env.SERVER_PORT ?? 8787);
// Loopback only on the host. The container must listen on every interface for
// Docker's port mapping to reach it; docker-compose then publishes the port on
// 127.0.0.1 unless DASHBOARD_BIND opts into LAN access.
const BIND_HOST = process.env.BIND_HOST?.trim() || (isDocker() ? '0.0.0.0' : '127.0.0.1');
const ALLOWED_HOSTS = allowedHosts(process.env.ALLOWED_HOSTS);

// Host (DNS-rebinding) and write (CSRF) checks run before anything else — before
// body parsing, static files and every route. See server/http-guard.ts.
app.use((req, res, next) => {
  const rejected = checkRequest(
    {
      method: req.method,
      host: req.headers.host,
      origin: req.headers.origin,
      contentType: req.headers['content-type'],
    },
    ALLOWED_HOSTS,
  );
  if (rejected) return void res.status(rejected.status).json({ error: rejected.error });
  next();
});
app.use(express.json({ limit: '1mb' }));

function wrap(data: unknown, computedAt: number) {
  return { data, computedAt, claudeDir: claudeDir() };
}

/** /api/sources' codex.available — what gates every Codex read and the "both" scope. */
async function codexHasData(): Promise<boolean> {
  return hasCodexEvents((await getEvents()).events);
}

/** Parse the optional ?source=all|claude|code|cowork|codex filter (default 'all'). */
function parseSource(raw: unknown): SourceFilter {
  return raw === 'code' || raw === 'cowork' || raw === 'codex' || raw === 'claude' ? raw : 'all';
}

/**
 * A numeric query/body param as an integer in [lo, hi]; `def` when it is absent
 * or not a number. Every `hours`/`days` goes through here, never a bare Number():
 *  - `?days=abc` is NaN, which slips through Math.min/Math.max, and a NaN window
 *    once hung the day-bucket loop until the process ran out of memory;
 *  - qs turns a repeated key (`?days=7&days=8`) into an array — the first wins;
 *  - rounding bounds builder-cache's keys: `days=10.5`, `10.51`, … would each
 *    pin a full builder output in the memo for the life of the process.
 */
function intParam(raw: unknown, def: number, lo: number, hi: number): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === undefined || v === null || v === '') return def;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
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
// It runs a shell command, so the JSON + Origin write check above is what stops
// a cross-site form from triggering it.
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

interface SubscriptionInfo {
  subscriptionType: string | null;
  rateLimitTier: string | null;
  seatTier: string | null;
  hasExtraUsageEnabled: boolean;
  email: string | null;
}

/**
 * Classify a live OAuth `/profile` response into plan/tier fields, falling back
 * to the values baked into the local credential blob when the profile is
 * unavailable (offline / expired token → pass `null`). Shared by `/api/config`
 * and `/api/accounts/live` so the has_claude_max / 5x / team / … rules live once.
 */
function classifySubscription(
  profile: any,
  fallback: { subscriptionType?: string | null; rateLimitTier?: string | null },
): SubscriptionInfo {
  let subscriptionType: string | null = fallback.subscriptionType ?? null;
  let rateLimitTier: string | null = fallback.rateLimitTier ?? null;
  const account = profile?.account ?? {};
  const org = profile?.organization ?? {};
  const tier = String(org.rate_limit_tier ?? '');
  if (account.has_claude_max) {
    subscriptionType = /20x/.test(tier) ? 'max_20x' : /5x/.test(tier) ? 'max_5x' : 'max';
  } else if (account.has_claude_pro) {
    subscriptionType = 'pro';
  } else if (/team/i.test(String(org.organization_type))) {
    subscriptionType = 'team';
  } else if (/enterprise/i.test(String(org.organization_type))) {
    subscriptionType = 'enterprise';
  } else if (account.uuid) {
    subscriptionType = 'free';
  }
  if (org.rate_limit_tier) rateLimitTier = org.rate_limit_tier;
  return {
    subscriptionType,
    rateLimitTier,
    seatTier: org.seat_tier ?? null,
    hasExtraUsageEnabled: !!org.has_extra_usage_enabled,
    email: account.email ?? account.email_address ?? null,
  };
}

app.get('/api/config', async (_req, res) => {
  try {
    const config = await readConfig();
    const credentials = await readCredentials();

    // Auth mode — a Claude.ai subscription stores an OAuth token under
    // `claudeAiOauth` (used for live usage/profile); API / pay-as-you-go users
    // have no such block, so the subscription/plan framing doesn't apply.
    // File-based so it works identically in dev and Docker.
    const authMode: 'api' | 'subscription' = credentials?.claudeAiOauth?.accessToken
      ? 'subscription'
      : 'api';

    // Start from the local credentials file, then override with the live profile
    // from Anthropic — `.credentials.json` keeps a stale `subscriptionType` after
    // a plan change until the next login, whereas the profile endpoint is current.
    let profile: any = null;
    try {
      profile = await fetchLiveProfile();
    } catch {
      // Offline or expired token — keep the values read from the local file.
    }
    const sub = classifySubscription(profile, {
      subscriptionType: credentials?.claudeAiOauth?.subscriptionType ?? null,
      rateLimitTier: credentials?.claudeAiOauth?.rateLimitTier ?? null,
    });

    // LiteLLM gateway detection (pure env read) — gates the "Actual billed" cost UI.
    const litellm = detectLitellm();

    // Allowlisted settings.json fields only — never the whole file (env keys,
    // apiKeyHelper and hook commands live there).
    const merged = {
      ...publicSettings(config),
      subscriptionType: sub.subscriptionType,
      rateLimitTier: sub.rateLimitTier,
      seatTier: sub.seatTier,
      hasExtraUsageEnabled: sub.hasExtraUsageEnabled,
      authMode,
      litellm,
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

// Session history is derived live from the JSONL transcripts (insights scan)
// joined with token stats from the main event scan (sessions.ts). The legacy
// `usage-data/session-meta/*.json` sidecar only adds fields the transcript can't
// reconstruct (languages) and keeps sessions whose transcripts are gone listed.
async function sessionRowsFor(source: SourceFilter) {
  const [{ events }, { insights }, sidecar, codexTitles] = await Promise.all([
    getEvents(), getInsights(), readSessionMetas(), readCodexTitles(),
  ]);
  return { rows: buildSessionRows(events, insights, sidecar, source, codexTitles), insights };
}

app.get('/api/sessions', async (req, res) => {
  try {
    const { rows } = await sessionRowsFor(parseSource(req.query.source));
    res.json(wrap(rows, Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// The Sessions tab's StatCard row — over exactly the rows /api/sessions lists
// for the same ?source=, with a Claude / Codex split for the Both view.
app.get('/api/sessions/summary', async (req, res) => {
  try {
    const { rows, insights } = await sessionRowsFor(parseSource(req.query.source));
    res.json(wrap(buildSessionSummary(rows, insights.turns), Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Reports which usage surfaces have local data, and the folder each is read
// from. The frontend gates all Cowork UI (source toggle, Sources card, ?source=
// params) on cowork.available and the platform switcher on codex.available, so
// Code-only users see exactly the original dashboard. The lifetime counts also
// decide the empty state and a Codex-only user's default platform; the dirs label
// the sidebar with the folder behind the platform on screen.
app.get('/api/sources', async (_req, res) => {
  try {
    const { events, computedAt } = await getEvents();
    const coworkRoot = scanRoots().find((r) => r.source === 'cowork')?.dir ?? null;
    res.json(wrap(summarizeSources(events, { claudeDir: claudeDir(), codexDir: codexDir(), coworkDir: coworkRoot }), computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Opt-in history archive (DASHBOARD_RETAIN_HISTORY=1): the slim rows of
// transcripts Claude Code's cleanup deleted. See event-store.ts.
app.get('/api/archive', async (_req, res) => {
  try {
    res.json(wrap(await archiveSummary(), Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Deletes the archive. A POST with a JSON body, so the CSRF guard above applies.
app.post('/api/archive/forget', async (_req, res) => {
  try {
    const ok = await forgetArchivedHistory();
    if (!ok) return void res.status(503).json({ error: 'The history archive could not be deleted (store unavailable).' });
    res.json(wrap(await archiveSummary(), Date.now()));
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

// Live plan/limits for EVERY logged-in account, so the Live tab can show which
// account still has quota. The token blob has no stable account id (org/account/
// email come only from the profile), so we resolve identity per captured token
// via the profile fetch, dedup to one entry per account (keeping the freshest /
// active token), then fetch each account's usage. Each token is failure-isolated:
// an expired/idle one yields an error marker instead of sinking the response. The
// frontend gates the multi-account UI on accounts.length > 1, so single-account
// users see no change.
app.get('/api/accounts/live', async (_req, res) => {
  try {
    const tokens = await readAccountCredentials();
    const now = Date.now();

    // 1. Resolve identity per token (profile is cached 30 min; expired tokens
    //    skip the network entirely).
    const resolved = await Promise.all(
      tokens.map(async (t) => {
        const oauth = t.claudeAiOauth;
        const expiresAt: number | undefined = oauth.expiresAt;
        const expired = !!expiresAt && now >= expiresAt;
        const profile = expired
          ? null
          : await fetchLiveProfileFor(oauth.accessToken, oauth.accessToken, expiresAt).catch(() => null);
        const account = profile?.account ?? {};
        const org = profile?.organization ?? {};
        // Stable identity when the profile resolves; otherwise a token-stable
        // fallback so the same token maps consistently while offline.
        const identity =
          account.uuid || org.uuid || account.email || account.email_address ||
          `token:${String(oauth.accessToken).slice(-12)}`;
        return { token: t, oauth, expiresAt, expired, profile, identity: String(identity) };
      }),
    );

    // 2. Dedup to one token per account — prefer the active token, else the
    //    freshest — so a refreshed/duplicate token doesn't create a second card.
    const byId = new Map<string, typeof resolved[number]>();
    for (const r of resolved) {
      const cur = byId.get(r.identity);
      const better =
        !cur ||
        (r.token.isActive && !cur.token.isActive) ||
        (r.token.isActive === cur.token.isActive && (r.oauth.expiresAt ?? 0) > (cur.oauth.expiresAt ?? 0));
      if (better) byId.set(r.identity, r);
    }

    // 3. Fetch usage per account and shape the response.
    const accounts = await Promise.all(
      [...byId.values()].map(async (r) => {
        const sub = classifySubscription(r.profile, {
          subscriptionType: r.oauth.subscriptionType ?? null,
          rateLimitTier: r.oauth.rateLimitTier ?? null,
        });
        const live = r.expired
          ? { error: expiredTokenMessage() }
          : await fetchLiveUsageFor(r.oauth.accessToken, r.oauth.accessToken, r.expiresAt).catch((e: any) => ({ error: e?.message || String(e) }));
        // Real accounts resolve to their email; only a profile-less token (offline
        // / invalid) falls back to plan + a short token discriminator.
        const shortId = r.identity.startsWith('token:') ? r.identity.slice(6, 12) : r.identity.slice(0, 6);
        const label = sub.email ?? (sub.subscriptionType ? `${sub.subscriptionType} · ${shortId}` : shortId);
        return {
          key: r.identity,
          organizationUuid: r.profile?.organization?.uuid ?? null,
          email: sub.email,
          label,
          subscriptionType: sub.subscriptionType,
          rateLimitTier: sub.rateLimitTier,
          live,
          expired: r.expired,
          isActive: r.token.isActive,
          capturedAt: r.token.capturedAt,
        };
      }),
    );

    // Only surface accounts with live usage right now — an idle account whose
    // snapshot expired (or a token that errored) carries no quota signal, so
    // showing it would just be an empty card. When this leaves ≤1 account the
    // frontend falls back to the original single-account view.
    const liveAccounts = accounts.filter((a) => !a.expired && !(a.live as any)?.error);

    // Active account first, then most-recently captured.
    liveAccounts.sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.capturedAt - a.capturedAt);
    res.json(wrap({ accounts: liveAccounts }, Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── OpenAI Codex (ChatGPT desktop) ──────────────────────────────────────────
// Live plan limits + profile stats reuse the token Codex stores in
// <codexDir>/auth.json (no refresh flow, PII stripped); running threads come
// from the rollout files. Like /api/usage/live, failures of the two network
// routes return wrap({ error }) at HTTP 200 so the frontend can show the reason.
// See server/codex-live.ts and server/codex-agents-live.ts.

app.get('/api/codex/live', async (_req, res) => {
  try {
    res.json(wrap(await fetchCodexUsage(), Date.now()));
  } catch (e: any) {
    res.json(wrap({ error: e.message || String(e) }, Date.now()));
  }
});

app.get('/api/codex/profile', async (_req, res) => {
  try {
    res.json(wrap(await fetchCodexProfile(), Date.now()));
  } catch (e: any) {
    res.json(wrap({ error: e.message || String(e) }, Date.now()));
  }
});

app.get('/api/codex/agents/live', async (_req, res) => {
  try {
    res.json(wrap(await getLiveCodexAgents(), Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/**
 * How Codex is signed in, from `<codexDir>/auth.json`: 'chatgpt' (a ChatGPT plan
 * token), 'apikey' (pay-as-you-go OpenAI key, no plan windows) or null (no login).
 * Reads key NAMES only — neither the token nor the key ever leaves this function.
 */
async function readCodexAuthMode(): Promise<'chatgpt' | 'apikey' | null> {
  try {
    const json = JSON.parse(await readFile(join(codexDir(), 'auth.json'), 'utf8'));
    const mode = typeof json?.auth_mode === 'string' ? json.auth_mode.toLowerCase().replace(/[^a-z]/g, '') : '';
    const hasToken = typeof json?.tokens?.access_token === 'string' && !!json.tokens.access_token;
    const hasKey = typeof json?.OPENAI_API_KEY === 'string' && !!json.OPENAI_API_KEY;
    if (mode === 'apikey') return 'apikey';
    if (mode === 'chatgpt' || hasToken) return 'chatgpt';
    return hasKey ? 'apikey' : null;
  } catch {
    return null;
  }
}

/**
 * The Codex window the block is placed on, fetched at most every 30 s — failures
 * included: fetchCodexUsage caches only successes, and with no login its passive
 * fallback tail-reads every rollout, which a 5 s Live poll must not repeat.
 */
let codexWindowState: { at: number; live: CodexLiveData | null; authMode: 'chatgpt' | 'apikey' | null } | null = null;
async function codexWindow() {
  if (codexWindowState && Date.now() - codexWindowState.at < 30_000) return codexWindowState;
  const [live, authMode] = await Promise.all([fetchCodexUsage().catch(() => null), readCodexAuthMode()]);
  codexWindowState = { at: Date.now(), live, authMode };
  return codexWindowState;
}

// The Codex counterpart of /api/usage/recent's activeBlock, for the Live tab's
// gauge: local Codex usage inside the current rate-limit window. Not memoised —
// the window moves with the live reset time, not with the event fingerprint.
// Computed even when the live limits are unavailable (local anchor).
app.get('/api/codex/block', async (_req, res) => {
  try {
    const { events, computedAt } = await getEvents();
    const { live, authMode } = await codexWindow();
    const block = computeCodexBlock(filterSource(events, 'codex'), live && !live.error ? live : null, computedAt);
    res.json(wrap({ ...block, apiKey: authMode === 'apikey' }, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Usage-limit hits (requests the provider refused at a limit), grouped into
// episodes — the Live tab's "Limit hits" card, on every platform. 7d/30d counts
// are always included; `days` bounds the episode list.
app.get('/api/insights/limits', async (req, res) => {
  try {
    const days = intParam(req.query.days, 30, 1, MAX_WINDOW_DAYS);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('limits', [days, source], insightsFingerprint(), () =>
      buildLimitHits(scopeInsights(insights, source).limitHits, computedAt, days),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Actual billed cost from a LiteLLM gateway (when configured): month-to-date,
// previous-month same-period total, and a per-day breakdown over the selected
// window (days clamp matches /api/usage/weekly). Like /api/usage/live, failures
// return wrap({ error }) at HTTP 200 so the frontend just hides the cards.
app.get('/api/usage/litellm', async (req, res) => {
  try {
    const days = intParam(req.query.days, 7, 7, MAX_WINDOW_DAYS);
    res.json(wrap(await fetchLiteLlmSpend(days), Date.now()));
  } catch (e: any) {
    res.json(wrap({ error: e.message || String(e) }, Date.now()));
  }
});


app.get('/api/usage/recent', async (req, res) => {
  try {
    const hours = intParam(req.query.hours, 12, 1, 72);
    const { events, computedAt } = await getEvents();
    const source = parseSource(req.query.source);
    const data = memoBuilder('recent', [hours, source], eventsFingerprint(), () =>
      buildRecent(filterSource(events, source), computedAt, hours),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/usage/weekly', async (req, res) => {
  try {
    const days = intParam(req.query.days, 7, 7, MAX_WINDOW_DAYS);
    const { events, computedAt } = await getEvents();
    const source = parseSource(req.query.source);
    const data = memoBuilder('weekly', [days, source], eventsFingerprint(), () =>
      buildWeekly(filterSource(events, source), computedAt, days),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/usage/models', async (req, res) => {
  try {
    const days = intParam(req.query.days, 7, 1, 31);
    const { events, computedAt } = await getEvents();
    const source = parseSource(req.query.source);
    const data = memoBuilder('models', [days, source], eventsFingerprint(), () =>
      buildModels(filterSource(events, source), computedAt, days),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Lifetime activity summary for the Trends "Activity summary" row: lifetime
// tokens, peak day, streaks and active days over EVERY event of the scoped
// history (no window). The unscoped request — the Both platform — also carries
// the Claude / Codex split its cards show.
app.get('/api/usage/summary', async (req, res) => {
  try {
    const { events, computedAt } = await getEvents();
    const source = parseSource(req.query.source);
    const data = memoBuilder('summary', [source], eventsFingerprint(), (): UsageSummaryData => {
      const scoped = filterSource(events, source);
      const summary: UsageSummaryData = buildUsageSummary(scoped, computedAt);
      if (source === 'all') {
        summary.byPlatform = {
          claude: buildUsageSummary(filterSource(events, 'claude'), computedAt),
          codex: buildUsageSummary(filterSource(events, 'codex'), computedAt),
        };
      }
      return summary;
    });
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Reasoning effort × model for the Models "Reasoning effort" card: effective
// tokens and estimated cost per effort level, overall and per model, plus the
// reasoning (thinking) share of output over the responses that report it.
app.get('/api/usage/effort', async (req, res) => {
  try {
    const days = intParam(req.query.days, 7, 1, MAX_WINDOW_DAYS);
    const { events, computedAt } = await getEvents();
    const source = parseSource(req.query.source);
    const data = memoBuilder('effort', [days, source], eventsFingerprint(), () =>
      buildEffort(filterSource(events, source), computedAt, days),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// "What's contributing to your limits usage?" — cost-weighted Day/Week breakdown,
// replicating the Claude CLI panel. Joins priced events (cost/context) with insights
// (session duration + subagent type). Both windows are returned in one payload.
app.get('/api/usage/contributors', async (req, res) => {
  try {
    const { events, computedAt } = await getEvents();
    const source = parseSource(req.query.source);
    const data = memoBuilder('contributors', [source], eventsFingerprint(), () =>
      buildContributors(filterSource(events, source), computedAt),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ?utc=1 buckets by UTC day (no stats-cache fallback) so the Trends "Server vs
// local" chart can line the local rollouts up with OpenAI's UTC-day counts; the
// window reaches the Trends maximum (MAX_WINDOW_DAYS) for the same reason.
app.get('/api/activity', async (req, res) => {
  try {
    const days = intParam(req.query.days, 126, 7, MAX_WINDOW_DAYS);
    const utc = req.query.utc === '1' || req.query.utc === 'true';
    const { events, computedAt } = await getEvents();
    const source = parseSource(req.query.source);
    const stats = !utc && statsCacheApplies(source) ? await readStatsSummary() : undefined;
    // stats-cache is only a fallback for days with no live data and is itself
    // stale, so keying on the events fingerprint is sufficient.
    const data = memoBuilder('activity', [days, source, utc ? 'utc' : 'local'], eventsFingerprint(), () =>
      buildActivity(filterSource(events, source), computedAt, days, stats, { utc }),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/heatmap', async (req, res) => {
  try {
    const days = intParam(req.query.days, 90, 7, 365);
    const { events, computedAt } = await getEvents();
    const source = parseSource(req.query.source);
    const data = memoBuilder('heatmap', [days, source], eventsFingerprint(), () =>
      buildHourlyHeatmap(filterSource(events, source), computedAt, days),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    const days = intParam(req.query.days, 30, 7, 365);
    const [{ events, computedAt }, { insights }, sidecar] = await Promise.all([
      getEvents(), getInsights(), readSessionMetas(),
    ]);
    // buildProjectStats already drops cowork; the source filter keeps behavior
    // consistent when the UI explicitly scopes to one surface.
    const source = parseSource(req.query.source);
    const data = memoBuilder('projects', [days, source], eventsFingerprint(), () => {
      const stats = buildProjectStats(filterSource(events, source), computedAt, days);
      // Tags stored before project paths came from the transcript cwd are keyed by
      // the old folder-decoded path; the UI moves them over using this list.
      const legacy = legacyProjectPaths(insights, sidecar);
      return {
        ...stats,
        projects: stats.projects.map((p) => {
          const legacyPaths = legacy.get(p.path);
          return legacyPaths?.length ? { ...p, legacyPaths } : p;
        }),
      };
    });
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ---------------------------------------------------------------------------
// Insights routes
// ---------------------------------------------------------------------------

function clampDays(raw: unknown, def = 7): number {
  return intParam(raw, def, 1, 90);
}

app.get('/api/insights/errors', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('errors', [days, source], insightsFingerprint(), () =>
      buildErrors(scopeInsights(insights, source), days, computedAt),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Insights rows, one per tool_use id: usage dedup keeps one line per message and drops most Claude tool calls.
app.get('/api/insights/tools', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('tools', [days, source], insightsFingerprint(), () =>
      buildToolUsage(scopeInsights(insights, source), days, computedAt),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/retries', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('retries', [days, source], insightsFingerprint(), () =>
      buildRetries(scopeInsights(insights, source), days, computedAt),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/languages', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('languages', [days, source], insightsFingerprint(), () =>
      buildLanguages(scopeInsights(insights, source), days, computedAt),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/branches', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('branches', [days, source], insightsFingerprint(), () =>
      buildBranches(scopeInsights(insights, source), days, computedAt),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/mcp', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('mcp', [days, source], insightsFingerprint(), () =>
      buildMcp(scopeInsights(insights, source), days, computedAt),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/complexity', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('complexity', [days, source], insightsFingerprint(), () =>
      buildComplexity(scopeInsights(insights, source), days, computedAt),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/yield', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('yield', [days, source], insightsFingerprint(), () =>
      buildYield(scopeInsights(insights, source), days, computedAt),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/rejections', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('rejections', [days, source], insightsFingerprint(), () =>
      buildRejections(scopeInsights(insights, source), days, computedAt),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/insights/subagents', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('subagents', [days, source], insightsFingerprint(), () =>
      buildSubagentStats(scopeInsights(insights, source), days, computedAt),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// File churn — most-edited files (Edit/Write/MultiEdit) over the window. The
// project label may come from any platform's known folders (unscoped roots): a
// Codex chat started in a scratch folder still edits files of a real repo.
app.get('/api/insights/churn', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('churn', [days, source], insightsFingerprint(), () =>
      buildFileChurn(scopeInsights(insights, source), days, computedAt, 25, knownProjectRoots(insights)),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Turn latency — median / p90 turn time and time to first token, with a histogram
// split per platform (so Both can stack Claude and Codex instead of blending them).
app.get('/api/insights/turns', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('turns', [days, source], insightsFingerprint(), () =>
      buildTurnLatency(scopeInsights(insights, source), days, computedAt),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// The Insights KPI row: failure rate (rejections excluded), rejection rate, commit
// rate over repo sessions, delegation / auto-review rate — overall and per platform.
app.get('/api/insights/summary', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const { insights, computedAt } = await getInsights();
    const source = parseSource(req.query.source);
    const data = memoBuilder('insight-summary', [days, source], insightsFingerprint(), () =>
      buildInsightsSummary(scopeInsights(insights, source), days, computedAt),
    );
    res.json(wrap(data, computedAt));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Slash commands (history.jsonl, Claude Code only) + skills (per-request
// attributionSkill, counted once per session), scoped by ?source=.
app.get('/api/insights/commands', async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const source = parseSource(req.query.source);
    const { computedAt } = await getEvents();
    res.json(wrap(await getCommandUsage(days, computedAt, source), computedAt));
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

// All-time aggregate over every final workflow journal on disk.
app.get('/api/workflows/stats', async (_req, res) => {
  try {
    const data = await getWorkflowStats();
    res.json(wrap(data, Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// One agent's detail — parses its whole transcript, so it is fetched on expand
// only, never by the /api/workflows list poll.
app.get('/api/workflows/:runId/agents/:agentId', async (req, res) => {
  try {
    const data = await getAgentDetail(req.params.runId, req.params.agentId);
    if (!data) return res.status(404).json({ error: 'Agent not found' });
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

/**
 * The chat answers over ONE window on ONE surface, both taken from what the user
 * is actually looking at. Every overview number then shares a window, so the model
 * can never "notice" a phantom inconsistency between two differently-scoped figures.
 */
async function parseAiScope(body: any): Promise<AiScope> {
  const source = parseSource(body?.source);
  return {
    source: source === 'all' ? aiSource(source, await codexHasData()) : source,
    days: clampDays(body?.days, 30),
  };
}

/**
 * Full detail (branch names, file paths) only goes to a backend the user already
 * trusts with their code — the local `claude` CLI, their Claude.ai OAuth token, or
 * their own Anthropic key. An OpenAI/Gemini key from Settings gets those redacted.
 */
function shouldRedact(creds: AiCreds | null): boolean {
  return !!creds && creds.provider !== 'claude';
}

/**
 * Insight panels whose data IS branch or file names — the per-section twins of
 * the `branches` / `churn` datasets that ai-datasets.ts replaces with a redaction
 * marker under shouldRedact(). Here nothing is sent at all: with the names gone
 * the panel has nothing left to explain.
 */
const REDACTED_SECTIONS = new Set(['branches', 'churn']);

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
    const creds = parseAiCreds(req.body?.config);
    const scope = await parseAiScope(req.body);
    const route = await routeDatasets(question, history, creds, scope.source);
    const payload = await buildAiPayload(scope, route.ids, { redact: shouldRedact(creds) });
    // Stream the answer as chunked text/plain. Headers flush on the first delta;
    // an error before any delta is still sent as JSON (headers not yet sent).
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    // With no tests and no HMR, these two headers are the whole debugging surface
    // for "why did it answer from that?". They must be set before the first write.
    res.setHeader('X-AI-Route', route.via);
    res.setHeader('X-AI-Datasets', route.ids.join(','));
    await runAiStream(
      { system: chatSystem(scope.source), user: buildChatUserMessage(payload, question, history), maxTokens: 1200 },
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
    if (shouldRedact(creds) && REDACTED_SECTIONS.has(section)) {
      res.status(403).json({
        error: 'Branch and file names are not sent to third-party model providers. Pick Claude (or clear the key to use the local backend) in Settings → AI Insights to explain this panel.',
      });
      return;
    }
    // The platform the panel shows, when the client says; absent → platform-neutral wording.
    const source = req.body?.source === undefined ? undefined : parseSource(req.body.source);
    const { text, backend } = await runAi(
      {
        system: sectionSystem(source),
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
    const creds = parseAiCreds(req.body?.config);
    // Overview only: the chips just need the catalog to know what is askable.
    const scope = await parseAiScope(req.body);
    const payload = await buildAiPayload(scope, [], { redact: shouldRedact(creds) });
    const { text } = await runAi(
      { system: suggestSystem(scope.source), user: buildSuggestMessage(payload, history), maxTokens: 200 },
      creds,
    );
    res.json(wrap({ suggestions: parseSuggestions(text) }, Date.now()));
  } catch (e) {
    sendAiError(res, e);
  }
});

/**
 * The privacy disclosure: exactly what the chat would send to the model, before
 * sending it. The AI tab also pings this on mount to warm the aggregate caches so
 * the first question doesn't pay for a cold insights scan.
 */
app.get('/api/ai/context', async (req, res) => {
  try {
    const payload = await buildAiPayload(await parseAiScope(req.query), []);
    res.json(wrap(payload, Date.now()));
  } catch (e) {
    sendAiError(res, e);
  }
});

// ---------------------------------------------------------------------------
// Workspace: tasks + plans, the plugin / MCP / skill inventory, and the Codex
// config profile. ?source=claude|codex|all (Code/Cowork read as claude). With
// no ?source= they stay Claude-only — what these routes returned before Codex.
// ---------------------------------------------------------------------------

function parseWorkspaceScope(raw: unknown): WorkspaceScope {
  return raw === undefined ? 'claude' : workspaceScope(parseSource(raw));
}

app.get('/api/workspace/tasks', async (req, res) => {
  try {
    const scope = parseWorkspaceScope(req.query.source);
    const codex = scope !== 'claude' && (await codexHasData());
    res.json(wrap(await getWorkspaceTasks(scope, Date.now(), codex), Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/workspace/inventory', async (req, res) => {
  try {
    const scope = parseWorkspaceScope(req.query.source);
    const codex = scope !== 'claude' && (await codexHasData());
    res.json(wrap(await getInventory(scope, Date.now(), codex), Date.now()));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// The Codex counterpart of /api/config's settings block: allowlisted config.toml
// keys (see server/codex-config.ts — never env, args, tokens or project paths),
// how Codex is signed in, and the data dir the dashboard reads.
app.get('/api/codex/config', async (_req, res) => {
  try {
    const [config, authMode] = await Promise.all([readCodexConfig(), readCodexAuthMode()]);
    res.json(wrap({ ...config, authMode, dir: codexDir() }, Date.now()));
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

    // The file is gone (Claude Code's ~30-day cleanup, a deleted rollout, or removed
    // since the last scan). With history retention its usage lives on in the archive;
    // there is just nothing left to show turn by turn. Same shape as a real transcript.
    if (!sm.file || !existsSync(sm.file)) {
      res.json(wrap({
        sessionId,
        turns: [],
        compactions: 0,
        totalTurns: 0,
        archived: true,
        message: sm.source === 'codex'
          ? "This thread's rollout file is no longer on disk; only its usage history is kept."
          : 'This transcript was removed by Claude Code cleanup; only its usage history is kept.',
      }, Date.now()));
      return;
    }

    // Claude transcripts and Codex rollouts parse differently but return the same
    // Turn shape (transcript.ts).
    const transcript = await readTranscript(sm.file, sessionId, sm.source);
    res.json(wrap({ sessionId, ...transcript }, Date.now()));
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
    const source = parseSource(req.query.source);
    const [{ insights }, codexTitles] = await Promise.all([getInsights(), readCodexTitles()]);
    const hits = searchSessions(insights, q, Date.now() - days * 24 * 3600_000, source, codexTitles);
    res.json(wrap(hits, Date.now()));
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

app.listen(PORT, BIND_HOST, () => {
  console.log(`[server] listening on ${BIND_HOST}:${PORT} (claudeDir=${claudeDir()})`);
  // Prime the data layer in the background. This used to be two calls that each
  // kicked off a full independent scan of the same files, concurrently — they
  // fought over the disk and the libuv threadpool and doubled the cold-start cost.
  // One pass now feeds both, and the on-disk row cache means a restart usually
  // only re-parses the handful of files that changed. Errors are ignored; the
  // endpoints scan on demand if this fails.
  void primeData().catch(() => {});
});
