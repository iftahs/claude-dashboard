import { ToggleGroup } from '@/components/design-system/atoms/ToggleGroup/ToggleGroup';
import { PROVIDER_LABELS, PROVIDER_MODELS } from '@/hooks/useAiConfig';
import { useSettingsForm } from '@/hooks/useSettingsForm';
import { localeDefaultWeekStart } from '@/lib/week';
import type { Settings } from '@/hooks/useSettings';
import type { AiProvider } from '@/types';
import type { SettingsViewProps } from './types';

/** Settings tab panel: usage mode, spending limits, AI Insights config, telemetry. */
export function SettingsView({
  limits,
  onChangeLimits,
  settings,
  onChangeSettings,
  detectedMode,
  analyticsOptOut,
  onChangeAnalyticsOptOut,
  aiConfig,
  onChangeAiConfig,
}: SettingsViewProps) {
  const {
    dailyVal, setDailyVal, weeklyVal, setWeeklyVal, monthlyVal, setMonthlyVal,
    aiKey, setAiKey, showKey, setShowKey, providers,
    changeProvider, saveAiKey, clearAiKey, saveLimits, clearLimits,
  } = useSettingsForm({ limits, onChangeLimits, aiConfig, onChangeAiConfig });

  const modeOptions: { value: Settings['modeOverride']; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'subscription', label: 'Subscription' },
    { value: 'api', label: 'API' },
  ];
  const detectedLabel = detectedMode === 'api' ? 'API · pay-as-you-go' : 'Subscription';

  const agentAlertOptions: { value: Settings['agentAlert']; label: string }[] = [
    { value: 'visual', label: 'Visual only' },
    { value: 'notification', label: 'Notification' },
    { value: 'sound', label: 'Notification + sound' },
  ];

  const weekStartOptions: { value: Settings['weekStartDay']; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'sunday', label: 'Sunday' },
    { value: 'monday', label: 'Monday' },
  ];
  const localeWeekStart = localeDefaultWeekStart();
  const localeWeekStartLabel = localeWeekStart === 'sunday' ? 'Sunday' : 'Monday';

  const inputCls = 'w-full bg-transparent px-2 py-2 text-sm text-zinc-200 outline-none';
  const wrapCls =
    'flex items-center rounded-lg bg-ink-700 ring-1 ring-white/10 focus-within:ring-clay-500';

  return (
    <div className="card p-6">
      <h3 className="mb-5 text-base font-semibold text-zinc-100">Settings</h3>

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

      {/* ── Agent alerts ───────────────────────────────────────────── */}
      <section className="mt-6 border-t border-white/10 pt-5">
        <h4 className="mb-1 text-sm font-semibold text-zinc-300">Agent alerts</h4>
        <p className="mb-3 text-xs text-zinc-500">
          How to alert you when an agent turns <span className="text-red-400 font-medium">red</span> — waiting
          for your confirmation or attention. The red badge always shows in the sidebar and Agents tab; this adds
          a browser notification and/or a chime.
        </p>
        <ToggleGroup<Settings['agentAlert']>
          options={agentAlertOptions}
          value={settings.agentAlert}
          onChange={(agentAlert) => onChangeSettings({ ...settings, agentAlert })}
          grow
        />
      </section>

      {/* ── Week start ─────────────────────────────────────────────── */}
      <section className="mt-6 border-t border-white/10 pt-5">
        <h4 className="mb-1 text-sm font-semibold text-zinc-300">Week start</h4>
        <p className="mb-3 text-xs text-zinc-500">
          First day of the week for the weekly spending window and reset countdown (and the
          activity heatmap). Auto follows your browser locale.
        </p>
        <ToggleGroup<Settings['weekStartDay']>
          options={weekStartOptions}
          value={settings.weekStartDay}
          onChange={(weekStartDay) => onChangeSettings({ ...settings, weekStartDay })}
          grow
        />
        {settings.weekStartDay === 'auto' && (
          <p className="mt-2 text-xs text-zinc-500">
            Locale default: <span className="font-medium text-zinc-300">{localeWeekStartLabel}</span>
          </p>
        )}
      </section>

      {/* ── Spending limits ────────────────────────────────────────── */}
      <section className="border-t border-white/10 pt-5">
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

      {/* ── AI Insights ────────────────────────────────────────────── */}
      <section className="mt-6 border-t border-white/10 pt-5">
        <h4 className="mb-1 text-sm font-semibold text-zinc-300">AI Insights</h4>
        <p className="mb-3 text-xs text-zinc-500">
          Powers the AI chat and the ✨ buttons. Choose a provider, model and paste an API key. The key is
          stored only in this browser (localStorage) and sent to the local backend per request — it never
          goes to analytics. Leave the key empty to fall back to a local <span className="font-mono">claude</span> CLI
          or your Claude.ai token.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">Provider</span>
            <select
              value={aiConfig.provider}
              onChange={(e) => changeProvider(e.target.value as AiProvider)}
              className="rounded-lg bg-ink-700 px-2 py-2 text-sm text-zinc-200 outline-none ring-1 ring-white/10 focus:ring-clay-500"
            >
              {providers.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">Model</span>
            <select
              value={aiConfig.model}
              onChange={(e) => onChangeAiConfig({ ...aiConfig, model: e.target.value })}
              className="rounded-lg bg-ink-700 px-2 py-2 text-sm text-zinc-200 outline-none ring-1 ring-white/10 focus:ring-clay-500"
            >
              {PROVIDER_MODELS[aiConfig.provider].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-4 flex flex-col gap-1">
          <span className="text-xs text-zinc-400">API key</span>
          <div className={wrapCls}>
            <input
              type={showKey ? 'text' : 'password'}
              className={inputCls}
              placeholder={aiConfig.apiKey ? '•••••••• saved' : 'paste your API key'}
              value={aiKey}
              onChange={(e) => setAiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="px-2 text-xs text-zinc-500 hover:text-zinc-300"
              type="button"
            >
              {showKey ? 'hide' : 'show'}
            </button>
          </div>
        </label>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-zinc-600">
            {aiConfig.apiKey ? '✓ key saved in this browser' : 'no key set'}
          </span>
          <div className="flex gap-3">
            {aiConfig.apiKey && (
              <button
                onClick={clearAiKey}
                className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                clear
              </button>
            )}
            <button
              onClick={saveAiKey}
              className="rounded-lg bg-clay-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-clay-400"
            >
              Save key
            </button>
          </div>
        </div>
      </section>

      {/* ── Telemetry ──────────────────────────────────────────────── */}
      <section className="mt-6 border-t border-white/10 pt-5">
        <h4 className="mb-1 text-sm font-semibold text-zinc-300">Telemetry</h4>
        <p className="mb-3 text-xs text-zinc-500">
          Your usage logs never leave your machine. The app sends only{' '}
          <span className="text-zinc-400">anonymous</span> product-analytics events (which tab is
          opened, exports, an anonymous install count) so the author can improve it — no tokens,
          file or project paths, session contents, or personal data. Opt out any time.
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={analyticsOptOut}
            onChange={(e) => onChangeAnalyticsOptOut(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-ink-700 accent-clay-500"
          />
          Disable anonymous analytics
        </label>
      </section>
    </div>
  );
}
