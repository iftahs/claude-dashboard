import type { Platform } from '@/lib/platform';

export const ERROR_TITLE = "Can't load usage data from the dashboard server";

export function errorDescription(message: string): string {
  return `${message} — it keeps retrying, and the dashboard loads as soon as the server answers.`;
}

export function emptyCopy(platform: Platform): { title: string; description: string } {
  if (platform === 'codex') {
    return {
      title: 'No Codex usage found',
      description: 'Run a thread in the ChatGPT desktop app, then this dashboard will populate.',
    };
  }
  return {
    title: 'No usage logs found',
    description:
      platform === 'both'
        ? 'Use Claude Code or Codex, then this dashboard will populate.'
        : 'Use Claude Code, then this dashboard will populate.',
  };
}

export function liveOnlyCopy(platform: Platform): string {
  const what = platform === 'codex' ? 'a Codex thread' : platform === 'both' ? 'Claude Code or Codex' : 'Claude Code';
  return `No local usage yet — the plan limits here are read live from your account. The charts fill in once you use ${what}.`;
}
