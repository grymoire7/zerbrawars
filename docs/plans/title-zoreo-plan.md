# Title screen and Zoreo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain title menu with the bright "pop-up" title scene (scene B) and add Zoreo's corner head, whose gaze shows the game phase.

**Architecture:** Zoreo and the scene are inline SVG (no WebGL). One pure model in `src/app/zoreoModel.ts` decides the screen kind and the gaze and uniquifies SVG ids; `src/ui/zoreoCorner.ts` is a persistent DOM element inside `#board` that `main.ts` `mount()` drives; CSS in `index.html` decides placement per layout (flip in wide layouts, slide in portrait). The title scene is a fixed layer behind the menu card, opted into through a new optional field on `MenuModel`.

**Tech Stack:** TypeScript, Vite (`?raw` SVG imports), plain DOM and CSS, Vitest (pure modules only), Prettier, mise.

**Spec:** `docs/specs/title-zoreo-design.md` (read sections 2, 3, 5, 6, 7 first). Reference mocks and Opus sketches: copied into `docs/specs/title-zoreo-ref/` by Task 1.

## Global Constraints

- No WebGL for the title or the corner head; the WebGL probe in `src/app/boot.ts` and its "no WebGL" card are unchanged.
- Decorative SVGs carry `aria-hidden="true"` and `focusable="false"` and are outside the dialog's tab order; the card keeps first focus.
- The menu card is a solid, opaque dark surface (`#1C1F2A`); the scene carries no text. Text on the card meets 4.5:1.
- Reduced motion means `calm()` from `src/render/motion.ts` (also covers `?still=1`); no looping or entrance motion when `calm()` is true.
- Every inline copy of Zoreo gets a unique id prefix (the art uses the placeholder `zo-`); no duplicate ids in the DOM.
- Gaze rule: life = `panel`, battle (including playback and the Arc 1 tutorial battles) = `board`, interlude/summary/epilogue and all menu screens = hidden.
- Phone portrait (panel below the board): no flip. Battle head at the board's upper right; life head at the board's **lower right**, same pose, looking down and left. Wide layouts (`min-width: 900px` or `min-aspect-ratio: 5/4`, the rule already in `index.html`): head stays upper right, flipped with `scaleX(-1)` for `panel`.
- Corner head viewBox `16 -26 240 270`; it sits inside `#board` with `pointer-events: none` and must not cover the Menu button or the brought-items strip.
- Scene shown on the title and the arc picker only (`mode: "title"` and `mode: "arcs"`); arc intro, arc-complete and the replace-confirm card stay plain.
- Conventional commits; run Prettier only on files you edited; `mise run check` must pass before the last task.

## Review Focus

Most likely to bite first:

1. **Duplicate ids.** The corner head persists in `#board` while the title scene has its own Zoreo; both inline the same SVG. Expect broken gradients if prefixes collide. Pinned by Task 3 tests and a DOM check in Task 4.
2. **Standalone debug entries** (`?mode=life`, `?mode=battle`, no run) must still get a gaze, not crash or stay stale. Pinned by Task 3.
3. **Rapid screen changes** (go/back/continue in quick succession) must not leave a blink timer running on a removed element or two corner heads. Pinned by Task 4 (`dispose` and idempotent `set`).
4. **Reduced motion** (`prefers-reduced-motion` and `?still=1`): no slide transition, no blink loop, the static final frame of the opening beat. Pinned by Tasks 4 and 7.
5. **Five-item title on a short phone landscape** (Continue, facilitator export, two variants, Wilson, about 320 px tall): the card scrolls, the scene stays fixed, every button is reachable and nothing is covered. Pinned by Task 6.

---

### Task 1: Preserve the reference material and lift the scene pieces into the repo

The sketch pass lives in a session scratch folder that will not last. Copy what the build needs.

**Files:**

- Create: `docs/specs/title-zoreo-ref/B.html`, `docs/specs/title-zoreo-ref/shots/B-laptop.png`, `B-portrait.png`, `B-landscape.png`, `corner-board.png`, `corner-panel.png`, `corner-portrait-battle.png`, `corner-portrait-life.png`
- Create: `src/ui/titleScene/pieces/` holding `germ-strep.svg`, `germ-staph.svg`, `germ-asp.svg`, `gun-strap.svg`, `volley.svg`, `buddies.svg`, `wordmark.svg`, `B-board-island.svg`, `B-bokeh.svg`, `B-zoreo-popup-hole.svg`
- Source folder: `/private/tmp/claude-501/-Users-tracy-projects-zebrawars/d2141e8e-2529-457e-a6af-c6a03dc9f99d/scratchpad/scene/` (`pieces/`, `shots/`, `B.html`)

