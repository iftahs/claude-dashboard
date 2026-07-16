import { useCallback, useEffect, useRef, useState } from 'react';
import { usePolling, type PollState } from './usePolling';
import type { AutoResumeMode, AutoResumePermission, AutoResumeState } from '../types';

/**
 * Auto-resume prefs + backend sync. Unlike useSettings (never sent to the
 * backend), these prefs ARE pushed to /api/auto-resume/state: the backend keeps
 * arm-state in memory only, so localStorage is the durable copy and the hook
 * re-arms the backend after a restart (state.configured === false).
 */

export const DEFAULT_RESUME_PROMPT =
  'You were interrupted by a usage limit. Continue exactly where you left off and finish the task in progress.';

export interface AutoResumePrefs {
  mode: AutoResumeMode;
  prompt: string;
  triggerWeekly: boolean;
  permission: AutoResumePermission;
  /**
   * Whole tool rules granted to the headless run — an ARRAY so rule boundaries
   * survive rules that contain spaces/quotes/pipes. Delivered to the CLI via a
   * temp --settings file, never as command-line text.
   */
  allowedTools: string[];
}

const KEY = 'claude-dashboard-auto-resume-v1';

const DEFAULTS: AutoResumePrefs = {
  mode: 'off',
  prompt: DEFAULT_RESUME_PROMPT,
  triggerWeekly: false,
  permission: 'inherit',
  allowedTools: [],
};

/**
 * Split free-typed rule text into whole rules, paren-aware:
 * `Edit Bash(npm run:*)` → ['Edit', 'Bash(npm run:*)'] — spaces inside (...)
 * belong to the rule. Also migrates legacy space-joined stored strings.
 */
export function tokenizeRules(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function load(): AutoResumePrefs {
  try {
    const p = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {}) };
    // v1 stored a space-joined string — migrate to the array shape.
    if (typeof (p.allowedTools as unknown) === 'string') {
      p.allowedTools = tokenizeRules(p.allowedTools as unknown as string);
    }
    return p;
  } catch {
    return DEFAULTS;
  }
}

function post(prefs: AutoResumePrefs): void {
  void fetch('/api/auto-resume/state', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(prefs),
  }).catch(() => {});
}

export interface UseAutoResume {
  state: PollState<AutoResumeState>;
  prefs: AutoResumePrefs;
  setPrefs: (partial: Partial<AutoResumePrefs>) => void;
}

export function useAutoResume(): UseAutoResume {
  const state = usePolling<AutoResumeState>('/api/auto-resume/state', 5000);
  const [prefs, setPrefsState] = useState<AutoResumePrefs>(load);
  const rearmedAt = useRef(0);

  const setPrefs = useCallback((partial: Partial<AutoResumePrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(KEY, JSON.stringify(next));
      post(next);
      return next;
    });
  }, []);

  // Re-arm after a backend restart: the backend boots unconfigured, so push
  // the persisted prefs back (ref-throttled to avoid POST loops between polls).
  useEffect(() => {
    if (!state.data || state.data.configured) return;
    if (prefs.mode === 'off') return;
    if (Date.now() - rearmedAt.current < 10_000) return;
    rearmedAt.current = Date.now();
    post(prefs);
  }, [state.data, prefs]);

  // Once-mode disarm propagation: after a fired job the backend flips itself to
  // 'off'; mirror that into localStorage so a reload doesn't re-arm.
  useEffect(() => {
    if (!state.data?.configured) return;
    if (state.data.mode === 'off' && prefs.mode === 'once') {
      setPrefsState((prev) => {
        const next = { ...prev, mode: 'off' as AutoResumeMode };
        localStorage.setItem(KEY, JSON.stringify(next));
        return next;
      });
    }
  }, [state.data, prefs.mode]);

  return { state, prefs, setPrefs };
}
