/**
 * workspace.ts — task + plan tracking and the plugin / MCP / skill inventory,
 * read directly from each platform's home folder (these sources are outside the
 * jsonl event stream). 60s caches, one per platform.
 *
 *   Claude — ~/.claude: tasks/*, plans/*.md, plugins/*.json, settings.json,
 *            ~/.claude.json (MCP servers), skills/<name>/SKILL.md
 *   Codex  — ~/.codex:  plans/<thread>/<turn>/PLAN.md, config.toml (allowlisted
 *            keys only, see codex-config.ts), skills/[.system/]<name>/SKILL.md,
 *            automations/<name>/automation.toml (name, status, schedule)
 *
 * Both platforms produce the same two shapes, so the Workspace tab renders the
 * same components whichever platform is selected. Every read is fail-soft: a
 * missing folder or unreadable file is "nothing there", never an error.
 */

import { open, readdir, readFile, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { dirname, join } from 'node:path';
import { claudeDir, codexDir } from './scan.ts';
import { projectAutomation, readCodexConfig } from './codex-config.ts';
import type { SourceFilter } from './aggregate.ts';

const DAY_MS = 24 * 3600_000;
const TTL = 60_000;

export type WorkspacePlatform = 'claude' | 'codex';
export type WorkspaceScope = WorkspacePlatform | 'all';

/** The dashboard's `?source=` → a workspace scope. Code and Cowork share ~/.claude. */
export function workspaceScope(source: SourceFilter): WorkspaceScope {
  return source === 'codex' ? 'codex' : source === 'all' ? 'all' : 'claude';
}

type Cache<T> = Map<WorkspacePlatform, { at: number; data: T }>;

async function cached<T>(cache: Cache<T>, key: WorkspacePlatform, now: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL) return hit.data;
  const data = await load();
  cache.set(key, { at: now, data });
  return data;
}

/** The first `bytes` of a file (a plan's heading lives there), or '' when unreadable. */
async function readHead(path: string, bytes = 400): Promise<string> {
  let fh: Awaited<ReturnType<typeof open>> | null = null;
  try {
    fh = await open(path, 'r');
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead).toString('utf8');
  } catch {
    return '';
  } finally {
    await fh?.close().catch(() => {});
  }
}

