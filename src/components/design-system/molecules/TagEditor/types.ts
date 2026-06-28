export interface TagEditorProps {
  /** Current tags. */
  value: string[];
  /** Called with the next full tag list on add/remove. */
  onChange: (tags: string[]) => void;
  /** Existing tags elsewhere, offered as one-click quick-adds while editing. */
  suggestions?: string[];
  /** Label for the add affordance. */
  placeholder?: string;
}
