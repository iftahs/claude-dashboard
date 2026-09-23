/**
 * transcript.ts — the session modal's turn-by-turn transcript, for both platforms.
 *
 * `/api/sessions/:id/transcript` reads one file on demand and returns the same
 * Turn shape whatever wrote it:
 *  - Claude Code / Cowork transcripts: `user` / `assistant` lines of this session
 *    (tool_result-only user lines are skipped; tool_use blocks become tool chips).
 *  - Codex rollouts: `{timestamp, type, payload}` envelopes, where the conversation
 *    lives in `event_msg/item_completed` items — UserMessage (minus the desktop app's
 *    attachment manifest), AgentMessage / Plan (assistant text), and CommandExecution
 *    / FileChange / McpToolCall / web search as tool chips on the assistant turn they
 *    follow. The model comes from the turn's `turn_context` (joined at the end,
 *    since a turn's items can precede its context line).
 *
 * Lines are split on '\n' only — never readline, which treats U+2028/U+2029 (legal
 * inside JSON strings) as line breaks. Codex lines go through the same cheap header
 * prefilter as scan-pass-codex.ts: `compacted` history replays (1–4 MB) are counted
 * from the header and never parsed, and item kinds without text (Reasoning, …) are
 * skipped before JSON.parse. Text is capped per turn; nothing here is persisted.
 */
import { createReadStream } from 'node:fs';
import type { UsageSource } from './scan.ts';

export interface TranscriptTool {
  name: string;
  brief: string;
}

export interface TranscriptTurn {
  role: 'user' | 'assistant';
  ts: number;
  text: string;
  tools: TranscriptTool[];
  model?: string;
  effectiveTokens?: number;
}

export interface TranscriptResult {
  turns: TranscriptTurn[];
  compactions: number;
  totalTurns: number;
  truncated?: boolean;
}

export interface TranscriptBuilder {
  line(line: string, index: number): void;
  finish(): { turns: TranscriptTurn[]; compactions: number };
}

const TEXT_CAP = 600;
const BRIEF_CAP = 80;
/** Above this many turns the middle is dropped: the first HEAD and the last TAIL stay. */
const TURN_LIMIT = 300;
const HEAD = 50;
const TAIL = 250;

/** Keep the opening and the most recent turns of a very long session. */
export function capTurns(turns: TranscriptTurn[]): { turns: TranscriptTurn[]; truncated: boolean } {
  if (turns.length <= TURN_LIMIT) return { turns, truncated: false };
  return { turns: [...turns.slice(0, HEAD), ...turns.slice(turns.length - TAIL)], truncated: true };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function brief(v: unknown): string {
  return str(v).replace(/\s+/g, ' ').trim().slice(0, BRIEF_CAP);
}

// ---------------------------------------------------------------------------
// Claude Code / Cowork
// ---------------------------------------------------------------------------

export function claudeTranscriptBuilder(sessionId: string): TranscriptBuilder {
  const turns: TranscriptTurn[] = [];
  let compactions = 0;

  return {
    line(line) {
      if (line.length < 2) return;
      let obj: any;
      try {
        obj = JSON.parse(line);
      } catch {
        return;
      }
      if (obj.sessionId !== sessionId && obj.session_id !== sessionId) return;
      const ts = Date.parse(obj.timestamp ?? '');
      if (Number.isNaN(ts)) return;

      if (obj.type === 'summary') {
        compactions++;
        return;
      }

      if (obj.type === 'user' && obj.message?.role === 'user') {
        const content = obj.message.content;
        let text = '';
        let toolResultOnly = true;
        if (typeof content === 'string') {
          text = content.slice(0, TEXT_CAP);
          toolResultOnly = false;
          if (/continued from a previous conversation/i.test(content)) compactions++;
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === 'text' && typeof block.text === 'string') {
              text += block.text.slice(0, TEXT_CAP - text.length);
              if (/continued from a previous conversation/i.test(block.text)) compactions++;
            }
          }
          toolResultOnly = !content.some((b: any) => b?.type !== 'tool_result');
        }
        if (toolResultOnly) return;
        turns.push({ role: 'user', ts, text: text.slice(0, TEXT_CAP), tools: [] });
        return;
      }

      if (obj.type === 'assistant' && obj.message?.role === 'assistant') {
        const usage = obj.message?.usage;
        const model: string | undefined = obj.message?.model;
        const effectiveTokens = usage
          ? (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
          : 0;
        let text = '';
        const tools: TranscriptTool[] = [];
        const content = obj.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === 'text' && typeof block.text === 'string') {
              text += block.text.slice(0, TEXT_CAP - text.length);
            }
            if (block?.type === 'tool_use') {
              const b = block.input?.description ?? block.input?.command ?? block.input?.file_path ?? '';
              tools.push({ name: str(block.name), brief: String(b).slice(0, BRIEF_CAP) });
            }
          }
        } else if (typeof content === 'string') {
          text = content.slice(0, TEXT_CAP);
        }
        turns.push({ role: 'assistant', ts, text: text.slice(0, TEXT_CAP), tools, model, effectiveTokens });
      }
    },
    finish: () => ({ turns, compactions }),
  };
}