async function listDirs(root: string): Promise<string[]> {
  try {
    return (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

// ── Tasks & plans ─────────────────────────────────────────────────────────────

export interface TaskItem {
  id: string;
  subject: string;
  status: string;
  blocked: boolean;
}
export interface PlanItem {
  name: string;
  title: string;
  sizeBytes: number;
  ageDays: number;
  /** Set only on a merged (`all`) result, where plans from both platforms share one list. */
  platform?: WorkspacePlatform;
}
export interface WorkspaceTasksData {
  tasks: { total: number; byStatus: Record<string, number>; completionRate: number; items: TaskItem[] };
  plans: { total: number; items: PlanItem[] };
}

const MAX_TASKS = 40;
const MAX_PLANS = 30;

/** One plan file → its row. Title = the first markdown heading, else `fallback`. */
async function planItem(full: string, name: string, fallback: string, now: number): Promise<PlanItem | null> {
  try {
    const s = await stat(full);
    const h = (await readHead(full)).match(/^#\s+(.+)$/m);
    return {
      name,
      title: h ? h[1].trim().slice(0, 120) : fallback,
      sizeBytes: s.size,
      ageDays: Math.max(0, Math.floor((now - s.mtimeMs) / DAY_MS)),
    };
  } catch {
    return null;
  }
}

function tasksData(items: TaskItem[], byStatus: Record<string, number>, plans: PlanItem[]): WorkspaceTasksData {
  const completed = byStatus['completed'] ?? 0;
  // Blocked first, then the rest; newest plans first.
  items.sort((a, b) => Number(b.blocked) - Number(a.blocked));
  plans.sort((a, b) => a.ageDays - b.ageDays);
  return {
    tasks: {
      total: items.length,
      byStatus,
      completionRate: items.length > 0 ? completed / items.length : 0,
      items: items.slice(0, MAX_TASKS),
    },
    plans: { total: plans.length, items: plans.slice(0, MAX_PLANS) },
  };
}

/** Claude Code's task tooling (~/.claude/tasks/<project>/*.json) and ~/.claude/plans/*.md. */
async function claudeTasks(now: number): Promise<WorkspaceTasksData> {
  const items: TaskItem[] = [];
  const byStatus: Record<string, number> = {};
  const tasksRoot = join(claudeDir(), 'tasks');
  for (const proj of await listDirs(tasksRoot)) {
    const projDir = join(tasksRoot, proj);
    let files: string[] = [];
    try {
      files = (await readdir(projDir)).filter((f) => f.endsWith('.json'));
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        const t = JSON.parse(await readFile(join(projDir, f), 'utf8'));
        if (!t || typeof t.subject !== 'string') continue;
        const status = typeof t.status === 'string' ? t.status : 'unknown';
        const blocked = Array.isArray(t.blockedBy) && t.blockedBy.length > 0;
        items.push({ id: String(t.id ?? f), subject: String(t.subject).slice(0, 160), status, blocked });
        byStatus[status] = (byStatus[status] ?? 0) + 1;
      } catch {
        /* skip */
      }
    }
  }

  const plans: PlanItem[] = [];
  const plansRoot = join(claudeDir(), 'plans');
  let files: string[] = [];
  try {
    files = (await readdir(plansRoot)).filter((f) => f.endsWith('.md'));
  } catch {
    /* no plans dir */
  }
  for (const f of files) {
    const p = await planItem(join(plansRoot, f), f, f.replace(/\.md$/, '').replace(/-/g, ' '), now);
    if (p) plans.push(p);
  }
  return tasksData(items, byStatus, plans);
}

/**
 * Codex writes one PLAN.md per planning turn under ~/.codex/plans/<thread>/<turn>/.
 * Codex has no task tracker, so the task half is always empty.
 */
async function codexTasks(now: number): Promise<WorkspaceTasksData> {
  const plans: PlanItem[] = [];
  const root = join(codexDir(), 'plans');
  const walk = async (dir: string, rel: string, depth: number) => {
    let entries: Dirent[] = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const name = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory() && depth < 3) await walk(join(dir, e.name), name, depth + 1);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        const p = await planItem(join(dir, e.name), name, 'Untitled plan', now);
        if (p) plans.push(p);
      }
    }
  };
  await walk(root, '', 0);
  return tasksData([], {}, plans);
}

const tasksCache: Cache<WorkspaceTasksData> = new Map();

function tasksFor(platform: WorkspacePlatform, now: number): Promise<WorkspaceTasksData> {
  return cached(tasksCache, platform, now, () => (platform === 'codex' ? codexTasks(now) : claudeTasks(now)));
}

/** Both platforms in one list: Claude's tasks, and every plan tagged with its platform. */
export function mergeTasks(claude: WorkspaceTasksData, codex: WorkspaceTasksData): WorkspaceTasksData {
  const byStatus: Record<string, number> = { ...claude.tasks.byStatus };
  for (const [k, n] of Object.entries(codex.tasks.byStatus)) byStatus[k] = (byStatus[k] ?? 0) + n;
  const total = claude.tasks.total + codex.tasks.total;
  const completed = byStatus['completed'] ?? 0;
  const plans = [
    ...claude.plans.items.map((p) => ({ ...p, platform: 'claude' as const })),
    ...codex.plans.items.map((p) => ({ ...p, platform: 'codex' as const })),
  ].sort((a, b) => a.ageDays - b.ageDays);
  return {
    tasks: {
      total,
      byStatus,
      completionRate: total > 0 ? completed / total : 0,
      items: [...claude.tasks.items, ...codex.tasks.items].slice(0, MAX_TASKS),
    },
    plans: { total: claude.plans.total + codex.plans.total, items: plans.slice(0, MAX_PLANS) },
  };
}

// Without Codex events (codexData false) codexDir() may be Docker's fallback mount of ~/.claude: never read it as Codex.
export async function getWorkspaceTasks(
  scope: WorkspaceScope = 'claude',
  now = Date.now(),
  codexData = true,
): Promise<WorkspaceTasksData> {
  if (!codexData && scope === 'codex') return tasksData([], {}, []);
  if (!codexData || scope === 'claude') return tasksFor('claude', now);
  if (scope === 'codex') return tasksFor('codex', now);
  const [claude, codex] = await Promise.all([tasksFor('claude', now), tasksFor('codex', now)]);
  return mergeTasks(claude, codex);
}

// ── Plugins, MCP, skills & automations inventory ──────────────────────────────

