# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **local-first** dashboard for Claude Code usage. The backend reads the JSON logs Claude Code already writes under `~/.claude` and serves aggregated JSON; the React UI visualizes it. No API key, no login. Network calls for *your* data reuse the OAuth token Claude Code stores locally to hit Anthropic's OAuth endpoints (live usage via `/api/usage/live`, and the live plan via `/api/config`); no usage data, paths, or transcripts leave the machine. The **only** outbound exception is anonymous product analytics (PostHog) — see "Frontend / analytics" below; it's opt-out and ships no PII.

## Commands

```bash
npm run dev          # starts backend (tsx watch, :8787) + Vite UI (:5180) via concurrently
npm run build        # tsc -b (typecheck, no emit) then vite build → dist/
npm run preview      # serve the built dist/ with Vite
npx tsc -b           # typecheck only (there is no separate lint/test script)
```

Docker (single Express process serves API + built UI on :8787, mounts `~/.claude` read-only):

```bash
npm run docker:up    # docker compose up -d --build  (rebuild + restart after code changes)
npm run docker:down
npm run docker:logs
```

> **This app usually runs in Docker — there is no live/HMR refresh.** When running in Docker, after **every** code change you must run `npm run docker:up` to rebuild + restart, or the change won't be visible.

`docker:up` has a `predocker:up` hook running three host-side scripts:

1. `scripts/sync-macos-keychain.mjs` (macOS only) — copies the Claude.ai OAuth token from the Keychain into `~/.claude/.dashboard-oauth-cache.json`; see `readCredentials()` below for why.
2. `scripts/token-sync-agent.mjs ensure` (macOS only) — installs a **launchd LaunchAgent** (`com.claude-dashboard.token-sync`, log at `~/Library/Logs/claude-dashboard/token-sync.log`) that re-runs that sync every 15 min. Without the agent the cache is a one-shot snapshot whose access token expires within hours and Docker live usage degrades to "OAuth token expired"; the container re-reads the cache file on every request, so a host-side re-sync heals it instantly with no rebuild. Manual controls: `npm run token-sync` (one-shot), `token-sync:install` / `token-sync:status` / `token-sync:uninstall`. **Deliberately no in-container `refresh_token` flow** — Anthropic rotates refresh tokens, and a second consumer could invalidate the host's Claude Code login.
3. `scripts/write-host-repo-dir.mjs` (all OSes) — upserts `HOST_REPO_DIR=<repo path>` into `.env` so the container can render a runnable resume-watcher command on the Auto-Resume page.

Steps 1–2 are a no-op on non-macOS hosts (there, Claude Code refreshes `.credentials.json` itself).

There is **no test suite and no linter** configured. Correctness is enforced by TypeScript `strict` mode plus `noUnusedLocals`/`noUnusedParameters` — a clean `tsc -b` is the bar.

### Pointing at a different data folder

`CLAUDE_DIR` overrides the scanned folder (default `~/.claude`). `COWORK_DIR` overrides the Cowork desktop root (default is OS-specific — see `coworkDir()` in `scan.ts`); the dashboard auto-detects it when present, so most users never set it. `SERVER_PORT` overrides `8787` — **if you change it, also update the proxy target in `vite.config.ts`** or the UI's `/api` calls break in dev.

```powershell
$env:CLAUDE_DIR = "D:\backups\.claude"; npm run dev
```

In Docker, `~/.claude` and the Cowork root are mounted read-only at `/data/.claude` and `/data/cowork` (`CLAUDE_DIR_HOST` / `COWORK_DIR_HOST` in `.env`). `COWORK_DIR_HOST` is optional; unset, it falls back to the `.claude` mount and yields zero cowork events.

Frontend build-time vars (`VITE_*`, baked by `vite build` — in Docker they pass through `build.args` in `docker-compose.yml`, see the `ARG`s in the Dockerfile build stage): `VITE_DISABLE_ANALYTICS=1` ships a telemetry-free build; `VITE_POSTHOG_TOKEN` / `VITE_POSTHOG_HOST` override the analytics project token/host.

## Architecture

Two processes in dev; one in Docker. The data flow on the backend is always **scan → cache → aggregate → endpoint**.

### The scan pipeline (`scan-pass.ts` → `merge.ts` → `data.ts`, cached by `event-store.ts`)

There used to be **two** independent scanners — `scan.ts::scanEvents` and `insights-scan.ts::scanInsights` — each with its own recursive walk, its own fingerprint, its own TTL cache, and its own `JSON.parse` over the same ~1.1 GB. Both were primed concurrently at boot and fought over the disk and the libuv threadpool, making a cold start ~10s. Now:

