import type { ReactNode } from 'react';
import type { IconName } from '@/lib/icons';
import type { AiBackend } from '@/types';

export type SectionIcon = IconName;

export type SectionSkeleton = 'text' | 'stat' | 'chart' | 'bars' | 'table' | 'gauge';

export interface SectionLoadingState {
  kind: 'loading';
  skeleton?: SectionSkeleton;
  rows?: number;
  // Height in px of the loaded body, so the card does not resize when the data lands.
  height?: number;
}

export interface SectionErrorState {
  kind: 'error';
  title: string;
  description?: string;
  onRetry?: () => void;
}

export interface SectionEmptyState {
  kind: 'empty';
  title: string;
  description?: string;
  icon?: SectionIcon;
  action?: ReactNode;
}

export type SectionState = SectionLoadingState | SectionErrorState | SectionEmptyState;

export interface SectionAiResult {
  text?: string;
  loading: boolean;
  error?: string;
  backendLabel?: string;
  onDismiss: () => void;
}

export interface SectionAi {
  onAsk: () => void;
  loading?: boolean;
  disabled?: boolean;
  result?: SectionAiResult | null;
}

// Only the Anthropic backends are named; a key the user set for another provider shows no label.
const AI_BACKEND_LABELS: Partial<Record<AiBackend, string>> = {
  cli: 'via claude -p',
  api: 'via Claude.ai',
  apikey: 'via API key',
};

export function aiBackendLabel(backend: AiBackend | undefined): string | undefined {
  return backend ? AI_BACKEND_LABELS[backend] : undefined;
}
