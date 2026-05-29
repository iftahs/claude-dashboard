const COLORS = ['#d97757', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#22d3ee', '#a78bfa'];

const assigned = new Map<string, string>();
let next = 0;

export function modelColor(model: string): string {
  let c = assigned.get(model);
  if (!c) {
    c = COLORS[next % COLORS.length];
    next += 1;
    assigned.set(model, c);
  }
  return c;
}
