import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { ToggleGroup } from '@/components/design-system/atoms/ToggleGroup/ToggleGroup';
import { PROVIDER_LABELS, PROVIDER_MODELS } from '@/hooks/useAiConfig';
import { useSettingsForm, type CapDraft } from '@/hooks/useSettingsForm';
import { localeDefaultWeekStart } from '@/lib/week';
import { resolveLimitAlerts, type LimitAlertConfig } from '@/lib/limits';
import type { Settings } from '@/hooks/useSettings';
import type { AiProvider } from '@/types';
import type { SettingsViewProps, StatusRow } from './types';
import { THRESHOLD_CHOICES, archiveLine, toggleThreshold } from './utils';

const inputCls = 'w-full bg-transparent px-2 py-2 text-sm text-zinc-200 outline-none';
const wrapCls = 'flex items-center rounded-lg bg-ink-700 ring-1 ring-white/10 focus-within:ring-clay-500';

const STATUS_TONE: Record<StatusRow['tone'], string> = {
  ok: 'text-emerald-400',
  warn: 'text-amber-300',
  muted: 'text-zinc-300',
};

/** Daily / Weekly / Monthly USD inputs with clear + Save, for one platform's caps. */
function CapInputs({ draft, heading }: { draft: CapDraft; heading?: string }) {
  return (
    <div>
      {heading && <h5 className="mb-2 text-xs font-semibold text-zinc-300">{heading}</h5>}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: 'Daily', val: draft.dailyVal, set: draft.setDailyVal, ph: 'e.g. 10' },
          { label: 'Weekly', val: draft.weeklyVal, set: draft.setWeeklyVal, ph: 'e.g. 50' },
          { label: 'Monthly', val: draft.monthlyVal, set: draft.setMonthlyVal, ph: 'e.g. 200' },
        ] as const).map(({ label, val, set, ph }) => (
          <label key={label} className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">{label}</span>
            <div className={wrapCls}>
              <span className="pl-3 text-sm text-zinc-500">$</span>
              <input className={inputCls} placeholder={ph} value={val} onChange={(e) => set(e.target.value)} />
            </div>
          </label>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-3">
        <button onClick={draft.clear} className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
          clear
        </button>
        <button
          onClick={draft.save}
          className="rounded-lg bg-clay-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-clay-400"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export function SettingsView({
  limits,
  onChangeLimits,
  settings,
  onChangeSettings,
  detectedMode,
  codex,
  archive,
  analyticsOptOut,
  onChangeAnalyticsOptOut,
  aiConfig,
  onChangeAiConfig,
}: SettingsViewProps) {
  const { caps, aiKey, setAiKey, showKey, setShowKey, providers, changeProvider, saveAiKey, clearAiKey } =
    useSettingsForm({ limits, onChangeLimits, aiConfig, onChangeAiConfig });

  const withCodex = codex !== null;

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

  // Budget and limit alerts share the off / notification / sound choice.
  const alertModeOptions: { value: Settings['budgetAlert']; label: string }[] = [
    { value: 'off', label: 'Off' },
    { value: 'notification', label: 'Notification' },
    { value: 'sound', label: 'Notification + sound' },
  ];

  const limitAlerts = resolveLimitAlerts(settings.limitAlerts);
  const setLimitAlerts = (next: Partial<LimitAlertConfig>) =>
    onChangeSettings({ ...settings, limitAlerts: { ...limitAlerts, ...next } });
  const thresholdChoices = [...new Set([...THRESHOLD_CHOICES, ...limitAlerts.thresholds])].sort((a, b) => a - b);

  const weekStartOptions: { value: Settings['weekStartDay']; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'sunday', label: 'Sunday' },
    { value: 'monday', label: 'Monday' },
  ];
  const localeWeekStart = localeDefaultWeekStart();
  const localeWeekStartLabel = localeWeekStart === 'sunday' ? 'Sunday' : 'Monday';

  const archiveSummary = archive.summary;

  return (
    <div className="card p-6">
      <h3 className="mb-5 text-base font-semibold text-zinc-100">Settings</h3>

      {/* ── Usage mode ─────────────────────────────────────────────── */}
      <section className="mb-6">
        <h4 className="mb-1 text-sm font-semibold text-zinc-300">{withCodex ? 'Claude usage mode' : 'Usage mode'}</h4>
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

      {codex && (
        <section className="mt-6 border-t border-white/10 pt-5">
          <h4 className="mb-1 text-sm font-semibold text-zinc-300">Codex</h4>
          <p className="mb-3 text-xs text-zinc-500">
            Detected from the data folder the ChatGPT desktop app writes. Read-only — the dashboard never
            refreshes or changes the Codex login.
          </p>
          <dl className="space-y-2 text-xs">
            {codex.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4 border-b border-white/5 pb-2">
                <dt className="flex-none text-zinc-400">{r.label}</dt>
                <dd className="min-w-0 text-right">
                  <span className={`font-medium ${STATUS_TONE[r.tone]} ${r.label === 'Data folder' ? 'break-all font-mono' : ''}`}>
                    {r.value}
                  </span>
                  {r.note && <p className="mt-0.5 text-zinc-600">{r.note}</p>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

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

      <section className="mt-6 border-t border-white/10 pt-5">
        <h4 className="mb-1 text-sm font-semibold text-zinc-300">Limit alerts</h4>
        <p className="mb-3 text-xs text-zinc-500">
          Notify me when a plan's rate limit crosses these thresholds — Claude.ai's 5-hour and weekly limits
          {withCodex ? ", and Codex's 5-hour and weekly windows" : ''} — on every tab, once per window. Reaching the
          limit always alerts.
        </p>
        <ToggleGroup<Settings['budgetAlert']>
          options={alertModeOptions}
          value={limitAlerts.mode}
          onChange={(mode) => setLimitAlerts({ mode })}
          grow
        />
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-zinc-500">Alert at</span>
          {thresholdChoices.map((t) => {
            const on = limitAlerts.thresholds.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                disabled={limitAlerts.mode === 'off'}
                onClick={() => setLimitAlerts({ thresholds: toggleThreshold(limitAlerts.thresholds, t) })}
                className={`rounded-full px-2.5 py-1 text-xs tabular-nums ring-1 transition-colors disabled:opacity-40 ${
                  on
                    ? 'bg-clay-500/20 text-clay-300 ring-clay-500/40'
                    : 'bg-ink-800/60 text-zinc-500 ring-white/10 hover:text-zinc-300'
                }`}
              >
                {t}%
              </button>
            );
          })}
          <span className="ml-1 text-xs text-zinc-600">+ 100% (limit reached)</span>
        </div>
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
      <section className="mt-6 border-t border-white/10 pt-5">
        <h4 className="mb-1 text-sm font-semibold text-zinc-300">Spending limits</h4>
        {withCodex ? (
          <>
            <p className="mb-3 text-xs text-zinc-500">
              Separate USD caps per platform: Claude's estimated spend is checked against Claude's caps and
              Codex's against Codex's, whatever the header shows. The Live tab shows the caps of the platform in
              view (under Both, the two added up). Stored locally in your browser; this is a budgeting aid, not a
              real bill.
            </p>
            <div className="space-y-5">
              <CapInputs draft={caps.claude} heading="Claude" />
              <CapInputs draft={caps.codex} heading="Codex" />
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-xs text-zinc-500">
              For pay-as-you-go usage — enter caps in USD to see gauges on the Live tab. Stored locally in
              your browser; this is a budgeting aid, not a real bill.
            </p>
            <CapInputs draft={caps.claude} />
          </>
        )}

        <div className="mt-5 border-t border-white/5 pt-4">
          <h5 className="mb-1 text-xs font-semibold text-zinc-300">Budget alerts</h5>
          <p className="mb-3 text-xs text-zinc-500">
            Notify me the first time {withCodex ? "a platform's" : ''} spend crosses 70 / 90 / 100% of a cap
            (resets each calendar period). Caps reset on real day/week/month boundaries.
          </p>
          <ToggleGroup<Settings['budgetAlert']>
            options={alertModeOptions}
            value={settings.budgetAlert}
            onChange={(budgetAlert) => onChangeSettings({ ...settings, budgetAlert })}
            grow
          />
        </div>
      </section>

      <section className="mt-6 border-t border-white/10 pt-5">
        <h4 className="mb-1 text-sm font-semibold text-zinc-300">History archive</h4>
        <p className="mb-3 text-xs text-zinc-500">
          Claude Code deletes its transcripts after about 30 days, and their usage leaves the charts with them.
          The archive keeps a slim copy of each deleted transcript's usage rows (never its text) in the
          dashboard's local cache, so long-range views keep that history. It is an opt-in set in the server's
          environment, not here: start the dashboard with{' '}
          <code className="font-mono text-zinc-400">DASHBOARD_RETAIN_HISTORY=1</code> (in Docker, set it in the
          container's environment).
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            {archiveSummary ? (
              <>
                <Badge variant={archiveSummary.enabled ? 'success' : 'neutral'}>
                  {archiveSummary.enabled ? 'On' : 'Off'}
                </Badge>
                {archiveSummary.files > 0
                  ? archiveLine(archiveSummary)
                  : archiveSummary.enabled
                    ? 'Nothing archived yet — rows are kept once a transcript is deleted.'
                    : 'Nothing archived.'}
              </>
            ) : (
              'Checking…'
            )}
          </span>
          {archiveSummary && archiveSummary.files > 0 && (
            <button
              type="button"
              disabled={archive.busy}
              onClick={() => {
                if (window.confirm('Forget the archived history? Usage from deleted transcripts leaves the charts. This cannot be undone.')) {
                  archive.onForget();
                }
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/10 disabled:opacity-50"
            >
              {archive.busy ? 'Forgetting…' : 'Forget archived history'}
            </button>
          )}
        </div>
        {archive.error && <p className="mt-2 text-xs text-red-400">{archive.error}</p>}
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
