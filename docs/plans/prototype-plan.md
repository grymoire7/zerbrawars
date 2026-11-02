# Zebra Wars: first prototype plan

Builds the "Suggested first prototype" from `../specs/pitch-4.md`. The clinical corrections in `../specs/fodder.md`
take precedence over this plan wherever the two conflict. Items marked **(my call)** are defaults I
picked. Change them freely.

## 1. Goal

Find out whether the core loop is fun and legible before building any content. The prototype has
to answer three questions:

- **(a) Turn and playback.** Can a player read the telegraphed turn at a glance, and is the
  2-4 second swarm playback satisfying to watch?
- **(b) Leaky vs sealed.** Does the sealed-pathogen rule create a real decision: engulf it and
  load the swarm, leave it free to spread, or wall it off?
- **(c) Life-to-battle link.** Do life-phase choices visibly and fairly change the battle, through
  the body inset, medication fade, exposure odds and carried-over reservoirs?

Fun beats technical detail. Greybox comes first. The prototype is throwaway in content but should
keep a clean sim/render split, because that split is likely to survive into the real build.

## 2. Scope

### In

- One tissue slab: a lung-ish slab drawn as a small square grid of about 7x7 tiles **(my call;
  hexes read nicer but cost more to build)**. Fixed, angled camera with a small amount of orbit
  clamp.
- Two pathogen types:
  - Leaky: a Strep-like bacterial cluster, round silhouette.
  - Sealed: an Aspergillus-like fungus, spiky or hyphae silhouette that can throw spores.
  - The two are told apart by shape first and color second.
- One swarm type (neutrophils): three swarms per battle, each drawn as about 40-60 instanced
  cells.
- Pathogen intents: grow, spread to an adjacent tile, and spore to a distant tile (fungus only).
  All randomness that drives an intent is rolled when the intent is generated, so the telegraph is
  always truthful.
- Orders: move, hold, engulf, wall off.
- Swarm load: a cap of 2 or 3, and a loaded swarm moves slower.
- Granulomas: they block their tile and add inflammation.
- Per-tile inflammation: it slows swarms and costs tissue health.
- Residual kill chance (the "blunt weapon"): one per-character parameter, set in the debug panel
  only. It is shown as a visible odds pip on the loaded swarm and rolled during resolution. This
  is the one random roll that happens at resolution time, and it can only help the player.
- Medication effects in battle:
  - A passive aura that slows pathogen growth.
  - Support charges: one antibacterial and one antifungal action, with the number of charges set
    by med level.
- Graded outcome: cleared, contained (with reservoirs), or needed backup. Long recovery is
  optional.
- Life phase: three days, four activity cards, two of which have a smarter version.
  - One goal meter. Points come from activities, and staying home scores nothing.
  - Meds are a one-tap default each day, plus one scripted friction event (a sleepover where the
    pills are in the other bag).
  - Visible exposure odds on each card. Med level fades over days.
- Body inset: the same three.js scene drawn in a corner viewport during the life phase.
  - It shows the aura level and any known reservoirs.
  - Hovering a card previews the particles that card would bring in.
- Campaign loop:
  - Two cycles of life phase, then battle (only if an exposure lands or a reservoir flares), then
    outcome.
  - Reservoirs left after battle 1 grow over the next life phase, surface as one symptom card
    (a low fever), and start battle 2 as hidden tokens.
  - A minimal doctor-visit card reveals hidden tokens and grants one strong support charge.
- Dev tooling:
  - Seeded runs and scenario presets selected by URL parameters.
  - A debug panel to set the loadout directly.
  - A local session log you can export as JSON.

### Out (explicitly)

- **Content and story:**
  - Arcs: the prologue arcs, arcs 3-7 and the rare-site surprise battle are all out. The single
    throwaway slice described above is the only "arc".
  - Cast writing: the prototype has one or two named inviters and nothing more.
  - Seasons, goal selection, and multiple goals.
