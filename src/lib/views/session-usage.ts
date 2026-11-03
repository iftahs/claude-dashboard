import { displayModel } from '@/lib/agents';
import { compact, usd } from '@/lib/format';
import { modelColor } from '@/lib/palette';
import type { SectionState } from '@/lib/section';
import { formatDurationMs } from '@/lib/sessions';
import type { LiveMeterTone, PlanLimitRowView } from '@/lib/views/live';
import { PARTIAL_NOTE, formatDate, sessionLabel } from '@/lib/views/sessions';
import type { SessionContributor, SessionMeta, SessionUsageData, SessionUsageModel } from '@/types';

export const RECENT_SESSION_OPTIONS = 10;
const CONTRIBUTORS_SHOWN = 8;
const LABEL_MAX = 56;

const SUBAGENT_TIP_SHARE = 0.2;
const CACHE_TIP_RATE = 0.5;
const COSTLY_MODEL_SHARE = 0.7;
const COSTLY_MODEL = /fable|opus/i;

export const SUBAGENT_TIP = 'Each subagent runs its own requests. Consider a cheaper model for simple subagents, or tighten their prompts.';

export interface SessionUsageLimitView {
  key: string;
  label: string;
  value: string;
  percent: number;
  tone: LiveMeterTone;
  note: string;
}

export interface SessionUsageFactView {
  key: string;
  label: string;
  value: string;
  changes: { added: string; removed: string } | null;
  help: string | null;
}

export interface SessionUsageShareView {
  key: string;
  label: string;
  color: string;
  value: string;
}

export interface SessionUsageModelView {
  key: string;
  label: string;
  color: string;
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
  cacheWriteTitle: string | null;
  cost: string;
}

export interface SessionUsageContributorView {
  key: string;
  label: string;
  badge: string;
  percent: number;
  value: string;
}

