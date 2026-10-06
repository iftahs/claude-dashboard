import type { TagMap, TagMove } from '@/hooks/useTags';
import { compact, toolLabel, usd } from '@/lib/format';
import { UNTAGGED_COLOR, tagColor } from '@/lib/palette';
import type { Platform } from '@/lib/platform';
import { chatFolder, codexProjectLabel, projectName, type LocalProjectStat } from '@/lib/project';
import type { SectionState } from '@/lib/section';
import {
  formatDurationMs,
  formatTurnMs,
  prLabel,
  sessionTokens,
  sinceLabel,
  singularNoun,
  type SessionNoun,
  type TranscriptState,
} from '@/lib/sessions';
import type { ProjectStat, SearchResult, SessionMeta, SessionSummary, SessionSummaryPart, SessionTranscriptTurn } from '@/types';

export type SessionsView = 'sessions' | 'projects';

export interface SessionsTabItem {
  value: SessionsView;
  label: string;
}

export const SESSIONS_VIEW_PARAM = 'view';
const SESSIONS_TABS: Record<SessionNoun, readonly SessionsTabItem[]> = {
  sessions: [
    { value: 'sessions', label: 'Sessions' },
    { value: 'projects', label: 'Projects and tags' },
  ],
  threads: [
    { value: 'sessions', label: 'Threads' },
    { value: 'projects', label: 'Projects and tags' },
  ],
};
export const SESSIONS_PER_PAGE = 20;
export const SESSIONS_EXPORT_FILENAME = 'sessions';
export const SEARCH_MIN_CHARS = 3;
export const SEARCH_HIT_LIMIT = 8;

const SERVER_DOWN = 'The dashboard server did not answer. It keeps retrying.';
const DASH = '—';
const TRANSCRIPT_ERROR = 'The dashboard server did not answer. Try again.';
const CODEX_BADGE = 'Codex';

export type SessionStatsStatus = 'loading' | 'error' | 'ready';

export interface SessionStatView {
  key: string;
  label: string;
  value: string;
  sub: string;
  split: string | null;
  help: string;
}

export interface SessionStatsView {
  status: SessionStatsStatus;
  tiles: SessionStatView[];
  errorTitle: string;
  errorDescription: string;
}

export type SessionHeadlineKind = 'title' | 'prompt' | 'none';

export interface SessionRowView {
  id: string;
  started: string;
  project: string;
  badge: string | null;
  headline: string;
  headlineKind: SessionHeadlineKind;
  headlineTitle: string;
  duration: string;
  durationTitle: string;
  durationActive: boolean;
  tokens: string;
}

export interface SessionTableNoMatches {
  title: string;
  description: string;
}

export interface SessionTableView {
  title: string;
  description: string;
  help: string;
  caption: string;
  subject: string;
  state: SectionState | null;
  rows: SessionRowView[];
  noMatches: SessionTableNoMatches | null;
  range: string;
  page: number;
  pageCount: number;
  pageLabel: string;
  selectedId: string | null;
}

export type SessionSearchStatus = 'idle' | 'loading' | 'error' | 'empty' | 'ready';

export interface SearchHitView {
  id: string;
  headline: string;
  project: string | null;
  badge: string | null;
  date: string;
  matches: string | null;
  snippet: string;
}

export interface SessionSearchView {
  query: string;
  label: string;
  placeholder: string;
  status: SessionSearchStatus;
  summary: string;
  hits: SearchHitView[];
}

export interface SessionChangesView {
  files: string;
  added: string;
  removed: string;
}

export type SessionFactTone = 'default' | 'danger';

export interface SessionFactView {
  key: string;
  label: string;
  value: string;
  changes: SessionChangesView | null;
  tone: SessionFactTone;
  help: string | null;
}

export interface SessionPrView {
  url: string;
  label: string;
  href: string | null;
}

export interface SessionToolView {
  name: string;
  label: string;
  count: string;
}