// ---------------------------------------------------------------------------
// Codex rollouts
// ---------------------------------------------------------------------------

const CODEX_HEADER_RE =
  /^\{"timestamp":"([^"]+)",(?:"ordinal":\d+,)?"type":"(session_meta|turn_context|event_msg|compacted)"/;
const CODEX_HEADER_SCAN = 140;
/** Wide enough to reach `item.type` past the payload's thread_id and turn_id. */
const CODEX_EVENT_SCAN = 400;
const CODEX_ITEM_EVENT_RE = /"payload":\{"type":"item_completed"/;
const CODEX_ITEM_RE = /"item":\{"type":"([A-Za-z]+)"/;
/** item_completed payloads can carry base64 images; these are never parsed. */
const CODEX_MAX_LINE = 2 * 1024 * 1024;
/** Item kinds the transcript shows — everything else is skipped before JSON.parse. */
const CODEX_ITEMS = new Set([
  'UserMessage', 'AgentMessage', 'Plan', 'CommandExecution', 'FileChange', 'McpToolCall',
  'WebSearch', 'Extension', 'ImageView',
]);
/** The desktop app's injected attachment manifest — never something the user typed. */
const ATTACHMENT_MANIFEST_RE = /^#\s*Files mentioned by the user:/i;
const REQUEST_HEADING_RE = /^##\s*My request(?: for Codex)?:[ \t]*\n?/im;
const COMMAND_NAMES: Record<string, string> = { read: 'Read', search: 'Grep', list_files: 'LS' };
const CHANGE_NAMES: Record<string, string> = { add: 'Write', update: 'Edit', delete: 'Delete' };

/** The typed request after the desktop app's attachment manifest, which shares its text entry ('' if none). */
export function stripAttachmentManifest(text: string): string {
  if (!ATTACHMENT_MANIFEST_RE.test(text.trimStart())) return text;
  const m = REQUEST_HEADING_RE.exec(text);
  return m ? text.slice(m.index + m[0].length).trim() : '';
}

/** Text entries of a Codex message's `content` (`text` on user messages, `Text` on agent ones). */
function codexText(content: unknown, skipManifest: boolean): string {
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const c of content) {
    if (!c || typeof c !== 'object' || String(c.type).toLowerCase() !== 'text') continue;
    const t = skipManifest ? stripAttachmentManifest(str(c.text)) : str(c.text);
    if (!t.trim()) continue;
    parts.push(t);
  }
  return parts.join('\n\n').slice(0, TEXT_CAP);
}

/** A user message that carried files or images (a manifest, or image / local_image entries). */
function codexHasAttachment(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  return content.some((c) => {
    if (!c || typeof c !== 'object') return false;
    const type = String(c.type).toLowerCase();
    return type.includes('image') || (type === 'text' && ATTACHMENT_MANIFEST_RE.test(str(c.text).trimStart()));
  });
}

/** The tool chip for a Codex tool item, or null when the item is not a tool. */
export function codexToolChip(it: any): TranscriptTool | null {
  const declined = it?.status === 'declined';
  const failed = it?.status === 'failed';
  const mark = (b: string) => (declined ? `declined · ${b}` : failed ? `failed · ${b}` : b).slice(0, BRIEF_CAP);
  switch (it?.type) {
    case 'CommandExecution': {
      const parsed: any[] = Array.isArray(it.parsed_cmd) ? it.parsed_cmd : [];
      const first = parsed[0];
      const name = COMMAND_NAMES[str(first?.type)] ?? 'Bash';
      const command = Array.isArray(it.command) ? str(it.command[it.command.length - 1]) : str(it.command);
      const b = name !== 'Bash' ? str(first?.path) || str(first?.cmd) : str(first?.cmd) || command;
      return { name, brief: mark(brief(b)) };
    }
    case 'FileChange': {
      const entries = it.changes && typeof it.changes === 'object' ? Object.entries<any>(it.changes) : [];
      if (!entries.length) return { name: 'Edit', brief: mark('') };
      const [firstPath, firstChange] = entries[0];
      const name = CHANGE_NAMES[str(firstChange?.type)] ?? 'Edit';
      const more = entries.length > 1 ? ` (+${entries.length - 1} more)` : '';
      return { name, brief: mark(brief(firstPath) + more) };
    }
    case 'McpToolCall':
      return { name: `mcp__${str(it.server) || 'unknown'}__${str(it.tool) || 'unknown'}`, brief: mark('') };
    case 'WebSearch':
      return { name: 'WebSearch', brief: mark(brief(it.query ?? it.action?.query)) };
    case 'Extension': {
      const kind = str(it.kind);
      if (kind === 'web.search') return { name: 'WebSearch', brief: mark(brief(it.query ?? it.action?.query)) };
      if (kind === 'image_gen.generation') return { name: 'ImageGen', brief: mark('') };
      return { name: `Extension:${kind || 'unknown'}`, brief: mark('') };
    }
    case 'ImageView':
      return { name: 'Read', brief: mark(brief(it.path)) };
    default:
      return null;
  }
}

export function codexTranscriptBuilder(): TranscriptBuilder {
  const turns: TranscriptTurn[] = [];
  const turnIdOf: string[] = []; // parallel to turns: the Codex turn each came from
  const turnModel = new Map<string, string>();
  let lastModel = '';
  let compactions = 0;
  // The assistant turn tool chips attach to; -1 until the agent answers after a prompt.
  let current = -1;

  const push = (turn: TranscriptTurn, turnId: string): number => {
    turns.push(turn);
    turnIdOf.push(turnId);
    return turns.length - 1;
  };

  return {
    line(line) {
      if (line.length < 2) return;
      const h = CODEX_HEADER_RE.exec(line.length > CODEX_HEADER_SCAN ? line.slice(0, CODEX_HEADER_SCAN) : line);
      if (!h) return;
      const type = h[2];
      if (type === 'compacted') {
        compactions++; // a multi-MB history replay: counted from the header, never parsed
        return;
      }
      if (line.length > CODEX_MAX_LINE) return;
      if (type === 'event_msg') {
        const head = line.length > CODEX_EVENT_SCAN ? line.slice(0, CODEX_EVENT_SCAN) : line;
        if (!CODEX_ITEM_EVENT_RE.test(head)) return;
        const im = CODEX_ITEM_RE.exec(head);
        if (im && !CODEX_ITEMS.has(im[1])) return;
      }
      const lineTs = Date.parse(h[1]);
      let obj: any;
      try {
        obj = JSON.parse(line);
      } catch {
        return;
      }
      const p = obj?.payload;
      if (!p || typeof p !== 'object') return;

      if (type === 'turn_context') {
        const model = str(p.model) || str(p.collaboration_mode?.settings?.model);
        if (model) {
          lastModel = model;
          if (str(p.turn_id)) turnModel.set(str(p.turn_id), model);
        }
        return;
      }
      if (type !== 'event_msg' || p.type !== 'item_completed') return;
      const it = p.item;
      if (!it || typeof it !== 'object') return;
      const turnId = str(p.turn_id);
      const ts = (typeof p.completed_at_ms === 'number' && p.completed_at_ms) ||
        (typeof p.started_at_ms === 'number' && p.started_at_ms) ||
        (Number.isNaN(lineTs) ? 0 : lineTs);

      switch (it.type) {
        case 'UserMessage': {
          // A new prompt always closes the previous answer, even one with no text to show.
          current = -1;
          const text = codexText(it.content, true) || (codexHasAttachment(it.content) ? '[attachment]' : '');
          if (text) push({ role: 'user', ts, text, tools: [] }, turnId);
          return;
        }
        case 'AgentMessage': {
          const text = codexText(it.content, false);
          if (!text) return;
          current = push({ role: 'assistant', ts, text, tools: [] }, turnId);
          return;
        }
        case 'Plan': {
          const text = str(it.text).slice(0, TEXT_CAP);
          if (!text.trim()) return;
          current = push({ role: 'assistant', ts, text, tools: [{ name: 'Plan', brief: '' }] }, turnId);
          return;
        }
        default: {
          const chip = codexToolChip(it);
          if (!chip) return;
          // Tools the agent ran before saying anything get a tool-only assistant turn.
          if (current === -1) current = push({ role: 'assistant', ts, text: '', tools: [] }, turnId);
          turns[current].tools.push(chip);
        }
      }
    },
    finish() {
      for (let i = 0; i < turns.length; i++) {
        if (turns[i].role !== 'assistant') continue;
        const model = (turnIdOf[i] && turnModel.get(turnIdOf[i])) || lastModel;
        if (model) turns[i].model = model;
      }
      return { turns, compactions };
    },
  };
}

// ---------------------------------------------------------------------------
// File reading
// ---------------------------------------------------------------------------

/** Lines of a file, split on '\n' only. */
export async function* readLines(file: string): AsyncGenerator<string> {
  const stream = createReadStream(file, { encoding: 'utf8', highWaterMark: 1 << 20 });
  let carry = '';
  for await (const chunk of stream) {
    const parts = (carry + (chunk as string)).split('\n');
    carry = parts.pop() ?? '';
    for (const part of parts) yield part;
  }
  if (carry) yield carry;
}

/** Build the transcript of one session from its file. */
export async function readTranscript(file: string, sessionId: string, source: UsageSource): Promise<TranscriptResult> {
  const builder = source === 'codex' ? codexTranscriptBuilder() : claudeTranscriptBuilder(sessionId);
  let i = 0;
  for await (const line of readLines(file)) builder.line(line, i++);
  const { turns, compactions } = builder.finish();
  const capped = capTurns(turns);
  return {
    turns: capped.turns,
    compactions,
    totalTurns: turns.length,
    ...(capped.truncated ? { truncated: true } : {}),
  };
}
