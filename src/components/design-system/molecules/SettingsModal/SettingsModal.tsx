import { useState } from 'react';
import { ToggleGroup } from '@/components/design-system/atoms/ToggleGroup/ToggleGroup';
import { parseDollar, fmt } from '@/components/design-system/molecules/LimitsPanel/utils';
import type { Settings } from '@/hooks/useSettings';
import type { SettingsModalProps } from './types';

export function SettingsModal({
  limits,
  onChangeLimits,
  settings,
  onChangeSettings,
  detectedMode,
  onClose,
}: SettingsModalProps) {
  const [dailyVal, setDailyVal] = useState(fmt(limits.dailyLimit));
  const [weeklyVal, setWeeklyVal] = useState(fmt(limits.weeklyLimit));
  const [monthlyVal, setMonthlyVal] = useState(fmt(limits.monthlyLimit));

  const modeOptions: { value: Settings['modeOverride']; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'subscription', label: 'Subscription' },
    { value: 'api', label: 'API' },
  ];
  const detectedLabel = detectedMode === 'api' ? 'API · pay-as-you-go' : 'Subscription';

  function saveLimits() {
    onChangeLimits({
      dailyLimit: parseDollar(dailyVal),
      weeklyLimit: parseDollar(weeklyVal),
      monthlyLimit: parseDollar(monthlyVal),
    });
    onClose();
  }

  function clearLimits() {
    onChangeLimits({ dailyLimit: null, weeklyLimit: null, monthlyLimit: null });
    setDailyVal('');
    setWeeklyVal('');
    setMonthlyVal('');
  }

  const inputCls = 'w-full bg-transparent px-2 py-2 text-sm text-zinc-200 outline-none';
  const wrapCls =
    'flex items-center rounded-lg bg-ink-700 ring-1 ring-white/10 focus-within:ring-clay-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card mt-16 w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-100">Settings</h3>
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-300" aria-label="Close">
            ✕
          </button>
        </div>

        {/* ── Usage mode ─────────────────────────────────────────────── */}
        <section className="mb-6">
          <h4 className="mb-1 text-sm font-semibold text-zinc-300">Usage mode</h4>
          <p className="mb-3 text-xs text-zinc-500">
            Auto-detected from your Claude credentials. Override only if it's wrong — API mode swaps the
            subscription rate-limit view for estimated cost.
          </p>
          <ToggleGroup<Settings['modeOverride']>
            options={modeOptions}
            value={settings.modeOverride}
            onChange={(modeOverride) => onChangeSettings({ ...settings, modeOverride })}
            grow
          />
          <p className="mt-2 text-xs text-zinc-500">
            Detected: <span className="font-medium text-zinc-300">{detectedLabel}</span>
            {settings.modeOverride !== 'auto' && (
              <span className="text-zinc-600"> · overridden</span>
            )}
          </p>
        </section>

        {/* ── Spending limits ────────────────────────────────────────── */}
        <section>
          <h4 className="mb-1 text-sm font-semibold text-zinc-300">Spending limits</h4>
          <p className="mb-3 text-xs text-zinc-500">
            For pay-as-you-go usage — enter caps in USD to see gauges on the Live tab. Stored locally in
            your browser; this is a budgeting aid, not a real bill.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {([
              { label: 'Daily', val: dailyVal, set: setDailyVal, ph: 'e.g. 10' },
              { label: 'Weekly', val: weeklyVal, set: setWeeklyVal, ph: 'e.g. 50' },
              { label: 'Monthly', val: monthlyVal, set: setMonthlyVal, ph: 'e.g. 200' },
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
              onClick={clearLimits}
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              clear
            </button>
            <button
              onClick={saveLimits}
              className="rounded-lg bg-clay-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-clay-400"
            >
              Save
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
