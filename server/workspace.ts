/**
 * workspace.ts — task + plan tracking and plugin/MCP inventory, read directly
 * from ~/.claude (these sources are outside the jsonl event stream). 60s caches.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { claudeDir } from './scan.ts';

const DAY_MS = 24 * 3600_000;
const TTL = 60_000;

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
}
export interface WorkspaceTasksData {
  tasks: { total: number; byStatus: Record<string, number>; completionRate: number; items: TaskItem[] };
  plans: { total: number; items: PlanItem[] };
}

let tasksCache: { at: number; data: WorkspaceTasksData } | null = null;

export async function getWorkspaceTasks(now = Date.now()): Promise<WorkspaceTasksData> {
  if (tasksCache && now - tasksCache.at < TTL) return tasksCache.data;

  const items: TaskItem[] = [];
  const byStatus: Record<string, number> = {};
  const tasksRoot = join(claudeDir(), 'tasks');
  try {
    for (const proj of await readdir(tasksRoot, { withFileTypes: true })) {
      if (!proj.isDirectory()) continue;
      const projDir = join(tasksRoot, proj.name);
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
  } catch {
    /* no tasks dir */
  }

  const completed = byStatus['completed'] ?? 0;
  const completionRate = items.length > 0 ? completed / items.length : 0;
  // Blocked / in-progress first, then the rest.
  items.sort((a, b) => Number(b.blocked) - Number(a.blocked));

  const plans: PlanItem[] = [];
  const plansRoot = join(claudeDir(), 'plans');
  try {
    const files = (await readdir(plansRoot)).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      const full = join(plansRoot, f);
      try {
        const s = await stat(full);
        let title = f.replace(/\.md$/, '').replace(/-/g, ' ');
        // Title = first markdown heading if present (cheap: read only the head).
        const head = (await readFile(full, 'utf8')).slice(0, 400);
        const h = head.match(/^#\s+(.+)$/m);
        if (h) title = h[1].trim().slice(0, 120);
        plans.push({
          name: f,
          title,
          sizeBytes: s.size,
          ageDays: Math.floor((now - s.mtimeMs) / DAY_MS),
        });
      } catch {
        /* skip */
      }
    }
  } catch {
    /* no plans dir */
  }
  plans.sort((a, b) => a.ageDays - b.ageDays);

  const data: WorkspaceTasksData = {
    tasks: { total: items.length, byStatus, completionRate, items: items.slice(0, 40) },
    plans: { total: plans.length, items: plans.slice(0, 30) },
  };
  tasksCache = { at: now, data };
  return data;
}

// ── Plugins & MCP inventory ───────────────────────────────────────────────────

export interface InventoryData {
  plugins: { name: string; marketplace: string; version: string; installedAt?: string }[];
  marketplaces: string[];
  enabledPlugins: string[];
  mcpServers: { name: string; scope: 'global' | 'project' }[];
  hooks: string[];
  model?: string;
  effortLevel?: string;
}

let invCache: { at: number; data: InventoryData } | null = null;

async function readJson(path: string): Promise<any> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

export async function getInventory(now = Date.now()): Promise<InventoryData> {
  if (invCache && now - invCache.at < TTL) return invCache.data;

  const dir = claudeDir();
  const installed = await readJson(join(dir, 'plugins', 'installed_plugins.json'));
  const marketplacesJson = await readJson(join(dir, 'plugins', 'known_marketplaces.json'));
  const settings = await readJson(join(dir, 'settings.json'));
  // The MCP server config lives in ~/.claude.json (sibling of the .claude dir).
  const claudeJson = await readJson(join(dirname(dir), '.claude.json'));

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

  const data: InventoryData = {
    plugins: plugins.sort((a, b) => a.name.localeCompare(b.name)),
    marketplaces: [...marketplaces],
    enabledPlugins,
    mcpServers,
    hooks,
    model: typeof settings?.model === 'string' ? settings.model : undefined,
    effortLevel: typeof settings?.effortLevel === 'string' ? settings.effortLevel : undefined,
  };
  invCache = { at: now, data };
  return data;
}
