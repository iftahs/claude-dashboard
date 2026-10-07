import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildEntryBody, insertEntry } from './changelog-entry.mjs';

const REPO = 'https://github.com/acme/widget';
const CHANGELOG = [
  '# Changelog',
  '',
  'All notable changes to this project are documented here.',
  '',
  '## [1.0.0] - 2026-01-02',
  '',
  '### Added',
  '- First release.',
  '',
  '## [0.9.0] - 2025-12-01',
  '',
  '### Fixed',
  '- Something.',
  '',
  `[1.0.0]: ${REPO}/releases/tag/v1.0.0`,
  `[0.9.0]: ${REPO}/releases/tag/v0.9.0`,
  '',
].join('\n');

test('maps feat to Added, fix to Fixed and everything else to Changed', () => {
  const body = buildEntryBody([
    'fix: stop the poll while hidden',
    'perf: cache the scan',
    'refactor: split the merge step',
    'docs: describe the cache',
    'style: reformat',
    'test: cover the merge',
    'build: pin node',
    'ci: drop the model step',
    'chore: tidy scripts',
    'revert: the cache change',
    'Tweak the sidebar',
    'feat: add an overview page',
  ]);
  assert.equal(
    body,
    [
      '### Added',
      '- Add an overview page',
      '',
      '### Changed',
      '- Cache the scan',
      '- Split the merge step',
      '- Describe the cache',
      '- Reformat',
      '- Cover the merge',
      '- Pin node',
      '- Drop the model step',
      '- Tidy scripts',
      '- The cache change',
      '- Tweak the sidebar',
      '',
      '### Fixed',
      '- Stop the poll while hidden',
    ].join('\n'),
  );
});

test('omits empty sections', () => {
  assert.equal(buildEntryBody(['fix: one thing']), '### Fixed\n- One thing');
  assert.equal(buildEntryBody(['feat: one thing']), '### Added\n- One thing');
});

test('strips the type and scope, capitalises, drops a trailing period', () => {
  assert.equal(
    buildEntryBody(['feat(ui): motion — running indicators, page entrance, animated surfaces']),
    '### Added\n- Motion — running indicators, page entrance, animated surfaces',
  );
  assert.equal(buildEntryBody(['FIX(scan):  keep the row.']), '### Fixed\n- Keep the row');
  assert.equal(buildEntryBody(['chore: wait for it...']), '### Changed\n- Wait for it...');
});

test('keeps a trailing PR reference', () => {
  assert.equal(buildEntryBody(['fix(api): clamp the window (#123)']), '### Fixed\n- Clamp the window (#123)');
  assert.equal(buildEntryBody(['fix: clamp the window. (#123)']), '### Fixed\n- Clamp the window (#123)');
});

test('keeps every bullet on one line', () => {
  assert.equal(buildEntryBody([], 'fix: one\n\n## [9.9.9] - 2026-01-01\ttwo'), '### Fixed\n- One ## [9.9.9] - 2026-01-01 two');
});

test('leaves a subject without a conventional type intact', () => {
  assert.equal(buildEntryBody(['Sessions: show 20 rows']), '### Changed\n- Sessions: show 20 rows');
  assert.equal(buildEntryBody(['Revert "feat: add x"']), '### Changed\n- Revert "feat: add x"');
});

test('marks breaking changes', () => {
  assert.equal(
    buildEntryBody(['feat(api)!: drop the v1 routes', 'refactor!: rename the cache dir']),
    '### Added\n- **Breaking:** Drop the v1 routes\n\n### Changed\n- **Breaking:** Rename the cache dir',
  );
});

test('skips version bumps, changelog commits, merges and blanks', () => {
  const body = buildEntryBody([
    'chore: bump version to v1.0.1',
    'docs: update changelog for v1.0.1',
    "Merge branch 'main' into feat/x",
    'Merge pull request #45 from acme/redesign',
    '   ',
    'fix: real change',
  ]);
  assert.equal(body, '### Fixed\n- Real change');
});

test('drops duplicates case-insensitively and keeps first-seen order', () => {
  const body = buildEntryBody(['fix: Same thing', 'feat: b', 'fix: same thing', 'FIX: SAME THING.', 'feat: a']);
  assert.equal(body, '### Added\n- B\n- A\n\n### Fixed\n- Same thing');
});

test('falls back to the PR title, mapped by the same rules', () => {
  const noise = ['chore: bump version to v1.0.1', 'Merge branch main'];
  assert.equal(buildEntryBody(noise, 'fix(ci): repair the bump job'), '### Fixed\n- Repair the bump job');
  assert.equal(buildEntryBody([], 'Motion polish'), '### Changed\n- Motion polish');
  assert.equal(buildEntryBody(['feat: real'], 'fix: ignored title'), '### Added\n- Real');
});

test('falls back to the maintenance line with no usable title', () => {
  const expected = '### Changed\n- Internal maintenance and tooling.';
  assert.equal(buildEntryBody([]), expected);
  assert.equal(buildEntryBody([], ''), expected);
  assert.equal(buildEntryBody(undefined, undefined), expected);
  assert.equal(buildEntryBody(['chore: bump version to v2'], 'docs: update changelog'), expected);
});

