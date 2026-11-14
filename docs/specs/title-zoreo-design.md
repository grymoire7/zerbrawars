# Title screen redesign and Zoreo the mascot (design)

Status: approved direction 2026-11-14 (Tracy), after an Opus design and code review. Written as the brief for an Opus design pass (design only; the coordinator builds).

## 1. Intent and why

The title screen is flat, monochrome text and buttons. It does not read as a game, let alone a fun one, and it is the first thing a demo audience sees. This redesign gives the game a face: **Zoreo**, a friendly zebra mascot, and a bright cartoon title scene that still feels like the same world as the board. Zoreo then returns as a small corner head on the game screen, where he looks shows the phase (life choices or board moves).

Audience is unchanged: patients 13+ with rare immune diseases, plus a clinical demo audience. Tone: friendly, loveable, hopeful, and fun first. A water fight is something kids recognise instantly, and it says "fun" more directly than anything else on the screen.

## 2. Goals, non-goals, anti-goals

Goals

- A title scene that reads as a game at a glance: character, colour, a sense of play.
- Zoreo is the focal character, reusable on the title and the game screen.
- The scene does not clash with the board's look (soft corners, bright, glossy, organic).
- Zoreo is built so blinking and later animation need no redraw.
- Zoreo's gaze directs the player's attention to the right part of the screen for the current phase ("the audience looks where you look").
- Works on laptop and phone (portrait and landscape).

Non-goals

- Player-chosen stripe colour or any saved Zoreo setting.
- A title that renders without WebGL. The app probes WebGL at startup (`src/app/boot.ts`) and shows the existing "no WebGL" message instead of mounting anything; that stays as it is. The title's own art does not use WebGL.
- Redoing the in-game dark UI palette. The bright look applies to the title scene only.
- A full animation set (post-demo): reactions, ear flicks, outcome cheers, the swarm stream.

Anti-goals (a failure even if it technically works)

- Zoreo looks tough, angry or menacing. He is a war horse "only of necessity, not by nature".
- Any depiction of procedures, needles or clinical treatment (memory: simplify treatment, avoid trauma). The water gun is a toy.
- A gun aimed at the viewer. Hard rules: it points up and left toward the germs, and it keeps the orange toy tip.
- Germs on or inside Zoreo. Germs stay on the far side of the scene so the art never suggests the patient's body is infested.
- Germs that are gross or that trivialise the disease. They are silly-grumpy: round, soft, no teeth or gore.
- A rasterised Zoreo.

## 3. Constraints

- Plain DOM and TypeScript; no new framework. Vite, relative asset URLs (`base: "./"`).
- Demo is about a week out; demo devices are the dev laptop and Tracy's phone over cellular, so assets stay small (inline SVG, no large images, no new font downloads).
- Colour comes from `src/theme/palette.ts` tokens; new scene colours are added there. The palette test (`palette.test.ts`) only checks a hand-listed set of text tokens against `bg`, `surface` and `raised`, so any new text-on-surface pair must be added to it by hand.
- Menu text is `--zw-text` (light grey) and fails on a bright scene, so the menu card gets its own solid, rounded, dark surface (opaque, not translucent, so 4.5:1 holds over moving art). The scene never carries text.
- Reduced motion: honour `calm()` in `src/render/motion.ts`, which also covers `?still=1`, not just the CSS media query. CSS loops hang off a root class driven by `calm()`.
- Decorative SVGs (title scene, corner head) are `aria-hidden="true"` and `focusable="false"`, outside the dialog's tab order. The card keeps first focus (`menu.ts`). The facing is a redundant cue (the screen already says what phase it is), so it needs no text equivalent.

## 4. Approaches considered

1. **All inline SVG, layered groups (chosen).** Zoreo, gun, volley and each germ are separate groups; CSS handles the flip, slide, blink and entrance. Cheap, crisp on phones, parts can be animated later.
2. **Zoreo in SVG, germs live from the 3D renderer.** Matches the board exactly but is heavier on phones. Rejected.
3. **Everything in WebGL.** Pays off only for depth effects the title does not need, and makes blink and head turn harder. Rejected.
4. **Raster or AI-generated art.** Rejected by Tracy.

The germs are procedural spheres and spikes in `src/render/pathogenView.ts`, so redrawing them in SVG is low risk. Cost: a second copy of the look that can drift. Accepted. Use the same colour tokens (`strep`, `staph`, `aspergillus`).

Layout alternatives considered: the reviewer proposed a vertical stack (wordmark, scene band, card) instead of a card over the scene. Rejected by Tracy because it risks scrolling to reach the menu. The card overlays the scene.

## 5. Decisions (Tracy's)

