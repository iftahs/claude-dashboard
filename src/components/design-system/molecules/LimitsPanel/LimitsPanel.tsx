import { useState } from 'react';
import { parseDollar, fmt } from './utils';
import type { LimitsPanelProps } from './types';

export function LimitsPanel({ limits, onChange, onClose }: LimitsPanelProps) {
  const [dailyVal, setDailyVal] = useState(fmt(limits.dailyLimit));
  const [weeklyVal, setWeeklyVal] = useState(fmt(limits.weeklyLimit));
  const [monthlyVal, setMonthlyVal] = useState(fmt(limits.monthlyLimit));

  function save() {
    onChange({
      dailyLimit: parseDollar(dailyVal),
      weeklyLimit: parseDollar(weeklyVal),
      monthlyLimit: parseDollar(monthlyVal),
    });
    onClose();
  }

  function clear() {
    onChange({ dailyLimit: null, weeklyLimit: null, monthlyLimit: null });
    setDailyVal('');
    setWeeklyVal('');
    setMonthlyVal('');
    onClose();
  }

  const inputCls =
    'w-full bg-transparent px-2 py-2 text-sm text-zinc-200 outline-none';
  const wrapCls =
    'flex items-center rounded-lg bg-ink-700 ring-1 ring-white/10 focus-within:ring-clay-500';

  return (
    <div className="card mt-4 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">Spending limits</h3>
        <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">
          ✕ close
        </button>
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        For API users who pay per token — enter your spending cap in USD. Gauges will appear on
        the Live tab when limits are set. Leave blank if you use a subscription plan.
      </p>
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: 'Daily limit', val: dailyVal, set: setDailyVal, ph: 'e.g. 10' },
          { label: 'Weekly limit', val: weeklyVal, set: setWeeklyVal, ph: 'e.g. 50' },
          { label: 'Monthly limit', val: monthlyVal, set: setMonthlyVal, ph: 'e.g. 200' },
        ] as const).map(({ label, val, set, ph }) => (
          <label key={label} className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">{label}</span>
            <div className={wrapCls}>
              <span className="pl-3 text-sm text-zinc-500">$</span>
              <input
                className={inputCls}
                placeholder={ph}
                value={val}
                onChange={(e) => (set as (v: string) => void)(e.target.value)}
              />
            </div>
          </label>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-3">
        <button
          onClick={clear}
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