export interface SessionDetailView {
  id: string;
  title: string;
  project: string | null;
  badge: string | null;
  started: string;
  tokens: string;
  prompt: string | null;
  summaryLabel: string;
  facts: SessionFactView[];
  prs: SessionPrView[];
  tools: SessionToolView[];
  toolsEmpty: string;
}

export type TranscriptStatus = 'loading' | 'error' | 'archived' | 'empty' | 'ready';

export interface TranscriptToolView {
  key: string;
  label: string;
  brief: string;
  title: string;
}

export interface TranscriptTurnView {
  key: string;
  user: boolean;
  role: string;
  time: string;
  model: string | null;
  text: string;
  empty: boolean;
  tools: TranscriptToolView[];
}

export interface TranscriptView {
  open: boolean;
  count: string | null;
  status: TranscriptStatus;
  message: string;
  truncated: string | null;
  turns: TranscriptTurnView[];
}

export type ProjectSort = 'cost' | 'time' | 'tokens' | 'files';

export interface ProjectSortOption {
  value: ProjectSort;
  label: string;
}

export const PROJECT_SORT_OPTIONS: readonly ProjectSortOption[] = [
  { value: 'cost', label: 'Cost' },
  { value: 'time', label: 'Time' },
  { value: 'tokens', label: 'Tokens' },
  { value: 'files', label: 'Files' },
];

export interface ProjectRowView {
  path: string;
  name: string;
  value: string;
  missing: boolean;
  percent: number;
  count: string;
  secondary: string;
  tags: string[];
}

export interface ProjectBreakdownView {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  sort: ProjectSort;
  rows: ProjectRowView[];
  suggestions: string[];
}

export interface TagGroup {
  tag: string;
  cost: number;
  effectiveTokens: number;
  projectCount: number;
  sessionCount: number;
}

export interface TagGroupView {
  key: string;
  label: string;
  color: string;
  cost: string | null;
  share: string | null;
  tokens: string;
}

export interface TagSliceView {
  key: string;
  label: string;
  color: string;
  value: number;
  valueLabel: string;
}

export interface TagBreakdownView {
  title: string;
  description: string;
  help: string;
  chartLabel: string;
  state: SectionState | null;
  groups: TagGroupView[];
  slices: TagSliceView[];
}

export function sessionNoun(platform: Platform): SessionNoun {
  return platform === 'codex' ? 'threads' : 'sessions';
}

export function sessionsTabs(noun: SessionNoun): readonly SessionsTabItem[] {
  return SESSIONS_TABS[noun];
}

export function sessionsDescription(noun: SessionNoun): string {
  return `Every ${singularNoun(noun)} on record, with its summary and transcript.`;
}

function linesLabel(part: SessionSummaryPart): string {
  return `+${compact(part.linesAdded)} / −${compact(part.linesRemoved)}`;
}

function platformSplit(summary: SessionSummary, platform: Platform, format: (part: SessionSummaryPart) => string): string | null {
  if (platform !== 'both' || summary.claude.sessions === 0 || summary.codex.sessions === 0) return null;
  return `Claude ${format(summary.claude)} · Codex ${format(summary.codex)}`;
}

