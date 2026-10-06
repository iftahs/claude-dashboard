import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { brotliCompressSync, brotliDecompressSync, gunzipSync, gzipSync } from 'node:zlib';
import express from 'express';
import { acceptedEncodings, encodedSibling, resolveAsset, serveBuiltUi } from './static-assets.ts';

// ---------------------------------------------------------------------------
// Encoding negotiation
// ---------------------------------------------------------------------------

test('br is preferred over gzip whenever both are acceptable', () => {
  assert.deepEqual(acceptedEncodings('gzip, deflate, br, zstd'), ['br', 'gzip']);
  assert.deepEqual(acceptedEncodings('gzip;q=1.0, br;q=0.5'), ['br', 'gzip']);
  assert.deepEqual(acceptedEncodings(['gzip', 'br']), ['br', 'gzip']);
  assert.deepEqual(acceptedEncodings('GZIP , BR'), ['br', 'gzip']);
});

test('only what the client lists is offered', () => {
  assert.deepEqual(acceptedEncodings('gzip, deflate'), ['gzip']);
  assert.deepEqual(acceptedEncodings('br'), ['br']);
  assert.deepEqual(acceptedEncodings('deflate, identity'), []);
  assert.deepEqual(acceptedEncodings(undefined), []);
  assert.deepEqual(acceptedEncodings(''), []);
});

test('q=0 refuses an encoding, and * stands for the ones not named', () => {
  assert.deepEqual(acceptedEncodings('br;q=0, gzip'), ['gzip']);
  assert.deepEqual(acceptedEncodings('gzip;q=0, br;q=0'), []);
  assert.deepEqual(acceptedEncodings('*'), ['br', 'gzip']);
  assert.deepEqual(acceptedEncodings('*;q=0.1, br;q=0'), ['gzip']);
  assert.deepEqual(acceptedEncodings('*;q=0, gzip'), ['gzip']);
  assert.deepEqual(acceptedEncodings('gzip;q=nonsense'), []);
});

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const DIST = join(tmpdir(), 'dash-static-pure', 'dist');

test('a path under /assets/ resolves to a dist-relative file', () => {
  assert.equal(resolveAsset(DIST, '/assets/index-a1b2c3.js'), 'assets/index-a1b2c3.js');
  assert.equal(resolveAsset(DIST, '/assets/fonts/inter-latin.woff2'), 'assets/fonts/inter-latin.woff2');
  assert.equal(resolveAsset(DIST, '/assets/a%20b.css'), 'assets/a b.css');
  assert.equal(resolveAsset(DIST, '/assets/x/../index-a1b2c3.js'), 'assets/index-a1b2c3.js');
});

test('anything that leaves dist/assets is refused', () => {
  for (const path of [
    '/assets/../index.html',
    '/assets/../../server/index.ts',
    '/assets/%2e%2e/index.html',
    '/assets/%2e%2e%2f%2e%2e%2fpackage.json',
    '/assets/..%5C..%5Cpackage.json',
    '/assets/..\\..\\package.json',
    '/assets/x/../../index.html',
    '/assets/C:/Windows/win.ini',
    '/assets/app.js%00.png',
    '/assets/%E0%A4%A',
    '/assets/',
    '/assets',
    '/index.html',
    '/assetsfoo/x.js',
    '/api/assets/x.js',
  ]) {
    assert.equal(resolveAsset(DIST, path), null, path);
  }
});

test('the dist folder itself may sit under any path, relative or not', () => {
  assert.equal(resolveAsset(`.${sep}dist`, '/assets/a.js'), 'assets/a.js');
  assert.equal(resolveAsset(`.${sep}dist`, '/assets/../a.js'), null);
});

test('a sibling is the asset name plus the encoding suffix', () => {
  assert.equal(encodedSibling('assets/index-a1b2c3.js', 'br'), 'assets/index-a1b2c3.js.br');
  assert.equal(encodedSibling('assets/index-a1b2c3.js', 'gzip'), 'assets/index-a1b2c3.js.gz');
});

// ---------------------------------------------------------------------------
// The mounted middleware, over a synthetic dist on an ephemeral loopback port
// ---------------------------------------------------------------------------

// Under a dot-directory, like a checkout in .claude/worktrees: only dot-files inside dist may be refused.
const TMP = mkdtempSync(join(tmpdir(), 'dash-static-'));
const dist = join(TMP, '.hidden', 'dist');
const JS = `export const greeting = ${JSON.stringify('synthetic bundle '.repeat(200))};\n`;
const HTML = '<!doctype html><title>synthetic</title><div id="root"></div>\n';
const IMMUTABLE = 'public, max-age=31536000, immutable';

