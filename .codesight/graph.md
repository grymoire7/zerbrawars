# Dependency Graph

## Most Imported Files (change these carefully)

- `src/sim/params.ts` — imported by **54** files
- `src/sim/types.ts` — imported by **53** files
- `src/sim/pathogens.ts` — imported by **28** files
- `src/sim/scenarios.ts` — imported by **20** files
- `src/sim/battle/setup.ts` — imported by **20** files
- `src/sim/battle/intents.ts` — imported by **18** files
- `src/sim/board.ts` — imported by **18** files
- `src/sim/rng.ts` — imported by **18** files
- `src/sim/battle/outcome.ts` — imported by **16** files
- `src/sim/life/loadout.ts` — imported by **16** files
- `src/sim/battle/resolve.ts` — imported by **16** files
- `src/theme/palette.ts` — imported by **16** files
- `src/sim/validate.ts` — imported by **16** files
- `src/sim/organisms.ts` — imported by **15** files
- `src/sim/life/types.ts` — imported by **14** files
- `src/sim/campaign.ts` — imported by **13** files
- `src/app/run.ts` — imported by **11** files
- `src/sim/life/cards.ts` — imported by **11** files
- `src/app/arcs.ts` — imported by **10** files
- `src/sim/battle/bots.ts` — imported by **10** files

## Import Map (who imports what)

- `src/sim/params.ts` ← `src/app/arcModel.test.ts`, `src/app/arcModel.ts`, `src/app/battleModel.test.ts`, `src/app/battleModel.ts`, `src/app/campaignModel.test.ts` +49 more
- `src/sim/types.ts` ← `src/app/arrivalModel.test.ts`, `src/app/arrivalModel.ts`, `src/app/battleModel.ts`, `src/app/battleScreen.ts`, `src/app/campaignModel.ts` +48 more
- `src/sim/pathogens.ts` ← `src/app/arrivalModel.ts`, `src/app/battleScreen.ts`, `src/app/coachModel.ts`, `src/app/info.ts`, `src/app/lifeModel.ts` +23 more
- `src/sim/scenarios.ts` ← `src/app/arcs.ts`, `src/app/arrivalModel.test.ts`, `src/app/coachModel.test.ts`, `src/app/controller.test.ts`, `src/app/info.test.ts` +15 more
- `src/sim/battle/setup.ts` ← `src/app/arrivalModel.test.ts`, `src/app/battleScreen.ts`, `src/app/interludeScreen.ts`, `src/app/lifeScreen.ts`, `src/app/loadoutOptions.test.ts` +15 more
- `src/sim/battle/intents.ts` ← `src/app/arrivalModel.test.ts`, `src/app/arrivalModel.ts`, `src/app/battleScreen.ts`, `src/app/controller.ts`, `src/app/info.test.ts` +13 more
- `src/sim/board.ts` ← `src/app/controller.ts`, `src/app/info.ts`, `src/render/boardView.ts`, `src/render/orderView.ts`, `src/sim/battle/arrivals.test.ts` +13 more
- `src/sim/rng.ts` ← `src/sim/battle/bots.ts`, `src/sim/battle/engulf.test.ts`, `src/sim/battle/hidden.test.ts`, `src/sim/battle/intents.ts`, `src/sim/battle/orders.test.ts` +13 more
- `src/sim/battle/outcome.ts` ← `src/app/battleScreen.ts`, `src/app/controller.ts`, `src/render/playback.test.ts`, `src/sim/battle/arrivals.test.ts`, `src/sim/battle/bots.ts` +11 more
- `src/sim/life/loadout.ts` ← `src/app/campaignModel.ts`, `src/app/interludeScreen.ts`, `src/app/lifeScreen.ts`, `src/app/loadoutOptions.ts`, `src/app/run.ts` +11 more
