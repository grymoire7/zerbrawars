# Battle bar: design

> Status: agreed to build on a feature branch, time-boxed to 2026-11-18. Revised 2026-11-15 after a
> game-design review (section 11). Nothing here is built yet.

## 1. The rule

Zebra Wars is Plan, Battle, Reflect. **The player should never have to look back and forth between
two areas of the screen to find the controls for the phase they are in.**

- **The board area** (left on a wide screen, top on a phone in portrait) is where a battle is played
  and controlled.
- **The side panel** (right, or below the board on a phone in portrait) is where life choices are
  made, and where the battle reports to the player: status, explanations, the log.
- The rule is about **controls**. Information cards (the info and odds card, the Key, the log) may
  stay in the side panel and be consulted during a fight. That is ceded for now, mostly for space.
- A battle control that also appears in the side panel is a **mirror**. It never holds the only copy
  of a control, and the board area never lacks one the panel has.

Today the game does not follow this rule. This document is the plan to get the battle there.

## 2. Today (verified in the code, 2026-11-15)

**Layout** (`index.html`): `#app` is a flex column with `#board` on top (48% of the height, 30% in
the life phase) and `#side` below. At 900px wide, or an aspect ratio of 5:4 or more (laptops and
phone landscape), `#app` becomes a row: the board on the left, `#side` fixed at 340 to 480px on
the right. The canvas fills `#board` (`position: absolute; inset: 0`) and the camera frames itself to
the canvas's parent (`scene.ts`), reframing whenever that parent changes size. The Menu button
sits at the board's top left, Zoreo at its top right. `#side` holds the coach strip (Arc 1 only, at
the very top), the status strip, a scrolling column, and a pinned control bar, `#bar`.

**Battle controls and where they live:**

| Control | Where | Notes |
| --- | --- | --- |
| Select a swarm, move, engulf | the board (taps) | Valid tiles highlight on selection |
| Hold / wall off by tapping your own tile | the board | Own tile: hold, then wall off for a loaded swarm, then clear. An unloaded swarm can only hold |
| Charge chips (Antibacterial x1, Antifungal x2) | side panel, Medication card | Only kinds with charges left show. Pick a charge, then tap a target on the board |
| Swarm rows: status chip, a Clear button, "-> 5,4" coordinates; and a Dose row with its own Clear | side panel, Orders card | Select a swarm, clear an order, take back a queued dose. Count "Orders: 0 of 3 swarms" |
| End Turn "(3 swarms will hold)" | side panel, pinned `#bar` | Hidden while a turn plays back |
| Wall off (W) | side panel, pinned `#bar` | Shown when the selected swarm is loaded or has wall off queued; disabled, with the reason in the info card, when it cannot be done. Never created in Arc 1 |
| 1x, 2x, Skip | side panel, pinned `#bar` | Shown while a turn plays back, in End Turn's place |
| Replay last turn | side panel, pinned `#bar` | Disabled before the first turn |
| Reset | side panel, pinned `#bar` | Debug battle only |
| Keyboard | page | Tab is always captured and cycles swarms, so no button on the battle screen is keyboard-reachable today. W wall off; Enter ends the turn or skips playback; Space only skips; Escape deselects |

So the battle's controls are in the side panel, and the board only takes taps. Wall off already
exists as a contextual button; this proposal moves it, it does not add it.

**What "hold" is.** The resolver treats a swarm with no order as holding, and a hold does nothing.
The explicit hold order has three small jobs today: (1) it is the stepping stone in the own-tile
tap cycle to wall off; (2) it stops the idle ring (a pulsing ring on swarms with no order) from
nudging the player; (3) it cancels a queued move. A queued move, engulf or dose can already be
cleared by tapping the same target again, but not a hold. Hence the Orders card's Clear button.

## 3. Proposal: a battle bar docked to the board

A **battle bar**: one strip of buttons the width of the board, docked under it, never over tiles
(patient feedback: no overlays on the board). The buttons change with the state, so the bar only
shows what makes sense.