mkdirSync(join(dist, 'assets'), { recursive: true });
writeFileSync(join(dist, 'index.html'), HTML);
writeFileSync(join(dist, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
writeFileSync(join(dist, 'assets', 'app-abc123.js'), JS);
writeFileSync(join(dist, 'assets', 'app-abc123.js.br'), brotliCompressSync(JS));
writeFileSync(join(dist, 'assets', 'app-abc123.js.gz'), gzipSync(JS));
writeFileSync(join(dist, 'assets', 'gzonly-abc123.css'), 'body{margin:0}');
writeFileSync(join(dist, 'assets', 'gzonly-abc123.css.gz'), gzipSync('body{margin:0}'));
writeFileSync(join(dist, 'assets', 'font-abc123.woff2'), Buffer.from([0x77, 0x4f, 0x46, 0x32, 0, 1, 2, 3]));
writeFileSync(join(dist, 'assets', 'orphan-abc123.js.br'), brotliCompressSync(JS));

let server: Server;
let port = 0;

before(async () => {
  const app = express();
  app.get('/api/health', (_req, res) => void res.json({ ok: true }));
  serveBuiltUi(app, dist);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  port = (server.address() as AddressInfo).port;
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(TMP, { recursive: true, force: true });
});

interface Reply {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

function get(path: string, headers: Record<string, string> = {}, method = 'GET'): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('a hashed asset is served brotli-compressed, immutable, with its own type and length', async () => {
  const r = await get('/assets/app-abc123.js', { 'accept-encoding': 'gzip, deflate, br, zstd' });
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-encoding'], 'br');
  assert.match(String(r.headers['content-type']), /^application\/javascript/);
  assert.equal(r.headers['cache-control'], IMMUTABLE);
  assert.equal(r.headers.vary, 'Accept-Encoding');
  assert.equal(Number(r.headers['content-length']), r.body.length);
  assert.equal(r.headers['transfer-encoding'], undefined);
  assert.ok(r.body.length < Buffer.byteLength(JS));
  assert.equal(brotliDecompressSync(r.body).toString(), JS);
});

test('a client without brotli gets gzip, and one with neither gets the file itself', async () => {
  const gz = await get('/assets/app-abc123.js', { 'accept-encoding': 'gzip, deflate' });
  assert.equal(gz.headers['content-encoding'], 'gzip');
  assert.equal(Number(gz.headers['content-length']), gz.body.length);
  assert.equal(gunzipSync(gz.body).toString(), JS);

  const plain = await get('/assets/app-abc123.js');
  assert.equal(plain.status, 200);
  assert.equal(plain.headers['content-encoding'], undefined);
  assert.equal(plain.headers['cache-control'], IMMUTABLE);
  assert.equal(plain.headers.vary, 'Accept-Encoding');
  assert.equal(Number(plain.headers['content-length']), Buffer.byteLength(JS));
  assert.equal(plain.body.toString(), JS);
  assert.notEqual(plain.headers.etag, gz.headers.etag);
});

test('a missing encoding falls through to the next one the client takes', async () => {
  const r = await get('/assets/gzonly-abc123.css', { 'accept-encoding': 'br, gzip' });
  assert.equal(r.headers['content-encoding'], 'gzip');
  assert.match(String(r.headers['content-type']), /^text\/css/);
  assert.equal((await get('/assets/gzonly-abc123.css', { 'accept-encoding': 'br' })).headers['content-encoding'], undefined);
});

test('HEAD answers with the same headers and no body', async () => {
  const r = await get('/assets/app-abc123.js', { 'accept-encoding': 'br' }, 'HEAD');
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-encoding'], 'br');
  assert.equal(Number(r.headers['content-length']), brotliCompressSync(JS).length);
  assert.equal(r.headers['cache-control'], IMMUTABLE);
  assert.equal(r.body.length, 0);
});

test('an asset with no compressed sibling is served as is, still immutable', async () => {
  const r = await get('/assets/font-abc123.woff2', { 'accept-encoding': 'br, gzip' });
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-encoding'], undefined);
  assert.equal(r.headers['content-type'], 'font/woff2');
  assert.equal(r.headers['cache-control'], IMMUTABLE);
  assert.equal(r.body.length, 8);
});

test('a missing hashed asset is a 404 that is never cached, not the SPA page', async () => {
  for (const path of ['/assets/gone-abc123.js', '/assets/orphan-abc123.js', '/assets/../index.html', '/assets/%2e%2e/index.html', '/assets/']) {
    const r = await get(path, { 'accept-encoding': 'br, gzip' });
    assert.equal(r.status, 404, path);
    assert.equal(r.headers['cache-control'], 'no-store', path);
    assert.equal(r.headers['content-encoding'], undefined, path);
    assert.match(String(r.headers['content-type']), /^text\/plain/, path);
    assert.equal(Number(r.headers['content-length']), r.body.length, path);
  }
});

test('a compressed response ignores Range; the plain file still honours it', async () => {
  const br = await get('/assets/app-abc123.js', { 'accept-encoding': 'br', range: 'bytes=0-9' });
  assert.equal(br.status, 200);
  assert.equal(br.headers['accept-ranges'], undefined);
  const plain = await get('/assets/app-abc123.js', { range: 'bytes=0-9' });
  assert.equal(plain.status, 206);
  assert.equal(plain.body.toString(), JS.slice(0, 10));
});

test('index.html is always revalidated: at /, by name, and as the SPA fallback', async () => {
  for (const path of ['/', '/index.html', '/trends', '/sessions/some-id']) {
    const r = await get(path, { 'accept-encoding': 'br, gzip' });
    assert.equal(r.status, 200, path);
    assert.equal(r.headers['cache-control'], 'no-cache', path);
    assert.match(String(r.headers['content-type']), /^text\/html/, path);
    assert.equal(r.headers['content-encoding'], undefined, path);
    assert.equal(Number(r.headers['content-length']), Buffer.byteLength(HTML), path);
    assert.equal(r.body.toString(), HTML, path);
  }
  const first = await get('/');
  const again = await get('/', { 'if-none-match': String(first.headers.etag) });
  assert.equal(again.status, 304);
});

test('other root files keep the default short caching, and /api never falls back to the page', async () => {
  const icon = await get('/favicon.svg');
  assert.equal(icon.status, 200);
  assert.equal(icon.headers['cache-control'], 'public, max-age=0');
  assert.equal((await get('/api/health')).status, 200);
  const missing = await get('/api/nope');
  assert.equal(missing.status, 404);
  assert.doesNotMatch(missing.body.toString(), /synthetic/);
});
