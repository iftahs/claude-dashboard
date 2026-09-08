/**
 * insights-scan.ts — record types for the analytics/insights endpoints.
 *
 * This file used to contain a second, independent scanner: its own recursive walk,
 * its own fingerprint (stat on every file), its own 30s TTL cache, and its own
 * JSON.parse over the same ~1.1 GB that scan.ts had just parsed. The two ran
 * concurrently at boot and competed for the same disk and libuv threadpool.
 *
 * The extraction now happens once in scan-pass.ts and the reduction in merge.ts,
 * both owned by data.ts. Only the shared types and the public getters remain here,
 * so existing call sites are untouched.
 *
 * Three counters changed when the scanner was replaced, because the old code
 * dedup-guarded token accounting but then fell through without `continue`
 * (the `// Skip duplicate regardless` comment described behaviour that did not
 * exist). Streaming retries were therefore counted repeatedly:
 *   assistantMsgs  118,633 -> 38,826 distinct message ids  (was 3.06x inflated)
 *   toolCallCount   65,243 -> 45,420 distinct tool_use ids (was 1.44x inflated)
 *   subagentSpawns     575 ->    364 distinct Task ids     (was 1.58x inflated)
 * These are corrections, not regressions.
 */
import type { UsageSource } from './scan.ts';

export interface ToolCallRecord {
  ts: number;
  sessionId: string;
  name: string;
  isSidechain: boolean;
  mcpServer: string | null;
  filePath: string | null;
  gitBranch: string;
  projectPath: string;
  id: string;
  source: UsageSource;
}

export interface ToolResultRecord {
  id: string; // tool_use_id
  is_error: boolean;
  rejected: boolean;
  errorText: string; // first 200 chars when is_error
}

export interface TaskSpawnRecord {
  ts: number;
  sessionId: string;
  id: string; // tool_use_id
  subagentType: string;
  model: string | null;
  description: string;
  agentIdFromResult: string | null;
  completed: boolean;
  gitBranch: string;
  projectPath: string;
  source: UsageSource;
}

export interface SessionMetaRecord {
  sessionId: string;
  isSidechain: boolean;
  firstTs: number;
  lastTs: number;
  turns: number;
  assistantMsgs: number;
  toolCallCount: number;
  errorCount: number;
  rejectionCount: number;
  subagentSpawns: number;
  compactions: number;
  committed: boolean;
  gitCommits: number;
  gitPushes: number;
  firstPrompt: string;
  gitBranch: string;
  projectPath: string;
  models: Record<string, number>;
  effectiveTokens: number;
  cost: number;
  file: string;
  agentId?: string;
  source: UsageSource; // 'code' = Claude Code CLI, 'cowork' = desktop local-agent mode, 'codex' = OpenAI Codex rollout
}

export interface InsightsData {
  toolCalls: ToolCallRecord[];
  toolResults: Map<string, ToolResultRecord>;
  taskSpawns: TaskSpawnRecord[];
  sessionsMeta: Map<string, SessionMetaRecord>;
  searchCorpus: Map<string, string>;
}

export { getInsights, dataFingerprint as insightsFingerprint } from './data.ts';
