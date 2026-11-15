---
# Clinician questionnaire
# Convert with:
#   pandoc -f markdown+raw_tex -o clinician-brief-nih.pdf clinician-brief-nih.md
#
header-includes:
  - \usepackage{graphicx}
  - \usepackage{geometry}
  - \usepackage{newunicodechar}
  - \newunicodechar{☐}{$\square$}
  - \pagenumbering{gobble}
  - \usepackage{needspace}
  - \let\oldsubsection\subsection
  - \renewcommand{\subsection}{\Needspace{15\baselineskip}\oldsubsection}
  - \newcommand{\writelines}{\par\vspace{0.7cm}\noindent\rule{\textwidth}{0.4pt}\par\vspace{0.7cm}\noindent\rule{\textwidth}{0.4pt}\par\vspace{0.4cm}}
  - \newcommand{\writeone}{\par\vspace{0.7cm}\noindent\rule{\textwidth}{0.4pt}\par\vspace{0.3cm}}
  - \geometry{margin=0.5in} # Sets all margins to 1 inch
---

# Zebra Wars: questions for a clinician

Prepared by: ________________________________ Date: ________________\
Contact: ________________________________

Thank you for looking at these. Zebra Wars is a small game that helps people with chronic granulomatous
disease (CGD) picture what happens inside their body. We are not clinicians, so we simplified, and we
want to know where the simplifications are fair and where they are wrong or could mislead a patient.

**You don't need to have played the game.** Each question says what the game does, in plain words.
Nothing in the game is meant as medical advice, and a note on the closing screen says so.

## How to answer

- Most questions are a tick or two. Add a few words if you like.
- Skip anything you can't speak to. "Can't say" is a useful answer too.
- **Please do the A questions first.** We'd like those before the game is shown more widely. B questions come later, and C questions can wait.
- If you would word something differently, write the wording you would accept. We'll change the game to match.

Two kinds of answer row come up often:

- When we describe **what the game shows or does**, tick: ☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say
- When we show **wording the player reads**, tick: ☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

Other questions list their own options.

## About the game, in one paragraph

The players are patients aged 13 and up. The game alternates between two parts. In the first, a
patient plans a week of ordinary life (yard work, a lake day, band practice, a sleepover), with a
daily medicine routine running in the background. Each choice changes the odds that a germ comes
home with them. In the second, a fight takes place on a map of the lungs. The player moves groups of
neutrophils and tells them to engulf germs. There are two types of CGD, X-linked and autosomal
recessive (p47phox), and two short story arcs: "First infection" (a tutorial, told first before
diagnosis and then after) and "A first summer" (two weeks of living with CGD). The game has three
organisms so far: Streptococcus, Staphylococcus aureus and Aspergillus.

## Game words

Players see plain words, not lab terms. This brief uses the clinical term and gives the game word once.

