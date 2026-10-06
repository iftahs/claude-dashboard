import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Some host network filters treat a URL whose last path segment is `mcp` or `sse` as an MCP transport and rewrite the response (Content-Length dropped, `transfer-encoding: chunked` added, body left unframed).
const looksLikeMcpTransport = (path: string) => /\/(mcp|sse)\/?$/i.test(path.split('?')[0]);

const routePaths = (source: string) =>
  [...source.matchAll(/\bapp\.(?:get|post|put|patch|delete|all)\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);

test('MCP-transport-shaped paths are recognised', () => {
  for (const p of ['/api/insights/mcp', '/api/insights/mcp?days=7&source=claude', '/api/insights/MCP', '/api/mcp/', '/sse', '/api/events/sse']) {
    assert.equal(looksLikeMcpTransport(p), true, p);
  }
  for (const p of ['/api/insights/mcp-servers', '/api/insights/mcp-servers?days=7', '/api/mcp/servers', '/api/insights/xmcp', '/api/mcp.json', '/api/assess']) {
    assert.equal(looksLikeMcpTransport(p), false, p);
  }
});

test('route extraction reads every app.<method>() literal', () => {
  const synthetic = `
    app.get('/api/a', handler);
    app.post("/api/b/:id", handler);
    app.get(\`/api/insights/mcp\`, handler);
  `;
  assert.deepEqual(routePaths(synthetic), ['/api/a', '/api/b/:id', '/api/insights/mcp']);
});

test('no API route ends in an MCP transport segment', () => {
  const paths = routePaths(readFileSync(new URL('./index.ts', import.meta.url), 'utf8'));
  assert.ok(paths.length > 40, `expected the route table, got ${paths.length} paths`);
  assert.ok(paths.includes('/api/insights/mcp-servers'));
  assert.deepEqual(paths.filter(looksLikeMcpTransport), []);
});
