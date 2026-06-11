import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import type { ConfigProfileProps } from './types';
import { formatPlan } from './utils';

export function ConfigProfile({ config }: ConfigProfileProps) {
  if (!config) return null;

  const allowedDirs = config.permissions?.additionalDirectories ?? [];
  const allowedCommands = config.permissions?.allow ?? [];

  return (
    <div className="card p-5 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Claude Code Config Profile</h3>
        <p className="text-xs text-zinc-500 mt-0.5">Current active CLI environment settings</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 flex-none">
        <div className="rounded-xl bg-ink-700/50 p-3 border border-white/5">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-0.5">Default Model</span>
          <span className="text-sm font-semibold text-clay-400 font-mono capitalize">
            {config.model ?? 'sonnet'}
          </span>
        </div>
        <div className="rounded-xl bg-ink-700/50 p-3 border border-white/5">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-0.5">Effort Level</span>
          <span className="text-sm font-semibold text-emerald-400 font-mono capitalize">
            {config.effortLevel ?? 'medium'}
          </span>
        </div>
        <div className="rounded-xl bg-ink-700/50 p-3 border border-white/5">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-0.5">Subscription</span>
          <span
            className="text-sm font-semibold text-cyan-400 font-mono animate-pulse-slow"
            title="Read from ~/.claude/.credentials.json — updates when Claude Code refreshes its login token"
          >
            {formatPlan(config.subscriptionType)}
          </span>
        </div>
        <div className="rounded-xl bg-ink-700/50 p-3 border border-white/5">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-0.5">Rate Limit Tier</span>
          <span className="text-sm font-semibold text-indigo-400 font-mono truncate block" title={config.rateLimitTier ?? 'default'}>
            {config.rateLimitTier ? config.rateLimitTier.replace(/_/g, ' ') : 'default'}
          </span>
        </div>
      </div>

      <div className="space-y-2.5 mb-4 text-xs flex-none">
        <div className="flex justify-between items-center py-1.5 border-b border-white/5">
          <span className="text-zinc-400">Voice Mode</span>
          <Badge variant={config.voiceEnabled ? 'success' : 'neutral'}>
            {config.voiceEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <div className="flex justify-between items-center py-1.5 border-b border-white/5">
          <span className="text-zinc-400">Remote Control (Startup)</span>
          <Badge variant={config.remoteControlAtStartup ? 'success' : 'neutral'}>
            {config.remoteControlAtStartup ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {/* Allowed Directories */}
        <div className="flex-1 flex flex-col min-h-0">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 block">
            Authorized Workspaces ({allowedDirs.length})
          </span>
          <div className="flex-1 overflow-y-auto max-h-[140px] pr-1 scrollbar-thin divide-y divide-white/5 border border-white/5 rounded-xl bg-ink-700/30 p-2 text-xs">
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
        <div className="flex-1 flex flex-col min-h-0">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 block">
            Approved Command Prefixes ({allowedCommands.length})
          </span>
          <div className="flex-1 overflow-y-auto max-h-[140px] pr-1 scrollbar-thin divide-y divide-white/5 border border-white/5 rounded-xl bg-ink-700/30 p-2 text-xs">
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
