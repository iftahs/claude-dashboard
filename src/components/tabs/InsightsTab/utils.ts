import { compact } from '@/lib/format';
import type { Platform } from '@/hooks/useSource';
import type { InsightKpis, InsightsSummary } from '@/types';

export type InsightDays = '7' | '14' | '30';
export const INSIGHT_DAY_OPTIONS: { value: InsightDays; label: string }[] = [
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: '30', label: '30d' },
];

/** A rate as a percentage, or 'n/a' when the rate does not apply (null). */
function pct(rate: number | null | undefined, digits = 1): string {
  return rate === null || rate === undefined ? 'n/a' : `${(rate * 100).toFixed(digits)}%`;
}

/** "Claude 2.5% · Codex 11.2%" for the Both view ('—' for a platform with no data). */
function splitLine(s: InsightsSummary, pick: (k: InsightKpis) => number | null, digits = 1): string {
  const one = (k: InsightKpis | null) => (k ? pct(pick(k), digits) : '—');
  return `Claude ${one(s.byPlatform.claude)} · Codex ${one(s.byPlatform.codex)}`;
}

export interface KpiCard {
  key: string;
  label: string;
  value: string;
  sub: string;
  accent?: string;
  help: string;
}

/**
 * The Insights KPI row. Each figure is shown here and nowhere else on the tab — the
 * panels below break it down (by category, by tool, by stage) without repeating it.
 */
export function kpiCards(s: InsightsSummary | null, platform: Platform): KpiCard[] {
  const loading = 'loading…';
  const both = platform === 'both';
  const failure: KpiCard = {
    key: 'failure',
    label: 'Failure rate',
    value: s ? pct(s.failureRate) : '—',
    sub: !s ? loading : both ? splitLine(s, (k) => k.failureRate) : `${compact(s.failures)} failed / ${compact(s.totalCalls)} calls`,
    accent: '#f87171',
    help:
      'Share of tool calls that ran and came back with an error. Rejections — calls declined before they ran — are not failures; they have their own rate. Lower is better.',
  };

  // Counts the panels below do not show; their own breakdowns (by kind, stage,
  // type) stay theirs.
  const rejectionSub = (): string => {
    if (!s) return loading;
    if (both) return splitLine(s, (k) => k.rejectionRate);
    return `${compact(s.rejections)} ${platform === 'codex' ? 'stopped' : 'declined'} / ${compact(s.totalCalls)} calls`;
  };
  const rejection: KpiCard = {
    key: 'rejection',
    label: 'Rejection rate',
    value: s ? pct(s.rejectionRate) : '—',
    sub: rejectionSub(),
    accent: '#f59e0b',
    help:
      platform === 'codex'
        ? 'Share of Codex actions that never ran: denied by the guardian auto-reviewer, or declined by you when Codex asked.'
        : platform === 'both'
          ? "Share of tool calls that never ran: Claude permission prompts you declined, and Codex actions its guardian auto-reviewer denied or you declined."
          : 'Share of tool calls you declined when Claude asked for permission.',
  };

  const commit: KpiCard = {
    key: 'commit',
    label: 'Commit rate',
    value: s ? pct(s.commitRate, 0) : '—',
    sub: !s ? loading : both ? splitLine(s, (k) => k.commitRate, 0) : 'of sessions in a git repo',
    accent: '#34d399',
    help:
      'Share of sessions in a git repo that ran a successful git commit — a proxy for work that landed. Sessions outside any repo (a chat in a scratch folder) could never commit and are left out.',
  };

  const delegation: KpiCard =
    platform === 'codex'
      ? {
          key: 'delegation',
          label: 'Auto-review rate',
          value: s ? pct(s.autoReviewRate, 0) : '—',
          sub: s ? 'of threads got a guardian review' : loading,
          accent: '#6366f1',
          help:
            "Share of Codex threads the guardian auto-reviewer checked at least once — the ChatGPT desktop app's approval pass over the actions a turn wants to take. Each verdict is one review.",
        }
      : both
        ? {
            key: 'delegation',
            label: 'Delegation · Auto-review',
            value: s
              ? `${pct(s.byPlatform.claude?.delegationRate ?? null, 0)} · ${pct(s.byPlatform.codex?.autoReviewRate ?? null, 0)}`
              : '—',
            sub: 'Claude subagents · Codex guardian',
            accent: '#6366f1',
            help:
              "Left: share of Claude sessions that handed work to a subagent (Task/Agent tool). Right: share of Codex threads the guardian auto-reviewer checked. A guardian review is a safety check on an action, not delegated work, so the two are never blended.",
          }
        : {
            key: 'delegation',
            label: 'Delegation rate',
            value: s ? pct(s.delegationRate, 0) : '—',
            sub: s ? 'of sessions used a subagent' : loading,
            accent: '#6366f1',
            help: 'Share of sessions that handed work to a subagent (Task/Agent tool). Indicates how often work is delegated.',
          };

  return [failure, rejection, commit, delegation];
}

export interface PanelCopy {
  title: string;
  help: string;
}

