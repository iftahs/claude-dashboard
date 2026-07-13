import { Link } from 'react-router-dom';
import { useLiveData } from '@/hooks/useLiveData';
import { formatCountdown } from '@/components/design-system/organisms/AutoResumeCard/utils';

/**
 * Header pill for auto-resume, visible from every tab (next to the agent
 * traffic signal). Hidden when the feature is off; shows armed state, a
 * countdown to the next scheduled resume, or an executor warning. Clicking it
 * opens the Auto-Resume page.
 */
export function AutoResumeBadge() {
  const { autoResume } = useLiveData();
  const data = autoResume.data;
  if (!data || (!data.armed && !data.jobs.length)) return null;

  const now = data.serverNow + (autoResume.lastFetch ? Date.now() - autoResume.lastFetch : 0);
  const next = data.jobs[0] ?? null;
  const executorMissing = data.armed && !data.watcher.online && !data.internalExecutor;

  let dotCls = 'bg-emerald-400';
  let text = 'auto-resume on';
  let textCls = 'text-zinc-400';
  if (next) {
    dotCls = 'bg-clay-400 animate-pulse';
    textCls = 'text-clay-400';
    const extra = data.jobs.length > 1 ? ` +${data.jobs.length - 1}` : '';
    text =
      next.status === 'claimed' || now >= next.resumeAt
        ? `resuming now${extra}`
        : `resume in ${formatCountdown(next.resumeAt - now)}${extra}`;
  } else if (executorMissing) {
    dotCls = 'bg-amber-400';
    textCls = 'text-amber-400';
    text = 'auto-resume · no watcher';
  }

  return (
    <Link
      to="/autoresume"
      title={
        executorMissing
          ? 'Auto-resume is armed but nothing can execute it — open the Auto-Resume page to start the watcher'
          : 'Open the Auto-Resume page'
      }
      className="flex items-center gap-2 rounded-full bg-ink-700/60 px-2.5 py-1 text-xs ring-1 ring-white/10 hover:ring-white/25"
    >
      <span className={`inline-block h-2 w-2 flex-none rounded-full ${dotCls}`} />
      <span className={textCls}>⏰ {text}</span>
    </Link>
  );
}
