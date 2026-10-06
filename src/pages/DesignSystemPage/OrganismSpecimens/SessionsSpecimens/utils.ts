import type { TagMap } from '@/hooks/useTags';
import { buildProjectStats } from '@/lib/project';
import type { TranscriptState } from '@/lib/sessions';
import {
  buildProjectBreakdown,
  buildSessionDetail,
  buildSessionRow,
  buildSessionSearch,
  buildSessionStats,
  buildSessionTable,
  buildTagBreakdown,
  buildTranscript,
  matchesQuery,
  pageCountFor,
  pageSlice,
  type ProjectBreakdownView,
  type ProjectSort,
  type ProjectViewsInput,
  type SessionDetailView,
  type SessionSearchView,
  type SessionStatsView,
  type SessionTableInput,
  type SessionTableView,
  type TagBreakdownView,
  type TranscriptView,
} from '@/lib/views/sessions';
import type { ProjectStat, SearchResult, SessionMeta, SessionSummary, SessionSummaryPart, SessionTranscript } from '@/types';

const NOW = Date.now();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const SINCE = NOW - 40 * DAY;

const PROJECTS = [
  'C:\\dev\\claude-dashboard',
  'C:\\dev\\billing-service',
  'C:\\dev\\a-project-with-a-very-long-folder-name-that-has-to-truncate',
  'C:\\dev\\landing-pages',
] as const;

const TITLES = [
  'Fix workflow row widths so the model chip stays on one line',
  'Design schema, RLS and sync contract for the training app',
  '',
  'בדיקת דפי נחיתה ושיפור הטפסים',
  'Review findings on pull request 42',
  '',
] as const;

function sample(index: number): SessionMeta {
  const codex = index % 5 === 3;
  const title = TITLES[index % TITLES.length];
  return {
    session_id: `sample-${index}`,
    source: codex ? 'codex' : 'code',
    project_path: PROJECTS[index % PROJECTS.length],
    title: title || undefined,
    start_time: new Date(NOW - index * 7 * HOUR - 25 * MINUTE).toISOString(),
    duration_minutes: 20 + index * 13,
    active_ms: index % 6 === 5 ? null : (6 + index * 4) * MINUTE,
    turn_count: 2 + (index % 9),
    pr_urls: index === 0 ? ['https://github.com/acme/claude-dashboard/pull/42', 'https://github.com/acme/claude-dashboard/pull/43'] : [],
    client: codex ? 'codex_work_desktop' : 'cli',
    client_version: codex ? '0.159.0' : '2.1.289',
    user_message_count: 6 + index,
    assistant_message_count: 18 + index * 3,
    tool_counts: index % 4 === 2 ? {} : { Bash: 22 + index, Read: 13, Edit: 7, mcp__chrome_devtools__take_screenshot: 5, Grep: 3 },
    languages: {},
    git_commits: index % 3 === 0 ? 2 : 0,
    git_pushes: index % 6 === 0 ? 1 : 0,
    input_tokens: 0,
    output_tokens: 0,
    effective_tokens: 48_000 + index * 137_000,
    cache_read_tokens: index % 2 === 0 ? 4_200_000 + index * 310_000 : 0,
    first_prompt: index % 6 === 5 ? '' : `Look at the ${PROJECTS[index % PROJECTS.length].split('\\').pop()} repo and tell me what is slow in the scan pipeline`,
    tool_errors: index % 4 === 0 ? 3 : 0,
    lines_added: index % 4 === 2 ? 0 : 120 + index * 31,
    lines_removed: index % 4 === 2 ? 0 : 14 + index * 5,
    files_modified: index % 4 === 2 ? 0 : 1 + (index % 7),
  };
}

export const SAMPLE_SESSIONS: SessionMeta[] = Array.from({ length: 24 }, (_unused, index) => sample(index));

const PROJECT_COSTS: ProjectStat[] = [
  { path: PROJECTS[0], name: 'claude-dashboard', effectiveTokens: 9_400_000, cost: 412.6, sessionCount: 6 },
  { path: PROJECTS[1], name: 'billing-service', effectiveTokens: 5_100_000, cost: 188.25, sessionCount: 6 },
  { path: PROJECTS[2], name: 'a-project-with-a-very-long-folder-name-that-has-to-truncate', effectiveTokens: 2_000_000, cost: 61.4, sessionCount: 6 },
];

