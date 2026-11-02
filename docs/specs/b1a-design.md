# B1a design: score, status meters, pacing, palette, organic board

Design pass for task B1a in `../plans/beta-plan.md` (decisions 5 and 6). No code was changed. Every
number below comes from `src/sim/params.ts` as of commit `2ca52ad`, or from a headless survey of the
existing bots (`src/sim/campaignBots.ts`, 400 seeds, every battle played by `thoughtfulPlay`).
Clinical corrections in `fodder.md` still win: neutrophil count is never a lever, there is always a
battle, there is no game over, arcs are fixed and curative therapies are not gameplay.

## 1. Score

### 1.1 Principles

- Two parts, always shown side by side: **Choices** ("your choices, no luck involved") and
  **Outcome** ("how it went, luck plays a part"). The total is their sum.
- No negative numbers anywhere. Nothing is subtracted; a weaker week simply earns less.
- Living fully pays (every life point counts). Pushing the odds pays (the smarter version of a card
  earns its avoided exposure chance). Staying home earns almost nothing on Choices, so hiding never
  wins.
- Same variant and same seed means the same dice: life rolls come from `lifeRngSeed(seed, week)`
  (two draws per day whatever is placed), body rolls from `bodyRoll`, battle dice from
  `battleSeedSalt`. So two runs on one seed differ only by the player's choices and battle play.

### 1.2 Formula (per week)

All weights go in a new `PARAMS.score` block so they are tunable and testable:

```ts
score: {
  version: 1,          // bump when any weight or tuning that moves the ranges changes
  perPoint: 10,
  perDodgedPercent: 1,
  perDose: 10,
  checked: { early: 20, late: 10 },
  perTissue: 2,
  fight: { cleared: 40, contained: 20, neededBackup: 10 },
  skirmish: { cleared: 40, loose: 20 },
  quiet: 40,
  carryClear: 20,
  perCarried: 10,
},
```

