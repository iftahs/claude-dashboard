import { useEffect, useReducer } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { useAutoResume } from '@/hooks/useAutoResume';
import { formatCountdown, projectBasename, shortSessionId } from './utils';
import type { ResumeJob } from '@/types';

/**
 * Compact Live-tab glance for auto-resume: armed badge, next scheduled resume
 * (+ how many more are queued), watcher warning, last result. Full controls
 * and the queue live on the Auto-Resume page — this links there. Self-hides
 * when the feature is off and there's nothing recent to report.
 */
export function AutoResumeCard() {
  const { state, prefs } = useAutoResume();
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const jobCount = state.data?.jobs.length ?? 0;
  useEffect(() => {
    if (!jobCount) return;
    const id = setInterval(forceUpdate, 10_000);
    return () => clearInterval(id);
  }, [jobCount]);

  const data = state.data;
  if (!data) return null;

  const armed = data.armed || prefs.mode !== 'off';
  const jobs = data.jobs;
  const next = jobs[0] ?? null;
  const last = data.history[0] ?? null;
  const lastRecent = last && last.finishedAt != null && Date.now() - last.finishedAt < 24 * 3600_000;
  if (!armed && !jobs.length && !lastRecent) return null;

  const now = data.serverNow + (state.lastFetch ? Date.now() - state.lastFetch : 0);
  const util = data.limit?.utilization;
  const showWatcherWarning = armed && !data.watcher.online && !data.internalExecutor;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-1 text-sm font-semibold text-zinc-100">Auto-resume</h3>
        {armed ? (
          <Badge variant="success">{data.mode === 'always' ? 'always' : 'armed · once'}</Badge>
        ) : (
          <Badge variant="neutral">off</Badge>
        )}
        {typeof util === 'number' && (
          <span className="text-xs text-zinc-500">
            5h window at <span className="font-medium text-zinc-300">{Math.round(util)}%</span>
          </span>
        )}
        {showWatcherWarning && <Badge variant="warning">watcher offline</Badge>}
        <Link to="/autoresume" className="ml-auto text-xs text-clay-400 hover:text-clay-300">
          manage →
        </Link>
      </div>

      {next && (
        <p className="mt-3 text-xs text-zinc-400">
          {next.status === 'claimed' ? (
            <>
              Resuming <JobTarget job={next} /> now…
            </>
          ) : now >= next.resumeAt ? (
            <>
              <JobTarget job={next} /> is due — waiting for the watcher to pick it up.
            </>
          ) : (
            <>
              Will resume <JobTarget job={next} /> in{' '}
              <span className="font-medium text-zinc-200">{formatCountdown(next.resumeAt - now)}</span>
            </>
          )}
          {jobs.length > 1 && (
            <span className="text-zinc-500">
              {' '}
              · {jobs.length - 1} more session{jobs.length > 2 ? 's' : ''} queued
            </span>
          )}
        </p>
      )}

      {armed && !next && (
        <p className="mt-3 text-xs text-zinc-500">
          Watching the {prefs.triggerWeekly ? '5-hour and weekly limits' : '5-hour limit'} — resumes
          are scheduled automatically when a limit blocks work.
        </p>
      )}

      {showWatcherWarning && (
        <p className="mt-2 text-xs text-amber-400">
          Run <span className="font-mono">npm run resume-watcher</span> on your host — without it
          scheduled resumes can't launch Claude Code.
        </p>
      )}

      {lastRecent && last && !next && (
        <p className="mt-2 text-xs text-zinc-500">
          Last: <JobTarget job={last} /> at {new Date(last.finishedAt!).toLocaleTimeString()} —{' '}
          {last.status === 'done' ? (
            <span className="text-emerald-400">resumed ok</span>
          ) : last.status === 'skipped' ? (
            <span className="text-zinc-400">skipped (session already continued)</span>
          ) : last.status === 'cancelled' ? (
            <span className="text-zinc-400">cancelled</span>
          ) : (
            <span className="text-red-400">failed</span>
          )}
        </p>
      )}
    </div>
  );
}

function JobTarget({ job }: { job: ResumeJob }) {
  const project = projectBasename(job.projectPath);
  return (
    <span className="text-zinc-300">
      {project ? <span className="font-medium">{project}</span> : 'session'}{' '}
      <span className="font-mono text-zinc-500">{shortSessionId(job.sessionId)}</span>
    </span>
  );
}
