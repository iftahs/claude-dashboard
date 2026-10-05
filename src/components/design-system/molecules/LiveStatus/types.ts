export type LiveStatusState = 'live' | 'paused' | 'error';

export interface LiveStatusProps {
  state: LiveStatusState;
  label?: string;
  className?: string;
  captionClassName?: string;
}
