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
 *   opus             5/25   → amber
 *   sonnet           3/15   → green
 *   haiku            1/5    → blue    ── coldest
 *   gpt / codex             → violet  ── the OpenAI family (Codex via the ChatGPT
 *                                        desktop app) sits outside the Claude
 *                                        warmth ladder on its own hue
 *
 * Within a family the hue is constant and the version picks a step, so the family
 * stays readable at a glance. The amber steps are ordered by generation, not by
 * price: the newest opus (5.5) takes the canonical hue, the superseded 5/25 opus
 * (5, 4.5–4.8) the brighter step, legacy opus (3.0/4.0/4.1) the deep step. That
 * ordering is measured, not aesthetic — the deep amber sits at ΔE 1.2 from sonnet-5 green under protanopia, so it has
 * to land on the tier that essentially never appears in a modern transcript.
 * The canonical ↔ brighter pair (#c98500 ↔ #eda100) separates at ΔE 9.6 normal / 9.3 CVD,
 * better than the fable↔mythos and haiku-4↔haiku-3 pairs already shipping here.
 * The red steps follow the same generation rule: fable 5.1 takes the canonical hue,
 * fable 5 the brighter step (#ff8085 — ΔE 12.7 normal / 11.9 deutan / 11.3 tritan
 * from the canonical red, the widest in-family gap in the table), and the mythos pair
 * takes the deep end — mythos 5.1 the canonical mythos red #b93b3f, superseded mythos 5
 * (and Mythos Preview) the deepest step #8e2a2f. That pair separates at ΔE 10.0 normal /
 * 8.3 protan / 10.3 tritan, and #8e2a2f's worst cross-family pair is sonnet-5 green at
 * deutan 9.0 — well clear of the table's worst, mythos↔sonnet-5 at deutan 3.1, so the
 * step adds no new collision (validator all-pairs worsts are unchanged from before it:
 * #008300↔#a86e00 protan 1.2, #2a78d6↔#3987e5 normal 4.7). #8e2a2f sits at L 0.44,
 * just under the dark band floor, and at 2.03:1 on #1c1c24 — the superseded-generation
 * relief the legacy opus amber and the deep GPT violets already take, and mythos is
 * invitation-only, so it is the tier that essentially never renders.
 *
 * The four Claude family hues are validated (dataviz validate_palette.js, all-pairs,
 * both modes, surfaces #1c1c24 / #ffffff): lightness band, chroma floor, normal-vision
 * floor (worst 15.6) and contrast all PASS. Red↔amber sits at deutan ΔE 6.3 — the
 * floor band — which is legal only because identity never rests on color alone: every
 * chart with ≥2 series ships a legend and names the model in its tooltip. Keep that
 * pairing if you touch these values, and re-run the validator.
 *
 * The violet family was validated the same way, five hues all-pairs (red, amber,
 * green, blue + #8a3af0), both modes: ALL CHECKS PASS, and the violet is not the
 * worst pair in any check (red↔amber still is). The binding constraint was haiku
 * blue under deuteranopia: violets lighter than the canonical drift into blue
 * (#8b5cf6 fails at deutan ΔE 4.1 / normal 13.5), redder ones too (#9a3ce8 5.4).
 * #8a3af0 ↔ #3987e5 lands at deutan ΔE 7.0 · tritan 14.7 · normal 18.2, and ≥ 26
 * from the other three; contrast ≥ 3:1 on both surfaces.
 *
 * Violet steps follow the price tier: the canonical hue is the 2 / 10–12 tier
 * (gpt-5.6-terra, then gpt-6-sol), pricier tiers step deeper, cheaper ones lighter,
 * and the guardian auto-review model (the most frequent GPT series in every chart,
 * priced at zero) takes the lightest step because that is the one that separates
 * best from haiku blue. Adjacent-step ΔE normal, measured on #1c1c24:
 *
 *   gpt-6-astra       #4c1d95 ↔ sol/5.5  8.7  (vs blue deutan 22.5; contrast 1.5:1 dark —
 *                                              relief by legend/tooltip)
 *   gpt-5.6-sol/5.5   #6222c4 ↔ terra   11.0  (vs blue deutan 15.0; contrast 2.1:1 dark)
 *   6-sol/5.6-terra   #8a3af0            —    canonical, validated above
 *   6-luna/5.6-luna   #a578f8 ↔ terra   13.3  (vs blue protan 3.1 — same trade as deep
 *     /5.4-mini                                amber vs green)
 *   guardian / other  #c0a8ff ↔ luna    12.6  (↔ terra 25.9; vs blue protan 13.0,
 *                                              normal 19.4; contrast 2.0:1 on white)
 *
 * The two deep steps sit below 3:1 on the dark surface, like the legacy opus amber;
 * the legend and tooltip carry identity there.
 *
 * Opus 5.5 and GPT-6 Sol / Luna (2026-09-22) reuse the validated steps instead of
 * adding hues. A scripted search over OKLCH (dataviz validator, all-pairs, both
 * surfaces) found no fourth amber that clears the floors while staying amber — the
 * best was a peach, #fcbda7, at 1.6:1 on white — and every violet lifted to ≥ 2.5:1
 * on #1c1c24 drifts into magenta, within 13 ΔE of the fable red. So the steps are
 * assigned by tier: opus 5.5 takes the canonical amber and every superseded 5/25
 * opus (5, 4.5–4.8) shares the brighter step (#c98500 ↔ #eda100 ΔE 9.6 normal /
 * 9.3 CVD); GPT models share a violet step with their price tier — 6 Sol and
 * 5.3 Codex with 5.6 Terra (1.75–2 / 10–14), 6 Luna with 5.6 Luna / 5.4 Mini, 5.6 Sol with 5.5. No hex
 * value changed, so the validator report above still holds.
 */
const MODEL_TABLE: Array<[RegExp, string]> = [
  // Order matters: specific patterns before generic fallbacks, first match wins
  // (mirrors the TABLE in server/pricing.ts).
  [/fable-5-1|fable-5\.1/i, '#e5484d'], // red — fable 5.1 takes the canonical hue
  [/fable/i, '#ff8085'], // red, brighter step — fable 5 (see the generation note above)
  [/mythos-5-1|mythos-5\.1/i, '#b93b3f'], // red, deep step — mythos 5.1 takes the mythos hue
  [/mythos/i, '#8e2a2f'], // red, deepest — superseded mythos 5 / preview (see the note above)
  [/opus-5-5|opus-5\.5/i, '#c98500'], // amber — opus 5.5 takes the canonical hue
  [/opus-5|opus-4-[5-8]|opus-4\.[5-8]/i, '#eda100'], // amber, brighter step — superseded 5/25 opus (5, 4.5–4.8)
  [/opus/i, '#a86e00'], // legacy opus (3.0/4.0/4.1) — deep amber, see the note above
  [/sonnet-5/i, '#008300'], // green
  [/sonnet/i, '#199e70'], // older sonnets — green family, aqua step
  [/haiku-4/i, '#3987e5'], // blue
  [/haiku-3/i, '#2a78d6'], // blue, deeper step
  [/haiku/i, '#1f5fa8'], // legacy haiku — deepest blue
  // OpenAI / Codex family — violet, steps by price tier (see the header for the numbers).
  [/gpt-5\.6-sol|gpt-5\.5/i, '#6222c4'], // deep violet — 4–5 / 20–30 tier
  [/gpt-6-sol|gpt-5\.6-terra|gpt-5\.3-codex/i, '#8a3af0'], // canonical violet — 1.75–2 / 10–14 tier
  [/gpt-6-luna|gpt-5\.6-luna|gpt-5\.4-mini/i, '#a578f8'], // light violet — sub-dollar tier
  [/gpt-6/i, '#4c1d95'], // deepest violet — flagship tier (gpt-6-astra, 10/50) + unlisted gpt-6-*
  [/gpt|codex/i, '#c0a8ff'], // lightest — guardian auto-review + any unlisted gpt-*
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
