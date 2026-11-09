# Zebra Wars: beta plan (target 2026-11-21)

Builds on `prototype-plan.md` (Milestones 1-2 are done; merged to `main` on 2026-11-02).
Clinical corrections in `../specs/fodder.md` still win. Open clinical questions live in `../specs/clinician-questions.md`.
Items marked **(my call)** are defaults I picked; change them freely.

**How the docs split.** `docs/specs/` says what a feature is and why (designs, rules, clinical notes); a
spec does not carry the schedule. This plan says what is done, in which order, and in which commit. The
status table below is the only place that tracks slices.

## Status (updated 2026-11-04)

| Task | State | Commits | Spec |
| --- | --- | --- | --- |
| B0 housekeeping | done | | |
| B1a identity, meters, score | done | seven slices on `feat/beta` | `b1a-design.md` |
| B1b declutter, colour, board | done | eff5720, c5ffb98 (meds toggle, later replaced), c0f43f8, 0e05f00, 096ce1f | |
| B1c battle depth | done (slices 1-5) | 60295b4 doors and clock, 5cb1d0c arrivals, 924d7a5 missed doses, 5a760e5 UI marks, debfcf2 medicine roll | `battle-depth-design.md` |
| Week-stop banner | done | 655f987, 2405a2f (friction stop removed) | |
| B1d week phase | slices 1-4 done, 5 optional | c168283 no toggle and card-keyed dice, 4e42066 game night, 0171d52 score v4, cc8efaf bots and balance | `week-phase-design.md` |
| B1 mobile layout and touch | done | 6a07dae (real-device pass on Brave/Android; landscape and tablet not tuned) | |
| B2 organism names | done | f242926 (`src/sim/organisms.ts`, enforced by a test) | |
| B3 arc framework and title/hub | done | a61f042 (arcs data, title, picker, arc-complete; Arc 1 is a placeholder battle until B4) | |
| BN navigation (N1 menu, N2 continue, N3 back/reload guards, N4 start-over, N5 facilitator, N6 one ending) | N1 to N6 done | 1d39dc6 (N1), c4971ec (N2), 3de071f (N3), 6183211 (N4), f215cdc (N5), 593c1ea (N6) | `navigation-design.md` (all ten defaults accepted 2026-11-07) |
| B4 Arc 1 tutorial (T1 scenarios, T2 runner and cards, T3 battle chrome, T4 coach model, T5 coach strip, T6 copy) | T1 to T6 done (Tracy played Arc 1 on phone 2026-11-09, looks good) | c5e283e (T1), 56c9a92 (T2) | `arc1-tutorial-design.md` (decisions in its section 8) |
| BO outcomes and danger meter (O1 Part A result and Part B compare, O2 Exposure cell, O3 before/after, O4 luck line and week block, O5 summary) | O1 to O4 done; O5 not started | | `outcomes-and-risk-design.md` (all eleven defaults accepted 2026-11-08) |
| B5 to B10 | not started | | |

Open after B1d: the week goal is now 13 points (Tracy preferred it to 12 after playing both: a little
more battle, but neither felt noticeably harder or more fun; `?goal=N` still overrides). The smarter bot
meets it in 95% of weeks and risky in 75%, and the best plan takes one risky late-night game night, so
reaching the goal costs some safety. The week is still not hard; a seeded weekly event (week-phase
design Option B, about 18h) is the candidate if the patient session says so. Careless full battles need
backup 51% of the time (a battle knob); it also waits for the patient session. B1d slice 5 (a week-2 farm hand) is the first cut of B1d, then more cards.
Backlog: a larger card pool drawn per week, so the weeks differ.

## 1. Goal

A playable beta that a CGD patient can pick up and understand without help, and that can be demoed at NIH
a few days after 2026-11-21: on a laptop, offline, in person. Mobile must also work (phone and tablet).
The prototype loop already answers the design questions (legible turn, real leaky/sealed choice,
life-to-battle link, always a fight). The beta is about onboarding, content, platform and polish.

## 2. Scope

### In

- **Title screen and hub (my call):** a Zebra Wars title, a disease picker with CGD (X-linked, autosomal
  recessive) and a greyed "Wilson's disease: separate game, coming later" entry. The XL/AR choice sets
  per-character parameters (residual kill chance, exposure/flare weights); no new mechanics.
