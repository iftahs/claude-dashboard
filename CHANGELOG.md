# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.11] - 2026-06-26

### Fixed
- Eliminate false "needs attention" alerts for delegating and idle agents.
- Adjust error handling to trigger only on user rejection, reducing unnecessary alerts for failed tool uses.

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
