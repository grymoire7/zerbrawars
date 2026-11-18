# Changelog

All notable changes to Zebra Wars are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.4.0] - 2026-11-18

### Added

- Each week now deals its own hand of activities. Week 1 is unchanged; week 2 has band
  practice, green woodworking with Dad, the crawlspace, the gift flytrap and the senior trip.
- Four new activities, each with a risky and a smarter version: green woodworking (dry wood
  outdoors is smarter), the crawlspace for the soccer ball (use a rake), the gift flytrap (keep
  it in the garage) and "Leave for Vietnam" (make a travel plan).
- A new germ, Burkholderia, brought by the trip. It is a sealed bacterium drawn as a rod, so
  engulfing only contains it and a full week of antibacterial charge finishes a small one.
- The trip can only go in the evening of day 3, so nothing is scheduled after leaving. The card
  and the placement message say why.
- A charge now arrives as a pill that arcs from Zoreo's mouth onto the germ. A germ it kills
  squashes, hops and vanishes. The old drop from above is the fallback when Zoreo is not on
  screen.
- A quiet fight now says what it is waiting on.

### Changed

- The battle button "End Turn" is now "Play Turn", since the turn plays out after you press it.
- The charge buttons now say what they do: "Kill bacteria", "Kill mold" and "Kill any".
- The "spread" and "stalled" labels on the board are gone, since the yellow arrow and the pause
  sign already say it, and the key card explains them. The dose label is gone too, apart from
  "load cleared".
- The closing screen now says the conditioning for a transplant or gene therapy is arduous and
  the recovery long, rather than the whole process, and "nearly 70 percent" to match the
  clinician handout.

### Fixed

- The battle bar keeps the same height while a turn plays, so the board no longer bounces up
  and down. It was most noticeable on a phone.

## [0.3.0] - 2026-11-15

### Changed

- The board now sits on the title screen's teal sky (light rays and bubbles), which
  also shows behind the battle bar.
- Battle controls (charges, Wall off, End Turn, Replay, speed and Skip) now sit in a bar
  under the board instead of the side panel, a rounded blue tray with colour-coded buttons. Tapping a swarm again cancels its order;
  there is no hold order, coordinates or per-swarm Clear. The Orders card is a closed
  "Swarm orders" list.
- The "Week 1 · Day 1 of 3" bar is gone. The calendar card is titled "Week 1" and the
  current day is highlighted in its table (How to play is in the Menu).
- The side-panel Medication card is gone; the Medication meter in the status
  bar now shades from green to red as a full set of doses gets less likely,
  and tapping it names the days at risk.
- "Pack the pills" is gone. After a sleepover there is a 30% chance the pills
  are left behind and the next morning's dose is missed, rolled when the day is
  played (never shown beforehand, and the same on a replay of that day).

## [0.2.1] - 2026-11-15

### Changed

- The picker now says "Choose your disease" and the menu and end-of-arc
  button say "Change disease", instead of "character".
- The title tagline is now "Live your life, manage your disease, win the
  day.", so it fits diseases that are not about infections.

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
