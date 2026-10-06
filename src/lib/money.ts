export function parseDollar(s: string): number | null {
  const v = parseFloat(s.replace(/[$,\s]/g, ''));
  if (Number.isNaN(v) || v <= 0) return null;
  return v;
}

export function fmt(n: number | null): string {
  if (n == null) return '';
  return String(n);
}
