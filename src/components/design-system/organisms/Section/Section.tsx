import { useId } from 'react';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { Markdown } from '@/components/design-system/atoms/Markdown/Markdown';
import { AiInsightButton } from '@/components/design-system/molecules/AiInsightButton/AiInsightButton';
import { AiInsightInline } from '@/components/design-system/molecules/AiInsightInline/AiInsightInline';
import { CardHeader } from '@/components/design-system/molecules/CardHeader/CardHeader';
import { EmptyState } from '@/components/design-system/molecules/EmptyState/EmptyState';
import { ErrorState } from '@/components/design-system/molecules/ErrorState/ErrorState';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { cn } from '@/lib/cn';
import type { SectionProps } from './types';

export function Section({
  title,
  description,
  help,
  actions,
  children,
  as,
  grow = false,
  padding = 'md',
  className,
  ai,
  state,
}: SectionProps) {
  const titleId = useId();
  const flush = padding === 'none';
  const askable = ai && !ai.disabled ? ai : null;
  const hasData = state?.kind !== 'loading' && state?.kind !== 'error';
  const message = state?.kind === 'error' || state?.kind === 'empty';
  const result = ai?.result ?? null;

  return (
    <Card
      aria-labelledby={titleId}
      padding={padding}
      className={cn(grow && 'flex h-full flex-col', flush && 'overflow-hidden', className)}
    >
      <CardHeader
        titleId={titleId}
        title={title}
        description={description}
        help={help}
        as={as}
        className={cn(flush && 'px-4 pt-4')}
        actions={
          actions || askable ? (
            <>
              {actions}
              {askable ? (
                <AiInsightButton onClick={askable.onAsk} loading={askable.loading} className={cn(!hasData && 'invisible')} />
              ) : null}
            </>
          ) : undefined
        }
      />
      <div className={cn('min-w-0', grow && 'flex flex-1 flex-col', grow && (message ? 'justify-center' : 'justify-end'))}>
        {state?.kind === 'loading' ? (
          <SkeletonPreset
            variant={state.skeleton ?? 'text'}
            rows={state.rows}
            height={state.height}
            className={cn(flush && state.skeleton !== 'table' && 'px-4 pb-4')}
          />
        ) : null}
        {state?.kind === 'error' ? (
          <ErrorState
            title={state.title}
            description={state.description ? <Markdown inline text={state.description} /> : undefined}
            onRetry={state.onRetry}
            className={cn('py-6', flush && 'px-4')}
          />
        ) : null}
        {state?.kind === 'empty' ? (
          <EmptyState
            title={state.title}
            description={state.description ? <Markdown inline text={state.description} /> : undefined}
            icon={state.icon}
            action={state.action}
            className={cn('py-6', flush && 'px-4')}
          />
        ) : null}
        {state ? null : children}
      </div>
      {result ? (
        <AiInsightInline
          text={result.text}
          loading={result.loading}
          error={result.error}
          backendLabel={result.backendLabel}
          onDismiss={result.onDismiss}
          className={cn('mt-4', flush && 'mx-4 mb-4')}
        />
      ) : null}
    </Card>
  );
}