- **Out of the game for now:**
  - Wilson's disease, in any form.
  - The epilogue, curative therapies, and any mention of gene therapy or BMT.
- **Battle mechanics:**
  - Viruses and the NK/T-cell foreground fights.
  - Steroids, the gut map and colitis.
  - Any second map or second swarm type.
  - Abscess drainage, imaging, and IV support as separate actions. The doctor visit is a single
    generic charge.
- **Parameters:**
  - The XL/AR toggle as a player-facing choice. The residual-kill parameter exists only in the
    debug panel.
  - Age scaling.
- **Polish:**
  - Audio polish. At most two or three placeholder click/flash sounds, and they can be cut.
  - Music, menus, title screen, the Zebra Wars hub, save/load, settings beyond a speed toggle,
    localization.
- **Platform:** (amended, see section 9)
  - The prototype is tested on desktop and laptop. Input still uses pointer events and large tap
    targets from T4 on, so the beta's mobile support is not a retrofit.
  - Full mobile layout is deferred to the beta week.
- **Infrastructure:**
  - Any backend, analytics service or account system.
  - Drug names in the UI. The UI uses "antibacterial" and "antifungal". (Amended: organism names
    are cheap and required for the beta, so add them early as data; "leaky/sealed" stays in the
    debug panel.)
  - E2E browser tests, CI and a deploy pipeline. A manual static build is enough.

## 3. Tech choices (all my calls unless noted)

| Area | Choice | Reason |
|---|---|---|
| Language | TypeScript, `strict` | The turn rules are fiddly state transitions, and types catch order and event shape mistakes cheaply. |
| Bundler / dev server | Vite (vanilla-ts template) | Zero-config TS, fast HMR, and a static `dist/` output. It is the de facto default for three.js projects. |
| Runtime pin | Node LTS pinned in `mise.toml`; npm as package manager | The user already uses mise; npm avoids an extra tool. |
| three.js | Latest stable release at kickoff, pinned to an exact version, with matching `@types/three`; `WebGLRenderer` (WebGL2), not `WebGPURenderer` | Locked-down school and hospital machines and integrated GPUs are a stated risk, and WebGL2 is the safe floor. |
| UI over canvas | Plain DOM and CSS in a `#ui` layer positioned absolutely over a full-window canvas. Small render functions, no UI framework. | Cards, panels and text are far easier and more accessible in DOM, and the prototype UI is small enough that a framework adds more than it saves. Revisit (Preact or Lit) if UI grows. |
| World-anchored labels | DOM elements positioned by projecting 3D points each frame | Crisp text with no font atlas work. Kept to a handful of labels. |
| State management | Sim state is one plain, serializable object. A ~30-line observable store in the app layer holds `{mode, sim, selection, ui}`. Sim functions are pure: `(state, input, rng) -> {state, events}`. | No library needed. Serializable state gives replays, seeds, the session log and tests for free. |
| Randomness | A seeded PRNG (mulberry32 or similar) that lives in the state | Deterministic tests, reproducible playtest bugs, and A/B comparisons of life choices on the same seed. |
| Testing | Vitest in the Node environment, covering `src/sim/` only. Scenario fixtures plus golden tests, and a "do nothing equals telegraph" invariant test. Rendering and UI are checked by hand. | Fast, and shares Vite config. The rules are where the bugs and balance questions live. |
| Sim/render separation | `src/sim/` has its own `tsconfig.sim.json` with `lib: ["ES2022"]` and no DOM lib, plus a lint rule (`no-restricted-imports`) that bans `three` and anything under `src/render` or `src/ui` from `src/sim` | A browser API or three.js import in the sim becomes a compile or lint error, so the sim stays testable in Node. |
| Instancing | One `InstancedMesh` per visual class (swarm cells, pathogen bits, spores), updated per frame from a CPU steering pass. No GPU compute. | A few hundred instances is trivial even on integrated GPUs. |
| Look (later) | `MeshToonMaterial` with a 3-step gradient map, a fresnel rim, and inverted-hull outlines on tokens | Matches the "stylized, not organic" direction in pitch 4. It is cheap and reads well. |
| Lint/format | ESLint (flat config) + Prettier, defaults | Mainly there to enforce the sim import boundary. |

