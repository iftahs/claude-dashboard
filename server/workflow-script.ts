/**
 * workflow-script.ts
 * Static analysis of a generated workflow script (`workflows/scripts/<name>-wf_<id>.js`).
 *
 * A *running* workflow writes no phase data to disk — phase membership and agent
 * labels only land in the final `wf_<id>.json` at completion. The script, however,
 * is written up-front and carries both: `export const meta.phases` and each
 * `agent(prompt, { label, phase, agentType, model })` call.
 *
 * So we parse the script and map each live subagent transcript back to its call by
 * matching the transcript's rendered prompt against the call's *static* template
 * segments. Shared boilerplate (a `${COMMON}` preamble) scores equally for every
 * call, so the distinctive tail decides. Ambiguity degrades gracefully: identical
 * templates (loop-generated calls) keep the phase and drop the label; no match at
 * all leaves both empty and the caller falls back to the prompt text.
 */

import { readFile, stat } from 'node:fs/promises';

export interface ScriptAgentCall {
  label: string; // '' when the script builds it dynamically (`fix:${g.scope}`)
  phase: string;
  agentType: string;
  model: string;
  chunks: string[]; // static prompt segments, longest first
}

export interface ScriptInfo {
  name: string;
  description: string;
  phases: { title: string; detail: string }[];
  calls: ScriptAgentCall[];
  /** Resolved top-level string consts big enough to be a shared preamble (`COMMON`). */
  boilerplate: string[];
}

const MIN_CHUNK = 24; // shorter segments match everything and only add noise
const MAX_CHUNKS = 12;
const MAX_SCRIPT = 2 * 1024 * 1024;
const MIN_BOILERPLATE = 200; // below this a shared const isn't a preamble worth stripping

// ── Source scanning (strings/templates/comments aware) ───────────────────────

const CLOSER: Record<string, string> = { '(': ')', '{': '}', '[': ']' };

function skipQuoted(src: string, i: number): number {
  const q = src[i];
  i++;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === q) return i + 1;
    i++;
  }
  return i;
}

function skipTemplate(src: string, i: number): number {
  i++; // opening backtick
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '`') return i + 1;
    if (c === '$' && src[i + 1] === '{') {
      const end = matchDelim(src, i + 1);
      if (end < 0) return src.length;
      i = end + 1;
      continue;
    }
    i++;
  }
  return i;
}

/** Index of the delimiter matching the opener at `start`, or -1. */
function matchDelim(src: string, start: number): number {
  const stack: string[] = [];
  let i = start;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      if (nl < 0) return -1;
      i = nl + 1;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) return -1;
      i = e + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      i = skipQuoted(src, i);
      continue;
    }
    if (c === '`') {
      i = skipTemplate(src, i);
      continue;
    }
    if (CLOSER[c]) {
      stack.push(CLOSER[c]);
      i++;
      continue;
    }
    if (c === ')' || c === '}' || c === ']') {
      if (stack.pop() !== c) return -1;
      if (stack.length === 0) return i;
      i++;
      continue;
    }
    i++;
  }
  return -1;
}

/** Positions of the `(` of every top-level `agent(` call (not inside a string). */
function findAgentCallParens(src: string): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      if (nl < 0) break;
      i = nl + 1;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) break;
      i = e + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      i = skipQuoted(src, i);
      continue;
    }
    if (c === '`') {
      i = skipTemplate(src, i);
      continue;
    }
    if (src.startsWith('agent', i) && !/[\w$.]/.test(src[i - 1] ?? '')) {
      let j = i + 5;
      while (/\s/.test(src[j] ?? '')) j++;
      if (src[j] === '(') {
        out.push(j);
        i = j + 1;
        continue;
      }
    }
    i++;
  }
  return out;
}

/** Split a call's argument source on top-level commas. */
function splitArgs(src: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"') {
      i = skipQuoted(src, i);
      continue;
    }
    if (c === '`') {
      i = skipTemplate(src, i);
      continue;
    }
    if (CLOSER[c]) depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(src.slice(start, i));
      start = i + 1;
    }
    i++;
  }
  parts.push(src.slice(start));
  return parts;
}

function unescape(s: string): string {
  return s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_m, esc: string) => {
    switch (esc[0]) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case 'r':
        return '\r';
      case 'u':
      case 'x':
        try {
          return JSON.parse(`"\\${esc}"`);
        } catch {
          return esc;
        }
      default:
        return esc;
    }
  });
}

