/** Every tunable number in one place. Values marked placeholder are unused until their task lands. */
export const PARAMS = {
  boardWidth: 7,
  boardHeight: 7,
  swarmCount: 3,
  /**
   * Steps a free swarm can move per turn. 3 lets a swarm on the near edge reach row 3 on turn 1,
   * just in time to stand in a fresh strep spread, but covers at most half a 7x7 board, so a mold
   * spore 3-4 tiles out still has to be anticipated. Load (T5) and inflammation (T7) cut it to 2
   * or 1, which stays readable.
   */
  swarmMoveRange: 3,
  /**
   * Contained pathogens a swarm can hold (a count, not total size). 2 keeps the cap binding with
   * 3 swarms. A full swarm can still engulf leaky pathogens, which die instead of loading.
   */
  loadCap: 2,
  /** Moves lost per contained pathogen: range 3, then 2, then 1. */
  loadedMovePenalty: 1,
  /** Load never slows a free swarm below this. */
  minLoadedMoveRange: 1,
  /**
   * Chance an engulfed sealed pathogen dies instead of loading (residual oxidase activity).
   * XL-like default; the debug panel overrides it per battle via BattleState.residualKillChance.
   */
  residualKillChance: 0.1,
  maxPathogenSize: 4,
  /**
   * Per-kind intent behaviour. A pathogen of at least `actMinSize` acts (spreads, or spores if
   * its kind canSpore) with `actChance`, otherwise grows; at max size it always acts if it can.
   * `actCost` is subtracted from the parent's size when the action lands.
   */
  intents: {
    // Bacteria: fast and local. A fresh size-1 bud must grow once before it can spread, which is
    // the player's window; at size 2+ it usually spreads, so an ignored cluster fans out.
    strep: {
      growAmount: 1,
      actMinSize: 2,
      actChance: 0.6,
      actCost: 0,
      childSize: 1,
      sporeMinDistance: 0,
      sporeMaxDistance: 0,
    },
    // Mold: never spreads locally. It grows to 3, then throws a spore 3-4 tiles away and shrinks
    // by 1, so it pulses grow, spore, grow and its threat is a far tile the player must cover.
    aspergillus: {
      growAmount: 1,
      actMinSize: 3,
      actChance: 0.7,
      actCost: 1,
      childSize: 1,
      sporeMinDistance: 3,
      sporeMaxDistance: 4,
    },
    // Staph: a slow abscess. It grows to 3, then seeds a neighbour and shrinks by 1, so it never
    // fans out like strep, but every bud is sealed: engulfing only contains it.
    staph: {
      growAmount: 1,
      actMinSize: 3,
      actChance: 0.5,
      actCost: 1,
      childSize: 1,
      sporeMinDistance: 0,
      sporeMaxDistance: 0,
    },
  },
  /**
   * Turns a swarm stays busy after the turn it walls off (it cannot move, engulf or wall off).
   * The wall-off turn itself is spent too, so walling costs the swarm two turns of action.
   */
  wallOffBusyTurns: 1,
  /**
   * Per-tile inflammation, an integer 0..maxInflammation, ticked once a turn after the pathogens
   * act. A tile rises by the sum of its causes, otherwise it decays:
   * - crowding: each swarm adds `crowdRise` to its tile per other swarm touching it (8
   *   neighbours, so diagonal counts). Three swarms in a clump heat the middle one by 2. The
   *   starting line (two tiles apart) does not crowd.
   * - load: a swarm carrying anything adds `loadRise` to its tile, so a loaded swarm that stands
   *   still heats up (1, 2, 3) while one that keeps moving leaves only 1s that fade.
   * - infection: each visible pathogen adds `pathogenRise` to its own tile, so an ignored
   *   pathogen costs 0, 1, then 2 tissue a turn.
   * - granuloma: adds `granulomaRise` the turn it is walled, and its tile never decays below
   *   `granulomaInflammation`. Walling a load that was heating its tile costs about 1 tissue.
   * Effects: a swarm starting its turn on a tile at `slowThreshold`+ loses `inflammationMovePenalty`
   * moves (never below minLoadedMoveRange); every tile drains `damagePerLevel` tissue health per
   * level above `damageThreshold` each tick. Pathogens never read inflammation, so the telegraph
   * stays exact.
   */
  maxInflammation: 3,
  inflammation: {
    crowdRise: 1,
    loadRise: 1,
    pathogenRise: 1,
    granulomaRise: 1,
    granulomaInflammation: 1,
    decay: 1,
    slowThreshold: 2,
    inflammationMovePenalty: 1,
    damageThreshold: 1,
    damagePerLevel: 1,
  },
  /**
   * Each turn a swarm carries a sealed pathogen loaded on an earlier turn, it gets the residual
   * kill roll again (times this scale), so a carried load can still die. This is the only road to
   * "cleared" once a sealed pathogen is engulfed. Walled contents never roll: walling trades the
   * chance to clear for a free swarm. 1 = the same per-character chance; 0 turns it off.
   */
  carriedKillScale: 1,
  /**
   * Medicine finishes what was swallowed: a carried roll's chance is the battle's residual chance
   * (times carriedKillScale) plus `medBonus` x the medication level (0..1), capped at 1. Full
   * meds add this much; skipped doses add nothing. Only carried rolls get it; the roll made at
   * the engulf itself stays the residual alone. No growth inside the cell in the beta.
   */
  carried: { medBonus: 0.25 },
  /**
   * Medication in battle (T10). Med level is 0..1 from adherence; the aura equals it.
   * - auraStallChance: the stall chance per visible pathogen per turn at a full aura. It scales
   *   linearly with the aura and is under 1, so meds slow pathogens but never stop them.
   * - chargeTiers: charges for a level, the first tier whose minLevel the level reaches. A full
   *   week of doses buys two antifungal charges (enough to finish a mold and its spore without
   *   dice) and an antibacterial; a few missed doses leave one antifungal, which only buys time;
   *   under 0.4, none. Tuned in battle/balance.test.ts.
   * - doctorStrongCharges: strong charges a doctor visit adds (it also reveals hidden tokens).
   * - chargeMaxSize: the biggest pathogen (on the board or carried) an antibacterial or antifungal
   *   charge kills. A mold at spore size is too big until it spores (and shrinks), so "wait and
   *   charge it" competes with "engulf it now". strongMaxSize is the same for the doctor's charge.
   */
  meds: {
    auraStallChance: 0.3,
    chargeMaxSize: 2,
    strongMaxSize: 4,
    chargeTiers: [
      { minLevel: 0.8, antibacterial: 1, antifungal: 2 },
      { minLevel: 0.4, antibacterial: 0, antifungal: 1 },
      { minLevel: 0, antibacterial: 0, antifungal: 0 },
    ],
    doctorStrongCharges: 1,
  },
  /**
   * Battle setup from a Loadout (T9). Exposures and reservoirs without a tile take the first free
   * tile of their list. Exposures arrive from the far half; reservoirs sit mid-board, two rows
   * from the swarms' start line so no token starts next to a swarm. At most `maxReservoirs`
   * carried reservoirs start a battle (the plan's snowball cap).
   */
  setup: {
    swarmStarts: [
      { x: 1, y: 6 },
      { x: 3, y: 6 },
      { x: 5, y: 6 },
    ],
    /**
     * Doors: where exposures and skirmish threats enter, on the far edge (row 0 or the side
     * columns, rows 0-2). Each is 5+ steps from every swarm start, one more than a swarm can
     * move (3) and engulf (1) in a turn, so nothing can be touched on turn 1 and first contact is
     * on turn 2. Exposures without a card tile take the first free door.
     */
    doors: [
      { x: 1, y: 0 },
      { x: 5, y: 0 },
      { x: 3, y: 0 },
      { x: 6, y: 2 },
      { x: 0, y: 2 },
      { x: 3, y: 1 },
      { x: 0, y: 1 },
      { x: 6, y: 1 },
    ],
    reservoirTiles: [
      { x: 2, y: 4 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
      { x: 6, y: 2 },
    ],
    maxReservoirs: 2,
  },
  /**
   * Arrivals (battle-depth slice 2). A full battle's exposures each send a second group `delay`
   * turns in (turn 1 + delay), for at most `maxSecondGroups` of them, of size exposure size -
   * `sizeDrop` (at least 1), to a free door from setup.doors. A skirmish puts `skirmishFirst` of
   * its threats on the board at the start; the rest arrive `skirmishDelay` turns in, at the tile
   * they were drawn on, early enough to be fought inside its 4 turns. Tuned with the survey in
   * sim/battleDepth.balance.test.ts.
   */
  waves: {
    delay: 3,
    sizeDrop: 1,
    maxSecondGroups: 4,
    skirmishDelay: 2,
    skirmishFirst: 1,
  },
  maxTissueHealth: 20,
  /**
   * A full battle ends after this many turns, or sooner on "all clear" (no visible pathogen left)
   * or at the backup line (outcome.backupTissueHealth).
   */
  maxTurns: 6,
  outcome: {
    /**
     * At or below this tissue health backup arrives at once: the battle ends and the grade is
     * neededBackup whatever else is true. Half of 20:
     * a do-nothing battle loses all 20; careful play typically ends at 16-17.
     */
    backupTissueHealth: 10,
    /** Energy carried into the life phase per grade (T13). */
    energy: { cleared: 3, contained: 2, neededBackup: 1 },
  },
  /**
   * The life phase (T11): three days of two slots (day, evening) and a hand of four cards, each
   * played at most once, in its own or its smarter version. An empty slot is rest.
   * - goalTarget: points that fill the goal meter. The smarter week scores exactly 12 (all four
   *   activities, the sleepover included), so the friction event
   *   is part of the route; the all-risky week scores 14.
   * - Energy (game-only, labelled as such): cards cost it when their day ends, rest refunds
   *   `restEnergy`, packing the pills costs `packPillsEnergy`. The plan's running balance may never
   *   go below 0, so a low-energy week has to rest a slot it would have filled. What is left
   *   carries into the Loadout (the battle ignores it) and on into the next week (T13). A first week
   *   starts at `startEnergy`: all four cards cost 6, two rests refund 2, which leaves exactly 1
   *   for the pills.
   * - meds.window: the med level is the share of doses taken over the last `window` days (pre-week
   *   days count as taken). With 3, one miss in the week gives 0.67 at battle time (one antifungal
   *   charge instead of 1 + 2), two give 0.33 (no charges), and a miss leaves the window three days
   *   later, so the aura dims for as long as the dose would have lasted.
   * - cards: tuning per card. `chance` is the honest landing odds of the card's exposure, rolled
   *   once when its day ends; when it lands it brings `count` pathogens of `size`, entering at the
   *   first free tile of `at` (then PARAMS.setup.doors). Risky versions pay more points
   *   than their smarter versions. Tuned in life/balance.test.ts. The lake brings one strep and
   *   one staph (cards.ts lists the kinds), so only the antibacterial charge of a full week kills
   *   its sealed half. The yard's mold arrives at size 2, inside chargeMaxSize, so each charge tier
   *   counts on the risky week: full meds kill both sealed exposures with charges, one miss (one
   *   antifungal) still kills the mold, two misses leave both to the swarms.
   * - battleSeedSalt: mixed with the life seed and week into the battle seed, so the same seed and
   *   week always fight with the same battle dice whatever was played.
   */
  life: {
    days: 3,
    slotsPerDay: 2,
    goalTarget: 12,
    startEnergy: 5,
    maxEnergy: 6,
    restEnergy: 1,
    packPillsEnergy: 1,
    meds: {
      window: 3,
      /** Chance a dose slips, by what disrupted the routine; rolled once per seed, week and day. */
      slip: { lateNight: 0.5 },
    },
    cards: {
      yard: {
        points: 4,
        energy: 2,
        chance: 0.45,
        size: 2,
        count: 1,
        at: [{ x: 5, y: 0 }],
      },
      yardIndoor: {
        points: 3,
        energy: 2,
        chance: 0.1,
        size: 1,
        count: 1,
        at: [{ x: 5, y: 0 }],
      },
      lake: {
        points: 5,
        energy: 2,
        chance: 0.45,
        size: 2,
        count: 2,
        at: [
          { x: 1, y: 0 },
          { x: 3, y: 0 },
        ],
      },
      beach: {
        points: 4,
        energy: 2,
        chance: 0.15,
        size: 1,
        count: 1,
        at: [{ x: 1, y: 0 }],
      },
      band: {
        points: 2,
        energy: 1,
        chance: 0.05,
        size: 1,
        count: 1,
        at: [{ x: 6, y: 2 }],
      },
      sleepover: {
        points: 3,
        energy: 1,
        chance: 0.1,
        size: 1,
        count: 1,
        at: [{ x: 0, y: 2 }],
      },
      /** Evening only; a late night, so its day's pills may slip (meds.slip.lateNight). */
      game: {
        points: 3,
        energy: 1,
        chance: 0.05,
        size: 1,
        count: 1,
        at: [{ x: 6, y: 1 }],
      },
      /** Same evening, home by 11: no late night, so no slip. Same landing odds as band. */
      gameEarly: {
        points: 2,
        energy: 1,
        chance: 0.05,
        size: 1,
        count: 1,
        at: [{ x: 6, y: 1 }],
      },
      /** Only in hand once a symptom shows; its energy is set by PARAMS.campaign.doctor. */
      doctor: {
        points: 0,
        energy: 0,
        chance: 0,
        size: 1,
        count: 0,
        at: [],
      },
    },
    battleSeedSalt: 0x5bd1e995,
  },
  /**
   * The campaign (T13): life week, a battle (full or skirmish), the outcome, then the next week.
   * - cycles: weeks in a campaign.
   * - carry: at the carry, unkilled sealed pathogens (swarm loads, granuloma contents, hidden
   *   tokens) become reservoirs. Biggest first (ties keep load, granuloma, hidden order), at most
   *   `maxReservoirs` are kept and the rest are dropped (the body clears the small stuff), and each
   *   is cut to `maxSize`: a reservoir is a smouldering remnant, not a full infection. Free
   *   pathogens never carry: "needed backup" means help arrived and dealt with them.
   * - energy: next week starts with what was left + `weekRecovery` + the outcome's energy
   *   (PARAMS.outcome.energy, skirmish.energy, or `quietWeekEnergy` with no battle), capped at
   *   life.maxEnergy.
   * - skirmish: the body is always on patrol. A week with no exposure, no flare and no doctor
   *   finding still ends in a short battle: `threats.min`..`threats.max` leaky `threats.kind` of
   *   `threats.size` on distinct `tiles` (count and tiles rolled from the week-end life rng),
   *   over `maxTurns` turns. No sealed threat (it could only load or carry) and carried reservoirs
   *   stay off its board, so a skirmish never creates or touches a reservoir. Clearing it pays
   *   `energy.cleared` (below a full clear's 3); loose germs at the end pay `energy.loose` and
   *   the next week opens with a flavor aftermath (worn out, or a spot flaring up) that takes
   *   `aftermathEnergy` energy. The aftermath is not a symptom: it never brings the doctor.
   * - quietWeekEnergy: the one week with no battle left, a doctor visit that found only a virus
   *   (and nothing landed). The visit already was the week's beat, so it gets no skirmish; it
   *   pays the same as a cleared skirmish, so checking a fever never costs the week's reward.
   * - symptoms: each carried reservoir surfaces on the morning of day `earlyDay` if its size is at
   *   least `earlySize`, else on day `lateDay`, as a low fever (mold) or a sore spot (bacteria).
   *   Carrying a total size of `tiredTotal`+ also starts the week tired: `tiredEnergy` less energy.
   *   With chance `viralChance` a week also brings a viral low fever on a rolled day (unless a
   *   reservoir fever is already due), so a fever is never proof of a reservoir, nor of nothing.
   * - growth: an untreated reservoir grows by `growth` at the end of its early window (the day
   *   its symptom shows + doctor.earlyDays). A doctor visit by then stops it.
   * - flare: at each day end an unflared reservoir flares with chance
   *   `flare.perDay` * (day + 1) + `flare.perSize` * (size - 1), until the doctor is seen. A flare
   *   makes a full battle due and that token starts visible; unflared ones start hidden. A week
   *   with no exposure, no flare and no doctor finding skirmishes, and its reservoirs carry on
   *   (grown).
   * - doctor: the doctor card comes into hand with the first symptom and takes a slot. Within
   *   `earlyDays` of that symptom it is early and costs `earlyEnergy` (-1: as restful as the rest
   *   it replaces, so an early visit costs only the slot); later it costs `lateEnergy` and the
   *   reservoir has grown meanwhile. Either way it reveals every token, adds
   *   PARAMS.meds.doctorStrongCharges strong charges and makes the battle due, so the reservoir is
   *   fought on the player's terms. With no reservoir the fever was viral: the visit gives back
   *   `viralRefund` more energy (reassurance), so checking a fever never costs more than resting.
   * - weekRecovery is 4 so a contained week (2) still starts the next one at the 6 cap, where the
   *   full hand plus an early visit fits; a backup week (1) starts at 5 and has to drop a card.
   */
  campaign: {
    cycles: 2,
    carry: { maxReservoirs: 2, maxSize: 2 },
    weekRecovery: 4,
    quietWeekEnergy: 2,
    skirmish: {
      maxTurns: 4,
      threats: { min: 2, max: 3, kind: "strep", size: 1 },
      tiles: [
        { x: 1, y: 0 },
        { x: 5, y: 0 },
        { x: 3, y: 1 },
        { x: 0, y: 2 },
        { x: 6, y: 2 },
        { x: 3, y: 0 },
      ],
      energy: { cleared: 2, loose: 1 },
      aftermathEnergy: 1,
    },
    symptoms: {
      earlySize: 2,
      earlyDay: 0,
      lateDay: 1,
      tiredTotal: 3,
      tiredEnergy: 1,
      viralChance: 0.25,
    },
    growth: 1,
    flare: { perDay: 0.12, perSize: 0.08 },
    doctor: { earlyDays: 1, earlyEnergy: -1, lateEnergy: 1, viralRefund: 1 },
    bodySalt: 0x27d4eb2f,
    /** Mixed into the per-card exposure dice (seed + week + card). */
    diceSalt: 0x7f4a7c15,
    weekSalt: 0x165667b1,
  },
  /**
   * Score (B1a, docs/specs/b1a-design.md section 1). Two parts per week, never negative, nothing
   * subtracted. Choices (no luck): `perPoint` per life point, `perDodgedPercent` per percentage
   * point of landing chance a smarter card avoids against its base card (the numbers printed on
   * the card faces, rounded per card), `perDose` per dose the plan keeps safe ("Routine kept": a day
   * counts one minus its slip chance), `goal` for meeting the life-points goal, and `checked` for seeing the doctor when
   * a symptom showed (a viral visit pays the same, so checking a fever is never wasted). Outcome
   * (luck plays a part): `perTissue` per tissue health kept (a quiet week counts as full), the
   * fight by result (`fight` by grade for a full battle, `skirmish` cleared or loose, `quiet`),
   * and `carryClear` minus `perCarried` per reservoir carried on. Bump `version` whenever a
   * weight or tuning that moves the measured ranges changes, so best scores stay comparable.
   */
  score: {
    version: 4,
    perPoint: 10,
    perDodgedPercent: 0.5,
    goal: 40,
    perDose: 30,
    checked: { early: 20, late: 10 },
    perTissue: 2,
    fight: { cleared: 40, contained: 20, neededBackup: 10 },
    skirmish: { cleared: 40, loose: 20 },
    quiet: 40,
    carryClear: 20,
    perCarried: 10,
  },
  defaultSeed: 1,
} as const;