// Each tile is computed over exactly the sessions the history lists, not a separate window.
function statTiles(summary: SessionSummary, platform: Platform): SessionStatView[] {
  const total = summary.total;
  const noun = sessionNoun(platform);
  const one = singularNoun(noun);
  const since = sinceLabel(total.since);
  const agent = platform === 'codex' ? 'Codex' : platform === 'claude' ? 'Claude' : 'the agent';
  return [
    {
      key: 'sessions',
      label: platform === 'codex' ? 'Threads' : 'Sessions',
      value: total.sessions.toLocaleString(),
      sub: since ? `Since ${since}` : 'None yet',
      split: platformSplit(summary, platform, (part) => part.sessions.toLocaleString()),
      help: `${platform === 'codex' ? 'Codex threads' : 'Sessions'} in the history: every one still on disk (or kept by the history archive), subagent-only runs excluded.`,
    },
    {
      key: 'longest',
      label: `Longest active ${one}`,
      value: total.longestSessionId ? formatDurationMs(total.longestActiveMs) : DASH,
      sub: total.longestLabel || DASH,
      split: platformSplit(summary, platform, (part) => (part.longestSessionId ? formatDurationMs(part.longestActiveMs) : DASH)),
      help: `The ${one} with the most active time: the sum of its turns, each from your prompt to ${agent}'s last reply before the next one. Idle time between turns is not counted, unlike the wall-clock span.`,
    },
    {
      key: 'turn',
      label: 'Median turn time',
      value: total.medianTurnMs === null ? DASH : formatTurnMs(total.medianTurnMs),
      sub: `Over ${total.turnCount.toLocaleString()} turn${total.turnCount !== 1 ? 's' : ''}`,
      split: platformSplit(summary, platform, (part) => (part.medianTurnMs === null ? DASH : formatTurnMs(part.medianTurnMs))),
      help: `How long a typical turn takes, from a prompt until ${agent} finishes working on it (tool calls included). Half of all turns are faster than this.`,
    },
    {
      key: 'lines',
      label: 'Lines changed',
      value: linesLabel(total),
      sub: 'Added / removed',
      split: platformSplit(summary, platform, linesLabel),
      help: `Lines added and removed by file edits in these ${noun}, subagents included, counted from each edit's diff. Failed or declined edits changed nothing and are not counted.`,
    },
  ];
}

export interface SessionStatsInput {
  summary: SessionSummary | null;
  error: string | null;
  platform: Platform;
}

export function buildSessionStats({ summary, error, platform }: SessionStatsInput): SessionStatsView {
  const base = { errorTitle: `Could not load the ${singularNoun(sessionNoun(platform))} totals`, errorDescription: SERVER_DOWN };
  if (!summary) return { ...base, status: error ? 'error' : 'loading', tiles: [] };
  return { ...base, status: 'ready', tiles: statTiles(summary, platform) };
}

/** Old project paths → current ones, from /api/projects, for useTags().migrate. */
export function tagMovesFrom(projects: ProjectStat[] | undefined): TagMove[] {
  const moves: TagMove[] = [];
  for (const project of projects ?? []) for (const from of project.legacyPaths ?? []) moves.push({ from, to: project.path });
  return moves;
}

const START_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const TURN_TIME_FORMAT = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? dateStr : START_FORMAT.format(date);
}

// A desktop chat's scratch folder reads "Codex chat" / "Claude chat" (slug only when there's no title).
export function sessionLabel(s: SessionMeta): { name: string; badge: string | null } {
  if (s.source === 'cowork') return { name: 'Cowork', badge: null };
  const badge = s.source === 'codex' ? CODEX_BADGE : null;
  const chat = chatFolder(s.project_path, s.source);
  if (chat) return { name: s.title ? `${chat.app} chat` : `${chat.app} chat · ${chat.slug}`, badge };
  return { name: projectName(s.project_path), badge };
}

/** Active time when the session recorded turns, else the wall-clock span. */
export function durationCell(s: SessionMeta): { text: string; tooltip: string; active: boolean } {
  const wall = formatDurationMs((s.duration_minutes ?? 0) * 60_000);
  if (s.active_ms === null || s.active_ms === undefined) {
    return { text: wall, tooltip: `Wall clock ${wall} (no turn timing recorded)`, active: false };
  }
  const active = formatDurationMs(s.active_ms);
  return { text: active, tooltip: `Active ${active} · wall clock ${wall}`, active: true };
}

/** Case-insensitive match on the title, first prompt or project path. */
export function matchesQuery(s: SessionMeta, query: string): boolean {
  const q = query.toLowerCase();
  if (!q) return true;
  return (
    !!s.title?.toLowerCase().includes(q) ||
    !!s.first_prompt?.toLowerCase().includes(q) ||
    !!s.project_path?.toLowerCase().includes(q)
  );
}