## 4. Architecture

```text
src/
  sim/                      pure, no DOM, no three; tested in Node
    types.ts                GameState, BattleState, LifeState, Order, Intent, SimEvent
    rng.ts                  seeded PRNG, stored in state
    params.ts               every tunable number in one place
    board.ts                grid, adjacency, reachability, blocking
    battle/
      setup.ts              Loadout -> BattleState (composition, charges, aura, hidden tokens)
      intents.ts            generate pathogen intents (all enemy randomness rolled here)
      orders.ts             validate orders, compute previews (reachable tiles, outcome hints)
      resolve.ts            resolveTurn(state, orders) -> { state, events[] }
      outcome.ts            end check and graded outcome -> carry-over (reservoirs, energy)
    life/
      cards.ts              activity definitions (data), smarter versions, exposure odds
      calendar.ts           place cards, day advance, friction event, goal points
      meds.ts               med level and daily fade
      reservoirs.ts         growth over days, symptom trigger, doctor reveal
      loadout.ts            LifeState -> Loadout (the only bridge into battle)
    campaign.ts             mode transitions: life -> battle? -> outcome -> life
  render/                   three.js; reads state, plays events; never mutates sim state
    scene.ts                renderer, camera, lights, resize, viewport/scissor for inset
    boardView.ts            slab tiles, inflammation tint, granuloma blocks, hover/pick
    swarmView.ts            InstancedMesh + steering toward per-swarm anchor; load dims/swells
    pathogenView.ts         leaky/sealed tokens, size pips, spores
    telegraphView.ts        intent arrows, target tile outlines, order ghosts
    playback.ts             SimEvent[] -> timeline (2-4 s), speed 1x/2x/skip, replay last
    inset.ts                same scene, low detail, corner viewport; exposure preview particles
  ui/                       DOM overlay
    hud.ts                  turn counter, tissue health, charges, end-turn button
    ordersPanel.ts          selected swarm, available orders, keyboard shortcuts
    calendarView.ts         3 days x slots, card hand, odds, meds tap, friction event modal
    outcomeView.ts          graded result and what carries over
    debugPanel.ts           seed, scenario presets, loadout sliders, residual-kill slider
  app/
    main.ts                 bootstrap
    store.ts                tiny observable store
    controller.ts           mode machine: life | plan | playback | outcome; wires input to sim
    sessionLog.ts           append choices, orders, timings, outcomes; export JSON
```

The rules that keep the prototype honest and testable:

- **Events are the only bridge from sim to render.** `resolveTurn` returns the new state and an
  ordered `SimEvent[]` (`SwarmMoved`, `Engulfed`, `Killed`, `Loaded`, `ResidualKill`, `Spread`,
  `Spored`, `Walled`, `InflammationChanged`, `TissueDamaged`).
  - Playback animates those events.
  - When playback ends, the renderer snaps to the new state. A skipped or glitched animation can
    never desync the game.
- **Turn order (my call, a tuning target):**
  1. Player orders resolve: moves, then engulfs, then wall-offs.
  2. Surviving pathogens run their telegraphed intents. An engulfed pathogen's intent is
     cancelled, and a swarm standing on a target tile blocks a spread into it.
  3. Inflammation and damage tick.
  4. New intents are generated.

  This makes "stand in the way" a valid answer, which gives the board a positional puzzle.
- **One bridge into battle.** `loadout.ts` is the single function from life state to battle
  setup. Fairness question (c) is then a matter of reading one function. The debug panel can set a
  loadout directly, which skips the life phase while tuning.
- **Telegraph truthfulness is an invariant, not a hope.** Test: for any state, resolving with zero
  orders produces exactly the outcome the intents promised. The residual-kill roll is the one
  documented exception, and it can only help the player.
