import type { Platform } from '@/hooks/useSource';

// Each question must be answerable on its platform — no workflow question under Codex (Claude Code only).
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

export const INTRO: Record<Platform, string> = {
  claude: 'Ask anything about your Claude Code usage. Answers are based on your local usage aggregates.',
  codex: 'Ask anything about your Codex usage. Answers are based on your local usage aggregates.',
  both: 'Ask anything about your Claude Code and Codex usage. Answers are based on your local usage aggregates.',
};