**Choices** (from the finished week's `LifeState`):

| Part | UI label | Formula | Range |
| --- | --- | --- | --- |
| living | Living | `perPoint * life.goal.points` | 0..140 |
| dodged | Odds pushed | for each `r` in `life.rolls` whose card is a smarter version (`cardDef(r.card).id !== cardDef(r.card).base`): `pct(base chance) - pct(own chance)`, with `pct(c) = Math.round(100 * c)` so floats never round oddly | 0..65 |
| meds | Medication | `perDose *` doses with `d.week === life.week && d.taken` (pre-week doses never count) | 0..30 |
| checked | Checked early | only if `life.symptoms.length > 0`: `checked.early` if `life.doctor?.timing === "early"`, `checked.late` if late, else 0. A viral visit pays the same, so checking a fever is never wasted | 0..20 |

Odds pushed today: Indoor jobs instead of the mulch 45% to 10% = 35; the beach instead of the
lagoon 45% to 15% = 30. It uses the landing chance printed on the card, not the pathogen count, so
the player can check the number against the card face.

**Outcome** (from the week's `CycleResult` and the carry):

| Part | UI label | Formula | Range |
| --- | --- | --- | --- |
| tissue | Tissue kept | `perTissue * outcome.tissue.health`; a quiet week counts as full (40) | 0..40 |
| fight | The fight | full battle by grade (`fight`), skirmish cleared or loose (`skirmish`), quiet week `quiet` | 10..40 |
| clear | Nothing carried | `carryClear - perCarried * record.carried.length` (carried is at most 2 after the cap) | 0..20 |

Per-week maximum: Choices 235, Outcome 100. Two-cycle campaign maximum: **670** (Choices 470,
Outcome 200). The all-risky week tops out at Choices 190, so the smarter week beats it by 45 even
before the battle.

Card values that the card face will show (see section 3, rank 1): mulch 40, indoor jobs 65, lagoon
50, open beach 70, band 20, sleepover 30 (the packed pills protect a dose worth 10).

### 1.3 Expected ranges (measured)

Surveyed with a scratch copy of the formula over seeds 1-400, two cycles, default XL kill chance:

| Run | Bot | Choices mean (min-max) | Outcome mean (min-max) | Total mean (min-max) |
| --- | --- | --- | --- | --- |
| Stay home | `home` | 71 (60-100) | 200 (200-200) | 271 (260-300) |
| Careless | risky cards, pills left, every dose skipped, never the doctor | 280 | 141 (52-200) | 421 (332-480) |
| Mixed | `mixed` | 381 (320-450) | 192 (118-200) | 572 (444-650) |
| All risky | `risky` | 345 (320-380) | 196 (128-200) | 541 (458-580) |
| Skips meds | `skipMeds` | 382 (370-410) | 196 (130-200) | 578 (520-610) |
| Good | `smarter` (early doctor) | 441 (430-470) | 200 (200-200) | 641 (630-670) |
| Best possible | smarter, a symptom both weeks, both checked early, perfect fights | 470 | 200 | 670 |

So: careless about 330-480, good about 630-670, best 670. Home's Outcome is perfect (an easy
skirmish every week) and the screen says so honestly; its Choices column is what stays low. Real
players lose more tissue than the bot, so Outcome will spread more for them.

**How a test confirms it.** Add `src/sim/score.balance.test.ts`, shaped like
`campaign.balance.test.ts` (400 seeds, `playCampaign`, prints a table with `--silent=false`).
Define the careless bot inside the test file (do not add it to `CAMPAIGN_BOTS`, which would pull it
into the existing balance thresholds). Assert:

- every week's parts are within their ranges and every total is at most 670;
- `smarter` mean total >= 620 and its Choices mean beats every other bot's Choices mean;
- careless mean total <= 450; home mean Choices <= 100;
- mean total order: `smarter` > `mixed` > `careless` > `home`, and `smarter` > `risky`;
- determinism: the same bot and seed scores the same twice.

### 1.4 Where the code goes

- `src/sim/score.ts` (pure): `weekChoices(life)`, `weekOutcome(result, carriedCount)`,
  `weekScore(life, result, carriedCount): WeekScore` with every part named, and
  `plannedChoices(life)` (Choices if the calendar plays out as placed and doses default, for the
  live meter).
- `CycleRecord` gains `score: WeekScore`, filled in `nextCycle` (it already has `life`, `c.result`
  and `carry.kept`). `CampaignSummary` gains `score: { choices, outcome, total }`.
- Existing balance tests keep their own `WEEK_SCORE` tables; do not replace them in B1a.

### 1.5 Best scores (localStorage)

- One key, `zebrawars.best`, holding `{ "v": 1, "entries": { [id]: Entry } }`.
  `id = "${scoreVersion}|${arc}|${variant}|${seed}"`, e.g. `1|summer|xl|1`. `arc` is `"summer"`
  until B3 adds arcs; `variant` is `"xl"` until B3's picker exists (then `"xl"` or `"ar"`).
- `Entry = { total, choices, outcome, runs, at }`: best total, the best Choices on its own (it can
  come from a different run), the number of finished runs, and an ISO date.
- Module `src/app/bestScores.ts`: `loadBest(storage?)`, `recordRun(id, score, storage?)` returning
  `{ entry, newBestTotal, newBestChoices }`, `listBest(variant)`. Every storage access sits in
  try/catch; a missing, blocked or malformed value behaves as empty and nothing throws. Keep at most
  50 entries (drop the oldest `at`). Unit-test it with a fake storage object.
- Shown in two places: the arc-complete screen (B1a: the existing summary in
  `src/app/interludeScreen.ts`) and the title/hub (B3 renders `listBest(variant)` there; B1a only
  provides the function). Without storage the summary just leaves the best line out.

### 1.6 Arc-complete screen

Heading `Your 2 weeks: 612`. Then a table, one row per week plus a total row:

```
            Choices                                   Outcome
Week 1  215  living 120, odds 65, meds 30         100  tissue 40, fight 40, nothing carried 20
Week 2  205  ...                                    80  ...
Total   420                                        180          = 600
```

Under it: `Best on this seed (CGD X-linked): 641` or `New best on this seed!`, and when Choices
alone is a new best, `Your best choices yet on this seed.` One plain line of framing, always the same:
"Infections happen whatever you do. Choices is the part you control; Outcome includes the dice."
Buttons stay as they are: "Play again (same seed)" (primary) and "New seed". On a phone the table
becomes one card per week with two lines (Choices line, Outcome line).

The battle outcome overlay (`src/ui/outcome.ts`) adds one line: `This week: Choices 215 +
Outcome 100 = 315`.

## 2. Status meters

### 2.1 Placement

Add a pinned **status strip**: a new `<div id="status">` as the first child of `#side` (before
`#sideScroll`), `flex: none`. It never scrolls and never sits on the board. On a wide screen it is
the top of the side panel; in portrait it sits directly under the board, above the scrolling panel,
so the meters stay in view while the player scrolls the calendar or the orders.

Each meter cell: a word label (12px, muted), a value (13px, text colour), a 6px bar. Cell min
height 44px. Layout: `display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px`; under
340px wide, 2 columns. No icons without words. Tapping or focusing a cell writes its one-sentence
explanation into a line under the strip (the same plain-text info-card pattern the tester liked);
tapping again clears it. Each cell also has an `aria-label` with the full sentence.

### 2.2 Life screen

| Cell | Reads | Bar | Value text | Explanation line |
| --- | --- | --- | --- | --- |
| Points | `life.goal.points`, `exposurePreview(life).points.planned`, `life.goal.target` | solid earned, ghost planned, both over the target | `8/10 (12 planned)`, `goal met` once reached | "Life points from your week. Living fully earns them." |
| Energy | `life.energy`, last value of `energyPlan(life)`, `PARAMS.life.maxEnergy` | 6 segments, ghost for after the plan | `5/6 → 0` | "A game-only resource. Activities cost it, rest gives it back." |
| Medication | `life.medLevel`, `exposurePreview(life).medLevel`, `.charges` | 3 segments (the 3-dose window) | `3/3 doses` and `2 antifungal, 1 antibacterial` | "Doses taken over the last 3 days. Fewer means a weaker aura and fewer charges in the fight." |
| Score | `plannedChoices(life)` and the running total of `CycleRecord.score` | none | `Choices 215` | "Your choices this week, if the plan plays out. Outcome is added after the fight." |

The existing Goal and Energy meters in `metersBox` (`src/ui/lifePanel.ts`) move into the strip and
`metersBox` is removed. `medsBox` keeps the dose strip and the take/skip buttons but drops its own
level bar.

### 2.3 Battle screen

| Cell | Reads | Bar | Value text | Explanation line |
| --- | --- | --- | --- | --- |
| Tissue | `battle.tissueHealth`, `PARAMS.maxTissueHealth`, `HudForecast.tissueDamage` | solid health, ghost of the next tick's loss, a notch at `PARAMS.outcome.backupTissueHealth` | `18/20 healthy` (16-20), `strained` (11-15), `backup coming` (10 or less) | "Tissue health out of 20. Heat and loose germs wear it down. Each point kept adds 2 to Outcome." |
| Inflammation | `HudForecast.tissueDamage` (next tick) | 3 segments: calm (0), warm (1-2), hot (3+) | `warm: -1 tissue next turn` | "Heat from crowding, loads and germs. Hot tiles cost tissue every turn." |
| Medication | `battle.meds.level`, `battle.meds.aura`, `battle.meds.charges` | 3 segments | `3/3 doses, 2 charges` | "Your aura slows germs; charges come from doses taken." |
| Score | the week's `weekChoices(campaign.life)` | none | `Choices 215` | "Outcome is added when the fight ends." |

Turn and the How to play button stay in the existing stats row of `src/ui/hud.ts`; the `Tissue N`
text there is removed (the strip shows it). The medication box keeps its charge chips but drops its
level bar. In standalone battle mode (no campaign) the Score cell is hidden and the grid uses 3
columns. Inflammation never appears on the life screen. No Happiness stat.

### 2.4 Phone portrait budget

The strip is one row of four 44px cells plus 6px padding: 56px. The info line appears only after a
tap. On a 390x844 phone that leaves the board at 48% (battle) or 30% (life) and the panel below
unchanged except 56px. B1 must keep the strip pinned and test it at 360px wide.

## 3. Pacing and stakes

### 3.1 What the numbers say

The thoughtful bot clears every skirmish (0% loose across 400 seeds) and loses 0 to 0.4 tissue per
whole campaign. Full battles end contained 5% to 13% of the time and never need backup. For a
skilled player the battle is safe, and it pays nothing visible beyond energy. The life week asks for
about ten taps and three "play day" presses before every fight. The score fixes the stakes side:
battles now pay up to 100 per week, and "keep all 20 tissue" becomes a goal worth replaying for.
The changes below fix the time side and add a little pressure.

### 3.2 Ranked changes

1. **Show each choice's payoff on the card face (UI only).** Both versions side by side on each
   hand card: `Mulch: +4 points, 45% mold, Choices 40` / `Indoor jobs: +3 points, 10% mold, Choices
   65`. The risky version keeps the bigger points number (tempting, pays now); the score shows the
   smarter one is the better play overall. Uses `cardPreview` plus a `cardChoices(card)` helper in
   `src/sim/score.ts`. Tests: none in `src/sim` change; add unit tests for `cardChoices`. Risk:
   could read as a moral quiz; mitigated because the risky card still shows more points and the
   Outcome side can still go well.
2. **One press plays the rest of the week (UI only).** Replace "Play day N" with "Play the week".
   It calls `advanceDay` until the week ends, but stops at the start of any day that opens with a new
   `SymptomAppeared` or `FrictionEvent`, because those mornings hold a real choice (book the doctor,
   the missed dose). The "What happened" beats then show all days at once. Files:
   `src/app/lifeScreen.ts`, `src/app/lifeModel.ts` (play label). Tests: `src/app/lifeModel.test.ts`
   if it asserts the label; no sim test. Risk: the per-day reveal of exposure rolls is lost; keep a
   short staggered reveal of each roll line (off under reduced motion).
3. **Skirmish threats 1-2 to 2-3** (`PARAMS.campaign.skirmish.threats.min` 1 to 2, `.max` 2 to 3).
   The most common battle (49% to 72% of weeks) gets something to do for every swarm. Measured: the
   bot still clears 100% and loses no tissue, so balance thresholds hold. Tests affected:
   `src/sim/scenarios.test.ts` (test name says "1-2"; rename, the >150 reachable check gets easier),
   `src/sim/campaign.test.ts` skirmish block (reads PARAMS; cleared >95% still holds),
   `src/sim/life/balance.test.ts` (loose < 5%, holds). Risk: human players leave more skirmishes
   "still stirring", which costs 1 energy next week. Low.
4. **Goal target 10 to 12** (`PARAMS.life.goalTarget`). Today the smarter week meets the goal with
   2 points to spare, so dropping band costs nothing. At 12 the goal asks for all four activities
   (smarter) and the friction event stays on the route. Measured: smarter still meets it 100%, mixed
   98%. Tests affected: `src/sim/life/life.test.ts` (reads PARAMS, fine), the `goalTarget` comment
   in `params.ts`, `campaign.balance.test.ts` (`smarter.goals >= 0.95`, holds),
   `life/balance.test.ts` (`smarter.goal` close to 1, holds). Risk: a tired week (energy -1) now
   misses the goal; the score does not use the goal, so nothing is lost except the meter's check
   mark. Medium-low.
5. **Keep the calendar at 3 days and 2 cycles.** Fewer days breaks the sleepover (it needs a next
   morning) and the 3-dose med window; more cycles lengthens the session. No change.

Tested and **not** recommended for the beta: `inflammation.damageThreshold` 1 to 0 (tissue lost per
run goes from 0.3 to 1.7 and backup appears in mixed play, but it breaks the "careful play ends at
16-17" calibration and many hard-coded damage numbers in battle tests); `maxTurns` 6 to 5 (little
effect, contained 32 to 37 of 434 risky battles, and it shortens the battle, the opposite of the
tilt we want).

### 3.3 Post-beta backlog (bigger than tuning)

- A different hand each week (new cards, the cast), so week 2 is not a repeat of week 1.
- Battle variety: an abscess event for staph, a two-wave exposure, region maps beyond the lung.
- Hex grid (adjacency, telegraph, heat forecast and the ~329 tests all change).
- Tissue that carries between weeks (needs careful, non-frightening framing).
- A "ghost" of your best run on the same seed, week by week, and a shareable seed code.
- A per-week par (bronze, silver, gold) instead of raw totals, if testers find numbers abstract.
- Steroids as a double-edged support; the gut map.

## 4. Palette and shapes

### 4.1 Tokens

One source of truth: `src/theme/palette.ts` exports `PALETTE` (hex strings) and `hex(name)` (the
number for three.js), plus `applyCssTokens(root)` which sets `--zw-<name>` on `:root` at boot.
`index.html` uses `var(--zw-bg, #15171C)` style fallbacks so it still paints before the script.
The game has one dark theme; no light theme is planned.

| Token | Hex | Use | Non-colour backup |
| --- | --- | --- | --- |
| bg | `#15171C` | page and scene background | |
| surface | `#1F232B` | side panel | |
| raised | `#272C36` | panels, cards | |
| control | `#2D3340` | buttons (`control-hover` `#3A4150`) | |
| line | `#3A4150` | borders (`line-strong` `#4A5263`) | |
| text | `#E8EAF0` | body text | |
| text-muted | `#A9B0BD` | labels, notes | |
| focus | `#9FD8F0` | focus ring | 2px outline, offset 2px |
| order | `#EBA0FF` | selection, queued orders | thick cell-shaped frame; destinations are disc plus ring |
| warn | `#FFB4AA` | problem text (`warn-line` `#FF6A5A`) | text always says what is wrong |
| goal | `#F0C05A` | Points meter, Choices | word "Points" / "Choices" |
| energy | `#9FD8F0` | Energy meter | word plus segments |
| med | `#5BE3C6` | Medication meter, aura, dose marks | word "Medication", segment count, "dose" label |
| tissue | `#F2A7A0` | Tissue meter, Outcome | word plus state word |
| heat | `#FF9A3C` | Inflammation meter, forecast glow | flame glyph, state word |
| swarm | `#9FD8F0` | neutrophil swarms (`swarm-loaded` `#5E7C8C`, `cargo` `#4A3480`) | instanced cell shapes, load pips |
| region-lung | `#5A3C42` | lung tissue cells (healthy) | region name in the header |
| region-lung-bg | `#3E2A30` | tissue background between cells | |
| region-skin / lymph / liver / gut | `#6A4E44` / `#46405E` / `#4E3030` / `#5A4436` | reserved for later maps | region name |
| strep | `#F0A843` | Streptococcus (leaky bacteria), text ink `#F2B35B` | round bead cluster, no rim |
| staph | `#E06A88` | Staphylococcus aureus (sealed bacteria), ink `#F08A9E` | round cluster plus the pale shell rim |
| aspergillus | `#9A80E8` | Aspergillus (mold), ink `#B9A2F0` | spiky body plus the shell rim |
| virus | `#B8C7D9` | reserved: background viral fights | hexagon outline, label "virus" |
| sealed-rim | `#F4EFE0` | the shell ring on sealed germs | ring shape |
| tissue-healthy | `#5A3C42` | inflammation 0 | plain cell |
| tissue-stressed | `#7E4C44` | inflammation 1 (no damage yet) | dot pattern |
| tissue-damaged | `#B5503E` | inflammation 2 and 3 (losing tissue) | diagonal hatch (2), cross-hatch (3) |
| heat-ink | `#3A0F0B` | the pattern strokes | |
| spread | `#FFD23F` | telegraph: spread | solid arrow |
| spore | `#6FB8FF` | telegraph: spore | dotted arc |
| grow | `#F2F2F2` | telegraph: grow | ring and size number |
| blocked | `#FF8A7A` | telegraph: blocked | ✕ mark plus "BLOCKED" in playback |
| stall | `#7FE0C8` | telegraph: held back by meds | pause bars |
| mark-halo | `#15171C` at 80% | dark stroke under every telegraph and order mark | |
| kill | `#FFF3C4` | kill flash (`residual` `#FFD84A`) | "KILLED" label |
| granuloma | `#B08A5A` (`granuloma-dark` `#5E4630`) | walled-off granuloma | stone ring shape, "WALLED OFF" label |

Staph moves off the shared orange: today strep and staph both use `FORM_COLOR.bacterium`. Colour
now names the organism; shape still names the form (round vs spiky) and the rim still names sealed
vs leaky, so `src/render/pathogenView.ts` switches from `FORM_COLOR[form]` to `KIND_COLOR[kind]`.

### 4.2 Contrast (WCAG 2.1, computed)

Text tokens against bg / surface / raised: text 14.9 / 13.1 / 11.6; text-muted 8.2 / 7.2 / 6.4;
order 9.4 on bg; warn 10.6 / 9.3 / 8.2; goal 10.6 / 9.3 / 8.3; med 11.3 / 9.9 / 8.8; energy 11.6 /
10.2 / 9.0; tissue 9.2 / 8.1 / 7.2; heat 8.6 / 7.5 / 6.7; ink colours strep 9.7 / 8.5 / 7.6, staph
7.5 / 6.6 / 5.9, aspergillus 8.1 / 7.1 / 6.3. Button text on control 10.5. All pass AA for normal
text (4.5:1). Pathogen body colours are never used for text; use the ink variants.

Graphics (WCAG 1.4.11, 3:1) on the healthy lung cell `#5A3C42`: strep 4.8, staph 3.05, aspergillus
3.07, swarm 6.3, sealed rim 8.5, spread 6.7, spore 4.6, blocked 4.3, stall 6.2, order 5.1. On hot
cells (`#B5503E`) spore (2.4) and blocked (2.2) fall below 3:1, so every telegraph and order mark
gets the `mark-halo` stroke; against the halo they score 7.8 to 16. Pathogen tokens get a thin dark
silhouette outline (inverted hull, `mark-halo`) for the same reason.

### 4.3 Colour-blind check

CIE76 distance (Lab) between pathogen families after Machado 2009 simulation (severity 1.0):

| Pair | Normal | Deuteranopia | Protanopia | Grayscale L* gap |
| --- | --- | --- | --- | --- |
| strep / staph | 65 | 52 | 66 | 14 |
| strep / aspergillus | 112 | 112 | 112 | 14 |
| staph / aspergillus | 57 | 61 | 48 | 0 |
| aspergillus / order | 23 | 24 | 18 | 16 |

All family pairs stay above 40 under both dichromacies, which is clearly distinguishable. Staph and
Aspergillus share lightness (L* 60), so in grayscale they are told apart by shape only (round
cluster vs spikes), which is the rule anyway; both carry the sealed rim because both are sealed.
Aspergillus and the order colour are close in hue, but one is a 3D blob and the other a flat frame
on the tile. Tissue states differ by 16 to 42 normally and 13 to 37 under CVD, and carry the dot,
hatch and cross-hatch patterns, so B7's grayscale check reads them by pattern.

## 5. Organic board (render only)

The logical grid stays 7x7 squares. `tilePosition(c)` keeps returning the exact centre of the
logical tile, so pathogens, swarms, granulomas, telegraphs, orders, playback and the inset all keep
working without change. Only `src/render/boardView.ts` and `src/render/scene.ts` change, plus two
new pure modules.

**Cell shape.** New `src/render/cellShape.ts` (pure, no three import):
`cellOutline(x, y): {x, y}[]`, 28 points on a rounded square (superellipse exponent 4, radius
0.42) with smooth radial jitter of at most 0.025: three harmonics with amplitudes and phases from a
mulberry32 seeded by `(x * 73856093) ^ (y * 19349663)`. Same coordinates, same shape, every time.
Test (`cellShape.test.ts`): deterministic, every point within 0.47 of the centre, area at least
0.62. In `boardView`, each tile becomes an `ExtrudeGeometry` of that outline (depth 0.16, bevel
thickness 0.04, bevel size 0.03, 2 bevel segments), positioned so its top face is at y = 0. The
gaps between cells (about 0.06 to 0.1) show the tissue background.

**Surface.** One shared 256x256 `CanvasTexture` for every cell: a soft radial gradient (centre
about 8% darker than the rim, like an alveolus) and a few faint speckles. Tile colour multiplies it.
The checkerboard (`BASE_A`/`BASE_B`) goes; instead each cell gets a lightness offset of up to 4%
from the same hash, so the board reads as tissue, not a chessboard, while gaps keep the columns
countable.

**Background.** New `src/render/tissueTexture.ts`: a 512x512 canvas drawn once from a fixed seed:
`region-lung-bg` fill, about 40 soft lighter and darker blobs, about 12 thin darker capillary curves,
an alpha vignette at the edges. It goes on a plane 1.2 units larger than the board, replacing the
`SLAB` box, so the board fades into the scene background instead of ending in a hard edge.

**Picking.** Keep one invisible full-size square per tile (`PlaneGeometry(1, 1)`,
`material.visible = false`, still raycastable) and raycast against those, so taps in a gap still
pick the logical tile. `pick` maps the hit back with the same index as today.

**Overlays on the same tiles.**
- Heat patterns: one `ShapeGeometry` per tile from the outline scaled 0.9, UVs set to
  `(x + 0.5, y + 0.5)`, so the dot and hatch textures clip to the cell. Levels and opacity as now.
- Hover: a thin ring following the cell outline (outline minus the outline scaled 0.9). Selection:
  the same cell ring, thicker (scale 0.7 hole), in `order`, with the halo. Precompute both rings
  for all 49 tiles at creation.
- Destination options, the forecast flame chip, telegraph arrows and arcs: unchanged, placed by
  `tilePosition`, with the halo stroke.

**Wobble.** `BoardView` gains `tick(dt)`: each cell breathes, scale 1 to 1.012 over about 4.5
seconds, phase from the hash. Off when `prefers-reduced-motion: reduce` matches, and off with a
`?still=1` URL flag for screenshots. With wobble off, the board is pixel-stable for a given seed.
Call it from `battleScreen.ts` and `insetView.ts` ticks.

**Phone performance.** 49 extruded cells of about 300 vertices is about 15k vertices; draw calls
stay what they are now (one per cell, heat plane and frame). Two canvas textures (256 and 512) are
built once. Also cap `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` in `scene.ts`; a 3x
phone otherwise renders 2.25 times the pixels for no visible gain.

## 6. Implementation slices

Each slice is one commit and one sitting for a Sonnet implementer. Each is done when
`mise run check` is green and a screenshot of the named screens is attached.

1. **`feat: palette tokens`.** Add `src/theme/palette.ts` (+ a small test that every token is a
   valid hex and the text pairs from 4.2 meet 4.5:1, computed in the test). Call
   `applyCssTokens` in `src/app/main.ts`; switch `index.html` styles to `var(--zw-*)`. Replace hex
   literals in `src/ui/*.ts`, `src/render/*.ts` and `src/app/lifeScreen.ts`/`battleScreen.ts` with
   palette references. Done: `grep -rnE "#[0-9a-fA-F]{6}|0x[0-9a-fA-F]{6}" src/ui src/render src/app`
   finds only canvas-internal drawing colours that are themselves palette lookups (zero raw
   literals); screenshots of life and battle look the same apart from the new tile and background
   colours.
2. **`feat: per-organism colours and outlines`.** `KIND_COLOR` in `pathogenView.ts` and
   `insetView.ts`; staph rose; aspergillus lifted; inverted-hull outline on tokens; halo stroke on
   telegraph (`telegraphView.ts`) and order marks (`orderView.ts`); update the keys in `hud.ts` and
   `lifePanel.ts` ("rose round dots with a ring: Staphylococcus aureus"). Done: battle screenshot
   with all three organisms, plus the same screenshot in grayscale (devtools rendering emulation)
   where all three and every telegraph mark are still told apart.
3. **`feat(sim): week and campaign score`.** `PARAMS.score`, `src/sim/score.ts`,
   `CycleRecord.score`, `CampaignSummary.score`, `score.test.ts` (each part on hand-built weeks:
   smarter yard gives 35, beach 30, a skipped dose drops 10, a viral early visit gives 20, a quiet
   week gives Outcome 100) and `score.balance.test.ts` (section 1.3). Done: tests green, the table
   prints ranges close to 1.3.
4. **`feat: status strip`.** `index.html` `#status` mount and CSS grid; `src/ui/statusStrip.ts`
   (pure render from a `StatusModel` of cells); wire into `lifeScreen.ts` and `battleScreen.ts`;
   remove `metersBox`, the meds level bars and the `Tissue N` text. Model builders in
   `src/app/lifeModel.ts` and the battle HUD model, with unit tests for the value texts and state
   words. Done: screenshots of life and battle at 1280x800 and 390x844, strip pinned while the panel
   scrolls.
5. **`feat: score summary and best scores`.** `src/app/bestScores.ts` (+ test with a fake storage
   and a throwing storage), summary table and best line in `interludeScreen.ts` / `ui/interlude.ts`,
   the week line on the outcome overlay. Done: finish a campaign, see the table and "New best";
   play again on the same seed and see "Best on this seed"; in a private window with storage blocked
   the screen still renders.
6. **`feat: pacing`.** Card-face Choices values (`cardChoices`), "Play the week" with its stop
   rules, skirmish threats 2-3, goal 12, test renames and comment updates from section 3.2. Done:
   balance tables re-run and pasted into the commit body; life screenshot showing both versions of a
   card with their values.
7. **`feat(render): organic board`.** `cellShape.ts` (+ test), `tissueTexture.ts`, `boardView.ts`
   rewrite of tiles, pick planes, rings and heat masks, `tick`, the pixel-ratio cap. Done:
   screenshots of battle (with heat 1-3, a forecast chip, a selection and telegraphs) and the life
   inset; tapping in a gap selects the right tile; reduced motion stops the breathing.

## 7. Questions for Tracy (with my recommendation)

1. Big numbers (10 per life point, totals around 400-670) rather than small ones? **Yes**: they
   feel like a game score and leave room for halves without decimals.
2. Add "Checked early" (+20 for seeing the doctor early when a symptom shows, +10 late) as a fourth
   Choices part? **Yes**: it teaches that a fever is worth checking, and a viral visit pays too.
3. Show each card version's Choices value on the card face, even though the smarter version always
   scores higher? **Yes**: the risky version still shows more life points, so it stays tempting.
4. Raise the weekly goal from 10 to 12 points? **Yes**: it makes "live fully" a real target.
5. Staph gets its own colour (rose) instead of sharing orange with strep? **Yes**: colour for the
   organism, shape for the form, rim for sealed.
6. In B1a the best score shows on the summary screen only; the title/hub shows it once B3 builds
   the title. **Yes**, it avoids building a throwaway title.
7. Meter name for heat: "Inflammation" with the state words calm, warm, hot? **Yes**: it matches
   the clinical word and the board's heat patterns.

**Answers (Tracy, 2026-11-02):** yes to all seven.