export interface InventoryData {
  plugins: {
    name: string;
    marketplace: string;
    version: string;
    installedAt?: string;
    /** Codex only: `[plugins.*] enabled` (Claude lists enabled plugins in `enabledPlugins`). */
    enabled?: boolean;
    platform?: WorkspacePlatform;
  }[];
  marketplaces: string[];
  enabledPlugins: string[];
  mcpServers: { name: string; scope: 'global' | 'project'; command?: string; platform?: WorkspacePlatform }[];
  hooks: string[];
  model?: string;
  effortLevel?: string;
  /** User skills (<home>/skills/<name>/SKILL.md); `system` marks Codex's bundled ones. */
  skills?: { name: string; system?: boolean; platform?: WorkspacePlatform }[];
  /** Codex scheduled automations — name, human schedule and status only. */
  automations?: { name: string; schedule: string; status: string; platform?: WorkspacePlatform }[];
}

// A directory at the path (see claudeJsonPath) throws EISDIR here → null, i.e. absent.
async function readJson(path: string): Promise<any> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Where ~/.claude.json (the MCP server config) lives. On the host it sits beside
 * the .claude dir; in Docker that would be /data/.claude.json, which isn't
 * mounted — compose mounts the file on its own and points CLAUDE_JSON at it.
 * With CLAUDE_JSON_HOST unset, compose mounts a directory there instead, which
 * readJson treats as absent.
 */
export function claudeJsonPath(dir: string, env: NodeJS.ProcessEnv = process.env): string {
  return env.CLAUDE_JSON?.trim() || join(dirname(dir), '.claude.json');
}