- **Arc framework:** arcs as data (ordered list; intro text, goal, fixed or seeded loadout/scenario
  overrides, coach marks, completion text). An arc-complete screen and an arc picker.
- **Arc 1, "First infection": tutorial.** A short scripted two-part battle on the lung map. Part A is
  "before diagnosis": no medication, no charges, short and built to be lost gracefully, framed as a
  memory. Part B is "after diagnosis": the same kind of threat with medication, so the contrast is felt.
  Coach marks teach select/move/engulf/telegraph/charges one at a time (no walls of text).
- **Arc 2, "A first summer":** the existing two-cycle campaign (yard work, the lake, band, sleepover,
  doctor) framed with an intro and an ending, on the lung map, with organism names.
- **Epilogue (not gameplay, my call: include a short draft):** a hopeful information screen about curative
  options, marked in the build as "draft: pending clinical review". Contains the claims in
  `../specs/clinician-questions.md` items 14-17. Easy to hide with a flag if the clinician says no.
- **Organism names everywhere:** info cards, odds panel, calendar exposure text, outcome lists, key,
  how-to-play (generic labels stay as the primary line where helpful).
- **Mobile and touch:** portrait and landscape phone layouts, tablet, tap targets >= 44px, no hover
  dependence for essential info, safe-area insets, no pinch/scroll traps on the canvas.
- **Accessibility pass:** full keyboard play, reduced-motion, grayscale/colorblind check, text scale.
- **Offline demo build:** `npm run build` output served locally with no network; one command to launch;
  verified on the demo laptop; fallback to a second browser profile.
- **Patient session with the adult tester**, with the session log and the optional prediction probe, and
  one round of changes from it.
- **Updated clinician question list**, prioritized for NIH (items tagged A first).

### Out

Wilson's gameplay, other arcs (summer is the only main arc), the rare-site surprise battle, age scaling,
a Settings screen (backlog: toggle labels), audio and music, accounts, backend, analytics, save/load
beyond the current run (my call), localization, steroids and the gut map.

## 3. Tasks (each one sitting; order matters)

**B0. Housekeeping (small, do first).** Run Prettier once across the tree in a single commit so later
subagents stop reformatting; add `npm run format:check` to the verification list; document `mise exec`.
*Done when:* clean diff, all checks pass.

**B1a. Visual identity, status meters and score (before B1: the HUD decides what B1 must fit on a phone).**
Five parts, in this order:
1. *Design pass (Opus, timeboxed to one sitting, no code).* Settle three things and write them into
   this section: (a) the score formula below; (b) pacing and stakes: make each life choice's cost and
   payoff visible at once, shorten the calendar if it helps, tilt the week toward the battle (tuning,
   not new mechanics); (c) the palette. Anything bigger than tuning goes to the post-patient backlog.
2. *Palette and region colors.* Hue plus a distinct shape or icon per pathogen family, the medication
   aura and body region, so color never carries meaning alone (B7 grayscale check must still pass).
3. *Status meters.* Surface what the sim already tracks as bars: **Medication** (share of doses taken),
   **Energy**, **Tissue** (health out of 20), **Inflammation** (battle only) and the week's **Life
   points** goal meter. No new "Happiness" stat: life points already play that role (living fully
   earns points, and the risky versions pay more, which is the core tension).
4. *Overall score.* Does not exist yet (only per-week points, battle grades and tissue lost in
   `campaignSummary`). Draft for the design pass to confirm. Two parts, shown separately so the player
   can see which one their choices control:
   - **Choices** (luck-free): life points earned, plus "risk dodged", the exposure chance avoided
     compared with the risky version of the same plan, plus medication adherence. This is the part the
     player can push every run, and it teaches how to push the odds.
   - **Outcome** (luck included): tissue kept, battle grades, reservoirs left. Shown honestly, framed as
     "how it went", not a verdict.

   The overall score is the sum, shown with a per-week breakdown. Best score per variant (CGD XL, AR) and
   seed kept in `localStorage` (the one exception to "no save/load", try/catch around it; the game plays
   fine without it). Seeded replay (`?seed=`) lets a player retry the same dice. Add a "play again" path
   from the arc-complete screen. Tone: infections happen whatever you do, the score measures how well you
   pushed the odds.