- **`scan-pass.ts`** — the only code that reads transcript JSONL. One walk, one read, one `JSON.parse` per line, emitting flat per-file rows for *both* consumers. Pure extraction: **no cross-file reduction happens here.** Reads with a bounded pool of `PARSE_CONCURRENCY = 8` (measured optimum: 1→4.28s, 8→3.11s, 16→3.27s, 24→3.74s — the scan is CPU-bound on `JSON.parse`, not I/O; the raw read floor is 0.69s). Preserves two inherited behaviours deliberately: usage rows come from every file, but **insight rows only from files ≤ 5 MB**; and cowork transcripts get an empty `projectPath`.
- **`merge.ts`** — pure, no I/O. Reduces per-file rows into `UsageEvent[]` + `InsightsData`. **All dedup lives here and must stay here:** 28.4% of dedup keys appear in more than one file and 75 of 189 sessions span multiple files, so per-file aggregates cannot be pre-summed without double-counting. `sessionsMeta` is *derived* at merge time, never persisted pre-summed.
- **`data.ts`** — owns the pipeline and both public getters (`getEvents`, `getInsights`), with a 5s TTL and single-flight. Caches parsed rows per file by `(path, mtime, size)`, so a re-scan only re-parses files that actually changed (typically ~27/day out of 2,431).
- **`event-store.ts`** — persists those rows to SQLite (built-in `node:sqlite`, hence the node 24 base image) at `DASHBOARD_CACHE_DIR`, one JSON blob per file version. This is what makes a restart cheap: **cold start went 10.8s → ~2.6s in Docker.** Fail-soft by design — if SQLite is unavailable the app just parses from scratch. Bump `SCHEMA_VERSION` when `FileRows` changes.
- **`cache.ts` / `insights-scan.ts`** — now thin facades over `data.ts` (plus the shared record types) so existing call sites are unchanged. Don't put scanning logic back into them.

> **In Docker the cache needs the `claude-dashboard-cache` named volume** (see `docker-compose.yml`). `docker:up` runs `up -d --build`, which replaces the container — anything on the container filesystem is discarded, so without a named volume the cache would be pointless. Deleting the volume is always safe; it rebuilds.

Two parser subtleties worth not re-breaking:

- **Dedup tool calls by `tool_use.id`, never by `requestId:message.id`.** Only 10,173 of 45,420 distinct tool ids appear on the *first* line for a message key — earlier lines are streaming placeholders whose content arrives later. Keying on the message would silently drop ~78% of tool calls. (The old scanner had the opposite bug: it never skipped duplicates at all, inflating `assistantMsgs` 3.06×, `toolCallCount` 1.44× and `subagentSpawns` 1.58×.)
- **Split lines on `\n`, not with `readline`.** Node's `readline` treats `U+2028`/`U+2029` as line terminators, but they are legal inside JSON strings — it shredded those records into fragments that all failed to parse, silently discarding them.

### Backend (`server/`, plain TypeScript run directly by `tsx` — never compiled, even in Docker)

