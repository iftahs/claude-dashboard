export interface SessionSearchStripProps {
  query: string;
  /** How far back to search (days; the server caps it at 90). */
  days: number;
  onJump: (sessionId: string) => void;
  /** Label each hit with its platform (the Both view). */
  showSourceBadge: boolean;
}
