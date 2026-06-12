# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.5]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.5
[0.1.4]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.4
[0.1.3]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.3
[0.1.2]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.2
[0.1.1]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.1
[0.1.0]: https://github.com/iftahs/claude-dashboard/releases/tag/v0.1.0