/** Section titles / help that differ per platform. Claude copy is the original wording. */
export function panelCopy(platform: Platform) {
  const codex = platform === 'codex';
  const both = platform === 'both';
  return {
    errors: {
      title: 'Tool errors · failure analysis',
      help: `Tool calls that ran and failed in this window, by failure category (left) and by tool (right), with failures per day. Each tool's percentage is its own failure rate. Declined or denied calls never ran and are counted under Rejections instead.${
        codex || both
          ? " Codex failures: a shell command that exited non-zero is 'Command failed', a patch that did not apply 'Patch failed', and an MCP tool's error 'MCP error'."
          : ''
      }`,
    },
    tools: {
      title: 'Tool usage · calls by tool',
      help: codex
        ? 'How many times each tool was invoked in this window, ranked. Codex tool calls are shown under common tool names — a shell command is Bash (Read / Grep / LS when it only reads or searches), a file patch is Edit / Write, and MCP calls read as server · tool.'
        : both
          ? 'How many times each tool was invoked in this window, ranked. Codex tool calls are mapped onto the same tool names as Claude\'s, so the two platforms rank in one list.'
          : 'How many times each tool was invoked in this window, ranked. Reflects which tools the work relied on most.',
    },
    mcp: {
      title: 'MCP vs built-in · tool call split',
      help: `How tool calls split between ${
        codex ? "Codex's" : both ? "each agent's" : "Claude's"
      } built-in tools and tools from connected MCP servers. The per-server table lists call counts and how many failed, one row per MCP server.`,
    },
    rejections: {
      title: codex
        ? 'Guardian denials & declines · by tool'
        : both
          ? 'Rejections · declines & guardian denials'
          : 'Permission rejections · by tool',
      help: codex
        ? "Codex actions that never ran, by tool: denied by the guardian auto-reviewer (its verdict names no tool, so these read 'Guardian deny') or declined by you when Codex asked. High counts flag actions Codex keeps attempting that get stopped."
        : both
          ? 'Calls that never ran, by tool: Claude permission prompts you declined, and Codex actions denied by its guardian auto-reviewer or declined by you.'
          : 'Tool calls you declined when Claude asked for permission, grouped by tool. High counts flag tools Claude reaches for that you often block.',
    },
    retries: {
      title: 'Edit retries · one-shot analysis',
      help: codex
        ? 'Codex patches are never retried: each apply_patch either applies, fails or is declined, and the next patch is a new change — so there is no one-shot rate to measure.'
        : `Edit/Write calls that succeeded first try vs those retried after an error, with the estimated tokens and cost wasted on the retries.${
            both ? ' Claude edits only — Codex patches never retry.' : ''
          }`,
      naText: codex ? "Codex doesn't retry edits — a patch applies, fails or is declined, and the next one is a new change." : undefined,
      note: both ? 'Claude edits only — Codex patches never retry.' : undefined,
    },
    languages: {
      title: 'Languages · edits by file type',
      help: 'Files touched in this window, bucketed by extension into a language. Solid = edits/writes; dimmed = reads. Shows what kinds of files the work concentrated on.',
    },
    branches: {
      title: 'Branches · token usage by git branch',
      help: `Effective tokens, cost and session count attributed to each git branch (shown as repo / branch). Reflects which branches the most work went into.${
        codex || both
          ? " Codex reads the branch and remote from the thread's git metadata; a chat thread that starts outside a repo records none."
          : ''
      }`,
      emptyText: codex ? 'No branch data — Codex chat threads run outside a git repo.' : undefined,
    },
    complexity: {
      title: `Session complexity · tool calls vs tokens (dot size = ${
        codex ? 'guardian reviews' : both ? 'subagents / guardian reviews' : 'subagents'
      })`,
      help: `One dot per session: x = number of tool calls, y = effective tokens, dot size = ${
        codex
          ? 'guardian auto-reviews (one per verdict)'
          : both
            ? 'Claude subagents spawned, or Codex guardian reviews'
            : 'subagents spawned'
      }. Dots to the upper-right are the heaviest, most complex sessions.`,
    },
    turns: {
      title: 'Turn latency · time per turn and to first token',
      help: `How long a turn took — from your prompt to the agent's last reply or tool call — and how long until its first reply. Median is the typical turn, p90 the slow tail.${
        codex
          ? ' Codex records each turn\'s duration and time to first token itself.'
          : both
            ? " Claude turns are measured from the transcript (capped at 6 h); Codex records its own. Under Both the histogram stacks the two."
            : ' Claude turns are measured from the transcript, capped at 6 h.'
      }`,
    },
    yield: {
      title: 'Yield · sessions → commit → PR',
      help: 'Of the sessions in this window: how many ran in a git repo (a branch or remote was recorded, or the session ran git), how many committed, and how many of those opened a pull request. Sessions outside any repo sit apart instead of counting as misses. Lists the biggest uncommitted repo sessions.',
    },
    subagents: {
      title: codex
        ? 'Guardian reviews · auto-review analysis'
        : both
          ? 'Subagents & guardian reviews'
          : 'Subagent stats · delegation analysis',
      help: codex
        ? 'Guardian auto-reviews in this window — one per verdict — with how many were denied and the average per reviewed thread; other Codex subagents (/review, spawned threads) are counted apart. Their tokens are folded into the parent thread and priced at zero.'
        : both
          ? "Claude subagent spawns and Codex guardian reviews, counted apart; the type and model breakdowns list both."
          : 'Subagent (Task/Agent) spawns in this window: total, average per delegating session, and breakdowns by subagent type and model.',
    },
    commands: {
      title: 'Commands · slash commands & skills',
      help: codex
        ? "Codex logs no slash commands, and loading a skill is only a file read inside a shell command — there is nothing to count yet."
        : `Slash commands you typed (Claude Code's prompt history) and the skills that ran (each counted once per session that ran it).${
            both ? ' Claude only — Codex records neither.' : ''
          }`,
      emptyText: codex ? 'No command data — Codex logs no slash commands or skill runs.' : undefined,
    },
    churn: {
      title: 'File churn · most-edited files',
      help: `Files edited most often in this window. Hover a row for the full path. High churn flags the files the work concentrated on.${
        codex || both ? ' A file a Codex chat edits outside its own folder is labelled with the project that holds it.' : ''
      }`,
    },
  } satisfies Record<string, PanelCopy & Record<string, unknown>>;
}
