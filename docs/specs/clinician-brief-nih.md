# Clinician brief for the NIH visit

Eight of the A-priority items from `clinician-questions.md`, written so one person can answer them in
about fifteen minutes after playing Arc 1 and a week. The full list (31 items) is in that file. The
plan names these eight as the ones to settle before the demo. Five more are also tagged A in that
file (4, 5, 7, 8 and 21), so they're listed at the end for when there's time.

Everything here is a working assumption until a clinician says otherwise. Two items have a
patient-side answer from our adult tester (dated 2026-11-08). That is anecdote, not a clinical
answer.

## How to use this

1. Let them play Arc 1 (the tutorial) and one week of Arc 2 first. Most of the questions are easier with the screen in front of them.
2. Read each item out, show where it appears, and note their answer next to it.
3. For each "No" or "Partly", write down the wording they would accept. We change the copy to match.

## The eight items

### 1. Residual kill chance (gameplay)

**Ask:** What chance should a cell have of killing a sealed germ (one that resists the usual kill) on its own? Is one number per character a fair simplification?
**We assume:** about 10% for X-linked and 25% for autosomal recessive. The 25% is our guess, from the idea that some oxidase activity remains.
**Where it shows:** Arc 1 part B and every Arc 2 fight. It sets how often cells finish a sealed germ without medicine.
**If the answer is no:** we change the two numbers (one line each) and rebalance.

### 2. Which germs, which organ (gameplay)

**Ask:** Which organisms most often infect which sites? Is splitting germs into "leaky" and "sealed" a fair basis for the pairings we show?
**We assume:** lung first, then lymph node, liver and skin. The pairings are our guess.
**Where it shows:** the germ names on the board, the Key, and which germs come after which activity.
**If the answer is no:** we change the germ list and pairings.

### 9. The parts of the immune system that still work (copy)

**Ask:** Macrophages and monocytes are also affected in CGD. Can we use NK cells, T cells and antibodies as the examples of parts that still work in virus fights?
**We assume:** yes, and no more than those three.
**Where it shows:** nowhere yet. No current text names them. This guards future copy, and the "one tool" line in item 24.
**If the answer is no:** we avoid naming any other cell.

### 20. Diagnosis and the first game screen (copy)

**Ask:** How varied is the road to diagnosis (X-linked often early, autosomal recessive sometimes much later)? Is the opening framing fair?
**We assume:** "Before anyone knew", in the second person, and the player can skip it.
**Where it shows:** the first thing a new player sees in Arc 1.
**If the answer is no:** we change the intro and skip text.

### 23. A first lung infection (copy and gameplay)

**Ask:** Is a first serious lung infection, where cells arrive and swallow germs but can't finish a mold, a fair picture of how CGD is often found?
**We assume:** yes, as one common story that isn't everyone's. Our tester agrees, adding that CGD is often first suspected from repeated or severe infections, usually in the lung or the liver.
**Where it shows:** Arc 1 part A.
**If the answer is no:** we swap the organism or the site, or soften the framing.

### 24. "CGD takes one tool away" (copy)

**Ask:** Is "CGD takes one tool away, not your whole defence" acceptable for a patient, given that macrophages and monocytes are also affected?
**We assume:** yes, with no claim about which other cells are fine. Our tester says it's fair: CGD doesn't put you in a bubble, but it removes one of the tools the immune system uses.
**Where it shows:** the end of Arc 1 part B: "Same germs, different ending. CGD takes one tool away, not your whole defence, and your medicine helps fill the gap."
**If the answer is no:** we reword that line.

### 27. Exposure percentages (copy)

**Ask:** The game shows an exposure chance for each activity (for example 45% for yard work, 10% for indoor jobs). Could a patient read these as real risk figures?
**We assume:** they're acceptable when labelled as game odds. The relative order is what matters.
**Where it shows:** the life screen, next to every activity. The week odds text says: "These are game odds. Your medicine does not change them; it helps your cells in the fight."
**If the answer is no:** we drop the percentages for bands such as "low, medium, high" or add a stronger label.

### 28. Choices change the odds, not the outcome (message)

**Ask:** The game says choices change the chance of an infection, and "Some fights are just hard": a careful week can still bring a germ home. Is that the right message for teens, and could it make precautions feel pointless?
**We assume:** it's the right message, because the score still rewards lowering the odds and the odds visibly move.
**Where it shows:** the end-of-week line "Your plan and your routine were strong. Some fights are just hard." and the score's split between choices and outcome.
**If the answer is no:** we change the message and how the score frames luck.

## Also tagged A in the full list

Ask these if there's time. They're about game mechanics and exposures more than the copy a player reads.

- **Item 4:** is "over-committing cells to one spot raises local inflammation" a fair simplification of granuloma formation? Also, does colitis have a genetic component beyond infection?
- **Item 5:** is "swallowed but unkilled infections persist and flare later" a fair picture of latent infections? In the game they're hidden reservoirs that surface as fever, pain or tiredness.
- **Item 7:** what patients are told about fever. The game must never teach dismissing one.
- **Item 8:** whether our "smarter third options" (indoor chores, skipping the lagoon, skipping the cave) are valid, and which exposures matter most.
- **Item 21:** does prophylaxis help cells finish germs they've already swallowed, and how strongly? Is "medicine keeps germs small when they arrive" accurate wording for what a missed dose does?

Lower priority but relevant: item 29 (the game says daily prophylaxis doesn't change whether a germ arrives, only how hard the fight is) and items 14 to 17 (the epilogue's claims, which matter only if the epilogue stays in the build; `?epilogue=0` turns it off).

## What we need back

A yes, no or partly for each of the eight items, and the wording they would accept for any "no" or "partly". One page of notes is plenty. Then we change the working assumptions and the copy, and update the status column in `clinician-questions.md`.
