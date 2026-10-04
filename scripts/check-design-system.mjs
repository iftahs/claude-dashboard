import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  DESIGN_SYSTEM_DIR,
  INDEX_FILE,
  REGENERATE_HINT,
  TIERS,
  buildIndex,
  extractPurpose,
  parseCli,
} from './generate-design-index.mjs';

const USAGE = 'Usage: node scripts/check-design-system.mjs [--all] [--root <project-dir>]';

const SRC_DIR = 'src';
const COMPONENTS_DIR = 'src/components';
const COMMON_DIR = 'src/components/common';
const LEGACY_DIR = 'src/components/legacy';
const PAGES_DIR = 'src/pages';
const HOOKS_DIR = 'src/hooks';
const LIB_DIR = 'src/lib';
const SKIPPED_DIR_NAMES = new Set(['node_modules', 'dist', '.claude']);
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
const BARREL_NAMES = new Set(['index.ts', 'index.tsx']);

const TIER_MAY_IMPORT = {
  atoms: [],
  molecules: ['atoms'],
  organisms: ['atoms', 'molecules', 'organisms'],
  templates: ['atoms', 'molecules', 'organisms'],
};
const TIER_RULE_TEXT = {
  atoms: 'an atom imports no design-system file outside its own folder',
  molecules: 'a molecule imports only atoms',
  organisms: 'an organism imports atoms, molecules and organisms, never templates',
  templates: 'a template imports atoms, molecules and organisms',
};
const DESIGN_SYSTEM_HOOK_ALLOW_LIST = new Set(['useCountUp', 'useFlashOnIncrease']);
const BANNED_PACKAGES = ['react-router-dom', 'react-router'];
const BANNED_LIB_MODULES = ['src/lib/analytics'];

const LOGIC_BANS = [
  { name: 'usePolling', pattern: /\busePolling\b/g },
  { name: 'fetch(', pattern: /(?<![\w$])fetch\s*\(/g },
  { name: 'localStorage', pattern: /\blocalStorage\b/g },
  { name: 'sessionStorage', pattern: /\bsessionStorage\b/g },
  { name: 'track(', pattern: /(?<![\w$])track\s*\(/g },
  { name: '/api/', pattern: /\/api\//g },
  { name: 'setInterval', pattern: /\bsetInterval\b/g, allowedComponent: 'ElapsedTime' },
];

// Widen `scope` to `scopeAll` (the --all flag) in the final cleanup phase.
const STYLE_BANS = {
  scope: [`${DESIGN_SYSTEM_DIR}/`, `${COMMON_DIR}/`, `${PAGES_DIR}/`],
  scopeAll: [`${SRC_DIR}/`],
  extensions: SOURCE_EXTENSIONS,
  rules: [
    {
      name: 'raw hex colour',
      pattern: /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])/g,
      fix: 'use a token',
    },
    {
      name: 'arbitrary font size',
      pattern: /text-\[\s*\d*\.?\d+(?:px|rem|em)\s*\]/g,
      fix: 'use the type scale',
    },
    {
      name: 'default Tailwind scale',
      pattern: /(?<![\w-])(?:text-(?:xs|sm|base|lg|[2-9]?xl)|rounded-(?:sm|md|lg|[23]?xl)|shadow-(?:sm|md|lg|2?xl))(?![\w-])/g,
      fix: 'use the design-system type, radius and shadow scales',
    },
    {
      name: 'dark: variant',
      pattern: /(?<![\w-])dark:(?=[\w[!-])/g,
      fix: 'tokens switch with the theme',
    },
    {
      name: 'legacy palette class',
      pattern: /(?<![A-Za-z0-9])(?:ink|clay|zinc)-\d{2,3}(?!\w)/g,
      fix: 'use a semantic token class',
    },
  ],
};

const RULE_ORDER = [
  'Tier imports',
  'Design-system boundary',
  'Foreign utils.ts',
  'Unresolved imports',
  'Folder contract',
  'Barrel files',
  'Logic in the design system',
  'Style bans',
  'Index freshness',
];
const WARNING_ORDER = ['Hooks and lib importing components (allowed while migrating)'];

const REGEX_PRECEDERS = new Set('(,=:[!&|?{};+-*%~^'.split(''));
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'else', 'do']);

