import type { Platform } from '@/hooks/useSource';

/** Whose native tools "built-in" means, and what they are, per platform. */
export function builtInCopy(platform: Platform): { agentNoun: string; examples: string } {
  if (platform === 'codex') {
    return { agentNoun: "Codex's", examples: 'shell commands, file patches, web search…' };
  }
  if (platform === 'both') {
    return { agentNoun: "each agent's", examples: "Claude's Read, Bash, Edit; Codex's shell commands and patches…" };
  }
  return { agentNoun: "Claude's", examples: 'Read, Bash, Edit…' };
}
