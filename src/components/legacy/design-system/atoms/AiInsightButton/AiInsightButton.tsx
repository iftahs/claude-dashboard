import { aiInsightButton } from './AiInsightButton.variants';
import type { AiInsightButtonProps } from './types';

/** Small "✨ AI" pill that asks the model to explain the panel it sits on. */
export function AiInsightButton({ onClick, loading = false, disabled = false, title }: AiInsightButtonProps) {
  if (disabled) return null;
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title ?? 'Ask AI to explain this panel'}
      className={aiInsightButton({ state: loading ? 'loading' : 'idle' })}
    >
      <span>{loading ? '⏳' : '✨'}</span>
      <span>{loading ? 'Thinking…' : 'AI'}</span>
    </button>
  );
}
