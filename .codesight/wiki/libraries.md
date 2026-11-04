# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**53 library files** across 4 modules

## Sim (24 files)

- `src/sim/life/calendar.ts` — lifeRngSeed, cardRoll, createLife, weekStartEvents, findPlaced, slotCost, …
- `src/sim/battle/orders.ts` — moveRange, swarmMoveRange, validateOrders, orderProblems, withOrder, moveOptions, …
- `src/sim/campaign.ts` — createCampaign, lifeAction, endWeek, battleTurn, syncBattle, carryReservoirs, …
- `src/sim/board.ts` — createBoard, inBounds, tileId, coordOf, sameCoord, compareCoords, …
- `src/sim/life/body.ts` — bodyRoll, symptomDayFor, growthDayOf, toLifeReservoirs, viralFeverDay, scheduledSymptoms, …
- `src/sim/scenarios.ts` — firstBoardLoadout, duelLoadout, lakeWeekLoadout, skirmishLoadout, isScenarioName, loadScenario, …
- `src/sim/battle/support.ts` — chargeCovers, chargeMaxSize, availableCharges, supportProblem, withoutClearedLoad, applySupport, …
- `src/sim/life/loadout.ts` — battleSeed, skirmishExposures, skirmishWaves, fullWaves, loadoutFromLife, battleDue, …
- `src/sim/score.ts` — cardChoices, weekChoices, plannedChoices, weekOutcome, weekScore, campaignScore, …
- `src/sim/life/cards.ts` — exposureKind, isCardId, cardDef, versionsOf, placementCost, CardDef, …
- `src/sim/sessionLog.ts` — createSessionLog, appendEntry, entriesFor, logStep, exportSessionLog, parseSessionLog, …
- `src/sim/pathogens.ts` — isPathogenKindId, pathogenKind, wallOf, PathogenKindDef, Wall, PathogenForm, …
- `src/sim/campaignBots.ts` — thoughtfulPlay, playLifeWeek, playCampaign, CampaignPlan, DoctorPolicy, CampaignBot, …
- `src/sim/battle/bots.ts` — playBattle, BotTurn, Bot, SupportBot, BOTS, SUPPORT_BOTS
- `src/sim/battle/inflammation.ts` — inflammationAt, inflammationChanges, tissueDamageFor, applyInflammation, TileHeat, InflammationCause
- `src/sim/battle/intents.ts` — landingBlockers, stallChance, generateIntents, initBattle, telegraph, TelegraphMark
- `src/sim/battle/resolve.ts` — applyOrders, turnProblems, resolveTurn, inflammationPreview, TurnResult, InflammationPreview
- `src/sim/battle/outcome.ts` — freePathogens, aliveInside, battleStatus, reservoirs, gradeOutcome
- `src/sim/rng.ts` — rngFromSeed, rngNext, rngInt, mulberry32, RngState
- `src/sim/life/bots.ts` — playWeek, WeekPlan, LifeBot, LIFE_BOTS
- `src/sim/life/meds.ts` — medLevelOf, missedDosesOf, streakOf, preWeekDoses
- `src/sim/life/preview.ts` — cardPreview, exposurePreview, CardPreview, WeekPreview
- `src/sim/battle/setup.ts` — chargesFor, medStateFor, battleFromLoadout
- `src/sim/validate.ts` — validateBattle, validateLife, validateCampaign

## Render (15 files)

- `src/render/playback.ts` — buildTimeline, beatProgress, createPlayback, PhaseSpan, Timeline, Playback, …
- `src/render/cellShape.ts` — cellHash, cellOutline, outlineArea, Point2, CELL_POINTS
- `src/render/labels.ts` — setLabelBoost, labelMaterial, sizeLabel, labelSprite, LabelOptions
- `src/render/boardView.ts` — createBoardView, BoardView, ORDER_COLOR
- `src/render/orderView.ts` — createOrderView, DoseMarks, OrderView
- `src/render/pathogenView.ts` — createPathogenView, PathogenView, KIND_COLOR
- `src/render/swarmView.ts` — createSwarmView, SwarmPose, SwarmView
- `src/render/tissueTexture.ts` — basePlaneUnits, createAuraTexture, createTissueTexture
- `src/render/auraView.ts` — createAuraView, AuraView
- `src/render/fxView.ts` — createFxView, FxView
- `src/render/granulomaView.ts` — createGranulomaView, GranulomaView
- `src/render/insetView.ts` — createInsetView, InsetView
- `src/render/playbackView.ts` — createPlaybackView, PlaybackView
- `src/render/scene.ts` — createScene, SceneContext
- `src/render/telegraphView.ts` — createTelegraphView, TelegraphView

## Ui (13 files)

- `src/ui/hud.ts` — createHud, HudOrder, HudMedication, HudCharge, HudSupport, HudSupportCard, …
- `src/ui/lifePanel.ts` — createLifePanel, LifeCardModel, LifeSlotModel, LifeSummaryModel, LifePanelModel, LifePanelHandlers, …
- `src/ui/cardStyle.ts` — cardAccent, cardTint, cardBadge, CardFamily, CARD_FAMILY, CARD_ICON
- `src/ui/debugPanel.ts` — createDebugPanel, DebugLoadout, SessionDebug, DebugPanelOptions, DebugPanel, DebugMode
- `src/ui/outcome.ts` — outcomeHeading, createOutcomeOverlay, OutcomeHandlers, OutcomeExtra, OutcomeOverlay, SKIRMISH_COPY
- `src/ui/statusStrip.ts` — createStatusStrip, cellLabel, StatusCell, StatusModel, StatusStrip, StatusBar
- `src/ui/help.ts` — createHelp, Help, HelpOptions, BATTLE_LINES, LIFE_LINES
- `src/ui/interlude.ts` — createInterlude, ScoreCardModel, InterludeModel, Interlude
- `src/ui/broughtStrip.ts` — createBroughtStrip, BroughtView, BroughtStrip
- `src/ui/infoTip.ts` — createInfoTips, InfoTip, InfoTipFactory
- `src/ui/download.ts` — downloadText, copyText
- `src/ui/index.ts` — getUiRoot, getPanels
- `src/ui/probe.ts` — createProbe, Probe

## Theme (1 files)

- `src/theme/palette.ts` — hex, applyCssTokens, PaletteName, PALETTE

---
_Back to [overview.md](./overview.md)_