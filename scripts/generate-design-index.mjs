import { realpathSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const TIERS = [
  { dir: 'atoms', heading: 'Atoms', level: 'Atom' },
  { dir: 'molecules', heading: 'Molecules', level: 'Molecule' },
  { dir: 'organisms', heading: 'Organisms', level: 'Organism' },
  { dir: 'templates', heading: 'Templates', level: 'Template' },
];

export const DESIGN_SYSTEM_DIR = 'src/components/design-system';
export const INDEX_FILE = `${DESIGN_SYSTEM_DIR}/design.md`;
export const REGENERATE_HINT = 'run node scripts/generate-design-index.mjs';

const GENERATED_START = '<!-- generated:start -->';
const GENERATED_END = '<!-- generated:end -->';
const USAGE = 'Usage: node scripts/generate-design-index.mjs [--check] [--root <project-dir>]';

export function defaultRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export function parseCli(argv, booleanFlags) {
  const flags = new Set();
  let root = defaultRoot();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      i += 1;
      if (!argv[i]) throw new Error('--root needs a directory');
      root = path.resolve(argv[i]);
    } else if (arg.startsWith('--root=')) {
      root = path.resolve(arg.slice('--root='.length));
    } else if (arg.startsWith('--') && booleanFlags.includes(arg.slice(2))) {
      flags.add(arg.slice(2));
    } else {
      throw new Error(`unknown argument "${arg}"`);
    }
  }
  return { root, flags };
}

export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  try {
    const invoked = realpathSync(process.argv[1]);
    const self = realpathSync(fileURLToPath(metaUrl));
    return process.platform === 'win32' ? invoked.toLowerCase() === self.toLowerCase() : invoked === self;
  } catch {
    return false;
  }
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch (err) {
    if (err && err.code === 'ENOENT') return false;
    throw err;
  }
}

async function listComponentFolders(tierPath) {
  let entries;
  try {
    entries = await readdir(tierPath, { withFileTypes: true });
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return [];
    throw err;
  }
  const names = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folder = path.join(tierPath, entry.name);
    const hasSource = await pathExists(path.join(folder, `${entry.name}.tsx`));
    const hasDoc = await pathExists(path.join(folder, `${entry.name}.md`));
    if (hasSource || hasDoc) names.push(entry.name);
  }
  return names.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
}

export function extractPurpose(content) {
  const lines = content.split(/\r\n|\r|\n/);
  const marker = '**Purpose:**';
  const markerIndex = lines.findIndex((line) => line.includes(marker));
  if (markerIndex === -1) return null;
  const first = lines[markerIndex];
  const parts = [first.slice(first.indexOf(marker) + marker.length).trim()];
  for (let i = markerIndex + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0 || trimmed.startsWith('#') || trimmed.startsWith('**')) break;
    parts.push(trimmed);
  }
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
  return joined.length > 0 ? joined : null;
}

async function buildTierRows(dsRoot, tier, notes) {
  const tierPath = path.join(dsRoot, tier.dir);
  const rows = [];
  for (const name of await listComponentFolders(tierPath)) {
    const mdPath = path.join(tierPath, name, `${name}.md`);
    let purpose = null;
    if (await pathExists(mdPath)) {
      purpose = extractPurpose(await readFile(mdPath, 'utf8'));
      if (purpose === null) notes.push(`${tier.dir}/${name}: ${name}.md has no **Purpose:** line`);
    } else {
      notes.push(`${tier.dir}/${name}: missing ${name}.md`);
    }
    const cell = purpose === null ? '_undocumented_' : purpose.replace(/\|/g, '\\|');
    rows.push(`| ${name} | ${cell} | [${name}.md](${tier.dir}/${name}/${name}.md) |`);
  }
  return rows;
}

function parseGeneratedSections(regionText) {
  const sections = new Map();
  let current = null;
  for (const rawLine of regionText.split('\n')) {
    const line = rawLine.trim();
    const heading = line.match(/^##\s+(.*)$/);
    if (heading) {
      current = [];
      sections.set(heading[1].trim(), current);
      continue;
    }
    if (!current || !line.startsWith('|')) continue;
    if (/^\|\s*Component\s*\|/.test(line) || /^\|\s*-+\s*\|/.test(line)) continue;
    current.push(line);
  }
  return sections;
}

function diffRegions(oldRegion, newRegion) {
  const oldMap = parseGeneratedSections(oldRegion);
  const newMap = parseGeneratedSections(newRegion);
  const messages = [];
  for (const heading of new Set([...oldMap.keys(), ...newMap.keys()])) {
    const oldRows = oldMap.get(heading) ?? [];
    const newRows = newMap.get(heading) ?? [];
    if (!oldMap.has(heading)) messages.push(`+ section "${heading}"`);
    if (!newMap.has(heading)) messages.push(`- section "${heading}"`);
    for (const row of oldRows) if (!newRows.includes(row)) messages.push(`- ${heading}: ${row}`);
    for (const row of newRows) if (!oldRows.includes(row)) messages.push(`+ ${heading}: ${row}`);
  }
  if (messages.length === 0) messages.push('generated region differs in layout or whitespace only');
  return messages;
}

export async function buildIndex(root) {
  const dsRoot = path.join(root, DESIGN_SYSTEM_DIR);
  const designMdPath = path.join(root, INDEX_FILE);
  if (!(await pathExists(designMdPath))) {
    return { status: 'error', designMdPath, message: 'not found - seed it with a prologue and the generated markers' };
  }
  const raw = await readFile(designMdPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const original = raw.replace(/\r\n/g, '\n');
  const startIdx = original.indexOf(GENERATED_START);
  const endIdx = original.indexOf(GENERATED_END);
  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
    return { status: 'error', designMdPath, message: `must contain "${GENERATED_START}" followed by "${GENERATED_END}"` };
  }

  const notes = [];
  const sections = [];
  let totalComponents = 0;
  for (const tier of TIERS) {
    const rows = await buildTierRows(dsRoot, tier, notes);
    totalComponents += rows.length;
    sections.push([`## ${tier.heading}`, '', '| Component | Purpose | Doc |', '|---|---|---|', ...rows].join('\n'));
  }
  const body = sections.join('\n\n');
  const next = `${original.slice(0, startIdx + GENERATED_START.length)}\n${body}\n${original.slice(endIdx)}`;
  const stale = next !== original;
  return {
    status: stale ? 'stale' : 'fresh',
    designMdPath,
    next: next.replace(/\n/g, eol),
    totalComponents,
    notes,
    diff: stale ? diffRegions(original.slice(startIdx + GENERATED_START.length, endIdx), body) : [],
  };
}

async function main() {
  let cli;
  try {
    cli = parseCli(process.argv.slice(2), ['check']);
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    process.exit(1);
  }
  const result = await buildIndex(cli.root);
  if (result.status === 'error') {
    console.error(`${INDEX_FILE} ${result.message}`);
    process.exit(1);
  }
  for (const note of result.notes) console.error(`warning: ${note}`);
  if (result.status === 'fresh') {
    console.log(`design.md is up to date (${result.totalComponents} components)`);
    return;
  }
  if (cli.flags.has('check')) {
    console.error(`${INDEX_FILE} is out of date - ${REGENERATE_HINT}`);
    for (const line of result.diff) console.error(`  ${line}`);
    process.exit(1);
  }
  await writeFile(result.designMdPath, result.next, 'utf8');
  console.log(`design.md updated (${result.totalComponents} components)`);
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(`generate-design-index failed: ${err && err.message ? err.message : err}`);
    process.exit(1);
  });
}