export interface SessionUsagePickerView {
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

export interface SessionUsageView {
  title: string;
  description: string | null;
  help: string;
  state: SectionState | null;
  picker: SessionUsagePickerView | null;
  limits: SessionUsageLimitView[];
  facts: SessionUsageFactView[];
  shares: SessionUsageShareView[];
  models: SessionUsageModelView[];
  contributors: SessionUsageContributorView[];
  tip: string | null;
  partialNote: string | null;
}

const TITLE = 'Session usage';
const HELP =
  "What one session cost and where it went, priced from local logs at list API prices, so it is an estimate and not a bill. Limits are your plan's live windows. Cache hit is the share of input tokens served from the prompt cache (cache reads over input, cache reads and cache writes). The breakdown lists each model's tokens, and what's contributing ranks the subagents, skills, MCP servers and plugins behind the cost. One request can count under several of them, so those shares can add up to more than 100%.";
const KIND_BADGE: Record<SessionContributor['kind'], string> = { subagent: 'subagent', skill: 'skill', mcp: 'MCP', plugin: 'plugin' };

function percent(share: number): string {
  return share > 0 && share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** First matching rule wins; null when nothing stands out. Wording stays the same for every platform. */
export function sessionUsageTip(data: SessionUsageData): string | null {
  const subagents = data.contributors.filter((c) => c.kind === 'subagent').reduce((sum, c) => sum + c.share, 0);
  if (subagents >= SUBAGENT_TIP_SHARE) return SUBAGENT_TIP;
  if (data.models.length === 0) return null;
  if (data.cacheHitRate < CACHE_TIP_RATE) {
    return `Only ${Math.round(data.cacheHitRate * 100)}% of input tokens came from the prompt cache. Idle gaps and edits early in the conversation expire it, so keep related work in one continuous session.`;
  }
  const top = data.models[0];
  if (top.share >= COSTLY_MODEL_SHARE && COSTLY_MODEL.test(top.model)) {
    return `${percent(top.share)} of the cost ran on ${displayModel(top.model)}. A cheaper model can handle routine edits and lookups for a fraction of the price.`;
  }
  return null;
}

function facts(data: SessionUsageData): SessionUsageFactView[] {
  const out: SessionUsageFactView[] = [];
  const fact = (key: string, label: string, value: string, extra: Partial<SessionUsageFactView> = {}) =>
    out.push({ key, label, value, changes: null, help: null, ...extra });
  if (data.totalCost > 0) fact('cost', 'Cost', `~${usd(data.totalCost)}`, { help: 'Estimated at list API prices from the local log, subagents included.' });
  if (data.activeMs !== null) fact('active', 'Active', formatDurationMs(data.activeMs), { help: 'The sum of the turns, each from your prompt to the last reply. Idle time is not counted.' });
  if (data.linesAdded + data.linesRemoved > 0) {
    const added = `+${data.linesAdded.toLocaleString()}`;
    const removed = `−${data.linesRemoved.toLocaleString()}`;
    fact('lines', 'Lines', `${added} ${removed}`, { changes: { added, removed } });
  }
  if (data.webSearches > 0) fact('searches', 'Web searches', data.webSearches.toLocaleString());
  if (data.models.length > 0) {
    fact('cache', 'Cache hit', `${Math.round(data.cacheHitRate * 100)}%`, {
      help: 'Input tokens served from the prompt cache instead of being processed again.',
    });
  }
  return out;
}

function modelRow(model: SessionUsageModel): SessionUsageModelView {
  return {
    key: model.model,
    label: displayModel(model.model),
    color: modelColor(model.model),
    input: compact(model.inputTokens),
    output: compact(model.outputTokens),
    cacheRead: compact(model.cacheReadTokens),
    cacheWrite: compact(model.cacheWriteTokens),
    cacheWriteTitle: model.cacheWrite1hTokens > 0 ? `${compact(model.cacheWrite1hTokens)} written with the 1-hour TTL` : null,
    cost: model.cost > 0 ? `~${usd(model.cost)}` : '—',
  };
}

function contributorRows(contributors: readonly SessionContributor[]): SessionUsageContributorView[] {
  const shown = contributors.filter((c) => c.share >= 0.01).slice(0, CONTRIBUTORS_SHOWN);
  const top = shown[0]?.share ?? 1;
  return shown.map((c) => ({
    key: `${c.kind}:${c.name}`,
    label: c.name,
    badge: KIND_BADGE[c.kind],
    percent: Math.min(100, (c.share / top) * 100),
    value: percent(c.share),
  }));
}

export interface SessionUsageInput {
  data: SessionUsageData | null;
  error: string | null;
  /** The session asked for; null when there is none to ask about. */
  sessionId: string | null;
  /** The list the session is picked from has not answered yet. */
  pending?: boolean;
  /** The plan's live limit rows; empty hides the block. */
  limits: readonly PlanLimitRowView[];
  picker: SessionUsagePickerView | null;
}

export function buildSessionUsage({ data, error, sessionId, pending = false, limits, picker }: SessionUsageInput): SessionUsageView {
  const base = {
    title: TITLE,
    help: HELP,
    picker,
    limits: [] as SessionUsageLimitView[],
    facts: [] as SessionUsageFactView[],
    shares: [] as SessionUsageShareView[],
    models: [] as SessionUsageModelView[],
    contributors: [] as SessionUsageContributorView[],
    tip: null,
    partialNote: null,
    description: null,
  };
  const failed: SectionState = { kind: 'error', title: 'Could not load session usage', description: 'The dashboard server did not answer. It keeps retrying.' };
  const loading: SectionState = { kind: 'loading', skeleton: 'bars', rows: 4 };
  if (!sessionId) {
    if (error) return { ...base, state: failed };
    if (pending) return { ...base, state: loading };
    return { ...base, state: { kind: 'empty', icon: 'activity', title: 'No sessions yet', description: 'Usage shows up here once a session has run.' } };
  }
  if (!data) {
    if (error && /HTTP 404/.test(error)) {
      return { ...base, state: { kind: 'empty', icon: 'activity', title: 'No usage recorded', description: 'The log has no requests for this session.' } };
    }
    return { ...base, state: error ? failed : loading };
  }
  if (data.models.length === 0) {
    return { ...base, state: { kind: 'empty', icon: 'activity', title: 'No usage recorded', description: 'The log has no priced requests for this session.' } };
  }

  return {
    ...base,
    // The picker already names the session it shows.
    description: picker ? null : clip([data.title, data.projectName].filter(Boolean).join(' · '), LABEL_MAX + 24) || null,
    state: null,
    limits: limits.map((row) => ({ key: row.key, label: row.label, value: row.value, percent: row.percent, tone: row.tone, note: row.note })),
    facts: facts(data),
    shares: data.models.map((model) => ({
      key: model.model,
      label: displayModel(model.model),
      color: modelColor(model.model),
      value: percent(model.share),
    })),
    models: data.models.map(modelRow),
    contributors: contributorRows(data.contributors),
    tip: sessionUsageTip(data),
    partialNote: data.partial ? PARTIAL_NOTE : null,
  };
}

/** The most recent sessions by last record, newest first. */
export function recentSessions(sessions: readonly SessionMeta[] | null | undefined, count = RECENT_SESSION_OPTIONS): SessionMeta[] {
  const last = (s: SessionMeta) => s.last_ts ?? (Date.parse(s.start_time) || 0);
  return [...(sessions ?? [])].sort((a, b) => last(b) - last(a)).slice(0, count);
}

function optionLabel(s: SessionMeta): string {
  const project = sessionLabel(s).name;
  const headline = s.title || s.first_prompt || formatDate(s.start_time);
  return `${clip(headline.replace(/\s+/g, ' ').trim(), LABEL_MAX)} · ${project}`;
}

export function buildSessionUsagePicker(recent: readonly SessionMeta[], selectedId: string | null): SessionUsagePickerView | null {
  if (recent.length === 0 || !selectedId) return null;
  return {
    label: 'Session shown',
    value: selectedId,
    options: recent.map((s) => ({ value: s.session_id, label: optionLabel(s) })),
  };
}
