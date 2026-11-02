# Zebra Wars: context for reviewers

Read `../internal/initial_idea.md` and `../internal/pitch-1.md` .. `../internal/pitch-3.md` first. This file holds context that came out
of the conversation and is not in those files. Items marked (proposal) were suggested by Claude and
accepted or not yet challenged by the user; everything else was said by the user.

## What the user (Tracy) wants to be true after a session

- The patient can better visualize what is going on inside their body.
- They feel better equipped to make smart decisions that affect "the battle inside them".
- Less fearful, more empowered. This is the success criterion, more than knowledge retention.
- Fun beats technical detail when they conflict. Ideally some of both. Each pitch needs an
  engaging visual element in the gameplay itself.
- No lessons, quizzes, or tests. Learning must come out of play.

## Audience and context

- Patients aged 13 and up with rare immune (and one non-immune) diseases.
- The user knows CGD much better than Wilson's disease. CGD descriptions in the pitches were
  written by Claude from general knowledge and the user's corrections. Treat the biology as
  unverified by a clinician.
- Gene therapies from Prime Medicine (one ex vivo, one in vivo) target both CGD and Wilson's.
  The game must NOT be an advertisement for them. Name them only where it helps differentiate
  treatment options.
- For X-linked CGD, bone-marrow transplant is another non-gene-therapy option. For gameplay,
  transplant and gene therapy were first imagined as both meaning "restored function", but see
  the decisions below: curative therapies are now outside gameplay.

## Disease modules

1. CGD X-linked
2. CGD autosomal recessive
3. Wilson's disease (copper metabolism; NOT an immune disease, which the user did not intend)

- The two CGD modules share almost everything. They differ in genetics, infection frequency and
  severity, and available treatments. (proposal) Treat these as parameters, not mechanics.
- Wilson's in the same game type as CGD is OPTIONAL. It can always be broken out into a separate
  game, and the pitches suggest that may be necessary. Pitches should be judged primarily on how
  well they serve CGD. Wilson's fit is a secondary consideration, not a requirement. A pitch
  that is great for CGD but cannot host Wilson's is acceptable.
- Wilson's likely needs different core mechanics. If it becomes impractical as a module, it may
  be split into a separate game. The user still wants everything under the "Zebra Wars" umbrella
  presentation. (proposal) A landing hub with per-disease modules and a thin shared layer
  (three.js setup, UI shell, progression frame).
- Progression (UPDATED, see pitch-4.md): the original idea was untreated -> prophylactic meds ->
  gene therapy. Now: a short undiagnosed-infection prologue, a short after-diagnosis prologue
  (contrast with meds), then fixed life-on-prophylaxis arcs. Curative therapies are not
  gameplay; they appear in an upbeat epilogue.

## Real-life behaviors the game should help with

- CGD infection sources to avoid: yardwork, swimming in brackish water, cave exploring, scuba
  diving, smoking marijuana, live Christmas trees, reptile pets, and a long tail beyond these.
- Medication adherence. Some adolescents struggle (rebellion or denial). (proposal) Do not
  lecture. Let them skip and watch what happens inside.
- Recognition: fevers are a reason to see a doctor, as are new or recurring pains, especially
  after an exposure like airline travel or a warm-climate vacation (more fungal sources).

## Decisions made so far

- Structure (decided): hybrid of an "outside" life phase and an "inside" battle. The user
  chose this because it covers behavior (decisions) and cellular mechanics (visualization);
  the pure inside-only or life-only approaches would miss one of the two goals.
- Life choices set the starting conditions of the battle: cell counts, medication level, pathogen
  load (the user likes this mechanic). Like an RPG: choices between battles are the loadout
  (armor, quests, potions, buy/sell). Players may make different life choices between battles.
- The battle style: the user likes the Opus reviewer's hybrid, "Read the Field" (turn-based,
  fully telegraphed tactics on a 3D tissue map, with a short real-time swarm playback each
  turn). It is written up as `pitch-4.md`. Pitches 1-3 are superseded where they conflict.
  Not a final approval; pitch-4 is the working proposal to iterate on.
- Game structure (decided by the user): a series of fixed arcs (levels), no game over, no death.
  Arcs can include "first infection, undiagnosed (no prophylactics)" and "first infection after
  diagnosis" as memorable moments and a contrast with how things work on meds.
- Curative therapies (BMT, gene therapy) are NOT part of gameplay (decided by the user). A cure
  would end the game and works against the goal of living well with CGD. They are reserved for an
  upbeat ending to the tutorial or docs. After a cure: no prophylaxis meds, restrictions drop to
  "normal person" levels, and the immune response is about normal; the treatment process can be
  arduous and long.
- Arc list (agreed by the user as a good starting point; details in `pitch-4.md`): undiagnosed
  first infection, first infection after diagnosis, a first summer, a school trip or flight to a
  warm climate, a camping weekend, a holiday season, a gut flare, then a non-gameplay epilogue
  about curative options.
- Rare-site surprise battle (decided): an occasional, rare, clearly-uncommon unusual-site infection.
  The user notes most patients they have talked to have had at least one unusual infection, so
  it is relatable ("zebras travel in herds"). Age-based infection scaling is deferred to avoid
  design friction.
