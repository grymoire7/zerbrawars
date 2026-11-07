# Zebra Wars: navigation and the in-game menu (design)

What the player and the facilitator can do outside the game itself (leave, start over, get help, end
a session), where each control lives, and what each one keeps or loses. Design only; slices are
tracked in `../plans/beta-plan.md`. Items marked **(my call)** are defaults; Tracy decides (section 8).

## 1. What exists today, and the gaps

- **Menus** (title, arc picker, arc-complete) are full-window cards from `src/ui/menu.ts`. The picker
  has Back; arc-complete has Replay, Back to arcs, Back to title.
- **In play** (life, battle, interludes) there is no menu. "How to play" opens from a "?" in the
  first box of the scroll panel, and that box scrolls out of view on a phone. The stopgap "Leave this
  game" sits at the bottom of that long dialog, behind a confirm. Leaving drops the run.
- **Arc 2 ends on the campaign summary** (`interludeScreen.ts`), not on the arc-complete screen.
  The summary's buttons are Replay, New game, Back to arcs; there is no Back to title, and Replay
  goes through the debug `mode=campaign` path. Two endings, two button sets.
- **The battle bar has "Reset"**, one tap with no confirm, which restarts the fight (allowed in a
  campaign while the battle is on). It sits beside Skip and Replay, under a thumb.
- **The "Debug ▾" panel is on every in-play screen**, in plain view of the patient. It holds the
  facilitator's controls: prediction probe, the "brought in" strip, session-log export and copy.
- **Browser Back and reload leave the game.** Every screen uses `history.replaceState`, so Back (or
  the Android back gesture) goes to whatever page was before Zebra Wars, and a reload lands on the
  title. Either one throws away the run and the session log without a word.
- **Keyboard:** on the battle screen Tab is captured to cycle swarms, so a keyboard player cannot Tab
  to any button there. Escape deselects (battle) or cancels a pick (life).

## 2. What the player needs, and what waits

A teen with no instructions looks for two things: a "?" when confused, and a menu icon in a corner
when they want to stop or start over. An anxious or frustrated player needs "I want out" to be one
obvious control, and needs leaving to be safe: nothing scary, nothing lost by accident.

**Needed for the beta**

| Action | Who | Why |
| --- | --- | --- |
| Keep playing (close the menu) | player | The safe default of every menu and confirm. |
| How to play | player | Already exists; stays on "?" and is also in the menu. |
| Back to the title | player | "I want out". Also how to switch character or arc. |
| Continue (from the title) | player | Makes leaving safe: the run waits while the page stays open. |
| Start this fight over | player | Already exists as Reset; moves into the menu with a confirm. |
| Start this summer over | player | Same as the summary's Replay, reachable mid-run. |
| Session switches, log export | facilitator | Already exist in Debug; must leave the patient's view. |
| Reset for a new player | facilitator | NIH demo: several visitors on one laptop; clears help-seen flags and best scores. |

**Not for the beta**

- **Start this week over.** Days that were played rolled real dice; undoing them would teach that the
  odds can be wished away, which works against "the odds are real". Planning before Play is already
  undoable (take an activity off the calendar). It also needs a week-start snapshot. (my call)
- **Settings, sound, text options.** There is no audio. Text scale and reduced motion belong to B7
  and follow the browser (`prefers-reduced-motion`, browser zoom); the plan keeps Settings out.
- **Save across reload or a closed tab.** See section 5.
- **Quit or exit.** A browser tab has no "quit"; the title is the exit.

## 3. Where each control lives

### 3.1 The Menu button (recommended: a corner of the board)

One persistent **Menu** button, 44 x 44, in the **top-left corner of the board**, inside the
safe-area inset, on the life, battle, quiet-week and summary screens. On a phone it shows "☰"
(accessible name "Menu"); at 900px and wider it shows "☰ Menu". A raised, slightly translucent chip
so it reads over the tissue.

Why there: it costs no layout space (the board corner is background, the strip and bar are full),
it is where games put a pause button, it is far from the thumb that taps End Turn (hard to hit by
accident), and it does not scroll away. It sits above screen overlays (outcome card, interlude
card, "brought in" strip) and below modal dialogs (How to play, the menu itself, the probe).

The "?" stays where it is; first-time players reach for "?" when lost, and help is one tap there.

Phone, portrait, battle:

```
+------------------------------------+
| [☰]                                |
|                                    |
|            board (48%)             |
|                                    |
+------------------------------------+
| Tissue | Medication | Inflam | ... |  status strip (pinned)
+------------------------------------+
| Turn 3 . next arrival turn 4  [?]  |  scroll panel
| Medication  [charges]              |
| Orders ...                         |
+------------------------------------+
| [            End Turn            ] |  bar
| [Wall off] [1x] [2x] [Skip] [Replay]|  Reset is gone from here
+------------------------------------+
```