const dirCache = new Map();
const sourceCache = new Map();

function listDir(abs) {
  let entries = dirCache.get(abs);
  if (!entries) {
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      entries = [];
    }
    dirCache.set(abs, entries);
  }
  return entries;
}

// Segment-by-segment so a wrong-case path fails here as it would on a case-sensitive filesystem.
function isFileExact(root, abs) {
  const rel = path.relative(root, abs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  let current = root;
  let entry = null;
  for (const segment of rel.split(path.sep)) {
    entry = listDir(current).find((candidate) => candidate.name === segment);
    if (!entry) return false;
    current = path.join(current, segment);
  }
  return entry.isFile();
}

function walk(root, rel, out) {
  for (const entry of listDir(path.join(root, rel))) {
    const childRel = `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      if (SKIPPED_DIR_NAMES.has(entry.name) || childRel === LEGACY_DIR) continue;
      walk(root, childRel, out);
    } else if (entry.isFile()) {
      out.push(childRel);
    }
  }
  return out;
}

function within(rel, dir) {
  return rel.startsWith(`${dir}/`);
}

function isSource(rel) {
  return SOURCE_EXTENSIONS.some((ext) => rel.endsWith(ext));
}

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

function stripComments(source) {
  const out = source.split('');
  const length = source.length;
  const templateDepths = [];
  let prev = '';
  let i = 0;

  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
  };
  const skipTemplate = (from) => {
    let k = from;
    while (k < length) {
      const ch = source[k];
      if (ch === '\\') {
        k += 2;
      } else if (ch === '`') {
        prev = '`';
        return k + 1;
      } else if (ch === '$' && source[k + 1] === '{') {
        templateDepths.push(0);
        prev = '{';
        return k + 2;
      } else {
        k += 1;
      }
    }
    return length;
  };
  const wordBefore = (index) => {
    let end = index;
    while (end > 0 && /[ \t]/.test(source[end - 1])) end -= 1;
    let start = end;
    while (start > 0 && /[A-Za-z]/.test(source[start - 1])) start -= 1;
    return source.slice(start, end);
  };

  while (i < length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      let end = source.indexOf('\n', i);
      if (end === -1) end = length;
      blank(i, end);
      i = end;
    } else if (ch === '/' && next === '*') {
      let end = source.indexOf('*/', i + 2);
      end = end === -1 ? length : end + 2;
      blank(i, end);
      i = end;
    } else if (ch === '"' || ch === "'") {
      // A quote with no partner on its line is an apostrophe in JSX text, not a string.
      let k = i + 1;
      while (k < length && source[k] !== ch && source[k] !== '\n') k += source[k] === '\\' ? 2 : 1;
      i = source[k] === ch ? k + 1 : i + 1;
      prev = ch;
    } else if (ch === '`') {
      i = skipTemplate(i + 1);
    } else if (ch === '}' && templateDepths.length > 0 && templateDepths[templateDepths.length - 1] === 0) {
      templateDepths.pop();
      i = skipTemplate(i + 1);
    } else if (ch === '/' && (prev === '' || REGEX_PRECEDERS.has(prev) || REGEX_KEYWORDS.has(wordBefore(i)))) {
      let k = i + 1;
      let inClass = false;
      while (k < length && source[k] !== '\n') {
        const c = source[k];
        if (c === '\\') {
          k += 2;
          continue;
        }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) break;
        k += 1;
      }
      i = Math.min(k + 1, length);
      prev = '/';
    } else {
      if (templateDepths.length > 0) {
        if (ch === '{') templateDepths[templateDepths.length - 1] += 1;
        if (ch === '}') templateDepths[templateDepths.length - 1] -= 1;
      }
      if (!/\s/.test(ch)) prev = ch;
      i += 1;
    }
  }
  return out.join('');
}

