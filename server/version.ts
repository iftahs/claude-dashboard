import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Version check: compares the local package.json version against the version
// on the `main` branch (fetched from GitHub raw). Powers the "update available"
// banner. Offline-first — every network path fails silently to null.
// ---------------------------------------------------------------------------

export interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  isDocker: boolean;
  repoUrl: string;
  compareUrl: string;
}

interface LocalPackage {
  version: string;
  repoUrl: string;
}

const REMOTE_TTL_MS = 30 * 60 * 1000; // 30 min — don't hammer GitHub raw
let remoteCache: { value: string | null; at: number } | null = null;

let localCache: LocalPackage | null = null;

/** Normalize a package.json `repository.url` into a plain GitHub https URL. */
function normalizeRepoUrl(raw: unknown): string {
  let url = typeof raw === 'string' ? raw : (raw as { url?: string })?.url ?? '';
  url = url.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://');
  if (url.startsWith('git@github.com:')) {
    url = 'https://github.com/' + url.slice('git@github.com:'.length);
  }
  return url || 'https://github.com/iftahs/claude-dashboard';
}

/** Read this app's own package.json (cwd is repo root in dev, /app in Docker). */
async function readLocalPackage(): Promise<LocalPackage> {
  if (localCache) return localCache;
  const raw = await readFile(join(process.cwd(), 'package.json'), 'utf8');
  const pkg = JSON.parse(raw);
  localCache = {
    version: String(pkg.version ?? '0.0.0'),
    repoUrl: normalizeRepoUrl(pkg.repository ?? pkg.homepage),
  };
  return localCache;
}

/** owner/repo from an https GitHub url, or null if it isn't one. */
function ownerRepo(repoUrl: string): { owner: string; repo: string } | null {
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** Fetch the `version` field from package.json on `main`. null on any failure. */
async function fetchRemoteVersion(repoUrl: string): Promise<string | null> {
  if (remoteCache && Date.now() - remoteCache.at < REMOTE_TTL_MS) {
    return remoteCache.value;
  }
  let value: string | null = null;
  try {
    const slug = ownerRepo(repoUrl);
    if (slug) {
      const url = `https://raw.githubusercontent.com/${slug.owner}/${slug.repo}/main/package.json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const pkg = await res.json();
        if (typeof pkg.version === 'string') value = pkg.version;
      }
    }
  } catch {
    value = null;
  }
  remoteCache = { value, at: Date.now() };
  return value;
}

/** True when running inside the Docker image. */
export function isDocker(): boolean {
  return existsSync('/.dockerenv') || process.env.APP_RUNTIME === 'docker';
}

/** Numeric semver compare. Returns >0 when `b` is newer than `a`. */
function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v.replace(/^v/, '').split('-')[0].split('.').map((n) => Number(n) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function getVersionInfo(): Promise<VersionInfo> {
  const local = await readLocalPackage();
  const latest = await fetchRemoteVersion(local.repoUrl);
  const updateAvailable = latest != null && compareVersions(local.version, latest) > 0;
  return {
    current: local.version,
    latest,
    updateAvailable,
    isDocker: isDocker(),
    repoUrl: local.repoUrl,
    // GitHub renders this commit log even without a `v` tag (avoids a 404).
    compareUrl: `${local.repoUrl}/commits/main`,
  };
}