test('the body never carries a version header, date or link', () => {
  const body = buildEntryBody(['feat: a', 'fix: b', 'chore: c']);
  assert.doesNotMatch(body, /^## /m);
  assert.doesNotMatch(body, /\d{4}-\d{2}-\d{2}/);
  assert.doesNotMatch(body, /releases\/tag/);
});

test('inserts the section above the first version heading', () => {
  const out = insertEntry(CHANGELOG, '1.0.1', '### Fixed\n- A fix', '2026-03-04');
  const at = out.indexOf('## [1.0.1] - 2026-03-04\n\n### Fixed\n- A fix\n\n## [1.0.0] - 2026-01-02');
  assert.notEqual(at, -1);
  assert.equal(out.slice(0, at), CHANGELOG.slice(0, CHANGELOG.indexOf('## [1.0.0]')));
  assert.equal(out.match(/^## \[/gm).length, 3);
});

test('adds the release link above the existing reference lines', () => {
  const out = insertEntry(CHANGELOG, '1.0.1', '### Fixed\n- A fix', '2026-03-04');
  assert.ok(
    out.endsWith(
      `[1.0.1]: ${REPO}/releases/tag/v1.0.1\n[1.0.0]: ${REPO}/releases/tag/v1.0.0\n[0.9.0]: ${REPO}/releases/tag/v0.9.0\n`,
    ),
  );
});

test('adds no release link when the file has none', () => {
  const plain = '# Changelog\n\n## [1.0.0] - 2026-01-02\n\n### Added\n- First release.\n';
  const out = insertEntry(plain, '1.0.1', '### Fixed\n- A fix', '2026-03-04');
  assert.equal(
    out,
    '# Changelog\n\n## [1.0.1] - 2026-03-04\n\n### Fixed\n- A fix\n\n## [1.0.0] - 2026-01-02\n\n### Added\n- First release.\n',
  );
});

test('appends when the file has no version heading yet', () => {
  const out = insertEntry('# Changelog\n\nIntro.\n\n\n', '0.1.0', '### Added\n- First', '2026-03-04');
  assert.equal(out, '# Changelog\n\nIntro.\n\n## [0.1.0] - 2026-03-04\n\n### Added\n- First\n\n');
});

test('defaults the date to today in UTC', () => {
  const today = () => new Date().toISOString().slice(0, 10);
  const before = today();
  const out = insertEntry('# Changelog\n', '0.1.0', '### Added\n- First');
  assert.ok([before, today()].some((date) => out.includes(`## [0.1.0] - ${date}\n`)));
});

test('is idempotent: an existing entry for the version is left alone', () => {
  const once = insertEntry(CHANGELOG, '1.0.1', '### Fixed\n- A fix', '2026-03-04');
  assert.equal(insertEntry(once, '1.0.1', '### Added\n- Something else', '2026-05-06'), once);
  assert.equal(insertEntry(CHANGELOG, '1.0.0', '### Added\n- Rewrite', '2026-05-06'), CHANGELOG);
  // 1.0.1 must not be mistaken for 1.0.10 or 1x0y1
  assert.notEqual(insertEntry(once, '1.0.10', '### Fixed\n- Later', '2026-05-06'), once);
  assert.notEqual(insertEntry('## [1x0y1] - 2026-01-01\n', '1.0.1', '### Fixed\n- A fix', '2026-03-04'), '## [1x0y1] - 2026-01-01\n');
});

test('CLI builds the entry from git log, honours PR_TITLE and is a no-op the second time', () => {
  const cli = fileURLToPath(new URL('./changelog-entry.mjs', import.meta.url));
  const dir = mkdtempSync(join(os.tmpdir(), 'changelog-entry-'));
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const run = (args, env = {}) =>
    execFileSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, PR_TITLE: '', ...env } });
  const commit = (subject) => git('commit', '--allow-empty', '-q', '-m', subject);

  try {
    git('init', '-q');
    writeFileSync(join(dir, 'CHANGELOG.md'), CHANGELOG);
    git('add', 'CHANGELOG.md');
    commit('chore: base');
    git('tag', 'base');

    const empty = run(['--version', '1.0.1', '--base', 'base', '--file', 'TITLE.md'], { PR_TITLE: 'fix(ci): repair the bump job' });
    assert.match(empty, /0 commit\(s\)/);
    assert.match(readFileSync(join(dir, 'TITLE.md'), 'utf8'), /^# Changelog\n\n## \[1\.0\.1\] - \d{4}-\d{2}-\d{2}\n\n### Fixed\n- Repair the bump job\n/);

    commit('feat(ui): motion — running indicators');
    commit('chore: bump version to v1.0.1');
    commit('fix(ci): build the changelog entry from commit subjects');

    const first = run(['--version', '1.0.1', '--base', 'base'], { PR_TITLE: 'feat: ignored title' });
    assert.match(first, /Inserted changelog entry for v1\.0\.1/);
    const written = readFileSync(join(dir, 'CHANGELOG.md'), 'utf8');
    assert.ok(
      written.includes(
        '### Added\n- Motion — running indicators\n\n### Fixed\n- Build the changelog entry from commit subjects\n\n## [1.0.0] - 2026-01-02',
      ),
    );
    assert.ok(written.includes(`[1.0.1]: ${REPO}/releases/tag/v1.0.1\n[1.0.0]:`));
    assert.doesNotMatch(written, /ignored title|bump version/i);

    const second = run(['--version', '1.0.1', '--base', 'base']);
    assert.match(second, /already has an entry for v1\.0\.1; nothing to do/);
    assert.equal(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'), written);

    assert.throws(() => execFileSync(process.execPath, [cli], { cwd: dir, stdio: 'pipe' }));
    assert.throws(() => execFileSync(process.execPath, [cli, '--version', '1.0.2', '--base', 'no-such-ref'], { cwd: dir, stdio: 'pipe' }));
    assert.equal(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'), written);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
