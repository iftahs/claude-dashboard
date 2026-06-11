export const WEEKS = 18; // ~4 months
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', '']; // rows Sun..Sat, label odd rows

export function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function color(tokens: number, max: number): string {
  if (tokens === 0) return '#1b1b22';
  const t = Math.min(1, Math.sqrt(tokens / Math.max(1, max)));
  const a = 0.2 + t * 0.8;
  return `rgba(217, 119, 87, ${a.toFixed(2)})`;
}
