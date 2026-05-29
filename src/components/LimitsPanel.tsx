import { useState } from 'react';
import type { Limits } from '../hooks/useLimits';
import { compact } from '../lib/format';

function parseM(s: string): number | null {
  const v = parseFloat(s.replace(/,/g, ''));
  if (Number.isNaN(v) || v <= 0) return null;
  if (/m/i.test(s)) return Math.round(v * 1_000_000);
  if (/k/i.test(s)) return Math.round(v * 1_000);
  return Math.round(v);
}

function fmt(n: number | null): string {
  if (!n) return '';
  return compact(n);
}

export function LimitsPanel({
  limits,
  onChange,
  onClose,
}: {
  limits: Limits;
  onChange: (l: Limits) => void;
  onClose: () => void;
}) {
  const [blockVal, setBlockVal] = useState(fmt(limits.blockLimit));
  const [weeklyVal, setWeeklyVal] = useState(fmt(limits.weeklyLimit));

  function save() {
    onChange({ blockLimit: parseM(blockVal), weeklyLimit: parseM(weeklyVal) });
    onClose();
  }

  return (
    <div className="card mt-4 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">Configure limits</h3>
        <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">✕ close</button>
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        Anthropic doesn't expose your exact token limits via API. Enter your plan's effective-token cap
        (input + output + cache-creation, not cache reads) so the dashboard can show %.
        Accepts numbers like <code className="text-clay-400">600K</code> or <code className="text-clay-400">2M</code>.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">5h block limit</span>
          <input
            className="rounded-lg bg-ink-700 px-3 py-2 text-sm text-zinc-200 outline-none ring-1 ring-white/10 focus:ring-clay-500"
            placeholder="e.g. 600K"
            value={blockVal}
            onChange={(e) => setBlockVal(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Weekly limit</span>
          <input
            className="rounded-lg bg-ink-700 px-3 py-2 text-sm text-zinc-200 outline-none ring-1 ring-white/10 focus:ring-clay-500"
            placeholder="e.g. 4M"
            value={weeklyVal}
            onChange={(e) => setWeeklyVal(e.target.value)}
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-3">
        <button
          onClick={() => { onChange({ blockLimit: null, weeklyLimit: null }); setBlockVal(''); setWeeklyVal(''); onClose(); }}
          className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
        >
          clear
        </button>
        <button
          onClick={save}
          className="rounded-lg bg-clay-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-clay-400"
        >
          Save
        </button>
      </div>
    </div>
  );
}