- **`scan.ts`** — path/root helpers (`claudeDir`, `scanRoots`, `keepScanFile`), sidecar readers and the OAuth/network calls. Recursively reads every `*.jsonl` under each of `scanRoots()`, keeps lines where `type === 'assistant'` with a `message.usage`, and emits a flat `UsageEvent[]` (timestamp, sessionId, model, token counts, tool names, **`source`**). **Dedup is by `requestId:message.id`** (shared across all roots) because streaming/retries — and the same `cliSessionId` writing to two roots — produce the same logical response multiple times. Also reads the sidecar files: `settings.json`, `.credentials.json`, `stats-cache.json`, and `usage-data/session-meta/*.json`. **`readCredentials()`** doesn't just read `.credentials.json`: on macOS, Claude Code often keeps the real `claudeAiOauth` block in the Keychain (service `"Claude Code-credentials"`) instead. It reads both `.credentials.json` and `.dashboard-oauth-cache.json` in `claudeDir()` — the latter written (and kept fresh every 15 min by the token-sync LaunchAgent) by `scripts/sync-macos-keychain.mjs` for Docker, which can't reach the host Keychain — and when both hold a token returns whichever has the **latest `expiresAt`** (ties → `.credentials.json`), falling back to a live `security find-generic-password` shell-out (host/dev only). `fetchLiveUsage()` calls Anthropic's OAuth usage API with the stored access token (30s in-memory cache); `fetchLiveProfile()` calls the OAuth *profile* API for the user's real-time plan/`rate_limit_tier`/`seat_tier`/`has_extra_usage_enabled` (30-min cache) — both share `oauthHeaders()`. The profile powers `/api/config`'s `subscriptionType` (`pro`/`max_5x`/`max_20x`/`team`/`enterprise`/`free`, classified off `account.has_claude_max`/`has_claude_pro`/`organization.organization_type`), overriding the stale value in `.credentials.json`. The live usage payload also carries `extra_usage`/`spend` — Anthropic's "pay standard API rates once you exceed your plan limit" overage/credits mechanism — passed through unchanged to `/api/usage/live` and rendered by `ExtraUsageCard`.
- **Scan roots / `source`** — `scanRoots()` returns `<claudeDir>/projects` (`source: 'code'`) plus, when present, the **Cowork** desktop root (`source: 'cowork'`). Cowork = the desktop app's "local agent mode": it writes standard Claude Code JSONL under `<coworkDir>/<acct>/<profile>/<sessionId>/.claude/projects/**/*.jsonl`, so the existing parser ingests it unchanged. `keepScanFile()` keeps only cowork files under a `.claude/projects/` segment (skips `audit.jsonl`/metadata). `coworkDir()` defaults per-OS (win32 `%APPDATA%/Claude/...`, darwin `~/Library/Application Support/Claude/...`, linux `~/.config/Claude/...`) and is overridable via `COWORK_DIR`. **`insights-scan.ts` walks the same `scanRoots()`** so the Sessions/Insights tabs stay in sync. Cowork `projectPath` is left blank (sandbox-internal paths are meaningless on the host) → excluded from the Projects tab. **Caveats:** Cowork runs in *full-VM sandbox* mode keep transcripts inside the VM → not captured; **Claude Chat has no usable local token data** (server-side only) and is out of scope beyond `/api/usage/live`.
- **`cache.ts`** — facade re-exporting `getEvents` from `data.ts` (see the scan pipeline above). All `/api/usage/*` endpoints still go through `getEvents()`.
- **`aggregate.ts`** — pure functions (`buildRecent`, `buildWeekly`, `buildModels`, `buildActivity`, `buildTools`) that bucket the event array by time. No I/O. This is where the domain rules live (see below).
- **`pricing.ts`** — regex→price table for the *estimated equivalent API cost* only (subscription usage has no real per-token bill). **Order in `TABLE` matters**: specific patterns (e.g. `opus-4-[5-8]`) must precede generic fallbacks (`opus`), first match wins.
- **`index.ts`** — Express routes. Every response is wrapped as `{ data, computedAt, claudeDir }` (the `Envelope`). Query params are clamped server-side (e.g. `hours` 1–72, `days` 7–28). Usage/sessions routes accept `?source=all|code|cowork` (`filterSource()` narrows events before the builder runs). **`GET /api/sources`** reports per-surface event counts and `cowork.available` — the frontend gates **all** Cowork UI on it so Code-only users see the original dashboard unchanged. When `dist/` exists it also serves the static UI with an SPA fallback for non-`/api` routes.
- **`auto-resume.ts`** — resumes interrupted work after a usage-limit reset (opt-in via the **Auto-Resume** page). While armed, a `setInterval` tick polls `fetchLiveUsage()`; when the 5-hour (or, opt-in, weekly) limit hits 100% it captures **every recently-active session** (`getLiveSubagents()` main agents, up to `AUTO_RESUME_MAX_SESSIONS`=5; fallback `getInsights()` latest) and schedules **one `ResumeJob` per session** for `resets_at + 1 min`; executors run multiple due jobs sequentially, never in parallel. **Only real session UUID files qualify (`isResumableSessionFile`) — `agent-*.jsonl` subagent transcripts are NOT resumable** (`claude --resume agent-…` errors). **The spawn cwd is read from the session JSONL tail's `cwd` field — never the decoded directory name, which is lossy.** Jobs are in-memory, derived state re-created idempotently (id = `windowKind:resetsAtMs:sessionId`) while the limit stays exhausted; **prefs persist to `~/.claude-dashboard-auto-resume.json`** (homedir is writable even in Docker) so the backend re-arms itself after a restart, with the frontend's localStorage re-POST (`configured:false`) as fallback after an image rebuild. Execution happens on the **host**: `scripts/resume-watcher.mjs` (`npm run resume-watcher`) polls `GET /api/auto-resume/pending` (the poll doubles as its heartbeat), claims due jobs, and spawns `claude -p --resume <sessionId>` with the prompt on **stdin** (never argv — cmd.exe quoting); when no watcher heartbeat is fresh and the backend itself runs on the host with the CLI on PATH, it executes internally instead. Endpoints: `GET/POST /api/auto-resume/state`, `GET .../pending`, `POST .../jobs/:id/claim|complete`, `POST .../test` (schedules a real resume of the latest session — the E2E lever, but it *will* spawn claude). Env knobs: `AUTO_RESUME_THRESHOLD`, `AUTO_RESUME_DELAY_MS`, `AUTO_RESUME_FORCE_DELAY_MS`, `AUTO_RESUME_POLL_MS`, `AUTO_RESUME_CLAIM_TIMEOUT_MS`; `OAUTH_API_BASE` redirects the OAuth usage fetch to a local mock for E2E-testing the detection loop without exhausting a real limit. Cowork sessions excluded (v1).