- Name **Zoreo**. Head and neck only, drawn in **three-quarter view** with large, clear pupils so where he is looking reads at 60 px.
- Friendly and loveable; a war horse by necessity, not nature. A companion and guide to the player, not the player.
- One vivid colour stripe along the neck (rare-disease zebra convention), fixed, contrasting the white coat. Starting point: a deeper blue related to the swarm blue. The pale swarm token is only about 1.5:1 on white and fails the grayscale check, so Opus proposes a deeper shade.
- Title scene is cartoon: soft corners, bright colours; references `tmp/cartoonfeel01-04` give the feel, not a template.
- Composition: Zoreo on the right with a toy water gun (references `tmp/watergun01-03`: chunky plastic, big rounded tank, orange nozzle) firing neutrophil swarms toward germs on the left; a few swarm companions at Zoreo's side if there is room; the menu card overlays the scene.
- Opening beat (optional, not required for the first cut): Zoreo pops up and fires one volley into the air that freezes mid-arc as the animation ends, with a blink. The volley arcs above the card and never crosses text. Reduced motion shows the final frame.
- Zoreo blinks (an occasional blink; it also reinforces where he is looking).
- Zoreo's head is in the upper right of the game board, same artwork, smaller. **Gaze is the phase cue**: toward the side panel for life choices, toward the board for board moves ("the audience looks where you look"). The turn is a flip with a blink timed to land as the head turns.
- The part of the board a corner head covers is not usable in that phase, so covering it is fine.
- Phone portrait (panel is below the board): no flip. In battle the head sits at the board's upper right, looking down and left into the board. In life it slides to the board's lower-left edge, same pose, looking down and left at the life panel below. A short slide also draws the eye.
- Built as SVG with named groups, not a raster image.

## 6. My calls (check these)

- Scene appears on the title and the arc picker; other menu cards (arc intro, arc-complete, replace-confirm) stay plain. Reason: the title and picker are the only places a player lingers and chooses. `mountMenu` serves all of them (`menuScreens.ts`), so the scene is a small opt-in layer added for those two.
- The scene is a fixed layer behind the card (sibling, not inside the scroll container), so a short phone scrolls the card and the art stays put. `createMenu` has one opaque backdrop that is also the scroll container, so this needs a small `menu.ts` change; "no new menu logic" means no flow changes, not no API change.
- One shared `Zoreo` module with inputs: gaze (`"panel" | "board"`) and size. The title uses a large version and the corner a small one. The gun and volley are title-only props.
- Named groups in the SVG: `head`, `neck`, `mane`, `ears`, `eyes` (pupils and `lids` separate), `stripes`, `neck-stripe`.
- Facing is a pure function `(screen, subMode, layout) -> gaze | hidden` in `src/app`, unit tested, not a CSS class. Phase has no single signal: it is whichever screen is mounted (`mountLife`, `mountBattle`, `mountInterlude`), and the `#app.life` class is also set by the interlude and summary screen (`interludeScreen.ts`), so it must not be used. Mapping: life = panel; battle (including playback and the Arc 1 tutorial battles) = board; interlude and summary = hidden.
- The corner head lives inside `#board` (`position: relative`) with `pointer-events: none`, so it does not catch canvas taps, and it avoids the brought-items strip (`broughtStrip.ts`, top of the board) and the Menu button (top left). Not in the fixed `#ui` layer.
- Phone landscape uses the laptop rule (board left, panel right), so the corner is the upper right of the board and the gaze flips as on laptop.
- On a short phone in landscape the title card can show up to five items and already scrolls; the scene is allowed to lose Zoreo's companions and shrink before the card loses anything. The card is never pushed off-screen by the art.
- The three.js render loop keeps running behind the title today (`main.ts`). If title animation costs frames on the phone, pause rendering while a menu is up. Left to the builder.

## 7. Scope and cut line for the demo

Must have

1. Zoreo SVG (three-quarter head and neck, deeper-blue neck stripe, friendly face, blink-ready groups) in the shared module.
2. Title scene and arc picker scene: bright backdrop, Zoreo with the water gun on the right, a few germs on the left, the card over it. Laptop, phone portrait and phone landscape layouts that do not overflow or crowd the buttons.
3. Corner head wired to phase with the screen-to-gaze function, including the portrait slide.
4. Contrast, `aria-hidden`, and reduced motion respected.

Nice to have (if time)

- The opening beat: pop-up, frozen volley, blink.
- The phase-change blink and an idle blink.
- Swarm companions at Zoreo's side.

Post-demo

- Animated swarm stream and hit pop, germ wobble, reactions and other animations.

## 8. Left to the builder

- Exact artwork: Opus proposes two or three rough Zoreo head directions first (silhouette, stripe pattern, eye style, three-quarter pose) for Tracy to react to; only then the full scene.
- Layout numbers and breakpoints (the wide layout switches at `min-width: 900px` or `min-aspect-ratio: 5/4`, `index.html`), and how the portrait slide is positioned.
- Final tokens and their values; test pairs for new text-on-surface tokens.

## 9. Verification (REQUIRED before calling it done)

- `mise run check` passes, including a unit test for the screen-to-gaze function.
- Looked at by eye, with screenshots, at laptop width, phone portrait and phone landscape: nothing overflows, the menu buttons are tappable and readable, art is not under the buttons.
- The corner head turns on a real phase change (life to board and back) in Arc 1 and a normal week, and slides in portrait. Hidden on the interlude and summary.
- With WebGL disabled the existing "no WebGL" message still appears (unchanged).
- Reduced motion (the OS setting and `?still=1`) shows no looping or entrance animation.
- Grayscale check: the title is still readable and the stripe still reads against the white coat.

## 10. Open questions

- None blocking. Zoreo's exact face and the stripe shade are settled by the Opus sketches and Tracy's reaction.
