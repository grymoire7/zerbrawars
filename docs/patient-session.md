# Zebra Wars: patient session guide

For the facilitator (Tracy). This is the script for the playtest with the adult CGD tester. It
builds on section 6 of `plans/prototype-plan.md`, updated for the beta: there are now two arcs, a
menu, and a facilitator mode.

One tester is a weak signal. Treat what they say as a story you listen to, and use the session log
to check it. Don't treat either as a verdict.

## What we want to learn

1. **Can they read a turn?** Before they press End Turn, do they know roughly what will happen?
2. **Is the week a real choice?** Do they pick between safer and riskier cards, or just grab the safest one every time?
3. **Do they connect life to battle?** Can they say why the fight went the way it did?
4. **Tone.** Does anything feel scary, preachy, unfair or wrong for someone who actually lives with this?
5. **Two open balance questions.** Is the week too easy? Does a careless week need backup too often (about half of careless battles do right now)?

## Before they arrive

- Charge the laptop and the phone. Decide which device they will use (a laptop is the safe default).
- Use the **Zebra Wars** Brave profile, and start with `mise run demo` (see `demo-sheet.md`).
- Open the game at `http://localhost:4173/?facilitator=1`. Nothing looks different on the title or arc screens. The flag only adds a "For the facilitator" block to the in-game **Menu** (the button in the top left corner of the life and battle screens), and it is read once when the page loads. If you add it to a page that is already open, reload the page.
- The Menu doesn't exist on the title screen, so choose a character, pick **Arc 2**, press Begin, and open the Menu there. Scroll to **For the facilitator** and choose **Reset for a new player**. That clears best scores, first-time help and any held summer, so the next screens look new.
- After the reset, start again the way the tester will: character, then Arc 1. Open the Menu once more and set the switches: tick **Prediction probe on turns 2, 4 and 6** (it starts off). **Show what you brought in** starts on, which is right for the first run. (Untick it for a second run if you want to see whether they link life to battle without the hint.) Check that both switches still look the way you set them before the tester sits down.
- Close the Menu with Keep playing, then go back to the title (Choose another arc or Change character in the Menu) and leave the laptop there for the tester.
- Have a notepad. Don't record names or anything that identifies them. The log collects none, and your notes shouldn't either.

## Opening (say this, roughly)

> "This is an early version of a game about the immune system. You're the immune cells. I'm testing
> the game, not you, so nothing you do is wrong. Please think out loud as you go: what you're
> looking at, what you expect, anything that confuses you or bugs you. If something feels off or
> uncomfortable, say so and we'll stop. I won't explain much, because I want to see what the game
> explains on its own."

Then one sentence, and only this one: **"You're the immune system. The arrows show what the germs will do next."**

Choose a character (X-linked or autosomal recessive) the way they would in real life, or let them pick. Note which.

## During the play

Sit beside them, not in front. Say as little as you can.

- Start with **Arc 1, "First infection"**. It's the tutorial.
- Then **Arc 2, "A first summer"**: plan the week, play it, fight.
- If they get stuck for more than about 20 seconds, ask "What are you looking at?" before you help. Write down where they got stuck.
- **Prediction probe:** on turns 2, 4 and 6 of a battle, a small box asks what will happen when they end the turn. Let them answer in their own words. Don't react to the answer. The game doesn't score it, so jot down on your notepad what they said and whether it came true (right, wrong or partly).
- If you need to leave a run or start over, use the menu. Because of the facilitator flag, it offers to export the log first. Say yes.

### Things to watch, and write down

- Where they pause, squint, or say "wait, what?".
- Which week choices they make, and whether they read the odds.
- Whether they skip or fast-forward playback (a lot of skipping means the replay is dull or too long).
- Anything they say that sounds like "the right answer is...". That means the week feels like a quiz.
- Whether the week felt too easy, and whether they noticed missed doses, backup, or the Exposure cell at all.
- Anything they say about how it matches or doesn't match their own life.
- Any sign of the two bugs we couldn't reproduce: End Turn not clicking until all swarms move, and a stray "the week is not over" error. Write down the exact steps if either shows up.

## After the play: questions

Ask these in order. Write down answers close to word for word.

1. "Before you ended that turn, what did you expect to happen? Did it?"
2. "When you saw the spiky one, what did you want to do with it, and why?" (Listen for trade-offs: "if I grab it my swarm slows down, but if I leave it it spreads.")
3. "Why did the second fight go the way it did?" (Listen for them naming a choice from the week without being prompted.)
4. "If you played another week, what would you do differently?"
5. "Does any of this look or feel like what happens to you? Was anything scary, preachy or unfair?"
6. "Was there a number or word you didn't trust?" (The exposure percentages are game odds, not real risk figures. Clinician item 27 is still open, so listen for how they read them.)
7. "What would you change first?"

If they say anything felt scary or blaming, that comes before everything else. Stop adding features until it's fixed.

## Saving the log

1. Open the menu, go to **For the facilitator**, and choose **Export log** (it saves a JSON file to the browser's Downloads folder), or **Copy log** to paste it somewhere.
2. The title screen also offers **Export log** for a held summer.
3. Rename the file with the date and a session number (for example `session-2026-11-16-1.json`) and move it into a local folder that is not in the repo. Don't commit it.
4. The log holds no names or identifiers. Share it only if the tester agrees.

## After: what to look at

The log (`schema: 1`) records the seed, each card choice, doses, exposures, each turn (orders, planning time, skips and replays), each probe answer as text (its `correct` field is always empty, so score them from your notes), each outcome and a final summary. Look for these signals (thresholds are rough):

| Signal | Rough threshold | Likely meaning |
| --- | --- | --- |
| Probe accuracy (scored by you from your notes) | under 60% after the first battle | The telegraph isn't clear |
| Skip or fast-forward | on more than 70% of turns by battle 2 | Playback is too long or dull |
| Planning time per turn | usually under 3 s or over 60 s | No decision, or too much to read |
| Safest card every time | the same pick across the week | The week isn't a real choice |
| Attribution | can't name a life choice that shaped the fight | The life-to-battle link isn't clear |
| Wants another go | less than half the time | Not fun yet |

Then decide the **top three issues**: fix them if they're small, or write them in the plan's open list if they're not. The two balance questions (week difficulty, backup rate) get an answer here too: raise or hold each, with a note on why.

## If something goes wrong in the room

- Page frozen: reload it (Cmd+R). The run is lost, so note where it happened.
- The game feels off to them: stop and ask, don't push through.
- They're tired: stop after Arc 1 and the first week. A short good session beats a long bad one.
