import { useState, useMemo } from 'react';
import { compact } from '@/lib/format';
import { ExportButton } from '@/components/design-system/molecules/ExportButton/ExportButton';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Modal } from '@/components/design-system/molecules/Modal/Modal';
import { useTranscript } from '@/hooks/useTranscript';
import { SessionSearchStrip } from './SessionSearchStrip/SessionSearchStrip';
import { SessionDetail } from './SessionDetail/SessionDetail';
import type { SessionHistoryTableProps } from './types';
import type { SessionMeta } from '@/types';
import {
  ITEMS_PER_PAGE, durationCell, exportJson, exportRows, formatDate, matchesQuery, sessionHeadline, sessionLabel,
  sessionTokens, sinceLabel, singularNoun,
} from './utils';

export function SessionHistoryTable({
  sessions,
  since,
  periodDays,
  onExport,
  hideSourceBadge = false,
  noun = 'sessions',
}: SessionHistoryTableProps) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [modalSession, setModalSession] = useState<SessionMeta | null>(null);

  // Transcript hook — shared instance across the table (fetch is lazy, on expand).
  const { getTranscript, states: transcriptStates } = useTranscript();

  const filteredSessions = useMemo(() => sessions.filter((s) => matchesQuery(s, search)), [sessions, search]);
  const totalPages = Math.ceil(filteredSessions.length / ITEMS_PER_PAGE) || 1;
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSessions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSessions, currentPage]);

  // The search strip is scoped to the same platform as this list, so the id is always found here.
  const jumpToSession = (sessionId: string) => {
    const s = sessions.find((x) => x.session_id === sessionId);
    if (s) setModalSession(s);
  };

  const sinceText = sinceLabel(since);
  const modalLabel = modalSession ? sessionLabel(modalSession) : null;

  return (
    <div className="card p-5 flex flex-col h-full">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-none">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-zinc-300">
            {singularNoun(noun, true)} History
            <InfoTip text={`Every ${singularNoun(noun)} on record — start time, project, title (or first prompt), active time and effective tokens. Duration is active time: the sum of each turn from prompt to answer; hover it for the wall-clock span, which includes idle time. Click a row for its summary and full transcript. Search matches titles, prompts and project names; export the list with the button.`} />
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {sessions.length} {noun}
            {sinceText && ` since ${sinceText}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search titles, prompts, projects..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg bg-ink-900 border border-white/10 px-3 py-1 text-xs text-zinc-300 focus:border-clay-500 focus:outline-none w-full sm:w-56"
          />
          {onExport && (
            <ExportButton
              label="Export"
              getData={() => {
                const data = onExport();
                return { csv: exportRows(data), json: exportJson(data), filename: 'sessions' };
              }}
            />
          )}
        </div>
      </div>

      <SessionSearchStrip
        query={search}
        days={periodDays}
        onJump={jumpToSession}
        showSourceBadge={!hideSourceBadge}
        noun={noun}
      />

      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-zinc-500 font-semibold uppercase tracking-wider">
              <th className="py-2.5">Start Time</th>
              <th className="py-2.5">Project</th>
              <th className="py-2.5">{singularNoun(noun, true)}</th>
              <th className="py-2.5 text-right">Duration</th>
              <th className="py-2.5 text-right">Tokens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-zinc-300">
            {paginatedSessions.length > 0 ? (
              paginatedSessions.map((s) => {
                const { name: projectName, badge } = sessionLabel(s);
                const sourceBadge = hideSourceBadge ? null : badge;
                const headline = sessionHeadline(s);
                const duration = durationCell(s);
                return (
                  <tr
                    key={s.session_id}
                    onClick={() => setModalSession(s)}
                    className="hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <td className="py-3 font-mono text-zinc-400 text-xs whitespace-nowrap pr-3">{formatDate(s.start_time)}</td>
                    <td className="py-3 font-semibold text-zinc-300 pr-3">
                      {projectName}
                      {sourceBadge && (
                        <span className="ml-1.5 align-middle">
                          <Badge variant="info">{sourceBadge}</Badge>
                        </span>
                      )}
                    </td>
                    <td
                      dir="auto"
                      className="py-3 text-zinc-400 truncate max-w-xs md:max-w-md"
                      title={s.first_prompt || s.title}
                    >
                      {s.title ? (
                        <span className="text-zinc-200">{s.title}</span>
                      ) : headline ? (
                        `"${headline}"`
                      ) : (
                        <span className="italic text-zinc-600">no prompt</span>
                      )}
                    </td>
                    <td
                      className={`py-3 text-right font-mono whitespace-nowrap ${duration.active ? 'text-zinc-400' : 'text-zinc-600'}`}
                      title={duration.tooltip}
                    >
                      {duration.text}
                    </td>
                    <td className="py-3 text-right font-mono text-xs">{compact(sessionTokens(s))}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-500 italic">
                  No {noun} found matching search query
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 flex-none text-xs text-zinc-500">
        <span>
          Showing {filteredSessions.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
          {Math.min(currentPage * ITEMS_PER_PAGE, filteredSessions.length)} of {filteredSessions.length} {noun}
        </span>

        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
            disabled={currentPage === 1}
            className="rounded-lg px-2.5 py-1 bg-ink-700/50 border border-white/10 text-zinc-300 hover:text-zinc-100 disabled:opacity-30 disabled:hover:text-zinc-300 transition-opacity"
          >
            Prev
          </button>
          <span className="py-1 px-2 font-mono text-zinc-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((c) => Math.min(totalPages, c + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg px-2.5 py-1 bg-ink-700/50 border border-white/10 text-zinc-300 hover:text-zinc-100 disabled:opacity-30 disabled:hover:text-zinc-300 transition-opacity"
          >
            Next
          </button>
        </div>
      </div>

      <Modal
        open={!!modalSession}
        onClose={() => setModalSession(null)}
        title={
          modalSession &&
          modalLabel && (
            <div className="flex items-center gap-3 min-w-0 text-sm">
              <span dir="auto" className="font-bold text-zinc-100 truncate">
                {modalSession.title || modalLabel.name}
              </span>
              {modalSession.title && <span className="text-zinc-400 truncate flex-none max-w-[30%]">{modalLabel.name}</span>}
              {!hideSourceBadge && modalLabel.badge && <Badge variant="info">{modalLabel.badge}</Badge>}
              <span className="text-zinc-500 font-mono text-xs flex-none">{formatDate(modalSession.start_time)}</span>
              <span className="text-zinc-500 font-mono text-xs flex-none">{compact(sessionTokens(modalSession))} tok</span>
            </div>
          )
        }
      >
        {modalSession && (
          <SessionDetail
            key={modalSession.session_id}
            session={modalSession}
            transcript={transcriptStates.get(modalSession.session_id)}
            onFetchTranscript={getTranscript}
            noun={noun}
          />
        )}
      </Modal>
    </div>
  );
}
