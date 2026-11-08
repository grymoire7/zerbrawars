# Arc 1 tutorial: design

What Arc 1, "First infection", teaches, how its two fights are built, how the coach marks work, and
what it costs to build in the current code. Design only. Slices are tracked in `../plans/beta-plan.md`
(task B4). Items marked **(my call)** are defaults. Tracy decides them in section 7. The clinical
corrections in `fodder.md` override anything here.

## 1. Where it starts from

- Arc 1 today is `ARCS[0]` in `src/app/arcs.ts`: one `first-board` battle at full medication, the
  normal outcome card, then arc-complete. The arc `intro` text is never shown, because no screen
  reads it.
- `mountBattle` calls `help.showFirstTime()`, so a new player's first sight of the game is the
  twelve-paragraph How to play dialog. That is the wall of text B4 is meant to remove.
- A single-fight arc has no `Run`, which means no session log. The outcome card still says "Energy
  carried forward: 2", which means nothing outside a campaign.
- With medication at 0 the battle status strip shows "Medication 0/3, none". Before a diagnosis that
  reads as "you missed your doses". That is blame, and here it is also untrue.
- What already helps: the sim is deterministic per seed. The stall roll is always made first, so the
  same seed gives the same dice at any medication level (`rollIntent` in `intents.ts`). A `Loadout`
  already takes fixed tiles, arrivals, `medLevel` and `residualKillChance`. Charges can target a
  germ anywhere on the board. The swarms that still have no order are already highlighted.

## 2. What a new player must understand, and in what order

A teen with no instructions should come out of Arc 1 able to say: *my cells show up and they work.
Some germs have a shell my cells can swallow but not finish. My medicine slows germs down and gives
me charges that finish the shelled ones. The arrows tell me what happens next.* That is the CGD
idea ("one tool is missing, not the whole defence"), and it is enough to play Arc 2.

| # | Idea | Where | How it is taught |
| - | ---- | ----- | ---------------- |
| 1 | Select a swarm, tap to move | A, turn 1 | coach mark |
| 2 | Engulf. A germ with no shell dies (Streptococcus) | A, turn 1 | coach mark, then the kill itself |
| 3 | End Turn: everything moves at once | A, turn 1 | coach mark |
| 4 | The telegraph: arrows show next turn | A, turn 2 | coach mark, on the mold's grow or spore |
| 5 | Shell: swallowed, not finished (Aspergillus) | A, turns 2-3 | reacts to the engulf, or a nudge |
| 6 | Medication glow slows germs | B, turn 1 | coach mark, then the green pause sign it causes |
| 7 | Charges, one at a time (antifungal on the mold) | B, turn 1 | coach mark, two steps |
| 8 | Arrivals: a ring at the edge means more germs are coming | B, turn 2 | reacts to the first incoming ring |

**On, but not taught:** inflammation and heat (visible and small in these fights; the status strip
cell explains it on tap), the turn clock, the backup stop (Part A only reaches it if the player does
nothing at all, and the story card covers that ending).

**Switched off in Arc 1:** wall off (button hidden, the double tap on a loaded swarm does nothing).
It is the one order you can trigger by accident, and it needs heat and blocked tiles to make sense.
Also off: hidden germs and reservoirs, the doctor's strong charge, Staphylococcus, missed doses,
the score, the life phase.

**Left for Arc 2 and later:** wall off and granulomas, heat from crowding and loads, the carried
"finish" percentage, hidden germs, the doctor visit, Staphylococcus, missed doses making arrivals
bigger, the week. Arc 2's first battle still opens How to play once, as it does today, and the life
screen has its own guide, so wall off and heat are explained there. A later option is to reuse the
coach layer in Arc 2 for two marks, wall off and heat (section 5, nice-to-haves).

## 3. The two fights

### 3.1 Framing: "Before anyone knew", not "a memory"

Calling it "a memory" assumes the player remembers. Many X-linked patients are diagnosed as small
children and do not. Some autosomal recessive patients are diagnosed in their teens. Clinician item
20 already flags this variety. **(my call)** Tell it in the second person and past tense, open about
the variety, as "how it usually goes". Do not present it as the player's own memory. Then it is
true for everyone and asks nothing of them:

> **Before anyone knew**
> Some people remember the time before they knew they had CGD. Some were too little to remember.
> Either way, it often goes something like this.
> A germ got into your lungs, and your cells rushed in to deal with it.
> [ Play ]   [ Skip to after the diagnosis ]

"Losing" is the wrong word, and the game never uses it. Part A is not lost. It ends at a fixed turn
with the shelled germ still there. That is the true story: the cells did their job, one tool was
missing, and the doctors helped and found the reason. The ending card says so. It shows no grade
and no tissue score.

### 3.2 Part A, "before the diagnosis" (4 turns, about 2 minutes)

Medication 0, so no glow and no charges. Residual kill chance is the variant's, which keeps it
honest. `maxTurns` is 4. The fight ends at the clock, at the backup line, or (rarely) all clear.

```
     x0  x1  x2  x3  x4  x5  x6
y0   .   .   .   .   .  [D]  .      [D] door (5,0): Aspergillus size 2 arrives on turn 3
y1   .   .   .   .   M   .   .      M  Aspergillus size 2 (shelled mold)
y2   .   .   .   .   .   .   .
y3   .   S   .   .   .   .   .      S  Streptococcus size 1 (no shell)
y4   .   .   .   .   .   .   .
y5   .   .   .   .   .   .   .
y6   .  s1   .  s2   .  s3   .      swarms on the near edge, as always
```

- **Turn 1.** s1 can move to (1,4) and engulf the strep. That is the easy first win, and it proves
  the cells work. The mold telegraphs "grow 2 to 3". s2 can get within reach of the mold.
- **Turn 2.** The mold, now size 3, telegraphs a spore (the seed is chosen so it does). Engulfing it
  cancels the spore, and the swarm *loads*: the shell moment.
- **Turns 3-4.** The second mold arrives at the door. With no charges and a 10% finish chance, a
  shelled germ almost always remains at the clock. This is "it kept coming back" without any drain.
- **Tissue.** Target: even a player who does nothing ends at 12 or more out of 20. Tune the
  arrival and the seed if a test shows otherwise. The backup stop is a safety net only.

**Ending card (replaces the outcome card in Part A; it is also the bridge to Part B):**

> **The day it got a name**
> Your cells did everything they could. They came fast and swallowed the germs.
> *(if a strep was killed)* They finished off the Streptococcus with no trouble.
> *(if a shelled germ is left, free or inside)* But the Aspergillus kept coming back. Your cells
> were missing one tool to finish it.
> *(otherwise)* They got there in the end, but it took everything they had.
> The doctors helped your body clear it, and ran some tests. The missing tool had a name: CGD.
> And with a name came a plan.
> [ See what changes ]

Organism names in the card are built with `organismName()` from `src/sim/organisms.ts`, never typed.

### 3.3 Part B, "after the diagnosis" (up to 6 turns, about 3 minutes)

The same board, **the same seed**, the same arrival, medication 1.0: full glow, 1 antibacterial and
2 antifungal charges (the real full-dose tier, no special case). Normal `maxTurns` 6, ending on all
clear.

The contrast happens without a lecture, in three places the player sees:

1. **The glow.** The board edge is green from turn 1. The status strip reads "Medication 3/3, full"
   where Part A read "not yet".
2. **The same germ behaves differently.** Same dice, but now the stall roll can land. The seed is
   chosen so that on turn 1 the mold that grew in Part A shows the green pause sign and the word
   "stalled" in Part B.
3. **The shell can be beaten.** The antifungal charge finishes the size-2 mold on turn 1, and the
   second antifungal finishes the arriving one. If the player swallows the mold instead, the carried
   roll now gets the medicine bonus (35% instead of 10%), and a charge can clear the load.

A careful player gets "All clear" around turn 4. **Outcome card in Part B (my call):** the normal
card, minus the energy and carry-forward lines, with arc copy:

> **All clear**
> Same germs, different ending. CGD takes one tool away, not your whole defence, and your medicine
> helps fill the gap.
> [ Finish ]

If the fight ends contained instead: **"Held"**, with "Not quite all clear, and that is fine. Your
medicine gave your cells a real chance, and the doctor can help with the rest."

