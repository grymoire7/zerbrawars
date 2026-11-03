# Zebra Wars: beta plan (target 2026-11-21)

Builds on `prototype-plan.md` (Milestones 1-2 are done; merged to `main` on 2026-11-02).
Clinical corrections in `../specs/fodder.md` still win. Open clinical questions live in `../specs/clinician-questions.md`.
Items marked **(my call)** are defaults I picked; change them freely.

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
- **Tutorial scripting** can sprawl. Keep it to five coach marks and one fixed seed.
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

## 9. Resuming after a break

Conversation context does not carry over by itself. Read `../specs/fodder.md`, this plan and
`git log --oneline` on `feat/beta`, then continue from the latest B task. Everything through the
skirmish UI (commit `940af26`) is committed. Plans and specs are tracked in `docs/plans/` and `docs/specs/`; early brainstorming stays in the gitignored `docs/internal/`.
