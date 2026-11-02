# Dependency Graph

## Most Imported Files (change these carefully)

- `src/sim/params.ts` — imported by **42** files
- `src/sim/types.ts` — imported by **42** files
- `src/sim/pathogens.ts` — imported by **21** files
- `src/sim/rng.ts` — imported by **18** files
- `src/sim/battle/setup.ts` — imported by **17** files
- `src/sim/scenarios.ts` — imported by **17** files
- `src/sim/board.ts` — imported by **17** files
- `src/sim/battle/intents.ts` — imported by **15** files
- `src/sim/life/loadout.ts` — imported by **15** files
- `src/sim/validate.ts` — imported by **14** files
- `src/sim/life/types.ts` — imported by **13** files
- `src/sim/battle/resolve.ts` — imported by **13** files
- `src/sim/campaign.ts` — imported by **12** files
- `src/theme/palette.ts` — imported by **12** files
- `src/sim/battle/outcome.ts` — imported by **11** files
- `src/sim/life/cards.ts` — imported by **8** files
- `src/sim/life/calendar.ts` — imported by **7** files
- `src/app/run.ts` — imported by **7** files
- `src/sim/battle/orders.ts` — imported by **6** files
- `src/sim/battle/bots.ts` — imported by **6** files

## Import Map (who imports what)

- `src/sim/params.ts` ← `src/app/battleScreen.ts`, `src/app/campaignModel.test.ts`, `src/app/campaignModel.ts`, `src/app/controller.ts`, `src/app/info.ts` +37 more
- `src/sim/types.ts` ← `src/app/battleScreen.ts`, `src/app/campaignModel.ts`, `src/app/controller.test.ts`, `src/app/info.test.ts`, `src/app/info.ts` +37 more
- `src/sim/pathogens.ts` ← `src/app/controller.ts`, `src/app/info.ts`, `src/app/lifeModel.ts`, `src/render/insetView.ts`, `src/sim/battle/bots.ts` +16 more
- `src/sim/rng.ts` ← `src/sim/battle/bots.ts`, `src/sim/battle/engulf.test.ts`, `src/sim/battle/hidden.test.ts`, `src/sim/battle/intents.ts`, `src/sim/battle/orders.test.ts` +13 more
- `src/sim/battle/setup.ts` ← `src/app/battleScreen.ts`, `src/app/interludeScreen.ts`, `src/app/lifeScreen.ts`, `src/app/loadoutOptions.test.ts`, `src/app/main.ts` +12 more
- `src/sim/scenarios.ts` ← `src/app/battleScreen.ts`, `src/app/controller.test.ts`, `src/app/info.test.ts`, `src/app/loadoutOptions.ts`, `src/app/main.ts` +12 more
- `src/sim/board.ts` ← `src/app/controller.ts`, `src/app/info.ts`, `src/render/boardView.ts`, `src/render/orderView.ts`, `src/sim/battle/bots.ts` +12 more
- `src/sim/battle/intents.ts` ← `src/app/battleScreen.ts`, `src/app/controller.ts`, `src/app/info.test.ts`, `src/app/info.ts`, `src/render/telegraphView.ts` +10 more
- `src/sim/life/loadout.ts` ← `src/app/campaignModel.ts`, `src/app/interludeScreen.ts`, `src/app/lifeScreen.ts`, `src/app/loadoutOptions.ts`, `src/app/run.ts` +10 more
- `src/sim/validate.ts` ← `src/sim/battle/balance.test.ts`, `src/sim/battle/engulf.test.ts`, `src/sim/battle/hidden.test.ts`, `src/sim/battle/orders.test.ts`, `src/sim/battle/outcome.test.ts` +9 more
