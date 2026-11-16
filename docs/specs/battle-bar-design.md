# Battle bar: design

> Status: proposal for review, 2026-11-15. Nothing here is built. Written after a playtest question
> ("what is the Orders card for?") that turned into a layout rule. For the game designer: the
> decisions we need from you are in section 9.

## 1. The rule

Zebra Wars is Plan, Battle, Reflect. The player should never look back and forth between two
areas of the screen to find the controls for the phase they are in.

- **The board area** (left on a wide screen, top on a phone in portrait) is where a battle is played
  and controlled.
- **The side panel** (right, or below the board on a phone in portrait) is where life choices are
  made, and where the battle reports to the player: status, explanations, the log.
- A battle control that lives in the side panel is a **mirror**, built for keyboard and
  screen-reader users, and is never the only way to do something. A mirror card never holds a
  control the board area does not also have.

Today the game does not follow this rule. This document is the plan to get the battle there.

## 2. Today (verified in the code, 2026-11-15)

**Layout** (`index.html`): `#app` is a flex column with `#board` on top (48% of the height, 30% in
the life phase) and `#side` below. At 900px wide, or an aspect ratio of 5:4 or more (laptops and
phone landscape), `#app` becomes a row: the board on the left, `#side` fixed at 340 to 480px on
the right. The Menu button sits at the board's top left, Zoreo at its top right. `#side` holds the
status strip, the coach strip (Arc 1 only), a scrolling column, and a pinned control bar, `#bar`.

**Battle controls and where they live:**

| Control | Where | Notes |
| --- | --- | --- |
| Select a swarm, move, engulf | the board (taps) | Valid tiles highlight on selection |
| Hold / wall off by tapping your own tile | the board | Own tile: hold, then wall off for a loaded swarm, then clear. An unloaded swarm can only hold |
| Charge chips (Antibacterial x1, Antifungal x2) | side panel, Medication card | Pick a charge, then tap a target on the board |
| Swarm rows with status chip, a Clear button, and "-> 5,4" coordinates | side panel, Orders card | Select, clear, and read each swarm's status. Count "Orders: 0 of 3 swarms" |
| End Turn "(3 swarms will hold)" | side panel, pinned `#bar` | |
| Wall off (W) | side panel, pinned `#bar` | Appears only when the selected swarm can wall off; not taught in Arc 1 |
| 1x, 2x, Skip | side panel, pinned `#bar` | Shown while a turn plays back |
| Replay last turn | side panel, pinned `#bar` | |
| Reset | side panel, pinned `#bar` | Debug battle only |
| Keyboard | page | Tab cycles swarms, W wall off, Enter or Space ends the turn or skips, Escape deselects |

So the battle's controls are in the side panel, and the board only takes taps. Wall off already
exists as a contextual button; this proposal moves it, it does not add it.

**What "hold" is.** The resolver treats a swarm with no order as holding, and a hold does nothing.
The explicit hold order has three small jobs today: (1) it is the stepping stone in the own-tile
tap cycle to wall off; (2) it stops the idle ring (a pulsing ring on swarms with no order) from
nudging the player; (3) it cancels a queued move. A queued order can already be cleared by tapping
the same tile again (a move, an engulf), but not a hold. Hence the Orders card's Clear button.

## 3. Proposal: a battle bar docked to the board

A **battle bar**: one strip of buttons docked to the bottom edge of the board area, below the
canvas, never over tiles (patient feedback: no overlays on the board). The buttons change with the
state, so the bar only ever shows what makes sense.

| State | The bar shows |
| --- | --- |
| Planning, nothing selected | Charge buttons (only those with charges left), End Turn with its "(N swarms will hold)" caption, Replay last turn (once there is a turn to replay) |
| A swarm is selected | The same, plus Wall off for a loaded swarm (not in Arc 1). Tapping the swarm's own tile no longer holds; it clears its order, or deselects if it has none |
| A charge is picked | Cancel, and a one-line prompt such as "Tap a germ" |
| A turn is playing | 1x, 2x, Skip |
| Debug battle | Reset, as now |

**What moves out of the side panel:** the pinned `#bar` (End Turn, Wall off, speed and skip,
Replay, Reset) and the charge chips. **What stays:** the status strip, coach strip, turn summary,
the Medication explanation, the info and preview card, the Key, the log, and the Orders card as the
accessibility mirror. Without the bar and the charges the side panel gets noticeably shorter in a
fight.

