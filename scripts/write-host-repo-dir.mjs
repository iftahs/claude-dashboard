#!/usr/bin/env node
/**
 * write-host-repo-dir.mjs — predocker:up hook.
 *
 * Records host-only paths into .env for the Docker container (which cannot
 * discover host paths itself):
 *   HOST_REPO_DIR    — this repo's absolute path, for the copy-paste
 *                      resume-watcher command on the Auto-Resume page.
 *   CLAUDE_JSON_HOST — ~/.claude.json (when present), so the container can
 *                      detect whether bypassPermissions is enabled.
 *   CODEX_DIR_HOST   — ~/.codex (or $CODEX_HOME) when it holds a sessions/
 *                      folder, so the container can mount the OpenAI Codex
 *                      data. SET ONLY IF ABSENT: a user-pinned path, or a blank
 *                      value that opts out, must survive every docker:up.
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

upsert('HOST_REPO_DIR', process.cwd());
const claudeJson = join(os.homedir(), '.claude.json');
if (existsSync(claudeJson)) upsert('CLAUDE_JSON_HOST', claudeJson);
const codexHome = process.env.CODEX_HOME || join(os.homedir(), '.codex');
if (existsSync(join(codexHome, 'sessions'))) setIfAbsent('CODEX_DIR_HOST', codexHome);

writeFileSync(envPath, content);
