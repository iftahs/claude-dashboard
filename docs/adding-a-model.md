# Adding support for a new Claude model

## Why this needs a checklist

The dashboard hardcodes per-model pricing, colors and labels in several tables. A model
that isn't in them **doesn't error** — it falls through a generic fallback and is
silently mis-priced. When Opus 5 shipped it matched only the bare `/opus/i` row and
billed at legacy-Opus $15/$75 instead of $5/$25, inflating every USD figure on Live,
Trends, Models, Sessions, Projects, Contributors and Workflows by 3× until someone
noticed.

Nothing here is caught by a typecheck. Work through the list.

## Where the numbers come from

- `https://platform.claude.com/docs/en/about-claude/models/overview.md` — model IDs, context, status
- `https://platform.claude.com/docs/en/pricing.md` — input/output $ per MTok

Take IDs and prices from those two pages only. Don't infer a model ID from a pattern
and don't add a date suffix that isn't published — a wrong ID silently matches nothing
and lands right back in the generic fallback.

`PRICING_DATA` in
[`CostCalculation/utils.ts`](../src/components/design-system/organisms/CostCalculation/utils.ts)
is the repo's ledger of what's already known — check there first.

## The files, and the trap in each

| File | What to add | The trap |
|---|---|---|
| [`server/pricing.ts`](../server/pricing.ts) | the ID in the regex row for its price tier | **Order is load-bearing, first match wins.** A new `opus-*` added *below* the bare `/opus/i` row is dead code and prices at $15/$75. Specific always precedes generic. |
| [`src/lib/palette.ts`](../src/lib/palette.ts) | a hue, mirroring pricing.ts | The newest generation of a family takes that family's **canonical** hue; the previous generation steps aside. See below before picking a value. |
| [`CostCalculation/utils.ts`](../src/components/design-system/organisms/CostCalculation/utils.ts) | a `PRICING_DATA` row, positioned by tier | `PRICING_DATA[0]` is the cost calculator's **default selection**, and `popular: true` decides whether the row shows before "Show other models". |
| [`src/hooks/useAiConfig.ts`](../src/hooks/useAiConfig.ts) | the ID in `PROVIDER_MODELS.claude` | Index 0 is the **client-side default** for AI Insights. |
| [`src/lib/format.ts`](../src/lib/format.ts) | only if the version format is genuinely novel | `shortModel` is duplicated in `AgentActivity/utils.ts`; both must change together. |

## Palette: validate, don't eyeball

Model colors are fixed per family and encode price by warmth. If you touch
`src/lib/palette.ts`, run the `dataviz` skill's validator rather than trusting your eye:

```shell
node scripts/validate_palette.js "<all hues, comma-separated>" --mode dark  --surface "#1c1c24" --pairs all
node scripts/validate_palette.js "<all hues, comma-separated>" --mode light --surface "#ffffff" --pairs all
```

The bar the palette holds itself to is the **four family hues**
(`#e5484d`, `#c98500`, `#008300`, `#3987e5`) passing every check. Within-family steps
sit below the normal-vision floor by design — identity is carried by the legend and
tooltip as well as the color.

What you must **not** introduce is a *cross-family* collision. Check any new hue against
every other family's hue and don't ship one that lands near the current worst (deutan
ΔE 3.1). Concretely: deep ambers collide with `#008300` sonnet green under protanopia
at ΔE 1.2, which is why the deep amber sits on legacy Opus — the tier that almost never
appears in a transcript — rather than on a model you'd actually see beside Sonnet.

## The server-side AI default

[`server/ai.ts`](../server/ai.ts) `DEFAULT_MODEL` tracks the newest **general-purpose
Opus-tier** model. Don't point it at Fable/Mythos (priced above Opus tier) or at a
limited-availability model. If you do bump it, `.env.example`, `docker-compose.yml` and
`README.md` all name the default too.

Also check the `THINKS_BY_DEFAULT` set in the same file. If the new model **thinks by
default** when `thinking` is omitted, add its exact alias — otherwise thinking eats the
1024-token `max_tokens` budget and the visible answer truncates mid-sentence. Add the
bare alias only (`claude-opus-5`, not a dated or gateway-prefixed form); `thinksByDefault`
strips both. Do **not** add Fable/Mythos-class models — they reject
`thinking: {type: 'disabled'}` with a 400.

## Verify

```shell
npx tsc -b
```

There is no test suite or linter, so a clean typecheck plus the manual check below is
the whole gate:

- Run the app and open **Models**. The new model should appear in the donut in its
  family's hue, visually distinct from its predecessor, and its **cost per 1M** should
  sit beside models on the same price tier — not 3× above them. That number is the
  fastest way to catch a `pricing.ts` row that never matched.
