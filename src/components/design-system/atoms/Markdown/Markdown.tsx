import { cn } from '@/lib/cn';
import type { InlineToken, MarkdownProps } from './types';
import { parseBlocks } from './utils';

export function Markdown({ text, className }: MarkdownProps) {
  const renderInline = (tokens: InlineToken[]) =>
    tokens.map((token) => {
      if (token.kind === 'text') return token.text;
      if (token.kind === 'code') {
        return (
          <code key={token.key} className="rounded-tag bg-surface-hover px-1 py-0.5 font-mono text-mono text-fg">
            {token.text}
          </code>
        );
      }
      if (token.kind === 'strong') {
        return (
          <strong key={token.key} className="font-semibold text-fg">
            {token.text}
          </strong>
        );
      }
      return <em key={token.key}>{token.text}</em>;
    });

  return (
    <div className={cn('space-y-0.5 text-body text-fg-muted', className)}>
      {parseBlocks(text).map((block) => {
        if (block.kind === 'heading') {
          return (
            <p key={block.key} className={cn('mt-2 text-fg', block.level === 1 ? 'text-heading' : 'text-body font-medium')}>
              {renderInline(block.inline)}
            </p>
          );
        }
        if (block.kind === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag key={block.key} className={cn('my-1 space-y-0.5 pl-5', block.ordered ? 'list-decimal' : 'list-disc')}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={block.key} className="my-0.5">
            {renderInline(block.inline)}
          </p>
        );
      })}
    </div>
  );
}
