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
  - \renewcommand{\subsection}{\Needspace{17\baselineskip}\oldsubsection}
  - \newcommand{\writelines}{\par\vspace{0.7cm}\noindent\rule{\textwidth}{0.4pt}\par\vspace{0.7cm}\noindent\rule{\textwidth}{0.4pt}\par\vspace{0.4cm}}
  - \geometry{margin=1in}  # Sets all margins to 1 inch
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

- Tick one box for each question and add a few words if you like. A short answer is plenty.
- Skip anything you can't speak to. "Can't say" is a useful answer too.
- **Please do the A questions first.** We'd like those before the game is shown more widely. B questions come later, and C questions can wait.
- If you would word something differently, write the wording you would accept. We'll change the game to match.

## About the game, in one paragraph

The players are patients aged 13 and up. The game alternates between two parts. In the first, a
patient plans a week of ordinary life (yard work, a lake day, band practice, a sleepover), with a
daily medicine routine running in the background. Each choice changes the odds that a germ comes
home with them. In the second, a fight takes place on a map of the lungs. The player moves groups of
neutrophils and tells them to engulf germs. There are two characters, X-linked and autosomal
recessive (p47phox), and two short story arcs: "First infection" (a tutorial, told first before
diagnosis and then after) and "A first summer" (two weeks of living with CGD).

## Game words

Players see plain words, not lab terms. This brief uses the clinical term and gives the game word once.