function readSource(root, rel) {
  let cached = sourceCache.get(rel);
  if (!cached) {
    const raw = readFileSync(path.join(root, rel), 'utf8');
    cached = { raw, code: stripComments(raw) };
    sourceCache.set(rel, cached);
  }
  return cached;
}

function extractImports(code) {
  const patterns = [
    /^[ \t]*import\s+(?:type\s+)?(?:[\w$*{}\s,]+?\s*from\s*)?(['"])([^'"\n]+)\1/gm,
    /^[ \t]*export\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*(['"])([^'"\n]+)\1/gm,
    /(?<![\w$.])import\s*\(\s*(['"`])([^'"`\n]+)\1/g,
  ];
  const found = [];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      const offset = match.index + match[0].lastIndexOf(match[2]);
      found.push({ specifier: match[2], line: lineAt(code, offset) });
    }
  }
  return found.sort((a, b) => a.line - b.line);
}

function resolveSpecifier(root, importerRel, specifier) {
  const clean = specifier.replace(/[?#].*$/, '');
  let base;
  if (clean.startsWith('@/')) base = path.join(root, SRC_DIR, clean.slice(2));
  else if (clean.startsWith('.')) base = path.resolve(root, path.dirname(importerRel), clean);
  else return { kind: 'package', name: clean };
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.d.ts`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
  const toRel = (abs) => path.relative(root, abs).split(path.sep).join('/');
  for (const candidate of candidates) {
    if (isFileExact(root, candidate)) return { kind: 'file', rel: toRel(candidate) };
  }
  return { kind: 'unresolved', rel: toRel(base) };
}

function classify(rel) {
  if (within(rel, DESIGN_SYSTEM_DIR)) {
    const parts = rel.slice(DESIGN_SYSTEM_DIR.length + 1).split('/');
    const tier = TIERS.find((candidate) => candidate.dir === parts[0]);
    if (!tier || parts.length < 3) return { zone: 'ds', tier: null, component: null, folder: null, isPrivate: false };
    return {
      zone: 'ds',
      tier: tier.dir,
      component: parts[1],
      folder: `${DESIGN_SYSTEM_DIR}/${parts[0]}/${parts[1]}`,
      isPrivate: parts.length > 3,
    };
  }
  if (within(rel, COMMON_DIR)) return { zone: 'common' };
  if (within(rel, LEGACY_DIR)) return { zone: 'legacy' };
  if (within(rel, COMPONENTS_DIR)) return { zone: 'components' };
  if (within(rel, PAGES_DIR)) return { zone: 'pages' };
  if (within(rel, HOOKS_DIR)) return { zone: 'hooks' };
  if (within(rel, LIB_DIR)) return { zone: 'lib' };
  return { zone: 'other' };
}

function isComponentZone(zone) {
  return zone === 'ds' || zone === 'common' || zone === 'legacy' || zone === 'components';
}

function createReport() {
  const violations = [];
  const warnings = [];
  const seen = new Set();
  const push = (list) => (rule, file, line, message, details = []) => {
    const key = JSON.stringify([rule, file, line, message]);
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ rule, file, line, message, details });
  };
  return { violations, warnings, violation: push(violations), warning: push(warnings) };
}

function checkDesignSystemImport(report, importer, importerInfo, line, target) {
  const display = target.rel.replace(`${DESIGN_SYSTEM_DIR}/`, '');
  const info = target.info;
  if (info.zone === 'ds') {
    if (importerInfo.folder && info.folder === importerInfo.folder) return;
    if (!importerInfo.tier) return;
    if (!info.tier) {
      report.violation('Tier imports', importer, line, `imports ${display}, which is not inside a component folder`);
    } else if (!TIER_MAY_IMPORT[importerInfo.tier].includes(info.tier)) {
      report.violation('Tier imports', importer, line, `imports ${display} - ${TIER_RULE_TEXT[importerInfo.tier]}`);
    } else if (info.isPrivate) {
      report.violation('Tier imports', importer, line, `imports ${display}, a private part of ${info.component}`);
    }
    return;
  }
  if (info.zone === 'pages' || info.zone === 'common' || info.zone === 'legacy' || info.zone === 'components') {
    report.violation('Design-system boundary', importer, line, `imports ${target.rel} - the design system never imports pages, connected or legacy components`);
    return;
  }
  if (info.zone === 'hooks') {
    const hook = path.basename(target.rel).replace(/\.tsx?$/, '');
    if (importerInfo.tier === 'templates') {
      report.violation('Design-system boundary', importer, line, `imports ${target.rel} - templates are layout only and import no hooks`);
    } else if (!DESIGN_SYSTEM_HOOK_ALLOW_LIST.has(hook)) {
      const allowed = [...DESIGN_SYSTEM_HOOK_ALLOW_LIST].join(', ');
      report.violation('Design-system boundary', importer, line, `imports ${target.rel} - only ${allowed} may be imported from @/hooks`);
    }
    return;
  }
  if (BANNED_LIB_MODULES.some((banned) => target.rel === `${banned}.ts` || target.rel === `${banned}.tsx` || within(target.rel, banned))) {
    report.violation('Design-system boundary', importer, line, `imports ${target.rel} - analytics belongs in a hook`);
  }
}

function checkImports(root, files, report) {
  const scanned = files.filter(
    (rel) => isSource(rel) && ['ds', 'common', 'pages', 'hooks', 'lib'].includes(classify(rel).zone),
  );
  for (const importer of scanned) {
    const importerInfo = classify(importer);
    const importerDir = path.posix.dirname(importer);
    for (const { specifier, line } of extractImports(readSource(root, importer).code)) {
      const resolved = resolveSpecifier(root, importer, specifier);
      const fromHookOrLib = importerInfo.zone === 'hooks' || importerInfo.zone === 'lib';
      if (resolved.kind === 'unresolved') {
        // Hooks and lib are mid-migration: a broken import there is tsc's to report, not a tier violation.
        if (!fromHookOrLib) {
          report.violation('Unresolved imports', importer, line, `"${specifier}" does not resolve to a file (check the path and its letter case)`);
        } else if (within(resolved.rel, COMPONENTS_DIR)) {
          report.warning(WARNING_ORDER[0], importer, line, `imports ${resolved.rel} (does not resolve)`);
        }
        continue;
      }
      if (resolved.kind === 'package') {
        if (importerInfo.zone === 'ds' && BANNED_PACKAGES.some((name) => resolved.name === name || resolved.name.startsWith(`${name}/`))) {
          report.violation('Design-system boundary', importer, line, `imports "${specifier}" - routing belongs in pages and hooks`);
        }
        continue;
      }
      const target = { rel: resolved.rel, info: classify(resolved.rel) };
      if (fromHookOrLib) {
        if (isComponentZone(target.info.zone)) {
          report.warning(WARNING_ORDER[0], importer, line, `imports ${target.rel}`);
        }
        continue;
      }
      if (importerInfo.zone === 'ds') checkDesignSystemImport(report, importer, importerInfo, line, target);
      const isUtils = /^utils\.tsx?$/.test(path.posix.basename(target.rel));
      if (isUtils && (isComponentZone(target.info.zone) || target.info.zone === 'pages')) {
        const utilsDir = path.posix.dirname(target.rel);
        if (importerDir !== utilsDir && !within(importerDir, utilsDir)) {
          report.violation('Foreign utils.ts', importer, line, `imports ${target.rel} - a folder's utils.ts serves only that folder`);
        }
      }
    }
  }
}

function exportedBindings(code) {
  const values = [];
  const types = [];
  const collect = (list, pattern, nameOf) => {
    for (const match of code.matchAll(pattern)) list.push({ name: nameOf(match), line: lineAt(code, match.index + match[0].length) });
  };
  collect(values, /^[ \t]*export\s+(?:default\s+)?(?:async\s+)?function\b\s*\*?\s*([\w$]*)/gm, (m) => m[1] || 'default');
  collect(values, /^[ \t]*export\s+(?:declare\s+)?(?:const|let|var)\s+(?!enum\b)([\w$]+)/gm, (m) => m[1]);
  collect(values, /^[ \t]*export\s+(?:default\s+)?(?:abstract\s+)?class\b\s*([\w$]*)/gm, (m) => m[1] || 'default');
  collect(values, /^[ \t]*export\s+(?:declare\s+)?(?:const\s+)?enum\s+([\w$]+)/gm, (m) => m[1]);
  collect(values, /^[ \t]*export\s+default\s+(?!(?:async\s+)?function\b|(?:abstract\s+)?class\b)/gm, () => 'default');
  collect(values, /^[ \t]*export\s+\*/gm, () => '*');
  collect(types, /^[ \t]*export\s+(?:declare\s+)?(?:interface|type)\s+([\w$]+)/gm, (m) => m[1]);
  collect(types, /^[ \t]*(?:interface|type)\s+(\w*Props)\b/gm, (m) => m[1]);
  for (const match of code.matchAll(/^[ \t]*export\s+(type\s+)?\{([^}]*)\}/gm)) {
    const line = lineAt(code, match.index + match[0].length);
    for (const raw of match[2].split(',')) {
      const entry = raw.trim();
      if (!entry) continue;
      const isType = Boolean(match[1]) || entry.startsWith('type ');
      const name = entry.replace(/^type\s+/, '').split(/\s+as\s+/).pop();
      (isType ? types : values).push({ name, line });
    }
  }
  return { values, types };
}

function checkComponentSource(root, report, rel, name) {
  const { values, types } = exportedBindings(readSource(root, rel).code);
  if (values.length !== 1) {
    const names = values.map((value) => value.name).join(', ') || 'none';
    const line = values.length > 1 ? values[1].line : 1;
    report.violation('Folder contract', rel, line, `exports ${values.length} values (${names}) - a component file exports exactly one component`);
  } else if (values[0].name !== name) {
    report.violation('Folder contract', rel, values[0].line, `exports ${values[0].name} - the one export must be the component ${name}`);
  }
  for (const type of types) {
    report.violation('Folder contract', rel, type.line, `declares the type ${type.name} - types live in types.ts`);
  }
}

function checkComponentDoc(root, report, tier, rel) {
  const text = readFileSync(path.join(root, rel), 'utf8');
  const level = text.match(/^\*\*Level:\*\*[ \t]*(.*)$/m);
  if (!level) {
    report.violation('Folder contract', rel, 1, 'has no **Level:** line');
  } else if (level[1].trim().replace(/\.$/, '').toLowerCase() !== tier.level.toLowerCase()) {
    report.violation('Folder contract', rel, lineAt(text, level.index), `**Level:** says "${level[1].trim()}" but the folder tier is ${tier.level}`);
  }
  if (extractPurpose(text) === null) report.violation('Folder contract', rel, 1, 'has no **Purpose:** line');
}

function checkPrivatePartsListed(root, report, folderRel, name, parts) {
  if (parts.length === 0) return;
  const docRel = `${folderRel}/${name}.md`;
  if (!isFileExact(root, path.join(root, docRel))) return;
  const lines = readFileSync(path.join(root, docRel), 'utf8').split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Private parts\s*$/i.test(line));
  if (start === -1) {
    report.violation('Folder contract', docRel, 1, `has no "## Private parts" section listing ${parts.join(', ')}`);
    return;
  }
  let end = lines.findIndex((line, index) => index > start && /^##\s/.test(line));
  if (end === -1) end = lines.length;
  const section = lines.slice(start + 1, end).join('\n');
  for (const part of parts) {
    if (!new RegExp(`(?<!\\w)${part}(?!\\w)`).test(section)) {
      report.violation('Folder contract', docRel, start + 1, `private part ${part} is not listed under "## Private parts"`);
    }
  }
}

function checkComponentFolder(root, report, tier, folderRel, name, topLevel, parts) {
  const entries = listDir(path.join(root, folderRel));
  const fileNames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    report.violation('Folder contract', `${folderRel}/`, 0, 'component folders are PascalCase');
  }
  if (topLevel && tier.dir === 'templates' && !/.Layout$/.test(name)) {
    report.violation('Folder contract', `${folderRel}/`, 0, 'templates are named <Name>Layout');
  }
  const required = [`${name}.tsx`, 'types.ts', ...(topLevel ? [`${name}.md`] : [])];
  for (const file of required) {
    if (!fileNames.includes(file)) report.violation('Folder contract', `${folderRel}/${file}`, 0, 'missing');
  }
  const allowed = new Set([...required, `${name}.md`, 'utils.ts', `${name}.variants.ts`, `${name}.test.ts`, `${name}.test.tsx`]);
  for (const file of fileNames) {
    if (BARREL_NAMES.has(file)) continue;
    const rel = `${folderRel}/${file}`;
    if (!allowed.has(file)) {
      report.violation('Folder contract', rel, 1, `unexpected file - the folder holds ${name}.tsx, types.ts, utils.ts, ${name}.variants.ts and ${name}.md`);
    }
    if (file.endsWith('.tsx') && !file.endsWith('.test.tsx')) {
      checkComponentSource(root, report, rel, file.slice(0, -'.tsx'.length));
    }
  }
  if (topLevel && fileNames.includes(`${name}.md`)) checkComponentDoc(root, report, tier, `${folderRel}/${name}.md`);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    parts.push(entry.name);
    checkComponentFolder(root, report, tier, `${folderRel}/${entry.name}`, entry.name, false, parts);
  }
}

