import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedHosts, hostHeaderName, originHostname, checkRequest, publicSettings } from './http-guard.ts';

const LOCAL = allowedHosts(undefined);

const get = (host: string | undefined) => ({ method: 'GET', host, origin: undefined, contentType: undefined });
const post = (over: { host?: string; origin?: string; contentType?: string } = {}) => ({
  method: 'POST',
  host: 'localhost:8787',
  origin: undefined as string | undefined,
  contentType: 'application/json' as string | undefined,
  ...over,
});

test('Host header parsing strips the port and IPv6 brackets', () => {
  assert.equal(hostHeaderName('localhost:5180'), 'localhost');
  assert.equal(hostHeaderName('LOCALHOST'), 'localhost');
  assert.equal(hostHeaderName('127.0.0.1:8787'), '127.0.0.1');
  assert.equal(hostHeaderName('[::1]:8787'), '::1');
  assert.equal(hostHeaderName('[::1]'), '::1');
  assert.equal(hostHeaderName('::1'), '::1');
  assert.equal(hostHeaderName('localhost.:8787'), 'localhost');
  assert.equal(hostHeaderName(undefined), null);
  assert.equal(hostHeaderName(''), null);
  assert.equal(hostHeaderName('[::1'), null);
});

test('Origin parsing', () => {
  assert.equal(originHostname('http://localhost:5180'), 'localhost');
  assert.equal(originHostname('http://[::1]:8787'), '::1');
  assert.equal(originHostname('https://Evil.Example'), 'evil.example');
  assert.equal(originHostname('null'), null);
  assert.equal(originHostname(''), null);
});

test('loopback names are always allowed; ALLOWED_HOSTS adds more', () => {
  assert.deepEqual([...LOCAL].sort(), ['127.0.0.1', '::1', 'localhost']);
  const lan = allowedHosts(' 192.168.1.20, My-Desktop.local. ,,[fe80::1]');
  assert.ok(lan.has('192.168.1.20'));
  assert.ok(lan.has('my-desktop.local'));
  assert.ok(lan.has('fe80::1'));
  assert.ok(lan.has('localhost'));
  assert.equal(lan.has(''), false);
});

test('Host check: loopback passes, a rebinding hostname is refused', () => {
  assert.equal(checkRequest(get('localhost:8787'), LOCAL), null);
  // The Vite dev proxy forwards the browser's Host unchanged.
  assert.equal(checkRequest(get('localhost:5180'), LOCAL), null);
  assert.equal(checkRequest(get('127.0.0.1:8788'), LOCAL), null);
  assert.equal(checkRequest(get('[::1]:8787'), LOCAL), null);

  assert.equal(checkRequest(get('evil.example:8787'), LOCAL)?.status, 403);
  assert.equal(checkRequest(get('localhost.evil.example'), LOCAL)?.status, 403);
  assert.equal(checkRequest(get('0.0.0.0:8787'), LOCAL)?.status, 403);
  assert.equal(checkRequest(get('192.168.1.20:8787'), LOCAL)?.status, 403);
  assert.equal(checkRequest(get(undefined), LOCAL)?.status, 403);

  const lan = allowedHosts('192.168.1.20');
  assert.equal(checkRequest(get('192.168.1.20:8787'), lan), null);
});

test('writes need a JSON body', () => {
  assert.equal(checkRequest(post(), LOCAL), null);
  assert.equal(checkRequest(post({ contentType: 'application/json; charset=utf-8' }), LOCAL), null);
  assert.equal(checkRequest(post({ contentType: 'Application/JSON' }), LOCAL), null);

  // The three content types a cross-site <form> can send without a preflight.
  for (const ct of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x']) {
    assert.equal(checkRequest(post({ contentType: ct }), LOCAL)?.status, 415, ct);
  }
  assert.equal(checkRequest(post({ contentType: undefined }), LOCAL)?.status, 415);
  // Every unsafe method, not just POST.
  assert.equal(checkRequest({ ...post({ contentType: 'text/plain' }), method: 'delete' }, LOCAL)?.status, 415);
});

test('writes with an Origin must come from an allowed hostname', () => {
  assert.equal(checkRequest(post({ origin: 'http://localhost:5180' }), LOCAL), null);
  assert.equal(checkRequest(post({ origin: 'http://127.0.0.1:8787' }), LOCAL), null);
  assert.equal(checkRequest(post({ origin: 'https://evil.example' }), LOCAL)?.status, 403);
  assert.equal(checkRequest(post({ origin: 'null' }), LOCAL)?.status, 403);
  // Reads never look at Origin (the Host check already covers them).
  assert.equal(checkRequest({ ...get('localhost'), origin: 'https://evil.example' }, LOCAL), null);
});

test('the Host check runs before the write rules', () => {
  const r = checkRequest(post({ host: 'evil.example', origin: 'http://localhost' }), LOCAL);
  assert.equal(r?.status, 403);
  assert.match(r!.error, /Host/);
});

test('publicSettings keeps only the fields the UI renders', () => {
  const settings = {
    model: 'opus',
    effortLevel: 'high',
    autoUpdatesChannel: 'stable',
    voiceEnabled: true,
    remoteControlAtStartup: false,
    inputNeededNotifEnabled: true,
    agentPushNotifEnabled: false,
    env: { ANTHROPIC_API_KEY: 'sk-ant-secret', ANTHROPIC_AUTH_TOKEN: 'tok-secret' },
    apiKeyHelper: '/usr/local/bin/print-key --secret',
    hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'curl -H "Authorization: Bearer x" …' }] }] },
    awsAuthRefresh: 'aws sso login',
    otelHeadersHelper: '/bin/otel-headers',
    enabledPlugins: { 'a@m': true, 'b@m': false, 'c@m': { token: 'plugin-secret' } },
    extraKnownMarketplaces: { m: { source: { source: 'git', url: 'https://user:pat@git.example/m.git' } } },
    permissions: {
      defaultMode: 'acceptEdits',
      allow: ['Bash(git status)', 42],
      deny: ['Read(./.env)'],
      additionalDirectories: ['/work/repo'],
    },
  };
  const out = publicSettings(settings);
  assert.deepEqual(out, {
    model: 'opus',
    effortLevel: 'high',
    autoUpdatesChannel: 'stable',
    voiceEnabled: true,
    remoteControlAtStartup: false,
    inputNeededNotifEnabled: true,
    agentPushNotifEnabled: false,
    // Truthiness is kept (the UI counts truthy entries), the value itself is not.
    enabledPlugins: { 'a@m': true, 'b@m': false, 'c@m': true },
    extraKnownMarketplaces: { m: true },
    permissions: { defaultMode: 'acceptEdits', allow: ['Bash(git status)'], additionalDirectories: ['/work/repo'] },
  });
  const json = JSON.stringify(out);
  for (const secret of ['sk-ant-secret', 'tok-secret', 'print-key', 'Authorization', 'pat@', 'aws sso', 'otel', 'plugin-secret']) {
    assert.equal(json.includes(secret), false, secret);
  }
});

test('publicSettings tolerates a missing or malformed settings.json', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(publicSettings(null))), {});
  assert.deepEqual(JSON.parse(JSON.stringify(publicSettings('oops'))), {});
  assert.deepEqual(JSON.parse(JSON.stringify(publicSettings({ model: 5, permissions: [] }))), {});
});
