# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **local, offline** dashboard for Claude Code usage. The backend reads the JSON logs Claude Code already writes under `~/.claude` and serves aggregated JSON; the React UI visualizes it. No API key, no login. Any network calls reuse the OAuth token Claude Code stores locally to hit Anthropic's OAuth endpoints (live usage via `/api/usage/live`, and the live plan via `/api/config`); nothing else leaves the machine.

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

There is **no test suite and no linter** configured. Correctness is enforced by TypeScript `strict` mode plus `noUnusedLocals`/`noUnusedParameters` — a clean `tsc -b` is the bar.

### Pointing at a different data folder

`CLAUDE_DIR` overrides the scanned folder (default `~/.claude`). `COWORK_DIR` overrides the Cowork desktop root (default is OS-specific — see `coworkDir()` in `scan.ts`); the dashboard auto-detects it when present, so most users never set it. `SERVER_PORT` overrides `8787` — **if you change it, also update the proxy target in `vite.config.ts`** or the UI's `/api` calls break in dev.

```powershell
$env:CLAUDE_DIR = "D:\backups\.claude"; npm run dev
```

In Docker, `~/.claude` and the Cowork root are mounted read-only at `/data/.claude` and `/data/cowork` (`CLAUDE_DIR_HOST` / `COWORK_DIR_HOST` in `.env`). `COWORK_DIR_HOST` is optional; unset, it falls back to the `.claude` mount and yields zero cowork events.

## Architecture

Two processes in dev; one in Docker. The data flow on the backend is always **scan → cache → aggregate → endpoint**.

### Backend (`server/`, plain TypeScript run directly by `tsx` — never compiled, even in Docker)

- **`scan.ts`** — the only code that touches disk. Recursively reads every `*.jsonl` under each of `scanRoots()`, keeps lines where `type === 'assistant'` with a `message.usage`, and emits a flat `UsageEvent[]` (timestamp, sessionId, model, token counts, tool names, **`source`**). **Dedup is by `requestId:message.id`** (shared across all roots) because streaming/retries — and the same `cliSessionId` writing to two roots — produce the same logical response multiple times. Also reads the sidecar files: `settings.json`, `.credentials.json`, `stats-cache.json`, and `usage-data/session-meta/*.json`. `fetchLiveUsage()` calls Anthropic's OAuth usage API with the stored access token (30s in-memory cache); `fetchLiveProfile()` calls the OAuth *profile* API for the user's real-time plan/`rate_limit_tier` (30-min cache) — both share `oauthHeaders()`. The profile powers `/api/config`'s subscription, overriding the stale `subscriptionType` in `.credentials.json`.
- **Scan roots / `source`** — `scanRoots()` returns `<claudeDir>/projects` (`source: 'code'`) plus, when present, the **Cowork** desktop root (`source: 'cowork'`). Cowork = the desktop app's "local agent mode": it writes standard Claude Code JSONL under `<coworkDir>/<acct>/<profile>/<sessionId>/.claude/projects/**/*.jsonl`, so the existing parser ingests it unchanged. `keepScanFile()` keeps only cowork files under a `.claude/projects/` segment (skips `audit.jsonl`/metadata). `coworkDir()` defaults per-OS (win32 `%APPDATA%/Claude/...`, darwin `~/Library/Application Support/Claude/...`, linux `~/.config/Claude/...`) and is overridable via `COWORK_DIR`. **`insights-scan.ts` walks the same `scanRoots()`** so the Sessions/Insights tabs stay in sync. Cowork `projectPath` is left blank (sandbox-internal paths are meaningless on the host) → excluded from the Projects tab. **Caveats:** Cowork runs in *full-VM sandbox* mode keep transcripts inside the VM → not captured; **Claude Chat has no usable local token data** (server-side only) and is out of scope beyond `/api/usage/live`.
- **`cache.ts`** — wraps `scanEvents()` in a 5s TTL cache keyed off a cheap fingerprint (newest `mtime` across all jsonl files). All `/api/usage/*` endpoints go through `getEvents()`; a full re-scan only happens when files actually changed.
- **`aggregate.ts`** — pure functions (`buildRecent`, `buildWeekly`, `buildModels`, `buildActivity`, `buildTools`) that bucket the event array by time. No I/O. This is where the domain rules live (see below).
- **`pricing.ts`** — regex→price table for the *estimated equivalent API cost* only (subscription usage has no real per-token bill). **Order in `TABLE` matters**: specific patterns (e.g. `opus-4-[5-8]`) must precede generic fallbacks (`opus`), first match wins.
- **`index.ts`** — Express routes. Every response is wrapped as `{ data, computedAt, claudeDir }` (the `Envelope`). Query params are clamped server-side (e.g. `hours` 1–72, `days` 7–28). Usage/sessions routes accept `?source=all|code|cowork` (`filterSource()` narrows events before the builder runs). **`GET /api/sources`** reports per-surface event counts and `cowork.available` — the frontend gates **all** Cowork UI on it so Code-only users see the original dashboard unchanged. When `dist/` exists it also serves the static UI with an SPA fallback for non-`/api` routes.

