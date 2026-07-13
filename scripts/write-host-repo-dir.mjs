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

upsert('HOST_REPO_DIR', process.cwd());
const claudeJson = join(os.homedir(), '.claude.json');
if (existsSync(claudeJson)) upsert('CLAUDE_JSON_HOST', claudeJson);

writeFileSync(envPath, content);