Phone, portrait, life:

```
+------------------------------------+
| [☰]      body view (30%)           |
+------------------------------------+
| Life points | Energy | Medication  |  status strip
+------------------------------------+
| Week 1 of 2                   [?]  |
| calendar (sticky) ...              |
| activity cards ...                 |
+------------------------------------+
| [          Play the week         ] |
+------------------------------------+
```

Laptop (both screens): the board fills the left, the side panel the right; the Menu chip is in the
board's top-left, "☰ Menu".

### 3.2 The menu

A centered card, the same look as How to play (on a phone it scrolls if short).

```
+--------------------------------+
| Menu                           |
| A first summer . week 1 of 2   |   where you are
| CGD, X-linked                  |
|                                |
| [ Keep playing               ] |   primary, focused on open
| [ How to play                ] |
| [ Start this fight over      ] |   battle only
| [ Start this summer over     ] |   Arc 2 only
| [ Back to the title          ] |
|   Your summer waits there.     |
|                                |
| For the facilitator            |   only with ?facilitator=1
| [x] Prediction probe ...       |
| [x] Show what you brought in   |
| [Export log] [Copy log]        |
| [Reset for a new player]       |
+--------------------------------+
```

Per screen:

| Screen | Menu items (besides Keep playing, How to play, Back to the title) |
| --- | --- |
| Life (Arc 2) | Start this summer over |
| Battle (Arc 2) | Start this fight over, Start this summer over |
| Battle (Arc 1) | Start this fight over |
| Quiet week, summary | none extra (the summary has its own buttons) |
| Battle outcome overlay | menu reachable; Start this fight over is hidden once the fight is over |
| Title, picker, arc-complete | no Menu button: these screens are the menu |

Title, when a summer is held (section 4): a **Continue** item first, "Continue your summer: week 2,
CGD X-linked", then the characters. The picker keeps Back.

Endings: the Arc 2 summary gets the arc-complete button set, so both arcs end the same way: **Play
again** (same summer, primary), **A new summer** (Arc 2 only), **Choose an arc**, **Back to the
title**. Replay should start through `arcPlay`, not the debug `campaign` path.

### 3.3 Keyboard and screen reader

- **Escape opens the menu** when there is nothing to cancel. Battle: Escape first clears a selected
  swarm or charge; with nothing selected it opens the menu. Life: Escape first cancels a pending
  pick; otherwise it opens the menu. In the menu, Escape is Keep playing. Escape is the keyboard
  path on the battle screen because Tab is taken (B7 should still decide whether Tab can reach the
  buttons there; that is a conflict to note for B7, not to solve here).
- The Menu button is the first focusable element in the page (it lives in `#board`, which comes
  before the side panel), with `aria-haspopup="dialog"`.
- The menu is `role="dialog"`, `aria-modal`, named "Menu", described by the where-you-are line.
  Focus lands on Keep playing, Tab cycles inside the card, and closing returns focus to whatever
  had it (the stopgap Help only traps on one button; the menu needs a real cycle).
- Browser Back (and the Android back gesture) **opens the menu** during play instead of leaving the
  site; on the picker it goes to the title. Cost: push one history entry on entering play, answer
  `popstate`. While a run is held, `beforeunload` asks the browser's own "Leave site?" on reload or
  close (laptop only in practice; phones mostly ignore it).

## 4. Confirms, and what is kept or lost

Confirms swap in place inside the menu card (like the stopgap), never a second dialog. The safe
button comes first, is bold, and takes focus; the question is read with it.

| Action | Confirm | Kept | Lost |
| --- | --- | --- | --- |
| Keep playing, How to play | none | everything | nothing |
| Back to the title | **none** (with Continue) | the whole run, in memory, while the page is open | a fight in progress restarts from its first turn on Continue |
| Start this fight over | "Start this fight from turn 1? The moves you made in it will be undone." [Keep playing] [Start over] | the week, the score so far | this fight's turns |
| Start this summer over | "Start your summer again from day 1? It will be the same summer, with a fresh start." [Keep playing] [Start over] | best scores | this run and its log (facilitator: export first) |
| Start a new arc while a summer is held (picker) | "You have a summer going (week 2). Start a new one?" [Keep my summer] [Start a new one] | best scores | the held run |
| Reset for a new player (facilitator) | "Clear best scores and first-time help for a new player?" [Cancel] [Clear] | nothing | best scores, help-seen flags, the held run |
| Reload or close the tab | the browser's own prompt | best scores | the run |

