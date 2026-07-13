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
 * The `--allowedTools` string is space-separated, but a single rule may contain
 * internal spaces (e.g. `Bash(npm run:*)`). So we never `.split(' ')` — instead
 * each rule is matched/added/removed as a whole literal bounded by spaces.
 */
export function hasAllowRule(tools: string, rule: string): boolean {
  return ` ${tools.trim()} `.includes(` ${rule} `);
}

/** Add (`on`) or remove (`!on`) one rule, returning the normalized new string. */
export function toggleAllowRule(tools: string, rule: string, on: boolean): string {
  const has = hasAllowRule(tools, rule);
  if (on) {
    if (has) return tools.trim();
    const t = tools.trim();
    return t ? `${t} ${rule}` : rule;
  }
  return ` ${tools.trim()} `.split(` ${rule} `).join(' ').replace(/\s+/g, ' ').trim();
}

/** Whatever remains after stripping every known settings rule — the user's own extra rules. */
export function extraAllowRules(tools: string, known: string[]): string {
  return known.reduce((acc, r) => toggleAllowRule(acc, r, false), tools).trim();
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