// Titles and PR URLs stay out (a count only): they name customers and private repos, and an export leaves the machine.
export function sessionExportRows(data: SessionMeta[]): Record<string, unknown>[] {
  return data.map((s) => ({
    session_id: s.session_id,
    source: s.source ?? 'code',
    start_time: s.start_time,
    project: s.project_path,
    active_minutes: s.active_ms === null || s.active_ms === undefined ? '' : Math.round(s.active_ms / 60_000),
    wall_clock_minutes: s.duration_minutes,
    turns: s.turn_count ?? '',
    effective_tokens: sessionTokens(s),
    cache_read_tokens: s.cache_read_tokens ?? 0,
    files_modified: s.files_modified ?? 0,
    lines_added: s.lines_added ?? 0,
    lines_removed: s.lines_removed ?? 0,
    git_commits: s.git_commits,
    pull_requests: (s.pr_urls ?? []).length,
    first_prompt: s.first_prompt,
  }));
}

/** The JSON export: every field but the title and the PR URLs. */
export function sessionExportJson(data: SessionMeta[]): Array<Omit<SessionMeta, 'title' | 'pr_urls'> & { pull_requests: number }> {
  return data.map(({ title: _title, pr_urls: prs, ...rest }) => ({ ...rest, pull_requests: prs?.length ?? 0 }));
}

export function pageCountFor(total: number): number {
  return Math.max(1, Math.ceil(total / SESSIONS_PER_PAGE));
}

export function pageSlice<T>(items: readonly T[], page: number): T[] {
  const start = (page - 1) * SESSIONS_PER_PAGE;
  return items.slice(start, start + SESSIONS_PER_PAGE);
}

export function buildSessionRow(s: SessionMeta, hideBadge: boolean): SessionRowView {
  const label = sessionLabel(s);
  const duration = durationCell(s);
  const kind: SessionHeadlineKind = s.title ? 'title' : s.first_prompt ? 'prompt' : 'none';
  return {
    id: s.session_id,
    started: formatDate(s.start_time),
    project: label.name,
    badge: hideBadge ? null : label.badge,
    headline: kind === 'title' ? s.title ?? '' : kind === 'prompt' ? `“${s.first_prompt}”` : 'No prompt',
    headlineKind: kind,
    headlineTitle: s.first_prompt || s.title || '',
    duration: duration.text,
    durationTitle: duration.tooltip,
    durationActive: duration.active,
    tokens: compact(sessionTokens(s)),
  };
}

export interface SessionTableInput {
  total: number | null;
  error: string | null;
  matched: number;
  rows: SessionRowView[];
  page: number;
  pageCount: number;
  since: number | null;
  noun: SessionNoun;
  query: string;
  selectedId: string | null;
}

export function buildSessionTable(input: SessionTableInput): SessionTableView {
  const { total, error, matched, rows, page, pageCount, since, noun, query, selectedId } = input;
  const one = singularNoun(noun);
  const sinceText = sinceLabel(since);
  const from = matched === 0 ? 0 : (page - 1) * SESSIONS_PER_PAGE + 1;
  const to = Math.min(page * SESSIONS_PER_PAGE, matched);

  let state: SectionState | null = null;
  if (total === null) {
    state = error
      ? { kind: 'error', title: `Could not load the ${one} history`, description: SERVER_DOWN }
      : { kind: 'loading', skeleton: 'table', rows: 8 };
  } else if (total === 0) {
    state = { kind: 'empty', title: `No ${noun} yet`, description: `A ${one} shows up here once its transcript is on disk.` };
  }

  return {
    title: `${singularNoun(noun, true)} history`,
    description: total === null ? `Every ${one} on record` : `${total.toLocaleString()} ${total === 1 ? one : noun}${sinceText ? ` since ${sinceText}` : ''}`,
    help: `Every ${one} on record: start time, project, title (or first prompt), active time and effective tokens. Duration is active time, the sum of each turn from prompt to answer. Hover it for the wall-clock span, which includes idle time. Open a row for its summary and full transcript. The search above matches titles, prompts and project names here, and transcript text in its own list.`,
    caption: `${singularNoun(noun, true)} history`,
    subject: singularNoun(noun, true),
    state,
    rows,
    noMatches:
      state === null && matched === 0
        ? { title: `No ${noun} match`, description: `No title, prompt or project name contains “${query}”.` }
        : null,
    range: `Showing ${from.toLocaleString()} to ${to.toLocaleString()} of ${matched.toLocaleString()} ${matched === 1 ? one : noun}`,
    page,
    pageCount,
    pageLabel: `Page ${page.toLocaleString()} of ${pageCount.toLocaleString()}`,
    selectedId,
  };
}

