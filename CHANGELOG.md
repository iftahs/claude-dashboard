# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.26] - 2026-09-08

### Added
- OpenAI Codex (ChatGPT desktop) as a second platform. The rollouts under ~/.codex are
  parsed into the same event pipeline (source: codex), and a Claude / Codex / Both
  switcher in the header re-points the whole dashboard — every tab reads the selected
  platform, so there is no separate Codex tab. Guardian auto-review threads fold into
  their parent. The original Code / Cowork / All source toggle stays as a Claude-side
  sub-filter, and users with no ~/.codex never see the switcher at all.
- Under Codex: live 5-hour / weekly limits, plan tier, credits and reset credits (read
  with the token the app stores, never refreshed; passive fallback from the newest
  rollout when offline), running threads and guardian reviews with the Claude agents
  treatment, and a server-vs-local daily token comparison. Claude-only destinations
  (Workflows, Workspace) and panels (git branches, permission rejections,
  slash commands) drop out instead of rendering empty.
- Under Both: a Claude-vs-Codex daily chart, a three-way Claude Code / Cowork / Codex
  sources split, per-platform sub-labels on the Trends spend cards, and both vendors'
  rate cards on Models.
- Pricing rows for gpt-5.5 / gpt-5.6 (sol, terra, luna) / gpt-6-astra; the internal
  codex-auto-review model is unpriced. A violet palette family for GPT models.
- CODEX_DIR / CODEX_DIR_HOST (auto-written by npm run docker:up, blank to opt out)
  and a read-only /data/.codex mount in docker-compose.

### Fixed
- The scan fingerprint now folds in total bytes, so a file that grows without its
  mtime changing (Codex guardian rollouts) no longer leaves memoised aggregates stale.

### Removed
- The Auto-Resume feature (Auto-Resume page, `/api/auto-resume/*`, the host
  resume-watcher scripts and the `HOST_REPO_DIR` env). It was unreliable and Claude
  Code now handles limit resets itself. `~/.claude-dashboard-auto-resume.json` can be
  deleted.

## [0.1.25] - 2026-09-07

### Added
- Claude Fable 5.1 support: its own pricing row (cache reads are $0.25/MTok, a quarter
  of Fable 5, so cached-heavy Fable 5.1 sessions were overstated), a distinct red
  palette step so 5 and 5.1 are separable in one chart, a Cost Calculation row, and
  the model in the AI Insights picker.

### Changed
- AI Insights requests to Fable / Mythos (5 and 5.1) send `output_config.effort: low`
  — they always think and share `max_tokens` with the answer, and reject every
  explicit `thinking` setting — and a `refusal` stop reason now surfaces as a named
  error instead of "Empty response from model".

## [0.1.24] - 2026-07-25

### Added
- Claude Opus 5 support across pricing, colors, labels and the Models tab. It was
  previously falling through to the legacy-Opus row and billing at $15/$75 instead of
  $5/$25, overstating every cost figure in the app by 3×.
- Busiest-hour and busiest-day summaries above the two Trends heatmaps.

### Changed
- Default AI Insights model is now Claude Opus 5. Because it thinks by default and
  `max_tokens` covers thinking plus the answer, requests to models in that class now
  disable thinking so short replies don't truncate.
- Amber palette steps are ordered by generation rather than price, so Opus 5 and Opus
  4.8 are distinguishable in the same chart.
- `PlanUsage` matches the model family out of Anthropic's `display_name`, so per-model
  weekly bars keep their color if the API starts reporting a generation with it.

## [0.1.23] - 2026-07-21

### Added
- Show live plan and limits for each logged-in account in a side-by-side view.
- Accumulate distinct tokens in a network-free JSON file for active Keychain logins.
- Introduce a new API endpoint to resolve account identity and return live limits for each account.
- Update the dashboard to display account-specific live usage when multiple accounts are known.

## [0.1.22] - 2026-07-19

### Added
- Documents the scan pipeline and its parser pitfalls for better user understanding.
- Introduces a cache named volume to persist scan data, enhancing performance during restarts.
- Adds endpoint snapshot and cold-start measurement tools to ensure output consistency.

