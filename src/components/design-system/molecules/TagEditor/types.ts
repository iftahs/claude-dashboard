export type TagEditorMode = { kind: 'idle' } | { kind: 'add' } | { kind: 'rename'; tag: string };

export interface TagEditorProps {
  value: readonly string[];
  onChange: (tags: string[]) => void;
  label: string;
  suggestions?: readonly string[];
  addLabel?: string;
  className?: string;
}