- **Inset = same scene, second viewport.** One renderer, one scene graph. In life mode the slab is
  drawn into the rectangle of a DOM placeholder (`getBoundingClientRect` -> `setViewport` and
  `setScissor`) at reduced instance count. There is no second WebGL context.

## 5. Task breakdown

Each task is one sitting. Each one ends with something you can see or play. Three checkpoints mark
where to stop and test before going further.

**Suggested branch:** `feat/prototype-core-loop`. You could also use one branch per milestone
(`feat/prototype-battle`, `feat/prototype-life`, `feat/prototype-look`) if you prefer smaller
merges.

**Commit granularity:** one commit per task, plus a separate `test(sim): ...` commit wherever tests
land apart from the feature. Examples:

- `chore: scaffold vite, three, vitest and sim boundary`
- `feat(sim): resolve pathogen intents`
- `feat(render): swarm playback timeline`
- `docs: add prototype plan`

### Milestone 1: the battle, greybox

**T0: Scaffold.**

- Set up Vite vanilla-ts, the pinned three.js version, Vitest, ESLint with the sim import ban, and
  `tsconfig.sim.json`.
- Pin Node in `mise.toml`.
- Add a full-window canvas with an empty `#ui` overlay.

*Done when:*

- `npm run dev` shows a lit grey box from the fixed angled camera.
- `npm test` passes one trivial sim test.
- Adding `import 'three'` to a sim file fails lint and typecheck.

**T1: Board on screen.**

- Add the sim types, PRNG, `board.ts` and one hand-written scenario fixture.
- `boardView` draws the 7x7 slab from state, with tile hover highlight and picking.

*Done when:*

- The slab renders from sim state.
- Hovering highlights tiles.
- Board adjacency and reachability tests pass.

**T2: Tokens.**

- Leaky and sealed pathogen tokens with size pips, distinct by silhouette.
- Three swarms as instanced clusters that idle with a gentle drift.
- A debug panel to load the scenario and set the seed by URL parameter.

*Done when:*

- A person who has never seen the game can point to "the round ones" and "the spiky ones" in a
  screenshot.

**T3: Intents and telegraph.**

- `intents.ts` covers grow, spread and spore.
- `telegraphView` draws arrows, target outlines and growth pips.
- End Turn resolves pathogens only and snaps to the new state (no animation yet).

*Done when:*

- Pressing End Turn repeatedly shows exactly what was telegraphed.
- The "zero orders equals telegraph" invariant test passes over 1,000 random seeds.

**T4: Move and hold.**

- Select a swarm, see its reachable tiles, issue move or hold, and see an order ghost (path line
  and destination marker).
- Swarms block spread.
- Keyboard: Tab cycles swarms, Enter ends the turn.

*Done when:*

- You can block a spread by standing in its path and watch the block happen on resolve.
- Order validation tests pass.

**T5: Engulf and load.**

- Engulf rules:
  - Engulfing a leaky pathogen kills it.
  - Engulfing a sealed pathogen contains it: the pathogen is removed from the board and the swarm
    gains load.
- Load cap, a slow penalty for loaded swarms, and the residual-kill odds pip and roll.
- Visuals (state snap only): the kill flash, and a dimmed, swollen loaded swarm.

*Done when:*

- Both engulf outcomes are visible and correct.
- Rule tests cover the load cap, the slow penalty and the residual roll at 0% and 100%.

**T6: Playback.**

- `playback.ts` turns `SimEvent[]` into a 2-4 s timeline:
  - Swarms stream along their paths, with cells steering toward a moving anchor.
  - Engulf wraps the token, then flashes or dims and swells.
  - Spread grows a bud into the next tile.
  - Spores arc to their target tile.
- Input is locked during playback.
- 1x, 2x and skip controls, plus "replay last turn".

*Done when:*

- A full turn plays out as a readable mini sequence.
- Skipping lands on the identical state.
- The game holds 60 fps on the weakest laptop available, or at least 30 fps on an integrated GPU.

**T7: Wall off, granulomas, inflammation.**

