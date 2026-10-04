import type { Platform } from '@/lib/platform';

export function effortHelp(platform: Platform): string {
  const base =
    'Effective tokens and estimated equivalent cost by the reasoning-effort level each response ran at — all models on top, then each model’s mix. “Reasoning” is the share of output tokens spent reasoning, over the responses that report it';
  if (platform === 'codex') {
    return `${base} (OpenAI’s reasoning output tokens). Codex logs the effort per turn; the guardian auto-review runs at its own level and is not priced.`;
  }
  if (platform === 'both') {
    return `${base} — Claude’s thinking tokens (logged only by newer Claude Code builds; earlier messages count as n/a, never 0%) and OpenAI’s reasoning output tokens. “Not logged” is usage whose log carries no effort level.`;
  }
  return `${base} (the thinking tokens newer Claude Code builds log per response; earlier messages count as n/a, never 0%). “Not logged” is usage from builds that did not record the effort level.`;
}
