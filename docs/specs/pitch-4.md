# Pitch 4: Telegraphed Swarm Tactics ("Read the Field")

Synthesis of pitches 1-3, the first Opus review (`../internal/review-opus-1.md`), and the user's decisions and
clinical corrections in `fodder.md`. Where this pitch conflicts with pitches 1-3, this one wins.

## Logline

You live a life between fights while your body keeps score. When an infection lands, you command
swarms of immune cells across a 3D patch of tissue, one telegraphed turn at a time, then watch the
turn play out.

## Intent

After a session, a patient can picture what is happening inside them and feels more equipped and
less afraid. The message is "you can live a full life with CGD", not "avoid germs to win". Fun
comes first, learning is implicit, and there is no lecture, quiz or test.

## Structure: fixed arcs

The game is a series of fixed arcs (levels). Each arc is a chapter of life with its own life goals,
exposures, and a battle or two triggered by what happens. An arc ends when its goals are scored.
There is no game over and no death. Each arc introduces at most one new mechanic or exposure type.

Arc list (agreed by the user as a good starting point; titles and details are still placeholders):

1. **First infection, undiagnosed (prologue, short).** No prophylaxis, and the character does not
   know why they keep getting sick. The same kind of infection keeps coming back. Built to be lost
   gracefully. Ends with the diagnosis moment.
2. **First infection after diagnosis (prologue, short).** The same kind of threat as arc 1, now with
   meds. The aura is up, and the contrast with arc 1 is the lesson, shown not told.
3. **A first summer.** Yardwork and the lake. Lung map, the main tutorial map.
4. **A school trip or flight to a warm climate.** A delayed symptom and a doctor visit. Lymph node
   or liver map.
5. **A camping weekend.** Cave, brackish water. Skin and lung.
6. **A holiday season.** Live tree, a reptile pet, a skipped-dose event.
7. **A gut flare.** A map about inflammation, with steroids as a double-edged support.
8. **Epilogue (not gameplay).** A hopeful information screen about curative options (BMT, gene
   therapy). See "Curative treatments" below.

Arcs 3-7 are the fully winnable core game, on prophylaxis. Each teaches one thing, moving from
simple to complex.

**Rare-site surprise battle (adopted).** Most patients have had at least one unusual infection, so
an occasional event uses an unusual site (for example the spine or lower brain, based on a real
patient case). It should be rare, memorable and clearly framed as uncommon, so it does not make
players fear that every infection could go there. Low cost: a one-off map plus an event card.

**Age scaling (deferred).** Making infection frequency and speed ease with age across arcs could
add design friction. Not in scope now; revisit later.

Notes on the prologue arcs:
- Diagnosis timing varies by patient (X-linked often early, AR sometimes much later). These arcs
  are a nod to a memorable moment for many patients, not a claim that everyone's story looks like
  this. Treat as a flashback or "how it started" framing if needed. Easily skipped or shortened
  if players find it unnecessary.
- Arc 2 should replay a recognizably similar infection to arc 1, so the contrast is felt.

## Outer loop: the life phase

Short weeks (target: under two minutes). The player chooses season goals for the arc (for example
making the team, finishing a band recording, a trip with friends) and places five or six activity
cards on a calendar. Points come from goals, not from health. Health is the budget.

- **Cast.** Invites come from a small cast (best friend, sibling, coach, a crush), so a choice has
  relationship stakes. "Jordan wants you at the lake" beats "activity: lake (+fun, +exposure)".
- **Third options are the skill.** Most risky activities have a smarter version the player can
  discover: help with the yard but take indoor jobs; the beach but not the brackish lagoon;
  camping but not the cave; a fake tree and pick the ornaments. Staying home scores nothing.
- **Honest odds.** Exposure is probabilistic with visible odds. Players sometimes get away with
  it. The lesson is "risk adds up", not "fun equals punishment".
- **Meds as default, friction as event.** Taking meds is a one-tap default. Skipping happens
  through believable events (sleepover, pills in the other bag, nausea, exam week, "I feel fine").
  The medication level fades over days in the body inset, not instantly.
- **Body inset.** A small live view of the same three.js scene stays on the life-phase screen.
  Hovering a choice shows the spores or bacteria it would bring in. Taking meds raises the aura.
  The player never leaves the body.