/** A string literal split into its literal text and `${…}` expression sources. */
interface Parts {
  parts: { type: 'text' | 'expr'; value: string }[];
}

/** Parse a string/template literal at the start of `src`; null if it isn't one. */
function parseLiteral(argSrc: string): Parts | null {
  const src = argSrc.trim();
  if (src.startsWith("'") || src.startsWith('"')) {
    return { parts: [{ type: 'text', value: unescape(src.slice(1, skipQuoted(src, 0) - 1)) }] };
  }
  if (!src.startsWith('`')) return null;
  const inner = src.slice(1, skipTemplate(src, 0) - 1);
  const parts: Parts['parts'] = [];
  let i = 0;
  let start = 0;
  while (i < inner.length) {
    if (inner[i] === '\\') {
      i += 2;
      continue;
    }
    if (inner[i] === '$' && inner[i + 1] === '{') {
      const e = matchDelim(inner, i + 1);
      if (e < 0) break;
      parts.push({ type: 'text', value: unescape(inner.slice(start, i)) });
      parts.push({ type: 'expr', value: inner.slice(i + 2, e).trim() });
      i = e + 1;
      start = i;
      continue;
    }
    i++;
  }
  parts.push({ type: 'text', value: unescape(inner.slice(start)) });
  return { parts };
}

/** Static (interpolation-free) segments of a prompt argument, longest first. */
function promptChunks(argSrc: string): string[] {
  const lit = parseLiteral(argSrc);
  if (!lit) return [];
  return lit.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.value.trim())
    .filter((s) => s.length >= MIN_CHUNK)
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_CHUNKS);
}

/** Positions of the value of every `const NAME = <string literal>` declaration. */
function findStringConsts(src: string): { name: string; at: number }[] {
  const out: { name: string; at: number }[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      if (nl < 0) break;
      i = nl + 1;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) break;
      i = e + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      i = skipQuoted(src, i);
      continue;
    }
    if (c === '`') {
      i = skipTemplate(src, i);
      continue;
    }
    if (src.startsWith('const', i) && !/[\w$.]/.test(src[i - 1] ?? '')) {
      const m = /^const\s+([A-Za-z_$][\w$]*)\s*=\s*/.exec(src.slice(i, i + 200));
      if (m) {
        const at = i + m[0].length;
        if (src[at] === '`' || src[at] === "'" || src[at] === '"') out.push({ name: m[1], at });
        i = at;
        continue;
      }
    }
    i++;
  }
  return out;
}

/**
 * Resolve `const` string literals, in source order, substituting `${IDENT}` from
 * already-resolved consts. A const with any other kind of interpolation (a call,
 * a member access) is skipped — the goal is only the big static preamble blocks.
 */
function resolveConsts(src: string): string[] {
  const values = new Map<string, string>();
  for (const decl of findStringConsts(src)) {
    const lit = parseLiteral(src.slice(decl.at));
    if (!lit) continue;
    let text = '';
    let ok = true;
    for (const p of lit.parts) {
      if (p.type === 'text') text += p.value;
      else {
        const v = values.get(p.value);
        if (v === undefined) {
          ok = false;
          break;
        }
        text += v;
      }
    }
    if (ok) values.set(decl.name, text);
  }
  return [...values.values()]
    .filter((v) => v.length >= MIN_BOILERPLATE)
    .sort((a, b) => b.length - a.length);
}

/** Remove a run's shared preamble blocks from a rendered prompt. */
export function stripBoilerplate(prompt: string, blocks: string[]): string {
  let out = prompt;
  for (const b of blocks) if (out.includes(b)) out = out.split(b).join('\n');
  return out;
}

/** Value of a static string-literal option; '' when absent or interpolated. */
function optString(optsSrc: string, key: string): string {
  const re = new RegExp(`\\b${key}\\s*:\\s*(?:'([^']*)'|"([^"]*)"|\`([^\`]*)\`)`);
  const m = optsSrc.match(re);
  if (!m) return '';
  const v = m[1] ?? m[2] ?? m[3] ?? '';
  return v.includes('${') ? '' : unescape(v);
}

// ── Public parse ────────────────────────────────────────────────────────────