function checkFolderContract(root, report) {
  const counts = {};
  for (const entry of listDir(path.join(root, DESIGN_SYSTEM_DIR))) {
    const rel = `${DESIGN_SYSTEM_DIR}/${entry.name}`;
    if (entry.isFile() && rel !== INDEX_FILE) {
      report.violation('Folder contract', rel, 1, 'only design.md lives at the design-system root');
    } else if (entry.isDirectory() && !TIERS.some((tier) => tier.dir === entry.name)) {
      report.violation('Folder contract', `${rel}/`, 0, `not a tier folder (${TIERS.map((tier) => tier.dir).join(', ')})`);
    }
  }
  for (const tier of TIERS) {
    counts[tier.dir] = 0;
    for (const entry of listDir(path.join(root, DESIGN_SYSTEM_DIR, tier.dir))) {
      const rel = `${DESIGN_SYSTEM_DIR}/${tier.dir}/${entry.name}`;
      if (entry.isFile()) {
        report.violation('Folder contract', rel, 1, 'file outside a component folder');
      } else if (entry.isDirectory()) {
        counts[tier.dir] += 1;
        const parts = [];
        checkComponentFolder(root, report, tier, rel, entry.name, true, parts);
        checkPrivatePartsListed(root, report, rel, entry.name, parts);
      }
    }
  }
  return counts;
}