- **Persistent state.** Infections the cells swallowed but could not kill do not vanish. They stay
  as hidden reservoirs that grow over life-phase days and surface as symptoms (low fever, a sore
  spot, tiredness that costs an activity slot).
- **The doctor visit is a power move.** Seeing the doctor reveals hidden reservoirs and unlocks
  strong support for the next battle. Early is cheap, late is expensive but still works. Medical
  care is backup arriving, not a loss state.
- **Battles come out of the life phase.** A battle starts when an exposure lands or a reservoir
  flares, not on a fixed schedule. A safe week may have no battle, which is itself a reward.

Prep levers (all game-honest): exposure (pathogen type and load), medication level, how early
symptoms are acted on, carried-over reservoirs, and a game-only energy resource, openly labeled as
such. Neutrophil count is NOT a lever; counts are normal in CGD and the defect is function.

## Inside battle

- A compact 3D tissue slab (lung, lymph node, liver, skin, gut) from a fixed angled camera.
  Neutrophils are drawn as instanced swarms, not single units.
- **Turn-based with full telegraph (Into the Breach style).** At the start of each turn every
  visible pathogen shows its intent (spread here, spore there, grow). The player gives orders to
  swarms (move, engulf, hold, wall off) and spends support charges. The turn then resolves as a
  2-4 second real-time swarm sequence. No reflexes needed.
- **Prep sets hard limits.** Medication level sets support charges and passive auras. Exposure sets
  enemy composition. Carried-over reservoirs start as hidden tokens. Doctor visits reveal tokens
  and add strong support. Skill moves the player within the ceiling prep sets.
- **CGD rules.**
  - Swarms always arrive, since chemotaxis is intact. Cells are not weaker or fewer.
  - The defect is the missing weapon (NADPH oxidase cannot make H2O2).
  - "Leaky" pathogens (catalase-negative bacteria such as Streptococcus) drop a peroxide weapon the
    cell can pick up and use. These die even in a CGD cell. (Name is a proposal; "armed" sounded
    more dangerous than it is.)
  - "Sealed" pathogens (catalase-positive: Aspergillus, Staph aureus, Burkholderia, Serratia,
    Nocardia) leave nothing to use. They can be engulfed but not killed.
  - The decision: engulfing a sealed pathogen contains it but loads the swarm. Leaving it free
    lets it spread. Loaded swarms can be walled off into granulomas, which are contained but
    block zones and add inflammation.
  - **Inflammation axis.** Over-committing swarms to one spot raises local inflammation, which
    damages tissue and slows your own swarms. Colitis and granulomas have a genetic component as
    well, so inflammation is a feature of the disease, not only a response to infection.
  - **Steroids** are a double-edged support: they calm inflammation but weaken defense.
  - A per-character "blunt weapon" parameter (a low chance to kill sealed pathogens) represents
    residual oxidase activity. See "Research findings".
