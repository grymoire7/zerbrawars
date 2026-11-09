# zebrawars — AI Context Map

> **Stack:** raw-http | none | unknown | typescript

> 0 routes | 0 models | 0 components | 57 lib files | 0 env vars | 0 middleware | 0% test coverage
> **Token savings:** this file is ~4,600 tokens. Without it, AI exploration would cost ~23,900 tokens. **Saves ~19,300 tokens per conversation.**
> **Last scanned:** 2026-11-09 16:03 — re-run after significant changes

---

# Libraries

- `src/render/auraView.ts` — function createAuraView: (scene, extent) => AuraView, interface AuraView
- `src/render/boardView.ts`
  - function createBoardView: (scene, state) => BoardView
  - interface BoardView
  - const ORDER_COLOR
- `src/render/cellShape.ts`
  - function cellHash: (x, y, salt) => number
  - function cellOutline: (x, y) => Point2[]
  - function outlineArea: (pts) => number
  - interface Point2
  - const CELL_POINTS
- `src/render/fxView.ts` — function createFxView: (scene) => FxView, interface FxView
- `src/render/granulomaView.ts` — function createGranulomaView: (scene, tilePosition) => void, interface GranulomaView
- `src/render/insetView.ts` — function createInsetView: (root, state) => InsetView, interface InsetView
- `src/render/labels.ts`
  - function setLabelBoost: (width, height) => void
  - function labelMaterial: (text, {...}, background, 28, 34, 0.9) => void
  - function sizeLabel: (sprite, height) => void
  - function labelSprite: (text, height, opts?) => THREE.Sprite
  - interface LabelOptions
- `src/render/orderView.ts`
  - function createOrderView: (scene, tilePosition) => void
  - interface DoseMarks
  - interface OrderView
- `src/render/pathogenView.ts`
  - function createPathogenView: (scene, tilePosition) => void
  - interface PathogenView
  - const KIND_COLOR: Record<PathogenKindId, number>
- `src/render/playback.ts`
  - function buildTimeline: (before, events) => Timeline
  - function beatProgress: (beat, t) => number
  - function createPlayback: (before, events, after, speed) => Playback
  - interface PhaseSpan
  - interface Timeline
  - interface Playback
  - _...6 more_
- `src/render/playbackView.ts` — function createPlaybackView: (v) => PlaybackView, interface PlaybackView
- `src/render/scene.ts` — function createScene: (canvas, extent) => SceneContext, interface SceneContext
- `src/render/swarmView.ts`
  - function createSwarmView: (scene, tilePosition) => void
  - interface SwarmPose
  - interface SwarmView
- `src/render/telegraphView.ts` — function createTelegraphView: (scene, tilePosition) => void, interface TelegraphView
- `src/render/tissueTexture.ts`
  - function basePlaneUnits: (board) => void
  - function createAuraTexture: (planeUnits) => THREE.CanvasTexture
  - function createTissueTexture: (planeUnits) => THREE.CanvasTexture
- `src/sim/battle/bots.ts`
  - function playBattle: (bot, start, seed, support) => void
  - interface BotTurn
  - type Bot
  - type SupportBot
  - const BOTS: Record<string, Bot>
  - const SUPPORT_BOTS: Record<string, SupportBot>
- `src/sim/battle/inflammation.ts`
  - function inflammationAt: (battle, at) => number
  - function inflammationChanges: (battle, start) => TileHeat[]
  - function tissueDamageFor: (tiles) => number
  - function applyInflammation: (battle, start) => void
  - interface TileHeat
  - type InflammationCause
- `src/sim/battle/intents.ts`
  - function landingBlockers: (battle) => Set<TileId>
  - function stallChance: (aura) => number
  - function generateIntents: (battle) => BattleState
  - function initBattle: (battle) => BattleState
  - function telegraph: (current, orders, support) => TelegraphMark[]
  - interface TelegraphMark
- `src/sim/battle/orders.ts`
  - function moveRange: (swarm, "busyTurns" | "load">, inflammation) => number
  - function swarmMoveRange: (battle, swarm) => number
  - function validateOrders: (battle, orders) => OrderCheck[]
  - function orderProblems: (battle, orders) => string[]
  - function withOrder: (orders, order) => Order[]
  - function moveOptions: (battle, swarmId, orders) => Reach[]
  - _...16 more_
- `src/sim/battle/outcome.ts`
  - function freePathogens: (battle) => number
  - function aliveInside: (battle) => number
  - function battleStatus: (battle) => BattleStatus
  - function reservoirs: (battle) => Reservoir[]
  - function gradeOutcome: (battle) => BattleOutcome
- `src/sim/battle/resolve.ts`
  - function applyOrders: (battle, orders, support, reveal) => void
  - function turnProblems: (battle, orders, support) => string[]
  - function resolveTurn: (battle, orders, support) => TurnResult
  - function inflammationPreview: (battle, orders, support) => InflammationPreview
  - interface TurnResult
  - interface InflammationPreview
- `src/sim/battle/setup.ts`
  - function chargesFor: (medLevel, doctorVisit) => MedCharges
  - function medStateFor: (medLevel, doctorVisit) => MedState
  - function battleFromLoadout: (loadout) => BattleState