### Domain rules to preserve

These are deliberate and easy to break:

- **Effective tokens = input + output + cacheCreate.** Cheap cache *reads* are excluded because they don't count toward rate limits. `totalTokens` includes cache reads; `effectiveTokens` does not. Keep the two distinct.
- **The "current 5-hour block"** is anchored on the **most recent `sessionId`**, not a wall-clock window — it mirrors how Anthropic starts a 5h window at a session's first message. `prevTotals` is the session immediately before it.
- **Weekly reset** is computed as the next Monday 01:00 UTC (`nextMondayReset`).
- `<synthetic>` model and zero-token models are filtered out of model shares.
- The activity heatmap is derived **live from events**, falling back to `stats-cache.json` only for days with no live data (the cache is otherwise stale).

### Frontend (`src/`)

- **`App.tsx`** is the whole layout: a tabbed dashboard (Live / Agents / Trends / Models / Insights / Sessions). All eleven tabs are **`React.lazy`** behind one `<Suspense>` — statically importing them put every chart plus all of recharts into a single 1.19 MB entry chunk before anything could paint (entry is now ~42 kB, with `recharts` / `posthog` / `react` split out via `manualChunks` in `vite.config.ts`). The tabs use named exports, so each `lazy()` remaps `{ default: m.XTab }`. Each data source is an independent `usePolling(url, intervalMs)` call — there is no global store. Polling intervals differ per endpoint (5s for live usage charts, 15s for the live API, 30–60s for slow-moving data). A header **source** toggle (Code / Cowork / All) is rendered **only when `/api/sources` reports `cowork.available`**; it appends `&source=` to the data URLs via `withSrc()` — when Cowork is absent the URLs (and the whole UI) are unchanged.
- **`hooks/usePolling.ts`** — generic fetch-on-interval hook returning `{ data, computedAt, claudeDir, error, loading }` unwrapped from the `Envelope`. Three things it does on purpose: a module-level **in-flight map** collapses concurrent requests for the same URL onto one fetch (two hooks polled `/api/auto-resume/state` simultaneously, and StrictMode doubles every mount in dev); polls **pause while `document.hidden`** and fire a catch-up tick on return (the 2.5s and 4s polls previously ran forever in a backgrounded tab); and there is deliberately **no `AbortController`** — aborting on unmount would cancel the shared request for other live subscribers, and the in-flight map already prevents the duplication that abort was meant to solve.
- **`hooks/useLimits.ts`** — user-set USD spend caps persisted in `localStorage` (key `claude-dashboard-limits-v2`); purely client-side, never sent to the backend.
- Components live in `components/design-system/{atoms,molecules,organisms}/` (atomic design). One folder per component: `Name.tsx` (component only), `types.ts` (all prop interfaces), `utils.ts` (module-level helpers), and — atoms only — `Name.variants.ts` with `class-variance-authority` variants. Shared primitives: `ProgressBar`, `ToggleGroup`, `Badge`, `LegendDot` (atoms); `Section`, `ChartTooltip`, `HoverTooltip`, `ExportButton` (molecules) — reuse these instead of re-inlining track/fill divs, button groups, pills, or tooltip cards. Imports across folders use the `@/` alias (→ `src/`); same-folder imports stay relative.
- `lib/format.ts` (compact numbers, USD, labels) and `lib/palette.ts` (per-model colors) are shared helpers. Charts use `recharts`. Styling is Tailwind with a custom `ink`/`clay` palette and `darkMode: 'class'`.
- **`lib/analytics.ts`** — anonymous product analytics via PostHog (`posthog-js` + `@posthog/react`, provider in `main.tsx`). Only **explicit, path-free** events are sent (`track('tab_viewed' | 'source_changed' | 'insight_range_changed' | 'export_clicked', …)`); **autocapture and session replay are disabled** so the on-screen project paths/session IDs are never scraped. Never pass paths, cwd, session IDs, or transcript text to `track()`. Gated by `analyticsEnabled()`: on only in PROD builds, with a real token, when `VITE_DISABLE_ANALYTICS!=='1'`, and the user hasn't opted out (`localStorage` key `claude-dashboard-analytics-optout`, toggled in `SettingsModal` → Telemetry). The project token is a publishable ingest-only key (placeholder by default — replace `PLACEHOLDER_TOKEN` or set `VITE_POSTHOG_TOKEN`).
- `types.ts` mirrors the backend's aggregate shapes — when you change an `aggregate.ts` return type, update `types.ts` to match.

## Conventions

- Server files import each other with explicit `.ts` extensions (`./scan.ts`) — required by the `allowImportingTsExtensions` + `tsx` setup. Keep that.
- New `/api/usage/*` data should flow through `getEvents()` (don't re-scan disk directly) and be returned via the `wrap(...)` envelope.
