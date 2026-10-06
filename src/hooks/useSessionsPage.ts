import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useExport } from './useExport';
import { useRegisterPageExport } from './usePageActions';
import { usePolling } from './usePolling';
import { useSearch } from './useSearch';
import { useSessionPeriod } from './useSessionPeriod';
import { useSource } from './useSource';
import { useTags } from './useTags';
import { useTranscript } from './useTranscript';
import { useViewFade } from './useViewFade';
import type { ViewFade } from './useViewFade';
import type { ExportFormat } from '@/lib/export';
import { buildProjectStats } from '@/lib/project';
import {
  SESSIONS_EXPORT_FILENAME,
  SESSIONS_VIEW_PARAM,
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
  sessionExportJson,
  sessionExportRows,
  sessionNoun,
  sessionsDescription,
  sessionsTabs,
  tagMovesFrom,
  type ProjectBreakdownView,
  type ProjectSort,
  type SessionDetailView,
  type SessionSearchView,
  type SessionStatsView,
  type SessionTableView,
  type SessionsTabItem,
  type SessionsView,
  type TagBreakdownView,
  type TranscriptView,
} from '@/lib/views/sessions';
import type { ProjectData, SessionMeta, SessionSummary } from '@/types';

export interface SessionsPageView {
  view: SessionsView;
  tabs: readonly SessionsTabItem[] | null;
  description: string;
  onViewChange: (view: SessionsView) => void;
  viewFade: ViewFade;
  exportDisabled: boolean;
  onExport: (format: ExportFormat) => void;
  stats: SessionStatsView;
  search: SessionSearchView;
  onSearchChange: (query: string) => void;
  table: SessionTableView;
  onPageChange: (page: number) => void;
  onOpenSession: (sessionId: string) => void;
  detail: SessionDetailView | null;
  transcript: TranscriptView;
  onCloseSession: () => void;
  onToggleTranscript: () => void;
  onRetryTranscript: () => void;
  projects: ProjectBreakdownView;
  onProjectSortChange: (sort: ProjectSort) => void;
  onProjectTagsChange: (path: string, tags: string[]) => void;
  tags: TagBreakdownView;
}

const SESSIONS_POLL_MS = 10_000;
const SUMMARY_POLL_MS = 30_000;
const PROJECTS_POLL_MS = 30_000;

