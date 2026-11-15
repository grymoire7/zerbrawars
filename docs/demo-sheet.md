---
# Guide for demonstrating the Zebra Wars game
# Convert with:
#   pandoc -f markdown+raw_tex -o demo-sheet.pdf demo-sheet.md 
#
header-includes:
  - \usepackage{graphicx}
  - \usepackage{geometry}
  - \pagenumbering{gobble}
  - \geometry{margin=1in}  # Sets all margins to 1 inch
---

# Zebra Wars: how to demo

One page, meant to be printed. The demo laptop is the dev laptop. The phone is Tracy's phone.

## Before you leave

- Plug the laptop in and charge the phone.
- In Brave, check that the **Zebra Wars** profile opens to a clean title screen (no Continue button).
- Run `mise run demo` once at home and play a turn. If it works there, it works anywhere.
- Hosted address for the phone: https://zebrawars.com

## Start it (laptop, about 10 seconds)

1. Open Terminal in the `zebrawars` folder.
2. Run `mise run demo`.
3. Brave opens in the **Zebra Wars** profile on the title screen. No network needed.

The Mac stays awake while the demo runs. Leave the Terminal window open.

## During the demo

- **Arc 1, "First infection"** is the short tutorial. Start there with a new
  person.
- **Arc 2, "A first summer"** is the full game: pick activities for the week,
  then fight what you caught.
- Keyboard shortcuts in a battle: Enter ends the turn, Space skips the replay,
  Escape clears a pick (or opens the menu), W walls off.
- The menu button (top left) has How to play, Start this fight over, Start this
  summer over, Choose another arc and Change disease.

## Next person

A summer in progress is kept when you leave it, so the next person would find
it waiting. For a clean start, open the game at
`http://localhost:4173/?facilitator=1`, open the menu, and choose **Reset for a
new player**. It clears best scores, first-time help and any arc in progress.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| A message about graphics acceleration | Turn on "Use graphics acceleration" in Brave's settings, then press Reload. Or open the same address in Chrome. |
| The page is blank or frozen | Reload the page (Cmd+R). |
| `mise run demo` says the port is busy | Run `lsof -ti tcp:4173 \| xargs kill`, then run it again. |
| Terminal command not found | Open a new Terminal window in the `zebrawars` folder and try again. |
| The laptop is dead or acting up | Use the phone. It loads the hosted site and works on cell or wi-fi. |
| Both are down | Show the phone screenshots (take two or three before you go). |

## Phone

Open the hosted address in the phone's browser. It plays in portrait. Tap an
activity, then tap a time slot. Cell signal and the clinic wi-fi both worked in
the past.

## Shut down

Press Ctrl-C in the Terminal window. That stops the server and lets the Mac sleep again.
