# Changelog

All notable changes to Zebra Wars are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-11-14

### Added

- **A new title screen.** The plain text menu is now a bright, glossy
  cartoon scene: Zoreo the zebra pops out of a hole in the board with a
  toy water gun and fires a volley of blue immune cells at three grumpy
  germs, while the menu sits on a solid dark card in the middle. It shows
  on the title and the arc picker, and fits laptop, phone portrait and
  phone landscape. With reduced motion (or `?still=1`) it is a still
  picture.
- **Zoreo in the corner of the game.** A small Zoreo sits at the board's
  upper right and looks where you should: at the side panel when it is
  time to plan your week, and at the board when it is time to move
  swarms. In phone portrait he slides to the board's lower right to look
  down at the panel. He blinks now and then, and is hidden on summaries.

### Changed

- The brought-items strip on a fight now stops short of the corner Zoreo,
  and uses the real side panel width in the wide layout.

## [0.1.1] - 2026-11-14

### Added

- **Reduced motion.** With "Reduce motion" turned on in the operating
  system (or `?still=1` in the address), the board stays still while you
  plan a turn: swarms, germs, cargo and the idle-swarm mark no longer drift,
  bob or pulse, and the engulf shake in a replay is gone. Turning the
  setting off brings the motion back without a reload.
- **A calm message when WebGL is missing.** If the browser can't start the
  game's graphics, you now see a short explanation and a Reload button
  instead of a blank page.
- **`mise run demo`.** One command builds if needed, serves the production
  build on port 4173, keeps the Mac awake, and opens the page in the "Zebra
  Wars" browser profile. It prints the phone address too. See
  `docs/demo-sheet.md` for the printed one-pager.
- **Documentation for testing and review.** A facilitator guide for the
  patient session (`docs/patient-session.md`), a printable clinician
  questionnaire (`docs/specs/clinician-brief-nih.md`), and a design for the
  accessibility pass that comes after the demo
  (`docs/specs/b7-accessibility-design.md`).

### Changed

- **A wider side panel on landscape and desktop.** The panel now takes
  about 45% of the width on a phone in landscape (up to 480px on a large
  screen), so the status cards and turn row fit on fewer lines.
- **More room to scroll on short landscape phones.** End Turn and Replay
  last turn share one row, and the hint strip is tighter, so the scrolling
  part of the panel is about two items tall instead of one.
- **A pink glow shows when a panel has more to scroll.** It uses the
  board's tissue pink and fades out when you reach the end. Browsers that
  don't support scroll-driven animation simply don't show it.
- **The "hover x,y selected" readout is hidden from players.** It shows
  only with the developer debug panel.

### Fixed

- **The battle How to play popup no longer repeats.** Arc 1 now counts as
  having shown it, so it doesn't pop up again at the first fight in Arc 2.
  Someone who goes straight to Arc 2 still sees it once.
- **The release checks no longer time out on a slow build machine.** The
  long campaign simulation tests now have 30 seconds instead of 5, so the
  deploy workflow doesn't fail when the shared runner is slow.

## [0.1.0] - 2026-11-13

### Added

- **The first playable beta.** A title screen with a disease picker (X-linked
  and autosomal recessive CGD, and a greyed Wilson's disease entry), an arc
  picker, and two story arcs.
- **Arc 1, "First infection."** A short tutorial in two fights, before and
  after diagnosis, with a coach that introduces one idea at a time.
- **Arc 2, "A first summer."** Two weeks of living with CGD: plan each day,
  take your medicine routine, and fight whatever comes home. It ends on a
  summary with a best score per disease type.
- **Battles on a map of the lungs.** Swarms of neutrophils move, engulf
  germs, use medicine charges and wall off swallowed germs. Telegraphed
  germ actions show what happens next, and missed doses make arrivals
  bigger.
- **Real organism names everywhere**, with plain descriptions.
- **A draft closing screen** about curative options, marked "pending
  clinical review" and hidden with `?epilogue=0`.
- **Phone and touch layout**, a game menu, and a back and reload guard.
- **Facilitator mode** (`?facilitator=1`): a prediction probe, a "brought in"
  strip, session log export and copy, and Reset for a new player.
- **A deploy workflow.** Pushing a version tag runs the checks and uploads
  the build to the hosting server.
