import { useState } from 'react';
import { compact, toolLabel } from '@/lib/format';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { TranscriptPane } from '../TranscriptPane/TranscriptPane';
import { formatDurationMs, prLabel, sessionTokens, singularNoun } from '../utils';
import type { SessionDetailProps } from './types';

export function SessionDetail({ session: s, transcript, onFetchTranscript, noun }: SessionDetailProps) {
  const one = singularNoun(noun);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const prs = s.pr_urls ?? [];
  const wall = formatDurationMs((s.duration_minutes ?? 0) * 60_000);
  const hasActive = s.active_ms !== null && s.active_ms !== undefined;
  const linesAdded = s.lines_added ?? 0;
  const linesRemoved = s.lines_removed ?? 0;
  const files = s.files_modified ?? 0;
  const toolEntries = Object.entries(s.tool_counts ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="text-xs">
      {s.title && s.first_prompt && s.first_prompt !== s.title && (
        <p dir="auto" className="mb-4 text-zinc-500 line-clamp-2" title={s.first_prompt}>
          “{s.first_prompt}”
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
            {singularNoun(noun, true)} Summary
          </span>
          <div className="space-y-1.5 text-zinc-400">
            <div className="flex items-center gap-1">
              Turns:{' '}
              <span className="text-zinc-200">
                {s.turn_count !== undefined
                  ? `${s.turn_count} turn${s.turn_count !== 1 ? 's' : ''} · ${s.assistant_message_count} model responses`
                  : `${s.user_message_count} user / ${s.assistant_message_count} agent`}
              </span>
              <InfoTip text={`A turn is one prompt and the work it triggered, up to the answer. Model responses count every API response in the ${one}, subagents included — each tool round-trip is one. Counted the same way on every platform.`} />
            </div>
            <div>
              Time:{' '}
              <span className="text-zinc-200">
                {hasActive ? `${formatDurationMs(s.active_ms ?? 0)} active · ${wall} wall clock` : `${wall} wall clock`}
              </span>
            </div>
            <div>
              Modifications:{' '}
              <span className="text-zinc-200">
                {files === 0 && linesAdded === 0 && linesRemoved === 0 ? (
                  'none'
                ) : (
                  <>
                    {files} file{files !== 1 && 's'} ·{' '}
                    <span className="text-emerald-400">+{linesAdded.toLocaleString()}</span>{' '}
                    <span className="text-red-400">−{linesRemoved.toLocaleString()}</span> lines
                  </>
                )}
              </span>
            </div>
            <div>
              Tokens:{' '}
              <span className="text-zinc-200">
                {compact(sessionTokens(s))} effective
                {s.cache_read_tokens ? ` (+${compact(s.cache_read_tokens)} cache reads)` : ''}
              </span>
            </div>
            {(s.git_commits > 0 || s.git_pushes > 0) && (
              <div>
                Git:{' '}
                <span className="text-zinc-200">
                  {s.git_commits} commit{s.git_commits !== 1 && 's'}
                  {s.git_pushes > 0 && `, ${s.git_pushes} push${s.git_pushes !== 1 ? 'es' : ''}`}
                </span>
              </div>
            )}
            {s.tool_errors !== undefined && s.tool_errors > 0 && (
              <div>
                Tool errors: <span className="text-red-400 font-semibold">{s.tool_errors}</span>
              </div>
            )}
            {s.client && (
              <div>
                Client:{' '}
                <span className="text-zinc-200">
                  {s.client}
                  {s.client_version ? ` ${s.client_version}` : ''}
                </span>
              </div>
            )}
          </div>

          {prs.length > 0 && (
            <div className="pt-1">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
                Pull requests
              </span>
              <div className="flex flex-wrap gap-1.5">
                {prs.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-ink-700 border border-white/10 px-2 py-0.5 font-mono text-clay-400 hover:text-clay-300 hover:border-clay-500/40 transition-colors"
                  >
                    {prLabel(url)}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-2">
            Tool Invocation Breakdown
          </span>
          {toolEntries.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {toolEntries.map(([tool, count]) => (
                <div
                  key={tool}
                  className="rounded-lg bg-ink-800 border border-white/10 px-2.5 py-1 flex items-center gap-1.5"
                >
                  <span className="font-semibold text-clay-400 font-mono">{count}</span>
                  <span className="text-zinc-300 font-sans">{toolLabel(tool)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-zinc-600 italic">No tools were invoked in this {one}</div>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <button
          onClick={() => setTranscriptOpen((v) => !v)}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <span className={`inline-block transition-transform ${transcriptOpen ? 'rotate-90' : ''}`}>▸</span>
          Transcript
          {transcript?.data && !transcript.data.archived && (
            <span className="normal-case font-normal text-zinc-600">{transcript.data.totalTurns} messages</span>
          )}
        </button>
        {transcriptOpen && (
          <TranscriptPane sessionId={s.session_id} onFetch={onFetchTranscript} state={transcript} noun={noun} />
        )}
      </div>
    </div>
  );
}