**Interfaces:**

- Produces: raw SVG files imported later as `import x from "./pieces/name.svg?raw"`. Piece ids use the prefix `zs-` (scene) and `zo-` (Zoreo), both uniquified at use.

- [ ] **Step 1:** Copy the files above. If the scratch folder is gone, stop and ask the author; the scene cannot be rebuilt from the spec alone.
- [ ] **Step 2:** Check each copied SVG has `aria-hidden="true"` and `focusable="false"` on its root (add if missing) and no `<script>` or external `href`.
- [ ] **Step 3:** Run `mise exec -- npx prettier --check` on any new `.html`; format only what fails. Do not format `.svg` or `.png`.
- [ ] **Step 4: Commit** `docs: keep the title scene mocks and lift the scene SVG pieces`.

### Task 2: Palette tokens and contrast tests

**Files:**

- Modify: `src/theme/palette.ts` (add tokens), `src/theme/palette.test.ts`

**Interfaces:**

- Produces: tokens `card` `#1C1F2A`, `card-rim` `#5E9A8C`, `primary` `#9FD8F0`, `primary-lip` `#3F8DB3`, `primary-ink` `#15171C` (values from the approved mock `B.html`; copy any further button colours the mock uses as tokens too, named in the same style), reachable as `--zw-card` etc.

- [ ] **Step 1: Write failing tests** in `palette.test.ts`: `text on card meets 4.5:1`, `text-muted on card meets 4.5:1`, `primary-ink on primary meets 4.5:1`. Use the existing `contrast` helper (widen its parameter type if needed; it takes `PaletteName`).
- [ ] **Step 2:** Run `mise exec -- npx vitest run src/theme/palette.test.ts`. Expected: FAIL (tokens missing).
- [ ] **Step 3:** Add the tokens to `PALETTE`.
- [ ] **Step 4:** Same command. Expected: PASS. If a pair misses 4.5:1, adjust the new token (not the text token) and note the final value.
- [ ] **Step 5: Commit** `feat(theme): add title card and primary button tokens`.

### Task 3: The pure Zoreo model

**Files:**

- Create: `src/app/zoreoModel.ts`, `src/app/zoreoModel.test.ts`

**Interfaces:**

