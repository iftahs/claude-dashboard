export type ElapsedTimeFormat = 'elapsed' | 'ago';

export interface ElapsedTimeProps {
  since: number;
  format?: ElapsedTimeFormat;
  intervalMs?: number;
  className?: string;
}
