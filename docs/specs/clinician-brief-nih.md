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

Prepared by: ___Tracy_Atteberry__________ Date: ________________\
Contact: ________________________________

Thank you for looking at these. Zebra Wars is a small game that helps people with chronic granulomatous
disease (CGD) picture what happens inside their body. We are not clinicians, so we simplified, and we
want to know where the simplifications are fair and where they are wrong or could mislead a patient.

**You don't need to have played the game.** Each question says what the game does, in plain words.
Nothing in the game is meant as medical advice, and a note on the closing screen says so.
<!-- For backlog: A disclaimer like this should be more available and a closing screen. -->

## Answering

- **Grouping**: Questions on the same topic are grouped together.
- **Part 1**: current need
- **Part 2**: future need (if you have time)
- **"We read"**: we found it in published sources and are asking for confirmation
- **"Can't say"**: is a great and useful answer
- **Notes**: Write notes anywhere on anything. We'll read them.

## About the game

The players are patients aged 13 and up. The game cadence is three phases: Plan, Battle,
Reflect. This repeats for each week in the game.

**Plan**: In the Plan phase a patient plans a week of ordinary life (yard work,
a lake day, band practice, etc.), with a daily medicine routine running in the
background. Each choice changes the odds that a germ comes home with them.

**Battle**: In the Battle phase, a fight takes place on a tissue map. The
player moves groups/swarms of neutrophils and tells them to engulf
germs.

**Reflect**: The week summary reflects on what happened, how things were scored,
and why their choices mattered.

For our first disease (CGD) we support X-linked and autosomal recessive
(p47phox) types. Each has two short story arcs: "First infection" (a tutorial,
told first before diagnosis and then after) and "A first summer" (two weeks of
living with CGD). The game has four organisms so far: Streptococcus,
Staphylococcus aureus, Aspergillus and Burkholderia.

## Game words

We have substituted simple words for some lab terms. This questionnaire generally uses the clinical term.

