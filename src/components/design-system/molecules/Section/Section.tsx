import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { AiInsightButton } from '@/components/design-system/atoms/AiInsightButton/AiInsightButton';
import type { SectionProps } from './types';

export function Section({
  title,
  children,
  right,
  className = '',
  grow = false,
  help,
  aiSection,
  onAiInsight,
  aiLoading = false,
  aiDisabled = false,
  aiInsight,
}: SectionProps) {
  return (
    <div className={`card p-5 ${grow ? 'flex flex-col h-full' : ''} ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-300">
          {title}
          {help && <InfoTip text={help} />}
        </h2>
        <div className="flex items-center gap-2">
          {right}
          {aiSection && onAiInsight && (
            <AiInsightButton onClick={onAiInsight} loading={aiLoading} disabled={aiDisabled} />
          )}
        </div>
      </div>
      <div className={grow ? 'flex-1 flex flex-col justify-end' : ''}>{children}</div>
      {aiInsight}
    </div>
  );
}