/** Skill folders under `root` that hold a SKILL.md — by folder name; the file itself is never read. */
async function listSkills(root: string, system = false): Promise<{ name: string; system?: boolean }[]> {
  const out: { name: string; system?: boolean }[] = [];
  let entries: Dirent[] = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }
  // A linked skill folder (symlink, or a junction on Windows) loads like a real one; the SKILL.md stat follows it.
  for (const { name } of entries.filter((d) => d.isDirectory() || d.isSymbolicLink())) {
    if (name.startsWith('.')) continue;
    try {
      await stat(join(root, name, 'SKILL.md'));
      out.push(system ? { name, system: true } : { name });
    } catch {
      /* not a skill */
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function claudeInventory(): Promise<InventoryData> {
  const dir = claudeDir();
  const [installed, marketplacesJson, settings, claudeJson, skills] = await Promise.all([
    readJson(join(dir, 'plugins', 'installed_plugins.json')),
    readJson(join(dir, 'plugins', 'known_marketplaces.json')),
    readJson(join(dir, 'settings.json')),
    readJson(claudeJsonPath(dir)),
    listSkills(join(dir, 'skills')),
  ]);

  const plugins: InventoryData['plugins'] = [];
  if (installed?.plugins && typeof installed.plugins === 'object') {
    for (const [key, val] of Object.entries<any>(installed.plugins)) {
      const [name, marketplace = ''] = key.split('@');
      const first = Array.isArray(val) ? val[0] : val;
      plugins.push({
        name,
        marketplace,
        version: String(first?.version ?? ''),
        installedAt: typeof first?.installedAt === 'string' ? first.installedAt : undefined,
      });
    }
  }

  const marketplaces = new Set<string>();
  if (marketplacesJson && typeof marketplacesJson === 'object') {
    for (const k of Object.keys(marketplacesJson)) marketplaces.add(k);
  }
  if (settings?.extraKnownMarketplaces && typeof settings.extraKnownMarketplaces === 'object') {
    for (const k of Object.keys(settings.extraKnownMarketplaces)) marketplaces.add(k);
  }

  let enabledPlugins: string[] = [];
  if (Array.isArray(settings?.enabledPlugins)) enabledPlugins = settings.enabledPlugins.map(String);
  else if (settings?.enabledPlugins && typeof settings.enabledPlugins === 'object')
    enabledPlugins = Object.keys(settings.enabledPlugins);

  const mcpServers: InventoryData['mcpServers'] = [];
  const seenMcp = new Set<string>();
  const addMcp = (name: string, scope: 'global' | 'project') => {
    if (seenMcp.has(name)) return;
    seenMcp.add(name);
    mcpServers.push({ name, scope });
  };
  if (claudeJson?.mcpServers && typeof claudeJson.mcpServers === 'object') {
    for (const k of Object.keys(claudeJson.mcpServers)) addMcp(k, 'global');
  }
  if (claudeJson?.projects && typeof claudeJson.projects === 'object') {
    for (const proj of Object.values<any>(claudeJson.projects)) {
      if (proj?.mcpServers && typeof proj.mcpServers === 'object') {
        for (const k of Object.keys(proj.mcpServers)) addMcp(k, 'project');
      }
    }
  }

  const hooks = settings?.hooks && typeof settings.hooks === 'object' ? Object.keys(settings.hooks) : [];

  return {
    plugins: plugins.sort((a, b) => a.name.localeCompare(b.name)),
    marketplaces: [...marketplaces],
    enabledPlugins,
    mcpServers,
    hooks,
    model: typeof settings?.model === 'string' ? settings.model : undefined,
    effortLevel: typeof settings?.effortLevel === 'string' ? settings.effortLevel : undefined,
    skills,
  };
}

async function codexAutomations(root: string): Promise<NonNullable<InventoryData['automations']>> {
  const out: NonNullable<InventoryData['automations']> = [];
  for (const name of await listDirs(root)) {
    try {
      out.push(projectAutomation(await readFile(join(root, name, 'automation.toml'), 'utf8'), name));
    } catch {
      /* no automation.toml */
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function codexInventory(): Promise<InventoryData> {
  const dir = codexDir();
  const skillsRoot = join(dir, 'skills');
  const [config, userSkills, systemSkills, automations] = await Promise.all([
    readCodexConfig(),
    listSkills(skillsRoot),
    listSkills(join(skillsRoot, '.system'), true),
    codexAutomations(join(dir, 'automations')),
  ]);
  return {
    plugins: config.plugins.map((p) => ({ name: p.name, marketplace: p.marketplace, version: '', enabled: p.enabled })),
    marketplaces: config.marketplaces,
    enabledPlugins: config.plugins.filter((p) => p.enabled).map((p) => (p.marketplace ? `${p.name}@${p.marketplace}` : p.name)),
    // config.toml is Codex's global config; per-project config files are not read.
    mcpServers: config.mcpServers.map((m) => ({ name: m.name, scope: 'global' as const, ...(m.command ? { command: m.command } : {}) })),
    // Codex's one hook is the turn-complete `notify` program (its command is never read).
    hooks: config.notify ? ['notify'] : [],
    model: config.model ?? undefined,
    effortLevel: config.reasoningEffort ?? undefined,
    skills: [...userSkills, ...systemSkills],
    automations,
  };
}

function emptyInventory(): InventoryData {
  return { plugins: [], marketplaces: [], enabledPlugins: [], mcpServers: [], hooks: [], skills: [], automations: [] };
}

const invCache: Cache<InventoryData> = new Map();

function inventoryFor(platform: WorkspacePlatform, now: number): Promise<InventoryData> {
  return cached(invCache, platform, now, () => (platform === 'codex' ? codexInventory() : claudeInventory()));
}

/** Both platforms in one inventory, every item tagged with its platform (no single model/effort). */
export function mergeInventory(claude: InventoryData, codex: InventoryData): InventoryData {
  const tag = <T extends object>(rows: T[] | undefined, platform: WorkspacePlatform) =>
    (rows ?? []).map((r) => ({ ...r, platform }));
  return {
    plugins: [...tag(claude.plugins, 'claude'), ...tag(codex.plugins, 'codex')],
    marketplaces: [...new Set([...claude.marketplaces, ...codex.marketplaces])],
    enabledPlugins: [...claude.enabledPlugins, ...codex.enabledPlugins],
    mcpServers: [...tag(claude.mcpServers, 'claude'), ...tag(codex.mcpServers, 'codex')],
    hooks: [...new Set([...claude.hooks, ...codex.hooks])],
    skills: [...tag(claude.skills, 'claude'), ...tag(codex.skills, 'codex')],
    automations: [...tag(claude.automations, 'claude'), ...tag(codex.automations, 'codex')],
  };
}

export async function getInventory(scope: WorkspaceScope = 'claude', now = Date.now(), codexData = true): Promise<InventoryData> {
  if (!codexData && scope === 'codex') return emptyInventory();
  if (!codexData || scope === 'claude') return inventoryFor('claude', now);
  if (scope === 'codex') return inventoryFor('codex', now);
  const [claude, codex] = await Promise.all([inventoryFor('claude', now), inventoryFor('codex', now)]);
  return mergeInventory(claude, codex);
}
