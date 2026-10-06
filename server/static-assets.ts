import { stat } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import express, { type Express, type RequestHandler } from 'express';

export type Encoding = 'br' | 'gzip';

// Server preference order; vite.config.ts writes these siblings next to each text asset at build time.
const SIBLING_EXT: [Encoding, string][] = [['br', '.br'], ['gzip', '.gz']];

const ASSETS_PREFIX = '/assets/';

/** The precompressed encodings an Accept-Encoding header allows, best first. `q=0` refuses one; `*` covers whatever is unnamed. */
export function acceptedEncodings(header: string | string[] | undefined): Encoding[] {
  const raw = Array.isArray(header) ? header.join(',') : header ?? '';
  const q = new Map<string, number>();
  for (const part of raw.split(',')) {
    const [name, ...params] = part.split(';').map((p) => p.trim().toLowerCase());
    if (!name) continue;
    const qParam = params.find((p) => p.startsWith('q='));
    const weight = qParam ? Number(qParam.slice(2)) : 1;
    q.set(name, Number.isFinite(weight) ? weight : 0);
  }
  const wildcard = q.get('*') ?? 0;
  return SIBLING_EXT.map(([enc]) => enc).filter((enc) => (q.get(enc) ?? wildcard) > 0);
}

/** `assets/<file>` (forward slashes, relative to distDir) for a request path inside dist/assets; null for anything else. */
export function resolveAsset(distDir: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (!decoded.startsWith(ASSETS_PREFIX) || /[\0\\:]/.test(decoded)) return null;
  const root = resolve(distDir, 'assets');
  const abs = resolve(distDir, `.${decoded}`);
  if (!abs.startsWith(root + sep)) return null;
  return relative(resolve(distDir), abs).split(sep).join('/');
}

export function encodedSibling(asset: string, encoding: Encoding): string {
  return asset + SIBLING_EXT.find(([enc]) => enc === encoding)![1];
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

// Owns every GET/HEAD under /assets/: a missing hashed file is a 404 here, never the SPA fallback's index.html.
export function hashedAssets(distDir: string): RequestHandler {
  return async (req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !req.path.startsWith(ASSETS_PREFIX)) return next();
    try {
      const asset = resolveAsset(distDir, req.path);
      if (!asset || !(await isFile(join(distDir, asset)))) {
        res.setHeader('Cache-Control', 'no-store');
        return void res.status(404).type('txt').send('Not found');
      }
      let file = asset;
      for (const encoding of acceptedEncodings(req.headers['accept-encoding'])) {
        const sibling = encodedSibling(asset, encoding);
        if (await isFile(join(distDir, sibling))) {
          res.setHeader('Content-Encoding', encoding);
          file = sibling;
          break;
        }
      }
      res.type(extname(asset));
      res.vary('Accept-Encoding');
      // sendFile keeps the Content-Length (and the type set above): the files are compressed at build time, never per request.
      res.sendFile(file, { root: distDir, maxAge: '1y', immutable: true, acceptRanges: file === asset }, (err) => {
        if (err && !res.headersSent) next(err);
      });
    } catch (e) {
      next(e);
    }
  };
}

/** The built UI: immutable hashed assets, an always-revalidated index.html, and that page for every other non-/api path. */
export function serveBuiltUi(app: Express, distDir: string): void {
  app.use(hashedAssets(distDir));
  app.use(express.static(distDir, {
    setHeaders: (res, file) => {
      if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile('index.html', { root: distDir });
  });
}
