import { useCountUp } from '@/hooks/useCountUp';
import { compact } from '@/lib/format';
import type { AgentTokensProps } from './types';

export function AgentTokens({ value }: AgentTokensProps) {
  const shown = useCountUp(value);
  if (value <= 0) return null;

  return <span className="flex-none whitespace-nowrap font-mono text-mono tabular-nums text-fg-muted">{compact(shown)} tok</span>;
}