### Changed
- Optimizes tab loading by implementing code-splitting and deferring non-essential components, improving initial load times.
- Refactors the scan process to cache parsed rows across restarts, significantly reducing cold start times.
- Updates the Docker setup to use the latest node base image, improving compatibility with SQLite.
- Changes JSON line splitting logic to prevent data loss in parsing, enhancing reliability.

### Fixed
- Corrects the insights deduplication guard logic, ensuring accurate counting of tool calls.
- Resolves issues with JSON parsing that caused records containing special characters to fail.
- Fixes session identification logic to ensure accurate UUID resolution for auto-resume functionality.

## [0.1.21] - 2026-07-18

### Added
- Allow forks to redirect analytics to their own PostHog project by passing the VITE_POSTHOG_TOKEN and VITE_POSTHOG_HOST through build arguments, enabling custom reporting.
- Tag analytics events with `app_version` and add an `app_opened` event to improve product analytics and ensure each session is reliably segmented.

### Changed
- Update .env.example to include documentation for new environment variables related to PostHog configuration.
- Modify the Dockerfile and docker-compose.yml to support passing new build arguments for analytics customization.
- Enhance the analytics module to fire new events with improved attributes, ensuring better data quality without collecting new user information.

## [0.1.20] - 2026-07-16

### Added
- Introduced per-agent detail and phase/label attribution for live runs.
- Added a new route to fetch detailed agent information lazily during workflows.
- Enhanced `WorkflowAgentInfo` to include additional fields for better agent tracking.
- Implemented UUID filter for session files during auto-resume.
- Added grant arrays to job types and state schema.
- Surfaced the current 5-hour limit utilization in the browser tab title.

### Changed
- Improved model color assignment per family in the palette, ensuring consistent representation across tabs.
- Updated the AutoResumeView to reflect asynchronous spawn behavior accurately.
- Refactored session file processing for better handling of temporary JSON settings. 

### Fixed
- Addressed issues with array grants in the auto-resume feature.
- Fixed session transcript handling to skip non-UUID files.

## [0.1.19] - 2026-07-14

### Added
- Display per-run cost and readable timestamps in the UI for better cost tracking.
- Enable Insights chat to access every dashboard dataset for improved inquiries about workflow costs.
- Include per-run estimated cost and all-time run rankings in the workflow data. 

### Fixed
- Correctly format run timestamps to show relative time more accurately.
- Resolve chat UI issues preventing proper message handling and avoiding permanent "thinking…" states.

## [0.1.18] - 2026-07-13

### Fixed
- Docker on macOS no longer degrades to "OAuth token expired" a few hours after `docker:up`: a new token-sync LaunchAgent (auto-installed by `npm run docker:up`, managed via `npm run token-sync:install|status|uninstall`) re-copies the Keychain OAuth token into the cache file the container reads every 15 minutes — the running container heals without a rebuild.
- Prefer the credential source (`.credentials.json` vs `.dashboard-oauth-cache.json`) with the latest `expiresAt`, so a stale file can no longer shadow a freshly synced token.
- Classify upstream `401` responses as "token expired" (previously shown as a generic connection error), and make the expired-token message runtime-aware (Docker vs host) in both the API and the toast.

### Added
- `npm run token-sync` one-shot Keychain → cache sync, plus `token-sync:install` / `token-sync:status` / `token-sync:uninstall` for the LaunchAgent; sync log at `~/Library/Logs/claude-dashboard/token-sync.log`. The sync script now writes atomically (0600) and skips no-op/regressive writes.

## [0.1.17] - 2026-07-13

### Added
- Introduced Auto-Resume feature to automatically resume interrupted sessions after a usage-limit reset.
- Added Claude Sonnet 5 pricing and AI model option to the pricing table and model picker.
- Updated README with accurate feature descriptions and new screenshots for all major components.
- Documented additional features including Extra Usage, limits-contributors panel, project tagging, and more.