const TOTAL: SessionSummaryPart = {
  sessions: 196,
  since: SINCE,
  longestActiveMs: 8 * HOUR + 19 * MINUTE,
  longestSessionId: 'sample-1',
  longestLabel: 'Design schema, RLS and sync contract for the training app',
  medianTurnMs: 76_000,
  turnCount: 1426,
  linesAdded: 657_000,
  linesRemoved: 28_000,
};

const SUMMARY: SessionSummary = {
  total: TOTAL,
  claude: { ...TOTAL, sessions: 179, longestActiveMs: 6 * HOUR + 28 * MINUTE, medianTurnMs: 78_000, linesAdded: 648_000, linesRemoved: 27_000 },
  codex: { ...TOTAL, sessions: 17, medianTurnMs: 75_000, linesAdded: 8100, linesRemoved: 862 },
};

export const STATS_VIEWS: SessionStatsView[] = [
  buildSessionStats({ summary: SUMMARY, error: null, platform: 'both' }),
  buildSessionStats({ summary: null, error: null, platform: 'claude' }),
  buildSessionStats({ summary: null, error: 'HTTP 500', platform: 'claude' }),
];

export function tableView(query: string, pageWanted: number, selectedId: string | null): SessionTableView {
  const matched = SAMPLE_SESSIONS.filter((session) => matchesQuery(session, query));
  const pageCount = pageCountFor(matched.length);
  const page = Math.min(pageWanted, pageCount);
  return buildSessionTable({
    total: SAMPLE_SESSIONS.length,
    error: null,
    matched: matched.length,
    rows: pageSlice(matched, page).map((session) => buildSessionRow(session, false)),
    page,
    pageCount,
    since: SINCE,
    noun: 'sessions',
    query,
    selectedId,
  });
}

const EMPTY_TABLE: Omit<SessionTableInput, 'total' | 'error'> = {
  matched: 0,
  rows: [],
  page: 1,
  pageCount: 1,
  since: null,
  noun: 'sessions',
  query: '',
  selectedId: null,
};

export const TABLE_STATE_VIEWS: SessionTableView[] = [
  buildSessionTable({ ...EMPTY_TABLE, total: null, error: null }),
  buildSessionTable({ ...EMPTY_TABLE, total: 0, error: null }),
  buildSessionTable({ ...EMPTY_TABLE, total: null, error: 'HTTP 500' }),
];

const HITS: SearchResult[] = [
  { sessionId: 'sample-0', source: 'code', project: 'claude-dashboard', title: TITLES[0], date: '2026-10-05', matches: 22, snippet: '...the scan pipeline reads every transcript once and emits flat rows per file, so the tabs cannot drift...' },
  { sessionId: 'sample-3', source: 'codex', project: 'landing-pages', projectPath: PROJECTS[3], title: TITLES[3], date: '2026-10-03', matches: 3, snippet: '...בדיקה של הטופס בדף הנחיתה אחרי השינוי...' },
  { sessionId: 'sample-2', source: 'code', project: 'a-project-with-a-very-long-folder-name-that-has-to-truncate', date: '2026-09-29', matches: 1, snippet: '...what is slow in the scan pipeline...' },
];

const SEARCH_BASE = { noun: 'sessions', showBadge: true } as const;

export function searchView(query: string): SessionSearchView {
  return buildSessionSearch({ ...SEARCH_BASE, query, results: HITS, loading: false, error: null });
}

export const SEARCH_STATE_VIEWS: SessionSearchView[] = [
  buildSessionSearch({ ...SEARCH_BASE, query: 'scan pipeline', results: null, loading: true, error: null }),
  buildSessionSearch({ ...SEARCH_BASE, query: 'zzqqxx', results: [], loading: false, error: null }),
  buildSessionSearch({ ...SEARCH_BASE, query: 'scan pipeline', results: null, loading: false, error: 'HTTP 500' }),
];

