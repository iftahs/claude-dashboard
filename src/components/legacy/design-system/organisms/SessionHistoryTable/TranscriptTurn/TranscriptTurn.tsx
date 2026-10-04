import { shortModel, toolLabel } from '@/lib/format';
import type { TranscriptTurnProps } from './types';

export function TranscriptTurn({ turn }: TranscriptTurnProps) {
  const isUser = turn.role === 'user';
  const ts = turn.ts
    ? new Date(turn.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';
  return (
    <div className="flex gap-2 text-xs" dir="ltr">
      <span className="flex-none select-none text-base leading-none mt-0.5">{isUser ? '🧑' : '🤖'}</span>

      <div className="flex flex-col gap-1 min-w-0 flex-1 items-start">
        <div className="flex items-center gap-2 flex-wrap">
          {ts && <span className="text-zinc-600 font-mono">{ts}</span>}
          {!isUser && turn.model && <span className="text-zinc-600 italic">{shortModel(turn.model)}</span>}
        </div>

        {/* Text block — omitted entirely for tool-only turns */}
        {(turn.text || !turn.tools?.length) && (
          <div
            dir="auto"
            className={`rounded-xl px-3 py-2 max-h-[300px] overflow-y-auto leading-relaxed whitespace-pre-wrap break-words ${
              isUser ? 'bg-ink-700/50 text-zinc-300' : 'bg-clay-500/5 text-zinc-300 border border-clay-500/10'
            }`}
            style={{ maxWidth: '85%' }}
          >
            {turn.text || <span className="italic text-zinc-600">(empty)</span>}
          </div>
        )}

        {!isUser && turn.tools && turn.tools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {turn.tools.map((t, i) => (
              <span
                key={i}
                className="rounded-full bg-ink-700 border border-white/10 px-2 py-0.5 text-zinc-400"
                title={t.brief ? `${t.name} — ${t.brief}` : t.name}
              >
                {toolLabel(t.name)}
                {t.brief && (
                  <span className="ml-1 text-zinc-600 truncate max-w-[160px] inline-block align-bottom">{t.brief}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