**Arc complete:** "That is how it started. From here on, medicine is part of your routine, and the
fights are yours to plan." It adds one primary button, **Go on to Arc 2** (my call), because the
demo flows straight from one arc to the other.

### 3.4 Skipping Part A

**(my call)** A secondary button on the intro card: "Skip to after the diagnosis". There is no
stored state. Replay from arc-complete shows the intro card again, with the skip. For development
and the facilitator, `?arc=1&part=b` starts Part B directly. The arc picker stays one item.

## 4. Coach marks

### 4.1 Mechanism (recommended: a coach line at the top of the side panel)

- **Where.** A one-line strip pinned at the top of `#side`, above the status strip, on every layout.
  It never covers the board, the Menu chip (top-left of the board) or the germs at the far edge.
  On a phone in portrait it sits right under the board, where the eye goes after a tap. On a laptop
  it heads the side panel next to the turn box.
- **Pointing.** A control target (the End Turn button, a charge chip) gets a pulsing outline class.
  A board target relies on what the game already draws: the bright move tiles, the idle-swarm marks,
  the green diamonds for charge targets, the telegraph. A pulsing ring on a tile is a nice-to-have.
- **Text.** One sentence, two short ones at most, about 110 characters. "Tap" on a coarse pointer,
  "Click" otherwise. Swarm ids (s1) and tile coordinates never appear.
- **Dismissal.** Most marks finish when the player does the thing. Each mark also has a small "Got
  it" button. A finished mark never comes back during this play of the arc. A mark that is ignored
  retires quietly after two turns on screen. No nagging, no blocking: every order and End Turn work
  at any time.
- **One at a time,** in priority order. Marks are hidden during turn playback and come back when the
  turn ends.
- **Overlays.** The menu, How to play, and the outcome or story card all sit in `#ui` with a
  backdrop, so they cover the strip and no special case is needed. Opening them pauses nothing,
  because no time passes in planning. "Start this fight over" keeps finished marks finished.
  Escape keeps its menu role. The strip is `role="status"`, `aria-live="polite"`, and never takes
  focus.
- **Replays.** Marks show on every play of Arc 1 (no localStorage), and a returning player clears
  them by playing normally. Arc 1 never opens How to play by itself; the "?" still works.

```
Phone, portrait (Part B, turn 1)          Laptop (Part A, turn 2)
+----------------------------------+      +-------------------------------+---------------------+
| [☰]         board (48%)          |      | [☰ Menu]                      | The arrows show what|
|      green glow on the edge      |      |                               | each germ does next |
|                                  |      |        board                  | turn.     [Got it]  |
+----------------------------------+      |                               |---------------------|
| Your medicine also gives you     |      |                               | Tissue | Inflam |...|
| charges. Tap Antifungal.  [Got it]|     |                               | Turn 2 of 4     [?] |
|----------------------------------|      |                               | Medication: not yet |
| Tissue | Inflammation | Medication|     |                               | Orders ...          |
| Turn 1 of 6 . next turn 3   [?]  |      |                               |                     |
| Medication [Antifungal x2]*pulse*|      |                               | [ End Turn ]        |
| [            End Turn          ] |      +-------------------------------+---------------------+
+----------------------------------+
```

**Alternatives.** (b) Floating bubbles anchored to a projected tile: more game-like, but on a phone
they cover the board and the germs. Placement code for each layout costs about 4 hours more. Not
recommended for the beta. (c) A short modal card before each turn: cheapest (about 2 hours), but it
is the wall of text again in small pieces, and it stops play. Not recommended.

### 4.2 The marks (exact wording)

"Done" is what retires a mark. The script (board, seed, turn-1 telegraph) is fixed, so turn-1 marks
can name germs. Everything after turn 1 depends on the player and is chosen from the state.

