import type { ResumeJobStatus } from '@/types';

/**
 * Copy-paste command that starts the host watcher from ANY terminal/folder:
 * absolute script path + explicit --url (flag syntax is identical in cmd,
 * PowerShell and bash — no env-var quoting differences). The page's own origin
 * is always the right URL: in Docker it IS the backend; in dev Vite proxies /api.
 */
export function watcherCommand(repoDir: string | null, origin: string): string {
  return scriptCommand(repoDir, origin, 'resume-watcher.mjs');
}

/**
 * One-time background install: registers the watcher as a hidden auto-start
 * (Windows Startup .vbs / macOS launchd / Linux systemd user unit) and starts
 * it immediately — no terminal has to stay open afterwards.
 */
export function installCommand(repoDir: string | null, origin: string): string {
  return scriptCommand(repoDir, origin, 'install-resume-watcher.mjs');
}

function scriptCommand(repoDir: string | null, origin: string, script: string): string {
  if (!repoDir) {
    return `node "<path-to-claude-dashboard>\\scripts\\${script}" --url ${origin}`;
  }
  const sep = repoDir.includes('\\') ? '\\' : '/';
  const base = repoDir.replace(/[\\/]+$/, '');
  return `node "${base}${sep}scripts${sep}${script}" --url ${origin}`;
}

/**
 * Grants are an ARRAY of whole rules (a rule may contain spaces, quotes, pipes —
 * `Bash(grep -r "a\|b" src)` is one rule). Arrays keep the boundaries exact;
 * they are delivered to the CLI via a temp --settings file, never a command line.
 */
export function hasAllowRule(tools: string[], rule: string): boolean {
  return tools.includes(rule);
}

/** Add (`on`) or remove (`!on`) one rule, returning the new array. */
export function toggleAllowRule(tools: string[], rule: string, on: boolean): string[] {
  if (on) return tools.includes(rule) ? tools : [...tools, rule];
  return tools.filter((t) => t !== rule);
}

/** Whatever remains after stripping every known settings rule — the user's own extra rules, as editable text. */
export function extraAllowRules(tools: string[], known: string[]): string {
  return tools.filter((t) => !known.includes(t)).join(' ');
}

/**
 * Bucket a rule by its tool: `Bash(npm run:*)` → "Bash", `WebFetch(…)` → "WebFetch",
 * `mcp__chrome-devtools__x` → "MCP · chrome-devtools" (the `claude_ai_` prefix trimmed).
 */
export function ruleGroup(rule: string): string {
  if (rule.startsWith('mcp__')) {
    const server = (rule.match(/^mcp__(.+?)__/)?.[1] ?? '').replace(/^claude_ai_/, '');
    return server ? `MCP · ${server}` : 'MCP';
  }
  return rule.match(/^([A-Za-z][\w-]*)\s*\(/)?.[1] ?? rule.match(/^([A-Za-z][\w-]*)/)?.[1] ?? 'Other';
}

export interface AllowRuleGroup {
  name: string;
  rules: string[];
}

/** Group rules by tool, rules sorted within each group and groups sorted by name. */
export function groupAllowRules(rules: string[]): AllowRuleGroup[] {
  const map = new Map<string, string[]>();
  for (const r of rules) {
    const g = ruleGroup(r);
    const list = map.get(g) ?? [];
    list.push(r);
    map.set(g, list);
  }
  return [...map.entries()]
    .map(([name, rs]) => ({ name, rules: rs.sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Human label + tailwind text color per terminal/active job status. */
export function statusLabel(status: ResumeJobStatus): { label: string; cls: string } {
  switch (status) {
    case 'pending':
      return { label: 'scheduled', cls: 'text-zinc-300' };
    case 'claimed':
      return { label: 'resuming…', cls: 'text-clay-400' };
    case 'done':
      return { label: 'resumed', cls: 'text-emerald-400' };
    case 'failed':
      return { label: 'failed', cls: 'text-red-400' };
    case 'skipped':
      return { label: 'skipped', cls: 'text-zinc-400' };
    case 'cancelled':
      return { label: 'cancelled', cls: 'text-zinc-500' };
  }
}