### Changed
- Enhanced plan-usage display to show exact reset countdown and absolute reset times.
- Updated the user interface for Auto-Resume, including a new page and status indicators.
- Improved screenshot quality and updated images to reflect the latest app design.
- Revised documentation to correct inaccuracies about features and app behavior.

### Fixed
- Corrected the formatting for reset countdowns to accurately reflect remaining time.
- Fixed issues with the README that contained false statements regarding data availability and file references.

## [0.1.16] - 2026-07-09

### Fixed
- Ensure bundled CLI credentials are correctly seeded from macOS Keychain cache.
- Improve error handling when the CLI's credentials file lacks an OAuth token. 

### Changed
- Internal maintenance and tooling.

## [0.1.15] - 2026-07-08

### Fixed
- Detect Claude Team subscriptions correctly, preventing incorrect fallback to API mode.
- Add Keychain support for OAuth tokens on macOS, ensuring proper detection of Team/Enterprise accounts.
- Introduce a synced cache file for Docker users to access Keychain data.
- Classify organization types into subscription types 'team'/'enterprise' more accurately.
- Display overage/credit-pool info from Anthropic in a new Live tab card.

## [0.1.14] - 2026-07-06

### Added
- Introduced a panel displaying limits usage breakdown on the Live tab.
- Added per-model weekly bars in the Plan Usage view from the live limits API.

### Changed
- Enhanced UsageEvent with additional attribution data.
- Improved contributor resolution logic for session cost calculations.
- Derived per-model weekly bars utilizing the new limits structure.
- Updated the method for handling non-OK responses from OAuth endpoints to provide accurate service outage messages.

### Fixed
- Addressed the handling of Anthropic 5xx outages for more reliable user messaging and retry logic.

## [0.1.13] - 2026-06-27

### Added
- Introduce animated live-tab badges with count-up and flash-on-increase effects (via framer-motion).
- Add useCountUp and useFlashOnIncrease hooks; wire the animated badges into the Agents header.

### Changed
- Speed up the live-subagents poll (4s → 2.5s) for snappier live feedback.

## [0.1.12] - 2026-06-26

### Fixed
- Stop false "needs attention" alerts on delegating/idle agents for a more accurate status display.
- Track last tool use to prevent misreading delegation as waiting when it’s not. 
- Ensure that only genuine user rejections trigger an error state, reducing unnecessary alerts.

## [0.1.11] - 2026-06-26

### Added
- Group recent workflow runs by date with headers for Today, Yesterday, and earlier periods.
- Display all-time stats in a compact 3x3 grid above the recent runs.
- Expand the recent workflows window from 7 days to 90 days and increase the run cap from 20 to 200.
- Implement an API endpoint to retrieve all-time workflow statistics.
- Add a rough single-rate cost estimate based on blended token rates.

### Changed
- Memoize internal workflow-summary parsing for cheaper repeated scans.

### Fixed
- Eliminate false "needs attention" alerts for delegating and idle agents.
- Trigger the error state only on user rejection, not on benign failed tool uses, reducing unnecessary alerts.

## [0.1.10] - 2026-06-25

### Added
- Introduced a traffic-light status for agents, indicating their state (green for finished, yellow for running, red for needing attention).
- Implemented browser notifications for agent status changes.

### Changed
- Improved aggregation performance by memoizing builder outputs, reducing the processing time during frequent polls.
- Refactored the UI to separate business logic into hooks and components for better maintainability and readability.
- Extracted reusable organisms from inlined IIFEs in the App component.
- Introduced dedicated contexts to manage cross-cutting concerns more efficiently.

## [0.1.9] - 2026-06-21

### Fixed
- Clear saved API key when switching AI providers to prevent credential leaks.
- Scrub sensitive path/sessionId keys from model prompts to honor AI privacy.
- Align Node engine requirement with dependencies to ensure compatibility.

## [0.1.8] - 2026-06-21

### Added
- Introduced a left sidebar navigation with ten deep-linkable views for easier access.
- Added a Workflows tab to display live and recent dynamic workflow runs.
- Implemented a Workspace tab for managing tasks and plugins inventory.
- Launched AI Insights for privacy-safe usage aggregates and section explanations.
- Updated the Notifications system with a unified toast and settings modal as a full-screen view.
- Introduced anonymous PostHog product analytics to measure install count and feature usage.