function checkBarrels(files, report) {
  for (const rel of files) {
    const scoped = within(rel, DESIGN_SYSTEM_DIR) || within(rel, COMMON_DIR) || within(rel, PAGES_DIR);
    if (scoped && BARREL_NAMES.has(path.posix.basename(rel))) {
      report.violation('Barrel files', rel, 1, 'barrel file - import by deep path instead');
    }
  }
}

function checkLogicBans(root, files, report) {
  for (const rel of files) {
    if (!isSource(rel) || !within(rel, DESIGN_SYSTEM_DIR)) continue;
    const { code } = readSource(root, rel);
    const { component } = classify(rel);
    for (const ban of LOGIC_BANS) {
      if (ban.allowedComponent && ban.allowedComponent === component) continue;
      for (const match of code.matchAll(ban.pattern)) {
        const where = ban.allowedComponent ? ` (allowed only in ${ban.allowedComponent})` : '';
        report.violation('Logic in the design system', rel, lineAt(code, match.index), `${ban.name}${where} - business logic belongs in a hook`);
      }
    }
  }
}

function checkStyleBans(root, files, report, all) {
  const scope = all ? STYLE_BANS.scopeAll : STYLE_BANS.scope;
  for (const rel of files) {
    if (!STYLE_BANS.extensions.some((ext) => rel.endsWith(ext))) continue;
    if (!scope.some((prefix) => rel.startsWith(prefix))) continue;
    const { code } = readSource(root, rel);
    for (const rule of STYLE_BANS.rules) {
      for (const match of code.matchAll(rule.pattern)) {
        report.violation('Style bans', rel, lineAt(code, match.index), `${rule.name} "${match[0]}" - ${rule.fix}`);
      }
    }
  }
}

