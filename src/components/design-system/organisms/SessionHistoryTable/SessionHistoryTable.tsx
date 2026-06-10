import { useState, useMemo, Fragment } from 'react';
import { compact } from '@/lib/format';
import { ExportButton } from '@/components/design-system/molecules/ExportButton/ExportButton';
import type { SessionHistoryTableProps } from './types';
import { formatDate, getProjectName } from './utils';

export function SessionHistoryTable({
  sessions,
  periodDays,
  onExport,
}: SessionHistoryTableProps) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  const itemsPerPage = 5;

  const toggleExpand = (id: string) => {
    setExpandedSessions((prev) => ({ ...prev, [id]: !prev[id] }));
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

  return (
    <div className="card p-5 flex flex-col h-full">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-none">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
            Session History Log · {periodDays}d
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
                const isExpanded = !!expandedSessions[s.session_id];
                const projectName = getProjectName(s.project_path);
                const totalToks = s.effective_tokens ?? (s.input_tokens ?? 0) + (s.output_tokens ?? 0);

                return (
                  <Fragment key={s.session_id}>
                    <tr
                      onClick={() => toggleExpand(s.session_id)}
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
                    {isExpanded && (
                      <tr className="bg-ink-900/30">
                        <td colSpan={5} className="p-4 text-xs border-t border-white/5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Left Col: Core stats */}
                            <div className="space-y-2.5">
                              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
                                Session Summary
                              </span>
                              <div className="space-y-1.5 text-zinc-400">
                                <div>
                                  Messages:{' '}
                                  <span className="text-zinc-200">
                                    {s.user_message_count} user / {s.assistant_message_count} agent
                                  </span>
                                </div>
                                <div>
                                  Modifications:{' '}
                                  <span className="text-zinc-200">
                                    {s.files_modified ?? 0} files ({s.lines_added ?? 0} additions, {s.lines_removed ?? 0} deletions)
                                  </span>
                                </div>
                                <div>
                                  Tokens:{' '}
                                  <span className="text-zinc-200">
                                    {compact(s.effective_tokens ?? (s.input_tokens + s.output_tokens))} effective
                                    {s.cache_read_tokens ? ` (+${compact(s.cache_read_tokens)} cache reads)` : ''}
                                  </span>
                                </div>
                                {(s.git_commits > 0 || s.git_pushes > 0) && (
                                  <div>
                                    Git Operations:{' '}
                                    <span className="text-zinc-200">
                                      {s.git_commits} commit{s.git_commits !== 1 && 's'}
                                      {s.git_pushes > 0 && `, ${s.git_pushes} push${s.git_pushes !== 1 && 'es'}`}
                                    </span>
                                  </div>
                                )}
                                {s.tool_errors !== undefined && s.tool_errors > 0 && (
                                  <div>
                                    Tool Errors:{' '}
                                    <span className="text-red-400 font-semibold">{s.tool_errors} errors</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Middle Col: Tool usage breakdown */}
                            <div className="md:col-span-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-2">
                                Tool Invocation Breakdown
                              </span>
                              {s.tool_counts && Object.keys(s.tool_counts).length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(s.tool_counts).map(([tool, count]) => (
                                    <div
                                      key={tool}
                                      className="rounded-lg bg-ink-800 border border-white/5 px-2.5 py-1 flex items-center gap-1.5"
                                    >
                                      <span className="font-semibold text-clay-400 font-mono">
                                        {count}
                                      </span>
                                      <span className="text-zinc-300 font-sans">{tool}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-zinc-600 italic">No tools were invoked in this session</div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
    </div>
  );
}
