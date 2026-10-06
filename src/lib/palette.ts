// Model colours are fixed per model, never handed out by encounter order: a model
// keeps its colour in every chart, on every tab, in every session.
// Warmth encodes price: fable and mythos red, opus amber, sonnet green, haiku blue.
// OpenAI models sit outside that ladder on violet. A family keeps one hue and the
// version picks a step.
// The values live in src/styles/tokens.json, one per theme where a step needs it,
// and are checked with the dataviz skill's validate_palette.js (all pairs, on the
// card surface of each theme). Several steps sit in the validator's floor bands, so
// identity never rests on colour alone: every chart with two or more series ships
// a legend and names the model in its tooltip. Re-run the validator after any change.

const token = (name: string) => `rgb(var(--${name}))`;

// First match wins, so a specific pattern sits above its family fallback (mirrors TABLE in server/pricing.ts).
const MODEL_TABLE: Array<[RegExp, string]> = [
  [/fable-5-1|fable-5\.1/i, token('model-fable-1')],
  [/fable/i, token('model-fable-2')],
  [/mythos-5-1|mythos-5\.1/i, token('model-mythos-1')],
  [/mythos/i, token('model-mythos-2')],
  [/opus-5-5|opus-5\.5/i, token('model-opus-1')],
  [/opus-5|opus-4-[5-8]|opus-4\.[5-8]/i, token('model-opus-2')],
  [/opus/i, token('model-opus-3')],
  [/sonnet-5-5|sonnet-5\.5/i, token('model-sonnet-1')],
  [/sonnet/i, token('model-sonnet-2')],
  [/haiku-4/i, token('model-haiku-1')],
  [/haiku-3/i, token('model-haiku-2')],
  [/haiku/i, token('model-haiku-3')],
  [/gpt-5\.6-sol|gpt-5\.5/i, token('model-gpt-2')],
  [/gpt-6-sol|gpt-5\.6-terra|gpt-5\.3-codex/i, token('model-gpt-1')],
  [/gpt-6-luna|gpt-5\.6-luna|gpt-5\.4-mini/i, token('model-gpt-4')],
  [/gpt-6/i, token('model-gpt-3')],
  [/gpt|codex/i, token('model-gpt-5')],
];

const UNKNOWN_COLORS = [1, 2, 3, 4].map((n) => token(`model-unknown-${n}`));

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export function modelColor(model: string): string {
  for (const [re, color] of MODEL_TABLE) if (re.test(model)) return color;
  return UNKNOWN_COLORS[hashIndex(model, UNKNOWN_COLORS.length)];
}

// Lowest first, one ramp step each (mirrors EFFORT_ORDER in server/aggregate.ts).
const EFFORT_LEVELS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
const EFFORT_UNKNOWN_COLOR = token('effort-unknown');

export function effortColor(effort: string): string {
  const step = EFFORT_LEVELS.indexOf(effort) + 1;
  return step > 0 ? token(`effort-${step}`) : EFFORT_UNKNOWN_COLOR;
}

// Tags have their own cycle so a tag and a model never share a colour by construction.
const TAG_COLORS = [1, 2, 3, 4, 5, 6, 7].map((n) => token(`tag-${n}`));
const tagAssigned = new Map<string, string>();
let tagNext = 0;

export const UNTAGGED_COLOR = token('tag-untagged');

export function tagColor(tag: string): string {
  let c = tagAssigned.get(tag);
  if (!c) {
    c = TAG_COLORS[tagNext % TAG_COLORS.length];
    tagNext += 1;
    tagAssigned.set(tag, c);
  }
  return c;
}