**The Orders card becomes the mirror.** It keeps: one row per swarm to select it, the status
chip, the count, and a Wall off button for a loaded swarm. It loses the coordinates ("-> 5,4" is a
grid position nobody sees on the board), the Clear button (tapping the swarm does it), and the
"s1, s2, s3" names (they become "Swarm 1" to "Swarm 3"). A card heading such as "Orders (keyboard
and screen reader)" and a quieter style say what it is for, so it does not read as a second set of
controls for pointer users.

## 4. The hold change (does not depend on the bar)

- A tap on the selected swarm's own tile clears its order; if it has none, it deselects. The
  player never queues "hold" from the UI. The sim keeps the `hold` order type (bots and tests use
  it).
- Wall off is reached by the Wall off button (the bar, or the card mirror) or the W key. The own-tile
  tap cycle (hold, then wall off, then clear) is retired.
- The idle ring keeps pulsing on swarms with no order for now. If it nags a player who is holding
  deliberately, calm it after the next playtest.
- The tutorial text changes: "Tap the swarm again to cancel its order." (`src/ui/help.ts`,
  lines 30 and 34).
- Until the bar lands, Wall off stays where it is, in the side panel's `#bar`.

## 5. Layout per screen

| Screen | Plan |
| --- | --- |
| Laptop, wide | The bar sits in the left column under the canvas, full width of the board area. The board gets a little shorter |
| Phone portrait | Board, then the bar, then the side panel. The board's share of the height has to absorb the bar. The bar wraps to two rows if needed; targets stay at least 44px |
| Phone landscape (short) | The compact bar rules (`max-height: 500px`) apply. Open question below |
| Safe-area insets | The bar sits above the home indicator, as `#bar` does today (`env(safe-area-inset-bottom)`) |

Zoreo's corner head stays at the board's top right. The brought-items strip and Zoreo's gaze
logic need a check once the bar exists. In a fight he already looks at the board.

## 6. Accessibility

- Every bar button is a real `<button>` with an accessible name; state changes (a charge picked,
  Wall off appearing) are announced through a polite live region.
- The existing keyboard model stays: Tab cycles swarms (it is captured on the battle screen), W
  wall off, Enter or Space ends the turn or skips, Escape deselects.
- The Orders card mirror keeps every battle action reachable without the board. The reading order
  puts the bar before the side panel.
- This is not a full accessibility pass. That is the deferred B7 work
  (`b7-accessibility-design.md`), which this change should make easier, not harder.

## 7. What we are not doing for the demo

- Moving the life-phase controls: the life phase is the side panel's job, so "Play the week" and
  its siblings stay where they are. The rule is satisfied there already.
- Haptic feedback on selection.
- A swarm label on the board that matches "Swarm 1" to "Swarm 3" in the card.
- The full accessibility pass.

## 8. Plan and cut line

All work on a feature branch, `feat/battle-bar`; `main` stays releasable and production only changes
on a tag. Demo target: 2026-11-21.

1. This document, reviewed by the game designer. (Now.)
2. The hold change (section 4). Small, independent, and shippable without the bar.
3. A spike of the bar at three viewports (laptop, phone portrait, phone landscape), checked with
   screenshots, before anything is polished.
4. Move the charges and wire the contextual states, then update the tests.
5. Check on a real phone, in portrait and landscape.

**Cut line: 2026-11-18.** If the spike does not work at all three viewports by then, the demo ships
the hold change on `main` and the existing panel, and the bar waits until after the demo.

## 9. Questions for the game designer

1. **Charges:** always show both charge buttons (greyed when spent), or only those with charges
   left? Showing both teaches that charges are finite; hiding them is quieter.
2. **Playback controls:** 1x, 2x and Skip replace End Turn while a turn plays (as above), or sit
   beside it?
3. **Replay last turn:** it is a reflect action. Does it belong in the bar, or in the side panel's
   log, where the story of the turn already is?
4. **Phone landscape:** the board is already short there. Is a bar under the board acceptable, or
   should the bar sit at the board's side in that orientation?
5. **Idle ring:** keep the pulse on swarms with no order now that "no order" and "hold" are the
   same thing, or only pulse until the player has ordered anything?
6. **Wall off in Arc 1:** unchanged (not taught, so no button). Confirm.
7. **Mirror card wording:** does a visible label such as "Orders (keyboard and screen reader)"
   help, or should the card be collapsed by default?

## 10. Where the rule goes once agreed

A line in the UI rules of `AGENTS.md`: a phase's primary controls live in that phase's area; the
side panel may mirror them for keyboard and screen-reader users, and never holds the only copy.