- Wall off turns a loaded swarm's contents into a granuloma on its tile. The tile is blocked and
  gets +inflammation, and the swarm is freed after one turn **(my call)**.
- Per-tile inflammation: it rises when more than one swarm commits to the same area, shows as a
  tile heat tint, slows swarms, and drains tissue health.

*Done when:*

- Flooding one spot with all three swarms visibly heats it and slows them.
- Walling off visibly trades space for safety.
- Tests pass.

**T8: Battle end and outcome.**

- The battle ends after N turns (start with 6) or when no free pathogens remain.
- Graded outcome:
  - Cleared: nothing left.
  - Contained: engulfed sealed pathogens or granulomas remain, and they become reservoirs.
  - Needed backup: tissue health below a threshold, or free pathogens remain.
- An outcome screen lists what carries over.

*Done when:*

- A seeded scenario plays start to finish in about 5 minutes and lands on different grades
  depending on play.

**Checkpoint A (internal).** Play-test questions (a) and (b) with 2-3 non-patient players (section
6). Do not start Milestone 2 until the turn is legible. If it is not, iterate on T3-T7.

### Milestone 2: the life phase and the link

**T9: Loadout into battle.**

- `loadout.ts` and `battle/setup.ts` take med level, exposures, reservoirs and doctor-visit flag.
- The debug panel gets loadout sliders and a "restart battle with this loadout" button.

*Done when:*

- Changing the sliders visibly changes enemy composition and starting hidden tokens on restart.
- Setup tests pass for each lever.

**T10: Meds in battle.**

- Passive aura: a soft glow on the slab whose strength equals the med level; it slows pathogen
  growth.
- Antibacterial and antifungal support charges, where the number of charges comes from med level.
- Charge targeting UI.

*Done when:*

- A seed played at med level 100% and at 30% feels noticeably different, and you can say why by
  looking at the board.

**T11: Calendar.**

- `calendarView`: three days with two slots each, and a hand of four cards. Example cards:
  - Yard work with a sibling; smarter version: indoor jobs.
  - The lake with Jordan; smarter version: the beach, but not the lagoon.
  - Band practice: safe.
  - A sleepover: carries the friction event.
- Cards show visible exposure odds and goal points.
- Meds: a one-tap default each morning, with a streak counter.
- The sleepover triggers the "pills in the other bag" event.
- Med level fades over the following days.
- Exposure is rolled when each day ends.

*Done when:*

- You can play three days and get a loadout summary.
- Two runs on the same seed with different choices produce different loadouts.

**T12: Body inset.**

- The slab is drawn in the calendar's corner viewport, showing the aura (med level) and any known
  reservoirs.
- Hovering a card streams preview particles in at a density that matches its odds, and the
  smarter version visibly brings fewer.
- A missed dose dims the aura over the next days. The dimming is animated when each day
  advances.

*Done when:*

- Without reading any text, a viewer can tell which card is riskier and that the aura dropped
  after the sleepover.

**T13: Campaign loop with carry-over.**

- Each cycle runs: life phase, then a battle only if an exposure landed or a reservoir flared,
  then the outcome.
- Run two cycles.
- Reservoirs grow during the second life phase and surface as a low-fever symptom card.
- The doctor-visit card costs one slot, reveals the hidden tokens, and adds one strong charge.
  Going early makes the reveal cheaper.
- A safe week skips the battle and shows a "quiet week" beat.

*Done when:*

- An end-to-end session takes 15-20 minutes.
- A contained result from battle 1 shows up as hidden tokens in battle 2, and seeing the doctor
  reveals them.

**T14: Session log and the "you brought" strip.**

- `sessionLog` records each card choice, each meds tap or skip, per-turn planning time, orders,
  skip and replay use, and each outcome. An export button saves it as JSON.
- Battle start shows a short visual "you brought" strip: the aura level, charges, and where the
  exposures came from, drawn as icons that tie back to the cards played.

*Done when:*