- `src/sim/battle/support.ts`
  - function chargeCovers: (charge, kind) => boolean
  - function chargeMaxSize: (charge) => number
  - function availableCharges: (battle) => ChargeKind[]
  - function supportProblem: (battle, orders, support) => string | null
  - function withoutClearedLoad: (battle, support) => BattleState
  - function applySupport: (before, after, orders, support) => void
  - _...4 more_
- `src/sim/board.ts`
  - function createBoard: (width, height) => Board
  - function inBounds: (board, c) => boolean
  - function tileId: (board, c) => TileId
  - function coordOf: (board, id) => Coord
  - function sameCoord: (a, b) => boolean
  - function compareCoords: (a, b) => number
  - _...10 more_
- `src/sim/campaign.ts`
  - function createCampaign: (opts) => CampaignStep
  - function lifeAction: (c, step) => void
  - function endWeek: (c) => CampaignStep
  - function battleTurn: (c, orders, support) => CampaignStep
  - function syncBattle: (c, battle) => CampaignStep
  - function carryReservoirs: (found) => void
  - _...12 more_
- `src/sim/campaignBots.ts`
  - function thoughtfulPlay: (start, seed) => void
  - function playLifeWeek: (c, plan) => Campaign
  - function playCampaign: (bot, seed, opts, "seed">, /** Called with each battle's opening state before it is played (for surveys) => void
  - interface CampaignPlan
  - type DoctorPolicy
  - type CampaignBot
  - _...2 more_
- `src/sim/life/body.ts`
  - function bodyRoll: (seed, week, day, i) => number
  - function symptomDayFor: (size) => number
  - function growthDayOf: (r) => number
  - function toLifeReservoirs: (carried) => LifeReservoir[]
  - function viralFeverDay: (seed, week) => number | null
  - function scheduledSymptoms: (seed, week, reservoirs) => Symptom[]
  - _...5 more_
- `src/sim/life/bots.ts`
  - function planPlacements: (plan) => readonly Placement[]
  - function placeFitting: (life, placements) => LifeState
  - function bestPlacements: (life) => readonly Placement[]
  - function playWeek: (bot, seed) => LifeState
  - interface Placement
  - interface WeekPlan
  - _...2 more_
- `src/sim/life/calendar.ts`
  - function lifeRngSeed: (seed, week) => number
  - function cardRoll: (seed, week, card) => number
  - function createLife: (opts) => LifeState
  - function weekStartEvents: (life) => LifeEvent[]
  - function findPlaced: (life, card) => void
  - function slotCost: (life, day, p) => number
  - _...20 more_
- `src/sim/life/cards.ts`
  - function exposureKind: (card, i) => PathogenKindId
  - function handFor: (_week) => readonly HandCardId[]
  - function isCardId: (id) => id is CardId
  - function cardDef: (id) => CardDef
  - function versionsOf: (base) => CardId[]
  - function placementCost: (card, packPills) => number
  - _...3 more_
- `src/sim/life/loadout.ts`
  - function battleSeed: (life) => number
  - function skirmishExposures: (rng) => Exposure[]
  - function skirmishWaves: (threats) => Pick<Loadout, "exposures" | "arrivals">
  - function fullWaves: (exposures) => Arrival[]
  - function loadoutFromLife: (life) => Loadout
  - function battleDue: (life) => BattleDue
  - _...4 more_
- `src/sim/life/meds.ts`
  - function medLevelOf: (doses) => number
  - function missedDosesOf: (doses) => number
  - function streakOf: (doses) => number
  - function preWeekDoses: (week) => Dose[]
- `src/sim/life/preview.ts`
  - function cardPreview: (_life, card) => CardPreview
  - function exposurePreview: (life) => WeekPreview
  - interface CardPreview
  - interface WeekPreview
- `src/sim/organisms.ts`
  - function organismList: (kinds) => string
  - function formNoun: (form, plural) => string
  - function organismName
  - function organismScientific
  - function organismShort
  - function organismDescription
  - _...6 more_
- `src/sim/pathogens.ts`
  - function isPathogenKindId: (kind) => kind is PathogenKindId
  - function pathogenKind: (kind) => PathogenKindDef
  - function wallOf: (p) => Wall
  - interface PathogenKindDef
  - type Wall
  - type PathogenForm
  - _...2 more_
- `src/sim/rng.ts`
  - function rngFromSeed: (seed) => RngState
  - function rngNext: (rng) => void
  - function rngInt: (rng, n) => void
  - function mulberry32: (seed) => () => number
  - interface RngState
- `src/sim/scenarios.ts`
  - function firstBoardLoadout: (seed, medLevel) => Loadout
  - function duelLoadout: (seed, medLevel) => Loadout
  - function lakeWeekLoadout: (seed, medLevel) => Loadout
  - function skirmishLoadout: (seed, medLevel) => Loadout
  - function tutorialALoadout: (seed) => Loadout
  - function tutorialBLoadout: (seed) => Loadout
  - _...9 more_
- `src/sim/score.ts`
  - function cardChoices: (card) => void
  - function weekChoices: (life) => ChoicesParts
  - function plannedChoices: (life) => ChoicesParts
  - function weekOutcome: (result, carriedCount) => OutcomeParts
  - function weekScore: (life, result, carriedCount) => WeekScore
  - function campaignScore: (weeks) => CampaignScore
  - _...4 more_
- `src/sim/sessionLog.ts`
  - function createSessionLog: (seed, cycles, t) => SessionLog
  - function appendEntry: (log, entry) => SessionLog
  - function entriesFor: (step, t) => SessionEntry[]
  - function logStep: (log, step, t) => SessionLog
  - function exportSessionLog: (log) => string
  - function parseSessionLog: (text) => SessionLog
  - _...3 more_
- `src/sim/validate.ts`
  - function maxTurnsOf: (kind) => number
  - function validateBattle: (battle) => string[]
  - function validateLife: (life) => string[]
  - function validateCampaign: (c) => string[]
- `src/theme/palette.ts`
  - function hex: (name) => number
  - function applyCssTokens: (root) => void
  - type PaletteName
  - const PALETTE
- `src/ui/broughtStrip.ts`
  - function createBroughtStrip: (root, onDismiss) => void
  - interface BroughtView
  - interface BroughtStrip
- `src/ui/cardStyle.ts`
  - function cardAccent: (id) => PaletteName
  - function cardTint: (id) => PaletteName
  - function cardBadge: (id, size) => HTMLElement
  - type CardFamily
  - const CARD_FAMILY: Readonly<Record<string, CardFamily>>
  - const CARD_ICON: Readonly<Record<string, string>>
- `src/ui/coachStrip.ts` — function createCoachStrip: (root, onDismiss) => void, interface CoachStrip
- `src/ui/debugPanel.ts`
  - function createDebugPanel: (root, opts) => DebugPanel
  - interface DebugLoadout
  - interface SessionDebug
  - interface DebugPanelOptions
  - interface DebugPanel
  - type DebugMode
- `src/ui/download.ts` — function downloadText: (name, text) => void, function copyText: (text) => Promise<boolean>
- `src/ui/gameMenu.ts`
  - function createGameMenu: (root, opts) => GameMenu
  - interface GameMenuOptions
  - interface FacilitatorMenu
  - interface GameMenu
- `src/ui/help.ts`
  - function createHelp: (root, opts) => Help
  - interface Help
  - interface HelpOptions
  - const LIFE_SEEN_KEY
  - const HELP_SEEN_KEYS: readonly string[]
  - const BATTLE_LINES: readonly (readonly [string, string])[]
  - _...1 more_
- `src/ui/hud.ts`
  - function createHud: (mounts, handlers, options) => Hud
  - interface HudOrder
  - interface HudMedication
  - interface HudCharge
  - interface HudSupport
  - interface HudSupportCard
  - _...12 more_
- `src/ui/index.ts` — function getUiRoot: () => HTMLElement, function getPanels: () => void
- `src/ui/infoTip.ts`
  - function createInfoTips: () => InfoTipFactory
  - interface InfoTip
  - type InfoTipFactory
- `src/ui/interlude.ts`
  - function createInterlude: (root) => Interlude
  - interface ScoreCardModel
  - interface InterludeModel
  - interface Interlude
- `src/ui/lifePanel.ts`
  - function createLifePanel: (mounts, h) => LifePanel
  - interface LifeCardModel
  - interface LifeSlotModel
  - interface LifeSummaryModel
  - interface LifePanelModel
  - interface LifePanelHandlers
  - _...1 more_
- `src/ui/menu.ts`
  - function createMenu: (root) => Menu
  - interface MenuItem
  - interface MenuModel
  - interface Menu
- `src/ui/outcome.ts`
  - function outcomeHeading: (grade, reason) => void
  - function createOutcomeOverlay: (root, handlers) => OutcomeOverlay
  - interface OutcomeHandlers
  - interface OutcomeExtra
  - interface CompareRow
  - interface ArcCard
  - _...3 more_
- `src/ui/probe.ts` — function createProbe: (root) => Probe, interface Probe
- `src/ui/statusStrip.ts`
  - function createStatusStrip: (mount) => StatusStrip
  - function cellLabel
  - interface StatusCell
  - interface StatusModel
  - interface StatusStrip
  - type StatusBar

---

# Config

## Config Files

- `tsconfig.json`
- `vite.config.ts`

---

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
- `src/sim/life/types.ts` — imported by **16** files
- `src/theme/palette.ts` — imported by **16** files
- `src/sim/validate.ts` — imported by **16** files
- `src/sim/campaign.ts` — imported by **15** files
- `src/sim/organisms.ts` — imported by **15** files
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

---

# Test Coverage

> **0%** of routes and models are covered by tests
> 48 test files found

---

# Git Hooks

> **Note for agents:** These hooks fire automatically on git operations and will block the operation if they fail.

## `pre-commit` — raw git hook

- **npx**: `npx codesight --wiki -o .codesight`
- **git**: `git add .codesight/`

_Source: .git/hooks/pre-commit_

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_