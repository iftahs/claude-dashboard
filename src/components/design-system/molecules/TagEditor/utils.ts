import type { TagEditorMode } from './types';

export const TAG_MAX_LENGTH = 32;
export const IDLE: TagEditorMode = { kind: 'idle' };
export const ADDING: TagEditorMode = { kind: 'add' };

export const FOCUS_RING_INSET = 'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus';

export function nextTags(value: readonly string[], mode: TagEditorMode, draft: string): string[] | null {
  const tag = draft.trim();
  if (mode.kind === 'add') return tag ? [...value, tag] : null;
  if (mode.kind === 'rename') return tag && tag !== mode.tag ? value.map((item) => (item === mode.tag ? tag : item)) : null;
  return null;
}

export function unusedSuggestions(value: readonly string[], suggestions: readonly string[]): string[] {
  const used = new Set(value.map((tag) => tag.toLowerCase()));
  return suggestions.filter((tag) => !used.has(tag.toLowerCase()));
}