| Game word                                         | What it stands for                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Leaky germ                                        | a catalase-negative organism (for example Streptococcus). Engulfing it kills it.                                |
| Sealed germ (shown with a pale ring on the board) | a catalase-positive organism (for example Aspergillus, Staph aureus, Burkholderia). Engulfing only contains it. |
| Swarm                                             | a group of neutrophils the player moves                                                                         |
| Charges                                           | the antibacterial, antifungal and strong doses that come from taking medication                                 |
| Granuloma                                         | a blocked tile where a swarm walls off a swallowed germ                                                         |
| Carrying forward (on the fight's result card)     | a swallowed germ that wasn't killed and may surface later (the code calls it a reservoir)                       |
| Exposure                                          | the chance, shown as a percentage, that something comes home from an activity                                   |
| Game odds                                         | those percentages. They are game numbers, not real risk figures.                                                |

For each question, tick **Accurate** if the game's picture is fine as it stands, **Changes needed** if
it needs a fix (please say what), **Not accurate** if it is wrong, or **Can't say**.

\newpage

# Group A: please answer these first

## A1. Residual kill chance

**Question.** In a fight, a cell that engulfs a catalase-positive organism has a small chance of killing it anyway. This is our stand-in for residual oxidase activity. What chance would be realistic for a typical X-linked patient and for a typical p47phox patient? Is one number per character a fair simplification?

**What the game does now.** About 10% for X-linked and 25% for p47phox. The 25% is a guess. We drew on Kuhns et al., NEJM 2010. The tutorial's "before diagnosis" fight uses no residual chance at all.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Your numbers or comments:

\writelines

## A2. Which organisms, which site

**Question.** Which organisms most often infect which sites (lung, lymph node, liver, skin, bone, gut)? Is splitting organisms by catalase status a fair basis for the pairings we show?

**What the game does now.** The fights happen in the lung first, with lymph node, liver and skin to follow. The organisms we use are Staph aureus, Aspergillus, Burkholderia, Serratia and Nocardia, plus Streptococcus as the example the cells can finish. Which organism goes with which site is our guess.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## A3. Inflammation

**Question.** Is "when too many cells pile into one spot, inflammation rises there" a fair simplification of granuloma formation? Separately, does colitis in CGD have a genetic component beyond infection?

**What the game does now.** Each tile has an inflammation level. It rises when swarms crowd together, when a loaded swarm stands still, near a visible germ, and where a swallowed germ has been walled off in a granuloma. High levels slow the cells and wear down tissue health each turn. Levels fade when the cause moves on.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## A4. Infections that persist

**Question.** Is "a germ that was swallowed but not killed can persist and flare later" a fair picture of how latent infections behave in CGD?

**What the game does now.** The result card shows what the fight is "carrying forward". Those germs stay hidden, can grow, and surface later as fever, pain or tiredness.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## A5. Fever

**Question.** What are patients actually told about fever? The game must never teach a patient to dismiss one, even when it turns out to be viral.

**What the game does now.** Any fever makes a doctor visit a good move. The doctor may find it was only a virus. In that case the game shows "Just a virus", with no fight that week.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## A6. Exposures

**Question.** Are our "smarter versions" of risky activities valid, and which exposures matter most for a patient with CGD?

**What the game does now.** Each activity has a riskier and a safer version, for example yard work (higher exposure to mold) versus indoor jobs, and the lagoon versus the beach. Other exposures we have in mind: caves, scuba, marijuana, live trees and reptile pets.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## A7. Medicine and germs already swallowed

**Question.** Does antibacterial or antifungal prophylaxis help phagocytes finish organisms they have already ingested (a swallowed germ that survives inside the cell), and how strongly? Is "medicine keeps germs small when they arrive" accurate wording for what a missed dose lets happen?

**What the game does now.** Full daily doses add a modest boost (about 25 percentage points) to the chance that a swallowed germ dies each turn. Skipped doses add nothing and let the next arrivals land bigger. We keep the wording simple and non-preachy.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## A8. The parts that still work

**Question.** Macrophages and monocytes are also affected in CGD. May we use NK cells, T cells and antibodies as the examples of "parts of the immune system that still work" when the player fights a virus? And nothing more than those three?

**What the game does now.** No text names them yet. We would like your guidance before we write any.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## A9. How CGD is found: the opening

**Question.** The game's first screen is a flashback, "Before anyone knew", in the second person, and the player can skip it. How varied is the road to diagnosis (X-linked often early, autosomal recessive sometimes much later), and is this a fair way to open?

**What the game does now.** The tutorial's first fight happens before diagnosis. A germ gets into the lungs and the cells rush in but can't finish it.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## A10. A first serious lung infection

**Question.** Is a first serious lung infection, where the cells arrive and swallow germs but cannot finish a mold, a fair picture of how CGD is often found? We tell it as one common story, not everyone's.

**What the game does now.** In the "before diagnosis" fight the cells can't finish an Aspergillus-like mold, and the card says "Not finished". After diagnosis, the same fight ends well with medicine.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## A11. "One tool away"

**Question.** Is this wording acceptable for a patient: "CGD takes one tool away, not your whole defence, and your medicine helps fill the gap"? Macrophages and monocytes are also affected, so we make no claim about which other cells are fine.

**What the game does now.** It appears on the card at the end of the "after diagnosis" fight.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments or the wording you would use:

\writelines

## A12. Percentages on activities

**Question.** The game shows an exposure chance next to each activity (for example 45% for yard work with mulch, 10% for indoor jobs). They are game numbers. Is it acceptable to show them, or could a patient read them as real risk figures?

**What the game does now.** A line near the week's odds reads: "These are game odds. Your medicine does not change them; it helps your cells in the fight." The order of the numbers matters more than the values. If the numbers are a problem, we could use bands (low, medium, high).

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## A13. The overall message

**Question.** The game's message is that choices change the chance of an infection but not the outcome: a careful week can still bring a germ home, and "some fights are just hard". Is that the right message for teenagers, and could it make precautions feel pointless?

**What the game does now.** After a careful week that still ends in a hard fight, the game says: "Your plan and your routine were strong. Some fights are just hard." The score still rewards lowering the odds, and the odds visibly move.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

\newpage

# Group B: before a wider release

## B1. Steroids

**Question.** Is "calms inflammation but weakens defence" a fair summary of the trade-off? In what situations are steroids used?

**What the game does now.** Not in the game yet. A future part would offer steroids as a double-edged support during a gut flare.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## B2. The doctor visit

**Question.** Do early doctor visits reveal and clear infections the way the game implies (imaging, IV antifungals, drainage)?

**What the game does now.** A visit reveals hidden infections and gives the patient strong support in the next fight.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## B3. Rare sites

**Question.** For rare-site infections (for example spine or lower brain), how rare are they, and how can we frame them so they are relatable but not frightening?

**What the game does now.** Not in the game yet. A future rare "surprise" fight would be clearly framed as uncommon.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## B4. The "weapon you can steal" idea

**Question.** Later studies suggest catalase status does not fully explain which organisms cause trouble. Is the idea of a weapon the cells can use against some germs but not others acceptable if we never state it as the complete story?

**What the game does now.** We keep it as a simplified picture: some germs leave a "weapon" a CGD cell can use, and others don't.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## B5. Names for medicine

**Question.** We say "antibacterial" and "antifungal" (for example TMP-SMX, and itraconazole or posaconazole behind them). Is it safe to leave interferon-gamma out?

**What the game does now.** The game uses the two generic words and names no drugs. Interferon-gamma is left out.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## B6. More organisms

**Question.** Should the game include Granulibacter, Chromobacterium, Salmonella or Aspergillus nidulans (bone), and are there others you would add?

**What the game does now.** Staph aureus, Aspergillus, Burkholderia, Serratia, Nocardia, plus Streptococcus.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## B7. Aspergillus in the tutorial

**Question.** Is Aspergillus a fair organism for the first lung infection in the tutorial (rather than Staphylococcus or Burkholderia), with Streptococcus as the germ the cells do finish?

**What the game does now.** Yes for the lung in our telling, and we'd like to check that.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## B8. Medicine in the tutorial

**Question.** In the tutorial, daily medicine visibly slows germs and gives charges that finish a small mold. Is that an acceptable game picture of antibacterial and antifungal prophylaxis, as long as we never state it as fact?

**What the game does now.** It is presented as a game rule. See also A7.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## B9. Medicine and what arrives

**Question.** In the game, daily prophylaxis does not change whether a germ arrives. It makes the fight easier (germs slowed, smaller arrivals, charges). Is that acceptable as a game picture, given that real prophylaxis lowers the chance an exposure becomes an infection?

**What the game does now.** The activity percentages are the same whether or not the player took their medicine.

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## B10. "Still sick"

**Question.** Before diagnosis the tutorial ends with "Infection: not finished. Your body is still sick." Is "still sick" fair and not frightening wording for that moment?

**What the game does now.** The card goes straight on to "The doctors helped your body clear it, and ran some tests. The missing tool had a name: CGD."

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## B11. Autosomal recessive and the "before diagnosis" fight

**Question.** The "before diagnosis" fight gives the cells no residual kill chance for either variant, so they can't finish the mold. For a p47phox patient with some residual activity, is that an acceptable simplification for the pre-diagnosis picture?

**What the game does now.** After diagnosis, the p47phox character gets the higher residual chance (see A1).

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## The closing screen (B12 to B15)

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

## B12. After a successful treatment

**Question.** After a successful bone marrow transplant or gene therapy, is it accurate that there is no prophylaxis, that restrictions ease to those of anyone else, and that the immune response is about normal? How should we word the caveats?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## B13. Gene therapy figures

**Question.** Roughly 20 to 30 percent corrected cells are enough for normal infection fighting, and one recent patient reached about 70 percent. Are these figures safe to publish, and with what wording?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## B14. The process

**Question.** How long and arduous are conditioning and recovery for a bone marrow transplant or gene therapy? How should we summarize it honestly in a sentence or two?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## B15. Tone

**Question.** How can we present curative options as real choices made with the care team, without implying that patients should wait or that living with CGD now is second best?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

\newpage

# Group C: can wait

## C1. Age

**Question.** How do infection frequency and speed change with age? (The game does not model age.)

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

## C2. Vaccines

**Question.** Are there any vaccines a patient with CGD should avoid? (Out of scope for the game, but we'd like to be sure we aren't implying anything.)

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

Comments:

\writelines

Thank you. Please return this page, a photo of it, or an email with your answers to the contact at the top.

<!--
For us, not printed. Handout number = number in clinician-questions.md:
A1=1, A2=2, A3=4, A4=5, A5=7, A6=8, A7=21, A8=9, A9=20, A10=23, A11=24, A12=27, A13=28.
B1=3, B2=6, B3=10, B4=11, B5=12, B6=13, B7=25, B8=26, B9=29, B10=30, B11=31, B12=14, B13=15, B14=16, B15=17.
C1=18, C2=19. There is no item 22 in the list.
Patient-side answers noted in clinician-questions.md (items 23, 24, 25) are left out on purpose:
they are anecdote, and a clinician should answer on their own.
-->