- Produces:
  - `export type ScreenKind = "life" | "battle" | "interlude" | "menu"`
  - `export type Gaze = "panel" | "board"`
  - `export function screenKindFor(req: ScreenRequest, arcPlay: (arc: ArcId) => ArcPlay["kind"]): ScreenKind` (`ArcPlay` and `ArcId` from `./arcs`, `ScreenRequest` from `./screen`; pass `(a) => arcById(a).play.kind` from `main.ts`)
  - `export function gazeFor(kind: ScreenKind): Gaze | null`
  - `export function uniquifyIds(svg: string, prefix: string): string` (rewrites the `zo-` prefix to `${prefix}-` only inside `id="zo-…"`, `url(#zo-…)` and `href="#zo-…"`; `class="zo-lid"` is left alone so one CSS rule can reach every copy's lids)
  - `export function nextBlinkDelayMs(rand: number): number` (`rand` in `[0,1)`)
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write failing tests** (all in `zoreoModel.test.ts`):
  - `campaign and life requests are life`, `standalone life (no run) is life`, `battle is battle`, `quiet, summary and epilogue are interlude`, `title, arcs, arcComplete, arcIntro are menu`.
  - `arcPlay: a campaign arc is life once the intro is seen and menu before`, `a tutorial arc with a part is battle and without one is menu`, `a single-battle arc is battle`.
  - `gazeFor: life is panel, battle is board, interlude and menu are null`.
  - `uniquifyIds rewrites ids and their references but not classes`: a tiny SVG string with `id="zo-a"`, `url(#zo-a)`, `href="#zo-a"` and `class="zo-lid"`; with prefix `c1` it contains `id="c1-a"`, `url(#c1-a)`, `href="#c1-a"` and still `class="zo-lid"`; two copies with different prefixes share no id.
  - `nextBlinkDelayMs stays between 2500 and 6000 ms for rand 0, 0.5 and just under 1`.
- [ ] **Step 2:** `mise exec -- npx vitest run src/app/zoreoModel.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the four exports. `uniquifyIds(svg, prefix)` uses three global regex replaces (ids, `url(#…)`, `href="#…"`); the prefix is a plain identifier fragment. `nextBlinkDelayMs` is linear in `rand`.
- [ ] **Step 4:** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add the pure Zoreo model (screen kind, gaze, ids, blink timing)`.

### Task 4: The corner head, wired to the phase

**Files:**

- Create: `src/ui/zoreoCorner.ts`
- Modify: `src/app/main.ts` (`mount()`), `index.html` (CSS and one container in `#board`)

**Interfaces:**

- Consumes: `screenKindFor`, `gazeFor`, `uniquifyIds`, `nextBlinkDelayMs`, `Gaze` (Task 3); `Zoreo.svg` via `import zoreoSvg from "./zoreo/Zoreo.svg?raw"`; `calm` from `../render/motion`.
- Produces: `export interface ZoreoCorner { set(gaze: Gaze | null): void; dispose(): void }` and `export function createZoreoCorner(board: HTMLElement): ZoreoCorner`.

- [ ] **Step 1: Implement `createZoreoCorner`** in `src/ui/zoreoCorner.ts`: appends one `div#zoreo-corner` (`aria-hidden="true"`, `pointer-events: none`) to `board`, containing the uniquified SVG with the corner viewBox `16 -26 240 270`; `set(gaze)` writes `data-gaze="panel|board"` or `hidden`, is idempotent, and when the gaze actually changes and `calm()` is false triggers one blink (add then remove a `blink` class after about 180 ms); an idle blink timer re-arms with `nextBlinkDelayMs(Math.random())` and does nothing while `calm()` is true or the corner is hidden; `dispose()` clears all timers and removes the element.
- [ ] **Step 2: CSS in `index.html`** (next to the `#board` rules): `#zoreo-corner` is absolutely positioned inside `#board`, small (about 84 to 118 px tall; smaller in portrait so it overlaps the board as little as possible); `[data-gaze]`-based rules:
  - wide layouts: top right; `data-gaze="board"` unflipped (looks down-left into the board); `data-gaze="panel"` `scaleX(-1)`;
  - portrait: no flip; `board` at the top right; `panel` at the bottom right of `#board` (looking down-left at the panel below), with a `transform`/`top` transition of about 400 ms;
  - `#zoreo-corner.blink .zo-lid { transform: none }` (the `zo-lid` class survives `uniquifyIds`; the same rule shape serves the title Zoreo in Task 7);
  - all transitions and the idle blink are disabled when `calm()`; since CSS cannot see `?still=1`, add a root class `calm` toggled where other CSS already follows `calm()` (search `src/app/main.ts` and `src/render/motion.ts` for the existing pattern; if none exists, set `data-calm` on `<html>` once at boot and on `matchMedia` change) and write the rules against it;
  - hidden when `data-gaze` is absent.
- [ ] **Step 3: Wire `main.ts`:** create the corner once after the board exists; at the top of `mount()` (after the `continue` and epilogue early returns) call `corner.set(gazeFor(screenKindFor(req, (a) => arcById(a).play.kind)))`. Menus and the interlude set it to `null`.
- [ ] **Step 4: Verify by eye** (run `pitchfork start web`; use the browser tools): laptop width 1440x900 and phone landscape 844x390: head upper right; life turns toward the panel (flipped), battle toward the board; phone portrait 390x844: battle upper right, life lower right, slides between them; Menu button and brought-items strip not covered; interlude/summary and the title show no corner head; with `?still=1` no slide and no blink. In devtools confirm no duplicate `id` values in the document.
- [ ] **Step 5:** `mise run check`. Expected: pass.
- [ ] **Step 6: Commit** `feat(ui): add Zoreo's corner head that looks at the board or the panel`.

### Task 5: The title scene layer and the scene card

**Files:**

- Create: `src/ui/titleScene.ts`
- Modify: `src/ui/menu.ts` (`MenuModel`, `createMenu`), `src/app/menuScreens.ts` (`modelFor`), `index.html` (scene CSS)
- Reference: `docs/specs/title-zoreo-ref/B.html` for the exact layer order, sizes, CSS and button styles of the approved mock; lift them, do not redesign.

**Interfaces:**

- Consumes: pieces from Task 1; `uniquifyIds` (Task 3); tokens (Task 2).
- Produces:
  - `MenuModel` gains `readonly scene?: { readonly wordmark: boolean }`.
  - `export function createTitleScene(host: HTMLElement): { dispose(): void }` in `src/ui/titleScene.ts`; builds the fixed, `pointer-events: none`, `aria-hidden` scene (backdrop gradient, bokeh, rays, board island, germs, Zoreo with gun and strap in the pop-up ring, volley frozen above the card, buddies) from the pieces, uniquifying ids per instance.

- [ ] **Step 1:** In `createMenu.show`, when `m.scene` is set: insert the scene as a **sibling behind** the backdrop (not inside the scroll container) once, make the backdrop background transparent, give the card the scene card look (`var(--zw-card)`, rim and shadow from `B.html`, radius about 30 px), render `m.title` as the wordmark SVG (keep the `<h1 id="menu-title">` as visually hidden text for screen readers) when `scene.wordmark` is true, and style buttons with the mock's primary/secondary/greyed styles. Without `m.scene` the existing look is unchanged. Remove the scene (call `dispose`) when a model without `scene` is shown and in `dispose()`. Fix the existing `card.style.cssText +=` growth while here only if it breaks the scene card.
- [ ] **Step 2:** In `modelFor`, return `scene: { wordmark: true }` for `mode: "title"` and `scene: { wordmark: false }` for `mode: "arcs"`. First item (Continue, when present) is the primary button; the greyed Wilson entry uses the dashed border and the muted text colour (no 0.55 opacity, which drops its subtitle below 4.5:1).
- [ ] **Step 3: Verify by eye** at 1440x900: matches `shots/B-laptop.png`; keyboard focus lands on the card first and every button shows a focus ring; the arc picker shows the scene with the variant label as an ordinary title; the arc intro and the replace-confirm card are unchanged and plain.
- [ ] **Step 4:** With WebGL disabled (devtools) the existing "no WebGL" card still appears and nothing else changes.
- [ ] **Step 5:** `mise run check`. Expected: pass.
- [ ] **Step 6: Commit** `feat(ui): bright pop-up title scene behind the menu card`.

### Task 6: Small screens

**Files:**

- Modify: `index.html` (scene media queries), `src/ui/titleScene.ts` (named groups the CSS hides)

**Interfaces:**

- Consumes: scene groups from Task 5, named so CSS can hide them (`.zs-buddies`, `.zs-germ-staph`, `.zs-volley-far`, and so on; the volley clumps are already `.zs-v1` to `.zs-v9` in `volley.svg`).

- [ ] **Step 1:** Phone portrait (390x844): the scene is a strip above the card (Zoreo's head about 24% of the screen height is accepted); hide companions and the far volley clumps.
- [ ] **Step 2:** Phone landscape (844x390): hide in this order as space shrinks: companions, then all but one or two volley clumps, then the staph germ; keep the card a fixed width that scrolls; shrink the wordmark. Never push a button off screen.
- [ ] **Step 3: Verify by eye** at 390x844, 844x390 and 667x320 with all five items present (use a held run and `facilitator` on to get Continue and the export item; `?seed=7` helps): every button reachable by scrolling the card, the art never over the card, text readable. Take screenshots into `scratchpad` and compare with `shots/B-portrait.png` and `shots/B-landscape.png`.
- [ ] **Step 4:** `mise run check`.
- [ ] **Step 5: Commit** `feat(ui): fit the title scene to phone portrait and landscape`.

### Task 7: Opening beat and blinks (nice to have; cut first if time is short)

**Files:**

- Modify: `src/ui/titleScene.ts`, `index.html`

**Interfaces:**

- Consumes: the `.zs-v1` to `.zs-v9` volley groups, Zoreo's `zo-lid` class, `calm()`.

- [ ] **Step 1:** On title mount, play once (about 600 to 900 ms): Zoreo rises into the ring, the volley clumps appear in order and freeze in the arc, then one blink; an idle blink thereafter on the large Zoreo using `nextBlinkDelayMs`. When `calm()` is true skip straight to the final still frame and never blink.
- [ ] **Step 2: Verify:** with `?still=1` the scene is the static frame; without it the beat plays once on load and not again when returning to the title from the picker (decide: play only on first title mount per page load, and note it in the commit body).
- [ ] **Step 3:** `mise run check`.
- [ ] **Step 4: Commit** `feat(ui): opening pop-up and volley beat on the title`.

### Task 8: Release notes and final verification

**Files:**

- Modify: `CHANGELOG.md`, `docs/plans/beta-plan.md` (status table row and the "Resume here" block)

- [ ] **Step 1:** Add an `Unreleased` entry in `CHANGELOG.md` under Added (the new title scene and Zoreo; the corner head that looks at the board or the panel). Do not bump the version or tag: releases are the author's call.
- [ ] **Step 2:** Update the beta-plan status table (one row for this work with the commits by message) and the resume block.
- [ ] **Step 3:** Run every item in section 9 of the spec: `mise run check`; screenshots at laptop, portrait and landscape; corner head turn on a real life-to-battle change in Arc 1 and a normal week and the portrait slide; hidden on the summary; no-WebGL card unchanged; `?still=1` shows no motion; grayscale pass (title readable, stripe still reads against the white coat). Report anything that fails instead of editing around it.
- [ ] **Step 4: Commit** `docs: changelog and plan status for the title scene and Zoreo`.
