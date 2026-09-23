import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  commandBasename,
  describeRrule,
  projectAutomation,
  projectCodexConfig,
  scanToml,
  tomlString,
} from './codex-config.ts';

// A synthetic config.toml in the shape the ChatGPT desktop app writes, with a
// secret in every place the projection must never read.
const CONFIG = `
model = "gpt-test-1"
model_reasoning_effort = "high" # trailing comment
personality = 'pragmatic'
approval_policy = "on-request"
sandbox_mode = "workspace-write"
service_tier = "default"
notify = [
  "powershell",
  "-File", "C:\\\\secret\\\\notify.ps1",
]
instructions = """
multi-line text with = signs
[not.a.table]
"""

[marketplaces.openai-bundled]
source_type = "local"
source = 'C:\\Users\\someone\\bundled'

[marketplaces."third-party"]
source = "https://example.invalid/market"

[plugins."documents@openai-primary-runtime"]
enabled = true

[plugins."github@openai-curated"]
enabled = false

[plugins."bare@openai-bundled"]

[projects.'c:\\users\\someone\\secret-project']
trust_level = "trusted"

[projects.'e:\\work\\other']
trust_level = "untrusted"

[projects."/home/u/third"]
trust_level = "trusted"

[mcp_servers.node_repl]
args = ["--token", "SECRET-ARG"]
command = 'C:\\Program Files\\nodejs\\node.exe'
env_vars = ["API_KEY"]

[mcp_servers.node_repl.env]
TOKEN = "SECRET-ENV"

[mcp_servers]
inline = { args = ["x"], command = "/usr/local/bin/npx", env = { KEY = "SECRET-INLINE" } }

[shell_environment_policy.set]
HASH = "SECRET-HASH"

[[profiles.list]]
model = "not-top-level"
`;

test('projectCodexConfig: allowlisted top-level keys, plugins, marketplaces, MCP names, trust counts', () => {
  const c = projectCodexConfig(CONFIG);
  assert.equal(c.available, true);
  assert.equal(c.model, 'gpt-test-1');
  assert.equal(c.reasoningEffort, 'high');
  assert.equal(c.personality, 'pragmatic');
  assert.equal(c.approvalPolicy, 'on-request');
  assert.equal(c.sandboxMode, 'workspace-write');
  assert.equal(c.serviceTier, 'default');
  assert.equal(c.notify, true);
  assert.deepEqual(c.plugins, [
    { name: 'bare', marketplace: 'openai-bundled', enabled: true },
    { name: 'documents', marketplace: 'openai-primary-runtime', enabled: true },
    { name: 'github', marketplace: 'openai-curated', enabled: false },
  ]);
  assert.deepEqual(c.marketplaces, ['openai-bundled', 'third-party']);
  assert.deepEqual(c.mcpServers, [
    { name: 'inline', command: 'npx' },
    { name: 'node_repl', command: 'node.exe' },
  ]);
  assert.deepEqual(c.projects, { trusted: 2, untrusted: 1, total: 3 });
});

test('projectCodexConfig: never carries env, args, tokens, sources or project paths', () => {
  const json = JSON.stringify(projectCodexConfig(CONFIG));
  for (const secret of ['SECRET', 'notify.ps1', 'secret-project', 'someone', 'example.invalid', 'Program Files', 'API_KEY', 'not-top-level']) {
    assert.ok(!json.includes(secret), `leaked ${secret}`);
  }
});

test('projectCodexConfig: empty and malformed input degrade to empty, never throw', () => {
  const empty = projectCodexConfig('');
  assert.equal(empty.model, null);
  assert.deepEqual(empty.plugins, []);
  const junk = projectCodexConfig('model = \n= "x"\n"unterminated = 1\nmodel_reasoning_effort = "low"\n[broken\nservice_tier = "flex"\n');
  assert.equal(junk.reasoningEffort, 'low');
  assert.equal(junk.model, null);
  // Keys after a broken header belong to no table we know — never to the top level.
  assert.equal(junk.serviceTier, null);
});

test('scanToml: a multi-line string or array hides its contents from the table walk', () => {
  const tables: string[] = [];
  const keys: string[] = [];
  scanToml('a = """\n[fake]\nb = 1\n"""\nc = [\n "[x]", # comment ]\n 2,\n]\n[real]\nd = 1\n', {
    table: (p) => tables.push(p.join('.')),
    entry: (p) => keys.push(p.join('.')),
  });
  assert.deepEqual(tables, ['real']);
  assert.deepEqual(keys, ['a', 'c', 'real.d']);
});

test('tomlString decodes basic escapes and literal strings; rejects non-strings', () => {
  assert.equal(tomlString('"a\\tb\\u00e9"'), 'a\tbé');
  assert.equal(tomlString("'C:\\raw'"), 'C:\\raw');
  assert.equal(tomlString('42'), null);
  assert.equal(tomlString('"""x"""'), null);
});

test('commandBasename keeps only the program name', () => {
  assert.equal(commandBasename('C:\\tools\\node.exe'), 'node.exe');
  assert.equal(commandBasename('C:\\Program Files\\nodejs\\node.exe'), 'node.exe');
  assert.equal(commandBasename('/usr/bin/npx --yes'), 'npx');
  assert.equal(commandBasename("curl -H 'Authorization: Bearer abc/def'"), 'curl');
  assert.equal(commandBasename(''), null);
  assert.equal(commandBasename(null), null);
});

test('describeRrule: weekly/daily rules read as short labels', () => {
  assert.equal(describeRrule('RRULE:FREQ=WEEKLY;BYDAY=SU;BYHOUR=9;BYMINUTE=0;BYSECOND=0'), 'Weekly · Sun 09:00');
  assert.equal(describeRrule('FREQ=DAILY;BYHOUR=7;BYMINUTE=30'), 'Daily · 07:30');
  assert.equal(describeRrule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR'), 'Every 2 weeks · Mon, Fri');
  assert.equal(describeRrule('FREQ=HOURLY'), 'Hourly');
  assert.equal(describeRrule(null), 'unscheduled');
});

test('projectAutomation: name, status and schedule only — never the prompt', () => {
  const a = projectAutomation(
    'version = 1\nkind = "heartbeat"\nname = "Weekly digest"\nprompt = "PRIVATE PROMPT TEXT"\nstatus = "ACTIVE"\nrrule = "RRULE:FREQ=WEEKLY;BYDAY=SU;BYHOUR=9;BYMINUTE=0"\ntarget_thread_id = "thread-1"\n',
    'automation',
  );
  assert.deepEqual(a, { name: 'Weekly digest', schedule: 'Weekly · Sun 09:00', status: 'active' });
  assert.ok(!JSON.stringify(a).includes('PRIVATE'));
  assert.equal(projectAutomation('', 'fallback-dir').name, 'fallback-dir');
});
