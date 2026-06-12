import { useState, useMemo, useEffect } from 'react';
import { compact } from '@/lib/format';
import { ExportButton } from '@/components/design-system/molecules/ExportButton/ExportButton';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { Modal } from '@/components/design-system/molecules/Modal/Modal';
import { useTranscript } from '@/hooks/useTranscript';
import { useSearch } from '@/hooks/useSearch';
import type { SessionHistoryTableProps } from './types';
import type { SessionMeta, SessionTranscriptTurn } from '@/types';
import { formatDate, getProjectName } from './utils';

// ── Transcript viewer ──────────────────────────────────────────────────────

function TurnBlock({ turn }: { turn: SessionTranscriptTurn }) {
  const isUser = turn.role === 'user';
  const ts = turn.ts ? new Date(turn.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  return (
    <div className="flex gap-2 text-xs" dir="ltr">
      {/* Role icon */}
      <span className="flex-none select-none text-base leading-none mt-0.5">
        {isUser ? '🧑' : '🤖'}
      </span>

      <div className="flex flex-col gap-1 min-w-0 flex-1 items-start">
        {/* Header: timestamp + model */}
        <div className="flex items-center gap-2 flex-wrap">
          {ts && <span className="text-zinc-600 font-mono">{ts}</span>}
          {!isUser && turn.model && (
            <span className="text-zinc-600 italic">{turn.model.replace(/^claude-/, '').replace(/-\d{8}$/, '')}</span>
          )}
        </div>

        {/* Text block — omitted entirely for tool-only turns */}
        {(turn.text || !turn.tools?.length) && (
          <div
            className={`rounded-xl px-3 py-2 max-h-[300px] overflow-y-auto leading-relaxed whitespace-pre-wrap break-words ${
              isUser
                ? 'bg-ink-700/50 text-zinc-300'
                : 'bg-clay-500/5 text-zinc-300 border border-clay-500/10'
            }`}
            style={{ maxWidth: '85%' }}
          >
            {turn.text || <span className="italic text-zinc-600">(empty)</span>}
          </div>
        )}

        {/* Tool chips */}
        {!isUser && turn.tools && turn.tools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {turn.tools.map((t, i) => (
              <span
                key={i}
                className="rounded-full bg-ink-700 border border-white/5 px-2 py-0.5 text-zinc-400"
                title={t.brief || t.name}
              >
                {t.name}
                {t.brief && (
                  <span className="ml-1 text-zinc-600 truncate max-w-[120px] inline-block align-bottom">
                    {t.brief}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TranscriptPaneProps {
  sessionId: string;
  onFetch: (id: string) => void;
  state: { data: import('@/types').SessionTranscript | null; loading: boolean; error: string | null } | undefined;
}

function TranscriptPane({ sessionId, onFetch, state }: TranscriptPaneProps) {
  // Trigger fetch on mount
  useEffect(() => {
    onFetch(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (!state || state.loading) {
    return (
      <div className="py-4 flex items-center gap-2 text-xs text-zinc-600">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-700 animate-pulse" />
        Loading transcript…
      </div>
    );
  }
  if (state.error) {
    return <div className="py-4 text-xs text-red-400">Failed to load transcript: {state.error}</div>;
  }
  if (!state.data) return null;

  const { turns, truncated, totalTurns } = state.data;

  return (
    <div className="flex flex-col gap-3 pt-2">
      {truncated && (
        <div className="text-xs text-amber-400/70 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-1.5">
          Long session — middle turns omitted. Showing {turns.length} of {totalTurns} turns.
        </div>
      )}
      {turns.map((turn, i) => (
        <TurnBlock key={i} turn={turn} />
      ))}
    </div>
  );
}

// ── Search results strip ───────────────────────────────────────────────────

function SearchStrip({
  query,
  onJump,
}: {
  query: string;
  onJump: (sessionId: string) => void;
}) {
  const { results, loading } = useSearch(query);

  if (query.length < 3) return null;

  if (loading) {
    return (
      <div className="mb-3 rounded-xl bg-ink-700/40 border border-white/5 px-3 py-2 text-xs text-zinc-600">
        Searching transcripts…
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="mb-3 rounded-xl bg-ink-700/40 border border-white/5 px-3 py-2 text-xs text-zinc-600">
        No transcript matches for "{query}"
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-xl bg-ink-700/40 border border-white/5 overflow-hidden">
      <div className="px-3 py-2 border-b border-white/5 text-xs font-semibold text-zinc-400">
        Found in {results.length} session transcript{results.length !== 1 ? 's' : ''}
      </div>
      <div className="divide-y divide-white/5">
        {results.slice(0, 8).map((r) => (
          <button
            key={r.sessionId}
            onClick={() => onJump(r.sessionId)}
            className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors flex flex-col gap-0.5"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-zinc-300 truncate">{r.project || 'unknown'}</span>
              <span className="text-zinc-600 flex-none">{r.date}</span>
              {r.matches > 1 && (
                <span className="text-clay-400 flex-none">{r.matches} matches</span>
              )}
            </div>
            {r.snippet && (
              <p className="text-xs text-zinc-500 line-clamp-1">{r.snippet}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main table ─────────────────────────────────────────────────────────────

export function SessionHistoryTable({
  sessions,
  periodDays,
  onExport,
}: SessionHistoryTableProps) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [modalSession, setModalSession] = useState<SessionMeta | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  // Transcript hook — shared instance across table
  const { getTranscript, states: transcriptStates } = useTranscript();

  const itemsPerPage = 5;

  // Transcript stays collapsed until the user asks for it (fetch is lazy too).
  const openSession = (s: SessionMeta) => {
    setModalSession(s);
    setTranscriptOpen(false);
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const promptMatch = s.first_prompt?.toLowerCase().includes(search.toLowerCase());
      const projectMatch = s.project_path?.toLowerCase().includes(search.toLowerCase());
      return promptMatch || projectMatch;
    });
  }, [sessions, search]);

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage) || 1;

  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSessions.slice(start, start + itemsPerPage);
  }, [filteredSessions, currentPage]);

  // Jump to a session from the search strip: open its modal directly.
  const jumpToSession = (sessionId: string) => {
    const s = sessions.find((x) => x.session_id === sessionId);
    if (s) openSession(s);
  };

  return (
    <div className="card p-5 flex flex-col h-full">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-none">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-zinc-300">
            Session History Log · {periodDays}d
            <InfoTip text="Every session in the window — start time, project, first prompt, duration and tokens. Click a row to open its full transcript. Search by project name or prompt text; export the list with the button." />
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Search and review past execution records</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search projects or prompts..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg bg-ink-900 border border-white/10 px-3 py-1 text-xs text-zinc-300 focus:border-clay-500 focus:outline-none w-full sm:w-52"
          />
          {onExport && (
            <ExportButton
              label="Export"
              getData={() => {
                const data = onExport();
                const csv = data.map((s) => ({
                  session_id: s.session_id,
                  start_time: s.start_time,
                  project: s.project_path,
                  duration_minutes: s.duration_minutes,
                  effective_tokens: s.effective_tokens ?? (s.input_tokens + s.output_tokens),
                  cache_read_tokens: s.cache_read_tokens ?? 0,
                  files_modified: s.files_modified ?? 0,
                  lines_added: s.lines_added ?? 0,
                  lines_removed: s.lines_removed ?? 0,
                  git_commits: s.git_commits,
                  first_prompt: s.first_prompt,
                }));
                return { csv, json: data, filename: 'sessions' };
              }}
            />
          )}
        </div>
      </div>

      {/* Full-text search results strip */}
      <SearchStrip query={search} onJump={jumpToSession} />

      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-zinc-500 font-semibold uppercase tracking-wider">
              <th className="py-2.5">Start Time</th>
              <th className="py-2.5">Project</th>
              <th className="py-2.5">First Prompt</th>
              <th className="py-2.5 text-right">Duration</th>
              <th className="py-2.5 text-right">Tokens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-zinc-300">
            {paginatedSessions.length > 0 ? (
              paginatedSessions.map((s) => {
                const projectName = s.source === 'cowork' ? 'Cowork' : getProjectName(s.project_path);
                const totalToks = s.effective_tokens ?? (s.input_tokens ?? 0) + (s.output_tokens ?? 0);

                return (
                  <tr
                    key={s.session_id}
                    onClick={() => openSession(s)}
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <td className="py-3 font-mono text-zinc-400 text-xs">
                      {formatDate(s.start_time)}
                    </td>
                    <td className="py-3 font-semibold text-zinc-300">{projectName}</td>
                    <td className="py-3 text-zinc-400 truncate max-w-xs md:max-w-md" title={s.first_prompt}>
                      {s.first_prompt ? `"${s.first_prompt}"` : <span className="italic text-zinc-600">no prompt</span>}
                    </td>
                    <td className="py-3 text-right font-mono text-zinc-400">
                      {s.duration_minutes ? `${s.duration_minutes}m` : '<1m'}
                    </td>
                    <td className="py-3 text-right font-mono text-xs">
                      {compact(totalToks)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-500 italic">
                  No sessions found matching search query
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 flex-none text-xs text-zinc-500">
        <span>
          Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
          {Math.min(currentPage * itemsPerPage, filteredSessions.length)} of{' '}
          {filteredSessions.length} sessions
        </span>

        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
            disabled={currentPage === 1}
            className="rounded-lg px-2.5 py-1 bg-ink-700/50 border border-white/5 text-zinc-300 hover:text-zinc-100 disabled:opacity-30 disabled:hover:text-zinc-300 transition-opacity"
          >
            Prev
          </button>
          <span className="py-1 px-2 font-mono text-zinc-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((c) => Math.min(totalPages, c + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg px-2.5 py-1 bg-ink-700/50 border border-white/5 text-zinc-300 hover:text-zinc-100 disabled:opacity-30 disabled:hover:text-zinc-300 transition-opacity"
          >
            Next
          </button>
        </div>
      </div>

      {/* Session detail modal */}
      <Modal
        open={!!modalSession}
        onClose={() => setModalSession(null)}
        title={
          modalSession && (
            <div className="flex items-center gap-3 min-w-0 text-sm">
              <span className="font-bold text-zinc-100 truncate">
                {modalSession.source === 'cowork' ? 'Cowork' : getProjectName(modalSession.project_path)}
              </span>
              <span className="text-zinc-500 font-mono text-xs flex-none">
                {formatDate(modalSession.start_time)}
              </span>
              <span className="text-zinc-500 font-mono text-xs flex-none">
                {compact(modalSession.effective_tokens ?? (modalSession.input_tokens + modalSession.output_tokens))} tok
              </span>
            </div>
          )
        }
      >
        {modalSession && (
          <div className="text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Core stats */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
                  Session Summary
                </span>
                <div className="space-y-1.5 text-zinc-400">
                  <div>
                    Messages:{' '}
                    <span className="text-zinc-200">
                      {modalSession.user_message_count} user / {modalSession.assistant_message_count} agent
                    </span>
                  </div>
                  <div>
                    Modifications:{' '}
                    <span className="text-zinc-200">
                      {modalSession.files_modified ?? 0} files ({modalSession.lines_added ?? 0} additions, {modalSession.lines_removed ?? 0} deletions)
                    </span>
                  </div>
                  <div>
                    Tokens:{' '}
                    <span className="text-zinc-200">
                      {compact(modalSession.effective_tokens ?? (modalSession.input_tokens + modalSession.output_tokens))} effective
                      {modalSession.cache_read_tokens ? ` (+${compact(modalSession.cache_read_tokens)} cache reads)` : ''}
                    </span>
                  </div>
                  {(modalSession.git_commits > 0 || modalSession.git_pushes > 0) && (
                    <div>
                      Git Operations:{' '}
                      <span className="text-zinc-200">
                        {modalSession.git_commits} commit{modalSession.git_commits !== 1 && 's'}
                        {modalSession.git_pushes > 0 && `, ${modalSession.git_pushes} push${modalSession.git_pushes !== 1 && 'es'}`}
                      </span>
                    </div>
                  )}
                  {modalSession.tool_errors !== undefined && modalSession.tool_errors > 0 && (
                    <div>
                      Tool Errors:{' '}
                      <span className="text-red-400 font-semibold">{modalSession.tool_errors} errors</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tool usage breakdown */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-2">
                  Tool Invocation Breakdown
                </span>
                {modalSession.tool_counts && Object.keys(modalSession.tool_counts).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(modalSession.tool_counts).map(([tool, count]) => (
                      <div
                        key={tool}
                        className="rounded-lg bg-ink-800 border border-white/5 px-2.5 py-1 flex items-center gap-1.5"
                      >
                        <span className="font-semibold text-clay-400 font-mono">{count}</span>
                        <span className="text-zinc-300 font-sans">{tool}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-zinc-600 italic">No tools were invoked in this session</div>
                )}
              </div>
            </div>

            {/* Transcript — collapsed by default, fetched on first expand */}
            <div className="mt-5 border-t border-white/5 pt-4">
              <button
                onClick={() => setTranscriptOpen((v) => !v)}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <span className={`inline-block transition-transform ${transcriptOpen ? 'rotate-90' : ''}`}>▸</span>
                Transcript
                {transcriptStates.get(modalSession.session_id)?.data && (
                  <span className="normal-case font-normal text-zinc-600">
                    {transcriptStates.get(modalSession.session_id)!.data!.turns.length} turns
                  </span>
                )}
              </button>
              {transcriptOpen && (
                <TranscriptPane
                  sessionId={modalSession.session_id}
                  onFetch={getTranscript}
                  state={transcriptStates.get(modalSession.session_id)}
                />
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
