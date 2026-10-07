#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SECTIONS = ['Added', 'Changed', 'Fixed'];
const SECTION_OF = { feat: 'Added', fix: 'Fixed' };
const TYPES = new Set(['feat', 'fix', 'perf', 'refactor', 'docs', 'style', 'test', 'build', 'ci', 'chore', 'revert']);
const NOISE = [/^Merge /, /^chore: bump version/i, /^docs: update changelog/i];
const PREFIX = /^([a-z]+)(?:\([^)]*\))?(!)?:\s*(.*)$/i;
const FALLBACK_BODY = '### Changed\n- Internal maintenance and tooling.';

function toItem(raw) {
  const subject = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!subject || NOISE.some((re) => re.test(subject))) return null;

  const m = PREFIX.exec(subject);
  const type = m && TYPES.has(m[1].toLowerCase()) ? m[1].toLowerCase() : '';
  let text = (type ? m[3] : subject).trim();

  let pr = '';
  const ref = /\s*(\(#\d+\))$/.exec(text);
  if (ref) {
    pr = ` ${ref[1]}`;
    text = text.slice(0, ref.index);
  }
  // one trailing period only: an ellipsis stays
  text = text.replace(/(?<!\.)\.$/, '').trimEnd();
  if (!text) return null;

  text = text.charAt(0).toUpperCase() + text.slice(1) + pr;
  if (type && m[2]) text = `**Breaking:** ${text}`;
  return { section: SECTION_OF[type] ?? 'Changed', text };
}

function collect(subjects) {
  const seen = new Set();
  const items = [];
  for (const subject of subjects) {
    const item = toItem(subject);
    if (!item) continue;
    const key = `${item.section}\n${item.text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

export function buildEntryBody(subjects, fallbackTitle = '') {
  let items = collect(subjects ?? []);
  if (items.length === 0) items = collect([fallbackTitle]);
  if (items.length === 0) return FALLBACK_BODY;

  return SECTIONS.map((section) => {
    const bullets = items.filter((item) => item.section === section).map((item) => `- ${item.text}`);
    return bullets.length ? `### ${section}\n${bullets.join('\n')}` : '';
  })
    .filter(Boolean)
    .join('\n\n');
}

function hasEntry(changelog, version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^## \\[${escaped}\\]`, 'm').test(changelog);
}

function utcDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function insertEntry(changelog, version, body, date = utcDate()) {
  if (hasEntry(changelog, version)) return changelog;

  let md = changelog;
  const section = `## [${version}] - ${date}\n\n${body.trim()}\n\n`;

  const idx = md.search(/^## \[/m);
  md = idx === -1 ? md.trimEnd() + '\n\n' + section : md.slice(0, idx) + section + md.slice(idx);

  const ref = md.match(/^\[(\d+\.\d+\.\d+)\]:\s*(\S+)\/releases\/tag\/v\1\s*$/m);
  if (ref) {
    const line = `[${version}]: ${ref[2]}/releases/tag/v${version}\n`;
    const first = md.search(/^\[\d+\.\d+\.\d+\]:/m);
    md = md.slice(0, first) + line + md.slice(first);
  }
  return md;
}

function commitSubjects(base) {
  const out = execFileSync('git', ['log', `${base}..HEAD`, '--no-merges', '--reverse', '--pretty=%s'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return out.split('\n').map((line) => line.trim()).filter(Boolean);
}

function main() {
  const usage = 'Usage: node scripts/changelog-entry.mjs --version <x.y.z> [--base origin/main] [--file CHANGELOG.md]  (PR title: $PR_TITLE)';
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        version: { type: 'string' },
        base: { type: 'string', default: 'origin/main' },
        file: { type: 'string', default: 'CHANGELOG.md' },
      },
    }));
  } catch (err) {
    console.error(`${err.message}\n${usage}`);
    process.exit(1);
  }

  const { version, base, file } = values;
  if (!version || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version) || base.startsWith('-')) {
    console.error(usage);
    process.exit(1);
  }

  const before = existsSync(file) ? readFileSync(file, 'utf8') : '# Changelog\n';
  if (hasEntry(before, version)) {
    console.log(`${file} already has an entry for v${version}; nothing to do.`);
    return;
  }

  let subjects;
  try {
    subjects = commitSubjects(base);
  } catch {
    console.error(`Could not read commits with: git log ${base}..HEAD`);
    process.exit(1);
  }
  const body = buildEntryBody(subjects, process.env.PR_TITLE ?? '');
  writeFileSync(file, insertEntry(before, version, body));
  console.log(`Inserted changelog entry for v${version} into ${file} (${subjects.length} commit(s) since ${base}):\n\n${body}`);
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    const self = realpathSync(fileURLToPath(import.meta.url));
    const entry = realpathSync(resolve(process.argv[1]));
    return process.platform === 'win32' ? self.toLowerCase() === entry.toLowerCase() : self === entry;
  } catch {
    return false;
  }
}

if (isMain()) main();
