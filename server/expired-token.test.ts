import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expiredTokenAdvice } from './scan.ts';

const MAC_SYNC = /npm run token-sync/;
const RUN_CLAUDE = /run any Claude Code command \(e\.g\. `claude`\) on this computer/;

test('every variant says "expired" (the frontend classifies the state by it)', () => {
  for (const docker of [false, true]) {
    for (const hostOs of [undefined, 'darwin', 'win32', 'linux']) {
      for (const macCache of [false, true]) {
        assert.match(expiredTokenAdvice(docker, hostOs, macCache), /expired/);
      }
    }
  }
});

test('on the host: run Claude Code in the terminal, never the Docker sync', () => {
  const msg = expiredTokenAdvice(false, undefined, true);
  assert.match(msg, /run any Claude Code command in your terminal/);
  assert.doesNotMatch(msg, MAC_SYNC);
});

test('Docker on a macOS host: re-sync the Keychain snapshot', () => {
  assert.match(expiredTokenAdvice(true, 'darwin', false), MAC_SYNC);
  assert.doesNotMatch(expiredTokenAdvice(true, 'darwin', false), RUN_CLAUDE);
});

test('Docker on Windows / Linux: run claude on the host, no macOS-only commands', () => {
  for (const os of ['win32', 'linux']) {
    const msg = expiredTokenAdvice(true, os, false);
    assert.match(msg, RUN_CLAUDE);
    assert.match(msg, /\.credentials\.json/);
    assert.doesNotMatch(msg, MAC_SYNC);
    assert.doesNotMatch(msg, /Mac/);
  }
});

test('a known non-mac HOST_OS outranks a leftover Keychain snapshot', () => {
  assert.doesNotMatch(expiredTokenAdvice(true, 'win32', true), MAC_SYNC);
});

test('HOST_OS unset: the Keychain snapshot marks a Mac host, else both fixes are offered', () => {
  const mac = expiredTokenAdvice(true, undefined, true);
  assert.match(mac, MAC_SYNC);
  assert.doesNotMatch(mac, RUN_CLAUDE);

  const unknown = expiredTokenAdvice(true, undefined, false);
  assert.match(unknown, RUN_CLAUDE);
  assert.match(unknown, MAC_SYNC);
});
