import { useNavigate } from 'react-router-dom';
import { useAgentTraffic } from '@/hooks/useAgentTraffic';
import type { AgentTrafficStatus } from '@/types';

// One lamp in the horizontal housing. Lit → full color + outer glow; unlit →
// recessed dark tint of the same color so it reads as "off, not absent".
function Lamp({
  color,
  glow,
  lit,
  count,
}: {
  color: string;
  glow: string;
  lit: boolean;
  count: number;
}) {
  return (
    <span
      className="relative flex h-5 w-5 items-center justify-center rounded-full transition-all duration-500"
      style={{
        backgroundColor: color,
        opacity: lit ? 1 : 0.16,
        boxShadow: lit
          ? `0 0 9px 2px ${glow}, inset 0 0 4px rgba(255,255,255,0.35)`
          : 'inset 0 1px 2px rgba(0,0,0,0.6)',
      }}
    >
      {lit && count > 0 && (
        <span className="text-[10px] font-bold leading-none tabular-nums text-black/75">{count}</span>
      )}
    </span>
  );
}

const LAMPS: { status: AgentTrafficStatus; color: string; glow: string }[] = [
  { status: 'waiting', color: '#ef4444', glow: 'rgba(239,68,68,0.75)' },
  { status: 'running', color: '#fbbf24', glow: 'rgba(251,191,36,0.75)' },
  { status: 'finished', color: '#34d399', glow: 'rgba(52,211,153,0.65)' },
];

/**
 * Horizontal, real-traffic-light-styled signal for the header: red = an agent
 * needs you, yellow = agents running, green = idle/last finished. The lit lamp
 * glows and shows its count. Fades to nearly transparent (restoring on hover)
 * when no agents are active. Click jumps to the Agents tab.
 */
export function AgentTrafficSignal() {
  const navigate = useNavigate();
  const { running, waiting, finished, active, signal } = useAgentTraffic();

  const count = (s: AgentTrafficStatus) =>
    s === 'waiting' ? waiting : s === 'running' ? running : finished;

  const title = `Agents — ${waiting} waiting, ${running} running, ${finished} recently finished. Click to open.`;

  return (
    <button
      onClick={() => navigate('/agents')}
      title={title}
      aria-label={title}
      className={`flex items-center gap-1.5 rounded-full bg-gradient-to-b from-zinc-800 to-zinc-900 px-2 py-1 ring-1 ring-black/50 shadow-md shadow-black/40 transition-opacity duration-700 hover:ring-white/20 ${
        active ? 'opacity-100' : 'opacity-30 hover:opacity-100'
      }`}
    >
      {LAMPS.map((l) => (
        <Lamp key={l.status} color={l.color} glow={l.glow} lit={signal === l.status} count={count(l.status)} />
      ))}
    </button>
  );
}
