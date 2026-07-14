/**
 * ai-router.ts — decides which datasets a question needs.
 *
 * The chat can NEVER fail because of retrieval. The ladder degrades, in order:
 *   1. AI_ROUTER=off                      → overview only
 *   2. lexical hit                        → zero extra model calls (every backend)
 *   3. no hit, CLI backend, no user key   → skip the router; a `claude --print`
 *                                           spawn costs 2-4s and the catalog makes
 *                                           an unrouted answer honest anyway
 *   4. no hit, API backend                → one cheap model call to pick datasets
 *   5. anything throws                    → overview only
 *
 * server/ai.ts is deliberately not modified: the `claude --print` backend has no
 * tool channel at all, so a tool_use loop would be dead on the app's most common
 * backend. This routes with plain text calls instead, which every backend has.
 */

import { runAi, resolveBackend, type AiCreds } from './ai.ts';
import { CATALOG, lexicalRoute, datasetsDisabled, type DatasetId } from './ai-datasets.ts';
import type { ChatTurn } from './ai-context.ts';

export interface RouteResult {
  ids: DatasetId[];
  via: 'lexical' | 'model' | 'none';
}

const MAX_DATASETS = 3;
const VALID = new Set<string>(CATALOG.map((c) => c.id));

const ROUTER_SYSTEM = [
  'You route a question about a Claude Code usage dashboard to the datasets that can answer it.',
  `Return ONLY a JSON array of at most ${MAX_DATASETS} dataset ids from the catalog, most relevant first, e.g. ["workflows"].`,
  'Return [] if the question needs no dataset (it is small talk, or general Claude knowledge, or the overview alone answers it).',
  'No prose, no markdown, no explanation — just the JSON array.',
].join(' ');

function mode(): 'auto' | 'model' | 'lexical' | 'off' {
  const m = process.env.AI_ROUTER;
  return m === 'model' || m === 'lexical' || m === 'off' ? m : 'auto';
}

/** Tolerant parse — same spirit as parseSuggestions: models like to add prose. */
function parseIds(text: string): DatasetId[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is DatasetId => typeof x === 'string' && VALID.has(x)).slice(0, MAX_DATASETS);
  } catch {
    return [];
  }
}

export async function routeDatasets(
  question: string,
  history: ChatTurn[],
  creds: AiCreds | null,
): Promise<RouteResult> {
  const m = mode();
  if (m === 'off' || datasetsDisabled()) return { ids: [], via: 'none' };

  // The last couple of turns matter: "and how many tokens?" carries no keywords
  // of its own, but the workflow question two lines up does.
  const text = [question, ...history.slice(-2).map((t) => t.content)].join('\n');

  if (m !== 'model') {
    const hits = lexicalRoute(text, MAX_DATASETS);
    if (hits.length > 0) return { ids: hits, via: 'lexical' };
    if (m === 'lexical') return { ids: [], via: 'none' };
  }

  try {
    // Spawning `claude --print` just to route costs 2-4s on top of the answer.
    // The catalog makes an unrouted answer honest, so on the CLI we skip it.
    if (!creds && m === 'auto') {
      const status = await resolveBackend();
      if (status.available === 'cli') return { ids: [], via: 'none' };
      if (status.available === 'none') return { ids: [], via: 'none' };
    }
    const catalog = CATALOG.map((c) => `${c.id}: ${c.describes}`).join('\n');
    const { text: out } = await runAi(
      {
        system: ROUTER_SYSTEM,
        user: `CATALOG:\n${catalog}\n\nQUESTION: ${question}\n\nReturn the JSON array of dataset ids.`,
        maxTokens: 80,
      },
      creds,
    );
    const ids = parseIds(out);
    return ids.length > 0 ? { ids, via: 'model' } : { ids: [], via: 'none' };
  } catch {
    return { ids: [], via: 'none' };
  }
}