- A playtest session can be reconstructed from the exported JSON.
- The strip can be toggled off, so you can test whether players see the life-to-battle link
  without it.

**Checkpoint B.** Play-test the full loop, questions (a)-(c), including the first patient sessions
(section 6).

### Milestone 3: look and readability (only after Checkpoint A passes)

**T15: Toon pass.**

- Gradient-map toon materials, a rim light, and outlines on tokens.
- A "lit/unlit" color language for swarms: dim cells show load; a bright flash shows a kill.
- Soft background and slab colors; nothing visceral.

*Done when:*

- Screenshots from before and after show at least as clear a read on the same scenario, judged
  side by side.

**T16: Readability and access.**

- A colorblind check: shapes carry meaning before colors do.
- Text scale, full keyboard play, a reduced-motion option (skip playback by default with a
  summary pulse), and larger hit targets.

*Done when:*

- A full battle is playable by keyboard alone.
- The game still reads under a grayscale filter.

## 6. Playtest plan

### Who, in order

1. **Self and dev.** Test continuously against the "do nothing equals telegraph" feel.
2. **Two or three non-patient players**, ideally teens or casual gamers, at Checkpoint A. They test
   pure legibility and fun with no medical knowledge, which is close to how a newly diagnosed
   patient arrives.
3. **Three to five patients aged 13 and up that the user knows**, at Checkpoint B.
   - A parent or guardian consents for minors and may sit in.
   - Ideally include at least one patient with lived experience of a missed-dose period or an
     unusual infection.
   - Prefer in-person or a video call with screen share.
4. **Optional:** one clinician or nurse watches a recording or plays once, to flag anything
   unsafe in the implied messages before a wider test. This one is not about fun.

### Method

- Sessions run 20-30 minutes. Players think aloud. Do not explain the rules beyond one sentence
  ("you're the immune system; the arrows show what the germs will do next").
- **Prediction probe:** on turns 2, 4 and 6, before the player presses End Turn, ask "what will
  happen when you end the turn?" Score it right or wrong.
- Export the session log afterwards. Patient sessions collect no names or identifiers. Logs stay
  local and are shared only if the family agrees.

### Questions to ask (after play)