async function checkIndexFreshness(root, report) {
  const result = await buildIndex(root);
  if (result.status === 'error') {
    report.violation('Index freshness', INDEX_FILE, 0, result.message);
  } else if (result.status === 'stale') {
    report.violation('Index freshness', INDEX_FILE, 0, `out of date - ${REGENERATE_HINT}`, result.diff);
  }
}

function printGroups(log, order, items) {
  let groups = 0;
  for (const rule of order) {
    const group = items
      .filter((item) => item.rule === rule)
      .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
    if (group.length === 0) continue;
    groups += 1;
    log(`${rule} (${group.length})`);
    for (const item of group) {
      log(`  ${item.file}${item.line > 0 ? `:${item.line}` : ''} - ${item.message}`);
      for (const detail of item.details) log(`      ${detail}`);
    }
    log('');
  }
  return groups;
}

async function main() {
  let cli;
  try {
    cli = parseCli(process.argv.slice(2), ['all']);
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    process.exit(1);
  }
  const { root, flags } = cli;
  if (listDir(path.join(root, SRC_DIR)).length === 0) {
    console.error(`no ${SRC_DIR}/ folder under ${root}`);
    process.exit(1);
  }

  const files = walk(root, SRC_DIR, []).sort();
  const report = createReport();
  checkImports(root, files, report);
  const counts = checkFolderContract(root, report);
  checkBarrels(files, report);
  checkLogicBans(root, files, report);
  checkStyleBans(root, files, report, flags.has('all'));
  await checkIndexFreshness(root, report);

  printGroups(console.warn, WARNING_ORDER, report.warnings);
  const failedRules = printGroups(console.error, RULE_ORDER, report.violations);
  const warningText = `${report.warnings.length} warning(s)`;
  if (report.violations.length > 0) {
    console.error(`design system check failed: ${report.violations.length} violation(s) in ${failedRules} rule(s), ${warningText}`);
    process.exit(1);
  }
  const total = TIERS.reduce((sum, tier) => sum + counts[tier.dir], 0);
  const perTier = TIERS.map((tier) => `${counts[tier.dir]} ${tier.dir}`).join(', ');
  const styleScope = flags.has('all') ? ', style bans on all of src/' : '';
  console.log(`design system OK: ${total} components (${perTier}), ${files.length} files scanned, ${warningText}${styleScope}`);
}

main().catch((err) => {
  console.error(`check-design-system failed: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
