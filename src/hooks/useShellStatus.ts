import { limitTone } from '@/lib/limits';
import { useAgentTraffic } from './useAgentTraffic';
import { useLiveData } from './useLiveData';
import { useLiveMetrics } from './useLiveMetrics';
import { useSource } from './useSource';

export interface LimitStatus {
  window: string;
  value: string;
  tone: 'neutral' | 'warning' | 'danger';
  title: string;
}

export interface AgentsStatus {
  count: number;
  label: string;
  tone: 'neutral' | 'danger';
  running: boolean;
  title: string;
}

export interface ShellStatus {
  limit: LimitStatus | null;
  agents: AgentsStatus;
  live: { state: 'live' | 'error'; label?: string };
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function useShellStatus(): ShellStatus {
  const { platform } = useSource();
  const { binding, limitTooltip } = useLiveMetrics();
  const { running, waiting, finished, yourTurn } = useAgentTraffic();
  const { recent, weekly } = useLiveData();

  let limit: LimitStatus | null = null;
  if (binding) {
    const window = binding.label.replace(/\s+limit$/, '');
    const tone = limitTone(binding.pct);
    limit = {
      window: platform === 'both' ? `${binding.platform} ${window}` : capitalise(window),
      value: `${binding.pct}%`,
      tone: tone === 'success' ? 'neutral' : tone,
      title: limitTooltip,
    };
  }

  const agents: AgentsStatus = {
    count: waiting > 0 ? waiting : running,
    label: waiting > 0 ? 'waiting on you' : 'running',
    tone: waiting > 0 ? 'danger' : 'neutral',
    running: waiting === 0 && running > 0,
    title: `Agents: ${waiting} waiting, ${running} running, ${yourTurn > 0 ? `${yourTurn} your turn, ` : ''}${finished} recently finished`,
  };

  const error = recent.error || weekly.error;
  return { limit, agents, live: error ? { state: 'error', label: 'Connection error' } : { state: 'live' } };
}
