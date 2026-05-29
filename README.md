# Claude Dashboard

A beautiful, **local** dashboard for your [Claude Code](https://claude.com/claude-code) usage. It reads the JSON logs Claude Code already writes to `~/.claude` and visualizes them — no API key, no account login, no network calls. Everything runs on your machine and works offline.

## Features

- **Current 5-hour block** — effective tokens used in your active session window, with a usage ring.
- **Weekly trends** — daily tokens stacked by model, with a selectable range (**1–4 weeks**) and week-over-week delta.
- **Model breakdown** — token share across Opus / Sonnet / Haiku over the last 7 days.
- **Tool usage** — which tools (Bash, Read, Edit, MCP servers…) you call most, last 7 days.
- **Activity heatmap** — a GitHub-style grid of daily effective-token usage over ~18 weeks.
- **Live auto-refresh** — polls every few seconds; no manual reload.

> **Token accounting:** "effective tokens" = input + output + cache-creation. Cheap cache reads are excluded because they don't count toward rate limits.

## Quick start

Requires [Node.js](https://nodejs.org) 18+.

```bash
git clone https://github.com/iftahs/claude-dashboard.git
cd claude-dashboard
npm install
npm run dev
```

Then open the URL Vite prints (default <http://localhost:5173>). The dashboard populates as soon as you've used Claude Code on this machine.

`npm run dev` starts two processes via `concurrently`:

- a small **Express backend** (port `8787`) that scans `~/.claude` and serves aggregated JSON,
- the **Vite** dev server for the React UI, which proxies `/api` to the backend.

## Changing the Claude data folder

By default the backend reads from your home directory:

| OS | Default path |
|----|--------------|
| Windows | `C:\Users\<you>\.claude` |
| macOS / Linux | `~/.claude` |

This is detected automatically — the path shown in the dashboard header is just *your* machine's home folder at runtime. If your logs live somewhere else (a custom install, a backup, another user's export), point the backend at it with the `CLAUDE_DIR` environment variable:

**macOS / Linux**
```bash
CLAUDE_DIR="/path/to/.claude" npm run dev
```

**Windows (PowerShell)**
```powershell
$env:CLAUDE_DIR = "D:\backups\.claude"; npm run dev
```

**Windows (cmd)**
```cmd
set CLAUDE_DIR=D:\backups\.claude && npm run dev
```

To change the backend port, set `SERVER_PORT` (default `8787`). If you change it, update the proxy target in `vite.config.ts` to match.

## What this dashboard can and can't show

It reflects **only** what Claude Code records locally. Two things deliberately are **not** shown because they don't exist in the local logs:

- **The exact rate-limit reset time** and **remaining quota** — those live in Anthropic API response headers, which Claude Code doesn't persist to disk. Any countdown would be a guess, so it's omitted.
- **Claude.ai web usage** — that's server-side per-conversation and never written to `~/.claude`.

You *can* set a personal token cap in the ⚙ limits panel to see a "% used" gauge — that compares your real measured usage against a number you enter.

## Contributing

Contributions welcome! This is an open project:

- **Found a bug or have an idea?** [Open an issue](https://github.com/iftahs/claude-dashboard/issues).
- **Want to change something?** Fork the repo, create a branch, and [open a pull request](https://github.com/iftahs/claude-dashboard/pulls).

The `main` branch is maintained by the author; all external changes go through pull requests.

## License

[MIT](LICENSE) — free to use, modify, and distribute for everyone.

## Credits

Built by **Iftah Saar** — [iftah.dev](https://iftah.dev).
