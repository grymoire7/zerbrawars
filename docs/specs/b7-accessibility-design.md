# Zebra Wars: B7 accessibility pass (design)

> Status: proposal, waiting on Tracy (section 11). Slices, commits and schedule are tracked in
> `../plans/beta-plan.md`, not here.

What accessibility the beta needs, how each part works, and what to build in which order. Design
only; no code was changed. Source references are to `main` at `c877d25`. Clinical corrections in
`fodder.md` still win; nothing here adds a clinical claim (spoken text reuses `organismName` and
the existing info cards). The sim (`src/sim`) is not touched: every new piece of logic lives in
`src/app` (pure, tested) or in `src/ui` and `src/render` (DOM and three.js).

The plan's bar: "a full battle and a full week are playable by keyboard alone; grayscale still
reads". The plan's cut list protects keyboard and reduced motion and cuts the rest first (item 3).
This design keeps that order.

## 1. What exists today (audit)

### 1.1 Keyboard, battle

- `src/app/battleScreen.ts:737` window `keydown`: Tab and Shift+Tab call `preventDefault()` and
  `controller.cycle(±1)`, always, whatever is open. Enter (not on an enabled button) ends the turn
  or skips playback; Space skips playback; `w` toggles wall off; Escape clears a pick or opens the
  menu. The handler returns early only for How to play and the probe.
- **The board cannot be played by keyboard.** Tab selects a swarm, but a destination, an engulf
  target or a charge target can only be chosen by a pointer: `pointerdown` -> `pickAt` ->
  `controller.tap(coord)` (`battleScreen.ts:727`). The canvas is not focusable and has no role or
  name on the battle screen.
- **Tab is captured, so a keyboard player cannot reach any button on the battle screen**: not
  End Turn, not the charges, not the order list, not the Menu button.
- **The outcome card is a dead end by keyboard.** `src/ui/outcome.ts` focuses the card
  (`tabIndex -1`) and handles only Escape. Tab is still eaten by the battle handler (`cycle` does
  nothing once the fight is over), so Next, Play again and the rest cannot be reached. The Arc 1
  part A story card (`createMenu`, over the board) has the same problem.
- `src/ui/hud.ts` rebuilds the order list (`ordersList.replaceChildren`, line 638) and the charge
  chips (line 653) on every `update`, which runs on every controller change (including hover). A
  focused swarm button, Clear button or charge chip is destroyed after it is pressed, and focus
  falls to `<body>`. With Tab freed, this would strand keyboard focus after every pick.
- Enter on `<body>` ends the turn. Once focus can fall to the body (above), a second Enter after a
  destroyed button ends the turn by surprise.
- The debug readout "hover x,y selected x,y" (`battleScreen.ts:413`, appended at line 688) is shown
  to every player, not only with a debug URL.

### 1.2 Keyboard, life and overlays

- `src/ui/lifePanel.ts` is all real buttons (slots, activities, alt versions, rest, pills checkbox,
  Play, Play one day, banner buttons, battle button) and restores focus by `data-key` after each
  rebuild (line 738). A week is close to keyboard-playable already. Gaps:
  - if the focused control is now hidden or disabled (Play the week hides when the week ends; a
    played card disables), focus falls to `<body>`;
  - after picking an activity, the next step (a slot) is above it in the tab order, several
    Shift+Tabs away; after picking an empty slot first, the activities are below several stops;
  - the alt-version button previews on `pointerenter` but not on `focus` (line 592).
- `src/app/lifeScreen.ts:643` handles only Escape. `src/app/interludeScreen.ts:101` handles only
  Escape. Neither captures Tab.
- Dialogs: How to play (`help.ts`) traps Tab on its one button; the game menu (`gameMenu.ts`) has a
  real Tab cycle in the capture phase; `outcome.ts`, `interlude.ts`, `menu.ts` and `probe.ts` are
  `aria-modal` but do not keep Tab inside, so Tab walks into the screen behind the backdrop. The
  probe has no Escape.
- `index.html` already styles `button:focus-visible` and `summary:focus-visible` (2px
  `--zw-focus`). Not covered: the canvas, the pills checkbox, the probe text field, cards focused
  with `tabIndex -1` (the menu card sets `outline:none` on purpose).

### 1.3 Reduced motion

Already done: the controller skips playback by default with a summary pulse
(`controller.ts:486`, `battleScreen.ts:147`, listens for changes); board breathing
(`boardView.ts:403`, also `?still=1`), the growth swell (`pathogenView.ts:244`), the aura breathing
(`auraView.ts:37`), the life inset (`insetView.ts:83`) and the coach pulse (`index.html`, guarded
by `prefers-reduced-motion: no-preference`).

Still moving under reduced motion, every frame, outside playback:

- swarm cells drift, bob and spin, and the cargo bobs and spins (`swarmView.ts:280-334`);
- the idle-swarm mark pulses its opacity (`orderView.ts:299`);
- every germ token bobs (`pathogenView.ts:249`).

During a user-chosen Replay, the engulf "shake" (`playbackView.ts:219`) runs at 45 rad/s.

### 1.4 Colour

