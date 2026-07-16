/**
 * Model colors are FIXED per model family — never handed out by encounter order.
 * Color follows the entity: `sonnet-5` is the same green in every chart, on every
 * tab, in every session. (The old cycling assigner repainted a model whenever the
 * set of visible series changed.)
 *
 * Warmth encodes price — hotter = more expensive per Mtok (blended rate, see
 * server/pricing.ts):
 *
 *   fable / mythos   10/50  → red     ── hottest
 *   opus             5/25   → amber      (legacy opus 15/75 takes the brighter step)
 *   sonnet           3/15   → green
 *   haiku            1/5    → blue    ── coldest
 *
 * Within a family the hue is constant and the version picks a step, so the family
 * stays readable at a glance.
 *
 * The four family hues are validated (dataviz validate_palette.js, all-pairs, both
 * modes, surfaces #1c1c24 / #ffffff): lightness band, chroma floor, normal-vision
 * floor (worst 15.6) and contrast all PASS. Red↔amber sits at deutan ΔE 6.3 — the
 * floor band — which is legal only because identity never rests on color alone: every
 * chart with ≥2 series ships a legend and names the model in its tooltip. Keep that
 * pairing if you touch these values, and re-run the validator.
 */
const MODEL_TABLE: Array<[RegExp, string]> = [
  // Order matters: specific patterns before generic fallbacks, first match wins
  // (mirrors the TABLE in server/pricing.ts).
  [/fable/i, '#e5484d'], // red
  [/mythos/i, '#b93b3f'], // red, deeper step — same price tier as fable
  [/opus-4-[5-8]|opus-4\.[5-8]/i, '#c98500'], // amber
  [/opus/i, '#eda100'], // legacy opus (15/75) — brighter amber, it costs more
  [/sonnet-5/i, '#008300'], // green
  [/sonnet/i, '#199e70'], // older sonnets — green family, aqua step
  [/haiku-4/i, '#3987e5'], // blue
  [/haiku-3/i, '#2a78d6'], // blue, deeper step
  [/haiku/i, '#1f5fa8'], // legacy haiku — deepest blue
];

/** Off-ramp hues for models the table doesn't know yet (never a generated color). */
const UNKNOWN_COLORS = ['#9085e9', '#d55181', '#4a3aa7', '#1baf7a'];

/** Stable across sessions and series sets — the same name always lands on the same hue. */
function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export function modelColor(model: string): string {
  for (const [re, color] of MODEL_TABLE) if (re.test(model)) return color;
  return UNKNOWN_COLORS[hashIndex(model, UNKNOWN_COLORS.length)];
}

// Separate assigner so user tags get stable, distinct colors without sharing the
// model color map (which would make a tag and a model collide on the same hue).
const TAG_COLORS = ['#d97757', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#22d3ee', '#a78bfa'];
const tagAssigned = new Map<string, string>();
let tagNext = 0;

/** Neutral gray for the catch-all "Untagged" bucket — never drawn from the palette. */
export const UNTAGGED_COLOR = '#52525b';

export function tagColor(tag: string): string {
  let c = tagAssigned.get(tag);
  if (!c) {
    c = TAG_COLORS[tagNext % TAG_COLORS.length];
    tagNext += 1;
    tagAssigned.set(tag, c);
  }
  return c;
}
