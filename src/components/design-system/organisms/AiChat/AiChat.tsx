import { useEffect, useRef, useState } from 'react';
import { useAiChat } from '@/hooks/useAiChat';
import { PROVIDER_MODELS } from '@/hooks/useAiConfig';
import { Markdown } from '@/components/design-system/atoms/Markdown/Markdown';
import type { AiChatProps } from './types';

const SUGGESTIONS = [
  'Which project costs the most?',
  'Am I retrying edits too much?',
  "What's my error-rate trend?",
  'Which model should I use less?',
];

const BACKEND_NOTE: Record<string, string> = {
  cli: 'Answers come from your local Claude CLI (claude -p).',
  api: 'Answers come from the Claude.ai API using your local token.',
  apikey: 'Answers come from the Anthropic Messages API (ANTHROPIC_AUTH_TOKEN/ANTHROPIC_BASE_URL or ANTHROPIC_API_KEY).',
  none: '',
};

export function AiChat({ status, config, onChangeConfig, onAsked, onOpenSettings }: AiChatProps) {
  const { messages, loading, suggestions, send, reset } = useAiChat();
  const modelOptions = (() => {
    const list = PROVIDER_MODELS[config.provider] ?? [];
    return list.includes(config.model) ? list : [config.model, ...list];
  })();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // A user-supplied key always counts as available, even if the server has no fallback.
  const unavailable = !config.apiKey && status?.available === 'none';

  function ask(q: string) {
    if (!q.trim() || loading) return;
    onAsked();
    send(q, config);
    setInput('');
  }

  if (unavailable) {
    return (
      <div className="card p-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-300">✨ AI Insights</h2>
        <p className="text-sm text-zinc-400">
          AI insights aren't configured yet.
          {status?.reason ? ` ${status.reason}` : ''}
        </p>
        <p className="mt-2 text-xs text-zinc-600">
          Open <button onClick={onOpenSettings} className="font-medium text-clay-400 hover:text-clay-300">⚙ Settings → AI Insights</button>{' '}
          to pick a provider and paste an API key — or run with the <code className="font-mono text-zinc-400">claude</code> CLI on your PATH.
        </p>
      </div>
    );
  }

  return (
    <div className="card flex h-[calc(100vh-12rem)] flex-col p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">✨ AI Insights</h2>
        <div className="flex items-center gap-3">
          {config.apiKey ? (
            <select
              value={config.model}
              onChange={(e) => onChangeConfig({ ...config, model: e.target.value })}
              title="Model — synced with ⚙ Settings"
              className="rounded-lg bg-ink-800/60 px-2 py-1 text-[11px] text-zinc-300 outline-none ring-1 ring-white/10 hover:ring-white/20 focus:ring-clay-500"
            >
              {modelOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            status && BACKEND_NOTE[status.available] && (
              <span className="text-[11px] text-zinc-600">{status.model}</span>
            )
          )}
          {messages.length > 0 && (
            <button
              onClick={reset}
              className="rounded-lg px-2.5 py-1 text-xs text-zinc-400 ring-1 ring-white/10 transition-colors hover:text-zinc-200 hover:ring-white/20"
              title="Start a new conversation"
            >
              + New chat
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-md text-sm text-zinc-500">
              Ask anything about your Claude Code usage. Answers are based on your local usage aggregates.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full bg-ink-800/60 px-3 py-1.5 text-xs text-zinc-400 ring-1 ring-white/10 transition-colors hover:bg-ink-700/60 hover:text-zinc-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'whitespace-pre-line bg-clay-500/20 text-zinc-100'
                    : m.error
                      ? 'whitespace-pre-line bg-red-500/10 text-red-300 ring-1 ring-red-500/20'
                      : 'bg-ink-800/70 text-zinc-300 ring-1 ring-white/10'
                }`}
              >
                {m.role === 'assistant' && !m.error ? (
                  m.content ? (
                    <Markdown text={m.content} />
                  ) : (
                    <span className="text-zinc-500">
                      <span className="pulse-dot mr-1.5" />
                      thinking…
                    </span>
                  )
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {messages.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(suggestions.length > 0 ? suggestions : SUGGESTIONS).map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={loading}
              className="rounded-full bg-ink-800/60 px-2.5 py-1 text-[11px] text-zinc-400 ring-1 ring-white/10 transition-colors hover:bg-ink-700/60 hover:text-zinc-200 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your usage…"
          className="flex-1 rounded-xl bg-ink-800/60 px-3.5 py-2.5 text-sm text-zinc-200 outline-none ring-1 ring-white/10 placeholder:text-zinc-600 focus:ring-clay-500/40"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-clay-500/20 px-4 py-2.5 text-sm font-semibold text-clay-300 transition-colors hover:bg-clay-500/30 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