B1a gave every family a shape or icon: round vs spiky germs, a pale ring for a shell, arrow vs
dotted arc vs outline vs pause sign vs cross for telegraphs, dot/hatch/cross-hatch heat, a diamond
for a charge target, a thick ring for an incoming germ, icon badges on activity cards, ✓ ✗ ! on
dose cells, dashed borders for blocked slots and ghost bars hatched. The Key text names the shape
as well as the colour. Nothing has been checked in grayscale or with a colour-vision simulation
yet. Worth knowing: X-linked CGD patients are male, and red-green colour blindness affects about 8%
of males, so deuteranopia and protanopia matter as much as grayscale for this audience.

Possible weak spots to look at first: the hover frame (thin white ring) vs the selected frame
(thicker `order` ring); option tiles vs engulf targets; free vs loaded swarm (colour lerp, backed
by cargo meshes and the load label); tissue healthy vs stressed vs damaged (backed by the strip's
number); the medication aura strength (backed by the strip's text).

### 1.5 Text size

Every size is fixed px (`index.html` body 14px; inline `font-size:11-16px` in `src/ui/*.ts`).
Browser zoom scales px, so laptop zoom works; iOS Dynamic Type does not reach px text; Android
Chrome's text scaling and Safari's per-site text size (aA) do. The viewport meta allows pinch zoom
(the board canvas sets `touch-action:none`, so pinch works off the board only). At 200% zoom on a
1280 x 800 laptop the CSS viewport is 640 x 400: the wide layout still applies (aspect ratio
unchanged) with a 300px side panel and a 340px board, and the `max-height: 500px` rules kick in.
Not yet checked by eye. No `color-scheme` is declared, so native scrollbars and the pills checkbox
render light on the dark UI.

### 1.6 Screen reader

- Good: dialogs are `role="dialog"`, `aria-modal`, named by their title; toggles use
  `aria-pressed`; info tips use `aria-expanded`/`aria-controls`; status cells and dose cells have
  labels; the coach strip is a single persistent live region that only changes text
  (`coachStrip.ts`); the life inset canvas is `role="img"` with a live label.
- Live-region noise. Several live regions are rebuilt on every update, so a screen reader repeats
  them on unrelated clicks or even on hover:
  - battle "What happened" log (`hud.ts:296`, `aria-live=polite`) is rebuilt as each event is
    revealed during playback: the whole log is read again and again;
  - battle problems box (`hud.ts:265`, `role=alert`) is rebuilt on every refresh, including hover;
  - battle charge hint (`hud.ts:243`) is reset every refresh;
  - life "What happened" (`lifePanel.ts:213`), "How you feel" (`role=status`, line 199) and the
    aftermath box (line 205) are rebuilt on every update (every pick);
  - life calendar hint (`lifePanel.ts:406`) is a new live element each render, so it is probably
    never announced (a live region must exist before its text changes).
- The battle board has no accessible name and no way to learn what is on a tile without a pointer.
- No announcement when a turn finishes (only the noisy log).

## 2. What the beta needs, and what waits

**In the beta (in this order of importance)**

1. Keyboard play of a full battle, including Arc 1, the outcome card and the menu.
2. Keyboard play of a full week, including interludes, the summary and every dialog.
3. Reduced motion: nothing drifts or pulses on its own when the OS asks for less motion.
4. Visible focus everywhere, and focus that never strands on `<body>`.
5. Grayscale and red-green checks, with fixes where a meaning is lost.
6. Text at 200% (browser zoom, Android text scaling) stays usable.
7. Screen reader: no repeated announcements; the board speaks the tile under the cursor; a turn
   announces its result.

**Not in the beta (my call)**

- An in-game Settings screen (text size, reduced motion, shortcut remapping). The navigation design
  kept Settings out; text size and motion follow the browser and the OS.
- Converting px to rem. About 400 inline sizes, 3 to 5 hours, and risk to the tuned phone layout,
  for a gain (iOS Dynamic Type) that Safari's own text-size control mostly covers.
- Windows High Contrast (`forced-colors`): the demo is a laptop we control; post-beta.
- Zoom beyond 200% (at 300%+ on a laptop the board gets squeezed by the 300px side panel).
- Full WCAG 2.1.4 compliance for single-key shortcuts (a way to turn them off). See risk R4.
- Headings structure in the side panel, per-screen `document.title`.

## 3. Battle by keyboard

### 3.1 Interaction model: a board cursor that does what a tap does

The board becomes one focusable control with a **cursor** (one tile). Arrow keys move the cursor;
Enter or Space on the board does exactly what a tap on that tile does today (`controller.tap`), and
the cursor drives the same previews as a mouse hover (`controller.hover`). One rule, no new order
logic, and every pointer feature (odds card, info card, wall-off card, charge preview) works by
keyboard for free.

Rejected alternative: lists of destinations and targets as buttons in the side panel. Coordinates
mean nothing to a player, the lists change every pick (more focus churn), and it doubles the UI on a
phone. Not recommended.

### 3.2 Tab goes back to the browser

Tab and Shift+Tab are never captured on the battle screen. The tab order becomes: Menu button
(first in `#ui`) -> board -> side panel (coach Got it, status cells, ?, info tips, charge chips,
order rows and Clear, Key, log) -> pinned bar (End Turn, Wall off, Replay; 1x, 2x, Skip during
playback). Swarm cycling moves to the number keys (3.3). This is a behaviour change for anyone who
used Tab to cycle swarms (Q1).

### 3.3 Key map

"Board keys" are active when the board has focus **or** nothing has focus (`document.activeElement`
is `<body>` or null), no dialog or overlay is open (How to play, probe, menu, outcome card, story
card), the target is not a text field, and no Ctrl, Meta or Alt is held (so Cmd+1 still switches
browser tabs and Cmd+W still closes the tab). They are never active while a side-panel control has
focus, so Enter and Space on a button stay the button's.

| Key | When | Does |
| --- | --- | --- |
| Tab, Shift+Tab | always | Browser focus order. No longer cycles swarms. |
| Arrow keys | board focused, planning | Move the cursor one tile (Up = row above on screen). Stops at the edge, no wrap. Shows the hover previews. |
| Enter, Space | board focused, planning | Act on the cursor tile, exactly as a tap (select, move, engulf, hold, hold -> wall off -> clear, dose). |
| Enter, Space | board keys, playback | Skip to the end of the turn (unchanged). |
| Enter | nothing focused, planning | End the turn (unchanged, for mouse players who click the board then press Enter). |
| 1 to 9 | board keys, planning | Select swarm `s1`..`s9` if it exists; cursor jumps to it; focus moves to the board. |
| T, Shift+T | board keys, planning | Cursor jumps to the next / previous place to act (3.5); focus moves to the board. |
| C | board keys, planning | Pick the next charge with uses left (antibacterial -> antifungal -> strong -> none, skipping missing ones); cursor jumps to its first target; focus moves to the board. |
| W | board keys, planning | Wall off the selected swarm, or cancel it (unchanged key, now board keys only). |
| E | board keys, planning | End the turn, same path as the End Turn button (probe included). |
| Backspace, Delete | board keys, planning | Clear the selected swarm's order; with no swarm selected, clear the queued dose. |
| I | board focused, planning | Speak the full info card for the cursor tile (screen reader; 3.6). |
| ? | board keys | Open How to play. |
| Escape | always (unchanged) | Clear a selected swarm or charge; with nothing to clear, open the menu. |

`W` no longer fires while a side-panel button has focus. Mouse players are unaffected: clicking the
board does not move focus (3.4), so focus stays on the body and board keys still work.

Keys are shown in: the How to play dialog (a new "Keyboard" paragraph, 3.7), `aria-keyshortcuts`
on the board and on End Turn (`"E"`), and the End Turn `title` ("End Turn (E)"). The visible End
Turn label does not change (phones have no keyboard).

### 3.4 Focus rules

1. **The board is focusable** while the battle screen is mounted: `canvas.tabIndex = 0`,
   `role="application"`, `aria-roledescription="board"`, `aria-label="Battle board"`,
   `aria-describedby` a hidden line with the keys ("Arrow keys move. Enter acts. 1 to 9 pick a
   swarm. T jumps to the next target. C picks a charge. E ends the turn."). All four are removed in
   `dispose` (the life screen reuses the canvas as `role="img"`).
2. **A pointer press on the board does not focus it** (`e.preventDefault()` in the canvas
   `pointerdown` handler, before `pickAt`). Mouse and touch behave as today.
3. **Keyboard mode.** A window `keydown` (any key but a lone modifier) sets `keyboardMode = true`; a
   window `pointerdown` sets it false. It changes only focus moves and wording, never what a key or
   tap does.
4. **Focus never rests on the body in keyboard mode.** At the end of `refresh()`, if
   `keyboardMode`, nothing is focused (`document.activeElement` is body or null) and no dialog or
   overlay is open, focus the board (`preventScroll: true`). This covers: End Turn hiding during
   playback, playback ending, a Clear button disappearing, a probe closing, Start this fight over.
5. **The HUD restores focus after a rebuild** like `lifePanel` does: every button it rebuilds gets
   a `data-key` (`order-<id>`, `clear-<id>`, `charge-<kind>`, plus the pinned `end-turn`,
   `wall-off`, `replay`, `x1`, `x2`, `skip`); `update` records the focused key before rebuilding and
   refocuses the same key after, if it is still shown and enabled; `clear-<id>` falls back to
   `order-<id>`. Otherwise rule 4 applies.
6. **A keyboard pick moves on to the board.** In `battleScreen`, `onSelect(id)` and
   `onPickCharge(charge)` from the HUD: when `keyboardMode`, after the controller call, move the
   cursor (to the swarm's tile, or the charge's first target) and focus the board. Clear, Replay,
   speed and Wall off keep focus where it is.
7. **Entering the board with no cursor** puts it on the selected swarm, else the first swarm in id
   order, else the board centre. On focus: show the cursor, `controller.hover(cursor)`, speak the
   tile. On blur: hide the cursor and `controller.hover(null)`.
8. During playback the cursor stays put and arrows do nothing; after playback the cursor and its
   previews come back.

### 3.5 The cursor and the "next place to act" jump

- **Drawing.** `boardView` gets `setCursor(coord | null)`: its own frame, white, line width 0.014
  (the hover frame is 0.006, the selected frame 0.012), on the hover ring geometry, plus the hover
  tint on the tile. It is separate from `setHover` so a pointer and the keyboard cannot fight, and
  thick enough to see from a sofa and in grayscale. Pointer hover is unchanged.
- **Orientation.** The camera sits on +z looking at the origin (`scene.ts:13`) and tile y maps to
  world z (`boardView.ts:187`), so Up is y-1, Down y+1, Left x-1, Right x+1. Spoken positions are
  "row y+1, column x+1", counted from the top-left as seen.
- **T targets**, in reading order (y, then x), recomputed on each press:
  - a charge is picked: its targets (`controller.dose().targets`);
  - else a swarm is selected: its engulf targets (the pathogen tiles of `controller.targets()`)
    then its move options (`controller.options()`), then its own tile (hold);
  - else: the tiles of swarms that have no order yet, then all swarms.
  - From a cursor not on the list, T goes to the first entry after the cursor in reading order
    (wrapping); Shift+T the last before it.

### 3.6 What the board says (screen reader)

One visually hidden polite live region for the battle screen (a `div.zw-sr` with
`aria-live="polite"`, appended to `ui`; CSS class added to `index.html`). Writes are coalesced: the
latest text wins after 120 ms; to repeat the same text, clear it first.

- **On cursor move or board focus:** `tileSpeech`:
  `Row 3, column 4. <contents>. <heat>. <action>`
  - contents: from `entityAt(battle, at)`; a swarm: `Swarm s1` + `, carrying 2 of 3` when loaded
    + `, selected` + `, order: <chip label>` (the `swarmStatuses` label); a germ or an arrival door:
    the `infoFor(...)` title; a granuloma on the tile: `Walled off`; nothing: `Empty`.
  - heat: inflammation 1 `Warm`, 2 `Inflamed`, 3 `Very inflamed`; 0 says nothing.
  - action: what Enter would do, from `enterAction` (below); nothing when Enter does nothing.
- **On Enter:** the `done` text of the action computed before the tap.
- **On I:** the info card title, sub and lines for the tile (`infoFor`), or `Empty`.
- **When a turn has played** (playback ends, or at once under reduced motion): `turnSummary`:
  `Turn 3 played. Tissue 18.` + the first five `logLines` of the turn + `and 4 more in What
  happened.` when longer. The outcome card announces itself when it opens (dialog title), so a
  finished fight does not add a summary.
- **`enterAction`** simulates `tapTile(battle, ui, at, walls)` (already exported and pure, from
  `controller.ts`) and describes the difference between the old and new `OrderUi`:

| Change | hint (spoken on move) | done (spoken after Enter) |
| --- | --- | --- |
| support set to a new order | `Enter: <Charge> dose on <target>.` | `<Charge> dose on <target> queued.` |
| support cleared | `Enter: take back the dose.` | `Dose taken back.` |
| selection to another swarm | `Enter: select s2.` | `s2 selected.` |
| selection cleared | `Enter: deselect.` | `Nothing selected.` |
| new move order | `Enter: move s1 here.` | `s1 will move here.` |
| new hold order | `Enter: s1 holds.` | `s1 will hold.` |
| new wall off order | `Enter: s1 walls off here.` | `s1 will wall off here.` |
| new engulf order | `Enter: s1 engulfs <title>, kill chance 30%.` (or `, loads it` when it cannot kill) | `s1 will engulf <title>.` |
| order cleared | `Enter: clear s1's order.` | `s1's order cleared.` |

  `<target>` is the `supportCardFor` title's object (a germ title, or `s1's load`); `<title>` is
  `organismName(kind) + " " + id`; kill chance is `oddsFor(...).killChance`. The `OrderUi` is
  rebuilt in `battleScreen` from `controller.orders()`, `selected()`, the selected chip of
  `charges()` and `supportOrder()`.

### 3.7 Wording for keyboard players

- **How to play** (`help.ts` `BATTLE_LINES`), new paragraph after "How to order":
  `["Keyboard", "Tab to the board. Arrow keys move the cursor and Enter acts, like a tap. Press 1, 2 or 3 to pick a swarm, T to jump to the next place it can go, C to pick a charge, W to wall off and E to end the turn. Escape cancels or opens the menu."]`
- **Life How to play** (`LIFE_LINES`), new paragraph at the end:
  `["Keyboard", "Tab moves between buttons and Enter or Space picks. Pick an activity, then a time slot, or the other way round. Escape cancels a pick or opens the menu."]`
- **Coach marks** (`coachModel.ts`): `CoachInput.pointer` gains `"keys"` (set when
  `keyboardMode`); `verb` returns `"Choose"` for it. Mark A1 in keys mode reads
  `These are your cells, in swarms. Press a swarm's number, like 1, to pick it.` The other marks
  read correctly with "Choose" ("Choose one to move closer", "Choose the Strep to swallow it",
  "Now choose the green diamond on the ...", "Choose Antifungal").
- **Charge hint** (`hud.ts:670`): `HudModel` gains `keys: boolean`; with it the picked-charge hint
  reads `Move to a green diamond and press Enter (T jumps there).` instead of `Tap a green diamond
  on the board.`

## 4. Week, menus and dialogs by keyboard

### 4.1 Life panel focus

In `lifePanel.ts`:

1. **Keyboard picks move on.** The activity pick, rest and slot click handlers note
   `nextFocus = "slot"` (activity or rest) or `"card"` (slot) when the click came from a keyboard
   (`event.detail === 0`; screen readers' virtual clicks also report 0). In `update`, after the
   normal `data-key` restore: `"slot"` and an activity or rest is now selected -> focus the first
   slot button (reading order: day by day, then slot) whose model `target.ok` is true; `"card"` and
   a slot is now pending -> focus the first enabled activity pick button. Then clear `nextFocus`.
   Pointer clicks never move focus.
2. **Fallback.** If focus was inside the side panel or bar (`activeKey()` was not null) and the
   restore target is missing, hidden or disabled, focus the first shown and enabled of: the banner's
   first button, the battle/next button, Play the week, Plan this week again.
3. The alt-version button previews on `focus` and clears on `blur`, like the pick button.

### 4.2 Modal dialogs keep focus inside: `inert`

New `src/ui/modal.ts`:

```ts
const holders = new Set<object>();
const sync = () => {
  const app = document.getElementById("app");
  if (app) app.inert = holders.size > 0;
};
export const holdModal = (owner: object) => (holders.add(owner), sync());
export const releaseModal = (owner: object) => (holders.delete(owner), sync());
```

`#app` (board and side panel) becomes inert while any card is up; `#ui` (the Menu button and the
overlays) stays live, so the Menu button remains reachable over the outcome card as the navigation
design intends. Wire it in: `help.ts` (open / close / dispose), `gameMenu.ts` (open / close /
dispose), `outcome.ts` (shown and not collapsed / collapsed or hidden), `menu.ts` (shown and not
collapsed / collapsed, hidden, dispose), `interlude.ts` (show / dispose), `probe.ts` (ask / finish
/ dispose). The existing Tab traps in help and the game menu stay. With Tab no longer captured by
the battle screen and `#app` inert, the outcome card, the story card, interludes, the title and the
probe all get a natural Tab cycle through their own buttons.

Also: the probe answers Escape as Skip (`finish(null)`); the probe is facilitator-only.

### 4.3 Focus styles (`index.html`)

```css
:root { color-scheme: dark; }
#scene:focus-visible { outline: 3px solid var(--zw-focus, #9fd8f0); outline-offset: -3px; }
input:focus-visible { outline: 2px solid var(--zw-focus, #9fd8f0); outline-offset: 2px; }
.zw-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
```

Cards focused with `tabIndex -1` keep no outline (focus there is a reading start, not a control).

## 5. Reduced motion

One shared check, `src/render/motion.ts`:

```ts
const query = typeof window !== "undefined" && typeof window.matchMedia === "function"
  ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
const still = typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("still") === "1";
/** Read every frame, so a change of the OS setting takes effect at once. */
export const calm = (): boolean => still || (query?.matches ?? false);
```

When `calm()`:

- `swarmView.ts` `step`: idle drift amplitude 0, the vertical bob 0, cell rotation fixed at its
  phase (no `t * 0.3`), the wrap wobble 1, cargo bob 0 and cargo rotation fixed. Moves driven by
  playback (path, wrap, jolt) are untouched: playback is already skipped, and Replay is the
  player's choice.
- `orderView.ts` `tick`: idle mark opacity fixed at 0.55.
- `pathogenView.ts` `tick`: token bob 0.
- `playbackView.ts`: the engulf shake term 0 (Replay still plays, without the 45 rad/s jitter).

The existing local `calm` copies in `boardView`, `auraView`, `pathogenView` and `insetView` may
switch to `motion.ts` but need not. Out of scope: an in-game toggle (Q5). The implementer greps
`clock` and `Math.sin` in `src/render` and confirms that every remaining time-driven change is
either playback-only or guarded.

## 6. Colour independence (grayscale and red-green)

This is a check with a small fix budget, not new design. No `?gray=1` flag: Chrome DevTools >
Rendering > "Emulate vision deficiencies" (Achromatopsia, Deuteranopia, Protanopia) covers the
laptop, and the phone's own grayscale filter (Android: Digital Wellbeing or Accessibility > Colour
correction; iOS: Accessibility > Display > Colour Filters) covers the phone.

Check, in each of the three simulations, that each pair below can be told apart **without the Key
text**; fix only a pair that fails, by adding or strengthening a shape, line style or label (never a
new colour alone), in the file named:

| Screen | Must stay distinct | Where |
| --- | --- | --- |
| battle | Strep vs Staph vs Aspergillus tokens (round, ringed round, spiky) | `pathogenView.ts` |
| battle | spread arrow, spore dotted arc, grow outline, stall pause sign, blocked cross | `telegraphView.ts` |
| battle | incoming ring vs incoming-blocked dashed ring with cross | `telegraphView.ts` |
| battle | heat 1, 2, 3 patterns and the forecast corner chip | `boardView.ts` |
| battle | move option tile vs engulf target vs charge diamond vs queued dose | `boardView.ts`, `orderView.ts` |
| battle | keyboard cursor vs pointer hover vs selected swarm frame | `boardView.ts` |
| battle | free vs loaded swarm; idle-swarm mark | `swarmView.ts`, `orderView.ts` |
| battle | granuloma vs germ token | `granulomaView.ts` |
| battle | status strip meters (each has a number or word) | `statusStrip.ts` |
| life | activity families (icon badge), rest | `cardStyle.ts`, `lifePanel.ts` |
| life | open slot vs blocked slot (dashed + reason) vs chosen slot ("Chosen") | `lifePanel.ts` |
| life | dose cells taken / missed / at risk (✓ ✗ !, dashed) | `lifePanel.ts` |
| life | inset exposure dots and the doctor's dashed ring | `insetView.ts` |
| menus | the greyed Wilson's entry | `menu.ts` |

Most of these were designed to pass (section 1.4). The one I expect to need a fix is
cursor/hover/selected (now addressed by the thick cursor frame in 3.5).

## 7. Text at 200%

Target: at **200% browser zoom on the demo laptop**, and at **Android Chrome text scaling 200%**
and **Safari aA 150%** on the phone in portrait, a full battle and a full week can be played: every
control is reachable (scrolling is fine), no text that carries meaning is clipped or hidden behind
another element, and nothing scrolls sideways.

Build nothing up front beyond `color-scheme: dark` (4.3). Check, and fix only what fails, within a
one-hour budget. Likely suspects:

- calendar slot buttons (`lifePanel.ts:452`): `overflow:hidden` with fixed min-heights; if text is
  clipped, drop `overflow:hidden` (the text already wraps);
- the battle turn line (`hud.ts:208`, `overflow:hidden`) and the End Turn hint;
- the status strip at 2 columns, the bar's button row wrapping, the short-landscape
  (`max-height: 500px`) rules at 200% zoom on the laptop (640 x 400);
- canvas labels (`labels.ts`) are drawn in world space and do not follow text size; they scale with
  the board (`setLabelBoost`). Accept for the beta.

## 8. Screen reader: live-region hygiene

Rule for every live region: write only when the text changed; never rebuild a live element.

- `hud.ts`: remove `aria-live` from the log (keep `tabIndex 0` and its label, so it can be read on
  demand; the turn summary in 3.6 replaces the stream). Rebuild `problems` only when its joined text
  changed. Set `chipHint.textContent` only when it changed.
- `lifePanel.ts`: rebuild `feelBox`, `aftermathBox`, `beatsBody` and `bannerBox` only when their
  content signature (joined text) changed. Create the calendar `hint` element once, outside
  `renderCalendar`, and re-insert it (same node) after `planTip.note`; set its text only when
  changed.
- `battleScreen.ts`: append the debug readout only when `facilitator.debugPanel` is true.
- Check by ear (VoiceOver): picking an activity is read once; hovering the board is silent; a
  turn's result is read once.

## 9. Slices

Each slice: implemented by a Sonnet subagent, verified with `mise run check` plus the manual list,
Prettier on the files it touched only, one conventional commit. Estimates are implementer hours and
assume no surprises; coordinator browser checks are extra (about 20 minutes per slice).

| Slice | Effort | Summary |
| --- | --- | --- |
| K1 Battle keyboard core | 3.5h | Tab freed, board focusable with a cursor, arrows, Enter/Space, digits, E, W, ?, focus rules, HUD focus restore, wording. |
| K2 Dialogs and week | 1.5h | `inert` modal helper, life focus moves and fallback, probe Escape, focus CSS, `color-scheme`. |
| M1 Reduced motion | 1h | `motion.ts`, idle drift, pulse, bob and shake stopped. |
| K3 Keyboard assists | 1.5h | T / Shift+T jump, C charge, Backspace/Delete. |
| S1 Screen reader | 2.5h | Board speech, `enterAction`, I key, turn summary, live-region hygiene. |
| V1 Checks and fixes | 1.5h | Grayscale and red-green, 200% text, axe/Lighthouse pass; fix budget. |

About 11.5 hours in all, so two full sittings, not one. **Minimum for the plan's "done when":
K1 + K2 + M1 (6 hours)**, plus the V1 grayscale check (coordinator, 20 minutes, no code if it
passes). Cut first, in order: S1 board speech and turn summary (keep its hygiene part, 30 minutes,
folded into K2); V1 text-scale fixes (keep the check, log what fails); K3's C and Backspace (keep
T, which matters for players who tire easily or have limited dexterity: it cuts most battle orders
to two or three key presses).

### K1 Battle keyboard core (3.5h)

Files: `src/app/battleScreen.ts`, new `src/app/boardCursor.ts` (+ `boardCursor.test.ts`),
`src/render/boardView.ts`, `src/ui/hud.ts`, `src/ui/help.ts`, `src/app/coachModel.ts`
(+ its test), `index.html` (the `#scene:focus-visible` and `.zw-sr` rules only).

- `boardCursor.ts` (pure, no DOM): `startCursor(battle, selected): Coord` (3.4 rule 7);
  `moveCursor(board, at, key): Coord` (`"ArrowUp"` y-1 etc., clamped); `swarmByDigit(battle,
  digit): SwarmId | null` (`s<digit>` if present).
- `boardView.ts`: `setCursor(coord | null)` (3.5).
- `battleScreen.ts`: rewrite the `keydown` handler to the key map in 3.3 (K1 keys: arrows,
  Enter/Space, digits, W, E, ?, Escape; leave T, C, Backspace, I to K3/S1); the board attributes and
  their removal in `dispose` (3.4 rule 1); `preventDefault` on canvas `pointerdown`; `keyboardMode`
  listeners (window `keydown` / `pointerdown`, with `signal`); `cursor` state, focus and blur
  handlers; rule 4 at the end of `refresh()`; rule 6 in the `onSelect` and `onPickCharge` handlers;
  `pointer: keyboardMode ? "keys" : ...` in `coachInput`; `keys: keyboardMode` in the HUD model;
  End Turn `aria-keyshortcuts="E"` and title.
- `hud.ts`: `data-key` on rebuilt and pinned buttons and the restore in `update` (3.4 rule 5);
  `HudModel.keys` and the charge hint (3.7).
- `help.ts`: the Keyboard paragraph in `BATTLE_LINES` (3.7). `coachModel.ts`: `"keys"` and `verb`,
  A1 keys text.
- Keep `controller.cycle` (unused by keys now; its tests stay).

Verification:

- Unit: `moveCursor` clamps at all four edges; `startCursor` picks selected, then `s1`, then the
  centre; `swarmByDigit` ignores missing swarms; coach A1 text in keys mode; `verb` for keys.
- `mise run check` passes.
- Laptop, Chrome, **hands off the trackpad from the title on**: start Arc 2, plan week 1 (K2 not
  needed for this if done by Tab and Enter), play its battle to the outcome card and press Next.
  Tab reaches Menu, board, every side-panel control and End Turn, and Tab never stops responding;
  a focus ring shows on every stop including the board; arrows move a clearly visible cursor and
  the odds/info cards follow it; Enter selects, moves, engulfs, holds, walls off (second Enter on a
  loaded swarm) and clears (third); 1, 2, 3 select; a charge chip picked with Enter moves focus to
  the board and Enter on a diamond queues the dose; W; E ends the turn; Space skips playback; after
  playback focus is on the board; the outcome card's buttons are reachable by Tab and Next works.
- Arc 1 parts A and B by keyboard, including the story card; the coach says "Press a swarm's
  number" and "Choose ...".
- Mouse regression: click tiles to play a turn; click the board then press Enter: the turn ends
  (unchanged); clicking the board shows no focus ring; Tab no longer cycles swarms; Cmd+1 and Cmd+W
  still reach the browser.
- Phone: one battle by touch, unchanged; no focus ring on taps.

### K2 Dialogs and week (1.5h)

Files: new `src/ui/modal.ts`; `src/ui/help.ts`, `gameMenu.ts`, `outcome.ts`, `menu.ts`,
`interlude.ts`, `probe.ts`, `lifePanel.ts`; `index.html` (`color-scheme`, `input:focus-visible`).

- 4.1, 4.2, 4.3 as written.

Verification:

- `mise run check` passes.
- Keyboard only: title -> Arc 2 -> a full two-week summer to the summary screen and Back to the
  title. Picking an activity with Enter puts focus on the first slot it can go to; Enter there
  places it; picking an empty slot first puts focus on the first activity; when the week ends,
  focus lands on the battle (or next) button; the banner's Book the doctor / Play on are reachable.
- With each of How to play, Menu, outcome card, story card, interlude, title, arc picker and probe
  open: Tab and Shift+Tab never reach the board or side panel behind it; closing returns focus to
  where it was (help, menu) or to a sensible control.
- The probe (`?facilitator=1`, probe on): Escape skips it.
- Checkbox and text field show a focus ring; scrollbars are dark.

### M1 Reduced motion (1h)

Files: new `src/render/motion.ts`; `swarmView.ts`, `orderView.ts`, `pathogenView.ts`,
`playbackView.ts`.

Verification:

- `mise run check` passes.
- macOS System Settings > Accessibility > Display > Reduce motion on, with the game open (no
  reload): on a battle in planning, nothing on the board moves for 10 seconds (swarms, cargo, idle
  marks, germs, aura, tiles); End Turn snaps to the result with the summary pulse; Replay plays the
  turn without the engulf shake; the life inset is still. Turn the setting off: the drift returns
  without a reload. `?still=1` gives the same stillness.

### K3 Keyboard assists (1.5h)

Files: `boardCursor.ts` (+ tests), `battleScreen.ts`, `help.ts` text already mentions T and C.

- `jumpTargets(input): Coord[]` and `nextTarget(list, cursor, dir)` (3.5); keys T, Shift+T, C,
  Backspace, Delete (3.3).

Verification: unit tests for the three `jumpTargets` cases and wrap-around in both directions; by
keyboard, a move-and-engulf order takes `1`, `T`, `Enter`; `C` cycles charges in order and ends on
none; Backspace clears the selected order, and the dose when nothing is selected.

### S1 Screen reader (2.5h)

Files: `boardCursor.ts` (+ tests: `tileSpeech`, `enterAction`, `turnSummary`), `battleScreen.ts`
(live region, coalescing, I key, speak on move, Enter, playback end), `hud.ts`, `lifePanel.ts`
(section 8).

Verification:

- Unit: `enterAction` returns the table's hint and done for each row of 3.6, using real
  scenarios; `tileSpeech` for a swarm, a germ, an arrival door, a granuloma, an empty hot tile;
  `turnSummary` caps at five lines.
- VoiceOver (Cmd+F5) with Safari, then Chrome: Tab to the board hears "Battle board, board" and the
  keys; arrows read each tile once; Enter reads the done line; I reads the info card; a played turn
  reads "Turn N played..." once and the log is not read by itself; the outcome card reads its
  title on open. On the life screen, picking an activity and a slot each read once; "How you
  feel" is not re-read on every click. If an NVDA machine is at hand, repeat the battle part.

### V1 Checks and fixes (1.5h)

No code unless something fails. Run section 6 in all three simulations on battle (with every mark
on the board: use the default scenario mid-fight with a charge picked) and life; section 7 at 200%
laptop zoom and on the phone; Chrome Lighthouse accessibility audit (or the axe DevTools
extension) on title, arc picker, life, battle, outcome card and the open menu. Fix every
"critical" and "serious" finding that takes under 15 minutes; log the rest in the plan's open
list.

## 10. Risks

- **R1 `role="application"`** stops screen readers' own arrow navigation on the board, which is
  the point, but VoiceOver and NVDA differ in the details. Mitigation: short labels; if it fights
  VoiceOver, drop the role and keep the label (the cursor speech still works through the live
  region).
- **R2 Habit.** Anyone who learned Tab-to-cycle loses it (Tracy, the remote reviewer). Number keys
  replace it and the Key/Help says so.
- **R3 Surprise focus moves.** Only keyboard activations move focus, and only to where the next
  step is. Pointer users never see it.
- **R4 Single-key shortcuts** (WCAG 2.1.4). They fire only when the board or nothing has focus, not
  in text fields or on other controls; there is no switch to turn them off. A speech-input user
  could end a turn by saying a word that begins with "E" while focus is on the body. Accept for the
  beta; a Settings toggle is post-beta.
- **R5 E ends a turn with no undo.** Same as the End Turn button; the key needs a deliberate press
  and does nothing while a control has focus.
- **R6 HUD rebuilds on every hover.** The restore by `data-key` runs on every update; that is cheap,
  but a missed key means a lost focus. Rule 4 is the safety net.
- **R7 `inert`** needs Safari 15.5+ and Chrome 102+. Fine for the demo laptop and recent phones;
  older browsers just keep today's behaviour.
- **R8 Schedule.** B8 (offline demo build) is next and is never cut. If K1 runs long, stop after K1
  + K2 + M1 and log the rest.
- **R9 Unverified on real devices:** Android text scaling and a phone screen reader (TalkBack) are
  not in the checks above beyond V1's text-scale pass; TalkBack is post-beta.

## 11. Open questions for Tracy

1. **Free Tab on the battle screen; number keys pick swarms.** Default: yes.
2. **On the board, Enter acts on the tile; E ends the turn.** Enter with nothing focused still ends
   the turn, as today. Default: yes.
3. **A keyboard pick moves focus to the next step** (charge or swarm -> board; activity -> first
   open slot; slot -> first activity). Default: yes.
4. **Text size follows the browser and OS; no rem conversion and no in-game text control before the
   beta.** Default: yes.
5. **No in-game reduced-motion toggle.** A "Calm motion" switch in the facilitator section of the
   menu would cost about 45 minutes (a `motion.ts` override plus `controller.setReducedMotion`), for
   NIH visitors who cannot change the laptop's settings. Default: no.
6. **Screen-reader support level for the beta.** Default: build S1 if time allows after K1, K2, M1,
   K3; it is the first thing cut.
7. **Does the patient tester, or anyone expected at NIH, have a known need** (low vision, limited
   dexterity, a screen reader, motion sensitivity)? Default: unknown; if yes, that need moves its
   slice to the front.
8. **Add one line on keyboard play to B8's printed "how to demo" sheet** ("Tab to the board, arrows
   and Enter; 1-3 pick a swarm; E ends the turn"). Default: yes.
9. **Windows High Contrast, zoom beyond 200% and shortcut remapping wait until after the beta.**
   Default: yes.

## 12. Summary

Keyboard is the core of B7. The battle board becomes one focusable control with a cursor: arrows
move it, Enter does what a tap does, and number keys pick swarms. Tab goes back to the browser,
which also fixes today's dead end on the outcome card. Focus never strands on the page body,
keyboard picks move on to the next step, and `inert` keeps Tab inside open dialogs. Reduced motion
stops the idle drift, pulses and bobbing that still run. Grayscale and red-green are a check with a
small fix budget, since B1a designed for them. Text size follows browser zoom and the OS, with no
rem conversion. Screen-reader work starts with live regions that stop repeating themselves, then a
board that speaks the tile under the cursor.

Slices: K1 3.5h, K2 1.5h, M1 1h (the 6-hour minimum), then K3 1.5h, S1 2.5h and V1 1.5h, about
11.5 hours in all. Cut S1 first, then the text-scale fixes, then K3's extras.

Questions 1 to 9 above each have a default.