| Game word                                         | What it stands for                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Leaky germ                                        | a catalase-negative organism (in the game, Streptococcus). Engulfing it kills it.                              |
| Sealed germ (shown with a pale ring on the board) | a catalase-positive organism (in the game, Staphylococcus aureus and Aspergillus). Engulfing only contains it. |
| Swarm                                             | a group of neutrophils the player moves                                                                        |
| Charges                                           | the antibacterial, antifungal and strong doses that come from taking medication                                |
| Granuloma                                         | a blocked tile where a swarm walls off a swallowed germ                                                        |
| Carrying forward (on the fight's result card)     | a swallowed germ that wasn't killed and may surface later (the code calls it a reservoir)                      |
| Exposure                                          | the chance, shown as a percentage, that something comes home from an activity                                  |
| Size (on a germ in a fight)                       | how much of the organism has taken hold. A larger size is a bigger germ load.                                  |
| Game odds                                         | those percentages. They are game numbers, not real risk figures.                                               |

\newpage

# Group A: please answer these first

## A1. Residual kill chance

**Our picture.** In a fight, a cell that engulfs a catalase-positive organism has a small chance of killing it anyway. This is our stand-in for residual oxidase activity. We use one number per type of CGD. The tutorial's "before diagnosis" fight uses none at all. We drew on Kuhns et al., NEJM 2010.

**(a)** Is one number per type of CGD a fair simplification?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

**(b)** How do our numbers compare with a typical patient?

| Type of CGD | The game uses       | About right | Too high | Too low | Can't say |
| ----------- | ------------------- | ----------- | -------- | ------- | --------- |
| X-linked    | about 10%           | ☐           | ☐        | ☐       | ☐         |
| p47phox     | about 25% (a guess) | ☐           | ☐        | ☐       | ☐         |

If you can suggest numbers: X-linked ________ % p47phox ________ %

**(c)** The tutorial's "before diagnosis" fight uses no residual chance for either type, so the cells can't finish the mold. For a p47phox patient with some residual activity, is that an acceptable simplification for the pre-diagnosis picture?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

## A2. Germs, activities and sites

**Our picture.** Each activity in a week brings a particular organism. Every fight so far is on a map of the lungs.

**(a)** Are these pairings reasonable?

| Activity                                         | Organism it brings                      | Reasonable?            |
| ------------------------------------------------ | --------------------------------------- | ---------------------- |
| Yard work (mulch, dead leaves, compost)          | Aspergillus                             | ☐ Yes ☐ No ☐ Can't say |
| A swim in a warm, still lagoon                   | Streptococcus and Staphylococcus aureus | ☐ Yes ☐ No ☐ Can't say |
| Band practice, a sleepover, a crowded game night | Streptococcus                           | ☐ Yes ☐ No ☐ Can't say |

**(b)** We plan to add fights at the lymph node, liver and skin after the lung. Are those the right next sites?

☐ Yes ☐ Different order or sites (please say) ☐ Can't say

**(c)** Is splitting organisms by catalase status (negative, which a CGD cell can still kill, versus positive, which it can't) a fair basis for these pairings?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

\writeone

## A3. Inflammation

**Our picture.** Each tile has an inflammation level. It rises when swarms crowd together, when a loaded swarm stands still, near a visible germ, and where a swallowed germ has been walled off in a granuloma. High levels slow the cells and wear down tissue health each turn. Levels fade when the cause moves on.

Is "when too many cells pile into one spot, inflammation rises there" a fair simplification of granuloma formation?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

\writeone

## A4. Infections that persist

**Our picture.** A germ that was swallowed but not killed stays hidden, can grow, and surfaces later as fever, pain or tiredness. The fight's result card calls these germs "carrying forward".

Is that a fair picture of how latent infections behave in CGD?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

\writeone

## A5. Fever

**Our picture.** Any fever makes a doctor visit a good move. The doctor may find it was only a virus. In that case the game shows "Just a virus", with no fight that week. The game must never teach a patient to dismiss a fever.

**(a)** Is that picture fair?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

**(b)** What are patients usually told to do about a fever?

☐ Contact the care team for any fever\
☐ Contact them above a set temperature: ________\
☐ It depends on the patient\
☐ Can't say

\writeone

## A6. Exposures

**(a)** The game offers a safer version of some activities. Is each one valid?

| Riskier version        | Safer version                                 | Valid?                 |
| ---------------------- | --------------------------------------------- | ---------------------- |
| Yard work with mulch   | Indoor jobs while someone else does the mulch | ☐ Yes ☐ No ☐ Can't say |
| The warm, still lagoon | The open beach                                | ☐ Yes ☐ No ☐ Can't say |

**(b)** How much does each exposure matter for a patient with CGD? (Some are not in the game yet.)

| Exposure                             | Matters a lot | Matters a little | Doesn't matter | Can't say |
| ------------------------------------ | ------------- | ---------------- | -------------- | --------- |
| Mulch, compost, dead leaves          | ☐             | ☐                | ☐              | ☐         |
| Still or brackish water              | ☐             | ☐                | ☐              | ☐         |
| Caves                                | ☐             | ☐                | ☐              | ☐         |
| Scuba diving                         | ☐             | ☐                | ☐              | ☐         |
| Marijuana                            | ☐             | ☐                | ☐              | ☐         |
| Live trees (for example at holidays) | ☐             | ☐                | ☐              | ☐         |
| Reptile pets                         | ☐             | ☐                | ☐              | ☐         |

Others to add:

\writeone

## A7. Medicine and germs already swallowed

**(a)** Does antibacterial or antifungal prophylaxis help phagocytes finish organisms they have already swallowed (a germ that survives inside the cell)?

☐ Yes, a lot ☐ Yes, somewhat ☐ Little or not at all ☐ Can't say

**(b)** In the game, full daily doses add a modest boost (about 25 percentage points) to the chance that a swallowed germ dies each turn. Is that a fair game picture?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

**(c)** In the game, each missed dose before an exposure makes the infection that takes hold one step bigger: more of the organism gets established (a larger germ load). Is it fair that missed prophylaxis lets a larger infection take hold from the same exposure?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

\writeone

## A8. The parts that still work

**Our picture.** Macrophages and monocytes are also affected in CGD. When the player fights a virus, we would like to point to parts of the immune system that still work. No text names any yet.

May we name NK cells, T cells and antibodies, and no others?

☐ Yes ☐ Yes, and also: ________________ ☐ No, name none ☐ Can't say

\writeone

## A9. How CGD is found: the opening

**Our picture.** The tutorial opens with a flashback, "Before you knew it", in the second person. The player can skip it. A germ gets into the lungs and the cells rush in but can't finish it.

When is CGD usually diagnosed?

| Type of CGD | Infancy or early childhood | Later childhood | Adolescence or adulthood | Varies widely |
| ----------- | -------------------------- | --------------- | ------------------------ | ------------- |
| X-linked    | ☐                          | ☐               | ☐                        | ☐             |
| p47phox     | ☐                          | ☐               | ☐                        | ☐             |

\writeone

## A10. A first serious lung infection

**Our picture.** In the "before diagnosis" fight, the cells arrive and swallow the germs but can't finish an Aspergillus mold. The card says "Not finished". After diagnosis, the same fight ends well with medicine. We tell it as one common story, not everyone's.

Is that a fair picture of how CGD is often found?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

\writeone

## A11. "One tool away"

**The wording.** At the end of the "after diagnosis" fight, the card says: "CGD takes one tool away, not your whole defence, and your medicine helps fill the gap." Macrophages and monocytes are also affected, so we make no claim about which other cells are fine.

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

The wording you would use, if different:

\writeone

## A12. Exposure odds

**Our picture.** Each activity carries an exposure chance. They are game numbers, and a line near the week's odds says so: "These are game odds. Your medicine does not change them; it helps your cells in the fight."

| Activity                         | Game odds |
| -------------------------------- | --------- |
| Yard work with mulch             | 45%       |
| A swim in the warm, still lagoon | 45%       |
| The open beach                   | 15%       |
| Indoor jobs                      | 10%       |
| A sleepover                      | 10%       |
| Band practice                    | 5%        |
| A crowded game night             | 5%        |

**(a)** Is the order sensible for a patient with CGD? (The exact numbers are ours. The order is what matters.)

☐ Sensible ☐ Some should move (please say which) ☐ Not sensible ☐ Can't say

**(b)** Even with the label, could a patient take these percentages for real risk figures?

☐ Unlikely ☐ Possibly ☐ Likely ☐ Can't say

\writeone

## A13. The overall message

**The wording.** The game's message is that choices change the chance of an infection but not the outcome. After a careful week that still ends in a hard fight, it says: "Your plan and your routine were strong. Some fights are just hard." The score still rewards lowering the odds, and the odds visibly move.

**(a)** Is that the right message for teenagers?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

**(b)** Could it make precautions feel pointless?

☐ Unlikely ☐ Possibly ☐ Likely ☐ Can't say

\writeone

# Group B: before a wider release

## B1. Rare sites

**Our picture.** Not in the game yet. A future rare "surprise" fight would be clearly framed as uncommon, for example an infection of the spine or lower brain.

**(a)** How rare are infections at sites like these?

☐ Very rare ☐ Uncommon ☐ Not rare ☐ Can't say

**(b)** How could we frame them so they are relatable but not frightening? Tick any that would work.

☐ Say plainly that it is uncommon\
☐ Show the care team's help before the infection\
☐ Tell it as one patient's story, not a typical one\
☐ Leave it out of the game\
☐ Another way (please say):

\writeone

## B2. The "weapon you can steal" idea

**Our picture.** We keep it as a simplified picture: some germs leave a "weapon" a CGD cell can use, and others don't. Later studies suggest catalase status does not fully explain which organisms cause trouble. We would never state it as the complete story.

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

\writeone

## B3. Names for medicine

**Our picture.** The game says "antibacterial" and "antifungal". It names no drugs (for example TMP-SMX, itraconazole or posaconazole) and leaves out interferon-gamma.

**(a)** Is that wording acceptable?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

**(b)** Is it safe to leave interferon-gamma out?

☐ Yes ☐ No, it should be mentioned ☐ Can't say

\writeone

## B4. More organisms

**Our picture.** The game has Streptococcus, Staphylococcus aureus and Aspergillus. We are considering others. How common is each as a cause of infection in CGD?

| Organism                    | Common | Uncommon | Rare | Can't say |
| --------------------------- | ------ | -------- | ---- | --------- |
| Burkholderia                | ☐      | ☐        | ☐    | ☐         |
| Serratia                    | ☐      | ☐        | ☐    | ☐         |
| Nocardia                    | ☐      | ☐        | ☐    | ☐         |
| Granulibacter               | ☐      | ☐        | ☐    | ☐         |
| Chromobacterium             | ☐      | ☐        | ☐    | ☐         |
| Salmonella                  | ☐      | ☐        | ☐    | ☐         |
| Aspergillus nidulans (bone) | ☐      | ☐        | ☐    | ☐         |

Others that are common enough to include:

\writeone

## B5. Aspergillus in the tutorial

**Our picture.** The tutorial's first infection is Aspergillus in the lung, rather than Staphylococcus or Burkholderia. Streptococcus is the germ the cells do finish.

Is Aspergillus a fair organism for that first lung infection?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

\writeone

## B6. Medicine in the tutorial

**Our picture.** In the tutorial, daily medicine visibly slows germs and gives charges that finish a small mold. We present it as a game rule and never as fact.

Is that an acceptable game picture of antibacterial and antifungal prophylaxis?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

\writeone

## B7. Medicine and what arrives

**Our picture.** In the game, daily prophylaxis does not change whether a germ arrives, so the activity percentages are the same whether or not the player took their medicine. It makes the fight easier: the starting infection is smaller, germs grow more slowly, and the player gets charges that can finish small germs. Real prophylaxis lowers the chance an exposure becomes an infection.

Is the game's picture acceptable?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

\writeone

## B8. "Still sick"

**The wording.** Before diagnosis the tutorial ends with: "Infection: not finished. Your body is still sick." The next card goes straight on to: "The doctors helped your body clear it, and ran some tests. The missing tool had a name: CGD."

Is "still sick" fair and not frightening wording for that moment?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

\writeone

## The closing screen (B9 to B12)

After the summer, the game offers a short, hopeful screen called "What comes next". It is marked "Draft: pending clinical review", and we can switch it off. This is its entire text:

> Bone marrow transplant and gene therapy are real options for CGD. They keep changing, and the choice is made together with your care team.
>
> After one of them works, there is no more prophylaxis medicine, restrictions ease to what anyone else has, and the immune response is about normal.
>
> The process can be long and arduous, and it looks different for each person.
>
> Gene therapy does not have to correct every cell. In early results, roughly 20 to 30 percent corrected cells looked like enough, and one recent patient reached about 70 percent.
>
> This is information, not medical advice. Your care team knows your situation, so talk with them about anything here.

## B9. After a successful treatment

After a successful bone marrow transplant or gene therapy, is each statement accurate?

| Statement                                 | Accurate?                                          |
| ----------------------------------------- | -------------------------------------------------- |
| There is no more prophylaxis medicine     | ☐ Accurate ☐ Not always ☐ Not accurate ☐ Can't say |
| Restrictions ease to what anyone else has | ☐ Accurate ☐ Not always ☐ Not accurate ☐ Can't say |
| The immune response is about normal       | ☐ Accurate ☐ Not always ☐ Not accurate ☐ Can't say |

How should we word the caveats?

\writeone

## B10. Gene therapy figures

**(a)** Roughly 20 to 30 percent corrected cells are enough for normal infection fighting. Is that accurate?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

**(b)** Are the 20 to 30 percent and the 70 percent figures in the screen's text safe to use in the game?

☐ Yes ☐ Yes, with hedged wording ☐ No ☐ Can't say

\writeone

## B11. The process

**Our picture.** The screen says: "The process can be long and arduous, and it looks different for each person."

Is that an honest, fair summary of conditioning and recovery for a bone marrow transplant or gene therapy?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

If you would summarize it differently, how long and how hard would you say it is?

\writeone

## B12. Tone

**The wording.** We want to present curative options as real choices made with the care team, without implying that patients should wait or that living with CGD now is second best.

Does the screen above strike that tone?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

\writeone

\newpage

# Group C: can wait

## C1. Age

**Our picture.** The game does not model age.

Does how often and how fast infections happen change with age in a clear way?

☐ Yes (please describe) ☐ No clear pattern ☐ Can't say

\writeone

## C2. Vaccines

Is there any vaccine a patient with CGD should avoid? (Out of scope for the game, but we want to be sure we aren't implying anything.)

☐ None to avoid ☐ Some to avoid (please list) ☐ Can't say

\writeone

Thank you. Please return this page, a photo of it, or an email with your answers to the contact at the top.

<!--
For us, not printed. Handout number = number in clinician-questions.md:
A1=1 (and 31), A2=2, A3=4, A4=5, A5=7, A6=8, A7=21, A8=9, A9=20, A10=23, A11=24, A12=27, A13=28.
B1=10, B2=11, B3=12, B4=13, B5=25, B6=26, B7=29, B8=30, B9=14, B10=15, B11=16, B12=17.
Not sent: 3 (steroids, deferred), 6 (doctor visit), 31 (folded into A1c). Half of 4 (colitis) and half of 15 (the 70 percent figure) are confirmed.
C1=18, C2=19. There is no item 22 in the list.
Patient-side answers noted in clinician-questions.md (items 23, 24, 25) are left out on purpose:
they are anecdote, and a clinician should answer on their own.
-->