- Scoring (proposal from review, user liked the direction): score the life the player lives (goals,
  friends, events), with health as the budget, not score on health.
- CGD battle mechanic (decided, appeals to the user): cells show up (chemotaxis is intact) but
  CGD neutrophils have no weapon of their own, like unarmed soldiers. "Armed" pathogens
  (catalase-negative bacteria, release H2O2) can be beaten with a stolen weapon; "unarmed"
  pathogens (catalase-positive: Aspergillus, Staph aureus, Burkholderia, etc.) cannot.
  The user's childhood version was that viruses bring weapons the cells can steal. That is
  wrong (viral defense is NK/T cells/antibodies, unaffected by CGD), and they know it now.
- Viruses (decided): shown as background/NPC fights that need no player input, plus in the
  tutorial, so there is an easy early win and a visible contrast that CGD breaks only one part
  of the immune system.

## Clinical corrections from the user (after the first Opus review)

These override anything in the pitches or the review that conflicts.

- Neutrophil counts are NOT affected in CGD. The defect is in NADPH oxidase, which prevents the
  cells from producing H2O2. Do not model prep as changing neutrophil count; the shared loop in
  the pitches ("neutrophil count/readiness") is wrong on this point.
- The catalase explanation is not the full story, but the user considers it a good explanation
  for most of it. Keep it as the basis of the armed/unarmed mechanic.
- CGD colitis has a genetic component. It is not purely excess inflammation, though inflammation
  contributes. Steroids are a double-edged form of support (they calm inflammation but weaken
  defense), which is good material for a trade-off mechanic.
- Interferon-gamma use varies a lot between centers, and the user's sense is that it is fading
  in their area as BMT and gene therapy develop. Fine to leave it out of the game.
- Gene therapy does not correct every neutrophil. Roughly 20-30% corrected cells are enough to
  win a normal number of infection battles. One recent Prime Medicine patient reached about 70%
  correction, well beyond what is needed for a normal immune response. Restored function should
  therefore be modeled as a fraction of working cells with a threshold, not all-or-nothing.
- Infection frequency varies with age. Younger patients tend to get infections more often and
  can be overcome more quickly. Rarer sites also occur (for example, a fungal infection of the
  spine and lower brain in an 11-year-old patient) but are less frequent. The user does not
  require this variation in the game.
- Residual oxidase activity and infection sites were researched; see "Research findings" in
  `pitch-4.md`. Summary: residual activity predicts severity better than inheritance pattern, so
  treat residual kill chance as a per-character parameter. The lung is the most frequent infection
  site, then skin, lymph nodes and liver.
- Vaccines: the user has never been told to avoid any and does not think this is a big deal.
  Leave vaccines out unless there is a reason to add them.

## Logistics and constraints (from the user)

- Solo developer. One CGD patient (over 18) is available for testing at any stage. Possibly one
  clinician, only after an initial version is fully developed. Open clinical questions are kept
  in `clinician-questions.md`, each with a working assumption, so the game can be adjusted later.
- Prototype: desktop only, tested in person or locally. Organism names are not required in the
  prototype (leaky/sealed is fine), though they seem easy.
- First version (beta): must support mobile, and organism names are required.
- Deadline: a playable beta by 2026-11-21 (23 days from 2026-10-29), to demo at NIH a few days
  later and, if possible, have a clinician review questions there.
- Tech (accepted): TypeScript, Vite, plain DOM over a three.js canvas. Test character defaults to the
  low kill chance typical of X-linked CGD.

## Design risks Claude has already flagged

- Prep must not feel like a moral quiz. Risky choices should be tempting and pay off in the moment.
- Battle skill must not be able to fully overcome bad prep, or the outside/inside link dies.
- The hybrid can become two half-games stitched together. The layers must feed each other.
- Real-time control (pitch 3) has accessibility concerns (fatigue, dexterity) and the highest
  technical cost in three.js.
- Wilson's fits poorly in pitches 1 and 3, better in 2.

## Repo rules and process

- Never use git worktrees. Always use feature branches.
- Conventional commit format.
- The directory is not yet a git repo (no `git init` done). No product code written yet.
- Internal docs (plans, specs, pitches) do not use the user's /writing-tracy style; that is
  for user-facing docs only.
- Tech: browser-based, three.js.
- Process so far: pitches -> user feedback -> final pitch -> iterate.

## What the user wants from the review

Feedback and suggestions on the three pitches, or an entirely different pitch. Please call out:
- Which battle style best serves "empowered, less fearful" and "fun first".
- How to keep the life choices and the battle genuinely linked.
- Anything in the pitches that misses the success criterion above.
- Whether Wilson's belongs in the same game at all. This is optional, not a requirement, so do
  not penalize a pitch for a poor Wilson's fit. A separate Wilson's game with its own battle
  style is a valid outcome.

## Backlog (from playtests)

- Settings section to toggle off some labels once a player is familiar with the game.
- Playtest 1 (user): the side-panel info card on hover was very helpful; the Key and "How to play" were helpful; telegraph labels were understandable; the "block the spread or attack the mold" choice was real.