5. *Organic board.* Keep the square logic grid (hexes change adjacency, telegraphs, heat forecast and
   balance, and the ~329 tests; post-beta question only). Render it organically: rounded and
   irregular cell shapes, soft edges, slight wobble, a tissue texture or background image behind it.
   Telegraph and heat painting keep working on the same logical tiles.

The design pass is in `../specs/b1a-design.md` (all seven questions answered yes, 2026-11-02); build it in
its seven slices.

*Done when:* every screen has color beyond gray with shape/label backup; the meters and score are
visible on the life screen and the battle screen; the score appears on the arc-complete screen with the
best-score line; the board no longer reads as a grey right-angled grid; typecheck, lint, tests and
build green; screenshots of life, battle and outcome attached to the commit.

**B1b. Declutter, color and a brighter board (added 2026-11-02 from Tracy's playtest of B1a; before B1).**
Four slices: (1) *Board:* cells bright pink and shiny, shading toward red and less shiny with inflammation;
the underlying board neither green nor square, organic and flesh-toned, no sharp corners. (2) *Meds:* a
per-day take/skip toggle on the day chips, undoable until that day is played; replaces "Take meds" and
"Skip today". (3) *Declutter:* meters show a value or a bar, not both plus a sentence; drop text that repeats
what is visible; explanations behind (?) icons (keep the selected-thing info card); odds as "Full battle
odds: 45%"; card scores as "+5 points, +2 energy, +50 score". (4) *Cards:* each activity card gets its own
color and icon. A battle-depth design pass (Opus, design only) follows before B1, since battles end in one
or two turns with little strategy.
*Done when:* the life and battle screens read at a glance without the explanatory text, no player
action in the meds row is irreversible before the day is played, and the board has no green and no square
frame; checks green and screenshots attached.

**B1c. Battle depth (added 2026-11-03).** Design in `../specs/battle-depth-design.md` (nine questions, all yes).
Five slices: the clock, doors and backup stop; arrivals and swallowed germs keeping the fight open; missed
doses making arrivals bigger; the incoming mark and turn clock in the UI; medicine helping cells finish
swallowed germs. *Done when:* full battles last 4-6 turns, doses change the fight. Status above.

**B1d. Week phase (added 2026-11-04).** Design in `../specs/week-phase-design.md` (fourteen questions, all
yes). Slices: no dose toggle (doses by routine, forecast chips, card-keyed dice); Game night card and the
late-night pill slip; score version 4 (goal +40, routine kept, odds pushed halved); bots and balance;
optional week-2 farm hand. Reason: the week was trivial, and a player deliberately skipping medicine read
as wrong. Status above.

**B1. Mobile layout and touch.** Real device pass (serve with `--host`, open on the user's phone).
*Done when:* life screen, battle screen and outcome overlays are usable one-handed in portrait on a
phone; End Turn and playback controls reachable; board stays large; nothing essential needs hover.

**B2. Organism names audit.** One central label function; every player-facing string goes through it.
*Done when:* a grep finds no hard-coded pathogen words outside it; screenshots of each screen show names.

**B3. Arc framework and title/hub.** `src/app/arcs.ts` data and a small arc runner on top of `Run`;
title screen; disease/variant picker; arc picker and completion screen.
*Done when:* the app boots to the title, can start either arc, and returns to the picker.

**B4. Arc 1 tutorial.** Scripted scenario (fixed seed), the undiagnosed vs diagnosed contrast, coach marks.
*Done when:* a new player completes it without reading the Key, and the contrast with medication is
visible (aura, charges).

**B5. Arc 2 framing and ending.** Intro, goals text, end summary, link to the epilogue.
*Done when:* arc 2 plays start to finish and ends on a hopeful note.

**B6. Epilogue (draft).** Short information screen with the flag and "draft" marker.
*Done when:* it reads warmly and states only the claims listed in the clinician file.

**B7. Accessibility pass.** Keyboard, reduced motion, grayscale, text scale, aria checks.
*Done when:* a full battle and a full week are playable by keyboard alone; grayscale still reads.

**B8. Demo build and rehearsal.** Static build, local server script, offline test, airplane-mode run on
the demo laptop, a printed one-page "how to demo" for the user.
*Done when:* the user runs it cold from a closed laptop in under a minute.

**B9. Patient session.** Facilitator script (what to say, probe on/off, how to export the log),
then fix the top three issues.
*Done when:* the log is exported and reviewed and the top issues are fixed or logged.

**B10. Buffer, polish and clinician prep.** Heat/ghost tuning, remaining polish items, final clinician list.

## 4. Schedule (estimate, not a commitment)

- Nov 1 - 8: B0, B1a, B1, B2, B3 (B1a added 2026-11-02; this is the tightest week).
- Nov 9 - 14: B4, B5, B6, B7.
- Nov 15 - 17: B8, then B9 with the patient (around Nov 15-17).
- Nov 18 - 20: B9 fixes, B10, final rehearsal.
- Nov 21: beta cut. NIH trip a few days later.

## 5. Build workflow

Same as before: I coordinate and verify each task in a browser; Opus for game rules and balance, Sonnet for
implementation; one feature branch (`feat/beta`, from `main` after the prototype merge),
no worktrees, conventional commits, one commit per task, never run a formatter over files you do not own.

## 6. Risks

- **Rate limits:** a long Opus run hit the 5-hour limit once. Keep Opus tasks small and resumable.
- **Real phone testing needs the user's device.** Plan one 15-minute session.
- **Tutorial scripting** can sprawl. Keep it to about nine one-line coach marks across two short fights (one on screen at a time, none blocking) and one fixed seed.
- **Clinical claims in the epilogue** are unverified. The draft marker and flag contain the risk.
- **One patient tester** is a weak signal; treat their feedback as anecdote plus the session log.
- **Demo-day failure modes:** browser blocking WebGL, laptop sleep, port conflicts. B8 covers them.

## 7. Cut first (in order)

1. Epilogue (B6), to pay for B1a. 2. Title-screen polish and the greyed Wilson's entry. 3. Accessibility beyond keyboard and
reduced motion. 4. Arc 2 intro/ending text beyond a single screen. 5. Undiagnosed vignette in Arc 1 (keep
only the diagnosed part with the aura contrast).

**Never cut:** mobile layout, organism names, the offline demo build, the patient session.

## 8. Decisions (answered by the user 2026-10-30)

1. Hub scope: title plus disease picker with CGD XL/AR and a greyed Wilson's entry. Agreed.
2. Draft epilogue in the beta, flagged "pending clinical review". Agreed.
3. Demo device: a laptop for sure; a phone is also possible; no tablet. Phone support therefore
   matters for the demo (B1 real-device pass); tablet layout is a nice-to-have only.
4. Save/load: none (each run starts fresh). Agreed.
5. (2026-11-02) Visual and status feedback: add B1a. No invented "Happiness" stat; life points already
   cover it. An overall score is wanted for replay value and learning: players know infections happen
   regardless, so a score will not read as a judgment. Score is split into luck-free "Choices" and
   luck-included "Outcome". Organic board by rendering only; hex grid deferred past the beta.
6. (2026-11-02) `localStorage` may hold game stats (best scores per variant and seed). They must be
   surfaced in the UI (title/hub and arc-complete screen), or they mean nothing. Still no save/load of
   a run in progress.

7. (2026-11-03) Battle depth: build Option A plus the medicine half of B before B1; pay for it by cutting
   the epilogue (B6) if needed. Terrain lanes (Option C) are post-beta.
8. (2026-11-04) Week phase: build Option A before B1. Missed doses come from routine breaking (an unpacked
   sleepover, a late night), never from a player choice; the dose toggle is gone. More card variety is
   wanted and is backlog.

## 9. Resuming after a break

Conversation context does not carry over by itself. Read `../specs/fodder.md`, this plan (the Status
table first) and `git log --oneline` on `feat/beta`, then continue from the first not-started task.
Everything in the Status table marked done is committed. Plans and specs are tracked in `docs/plans/` and `docs/specs/`; early brainstorming stays in the gitignored `docs/internal/`.
