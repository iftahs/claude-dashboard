import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const claudeDir = process.env.CLAUDE_DIR || join(homedir(), '.claude');
const creds = JSON.parse(await readFile(join(claudeDir, '.credentials.json'), 'utf8'));
const token = creds?.claudeAiOauth?.accessToken;
const expiresAt = creds?.claudeAiOauth?.expiresAt;

console.log('Token present:', !!token);
console.log('Token prefix:', token?.slice(0, 20));
console.log('ExpiresAt:', new Date(expiresAt).toISOString(), '| now:', new Date().toISOString());
console.log('Expired:', Date.now() >= expiresAt);

const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
  headers: {
    Authorization: `Bearer ${token}`,
    'anthropic-beta': 'oauth-2025-04-20',
    'User-Agent': 'claude-code/2.1.162',
    Accept: 'application/json',
  },
});

const body = await res.text();
console.log('Status:', res.status);
console.log('Body:', body.slice(0, 500));
