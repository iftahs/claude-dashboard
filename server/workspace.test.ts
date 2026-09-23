import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claudeJsonPath, getInventory, getWorkspaceTasks, workspaceScope } from './workspace.ts';

const MIN = 60_000;

/** Point CLAUDE_DIR / CODEX_DIR / CLAUDE_JSON at a temp tree for one test, then restore them. */
async function sandbox(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), 'dash-ws-'));
  const saved = { CLAUDE_DIR: process.env.CLAUDE_DIR, CLAUDE_JSON: process.env.CLAUDE_JSON, CODEX_DIR: process.env.CODEX_DIR };
  t.after(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

async function put(path: string, text: string) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, text);
}

test('claudeJsonPath: host default is .claude.json beside the .claude dir', () => {
  assert.equal(claudeJsonPath(join('home', 'u', '.claude'), {}), join('home', 'u', '.claude.json'));
});

test('claudeJsonPath: CLAUDE_JSON (the Docker mount) wins; blank falls back', () => {
  assert.equal(claudeJsonPath('/data/.claude', { CLAUDE_JSON: '/data/claude-json' }), '/data/claude-json');
  assert.equal(claudeJsonPath(join('data', '.claude'), { CLAUDE_JSON: '  ' }), join('data', '.claude.json'));
});

test('workspaceScope: Claude surfaces share ~/.claude; codex and all pass through', () => {
  assert.equal(workspaceScope('code'), 'claude');
  assert.equal(workspaceScope('cowork'), 'claude');
  assert.equal(workspaceScope('claude'), 'claude');
  assert.equal(workspaceScope('codex'), 'codex');
  assert.equal(workspaceScope('all'), 'all');
});

test('getInventory reads MCP servers from CLAUDE_JSON, and treats a directory there as absent', async (t) => {
  const root = await sandbox(t);

  // Docker layout: the .claude dir and a separately mounted claude-json file.
  process.env.CLAUDE_DIR = join(root, '.claude');
  await mkdir(process.env.CLAUDE_DIR);
  const file = join(root, 'claude-json');
  await writeFile(
    file,
    JSON.stringify({
      mcpServers: { alpha: {} },
      projects: { '/p1': { mcpServers: { beta: {}, alpha: {} } }, '/p2': {} },
    }),
  );
  process.env.CLAUDE_JSON = file;
  const now = Date.now();
  const inv = await getInventory('claude', now);
  assert.deepEqual(inv.mcpServers, [
    { name: 'alpha', scope: 'global' },
    { name: 'beta', scope: 'project' },
  ]);

  // Compose fallback with CLAUDE_JSON_HOST unset: a directory is mounted there.
  const dirMount = join(root, 'claude-json-dir');
  await mkdir(dirMount);
  process.env.CLAUDE_JSON = dirMount;
  const later = await getInventory('claude', now + 10 * MIN); // past the 60 s cache
  assert.deepEqual(later.mcpServers, []);
});