function parseMeta(src: string): Omit<ScriptInfo, 'calls' | 'boilerplate'> {
  const out: Omit<ScriptInfo, 'calls' | 'boilerplate'> = { name: '', description: '', phases: [] };
  const m = src.match(/export\s+const\s+meta\s*=\s*/);
  if (!m || m.index == null) return out;
  const braceAt = src.indexOf('{', m.index + m[0].length);
  if (braceAt < 0) return out;
  const end = matchDelim(src, braceAt);
  if (end < 0) return out;
  try {
    // `meta` is contractually a pure literal — no calls, no identifiers.
    const literal = src.slice(braceAt, end + 1);
    if (/\b(require|import|process|global|eval|Function)\b/.test(literal)) return out;
    const value = new Function(`"use strict"; return (${literal});`)();
    if (typeof value?.name === 'string') out.name = value.name;
    if (typeof value?.description === 'string') out.description = value.description;
    if (Array.isArray(value?.phases)) {
      out.phases = value.phases
        .filter((p: any) => typeof p?.title === 'string')
        .map((p: any) => ({ title: String(p.title), detail: String(p.detail ?? '') }));
    }
  } catch {
    /* hand-edited or non-literal meta — phases stay empty */
  }
  return out;
}

function parseScript(src: string): ScriptInfo {
  const meta = parseMeta(src);
  const calls: ScriptAgentCall[] = [];
  for (const paren of findAgentCallParens(src)) {
    const end = matchDelim(src, paren);
    if (end < 0) continue;
    const args = splitArgs(src.slice(paren + 1, end));
    const chunks = promptChunks(args[0] ?? '');
    if (!chunks.length) continue;
    const opts = (args[1] ?? '').trim();
    calls.push({
      label: optString(opts, 'label'),
      phase: optString(opts, 'phase'),
      agentType: optString(opts, 'agentType'),
      model: optString(opts, 'model'),
      chunks,
    });
  }
  return { ...meta, calls, boilerplate: resolveConsts(src) };
}

const cache = new Map<string, { mtime: number; info: ScriptInfo }>();

/** Parse (and cache by path+mtime) a run's generated script. */
export async function readScriptInfo(path: string): Promise<ScriptInfo | null> {
  let mtime = 0;
  try {
    const s = await stat(path);
    if (s.size > MAX_SCRIPT) return null;
    mtime = s.mtimeMs;
  } catch {
    return null;
  }
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.info;
  try {
    const info = parseScript(await readFile(path, 'utf8'));
    cache.set(path, { mtime, info });
    return info;
  } catch {
    return null;
  }
}

/**
 * Best `agent()` call for a rendered prompt, scored by matched static bytes.
 * A tie means several calls share one template (a `parallel(map(...))` fan-out):
 * keep only what all tied calls agree on, so we never mislabel an agent.
 */
export function matchCall(prompt: string, calls: ScriptAgentCall[]): ScriptAgentCall | null {
  let best: ScriptAgentCall[] = [];
  let bestScore = 0;
  for (const c of calls) {
    let score = 0;
    for (const ch of c.chunks) if (prompt.includes(ch)) score += ch.length;
    if (score > bestScore) {
      bestScore = score;
      best = [c];
    } else if (score === bestScore && score > 0) {
      best.push(c);
    }
  }
  if (bestScore === 0) return null;
  if (best.length === 1) return best[0];
  const agree = (k: keyof ScriptAgentCall) => (best.every((c) => c[k] === best[0][k]) ? best[0][k] : '');
  return {
    label: '', // tied calls differ per item — a shared label would be a lie
    phase: agree('phase') as string,
    agentType: agree('agentType') as string,
    model: agree('model') as string,
    chunks: [],
  };
}

const MIN_PREAMBLE = 200;

/**
 * Length of the shared `${COMMON}` preamble across a run's prompts, cut back to a
 * line boundary. 0 unless the overlap is long enough to be real boilerplate — a
 * short accidental overlap (two prompts both starting "Re") would slice mid-word.
 */
export function commonPrefixLen(texts: string[]): number {
  if (texts.length < 2) return 0;
  let len = texts[0].length;
  for (let i = 1; i < texts.length; i++) {
    const b = texts[i];
    let j = 0;
    while (j < len && j < b.length && texts[0][j] === b[j]) j++;
    len = j;
    if (len < MIN_PREAMBLE) return 0;
  }
  const nl = texts[0].lastIndexOf('\n', len);
  return nl > 0 ? nl + 1 : 0;
}