| Game word                                         | What it stands for                                                                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Leaky germ                                        | a catalase-negative organism (in the game, Streptococcus). Engulfing it kills it.                                            |
| Sealed germ (shown with a pale ring on the board) | a catalase-positive organism (in the game, Staphylococcus aureus, Aspergillus and Burkholderia). Engulfing only contains it. |
| Swarm                                             | a group of neutrophils the player moves                                                                                      |
| Charges                                           | the antibacterial, antifungal and strong doses that come from taking medication                                              |
| Granuloma                                         | a blocked tile where a swarm walls off a swallowed germ                                                                      |
| Carrying forward (on the fight's result card)     | a swallowed germ that wasn't killed and may surface later (the code calls it a reservoir)                                    |
| Exposure                                          | the chance, shown as a percentage, that something comes home from an activity                                                |
| Size (on a germ in a fight)                       | how much of the organism has taken hold. A larger size is a bigger germ load.                                                |
| Game odds                                         | those percentages. They are game numbers, not real risk figures.                                                             |

\newpage

# Part 1: please answer these

## 1. Germs and where they come from

**1.1** Each activity in a week brings a particular organism. Are these pairings reasonable? _We read that Aspergillus is the most common serious infection in CGD, and that mulch, compost, potting soil and houseplants are listed exposures (Marciano 2015; Primary Immune Foundation)._

| Activity                               | Organism it brings             | Reasonable? |
| -------------------------------------- | ------------------------------ | ----------- |
| Yard work (mulch, dead leaves)         | Aspergillus                    | ☐ Yes ☐ No  |
| Green woodworking (wet wood)           | Aspergillus                    | ☐ Yes ☐ No  |
| Crawling under the house for a ball    | Aspergillus                    | ☐ Yes ☐ No  |
| A gift flytrap plant kept in the house | Aspergillus                    | ☐ Yes ☐ No  |
| A swim in a warm, still lagoon         | Streptococcus and Staph aureus | ☐ Yes ☐ No  |
| Band, a sleepover, a game night        | Streptococcus                  | ☐ Yes ☐ No  |
| A class trip to a warm, wet region     | Burkholderia                   | ☐ Yes ☐ No  |

**1.2** Every fight so far is in the lungs. We plan to add the lymph
node, liver and skin next. _We read that lung infection occurs in about 87% of
patients, liver abscess in about 32%, and that lymphadenitis and skin abscesses
are common (Marciano 2015)._ Are those the right next sites?

☐ Yes ☐ A different order or other sites ☐ Can't say

**1.3** We split organisms by catalase status: negative (which a CGD cell can
still kill) versus positive (which it can't). We call the positive ones a
"weapon you can steal" and never present it as the complete story. _We read
that catalase status does not fully explain which organisms cause trouble (Roos
and Boer 2014)._ Is that an acceptable simplification?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

**1.4** In the game, Burkholderia comes from soil and muddy water on a class trip, is one organism with no species shown, settles in the lungs first, and is a sealed germ. _The Burkholderia cepacia group and B. pseudomallei are both reported in CGD, and it is catalase-positive (Marciano 2015; case reports)._ Is showing it that way a fair picture?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

\writeone

## 2. The fight

**2.1** In a fight, a cell that engulfs a catalase-positive organism has a small chance of killing it anyway. This is our stand-in for residual oxidase activity, one number per type of CGD. _We read that residual activity tracks survival, and that p47phox keeps more of it than most X-linked mutations (Kuhns et al., NEJM 2010)._

**(a)** Is one number per type of CGD a fair simplification?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

**(b)** How do our numbers compare with a typical patient?

| Type of CGD | The game uses       | About right | Too high | Too low | Can't say |
| ----------- | ------------------- | ----------- | -------- | ------- | --------- |
| X-linked    | about 10%           | ☐           | ☐        | ☐       | ☐         |
| p47phox     | about 25% (a guess) | ☐           | ☐        | ☐       | ☐         |

**(c)** The tutorial's "before diagnosis" fight uses no residual chance for either type, so the cells can't finish the mold. For a p47phox patient with some residual activity, is that an acceptable simplification for that moment?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

**2.2** Each tile has an inflammation level. It rises when swarms crowd together, when a loaded swarm stands still, near a visible germ, and where a swallowed germ has been walled off in a granuloma. High levels slow the cells and wear down tissue health each turn. Levels fade when the cause moves on. Is "when too many cells pile into one spot, inflammation rises there" a fair simplification of granuloma formation?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

**2.3** A germ that was swallowed but not killed stays hidden, can grow, and surfaces later as fever, pain or tiredness. The result card calls these germs "carrying forward". Is that a fair picture of how latent infections behave in CGD?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

**2.4** Macrophages and monocytes are also affected in CGD. When the player fights a virus, we would like to point to parts of the immune system that still work. May we name NK cells, T cells and antibodies, and no others?

☐ Yes ☐ Yes, and also: ________________ ☐ No, name none ☐ Can't say

\writeone

## 3. Exposures and odds

**3.1** The game offers a safer version of each activity. Is each one valid? For the trip, the plan is closed shoes, no floodwater or muddy fields, and bottled water. _We read that CGD guidance advises checking with the immunology team before travel, preferring chlorinated pools to ocean or fresh water, and avoiding barns, caves and sheds (CGD Society; Primary Immune Foundation)._

| Riskier version                                        | Safer version                                                         | Valid? |
| ------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------- |
| Yard work with mulch                                   | Indoor jobs; someone else mulches | ☐ Yes ☐ No |
| The warm, still lagoon                                 | The open beach                                                        | ☐ Yes ☐ No |
| Green woodworking with wet wood                        | Dry wood, outdoors                                                    | ☐ Yes ☐ No |
| Crawling under the house for a ball | Hooking the ball out with a rake                                      | ☐ Yes ☐ No |
| A flytrap plant kept in the house                      | The flytrap kept in the garage                                        | ☐ Yes ☐ No |
| A class trip to a warm, wet region                     | Same trip with a travel plan | ☐ Yes ☐ No |

**3.2** _We read that mulch, compost, dead leaves, hay, potting soil and houseplants, still or brackish water, caves and marijuana are all on lists of exposures to avoid (CGD Society; Primary Immune Foundation; CHOP). Tell us if any of these is wrong._

For the exposures we could not find guidance on, how much does each matter for a patient with CGD?

| Exposure                                           | Matters a lot | Matters a little | Doesn't matter | Can't say |
| -------------------------------------------------- | ------------- | ---------------- | -------------- | --------- |
| Scuba diving (for example on a vacation, on a reef) | ☐             | ☐                | ☐              | ☐         |
| Live trees brought indoors (for example at holidays) | ☐             | ☐                | ☐              | ☐         |
| Reptile pets                                       | ☐             | ☐                | ☐              | ☐         |
| A koji recipe at home (a mold grown on purpose)    | ☐             | ☐                | ☐              | ☐         |

**3.3** Each activity carries an exposure chance. They are game numbers, and a line near the week's odds says so: "These are game odds. Your medicine does not change them; it helps your cells in the fight."

| Activity                                       | Game odds |
| ---------------------------------------------- | --------- |
| Yard work with mulch                           | 45%       |
| A swim in the warm, still lagoon               | 45%       |
| A class trip to a warm, wet region             | 45%       |
| Green woodworking with wet wood                | 40%       |
| Crawling under the house for a ball | 35%       |
| A flytrap plant kept in the house              | 20%       |
| The open beach                                 | 15%       |
| Indoor jobs                                    | 10%       |
| A sleepover                                    | 10%       |
| Band practice, a crowded game night            | 5%        |
| The safer versions of woodworking, the crawlspace, the flytrap and the trip | 2% each |

**(a)** Is the order sensible for a patient with CGD? (The numbers are ours. The order is what matters.)

☐ Sensible ☐ Some should move ☐ Not sensible ☐ Can't say

**(b)** Even with the label, could a patient take these percentages for real risk figures?

☐ Unlikely ☐ Possibly ☐ Likely ☐ Can't say

**(c)** The new safer versions show 2%, against 10 and 15% for the earlier ones. That was picked for balance, not teaching. Would a patient read 2% as nearly safe?

☐ Unlikely ☐ Possibly ☐ Likely ☐ Can't say

\writeone

## 4. Fever

Any fever makes a doctor visit a good move. The doctor may find it was only a virus. In that case the game shows "Just a virus", with no fight that week. The game must never teach a patient to dismiss a fever. _We read that patient guidance lists 38 C or above as a warning sign, and says to see the doctor even for minor infections (CGD Society; Primary Immune Foundation)._

**(a)** Is the game's picture fair?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

**(b)** What are patients usually told to do about a fever?

☐ Contact the care team for any fever\
☐ Contact them above a set temperature: ________\
☐ It depends on the patient\
☐ Can't say

\writeone

## 5. Medicine

**5.1 What real prophylaxis does.**

**(a)** Does antibacterial or antifungal prophylaxis help phagocytes finish organisms they have already swallowed (a germ that survives inside the cell)?

☐ Yes, a lot ☐ Yes, somewhat ☐ Little or not at all ☐ Can't say

**(b)** In the game, a full week of antibacterial medicine lets the cells finish a small Burkholderia, as it does for Staphylococcus aureus. _We read that TMP-SMX covers Burkholderia, but that breakthrough infections are not well quantified._ Does antibacterial prophylaxis help against Burkholderia in CGD?

☐ It helps ☐ It gets through ☐ Little or not at all ☐ Can't say

**5.2 The game's rule.** In the game, daily medicine does not change whether a germ arrives, so the activity percentages are the same whether or not the player took it. It makes the fight easier: the starting infection is smaller, germs grow more slowly, and the player gets charges that can finish small germs. Full daily doses also add a modest boost (about 25 percentage points) to the chance that a swallowed germ dies each turn. In the tutorial we present all this as a game rule and never as fact. _We read that TMP-SMX cut non-fungal infections by about half to two thirds, with no change in fungal infections, and that itraconazole cut fungal infections (NIH review; randomized trial)._

**(a)** Real prophylaxis lowers the chance an exposure becomes an infection. Is the game's picture an acceptable simplification?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

**(b)** Each missed dose before an exposure makes the infection that takes hold one step bigger (a larger germ load). Is it fair that missed prophylaxis lets a larger infection take hold from the same exposure?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

**5.3 Names.** The game says "antibacterial" and "antifungal". It names no drugs (for example TMP-SMX, itraconazole or posaconazole) and leaves out interferon-gamma, though the standard regimen includes it.

**(a)** Is that wording acceptable?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

**(b)** Is it safe to leave interferon-gamma out of the game?

☐ Yes ☐ No, it should be mentioned ☐ Can't say

\writeone

## 6. How the game tells it

**6.1 A first serious lung infection.** The tutorial opens with a flashback, "Before you knew it", in the second person, which the player can skip. In the "before diagnosis" fight, the cells arrive and swallow the germs but can't finish an Aspergillus mold. The card says "Not finished". After diagnosis, the same fight ends well with medicine. We tell it as one common story, not everyone's. We chose Aspergillus in the lung, rather than Staphylococcus or Burkholderia. _We read that pneumonia, abscess and lymphadenitis are the most common serious infections, and that Aspergillus is the most common cause (Marciano 2015)._ Is that a fair picture of how CGD is often found?

☐ Accurate ☐ Changes needed ☐ Not accurate ☐ Can't say

**6.2 "One tool away."** At the end of the "after diagnosis" fight, the card says: "CGD takes one tool away, not your whole defence, and your medicine helps fill the gap." Macrophages and monocytes are also affected, so we make no claim about which other cells are fine.

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

**6.3 "Still sick."** Before diagnosis the tutorial ends with: "Infection: not finished. Your body is still sick." The next card goes straight on to: "The doctors helped your body clear it, and ran some tests. The missing tool had a name: CGD." Is "still sick" fair and not frightening wording for that moment?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

**6.4 The overall message.** The game's message is that choices change the chance of an infection but not the outcome. After a careful week that still ends in a hard fight, it says: "Your plan and your routine were strong. Some fights are just hard." The score still rewards lowering the odds, and the odds visibly move.

**(a)** Is that the right message for teenagers?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

**(b)** Could it make precautions feel pointless?

☐ Unlikely ☐ Possibly ☐ Likely ☐ Can't say

\writeone

\newpage

# Part 2: Future needs (if you have time)

## 7. Salmonella (not in the game yet)

Salmonella would come from reptile pets, or from undercooked eggs and poultry.
We would show it as a sealed germ, away from the lungs. In the game, a symptom
never says which germ, so we would show it as a low fever or an "off" day. The
safer version of a friend's pet keeps the visit and drops the handling: "hang
out with it but do not handle it, and wash your hands". _We read that
Salmonella is invasive in CGD, with bacteremia and deep abscesses including the
brain (case series), but we found nothing on the points below._

**(a)** Where does it mainly settle in CGD? Tick any that apply.

☐ Gut ☐ Blood ☐ Liver ☐ Bone ☐ Lung ☐ Can't say

Can it be shown on the liver map we already plan, or does it need its own site?

☐ The liver map is fine ☐ It needs its own site ☐ Can't say

**(b)** Can the cells finish it, or only contain it?

☐ Finish it ☐ Contain only ☐ Varies ☐ Can't say

**(c)** Does antibacterial prophylaxis help against it?

☐ It helps ☐ It gets through ☐ Little or not at all ☐ Can't say

**(d)** Is the safer version above valid? Is there one that is not "give up the pet"?

☐ Valid ☐ Valid with changes ☐ Not valid ☐ Can't say

**(e)** Is a low fever or an "off" day a safe way to show the symptom?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

\writeone

## 8. More organisms, and rare sites

**8.1** The game has Streptococcus, Staphylococcus aureus, Aspergillus and
Burkholderia. _We read that Serratia and Nocardia are also common causes
(Marciano 2015)._ Tick any of these worth adding:

☐ Serratia ☐ Nocardia ☐ Granulibacter ☐ Chromobacterium ☐ Aspergillus nidulans (bone) ☐ None ☐ Can't say

**8.2** A future rare "surprise" fight would be clearly framed as uncommon, for example an infection of the spine or lower brain. How rare are infections at sites like these?

☐ Very rare ☐ Uncommon ☐ Not rare ☐ Can't say

\writeone

## 9. The closing screen

After the summer, the game offers a short, hopeful screen called "What comes
next". It is marked "Draft: pending clinical review", and we can switch it off.
This is its entire text:

> Bone marrow transplant and gene therapy are real options for CGD. They keep
> changing, and the choice is made together with your care team.
>
> After one of them works, there is no more prophylaxis medicine, restrictions
> ease to what anyone else has, and the immune response is about normal.
>
> The conditioning process can be arduous, the recovery long and filled with side
> effects, and it looks different for each person.
>
> Gene therapy does not have to correct every cell. In early results, roughly
> 20 to 30 percent corrected cells looked like enough, and one recent patient
> reached nearly 70 percent.
>
> This is information, not medical advice. Your care team knows your situation,
> so talk with them about anything here.

**9.1** After a successful bone marrow transplant or gene therapy, is each statement accurate? _We read that transplant gives durable resolution of CGD symptoms and less prophylaxis by 3 to 5 years, but found no rule for when prophylaxis stops (published cohorts)._

| Statement                                 | Accurate?                                          |
| ----------------------------------------- | -------------------------------------------------- |
| There is no more prophylaxis medicine     | ☐ Accurate ☐ Not always ☐ Not accurate ☐ Can't say |
| Restrictions ease to what anyone else has | ☐ Accurate ☐ Not always ☐ Not accurate ☐ Can't say |
| The immune response is about normal       | ☐ Accurate ☐ Not always ☐ Not accurate ☐ Can't say |

**9.2** Are the 20 to 30 percent and nearly 70 percent figures in the screen's text safe to use in the game? (They come from clinicians and from one patient's lab result.)

☐ Yes ☐ Yes, with hedged wording ☐ No ☐ Can't say

**9.3** Is "The conditioning process can be arduous, the recovery long and filled with side effects, and it looks different for each person" an honest, fair summary of conditioning and recovery?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

**9.4** We want to present curative options as real choices made with the care
team, without implying that patients should wait or that living with CGD now is
second best. Does the screen above strike that tone?

☐ Acceptable ☐ Acceptable with changes ☐ Not acceptable ☐ Can't say

\writeone

Thank you for completing this questionnaire! Please return it to Tracy in whatever manner
is most convenient for you.

<!--
FOR US, NOT PRINTED. This block is the source of
truth for working assumptions, cut questions and old numbers (the old clinician-questions.md was folded in here on 2026-11-16). Research and sources:
clinician-research-notes.md (it uses the previous handout's IDs, shown below as "was").

Access to a clinician is limited (possibly one). Until a question is answered the game uses its
working assumption. Adjust later.

WHAT CHANGED IN THIS REWRITE
- Grouped by topic (9 sections) instead of by priority (A/B/C). Part 1 is everything that was A, plus the
  B items that are cheap or that ship (medicine game rule, tutorial wording). Part 2 is what the game does
  not do yet (Salmonella, rare sites, more organisms) plus the closing screen (priority B, can be switched off).
- "We read" lines turn researched questions into confirm ticks.
- Cut as answered or low value: A9 diagnosis age (sourced), A14 a/b/c as separate questions (folded into 1.4),
  B2 (folded into 1.3), B5 (folded into 6.1), B13 (folded into 5.1b), B14 (folded into 3.1 trip row),
  B16 (folded into 1.1, 3.1, 3.2), A16 (folded into 3.3c), B15a (Salmonella ranking), C1 age, C2 vaccines
  (only BCG is sourced and the game never touches vaccines).
- All write-in lines are gone except 2.4's "also" and 4(b)'s temperature.
- 8.2(b) (how to frame rare sites) was cut: it is a game design question, and (a) is the useful part.
- 3.2's first tick and 1.4's "is the literature right" tick were dropped: a reputable, agreeing source is a note, not a question.

OLD NUMBERS (previous handout ID, then the original clinician-questions.md number)
1.1 = A2a + B16 + A14 trip (2, 43, 32); 1.2 = A2b (2); 1.3 = A2c + B2 (2, 11); 1.4 = A14 (32, 33, 34)
2.1 = A1 (1, 31); 2.2 = A3 (4); 2.3 = A4 (5); 2.4 = A8 (9)
3.1 = A6a + B14 + B16 (8, 36, 43); 3.2 = A6b (8); 3.3 = A12 + A16 (27, 44)
4 = A5 (7)
5.1 = A7a + B13 (21, 35); 5.2 = A7b,c + B6 + B7 (21, 26, 29); 5.3 = B3 (12)
6.1 = A10 + B5 (23, 25); 6.2 = A11 (24); 6.3 = B8 (30); 6.4 = A13 (28)
7 = A15 + B15 (38, 39, 40, 41, 42, 37 cut); 8.1 = B4 (13); 8.2 = B1 (10)
9.1 = B9 (14); 9.2 = B10 (15); 9.3 = B11 (16); 9.4 = B12 (17)
Cut: A9 (20), C1 (18), C2 (19). There was never an item 22.

WORKING ASSUMPTIONS (the game's behaviour until answered)
1.1 Lung first. Organism-to-activity pairings are our guess, except Aspergillus for mulch (sourced).
1.2 Lung first, then lymph node, liver, skin.
1.3 Keep as a simplified metaphor, never stated as complete.
1.4 One game organism named Burkholderia, from soil and muddy water on a trip abroad, species not shown.
  Lung first, same map as Aspergillus. Sealed bacterium, like Staph.
2.1 Low residual kill chance for XL (0.10), higher for AR p47phox (0.25, a guess), tunable per character
  (Kuhns et al., NEJM 2010). Arc 1 Part A uses none for either variant. Part B uses the variant value.
2.2 Inflammation rises where swarms over-commit. Settled 2026-11-14: a CGD researcher told Tracy directly
  that CGD colitis has a genetic component. The inflammation simplification is still asked.
2.3 Hidden reservoirs that grow and surface as fever, pain, tiredness.
2.4 NK cells, T cells and antibodies only.
3.1 The smarter versions are our proposal. The trip plan matches published travel advice.
3.2 The user's list: yard work, brackish water, caves, scuba, marijuana, live trees, reptile pets.
  Patient-side (2026-11-16): clinicians told CGD patients to avoid caves, scuba diving on a vacation off
  coral reefs, and live Christmas trees brought indoors. An NIH researcher quoted by the Primary Immune
  Foundation was softer on trees (fresh and healthy is fine if care is taken, the patient should not
  water the stand, which can harbor Burkholderia cepacia).
3.3 Acceptable with "These are game odds" in the explain line. The relative order is what matters. The 2%
  on the safer versions was tuned for balance and may be raised.
4 Any fever makes a doctor visit a good move. The doctor may reveal it was viral.
5.1 Medicine adds a modest boost (+25% at full doses) to a swallowed germ dying each turn. Antibacterial
  charge finishes a small Burkholderia, as it does for Staph.
5.2 Acceptable as a declared game rule. Skipped doses add nothing and let arrivals land bigger. Wording stays
  simple and non-preachy.
5.3 Say "antibacterial" and "antifungal". No interferon-gamma.
6.1 Fair as one common story, told as not everyone's. "Before you knew it", second person, skippable. Patient-side
  (2026-11-08): yes; CGD is often first suspected from recurrent or severe infections, commonly lung
  (pneumonia) or liver (abscesses). Aspergillus is possible. Pending a clinician.
6.2 Yes, with no claim about which other cells are fine (see 2.4). Patient-side: fair; CGD does not put you in a
  bubble, but it takes away one of the tools the immune system uses. Pending a clinician.
6.3 Fair; the card goes straight on to "the doctors helped your body clear it".
6.4 Right message, because the score still rewards lowering the odds and the odds visibly move.
7 Liver or gut site, not the lung. Sealed, as many organisms are in CGD. Prophylaxis as for Burkholderia (5.1b).
  Safer version keeps the visit and drops the handling. Symptom shown as a low fever (see 4). A good hazard to
  teach, ranked after the mold hazards.
8.1 Staph aureus, Aspergillus, Burkholderia, Serratia, Nocardia, plus Streptococcus as the leaky example.
8.2 Rare surprise battle, clearly framed as uncommon. Framing options (was B1b) cut as game design.
9.1 As stated by the user. Patient-side (2026-11-16): prophylaxis is discontinued, restrictions ease slowly
  over time, and the immune response is about normal (DHR at least 20 to 30 percent).
9.2 Use as stated, with hedged wording. The 20 to 30 and nearly 70 percent figures came from clinicians and an
  actual DHR result from a gene therapy patient (Tracy, 2026-11-17). The carrier study in the research notes is
  context only and is not asked about. The question is a cheap publish check and can be cut.
9.3 Short, honest summary. The screen text was changed 2026-11-17 to "The conditioning process can be arduous, the
  recovery long and filled with side effects, and it looks different for each person" (the old line implied the
  whole process was arduous). The game's epilogue copy (src/app/epilogue.ts) was synced to this text on 2026-11-17. 9.4 Hopeful and neutral.
Koji (3.2): a surprise worth checking, no guess.
Cut C1 age: not modeled. Cut C2 vaccines: out of scope, the user has never been told to avoid any; only BCG is sourced.

NOT SENT (left out of the printed handout on purpose)
Steroids (was 3). Is "calms inflammation, weakens defense" a fair summary of the trade-off, and in what
  situations are they used? Working assumption: double-edged support in the gut flare arc. Deferred
  2026-11-14 until steroids are in scope. Priority B. Research: supported for granulomatous colitis and
  obstruction, thin for Aspergillus pneumonia.
Doctor visit as a power move (was 6). Do early visits reveal and clear infections the way the game implies
  (imaging, IV antifungals, drainage)? Working assumption: reveals reservoirs and gives strong support. Not
  sent 2026-11-14. This is a deliberate game simplification: real treatment is often rounds of IV therapy,
  follow-ups, biopsies and hospital stays, and the game does not show that. It keeps the game small and
  avoids prompting patients to relive a traumatic part of the disease. Keep doctor-visit and "cleared" copy
  light, and do not depict procedures. Priority B.

Patient-side answers (6.1, 6.2) are anecdote, so the questions in the body stay open for a
clinician to answer on their own.
-->