- **Viruses.** NK cells, T cells and antibodies clear virus particles cleanly at the edge of the
  board, mostly without input. In the tutorial and occasionally later they appear in the
  foreground, next to the struggling neutrophils, so the contrast ("one tool is missing, the rest
  works") is seen. Never show macrophages or monocytes as unaffected allies. Any fever event in
  the life phase still makes a doctor visit a good move; the doctor can reveal that it was viral.
  The game must not teach players to dismiss a fever.
- **Graded outcomes** instead of win/lose: cleared, contained (with reservoirs), needed backup,
  long recovery. Every outcome feeds back as time, energy and events in the life phase.

## The visual hook

Swarms pour toward a threat, wrap it, and either flash (kill) or dim and swell (loaded). The life
phase body inset shows the same scene in miniature, so exposure and adherence are seen the moment
they happen. Use a stylized look (toon or flat shading, soft rim light, a strong color language
for "lit" and "unlit" cells), not realistic organic shaders. Readable and a bit gross is fine for
13+; visceral is not. Never show death.

## Why it's fun

You always know what happens if you do nothing, so each turn is a small puzzle. The swarm playback
gives spectacle without reflex demands. The life phase is about your goals and your people.

## Learning (implicit)

Cells arrive but some cannot kill; which organisms matter and where they come from; meds as a
standing level, not a one-off; silent infection and why fever and pain matter; early doctor visits
as the strongest move; inflammation as part of the disease; smarter versions of risky activities;
the contrast between life before and after diagnosis.

## Curative treatments (BMT, gene therapy)

Not part of gameplay. A curative therapy would end the game and works against the goal of helping
patients live well with CGD. They appear in the epilogue as a hopeful information screen:
- After a successful curative treatment: no more prophylaxis meds, restrictions drop to "normal
  person" levels, and the immune response is about normal. The process can be arduous and long.
- Gene therapy need not correct every neutrophil. Roughly 20-30% corrected cells are enough to win
  a normal number of infection battles; one recent patient reached about 70%.
- Tone: curative options are real, evolving choices made with the care team. The epilogue must
  not imply patients should wait for one or that living with CGD now is second best.
- Product names appear only where they help tell options apart. No advertising.

## Disease modules

- **CGD XL vs AR:** parameters only (exposure weights, flare timers, which arcs apply, possibly a
  residual-kill parameter, infection frequency and severity, treatment availability).
- **Wilson's:** optional, and not part of this game's battle. Recommended as a separate game under
  the Zebra Wars hub that shares the life phase, body inset and UI shell. Do not shape the CGD
  battle around it.

## Risks

- The telegraph has to be readable at a glance on a 3D board. Greybox it first.
- Persistent body state needs tuning so a bad week does not snowball into misery. Cap reservoirs
  and give the doctor visit a reliable reset.
- Life-phase content (cast, third options) is writing-heavy. Start with about a dozen activities,
  each with a smarter version.
- The undiagnosed prologue could be a downer or feel repetitive. Keep it short and skippable.
- Assume WebGL2 on locked-down school and hospital machines and integrated GPUs.

## Open questions

- Resolved by research (see "Research findings" below): residual oxidase activity, and which
  body sites to build maps for. Which organisms favor which sites is still unchecked.
- Deferred, tutorial/flavor only: exact catalase wording, drug names (use "antibacterial" and
  "antifungal" for now), fever-guidance wording.
- Arc details: the exact goals, third options and cast for each arc. (The arc list and order are
  agreed as a starting point.)
- Is the undiagnosed prologue arc a flashback, or the opening of the character's story?

## Research findings

Source: web search summaries (not full-text reads). Check numbers against the papers before
quoting any in the game or docs.

- **Residual oxidase activity matters, and it cuts across XL vs AR.** In a 287-patient cohort
  (Kuhns et al., NEJM 2010, PMC3069846), modest residual reactive-oxygen production meant
  less severe disease and better long-term survival. Residual production, set by the specific
  mutation, predicts outcome better than the inheritance pattern. p47phox (AR) and most missense
  gp91phox (XL) mutations keep more residual activity than truncating mutations. Typical
  expectation: XL most severe, p47phox mildest, with real exceptions (a case report of mild,
  lung-only XL disease with preserved activity, PMC3501804).
  - Design: do not hard-code a kill chance per inheritance type. Residual kill chance is a
    per-character parameter with typical defaults (low for XL, higher for AR p47phox), so a mild
    XL character is possible.
- **Infection sites.** The lung is the most frequent site (pneumonia is the usual presentation),
  followed by skin, lymph nodes and liver. Spleen, bone and joints also occur. Gut involvement
  varies a lot between cohorts. Example: a 38-patient pediatric cohort had pneumonia 82%, skin 50%,
  lymph node infection 42%, liver abscess 24%. NIH sources say a serious bacterial or fungal
  infection about every 3-4 years on average.
  - Design: build maps in this order: lung (main tutorial map), lymph node and liver, skin, then
    bone and gut later. The gut map is mainly about inflammation (colitis), not infection.
- **Age and rarer sites (user, clinical experience).** Infection frequency varies with age:
  younger patients tend to get infections more often and can be overcome more quickly. Rarer
  infections also happen, such as fungal infection of the spine and lower brain (a patient case at
  age 11), but less frequently. Not required in the game. Possible uses: an age-based frequency
  scale across arcs (deferred), and a rare-site event as an occasional surprise battle (adopted).

## Suggested first prototype

One tissue slab, two pathogen types (one leaky, one sealed), one swarm type, telegraph plus
resolution playback, and a three-day life phase with four activity cards and the body inset. Enough
to test whether the link between life and battle and the core tension feel good before building
content.