**Structure.** The bar is not inside `#board`: the canvas fills `#board`, and a bar inside it would
cover the canvas and shift Zoreo's portrait position. Instead a wrapper holds `#board` and the bar,
so the canvas keeps its own box and Zoreo and the Menu button are unaffected. The bar has a **fixed
height** with stable slots. The camera reframes whenever the canvas's box changes, so a bar that
adds or removes a row would make the board jump on every tap. Slots keep their place and only their
text and enabled state change. One line is reserved for the prompt.

| State | The bar shows |
| --- | --- |
| Planning, nothing selected | A button per charge kind the fight started with (a spent one stays, disabled, labelled "used"; never a kind the fight started without), End Turn with "(N swarms will hold)", Replay last turn (disabled before the first turn) |
| A swarm is selected | The same, plus Wall off for a loaded swarm (never in Arc 1), disabled with its reason in the prompt line when it cannot be done. Tapping the swarm's own tile clears its order, or deselects if it has none |
| A charge is picked | The charge's button reads "Put back", and the prompt line says "Tap a green diamond on the board." |
| A dose is queued | One button, "Dose set: Antifungal. Take it back", in place of the charge buttons |
| A turn is playing | "Faster" (a toggle, replacing 1x and 2x) and Skip, with Skip placed away from where End Turn was so a double tap on End Turn cannot skip the animation |
| Debug battle | Reset, as now |

**What moves out of the side panel:** the pinned `#bar` (End Turn, Wall off, speed and skip,
Replay, Reset), the charge chips, and the dose's Clear. **What stays:** the status strip, coach
strip, turn summary, the info and preview card, the Key, the log. The Medication card is left with
a heading and a tip once the chips are gone, so its one sentence ("Each germ has an N% chance of
being held back") moves onto the Medication status cell's tip, and the card goes.

**The Orders card becomes a mirror.** It is a `<details>`, closed by default, titled by its content
("Swarm orders: 1 of 3"). It keeps one row per swarm to select it, the status chip and the dose row
with its take-back button, and a Wall off button for a loaded swarm. It loses the coordinates ("->
5,4" is a grid position nobody sees on the board) and the per-swarm Clear (tapping the swarm does
it). This is a partial mirror: it selects swarms, shows status and takes back a dose. Moves,
engulfs and charge targets stay pointer-only until the accessibility pass (B7, section 6).

**The coach strip.** The Arc 1 coach strip lives at the top of the side panel and outlines the
control it points at (End Turn, a charge). The outline moves with the buttons. On a laptop the strip
(top right) and the bar (bottom left) are as far apart as the screen allows, so the spike checks
whether the coach text should move closer to the bar.

## 4. The hold change (does not depend on the bar)

- A tap on the selected swarm's own tile clears its order; if it has none, it deselects. The
  player never queues "hold" from the UI. The sim keeps the `hold` order type (bots and tests use
  it).
- Wall off is reached by the Wall off button or the W key. The own-tile tap cycle (hold, wall off,
  clear) is retired.
- **Idle ring:** it pulses on swarms with no order until the fight's first End Turn, then stays
  steady. A swarm the player keeps still on purpose would otherwise pulse for the whole fight, which
  reads as "you forgot". Reduced motion already gets a steady ring. The End Turn caption, "(2 swarms
  will hold)", is the reassurance.
- **Help text** (`src/ui/help.ts`): line 30 stops listing hold as an order; line 34 becomes "Tap the
  swarm again to cancel its order."; line 50 changes ("pick a charge in the side panel", "press
  Clear") to match the bar's take-back button.
- **Orders card:** the coordinates go, and with them the per-swarm Clear.
- Until the bar lands, Wall off and the other controls stay where they are, in the side panel's
  `#bar`.

## 5. Layout per screen

| Screen | Plan |
| --- | --- |
| Laptop, wide | The bar is under the board, in the left column, as wide as the board. The board gets a little shorter |
| Phone portrait | Board, then the bar, then the side panel. In portrait the board's drawing is limited by width, so it has empty bands above and below, and the side panel loses `#bar`, so the two should absorb the bar without a visible loss. To be confirmed by screenshots |
| Phone landscape (short) | The bar sits under the board in the left column. The height budget there is the risk (`max-height: 500px`, 44px targets); the spike decides whether it fits in one row |
| Safe-area insets | The bar sits above the home indicator, as `#bar` does today (`env(safe-area-inset-bottom)`) |

