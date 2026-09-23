import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatSystem, sectionSystem, suggestSystem, buildSuggestMessage, type AiPayload } from './ai-context.ts';
import {
  CATALOG, aiSource, catalogFor, codexLimitFields, contributorsDetail, lexicalRoute, loadDatasets, platformOf, rejectionsDetail,
} from './ai-datasets.ts';
import { routerCatalog, routerSystem } from './ai-router.ts';
import type { ContribWindow } from './contributors.ts';
import type { CodexLiveData } from './codex-live.ts';

test('platformOf: Claude surfaces are claude, codex is codex, all is both', () => {
  assert.equal(platformOf('code'), 'claude');
  assert.equal(platformOf('cowork'), 'claude');
  assert.equal(platformOf('claude'), 'claude');
  assert.equal(platformOf('codex'), 'codex');
  assert.equal(platformOf('all'), 'both');
});

test('aiSource: "all" is both only when Codex data exists; a Claude-only install is scoped as Claude', () => {
  assert.equal(aiSource('all', false), 'claude');
  assert.equal(platformOf(aiSource('all', false)), 'claude');
  assert.equal(aiSource('all', true), 'all');
  for (const s of ['code', 'cowork', 'claude', 'codex'] as const) {
    assert.equal(aiSource(s, false), s);
    assert.equal(aiSource(s, true), s);
  }
});

test('commands: unavailable under Codex (Codex records no slash commands or skill runs), Claude-only under both', () => {
  const codex = catalogFor('codex').find((c) => c.id === 'commands')!;
  assert.match(codex.unavailable ?? '', /Codex records neither slash commands nor skill runs/);
  assert.doesNotMatch(codex.describes, /Codex threads/);
  const both = catalogFor('all').find((c) => c.id === 'commands')!;
  assert.equal(both.unavailable, undefined);
  assert.match(both.describes, /CLAUDE CODE ONLY/);
});

test('lexicalRoute: Codex "thread" questions reach the sessions dataset', () => {
  for (const q of ['Which thread used the most tokens?', 'What was my most expensive Codex thread?', 'Show my top threads by cost']) {
    assert.ok(lexicalRoute(q).includes('sessions'), q);
  }
});

test('router: the model router gets the scope\'s own catalog and product name', () => {
  const codex = routerCatalog('codex');
  const ids = codex.map((c) => c.id);
  assert.ok(!ids.includes('workflows') && !ids.includes('commands'));
  assert.ok(codex.every((c) => !/CLI conversations|Claude CLI|Task subagents/.test(c.describes)));
  assert.match(codex.find((c) => c.id === 'sessions')!.describes, /Codex threads/);
  assert.match(routerSystem('codex'), /Codex/);
  assert.doesNotMatch(routerSystem('codex'), /Claude Code usage dashboard/);
  assert.match(routerSystem('claude'), /a Claude Code usage dashboard/);
  assert.deepEqual(routerCatalog('code'), CATALOG);
});

test('rejections: Codex and both split user declines from Guardian denials; Claude keeps the total alone', () => {
  const r = { total: 6, guardianDenials: 5, userDeclines: 1, perTool: [{ name: 'GuardianReview', calls: 9, rejections: 5 }] };
  const codex = rejectionsDetail(r, 'codex', 10);
  assert.equal(codex.total, 6);
  assert.equal(codex.guardianDenials, 5);
  assert.equal(codex.userDeclines, 1);
  assert.equal(rejectionsDetail(r, 'both', 10).guardianDenials, 5);
  assert.deepEqual(Object.keys(rejectionsDetail(r, 'claude', 10)).sort(), ['perTool', 'total']);
  assert.match(catalogFor('codex').find((c) => c.id === 'rejections')!.describes, /Guardian denial is NOT a user rejection/);
  assert.match(chatSystem('codex'), /guardianDenials/);
});

test('contributors: a Codex breakdown is labelled effective-token-weighted, never cost-weighted', () => {
  const w: ContribWindow = {
    totalCost: 76.81, requestCount: 10, sessionCount: 2,
    behaviors: [{ key: 'cron', headline: 'h', body: 'b', pct: 82 }],
    subagents: [{ name: 'guardian_review', pct: 1 }], mcpServers: [], skills: [], plugins: [],
  };
  const codex = contributorsDetail({ day: w, week: w, weight: 'effectiveTokens' }, 5);
  assert.equal(codex.weight, 'effectiveTokens');
  assert.match(codex.weightNote, /EFFECTIVE TOKENS, not of cost/);
  assert.equal(codex.week.behaviors[0].pct, 82);
  assert.match(contributorsDetail({ day: w, week: w, weight: 'cost' }, 5).weightNote, /estimated cost/);
  assert.doesNotMatch(catalogFor('codex').find((c) => c.id === 'contributors')!.describes, /cost-weighted/);
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
  assert.ok(codex.find((c) => c.id === 'retries')?.unavailable, 'Codex patches have no one-shot rate');
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

test('retries under Codex is unavailable, never a vacuous 100% one-shot rate', async () => {
  const out = await loadDatasets(['retries'], { days: 30, source: 'codex', limit: 10, redact: false });
  assert.deepEqual(Object.keys(out.retries as object), ['unavailable']);
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
