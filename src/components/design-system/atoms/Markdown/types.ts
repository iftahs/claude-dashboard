export interface MarkdownProps {
  text: string;
  className?: string;
}

export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'code' | 'strong' | 'em'; key: string; text: string };

export type MarkdownBlock =
  | { kind: 'heading'; key: string; level: number; inline: InlineToken[] }
  | { kind: 'list'; key: string; ordered: boolean; items: InlineToken[][] }
  | { kind: 'paragraph'; key: string; inline: InlineToken[] };

export interface PendingList {
  ordered: boolean;
  items: string[];
}
