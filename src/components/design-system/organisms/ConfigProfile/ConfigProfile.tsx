import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import type { ConfigProfileProps } from './types';
import { formatPlan } from './utils';

export function ConfigProfile({ config, isApi = false }: ConfigProfileProps) {
  if (!config) return null;

  const allowedDirs = config.permissions?.additionalDirectories ?? [];
  const allowedCommands = config.permissions?.allow ?? [];
  const pluginCount = Object.values(config.enabledPlugins ?? {}).filter(Boolean).length;
  const marketplaceCount = Object.keys(config.extraKnownMarketplaces ?? {}).length;

  return (
    <div className="card p-5 flex flex-col">
      <div className="mb-4 flex-none">
        <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-zinc-300">
          Claude Code Config Profile
          <InfoTip text="Your active Claude Code CLI settings read from settings.json: default model, effort level, subscription, permission mode, enabled integrations, and the workspaces & command prefixes you've authorized." />
        </h3>
        <p className="text-xs text-zinc-500 mt-0.5">Current active CLI environment settings</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 flex-none">
        <div className="rounded-xl bg-ink-700/50 p-3 border border-white/10">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-0.5">Default Model</span>
          <span className="text-sm font-semibold text-clay-400 font-mono capitalize">
            {config.model ?? 'sonnet'}
          </span>
        </div>
        <div className="rounded-xl bg-ink-700/50 p-3 border border-white/10">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-0.5">Effort Level</span>
          <span className="text-sm font-semibold text-emerald-400 font-mono capitalize">
            {config.effortLevel ?? 'medium'}
          </span>
        </div>
        <div className="rounded-xl bg-ink-700/50 p-3 border border-white/10">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-0.5">
            {isApi ? 'Billing' : 'Subscription'}
          </span>
          <span
            className="text-sm font-semibold text-cyan-400 font-mono"
            title={
              isApi
                ? 'No Claude.ai subscription token found — Claude Code is billed pay-as-you-go (API).'
                : 'Read from ~/.claude/.credentials.json — updates when Claude Code refreshes its login token'
            }
          >
            {isApi ? 'API · pay-as-you-go' : formatPlan(config.subscriptionType)}
          </span>
        </div>
        <div className="rounded-xl bg-ink-700/50 p-3 border border-white/10">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-0.5">Rate Limit Tier</span>
          <span className="text-sm font-semibold text-indigo-400 font-mono truncate block" title={isApi ? 'n/a in API mode' : (config.rateLimitTier ?? 'default')}>
            {isApi ? '—' : config.rateLimitTier ? config.rateLimitTier.replace(/_/g, ' ') : 'default'}
          </span>
        </div>
        <div className="rounded-xl bg-ink-700/50 p-3 border border-white/10">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-0.5">Permission Mode</span>
          <span className="text-sm font-semibold text-amber-400 font-mono capitalize truncate block" title={config.permissions?.defaultMode ?? 'default'}>
            {(config.permissions?.defaultMode ?? 'default').replace(/([a-z])([A-Z])/g, '$1 $2')}
          </span>
        </div>
        <div className="rounded-xl bg-ink-700/50 p-3 border border-white/10">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-0.5">Auto-Update Channel</span>
          <span className="text-sm font-semibold text-violet-400 font-mono capitalize truncate block" title={config.autoUpdatesChannel ?? 'latest'}>
            {config.autoUpdatesChannel ?? 'latest'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-4 text-xs flex-none">
        <div className="flex justify-between items-center py-1.5 border-b border-white/10">
          <span className="text-zinc-400">Voice Mode</span>
          <Badge variant={config.voiceEnabled ? 'success' : 'neutral'}>
            {config.voiceEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <div className="flex justify-between items-center py-1.5 border-b border-white/10">
          <span className="text-zinc-400">Remote Control</span>
          <Badge variant={config.remoteControlAtStartup ? 'success' : 'neutral'}>
            {config.remoteControlAtStartup ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <div className="flex justify-between items-center py-1.5 border-b border-white/10">
          <span className="text-zinc-400">Input Alerts</span>
          <Badge variant={config.inputNeededNotifEnabled ? 'success' : 'neutral'}>
            {config.inputNeededNotifEnabled ? 'On' : 'Off'}
          </Badge>
        </div>
        <div className="flex justify-between items-center py-1.5 border-b border-white/10">
          <span className="text-zinc-400">Agent Push</span>
          <Badge variant={config.agentPushNotifEnabled ? 'success' : 'neutral'}>
            {config.agentPushNotifEnabled ? 'On' : 'Off'}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 text-[11px] flex-none">
        <span className="rounded-lg bg-ink-700/50 border border-white/10 px-2.5 py-1 text-zinc-400">
          Plugins <span className="font-semibold text-zinc-200">{pluginCount}</span>
        </span>
        <span className="rounded-lg bg-ink-700/50 border border-white/10 px-2.5 py-1 text-zinc-400">
          Marketplaces <span className="font-semibold text-zinc-200">{marketplaceCount}</span>
        </span>
      </div>

      <div className="space-y-4">
        {/* Allowed Directories */}
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 block">
            Authorized Workspaces ({allowedDirs.length})
          </span>
          <div className="overflow-y-auto max-h-[200px] pr-1 scrollbar-thin divide-y divide-white/10 border border-white/10 rounded-xl bg-ink-700/30 p-2 text-xs">
            {allowedDirs.length > 0 ? (
              allowedDirs.map((dir, idx) => (
                <div key={idx} className="py-1.5 font-mono text-zinc-400 truncate" title={dir}>
                  {dir}
                </div>
              ))
            ) : (
              <div className="py-2 text-zinc-500 text-center italic">No extra directories registered</div>
            )}
          </div>
        </div>

        {/* Allowed Commands */}
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 block">
            Approved Command Prefixes ({allowedCommands.length})
          </span>
          <div className="overflow-y-auto max-h-[200px] pr-1 scrollbar-thin divide-y divide-white/10 border border-white/10 rounded-xl bg-ink-700/30 p-2 text-xs">
            {allowedCommands.length > 0 ? (
              allowedCommands.map((cmd, idx) => (
                <div key={idx} className="py-1.5 font-mono text-zinc-400 truncate" title={cmd}>
                  {cmd}
                </div>
              ))
            ) : (
              <div className="py-2 text-zinc-500 text-center italic">No automated commands pre-approved</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
