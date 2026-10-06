import type { SourcesSplitRowView } from '@/lib/views/trends';

export const NO_COST = '-';

export function barLabel(rows: readonly SourcesSplitRowView[]): string {
  return rows.map((row) => `${row.label} ${row.percent}`).join(', ');
}
