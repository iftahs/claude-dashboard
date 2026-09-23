import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatSystem, sectionSystem, suggestSystem, buildSuggestMessage, type AiPayload } from './ai-context.ts';
import { CATALOG, catalogFor, codexLimitFields, platformOf } from './ai-datasets.ts';
import type { CodexLiveData } from './codex-live.ts';

test('platformOf: Claude surfaces are claude, codex is codex, all is both', () => {
  assert.equal(platformOf('code'), 'claude');
  assert.equal(platformOf('cowork'), 'claude');
  assert.equal(platformOf('claude'), 'claude');
  assert.equal(platformOf('codex'), 'codex');
  assert.equal(platformOf('all'), 'both');
});

test('chatSystem(codex): answers Codex / OpenAI questions and never speaks Claude Code', () => {
  const p = chatSystem('codex');
  assert.match(p, /General questions about Codex/);
  assert.match(p, /OpenAI/);
  assert.doesNotMatch(p, /Claude Code usage dashboard/);
  assert.doesNotMatch(p, /general Claude \/ Claude Code questions/);
  assert.doesNotMatch(p, /subagent" is a Task spawn/);
});

test('chatSystem(claude) keeps the Claude scope; both covers both providers', () => {
  const claude = chatSystem('claude');
  assert.match(claude, /personal Claude Code usage dashboard/);
  assert.match(claude, /Anthropic API/);
  assert.doesNotMatch(claude, /OpenAI/);
  const both = chatSystem('all');
  assert.match(both, /Claude Code and Codex/);
  assert.match(both, /Anthropic/);
  assert.match(both, /OpenAI/);
});

test('sectionSystem: platform-neutral without a source, platform-worded with one', () => {
  assert.match(sectionSystem(), /an AI coding-assistant usage dashboard/);
  assert.doesNotMatch(sectionSystem('codex'), /Claude/);
  assert.match(sectionSystem('code'), /Claude Code usage dashboard/);
});

test('suggestSystem(codex) never proposes workflow questions', () => {
  assert.doesNotMatch(suggestSystem('codex'), /workflow/);
  assert.match(suggestSystem('claude'), /"workflow"/);
});

test('catalogFor: workflows are unavailable under Codex; Codex wording has no Claude vocabulary', () => {
  const codex = catalogFor('codex');
  assert.equal(codex.length, CATALOG.length);
  const wf = codex.find((c) => c.id === 'workflows');
  assert.ok(wf?.unavailable, 'workflows flagged unavailable');
  for (const id of ['limits', 'subagents', 'contributors', 'plugins', 'sessions'] as const) {
    const c = codex.find((x) => x.id === id);
    assert.doesNotMatch(c!.describes, /Anthropic|Claude CLI|Task subagents/, id);
  }
  assert.match(codex.find((c) => c.id === 'limits')!.describes, /OpenAI/);
  // Claude scope: the original catalog, nothing unavailable.
  const claude = catalogFor('code');
  assert.deepEqual(
    claude.map((c) => ({ id: c.id, describes: c.describes })),
    CATALOG,
  );
  assert.ok(claude.every((c) => !c.unavailable));
});

test('buildSuggestMessage lists only datasets askable on the scope', () => {
  const payload = {
    scope: { source: 'codex', platform: 'codex', windowDays: 30, from: '', to: '', note: '' },
    account: {},
    catalog: catalogFor('codex').map((c) => ({ ...c, loaded: false })),
  } as unknown as AiPayload;
  const msg = buildSuggestMessage(payload, [{ role: 'user', content: 'hi' }]);
  assert.ok(!msg.includes('"workflows"'));
  assert.ok(msg.includes('"limits"'));
});

test('codexLimitFields: Codex windows in the Claude field names, no PII', () => {
  const live: CodexLiveData = {
    planType: 'plus',
    fiveHour: { usedPct: 38, windowSec: 18000, resetsAt: '2026-09-23T05:00:00Z' },
    weekly: { usedPct: 100, windowSec: 604800, resetsAt: '2026-09-27T00:00:00Z' },
    limitReached: true,
    credits: { hasCredits: false, unlimited: false, balance: '0', overageLimitReached: false },
    resetCredits: null,
    modelAvailability: {},
    origin: 'live',
    snapshotAt: null,
  };
  const f = codexLimitFields(live);
  assert.equal(f.fiveHourPct, 38);
  assert.equal(f.sevenDayPct, 100);
  assert.equal(f.sevenDayResetsAt, '2026-09-27T00:00:00Z');
  assert.equal(f.limitReached, true);
  assert.equal(f.planType, 'plus');
  assert.match(f.provider, /OpenAI/);
});