const TRANSCRIPT: SessionTranscript = {
  sessionId: 'sample-0',
  compactions: 0,
  totalTurns: 501,
  truncated: true,
  turns: [
    { role: 'user', ts: NOW - 3 * HOUR, text: 'The agent rows wrap at 1100px. Keep the model chip and the metrics on one line.', tools: [] },
    { role: 'assistant', ts: NOW - 3 * HOUR + 4000, text: '', tools: [], model: 'claude-opus-5-5' },
    {
      role: 'assistant',
      ts: NOW - 3 * HOUR + 9000,
      text: '',
      tools: [
        { name: 'Read', brief: 'src/components/design-system/organisms/WorkflowPhasePanes/WorkflowAgentRow/WorkflowAgentRow.tsx' },
        { name: 'Bash', brief: 'npm run typecheck' },
        { name: 'mcp__chrome_devtools__take_screenshot', brief: '' },
      ],
      model: 'claude-opus-5-5',
    },
    {
      role: 'assistant',
      ts: NOW - 3 * HOUR + 31_000,
      text: 'The label column had no minimum width, so the chip took the free space first. The row now keeps the chip and the metrics from shrinking and lets the label truncate.',
      tools: [{ name: 'Edit', brief: 'WorkflowAgentRow.tsx' }],
      model: 'claude-opus-5-5',
    },
    { role: 'user', ts: NOW - 3 * HOUR + 90_000, text: 'מעולה, תבדוק גם ברוחב 768', tools: [] },
    { role: 'assistant', ts: NOW - 3 * HOUR + 97_000, text: 'בדקתי ב-768: השורה נשארת בשורה אחת והשם נחתך עם שלוש נקודות.', tools: [], model: 'claude-sonnet-5-5' },
  ],
};

const LOADED: TranscriptState = { data: TRANSCRIPT, loading: false, error: null };

export interface TranscriptSpecimen {
  key: string;
  view: TranscriptView;
}

export const TRANSCRIPT_VIEWS: TranscriptSpecimen[] = [
  { key: 'ready', view: buildTranscript(LOADED, true, 'sessions') },
  { key: 'loading', view: buildTranscript(undefined, true, 'sessions') },
  { key: 'error', view: buildTranscript({ data: null, loading: false, error: 'HTTP 500' }, true, 'sessions') },
  {
    key: 'archived',
    view: buildTranscript({ data: { sessionId: 'x', turns: [], compactions: 0, totalTurns: 0, archived: true }, loading: false, error: null }, true, 'sessions'),
  },
  { key: 'empty', view: buildTranscript({ data: { sessionId: 'x', turns: [], compactions: 0, totalTurns: 0 }, loading: false, error: null }, true, 'threads') },
];

export function detailView(sessionId: string | null): SessionDetailView | null {
  const session = SAMPLE_SESSIONS.find((candidate) => candidate.session_id === sessionId) ?? null;
  return buildSessionDetail(session, session?.source === 'codex' ? 'threads' : 'sessions', false);
}

export function transcriptView(open: boolean): TranscriptView {
  return buildTranscript(LOADED, open, 'sessions');
}

export const INITIAL_TAGS: TagMap = {
  [PROJECTS[0]]: ['internal', 'dashboards'],
  [PROJECTS[1]]: ['client-a'],
  [PROJECTS[2]]: ['client-a', 'a-tag-name-at-the-32-character-c'],
};

const PROJECT_STATS = buildProjectStats(SAMPLE_SESSIONS, PROJECT_COSTS);

function projectInput(tags: TagMap, extra: Partial<ProjectViewsInput> = {}): ProjectViewsInput {
  return { stats: PROJECT_STATS, pending: false, error: null, since: SINCE, platform: 'both', tags, ...extra };
}

export function projectsView(sort: ProjectSort, tags: TagMap): ProjectBreakdownView {
  return buildProjectBreakdown(projectInput(tags), sort);
}

export function tagsView(tags: TagMap): TagBreakdownView {
  return buildTagBreakdown(projectInput(tags));
}

export const PROJECT_STATE_VIEWS: ProjectBreakdownView[] = [
  buildProjectBreakdown(projectInput({}, { stats: null }), 'cost'),
  buildProjectBreakdown(projectInput({}, { stats: [] }), 'cost'),
  buildProjectBreakdown(projectInput({}, { stats: null, error: 'HTTP 500' }), 'cost'),
];

export const TAG_STATE_VIEWS: TagBreakdownView[] = [
  buildTagBreakdown(projectInput({}, { stats: null })),
  buildTagBreakdown(projectInput({})),
  buildTagBreakdown(projectInput({}, { stats: null, error: 'HTTP 500' })),
];

export const TAG_SUGGESTIONS = ['client-a', 'dashboards', 'internal'];
