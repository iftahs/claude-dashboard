import { cva } from 'class-variance-authority';

export const aiChatBubbleVariants = cva('min-w-0 max-w-[min(48rem,85%)] rounded-card px-4 py-2.5 text-body', {
  variants: {
    kind: {
      user: 'whitespace-pre-line bg-accent-soft text-fg',
      assistant: 'border border-line bg-surface-sunken text-fg-muted',
      error: 'whitespace-pre-line bg-danger-soft text-danger-fg',
    },
  },
  defaultVariants: {
    kind: 'assistant',
  },
});