### Domain rules to preserve

These are deliberate and easy to break:

- **Effective tokens = input + output + cacheCreate.** Cheap cache *reads* are excluded because they don't count toward rate limits. `totalTokens` includes cache reads; `effectiveTokens` does not. Keep the two distinct.
- **The "current 5-hour block"** is anchored on the **most recent `sessionId`**, not a wall-clock window — it mirrors how Anthropic starts a 5h window at a session's first message. `prevTotals` is the session immediately before it.
- **Weekly reset** is computed as the next Monday 01:00 UTC (`nextMondayReset`).
- `<synthetic>` model and zero-token models are filtered out of model shares.
- The activity heatmap is derived **live from events**, falling back to `stats-cache.json` only for days with no live data (the cache is otherwise stale).

### Frontend (`src/`)

- **`App.tsx`** is the whole layout: a tabbed dashboard (Live / Agents / Trends / Models / Insights / Sessions). Each data source is an independent `usePolling(url, intervalMs)` call — there is no global store. Polling intervals differ per endpoint (5s for live usage charts, 15s for the live API, 30–60s for slow-moving data). A header **source** toggle (Code / Cowork / All) is rendered **only when `/api/sources` reports `cowork.available`**; it appends `&source=` to the data URLs via `withSrc()` — when Cowork is absent the URLs (and the whole UI) are unchanged.
- **`hooks/usePolling.ts`** — generic fetch-on-interval hook returning `{ data, computedAt, claudeDir, error, loading }` unwrapped from the `Envelope`.
- **`hooks/useLimits.ts`** — user-set USD spend caps persisted in `localStorage` (key `claude-dashboard-limits-v2`); purely client-side, never sent to the backend.
- Components live in `components/design-system/{atoms,molecules,organisms}/` (atomic design). One folder per component: `Name.tsx` (component only), `types.ts` (all prop interfaces), `utils.ts` (module-level helpers), and — atoms only — `Name.variants.ts` with `class-variance-authority` variants. Shared primitives: `ProgressBar`, `ToggleGroup`, `Badge`, `LegendDot` (atoms); `Section`, `ChartTooltip`, `HoverTooltip`, `ExportButton` (molecules) — reuse these instead of re-inlining track/fill divs, button groups, pills, or tooltip cards. Imports across folders use the `@/` alias (→ `src/`); same-folder imports stay relative.
- `lib/format.ts` (compact numbers, USD, labels) and `lib/palette.ts` (per-model colors) are shared helpers. Charts use `recharts`. Styling is Tailwind with a custom `ink`/`clay` palette and `darkMode: 'class'`.
- `types.ts` mirrors the backend's aggregate shapes — when you change an `aggregate.ts` return type, update `types.ts` to match.

## Conventions

- Server files import each other with explicit `.ts` extensions (`./scan.ts`) — required by the `allowImportingTsExtensions` + `tsx` setup. Keep that.
- New `/api/usage/*` data should flow through `getEvents()` (don't re-scan disk directly) and be returned via the `wrap(...)` envelope.