1. "Before you ended that turn, what did you expect to happen? Did it?" Tests (a): legibility.
2. "When you saw the spiky one, what did you want to do with it, and why?" Tests (b): the
   decision. Listen for trade-off language ("if I grab it my swarm gets slow, but if I leave it
   it spreads").
3. "Why did the second battle go the way it did?" Tests (c): attribution. Listen for unprompted
   mentions of the sleepover, the lake or the fever.
4. "If you played another week, what would you do differently?" Tests whether the life phase
   feels like a choice or a quiz, and whether players find the smarter versions.
5. Patients only: "Does any of this look or feel like what happens to you? Was anything scary,
   preachy or unfair?" Tests the success criterion and tone.

### Signals that something is not working

| Signal | Threshold (rough) | Likely meaning | Course change |
|---|---|---|---|
| Prediction probe accuracy | Under 60% after the first battle | The telegraph is not legible | Fewer simultaneous intents, a more top-down camera, bigger arrows, or merge tiles into 4-6 zones |
| Skip or 2x used on most turns | Over 70% of turns by battle 2 | Playback is too long or not interesting | Shorten to 1.5-2 s, add more contrast at the climax (flash and swell), or show less movement |
| Planning time per turn | Usually under 3 s (autopilot) or over 60 s (stuck) | No decision, or too much to parse | Raise the stakes per turn, or cut the number of swarms and pathogens |
| Engulf choice on sealed pathogens | The same choice almost every time across players and scenarios | (b) is a type check again | Retune load cost, spread speed, or granuloma cost until the choice depends on board state |
| Attribution | Players cannot name any life choice that shaped battle 2 | The link is not legible | Enlarge the inset, keep the "you brought" strip on, make the fade steeper |
| Life-phase framing | "The right answer is...", or always the safest card | A moral quiz | Make the risky cards pay more goal points, and make the odds more forgiving |
| Want to continue | Fewer than half want another cycle | Not fun yet | Stop adding features; revisit the core turn before Milestone 3 |
| Emotional response | Any patient says it felt scary or blaming | Tone problem | Fix before any further patient sessions |

**Rule of thumb:** if (a) fails after two tuning passes, change the board representation (zones,
camera) before touching anything else. Nothing downstream matters if the turn cannot be read.

## 7. Risks and unknowns

- **3D legibility.** An angled camera, overlapping swarms and arrows may read worse than a flat
  grid. Mitigations: greybox first, the prediction probe, and an escape hatch to a near top-down
  camera.
- **The decision may be solvable.** With only two pathogen types and one map, one strategy may
  dominate, such as always walling off. Scenario presets and the session log should make this show
  up early. Some of it is acceptable in a prototype; the question is whether the tension exists at
  all.
- **The life phase may be too thin to feel like a choice.** Four cards across three days could
  feel trivial. If so, that is a content problem rather than a loop problem; note it and do not
  expand it here.
- **Snowballing.** Reservoirs carried over plus a missed dose could make battle 2 miserable. Cap
  reservoirs at 2 for the prototype and keep the doctor visit a reliable reset.
- **Fairness perception.** Seeded randomness helps debugging, but players judge fairness by what
  they see. Exposure odds must be shown as concrete numbers or particle density, never hidden.
- **Performance on locked-down machines.** A few hundred instances is light, but CPU steering and
  DOM label projection each frame need a budget. Test on the weakest machine available at T6, not
  at the end.
- **Determinism versus animation.** Playback must never feed back into the sim. This is enforced
  by snapping to state after events.
- **Clinical accuracy is unverified.** The catalase metaphor, inflammation and the residual-kill
  framing are simplifications. Keep in-game wording generic and get a clinician glance before
  patient sessions if one is available.
- **Patient playtest logistics.** Consent for minors, emotional safety, and privacy of anything
  logged (the log implies a medical condition). No server collection.
- **Scope creep.** The prototype sits next to a rich design doc, and every task will invite "just
  one more card". The "Out" list in section 2 is the guard.

### Cut first if time runs short (in order)

1. The toon pass (T15). Greybox is fine for answering (a)-(c).
2. Most of T16 beyond keyboard play and the reduced-motion skip.
3. The doctor-visit card. Reveal reservoirs automatically at battle start instead; this loses some
   of (c).
4. The scripted friction event. Replace it with a plain "skip meds today" toggle.
5. Support charges. Keep only the passive aura as the med effect.
6. Steering-based playback. Replace it with simple tweens of each swarm cluster along its path.
7. The session log export. Rely on observation notes.

**Never cut:**

- The telegraph and its invariant test.
- Engulf, load and wall-off.
- The inset with the med fade.
- Reservoir carry-over across two cycles.

These are the three questions.

## 8. Rough size

There are 17 tasks (T0-T16), with T0-T14 as the core. Done one sitting at a time, Checkpoint A
falls after about 9 sittings and Checkpoint B after about 15. This is an estimate for planning
order, not a commitment.

## 9. Beta target and amendments (2026-10-29)

Target: a playable beta by **2026-11-21**, demoed at NIH a few days later. Solo developer; one adult
CGD patient is the only patient tester (a weaker signal, accepted). Clinician review is limited;
open questions live in `../specs/clinician-questions.md`.

Amendments to this plan:
- **Mobile.** Beta must support mobile. Use pointer events and large tap targets from T4; do the
  full mobile layout in the last week.
- **Organism names.** Required in the beta. Add them as data early.
- **Beta content.** The core loop plus two arcs: "first infection after diagnosis" (tutorial and
  contrast with meds) and "a first summer" (lung map).
- **Patient testing.** One adult patient, so no parental consent is needed. Logs stay local with no
  identifiers.
- **Prediction probe and thresholds.** Keep them, but treat one patient as an anecdote, not a
  statistic. Internal testers carry the legibility questions.

Proposed schedule (an estimate, not a commitment):
- Oct 30 - Nov 8: Milestone 1, battle greybox (T0-T8). Checkpoint A.
- Nov 9 - Nov 15: Milestone 2, life phase and link (T9-T14). Patient session around Nov 15-16.
- Nov 16 - Nov 21: mobile layout, organism names, the two arcs, tuning from patient feedback, demo
  build. The toon pass is cut first if time runs short.

Build workflow (coordinator model):
- Claude (Sonnet) coordinates, integrates, and verifies each task against its "done when", running
  the dev server and looking at it in a browser.
- An Opus subagent acts as the game expert for rules, telegraph readability, turn resolution,
  balance, playback feel, and milestone reviews.
- Sonnet subagents do straightforward implementation (scaffold, UI, tests, mobile layout, content
  data). Haiku only for mechanical edits.
- One feature branch, no worktrees. Parallel subagents only on disjoint folders (`src/sim`,
  `src/render`, `src/ui`). Everything else is sequential.
- The user decides whether it is fun and legible. Decision points are flagged.

Design amendments from the T1 sim review (Opus):
- **Shape must not equal leaky/sealed.** Staph aureus, Serratia and Burkholderia are sealed
  bacteria, so "round = killable" would teach something false. Shape shows growth form; sealed
  pathogens get a second cue (a hard shell rim). In the prototype the leaky one is round with no
  rim and the sealed one is spiky with a rim. T2's "round ones / spiky ones" check becomes "ones
  with a shell rim".
- **Events:** added `Grew` and `Blocked` to the SimEvent list. `Blocked` supports T4's "watch the
  block happen".
- **Load (T5):** counts pathogens, not size. Cap of 2.
- **Inflammation (T7):** costs a swarm moves, not extra tile cost, so the movement preview stays
  easy to read.
- **Hidden tokens (T9):** needs a rule for a swarm moving onto a hidden token; decide at T9.
- **Sim conventions:** 4-neighbour movement only; one occupant per tile; swarms can pass through
  other swarms but not stop on them; pathogens and granulomas block movement; two RNG streams
  (intents and resolution); an engulf order may include a move first.

## 10. Decisions only the user can make (answered 2026-10-29 unless noted)

1. Patients: one adult patient, local logs only.
2. Devices: desktop for the prototype; the beta must support mobile.
3. Hosting: in person or local for all prototype testing.
4. Clinician check: limited, after the initial version. Questions are in `../specs/clinician-questions.md`.
5. Naming: leaky/sealed in the prototype is fine; organism names required for the beta.
6. Default character: XL-like (low kill chance).
7. Tech: TypeScript, Vite and plain DOM accepted.
8. Builder and timebox: Claude coordinates with Opus and Sonnet subagents; beta by 2026-11-21.

Original questions, kept for reference:

1. **Patient playtesters.** Who, how many, which ages, in person or remote? Whether a parent or
   clinician is present? Whether any session data may be recorded or exported, even locally?
2. **Target devices.** Is desktop and laptop with mouse and keyboard enough for the prototype, or
   must it work on tablets or touch (common in hospitals)? This changes the input design from T4
   on.
3. **Hosting for remote tests.** A private static URL, or local and in-person only?
4. **Clinician check.** Is someone available to glance at the rules and wording before patient
   sessions? If not, is the user comfortable going ahead with the caveats?
5. **Naming in the prototype UI.** Should the prototype show "leaky" and "sealed" (or other
   working names), and should it show any organism names, or keep pathogens nameless for now?
6. **Default character.** Which residual-kill default should the prototype character use: XL-like
   (low) or AR p47phox-like (higher)? This affects how hard the sealed-pathogen decision feels.
7. **Tech defaults.** Do TypeScript, Vite and plain DOM work for the user, or do they prefer a UI
   framework they already know?
8. **Timebox and builder.** Who builds it, and how many sittings before Checkpoint A must happen
   regardless of polish?