| Id | Shows when | Text | Done when |
| -- | ---------- | ---- | --------- |
| A1 | Part A starts | These are your cells, in swarms. Tap one to pick it. | a swarm is selected |
| A2 | a swarm is selected with no order, and a germ is in its reach | Tap the Streptococcus to swallow it. | an order is queued |
| A2b | same, no germ in reach | The bright tiles show where it can go. Tap one to move closer. | an order is queued |
| A3 | an order is queued, turn not ended | Give the others orders too, or press End Turn. Everything moves at once. | End Turn |
| A4 | turn 2 planning (prefix "Nice, your cells finished it." if a germ was killed) | The arrows show what each germ will do next turn. | Got it, or an order |
| A5 | after a playback in which a shelled germ was swallowed | Swallowed, but not finished. Its shell keeps it alive inside your cells. | Got it, or an order |
| A5b | start of turn 3 if no shelled germ has been swallowed | The Aspergillus has a shell. Try swallowing it and see what happens. | a shelled germ is swallowed |
| B1 | Part B starts | Now you take medicine every day. The green glow is your medicine, slowing germs down. | Got it, or a selection |
| B2 | after B1, a charge is available | Your medicine also gives you charges. Tap Antifungal. | the charge is picked |
| B2b | the antifungal charge is picked | Now tap the green diamond on the Aspergillus. | a charge order is queued |
| B3 | first planning phase with a stall mark | See the green pause sign? Your medicine is holding that germ back this turn. | Got it, or next turn |
| B4 | first planning phase with an incoming ring | A ring at the edge means more germs are coming. A swarm standing on it meets them there. | Got it, or next turn |
| B5 | after a playback in which a shelled germ was swallowed in Part B (optional) | Swallowed. With your medicine, your cells have a better chance to finish it each turn. | Got it, or an order |

There are nine core marks. The "b" rows are variants of the same mark, not extra ones.

**The unexpected:**
- Ending a turn with no orders satisfies A3. A1 and A2 stay for at most two turns.
- Engulfing the mold before the strep is fine: A5 comes first.
- Spending the antifungal on the strep is refused by the existing support rules (an antibacterial
  kills strep). The chip hint already says why, and B2b stays up.
- Using the antibacterial instead is fine: B2 still counts as done, because a charge was picked.
- Restarting a fight keeps finished marks finished.
- Leaving to the title drops Arc 1 (it is not held, as today), and the next start shows the intro.

## 5. Building it

### 5.1 What exists and what is new (recommended option)

| Slice | Hours | What a reviewer sees |
| ----- | ----- | -------------------- |
| T1 Tutorial scenarios | 4 | `tutorial-a` and `tutorial-b` in `scenarios.ts`, plus an optional `maxTurns` on `Loadout` (setup, validate). A test pins the seed: turn 1 in A shows the mold growing, in B the same mold stalled. Bot checks: `hold` in A ends at 12+ tissue, careful play in A leaves a shelled germ 90%+ of the time, careful play in B clears 85%+. `?scenario=tutorial-a` plays. |
| T2 Arc runner and cards | 4 | `ArcPlay` gains `{ kind: "tutorial" }`: intro card, then A, then the A story card (the bridge), then B, then arc-complete. The cards use the existing menu card (`createMenu`). Skip button, `?part=b`, Go on to Arc 2. New copy in `arcs.ts`. The intro screen is generic, so B5 can reuse it for Arc 2's intro. |
| T3 Tutorial battle chrome | 3 | A `tutorial` option on `mountBattle`: no first-time How to play; Key and "What happened" collapsed; wall off off (hud button hidden, `toggleWallOff` refuses); the medication cell reads "not yet" in A with a kind explain line; the outcome card has no energy or carry lines and takes arc copy; the A outcome is the story card. |
| T4 Coach model | 4 | A pure `coachModel.ts`: (part, battle, orders, selection, charge, mode, last events, marks, done set) to the mark to show, or none. Unit tests cover every row in 4.2 and the retire rule. |
| T5 Coach strip | 4 | The strip in `#side` (an `index.html` mount, CSS for portrait and landscape), the outline on DOM targets, Tap or Click wording, hidden during playback. Screenshots at 390x844 and 1280x800. |
| T6 Copy and tuning pass | 2 | Tracy plays both parts on laptop and phone. Wording and seed fixed. |
| **Total** | **about 21** | |

Order: T1 and T4 are pure and testable first. T2 and T3 next. T5 last. The floor that still meets
B4's done line is T1 to T5 with copy as written here.

