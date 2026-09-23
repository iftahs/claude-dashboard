import type { Platform } from '@/hooks/useSource';

/**
 * Starter questions per platform. Each must be answerable on that platform: no
 * workflow question under Codex (workflows are Claude Code only), and the limits
 * question names the provider whose quota the chat will read.
 */
export const SUGGESTIONS: Record<Platform, string[]> = {
  claude: [
    'Which workflow cost me the most?',
    "What's my error-rate trend?",
    'Which project costs the most?',
    'Am I close to my weekly limit?',
  ],
  codex: [
    'Which thread was the heaviest?',
    "What's my error-rate trend?",
    'Which project costs the most?',
    'Am I close to my Codex weekly limit?',
  ],
  both: [
    'How does Claude compare to Codex on cost?',
    "What's my error-rate trend?",
    'Which project costs the most?',
    'Am I close to any rate limit?',
  ],
};

/** What the empty chat invites the user to ask about. */
export const INTRO: Record<Platform, string> = {
  claude: 'Ask anything about your Claude Code usage. Answers are based on your local usage aggregates.',
  codex: 'Ask anything about your Codex usage. Answers are based on your local usage aggregates.',
  both: 'Ask anything about your Claude Code and Codex usage. Answers are based on your local usage aggregates.',
};