export function useSessionsPage(): SessionsPageView {
  const { platform, effectiveSource, withSrc } = useSource();
  const [params, setParams] = useSearchParams();
  const noun = sessionNoun(platform);
  // Under Codex every row is a Codex thread, so the badge would label the whole list rather than distinguish anything in it.
  const hideBadge = platform === 'codex';
  // Cowork sessions run in a sandbox with no host project, so that surface has no projects view.
  const hasProjects = effectiveSource !== 'cowork';
  const view: SessionsView = hasProjects && params.get(SESSIONS_VIEW_PARAM) === 'projects' ? 'projects' : 'sessions';
  const onProjects = view === 'projects';

  const sessions = usePolling<SessionMeta[]>(withSrc('/api/sessions'), SESSIONS_POLL_MS);
  const summary = usePolling<SessionSummary>(withSrc('/api/sessions/summary'), SUMMARY_POLL_MS);
  // A year of cost, so the rollup covers every listed session (the list is not windowed).
  const projectCosts = usePolling<ProjectData>(onProjects ? withSrc('/api/projects?days=365') : '', PROJECTS_POLL_MS);
  const period = useSessionPeriod(sessions.data);
  const { tags: tagMap, migrate, setTagsFor } = useTags();
  const { getTranscript, states: transcripts } = useTranscript();
  const exportData = useExport();

  const [query, setQuery] = useState('');
  const [pageWanted, setPageWanted] = useState(1);
  const [selected, setSelected] = useState<SessionMeta | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [projectSort, setProjectSort] = useState<ProjectSort>('cost');

  const search = useSearch(onProjects ? '' : query, period.days);

  // Project paths come from the transcript's real cwd, so tags saved under an old lossy path move onto the new one.
  useEffect(() => {
    const moves = tagMovesFrom(projectCosts.data?.projects);
    if (moves.length) migrate(moves);
  }, [projectCosts.data, migrate]);

  const sessionsRef = useRef(sessions.data);
  sessionsRef.current = sessions.data;

  const onViewChange = useCallback(
    (next: SessionsView) => {
      setParams((prev) => {
        const updated = new URLSearchParams(prev);
        if (next === 'sessions') updated.delete(SESSIONS_VIEW_PARAM);
        else updated.set(SESSIONS_VIEW_PARAM, next);
        return updated;
      });
    },
    [setParams],
  );

  const onSearchChange = useCallback((next: string) => {
    setQuery(next);
    setPageWanted(1);
  }, []);

  const onPageChange = useCallback((next: number) => setPageWanted(Math.max(1, next)), []);

  const onOpenSession = useCallback((sessionId: string) => {
    const found = sessionsRef.current?.find((s) => s.session_id === sessionId);
    if (!found) return;
    setSelected(found);
    setTranscriptOpen(false);
  }, []);

  const onCloseSession = useCallback(() => setSelected(null), []);

  const selectedId = selected?.session_id ?? null;

  // The transcript endpoint parses a whole file, so it is fetched only when the pane is opened.
  const onToggleTranscript = useCallback(() => {
    if (!selectedId) return;
    if (!transcriptOpen) getTranscript(selectedId);
    setTranscriptOpen(!transcriptOpen);
  }, [selectedId, transcriptOpen, getTranscript]);

  const onRetryTranscript = useCallback(() => {
    if (selectedId) getTranscript(selectedId);
  }, [selectedId, getTranscript]);

  const getExport = useCallback(
    () =>
      sessions.data
        ? { filename: SESSIONS_EXPORT_FILENAME, csv: sessionExportRows(sessions.data), json: sessionExportJson(sessions.data) }
        : null,
    [sessions.data],
  );
  const canExport = Boolean(sessions.data?.length);
  useRegisterPageExport(canExport ? getExport : null);
  const onExport = useCallback((format: ExportFormat) => exportData(getExport, format), [exportData, getExport]);

  const stats = useMemo(
    () => buildSessionStats({ summary: summary.data, error: summary.error, platform }),
    [summary.data, summary.error, platform],
  );

  const searchView = useMemo(
    () =>
      buildSessionSearch({
        query,
        results: search.results,
        loading: search.loading,
        error: search.error,
        noun,
        showBadge: !hideBadge,
      }),
    [query, search.results, search.loading, search.error, noun, hideBadge],
  );

  const matched = useMemo(() => (sessions.data ?? []).filter((s) => matchesQuery(s, query)), [sessions.data, query]);
  const pageCount = pageCountFor(matched.length);
  const page = Math.min(pageWanted, pageCount);
  // Only the page on screen gets row view models: the list can hold thousands of sessions.
  const pageSessions = useMemo(() => pageSlice(matched, page), [matched, page]);
  const rows = useMemo(() => pageSessions.map((s) => buildSessionRow(s, hideBadge)), [pageSessions, hideBadge]);

  const table = useMemo(
    () =>
      buildSessionTable({
        total: sessions.data ? sessions.data.length : null,
        error: sessions.error,
        matched: matched.length,
        rows,
        page,
        pageCount,
        since: period.since,
        noun,
        query,
        selectedId,
      }),
    [sessions.data, sessions.error, matched.length, rows, page, pageCount, period.since, noun, query, selectedId],
  );

  const current = useMemo(
    () => (selected ? sessions.data?.find((s) => s.session_id === selected.session_id) ?? selected : null),
    [selected, sessions.data],
  );
  const detail = useMemo(() => buildSessionDetail(current, noun, hideBadge), [current, noun, hideBadge]);

  const transcriptState = selectedId ? transcripts.get(selectedId) : undefined;
  const transcript = useMemo(() => buildTranscript(transcriptState, transcriptOpen, noun), [transcriptState, transcriptOpen, noun]);

  const projectStats = useMemo(
    () => (onProjects && sessions.data ? buildProjectStats(sessions.data, projectCosts.data?.projects) : null),
    [onProjects, sessions.data, projectCosts.data],
  );
  const projectInput = useMemo(
    () => ({
      stats: projectStats,
      // Until the cost poll answers, a cost-sorted list would flash every project as having no cost.
      pending: onProjects && !projectCosts.data && !projectCosts.error,
      error: sessions.error,
      since: period.since,
      platform,
      tags: tagMap,
    }),
    [projectStats, onProjects, projectCosts.data, projectCosts.error, sessions.error, period.since, platform, tagMap],
  );
  const projects = useMemo(() => buildProjectBreakdown(projectInput, projectSort), [projectInput, projectSort]);
  const tags = useMemo(() => buildTagBreakdown(projectInput), [projectInput]);

  const onProjectTagsChange = useCallback((path: string, next: string[]) => setTagsFor(path, next), [setTagsFor]);

  const viewFade = useViewFade(view);

  return {
    view,
    tabs: hasProjects ? sessionsTabs(noun) : null,
    description: sessionsDescription(noun),
    onViewChange,
    viewFade,
    exportDisabled: !canExport,
    onExport,
    stats,
    search: searchView,
    onSearchChange,
    table,
    onPageChange,
    onOpenSession,
    detail,
    transcript,
    onCloseSession,
    onToggleTranscript,
    onRetryTranscript,
    projects,
    onProjectSortChange: setProjectSort,
    onProjectTagsChange,
    tags,
  };
}