**Nice-to-haves, in order of value:**
- A pulsing ring on board targets (2h).
- A virus vignette (about 6h). It is render only, with no sim change: on Part A turn 1 a few virus
  particles drift in at the board edge and fade as "other defenders" clear them, with one coach
  line: "That was a virus. Other parts of your immune system handle those on their own." `fodder.md`
  says viruses belong in the tutorial, so this is the honest way to show that CGD breaks one part.
  It needs clinician item 9 (NK cells, T cells and antibodies only; never macrophages). Until it is
  built, the strep kill in Part A carries that message for the neutrophils themselves.
- A session log for Arc 1 (2h): mark shown and done times, and whether Key or "?" was opened, so B9
  can measure "completed without reading the Key". Without it the facilitator watches.
- Arc 2 coach marks for wall off and heat, reusing the layer (3h).

### 5.2 Options

1. **Two fights, the same seed, a story card between them (recommended, about 21h).** This is the
   cleanest contrast: identical opening dice, so "it grew then, it stalls now" is literally true. It
   matches pitch 4's two prologues. Part A can be skipped without touching Part B.
2. **One fight, diagnosis mid-fight (about 18h).** Turns 1-3 with no medicine, a story card, then
   the glow switches on with charges for turns 4-7. The glow switching on is very striking, and no
   runner is needed. But the meds in the game stand for daily prophylaxis, and they would arrive
   inside one infection, which muddles that. There is also no clean skip, and the sim needs a
   scripted mid-battle medication change. A close second.
3. **Part B only (about 14h).** The plan's cut item 5. Coach marks on the medicated fight, and the
   intro card tells the before part in two lines. It keeps the charges and glow lessons but loses
   the felt contrast. Use it only if T1 to T5 slip.

### 5.3 Conflicts and plan changes

- **Plan risk "keep it to five coach marks":** change it to "about nine one-line marks across two
  short fights, one on screen at a time, none blocking". Five cannot cover select, engulf, End Turn,
  the telegraph, the shell, the glow, charges and arrivals.
- **B4 done line:** add "Arc 1 never opens How to play by itself" and "Part A shows no grade". The
  "completed without reading the Key" check needs the facilitator or the Arc 1 log nice-to-have.
- **`showFirstTime` in `battleScreen.ts`** must be skipped in Arc 1, but not marked seen, so Arc 2
  still explains wall off and heat.
- **The arc `intro` field is unused.** T2 adds the screen that shows it. B5 should build on it,
  not make a second one.
- **The outcome card in single-fight arcs** shows energy, which is meaningless there. T3 removes it
  for Arc 1.
- **The "What happened" log** prints ids and coordinates ("p2 spored to 3,4"). It is collapsed in
  Arc 1. It is worth a wording pass in B10 for Arc 2.
- **Balance.** Part B is easy on purpose (empowerment, not challenge). Part A must never drain. The
  `hold` bot assertion in T1 guards that. The AR variant's 25% residual chance makes a lucky Part A
  clear a little more likely, and the ending copy covers it.
- **B7 keyboard.** Tab cycles swarms on the battle screen, so A1's "Tap one" is also true for Tab.
  B7 still owns Tab reaching the buttons.

## 6. Clinical assumptions to add to `clinician-questions.md`

New numbers start at 23 (week-phase-design reserves 22).

| # | Question | Working assumption | Priority |
| - | -------- | ------------------ | -------- |
| 20 (raise) | Diagnosis experience: how varied is it, and how should the before-diagnosis prologue be framed? | "Before anyone knew", second person, "it often goes something like this", skippable. Raise to **A**: it is the first thing a demo visitor plays. | A |
| 23 | Is a first serious lung infection, where the cells arrive and swallow germs but cannot finish a mold, a fair picture of how CGD is often found? The card says: "The doctors helped your body clear it, and ran some tests. The missing tool had a name: CGD." | Fair as one common story, told as not everyone's | A |
| 24 | Is "CGD takes one tool away, not your whole defence" acceptable wording for a patient, given that macrophages and monocytes are also affected? | Yes, with no claim about which other cells are fine (see 9) | A |
| 25 | Is Aspergillus a fair organism for the first lung infection in the tutorial (rather than Staphylococcus or Burkholderia), with Streptococcus as the germ the cells do finish? | Yes for the lung. Streptococcus stays the simplified "no shell" example (see 11) | B |
| 26 | In the tutorial, daily medicine visibly slows germs and gives charges that finish a small mold. Is that an acceptable game picture of antibacterial and antifungal prophylaxis, as long as it is never stated as fact? | Yes, as a declared game rule (related to 21) | B |

