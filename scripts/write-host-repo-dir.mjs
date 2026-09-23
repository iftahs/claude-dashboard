#!/usr/bin/env node
/**
 * write-host-repo-dir.mjs — predocker:up hook.
 *
 * Records host-only facts into .env for the Docker container (which cannot
 * discover them itself):
 *   CLAUDE_JSON_HOST — ~/.claude.json (when present), mounted so the Workspace
 *                      tab can list the MCP servers configured there.
 *   CODEX_DIR_HOST   — ~/.codex (or $CODEX_HOME) when it holds a sessions/
 *                      folder, so the container can mount the OpenAI Codex
 *                      data. SET ONLY IF ABSENT: a user-pinned path, or a blank
 *                      value that opts out, must survive every docker:up.
 *   TZ               — the host's IANA time zone, so the container's day
 *                      buckets start at the user's midnight. SET ONLY IF
 *                      ABSENT, like CODEX_DIR_HOST.
 *   HOST_OS          — the host's process.platform, so the container's
 *                      "token expired" advice fits the host (the Keychain
 *                      sync is macOS-only).
 *
 * Runs on the host from the repo root (npm lifecycle guarantees cwd). Upserts
 * only these lines; never touches anything else in .env.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

const envPath = join(process.cwd(), '.env');
let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';

function upsert(key, value) {
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=`, 'm').test(content)) {
    content = content.replace(new RegExp(`^${key}=.*$`, 'm'), line);
  } else {
    content = content.length && !content.endsWith('\n') ? `${content}\n${line}\n` : `${content}${line}\n`;
  }
  console.log(`[write-host-repo-dir] ${line}`);
}

/** Like upsert, but leaves an existing line (even an empty `KEY=`) untouched. */
function setIfAbsent(key, value) {
  if (new RegExp(`^${key}=`, 'm').test(content)) {
    console.log(`[write-host-repo-dir] ${key} already set — leaving it alone`);
    return;
  }
  upsert(key, value);
}

const claudeJson = join(os.homedir(), '.claude.json');
if (existsSync(claudeJson)) upsert('CLAUDE_JSON_HOST', claudeJson);
const codexHome = process.env.CODEX_HOME || join(os.homedir(), '.codex');
if (existsSync(join(codexHome, 'sessions'))) setIfAbsent('CODEX_DIR_HOST', codexHome);
// IANA name on every OS (ICU maps Windows zones); skip it when unresolvable.
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (tz && tz !== 'Etc/Unknown') setIfAbsent('TZ', tz);
upsert('HOST_OS', process.platform);

writeFileSync(envPath, content);
