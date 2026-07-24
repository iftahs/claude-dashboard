# Model-watch playbook

Followed by the **"Claude model watch"** cloud routine (`trig_01WaDySYfASAFTbFT2Md7rp9`,
runs on the 1st and 15th at 06:00 UTC). The routine's prompt is one line — *"read
`docs/model-watch.md` and follow it exactly"* — so **this file is the automation**.
Edit it here and the next run picks the change up; there is nothing to redeploy.

## Why this exists

The dashboard hardcodes per-model pricing, colors and labels in half a dozen tables.
A model Anthropic ships that these tables don't know about doesn't error — it falls
through to a generic fallback and is **silently mis-priced**. When Opus 5 shipped it
was billed at legacy-Opus $15/$75 instead of $5/$25, inflating every USD figure on
Live, Trends, Models, Sessions, Projects, Contributors and Workflows by 3× until
someone noticed. This routine is the tripwire.

---

## 1. What the repo already knows

Read [`src/components/design-system/organisms/CostCalculation/utils.ts`](../src/components/design-system/organisms/CostCalculation/utils.ts) —
the `PRICING_DATA` array is the **complete ledger** of known models. Then read
[`server/pricing.ts`](../server/pricing.ts) and [`src/lib/palette.ts`](../src/lib/palette.ts)
for the regex tables.

## 2. What Anthropic has actually shipped

WebFetch both:

- `https://platform.claude.com/docs/en/about-claude/models/overview.md` — model IDs, context, status
- `https://platform.claude.com/docs/en/pricing.md` — input/output $ per MTok

**These two pages are the only source of truth.** Never invent a model ID, a price,
or a date suffix, and never carry one over from memory — model strings released
after your training cutoff are real, and ones you "remember" may not be. If both
fetches fail, **stop**: no commit, no PR, no Slack.

## 3. Decide

A model is **new** only if *both* hold:

- its exact ID is absent from `PRICING_DATA`, and
- it is generally available — skip anything marked preview, limited-availability, or
  invitation-only, **unless** `PRICING_DATA` already lists a sibling (Mythos is listed,
  so a Mythos successor counts).

**If nothing is new, stop silently.** No branch, no commit, no PR, no Slack message.
Say so in your final message and end. A no-op run is the expected outcome most times.

## 4. If something is new — the edits

Follow the existing patterns exactly. Each of these has a trap:

| File | What to add | The trap |
|---|---|---|
| [`server/pricing.ts`](../server/pricing.ts) | the ID into the regex row for its price tier | **Order is load-bearing, first match wins.** A new `opus-*` added *below* the bare `/opus/i` row is dead code and prices at $15/$75. Specific always precedes generic. |
| [`src/lib/palette.ts`](../src/lib/palette.ts) | a hue, mirroring pricing.ts | The newest generation of a family takes that family's **canonical** hue; the previous generation steps aside. See the header comment — the amber order is measured, not aesthetic. |
| [`CostCalculation/utils.ts`](../src/components/design-system/organisms/CostCalculation/utils.ts) | a `PRICING_DATA` row, `popular: true`, positioned by tier | `PRICING_DATA[0]` is the cost calculator's **default selection**. Don't change which model that is unless you mean to. |
| [`src/hooks/useAiConfig.ts`](../src/hooks/useAiConfig.ts) | the ID in `PROVIDER_MODELS.claude` | Index 0 is the **client-side default** for AI Insights. |
| [`src/lib/format.ts`](../src/lib/format.ts) | only if the version format is genuinely novel | `shortModel` is duplicated in `AgentActivity/utils.ts`; both must change together. |

### Palette: validate, don't eyeball

If you touch `src/lib/palette.ts`, run the `dataviz` skill's validator before
committing:

```
node scripts/validate_palette.js "<all hues, comma-separated>" --mode dark  --surface "#1c1c24" --pairs all
node scripts/validate_palette.js "<all hues, comma-separated>" --mode light --surface "#ffffff" --pairs all
```

The bar the palette actually holds itself to is the **four family hues**
(`#e5484d, #c98500, #008300, #3987e5`) passing all checks — within-family steps sit
below the normal-vision floor by design, since identity is carried by the legend and
tooltip too. What you must **not** do is introduce a *cross-family* collision: check
your new hue against every other family's hue and don't ship anything that lands near
the current worst (deutan ΔE 3.1). Deep ambers collide with `#008300` sonnet green
under protanopia — that is why the deep amber sits on legacy Opus.

### Only bump the server default for a true Opus-tier successor

[`server/ai.ts`](../server/ai.ts) `DEFAULT_MODEL` should track the newest **general-purpose
Opus-tier** model. Do **not** point it at Fable/Mythos (priced above Opus tier) or at a
limited-availability model. If you do bump it, also update `.env.example`,
`docker-compose.yml` and `README.md`, which all name the default.

Also check `THINKS_BY_DEFAULT` in the same file: if the new model **thinks by default**
when `thinking` is omitted, add it to that regex — otherwise thinking eats the 1024-token
`max_tokens` budget and the visible answer truncates. Do **not** add Fable/Mythos-class
models, which reject `thinking: {type: 'disabled'}` with a 400.

## 5. Verify

```
npx tsc -b
```

Must be clean — there is no test suite or linter, so this is the whole gate. If it
fails, fix it; do not open a PR on a red typecheck.

## 6. Branch, commit, PR

```
git checkout -b model/<model-id>
git commit -m "feat: add <Model Name> support"
git push -u origin model/<model-id>
gh pr create --title "..." --body "..."
```

The PR body should state the model ID, its price tier, every file touched and why, and
the palette validator output if the palette changed.

If `gh` is unavailable or unauthenticated, still push the branch and put the branch
name plus the `https://github.com/iftahs/claude-dashboard/compare/<branch>` URL in the
Slack message instead. **Never skip the push** — pushing the branch is what makes the
run recoverable by hand.

## 7. Slack

Post to **#claude-dashboard** (`C0BJB8JSQGH`):

> :sparkles: *New Claude model detected: `<model-id>`*
> Price: `$X` in / `$Y` out per MTok — same tier as `<sibling>`.
> Files updated: `<list>`. Typecheck: clean.
> PR: `<url>`

Only post when there is something to report — a no-op run stays quiet. If the Slack
tool is unavailable in the run, **still open the PR** and print the message you would
have sent as your final output.