### Fixed
- Implemented a fallback for the PostHog token if the environment variable is empty, ensuring analytics events are sent.

## [0.1.7] - 2026-06-14

### Added
- API / pay-as-you-go usage mode: auto-detected from your Claude credentials, with a
  cost view (estimated spend per block, spend-vs-caps) replacing the subscription
  rate-limit framing for users without a Claude.ai subscription token.
- Settings modal (⚙) with a manual usage-mode override and spending-cap configuration.

### Changed
- The "session expired" banner now only shows for subscription users; API users see a
  neutral "API · pay-as-you-go" note instead.

## [0.1.6] - 2026-06-12

### Added
- Show the live subscription plan from Anthropic's profile API in the Subscription card. 
- Map subscription types to display live plan tiers such as "Max 5x". 

### Changed
- Adjusted Subscription card behavior to fall back on local credentials when offline or when the token is expired.

## [0.1.5] - 2026-06-12

### Added
- Changelog entries are now generated automatically on every pull request: a free
  GitHub Models step reads the PR's changes and writes the matching entry in CI.

## [0.1.4] - 2026-06-12

### Added
- This changelog, with retroactive entries for every prior release.

### Changed
- The in-app "update available" banner's **View changelog** link now points at
  this file instead of the raw commit log.

## [0.1.3] - 2026-06-12

### Added
- **Claude Cowork usage tracking** — JSONL written by the Cowork desktop app's
  "local agent mode" is now ingested alongside the `~/.claude` logs.
- Header **source filter** (Code / Cowork / All), shown only when Cowork data is
  present, so Code-only users see the original dashboard unchanged.
- Per-card help tips explaining what each metric means.

### Changed
- Scan and aggregation performance improvements.

## [0.1.2] - 2026-06-11

### Fixed
- Update-banner commands are now emitted one per line instead of being joined
  with `&&`, which is a parse error in Windows PowerShell 5.1.

## [0.1.1] - 2026-06-11

### Added
- **Insights tab** with an analytics API and live subagent detection.
- Dedicated **Agents tab** with live main-session agents, a delegating state, and
  plan usage shown above the agents.
- **Live session history** with a per-session modal, transcripts (LTR), and search.
- In-app **"update available" banner** and an auto version-bump CI workflow.
- Richer config profile and content-height cards with scrollable lists.

### Changed
- Refactored the UI into an atomic design system.
- Idle main sessions now dim after 30s and drop after 60s; completed subagents no
  longer keep an idle parent card alive.

### Fixed
- Accurate token dedup and local-timezone day buckets.
- Heatmap tooltips anchored correctly at edge columns.

## [0.1.0] - 2026-06-10

### Added
- Initial local, offline Claude Code usage dashboard that reads the `~/.claude`
  logs: current 5-hour block, weekly trends, model breakdown, tool usage, and an
  activity heatmap.
- **Docker setup** — a single Express process serves the API and built UI on
  `:8787` with `~/.claude` mounted read-only.
- 4-tab layout, API-cost estimation with user-set spend limits, a daily
  Tokens/Cost toggle with projections, skeleton loading states, and a
  macOS/Linux offline-commands banner.

### Fixed
- Windows path resolution.
- Live-API fallback to the local logs when there is no active block
  (`resets_at = null`).

[0.1.23]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.23
[0.1.22]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.22
[0.1.21]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.21
[0.1.20]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.20
[0.1.19]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.19
[0.1.18]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.18
[0.1.17]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.17
[0.1.16]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.16
[0.1.15]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.15
[0.1.14]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.14
[0.1.13]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.13
[0.1.12]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.12
[0.1.11]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.11
[0.1.10]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.10
[0.1.9]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.9
[0.1.8]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.8
[0.1.7]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.7
[0.1.6]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.6
[0.1.5]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.5
[0.1.4]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.4
[0.1.3]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.3
[0.1.2]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.2
[0.1.1]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.1
[0.1.0]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.0