Checks needed in the spike: 375x667, 390x844 and 844x390.

## 6. Accessibility

- Every bar button is a real `<button>` with an accessible name, and gets a `data-key` now (the
  accessibility design's rule) so the B7 work does not rewrite the same code twice.
- A disabled Wall off keeps its reason in the prompt line and in `aria-describedby`; use
  `aria-disabled` so it stays focusable once B7 frees Tab.
- One persistent prompt node, updated only when its text changes, so a screen reader is not
  chatty.
- The existing keyboard model stays: W wall off, Enter ends the turn or skips, Space skips, Escape
  deselects. Tab remains captured until B7.
- General accessibility, including the keyboard route to moves and engulfs (a board cursor with
  number keys, per `b7-accessibility-design.md`), is deferred past the demo. B7's section on Enter
  on a board tile still lists "hold, wall off, clear" and needs a one-line update after the hold
  change.

## 7. What we are not doing for the demo

- Moving the life-phase controls: the life phase is the side panel's job, so "Play the week" and
  its siblings stay where they are. The rule is satisfied there already.
- Haptic feedback on selection.
- The "Swarm 1" to "Swarm 3" rename. The ids "s1, s2, s3" also appear in the wall card, the odds
  text, the dose card and the log, so renaming only the card would make them disagree. Do it later
  with one display-name helper, or not at all.
- A swarm label on the board that matches the card's names.
- The full accessibility pass.

## 8. Plan and cut line

All work on a feature branch, `feat/battle-bar`; `main` stays releasable and production only changes
on a tag. Demo target: 2026-11-21.

1. This document, reviewed. (Done; section 11.)
2. The hold change (section 4). Small and independent, so it is the first commits on the branch and
   can be merged to `main` on its own if the bar does not make it.
3. A spike of the bar at three viewports (laptop, phone portrait, phone landscape), checked with
   screenshots, before anything is polished.
4. Move the charges and wire the contextual states, then update the tests.
5. Check on a real phone, in portrait and landscape.

**Time box: 2026-11-18.** By then the bar must work at all three viewports and be checked on the
phone. If it cannot, the demo ships the hold change on `main` with the existing panel, and the bar
waits until after the demo. The tasks in this document are the demo's priority along with
simplicity: the audience must see Plan, Battle, Reflect at a glance. More activities are a
nice-to-have, and general accessibility is deferred.

## 9. Open points for the spike

1. Phone landscape: does the bar fit in one row under the board?
2. Coach strip: does its text need to move closer to the bar on a laptop?
3. Replay last turn: it is a Reflect action. It starts in the bar, away from End Turn; if it
   crowds the bar, it moves to the top of the log's body as "Watch last turn again".

## 10. Where the rule goes once the bar works

A line in the UI rules of `AGENTS.md`: a phase's controls live in that phase's area; the side panel
may mirror them but never holds the only copy; information cards may stay in the panel.

## 11. Review outcome (2026-11-15)

A game-design review checked this document against the code. **Adopted:** the factual corrections
(keyboard model, the partial mirror, the disabled Wall off, the dose row and its take-back, the
help text lines, "Tap a green diamond", the id rename, the canvas and bar structure and Zoreo, the
fixed-height bar, the coach strip), the answers on charges, playback, the idle ring and the mirror
card, and the Medication card going empty.

**Not adopted:** the reviewer recommended skipping the docked bar for the demo and instead moving
the charges into the existing pinned bar, and restating the rule as "a phase's controls sit
together in one strip" with information allowed beside it. The owner kept the rule as "never look
back and forth for controls", with information cards ceded for now, and decided to build the docked
bar on a feature branch inside the time box above. The reviewer's pinned-strip version is the
fallback if the bar does not fit by 2026-11-18.