test('getInventory(codex): config.toml, skills (user + bundled) and automations, nothing secret', async (t) => {
  const root = await sandbox(t);
  const codex = join(root, '.codex');
  process.env.CODEX_DIR = codex;
  await put(
    join(codex, 'config.toml'),
    [
      'model = "gpt-test"',
      'model_reasoning_effort = "medium"',
      'notify = ["C:\\\\hooks\\\\secret-notify.exe"]',
      '[marketplaces.bundled]',
      '[plugins."docs@bundled"]',
      'enabled = true',
      '[plugins."old@bundled"]',
      'enabled = false',
      '[mcp_servers.repl]',
      'command = "/opt/bin/node"',
      'args = ["--key", "SECRET"]',
      '[mcp_servers.repl.env]',
      'TOKEN = "SECRET"',
    ].join('\n'),
  );
  await put(join(codex, 'skills', 'grill-me', 'SKILL.md'), '---\nname: grill-me\n---\n');
  await put(join(codex, 'skills', '.system', 'imagegen', 'SKILL.md'), 'x');
  await mkdir(join(codex, 'skills', 'not-a-skill'), { recursive: true });
  await put(
    join(codex, 'automations', 'digest', 'automation.toml'),
    'name = "Digest"\nprompt = "SECRET PROMPT"\nstatus = "PAUSED"\nrrule = "RRULE:FREQ=DAILY;BYHOUR=8;BYMINUTE=0"\n',
  );

  const now = Date.now() + 20 * MIN; // past any cache an earlier test left
  const inv = await getInventory('codex', now);
  assert.equal(inv.model, 'gpt-test');
  assert.equal(inv.effortLevel, 'medium');
  assert.deepEqual(inv.plugins, [
    { name: 'docs', marketplace: 'bundled', version: '', enabled: true },
    { name: 'old', marketplace: 'bundled', version: '', enabled: false },
  ]);
  assert.deepEqual(inv.enabledPlugins, ['docs@bundled']);
  assert.deepEqual(inv.marketplaces, ['bundled']);
  assert.deepEqual(inv.mcpServers, [{ name: 'repl', scope: 'global', command: 'node' }]);
  assert.deepEqual(inv.hooks, ['notify']);
  assert.deepEqual(inv.skills, [{ name: 'grill-me' }, { name: 'imagegen', system: true }]);
  assert.deepEqual(inv.automations, [{ name: 'Digest', schedule: 'Daily · 08:00', status: 'paused' }]);
  assert.ok(!JSON.stringify(inv).includes('SECRET'));
  assert.ok(!JSON.stringify(inv).includes('secret-notify'));
});

test('getInventory(codex): no ~/.codex at all is an empty inventory, not an error', async (t) => {
  const root = await sandbox(t);
  process.env.CODEX_DIR = join(root, 'missing');
  const inv = await getInventory('codex', Date.now() + 40 * MIN);
  assert.deepEqual(inv.plugins, []);
  assert.deepEqual(inv.mcpServers, []);
  assert.deepEqual(inv.skills, []);
  assert.deepEqual(inv.automations, []);
  assert.equal(inv.model, undefined);
});

test('getWorkspaceTasks: Codex plans (thread/turn/PLAN.md), and a merged all-platform list', async (t) => {
  const root = await sandbox(t);
  process.env.CLAUDE_DIR = join(root, '.claude');
  process.env.CODEX_DIR = join(root, '.codex');
  await put(join(root, '.claude', 'plans', 'fix-the-thing.md'), '# Fix the thing\n\nbody');
  await put(
    join(root, '.claude', 'tasks', 'proj', '1.json'),
    JSON.stringify({ id: '1', subject: 'Write tests', status: 'completed' }),
  );
  await put(join(root, '.codex', 'plans', 'thread-a', 'turn-1', 'PLAN.md'), 'intro\n# Codex plan title\n');
  await put(join(root, '.codex', 'plans', 'thread-b', 'turn-2', 'PLAN.md'), 'no heading here');

  const now = Date.now() + 60 * MIN;
  const codex = await getWorkspaceTasks('codex', now);
  assert.equal(codex.tasks.total, 0);
  assert.equal(codex.plans.total, 2);
  assert.deepEqual(codex.plans.items.map((p) => p.title).sort(), ['Codex plan title', 'Untitled plan']);
  assert.ok(codex.plans.items.every((p) => p.platform === undefined));

  const all = await getWorkspaceTasks('all', now);
  assert.equal(all.tasks.total, 1);
  assert.equal(all.tasks.completionRate, 1);
  assert.equal(all.plans.total, 3);
  assert.deepEqual(
    all.plans.items.map((p) => `${p.platform}:${p.title}`).sort(),
    ['claude:Fix the thing', 'codex:Codex plan title', 'codex:Untitled plan'],
  );

  const merged = await getInventory('all', now);
  assert.equal(merged.model, undefined); // two platforms have no single default model
});
