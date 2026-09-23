import { useCallback, useState } from 'react';

/** Project-path → custom tags. Persisted client-side only (privacy: never sent to backend). */
export type TagMap = Record<string, string[]>;

const KEY = 'claude-dashboard-tags-v1';
const MAX_TAG_LEN = 32;

function load(): TagMap {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return raw && typeof raw === 'object' ? (raw as TagMap) : {};
  } catch {
    return {};
  }
}

export interface TagsApi {
  /** Raw path → tags map (stable identity until a mutation). */
  tags: TagMap;
  /** Tags for one project path (always an array, never undefined). */
  tagsFor: (path: string) => string[];
  /** Replace the tag set for a project path; an empty result clears the entry. */
  setTagsFor: (path: string, tags: string[]) => void;
  /** Every distinct tag in use, sorted. */
  allTags: () => string[];
  /**
   * Move tags stored under an old project path onto its current one (merged,
   * de-duplicated) and drop the old key. Idempotent: once an old key is gone
   * there is nothing left to move, so it runs once per key in practice.
   */
  migrate: (moves: TagMove[]) => void;
}

/** An old project path whose tags belong to `to` now. */
export interface TagMove {
  from: string;
  to: string;
}

/** Trim, drop empties, cap length, dedupe case-insensitively (first spelling wins). */
function cleanTags(list: string[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of list) {
    const t = raw.trim().slice(0, MAX_TAG_LEN);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    clean.push(t);
  }
  return clean;
}

/**
 * The tag map after applying `moves`, or null when none of them applies. Project
 * paths used to be decoded from Claude Code's folder names (lossy: `iftah.dev`
 * came back as `dev-projects-iftah-dev`); they now come from the transcript cwd,
 * and /api/projects lists each project's old paths so no tag is orphaned.
 */
export function migrateTagMap(tags: TagMap, moves: TagMove[]): TagMap | null {
  let next: TagMap | null = null;
  for (const { from, to } of moves) {
    if (!from || !to || from === to) continue;
    const src = (next ?? tags)[from];
    if (!src) continue;
    next = next ?? { ...tags };
    next[to] = cleanTags([...(next[to] ?? []), ...src]);
    delete next[from];
  }
  return next;
}

/**
 * User-defined project tags for LiteLLM-style cost attribution. Mirrors the
 * useLimits/useSettings localStorage pattern — purely client-side, so it works
 * against the read-only ~/.claude mount and keeps project paths on the machine.
 */
export function useTags(): TagsApi {
  const [tags, setTags] = useState<TagMap>(load);

  const persist = useCallback((next: TagMap) => {
    setTags(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* localStorage unavailable — best effort */
    }
  }, []);

  const tagsFor = useCallback((path: string) => tags[path] ?? [], [tags]);

  const setTagsFor = useCallback(
    (path: string, list: string[]) => {
      const clean = cleanTags(list);
      const next = { ...tags };
      if (clean.length) next[path] = clean;
      else delete next[path];
      persist(next);
    },
    [tags, persist],
  );

  const allTags = useCallback(() => {
    const set = new Set<string>();
    for (const list of Object.values(tags)) for (const t of list) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [tags]);

  const migrate = useCallback(
    (moves: TagMove[]) => {
      const next = migrateTagMap(tags, moves);
      if (next) persist(next);
    },
    [tags, persist],
  );

  return { tags, tagsFor, setTagsFor, allTags, migrate };
}
