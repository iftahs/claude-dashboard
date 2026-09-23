import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

// A stand-in `claude` first on PATH — no model is ever called. It answers with
// its own argv, cwd and stdin, or fails the way a CLI that doesn't know one of
// the flags in FAKE_CLAUDE_REJECT does. On Windows it is reached through the
// same `cmd /c claude` + .cmd shim path as the real CLI.
const bin = mkdtempSync(join(tmpdir(), 'fake-claude-'));
writeFileSync(
  join(bin, 'fake.cjs'),
  `
const args = process.argv.slice(2);
if (args[0] === '--version') { process.stdout.write('0.0.0 (fake)\\n'); process.exit(0); }
const reject = (process.env.FAKE_CLAUDE_REJECT || '').split(',').filter(Boolean);
const bad = args.find((a) => reject.includes(a));
if (bad) { process.stderr.write("error: unknown option '" + bad + "'\\n"); process.exit(1); }
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => process.stdout.write(JSON.stringify({ args, cwd: process.cwd(), input })));
`,
);
writeFileSync(join(bin, 'claude.cmd'), '@node "%~dp0fake.cjs" %*\r\n');
writeFileSync(join(bin, 'claude'), '#!/bin/sh\nexec node "$(dirname "$0")/fake.cjs" "$@"\n');
chmodSync(join(bin, 'claude'), 0o755);
process.env.PATH = `${bin}${delimiter}${process.env.PATH ?? ''}`;
// Server-env keys would win over the CLI backend.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

const { AiUnavailableError, claudeCliAvailable, runAi, runAiStream } = await import('./ai.ts');

after(() => rmSync(bin, { recursive: true, force: true }));

interface Seen { args: string[]; cwd: string; input: string }

async function ask(): Promise<Seen> {
  const { text, backend } = await runAi({ system: 'SYS', user: 'USER' });
  assert.equal(backend, 'cli');
  return JSON.parse(text);
}

/** `--tools` must be followed by the empty string: "disable all tools". */
function toolsValue(args: string[]): string | undefined {
  const i = args.indexOf('--tools');
  return i < 0 ? undefined : args[i + 1];
}

test('the CLI runs tool-less, MCP-less and outside any project', async () => {
  const seen = await ask();
  assert.equal(toolsValue(seen.args), '', 'the empty-string arg survives the shim');
  for (const flag of ['--print', '--strict-mcp-config', '--safe-mode', '--no-session-persistence']) {
    assert.ok(seen.args.includes(flag), flag);
  }
  assert.ok(!seen.args.includes('--bare'), '--bare would force API-key auth');
  assert.equal(realpathSync(seen.cwd), realpathSync(tmpdir()));
  assert.equal(seen.input, 'SYS\n\nUSER', 'the prompt goes in over stdin');

  let streamed = '';
  const backend = await runAiStream({ system: 'SYS', user: 'USER' }, null, {
    onStart: () => {},
    onDelta: (t) => (streamed += t),
  });
  assert.equal(backend, 'cli');
  const s: Seen = JSON.parse(streamed);
  assert.equal(toolsValue(s.args), '');
  assert.ok(s.args.includes('--strict-mcp-config'));
  assert.equal(realpathSync(s.cwd), realpathSync(tmpdir()));
});

test('an optional flag the CLI rejects is dropped for good; the required ones stay', async () => {
  process.env.FAKE_CLAUDE_REJECT = '--safe-mode';
  try {
    const seen = await ask();
    assert.ok(!seen.args.includes('--safe-mode'));
    assert.equal(toolsValue(seen.args), '');
    assert.ok(seen.args.includes('--strict-mcp-config'));
    assert.ok(seen.args.includes('--no-session-persistence'));
  } finally {
    delete process.env.FAKE_CLAUDE_REJECT;
  }
  assert.ok(!(await ask()).args.includes('--safe-mode'), 'not retried on every call');
});

test('a CLI that rejects --tools fails closed and is never used again', async () => {
  process.env.FAKE_CLAUDE_REJECT = '--tools';
  try {
    await assert.rejects(runAi({ system: 'SYS', user: 'USER' }), (e: unknown) => {
      assert.ok(e instanceof AiUnavailableError);
      assert.match((e as Error).message, /--tools/);
      return true;
    });
  } finally {
    delete process.env.FAKE_CLAUDE_REJECT;
  }
  assert.equal(await claudeCliAvailable(), false);
});
