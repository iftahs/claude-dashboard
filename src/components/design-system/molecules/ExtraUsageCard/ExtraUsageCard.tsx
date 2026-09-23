import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { extraUsageBarColor } from './utils';
import type { ExtraUsageCardProps } from './types';

// Fed a provider-neutral view (see ./utils) so Claude and Codex render identically.
export function ExtraUsageCard({ view }: ExtraUsageCardProps) {
  const { title, help, enabled, usage, disabledCopy, rows, disclaimer } = view;
  const pct = usage?.pct ?? null;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-zinc-500">
          {title}
          <InfoTip text={help} />
        </h3>
      </div>

      {enabled && usage ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-300">{usage.label}</span>
            <span className="font-mono text-zinc-400">
              {usage.value}
              {usage.limit != null && <span className="text-zinc-600"> / {usage.limit}</span>}
              {pct != null && <span className="ml-1.5 text-zinc-500">({pct}%)</span>}
            </span>
          </div>
          {pct != null && <ProgressBar pct={pct} color={extraUsageBarColor(pct)} />}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">{disabledCopy}</p>
      )}

      {rows && rows.length > 0 && (
        <div className="mt-3 space-y-1">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">{r.label}</span>
              <span className={`font-mono ${r.tone === 'danger' ? 'text-red-400' : 'text-zinc-400'}`}>{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {disclaimer && (
        <p className="mt-3 text-[11px] text-zinc-600">
          {disclaimer.text}
          {disclaimer.text && disclaimer.linkText ? ' ' : ''}
          {disclaimer.href && disclaimer.linkText && (
            <a href={disclaimer.href} target="_blank" rel="noreferrer" className="underline hover:text-zinc-400">
              {disclaimer.linkText}
            </a>
          )}
        </p>
      )}
    </div>
  );
}
