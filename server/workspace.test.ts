import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claudeJsonPath, getInventory } from './workspace.ts';

test('claudeJsonPath: host default is .claude.json beside the .claude dir', () => {
  assert.equal(claudeJsonPath(join('home', 'u', '.claude'), {}), join('home', 'u', '.claude.json'));
});

test('claudeJsonPath: CLAUDE_JSON (the Docker mount) wins; blank falls back', () => {
  assert.equal(claudeJsonPath('/data/.claude', { CLAUDE_JSON: '/data/claude-json' }), '/data/claude-json');
  assert.equal(claudeJsonPath(join('data', '.claude'), { CLAUDE_JSON: '  ' }), join('data', '.claude.json'));
});

test('getInventory reads MCP servers from CLAUDE_JSON, and treats a directory there as absent', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dash-ws-'));
  const saved = { CLAUDE_DIR: process.env.CLAUDE_DIR, CLAUDE_JSON: process.env.CLAUDE_JSON };
  t.after(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await rm(root, { recursive: true, force: true });
  });

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
  const inv = await getInventory(now);
  assert.deepEqual(inv.mcpServers, [
    { name: 'alpha', scope: 'global' },
    { name: 'beta', scope: 'project' },
  ]);

  // Compose fallback with CLAUDE_JSON_HOST unset: a directory is mounted there.
  const dirMount = join(root, 'claude-json-dir');
  await mkdir(dirMount);
  process.env.CLAUDE_JSON = dirMount;
  const later = await getInventory(now + 10 * 60_000); // past the 60 s cache
  assert.deepEqual(later.mcpServers, []);
});