With the facilitator flag on, every confirm that loses a run adds one line and a button: "The
session log for this run has not been saved." [Export log].

**Why no confirm on Back to the title.** The title then offers Continue, so leaving loses nothing;
a confirm would make "I want out" harder for no gain. If Continue is cut, the confirm stays as the
stopgap has it, with warmer wording: "Head back to the title? This summer will end here."

**What Continue resumes.** The life state (plan, played days, doses) lives in the run's campaign, so
the week resumes where it was. A fight resumes at its first turn (the campaign holds the battle as
it started). The implementer should confirm both, plus that banners and the week's notes re-mount
cleanly. Arc 1 is one short fight and is not held; going back to it starts it fresh.

## 5. Save and load: challenge, and cost

The plan says no save/load. For navigation the real need is narrower: leaving to the title must not
lose the run. **Holding the run in memory for the page session** (Continue) gives that for about
3 hours and no storage format. I recommend it.

A **real save** (the campaign written to `localStorage`, resumed after a reload or the next day)
would also cover an accidental reload and a patient who stops mid-summer. Cost: about 6 to 10
hours (serialize the campaign and log, a version key, a recovery path for a bad save, tests), and a
new kind of bug a week before the demo. Arc 2 is about 20 to 30 minutes, the patient session is
facilitated, and the back-gesture guard plus `beforeunload` cover most accidents. Not for the beta
(my call); revisit if the patient session shows people stopping mid-run.

## 6. Options considered for the Menu button

- **A. Board corner chip (recommended).** No layout cost, always visible, conventional, away from
  the thumb. Covers a small corner of the board; a door mark or a germ at the very corner could sit
  under it, so check the framing at 360 px wide. About 4 hours with the menu card.
- **B. Turn "?" into the menu.** Cheapest (about 2 hours): "?" opens the menu, How to play is
  inside. But "?" does not say "leave", it is the help a confused player reaches for (now one tap
  deeper), and on a phone it scrolls out of view. Not recommended.
- **C. A Menu cell at the end of the status strip.** Always visible, but it takes about 48 px from
  every strip on a phone (the strip already drops to two columns under 340 px) and mixes a meta
  control into the body readout. Not recommended.

## 7. Slices

| Slice | Effort | What a reviewer sees |
| --- | --- | --- |
| N1 Menu button and menu | 4h | ☰ in the board corner on life and battle (phone and laptop); menu with Keep playing, How to play, Back to the title (confirm kept for now); Escape and focus behave as in 3.3; the stopgap leaves the Help dialog. |
| N2 Continue | 3h | Leave mid-week, the title shows Continue, the week is exactly as left; leave mid-fight, the fight restarts at turn 1; picker asks before replacing a held summer; Back to the title loses its confirm. |
| N3 Back and reload guards | 2h | Android back gesture or browser Back during play opens the menu; reload on a laptop asks first. |
| N4 Start over items | 2h | Reset is gone from the battle bar; Start this fight over and Start this summer over in the menu, each with its confirm. |
| N5 Facilitator mode | 4h | Without `?facilitator=1` there is no Debug panel anywhere; with it, the menu has the facilitator section, the title offers Export log for the held run, and Reset for a new player works. |
| N6 One ending | 1h | The Arc 2 summary has Play again, A new summer, Choose an arc, Back to the title, like arc-complete. |

About 16 hours in all. If time is short, the minimum is **N1, N2, N5** (about 11 hours): one obvious
way out, nothing lost by leaving, and no Debug panel in front of the patient. N3 matters most if the
NIH demo is on a phone. Debug URLs (`?seed=`, `?mode=`) keep the Debug panel for development.

## 8. Open questions for Tracy

1. **Where the Menu button goes.** Default: the board's top-left corner (option A).
2. **Continue within the page session.** Default: yes, for Arc 2; Back to the title then needs no
   confirm.
3. **Start this week over.** Default: no, for the reason in section 2.
4. **Move Reset out of the battle bar into the menu, with a confirm.** Default: yes, in arc play;
   it stays in the debug standalone battle.
5. **Hide the Debug panel unless `?facilitator=1`.** Default: yes, before the patient session (B9's
   facilitator script then points at the menu section). Debug URLs keep it.
6. **A real save across reloads.** Default: no for the beta (6 to 10 hours); revisit after B9.
7. **Back gesture opens the menu.** Default: yes.
8. **Reset for a new player** in the facilitator section, for the NIH demo. Default: yes.
9. **The Arc 2 summary becomes its arc-complete screen** (one ending, one button set). Default: yes.
10. **Does opening the menu pause turn playback?** Default: no. The game is turn-based, nothing is
    timed, and Replay last turn covers a missed animation.
