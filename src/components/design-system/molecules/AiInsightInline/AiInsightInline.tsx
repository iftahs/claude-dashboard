import { Markdown } from '@/components/design-system/atoms/Markdown/Markdown';
import type { AiInsightInlineProps } from './types';

const BACKEND_LABEL: Record<string, string> = {
  cli: 'via claude -p',
  api: 'via Claude.ai',
  apikey: 'via API key',
  none: '',
};

/** Inline AI explanation card rendered below a Section's content. */
export function AiInsightInline({ text, loading, error, backend, onDismiss }: AiInsightInlineProps) {
  return (
    <div className="mt-4 rounded-lg bg-ink-800/60 p-3 text-sm ring-1 ring-clay-500/20">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-clay-300">
          ✨ AI insight
          {backend && BACKEND_LABEL[backend] && (
            <span className="font-normal normal-case tracking-normal text-zinc-600">{BACKEND_LABEL[backend]}</span>
          )}
        </span>
        <button
          onClick={onDismiss}
          className="text-base leading-none text-zinc-500 transition-colors hover:text-zinc-300"
          title="Dismiss"
        >
          ×
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-zinc-500">Analyzing this panel…</p>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : (
        <Markdown text={text ?? ''} className="text-zinc-300" />
      )}
    </div>
  );
}