export interface SessionSearchInput {
  query: string;
  results: SearchResult[] | null;
  loading: boolean;
  error: string | null;
  noun: SessionNoun;
  showBadge: boolean;
}

function searchHit(result: SearchResult, showBadge: boolean): SearchHitView {
  const project = result.source === 'codex' && result.projectPath ? codexProjectLabel(result.projectPath) : result.project || 'unknown';
  return {
    id: result.sessionId,
    headline: result.title || project,
    project: result.title ? project : null,
    badge: showBadge && result.source === 'codex' ? CODEX_BADGE : null,
    date: result.date,
    matches: result.matches > 1 ? `${result.matches} matches` : null,
    snippet: result.snippet,
  };
}

export function buildSessionSearch({ query, results, loading, error, noun, showBadge }: SessionSearchInput): SessionSearchView {
  const one = singularNoun(noun);
  const base = {
    query,
    label: `Search ${noun}`,
    placeholder: 'Search titles, prompts, projects and transcripts',
    hits: [],
  };
  if (query.length < SEARCH_MIN_CHARS) return { ...base, status: 'idle', summary: '' };
  if (loading) return { ...base, status: 'loading', summary: 'Searching transcripts' };
  if (error) return { ...base, status: 'error', summary: 'Could not search transcripts. The dashboard server did not answer.' };
  if (!results || results.length === 0) return { ...base, status: 'empty', summary: `No transcript matches for “${query}”` };

  const count = results.length;
  const shown = count > SEARCH_HIT_LIMIT ? `, showing the first ${SEARCH_HIT_LIMIT}` : '';
  return {
    ...base,
    status: 'ready',
    summary: `Found in ${count.toLocaleString()} ${one} transcript${count !== 1 ? 's' : ''}${shown}`,
    hits: results.slice(0, SEARCH_HIT_LIMIT).map((result) => searchHit(result, showBadge)),
  };
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

function fact(key: string, label: string, value: string, extra: Partial<SessionFactView> = {}): SessionFactView {
  return { key, label, value, changes: null, tone: 'default', help: null, ...extra };
}

function sessionFacts(s: SessionMeta, noun: SessionNoun): SessionFactView[] {
  const one = singularNoun(noun);
  const wall = formatDurationMs((s.duration_minutes ?? 0) * 60_000);
  const hasActive = s.active_ms !== null && s.active_ms !== undefined;
  const added = s.lines_added ?? 0;
  const removed = s.lines_removed ?? 0;
  const files = s.files_modified ?? 0;
  const changed = files !== 0 || added !== 0 || removed !== 0;
  const changes: SessionChangesView | null = changed
    ? { files: plural(files, 'file', 'files'), added: `+${added.toLocaleString()}`, removed: `−${removed.toLocaleString()}` }
    : null;

  const facts: SessionFactView[] = [
    fact(
      'turns',
      'Turns',
      s.turn_count !== undefined
        ? `${plural(s.turn_count, 'turn', 'turns')} · ${s.assistant_message_count.toLocaleString()} model responses`
        : `${s.user_message_count.toLocaleString()} user / ${s.assistant_message_count.toLocaleString()} agent`,
      {
        help: `A turn is one prompt and the work it triggered, up to the answer. Model responses count every API response in the ${one}, subagents included: each tool round-trip is one. Counted the same way on every platform.`,
      },
    ),
    fact('time', 'Time', hasActive ? `${formatDurationMs(s.active_ms ?? 0)} active · ${wall} wall clock` : `${wall} wall clock`),
    fact('changes', 'Changes', changes ? `${changes.files} · ${changes.added} ${changes.removed} lines` : 'None', { changes }),
    fact(
      'tokens',
      'Tokens',
      `${compact(sessionTokens(s))} effective${s.cache_read_tokens ? ` (+${compact(s.cache_read_tokens)} cache reads)` : ''}`,
    ),
  ];
  if (s.git_commits > 0 || s.git_pushes > 0) {
    facts.push(
      fact('git', 'Git', `${plural(s.git_commits, 'commit', 'commits')}${s.git_pushes > 0 ? `, ${plural(s.git_pushes, 'push', 'pushes')}` : ''}`),
    );
  }
  if (s.tool_errors !== undefined && s.tool_errors > 0) {
    facts.push(fact('errors', 'Tool errors', s.tool_errors.toLocaleString(), { tone: 'danger' }));
  }
  if (s.client) facts.push(fact('client', 'Client', `${s.client}${s.client_version ? ` ${s.client_version}` : ''}`));
  return facts;
}

export function buildSessionDetail(s: SessionMeta | null, noun: SessionNoun, hideBadge: boolean): SessionDetailView | null {
  if (!s) return null;
  const label = sessionLabel(s);
  return {
    id: s.session_id,
    title: s.title || label.name,
    project: s.title ? label.name : null,
    badge: hideBadge ? null : label.badge,
    started: formatDate(s.start_time),
    tokens: `${compact(sessionTokens(s))} tok`,
    prompt: s.title && s.first_prompt && s.first_prompt !== s.title ? s.first_prompt : null,
    summaryLabel: `${singularNoun(noun, true)} summary`,
    facts: sessionFacts(s, noun),
    prs: (s.pr_urls ?? []).map((url) => ({ url, label: prLabel(url), href: /^https?:\/\//i.test(url) ? url : null })),
    tools: Object.entries(s.tool_counts ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, label: toolLabel(name), count: count.toLocaleString() })),
    toolsEmpty: `No tools were invoked in this ${singularNoun(noun)}.`,
  };
}

function transcriptTurn(turn: SessionTranscriptTurn, index: number): TranscriptTurnView {
  const user = turn.role === 'user';
  const tools = user ? [] : turn.tools ?? [];
  const text = (turn.text ?? '').trim();
  return {
    key: String(index),
    user,
    role: user ? 'You' : 'Agent',
    time: Number.isFinite(turn.ts) && turn.ts > 0 ? TURN_TIME_FORMAT.format(new Date(turn.ts)) : '',
    model: !user && turn.model ? turn.model : null,
    text,
    // A step with neither text nor a tool call: a thinking-only reply, or a prompt that only carried tool results.
    empty: !text && tools.length === 0,
    tools: tools.map((tool, toolIndex) => ({
      key: `${index}:${toolIndex}`,
      label: toolLabel(tool.name),
      brief: tool.brief ?? '',
      title: tool.brief ? `${tool.name} — ${tool.brief}` : tool.name,
    })),
  };
}

export function buildTranscript(state: TranscriptState | undefined, open: boolean, noun: SessionNoun): TranscriptView {
  const one = singularNoun(noun);
  const data = state?.data ?? null;
  const base = {
    open,
    count: data && !data.archived ? `${data.totalTurns.toLocaleString()} messages` : null,
    message: '',
    truncated: null,
    turns: [],
  };
  if (!state || state.loading || (!data && !state.error)) return { ...base, status: 'loading' };
  if (!data) return { ...base, status: 'error', message: TRANSCRIPT_ERROR };
  if (data.archived) {
    return { ...base, status: 'archived', message: data.message ?? 'This transcript is no longer on disk; only its usage history is kept.' };
  }
  if (data.turns.length === 0) return { ...base, status: 'empty', message: `No messages recorded for this ${one}.` };
  return {
    ...base,
    status: 'ready',
    truncated: data.truncated
      ? `Long ${one}: middle messages omitted. Showing ${data.turns.length.toLocaleString()} of ${data.totalTurns.toLocaleString()} messages.`
      : null,
    // Turns are built only while the pane is open: a closed pane renders none of them.
    turns: open ? data.turns.map(transcriptTurn) : [],
  };
}

/** "3 sessions" / "2 threads" / "4 sessions · Claude 3 · Codex 1" (the Both view, mixed rows only). */
export function sessionCountLabel(p: LocalProjectStat, platform: Platform): string {
  if (platform === 'codex') return `${p.sessionCount} thread${p.sessionCount !== 1 ? 's' : ''}`;
  const base = `${p.sessionCount} session${p.sessionCount !== 1 ? 's' : ''}`;
  if (platform === 'both' && p.claudeSessions > 0 && p.codexSessions > 0) {
    return `${base} · Claude ${p.claudeSessions} · Codex ${p.codexSessions}`;
  }
  return base;
}

export function projectsHelp(platform: Platform): string {
  const noun = sessionNoun(platform);
  const base = `Per-project rollup of the ${noun} in the history: estimated cost, active time (prompt to answer, idle time excluded), effective tokens and files changed, one row per working directory. Sort with the control. Tag projects to group their cost in Spend by tag.`;
  if (platform === 'codex') return `${base} Codex chat-only threads each get their own scratch folder, labelled with the thread title.`;
  if (platform === 'both') {
    return `${base} Claude and Codex sessions in the same folder share one row. Cowork sessions run in a sandbox with no host project, so they are excluded.`;
  }
  return `${base} Cowork sessions run in a sandbox with no host project, so they are excluded.`;
}

const PROJECT_SORT_NOUN: Record<ProjectSort, string> = {
  cost: 'est. cost',
  time: 'active time',
  tokens: 'effective tokens',
  files: 'files changed',
};

const PROJECT_METRIC: Record<ProjectSort, (p: LocalProjectStat) => number> = {
  cost: (p) => p.cost,
  time: (p) => p.activeMs,
  tokens: (p) => p.effectiveTokens,
  files: (p) => p.filesModified,
};

function projectValue(p: LocalProjectStat, sort: ProjectSort): string {
  if (sort === 'cost') return p.cost > 0 ? `~${usd(p.cost)}` : 'No cost data';
  if (sort === 'time') return `${formatDurationMs(p.activeMs)} active`;
  if (sort === 'tokens') return `${compact(p.effectiveTokens)} tokens`;
  return plural(p.filesModified, 'file', 'files');
}

function projectSecondary(p: LocalProjectStat, sort: ProjectSort): string {
  if (sort === 'cost' && p.effectiveTokens > 0) return `${compact(p.effectiveTokens)} tokens`;
  if (sort === 'tokens' && p.cacheReadTokens > 0) return `+${compact(p.cacheReadTokens)} cache reads`;
  return `+${p.linesAdded.toLocaleString()} / −${p.linesRemoved.toLocaleString()} lines`;
}

/** Every distinct tag in use, sorted. */
export function allTags(tags: TagMap): string[] {
  const set = new Set<string>();
  for (const list of Object.values(tags)) for (const tag of list) set.add(tag);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export interface ProjectViewsInput {
  stats: LocalProjectStat[] | null;
  pending: boolean;
  error: string | null;
  since: number | null;
  platform: Platform;
  tags: TagMap;
}

function listState(input: ProjectViewsInput, rows: number, errorTitle: string): SectionState | null {
  if (input.stats && !input.pending) return null;
  if (!input.stats && input.error) return { kind: 'error', title: errorTitle, description: SERVER_DOWN };
  return { kind: 'loading', skeleton: 'bars', rows };
}

export function buildProjectBreakdown(input: ProjectViewsInput, sort: ProjectSort): ProjectBreakdownView {
  const { stats, since, platform, tags } = input;
  const sinceText = sinceLabel(since);
  const metric = PROJECT_METRIC[sort];
  const sorted = stats ? [...stats].sort((a, b) => metric(b) - metric(a)) : [];
  const top = sorted.reduce((max, p) => Math.max(max, metric(p)), 0);
  const max = sort === 'cost' ? Math.max(top, 0.0001) : top || 1;

  let state = listState(input, 6, 'Could not load projects');
  if (!state && sorted.length === 0) {
    state = { kind: 'empty', icon: 'folder', title: 'No project activity recorded yet', description: `Projects appear after the first ${singularNoun(sessionNoun(platform))} in a working directory.` };
  }

  return {
    title: 'Projects',
    description: `Ranked by ${PROJECT_SORT_NOUN[sort]}${sinceText ? `, since ${sinceText}` : ''}`,
    help: projectsHelp(platform),
    state,
    sort,
    rows: state
      ? []
      : sorted.map((p) => ({
          path: p.path,
          name: p.name,
          value: projectValue(p, sort),
          missing: sort === 'cost' && p.cost <= 0,
          percent: Math.min(100, (metric(p) / max) * 100),
          count: sessionCountLabel(p, platform),
          secondary: projectSecondary(p, sort),
          tags: tags[p.path] ?? [],
        })),
    suggestions: allTags(tags),
  };
}

/** Sentinel tag for projects the user has not tagged. */
export const UNTAGGED = '';

// A project with several tags counts toward each; untagged projects share one bucket, listed last.
export function groupByTag(stats: LocalProjectStat[], tags: TagMap): TagGroup[] {
  const map = new Map<string, TagGroup>();
  const bump = (tag: string, stat: LocalProjectStat) => {
    let group = map.get(tag);
    if (!group) {
      group = { tag, cost: 0, effectiveTokens: 0, projectCount: 0, sessionCount: 0 };
      map.set(tag, group);
    }
    group.cost += stat.cost;
    group.effectiveTokens += stat.effectiveTokens;
    group.projectCount += 1;
    group.sessionCount += stat.sessionCount;
  };

  for (const stat of stats) {
    const projectTags = tags[stat.path] ?? [];
    if (projectTags.length === 0) bump(UNTAGGED, stat);
    else for (const tag of projectTags) bump(tag, stat);
  }

  return [...map.values()].sort((a, b) => {
    if (a.tag === UNTAGGED) return 1;
    if (b.tag === UNTAGGED) return -1;
    return b.cost - a.cost;
  });
}

export function buildTagBreakdown(input: ProjectViewsInput): TagBreakdownView {
  const { stats, tags } = input;
  const groups = stats ? groupByTag(stats, tags) : [];
  const total = groups.reduce((sum, group) => sum + (group.cost > 0 ? group.cost : 0), 0);
  const look = (group: TagGroup) => ({
    key: group.tag === UNTAGGED ? 'untagged' : `tag:${group.tag}`,
    label: group.tag === UNTAGGED ? 'Untagged' : group.tag,
    color: group.tag === UNTAGGED ? UNTAGGED_COLOR : tagColor(group.tag),
  });

  let state = listState(input, 3, 'Could not load spend by tag');
  if (!state && allTags(tags).length === 0) {
    state = { kind: 'empty', icon: 'tag', title: 'No tags yet', description: 'Add a tag to any project in the Projects card to group its cost here.' };
  } else if (!state && groups.length === 0) {
    state = { kind: 'empty', icon: 'tag', title: 'Nothing to group yet', description: 'Tagged projects show their cost here once they have activity.' };
  }

  return {
    title: 'Spend by tag',
    description: 'Est. cost across your tags',
    help: 'Estimated cost grouped by the custom tags you assign in the Projects card. A project with several tags counts toward each. Tags live only in your browser. Nothing is sent anywhere.',
    chartLabel: 'Estimated cost by tag',
    state,
    groups: state
      ? []
      : groups.map((group) => ({
          ...look(group),
          cost: group.cost > 0 ? `~${usd(group.cost)}` : null,
          share: total > 0 && group.cost > 0 ? `${((group.cost / total) * 100).toFixed(0)}%` : null,
          tokens: `${compact(group.effectiveTokens)} tok`,
        })),
    slices: state
      ? []
      : groups
          .filter((group) => group.cost > 0)
          .map((group) => ({ ...look(group), value: group.cost, valueLabel: `~${usd(group.cost)}` })),
  };
}