## 7. Open questions for Tracy

1. **Shape.** Two fights with the same seed and a story card between them (option 1)? Default: yes.
2. **Framing.** "Before anyone knew" in the second person, open about the variety, instead of "a
   memory"? Default: yes.
3. **Skip.** A secondary "Skip to after the diagnosis" on the intro card, with no stored state?
   Default: yes.
4. **No losing.** Part A ends at a 4-turn clock on a story card with no grade and no tissue score?
   Default: yes.
5. **Wall off off in Arc 1,** taught in Arc 2 by its How to play as today? Default: yes.
6. **No first-time How to play in Arc 1,** and it is not marked seen? Default: yes.
7. **Coach line at the top of the side panel** on every layout, rather than floating bubbles?
   Default: yes.
8. **Marks on every replay** with no stored flags (fast players clear them by playing)? Default: yes.
9. **Part B outcome copy** ("Same germs, different ending...") and **Go on to Arc 2** on Arc 1's
   arc-complete? Default: yes.
10. **Viruses.** `fodder.md` says the tutorial shows them. Build the 6-hour vignette only after T1 to
    T6, and only if clinician item 9 is answered or the wording stays neutral? Default: yes, as the
    first nice-to-have. Without it, the beta does not show viruses in Arc 1.
11. **Arc 1 session log** (2h) for the B9 "without the Key" check, or the facilitator watches?
    Default: the facilitator watches.
12. **Plan edits** in section 5.3 (the coach-mark count, the B4 done line, item 20 raised to A).
    Default: yes.

## 8. Decisions (Tracy, 2026-11-08)

All defaults in section 7 are accepted except as follows.

- **Q4, Part A must show the disease, not hide it.** Part A is not "losing", and it is not a gentle
  non-event either. The player must see that the body is sick and that the cells cannot finish the
  infection; that is the point of the "before diagnosis" half. So Part A's scenario guarantees an
  unfinished infection at the end (a shelled germ still on the board or inside a swarm, and the
  tissue and inflammation readings visibly strained), not just "almost always". There is still no
  grade and no blame; the card names what was missing. The test for T1 asserts the infection is
  unfinished for any play, not only for `hold`.
- **Q5, Q6 (wall off off, no first-time How to play in Arc 1):** fine for now; revisit after play
  testing.
- **Q10 (viruses):** CGD patients are not more susceptible to viruses; showing that in the tutorial
  gives a complete and fair picture (the immune system is not completely broken). The wording and
  explanation wait for the clinician's answer to item 9. No virus vignette until then.
- **Medication cell before a diagnosis:** the status strip reads "Medication: none" in Part A, not
  "0/3, none", which could read as blame.
- **Clinical input from the patient side (not clinician review).** The primary patient tester (AR) confirms: CGD is often first suspected from recurrent
  or severe infections, commonly in the lungs (pneumonia) or the liver (abscesses), so a first lung
  infection the cells cannot finish is a fair picture (item 23). Aspergillus is in the range of possibility (item 25).
  "CGD does not put you in a bubble, but it takes away one of the tools your immune system uses to
  fight infections" is fair (item 24). Item 26 is unanswered. These are recorded in
  `clinician-questions.md` as patient-side answers, still pending a clinician.

### Built differently from sections 3.2 and 3.3 (T1)

- **Part A is 3 turns, not 4.** With the strep and the mold both on the board, a player who does
  nothing loses 10 or more tissue over 4 turns, so "at least 12 of 20" cannot hold. At 3 turns it
  holds on every seed tried, and the arriving mold lands as the clock runs out: the player sees its
  ring but never fights it.
- **Part A's residual kill chance is fixed at 0** (both variants). Without that, a lucky roll can
  finish the mold, which would erase the point of Part A. Part B uses the variant's own value.
