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

// Separate assigner so user tags get stable, distinct colors without sharing the
// model color map (which would make a tag and a model collide on the same hue).
const tagAssigned = new Map<string, string>();
let tagNext = 0;

/** Neutral gray for the catch-all "Untagged" bucket — never drawn from the palette. */
export const UNTAGGED_COLOR = '#52525b';

export function tagColor(tag: string): string {
  let c = tagAssigned.get(tag);
  if (!c) {
    c = COLORS[tagNext % COLORS.length];
    tagNext += 1;
    tagAssigned.set(tag, c);
  }
  return c;
}
