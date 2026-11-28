import type { BroadcastPlayer, FriendTeam } from "../types/auction";

export type PitchCondition = "Green" | "Dusty" | "Dead";
export type WicketRule = "LAST_MAN_STANDS" | "THREE_WICKETS_ALL_OUT";
export type BotDifficulty = "Easy" | "Medium" | "Hard";
export type BowlingLength = "Yorker" | "Full" | "Good" | "Short";
export type BowlingLine = "Off" | "Middle" | "Leg";
export type ShotType = "Defend" | "Rotate" | "Drive" | "Loft" | "Slog";
export type TimingGrade =
  | "PERFECT"
  | "GOOD_EARLY"
  | "GOOD_LATE"
  | "TOO_EARLY"
  | "TOO_LATE"
  | "MISSED";

export const SHOT_AGGRESSION: Record<ShotType, number> = {
  Defend: 0,
  Rotate: 0.3,
  Drive: 0.55,
  Loft: 0.8,
  Slog: 1.0,
};

export interface MatchPlayer extends BroadcastPlayer {
  paidCr?: number;
}

export interface MatchTeamLineup {
  teamId: string;
  code: string;
  name: string;
  kit: FriendTeam["kit"];
  captainId: number;
  players: MatchPlayer[]; // Playing 4
}

export interface BatterInningsStats {
  playerId: number;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalText?: string;
}

export interface BowlerInningsStats {
  playerId: number;
  name: string;
  legalBalls: number;
  runsConceded: number;
  wickets: number;
  wides: number;
  noBalls: number;
}

export interface DeliveryInput {
  length: BowlingLength;
  line: BowlingLine;
  releaseAccuracy: number; // 0..1 (1 = perfect green sweet-spot)
  shotType: ShotType;
  timing: number; // 0..1 (1 = dead center green sweet-spot)
  timingGrade?: TimingGrade;
  lofted?: boolean;
  stepOut?: boolean;
  catchAttempt?: "CAUGHT" | "DROPPED";
  throwQuality?: "PERFECT" | "GOOD" | "WAYWARD";
  throwEnd?: "STRIKER" | "NON_STRIKER";
}

export interface BallOutcome {
  ballNumberInOver: number;
  overNumber: number; // 1..6 (or 1 for Super Over)
  runs: number; // batter runs off bat
  extraRuns: number;
  totalBallRuns: number;
  extraType: "NONE" | "WIDE" | "NO_BALL";
  isLegalBall: boolean;
  isWicket: boolean;
  wicketKind?: "BOWLED" | "CAUGHT" | "LBW" | "RUN_OUT";
  wasFreeHit: boolean;
  isFreeHitNext: boolean;
  shotType: ShotType;
  length: BowlingLength;
  line: BowlingLine;
  timingGrade: TimingGrade;
  ballSpeedKmh: number;
  shotDistanceM?: number;
  batterId: number;
  batterName: string;
  nonStrikerId: number | null;
  bowlerId: number;
  bowlerName: string;
  commentary: string;
}

export interface InningsState {
  inningsNumber: 1 | 2;
  isSuperOver: boolean;
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  maxOvers: number; // 6 normal, 1 super over
  maxWickets: number; // 4 Last-Man-Stands or 3 All-Out (2 in Super Over)
  lastManStands: boolean;
  strikerId: number;
  nonStrikerId: number | null;
  nextBatterIndex: number;
  currentBowlerId: number;
  lastCompletedBowlerId: number | null;
  lastLengthInOver: BowlingLength | null;
  isFreeHit: boolean;
  targetRuns: number | null;
  currentOverBalls: BallOutcome[];
  ballLog: BallOutcome[];
  batterStats: Record<number, BatterInningsStats>;
  bowlerStats: Record<number, BowlerInningsStats>;
  completed: boolean;
}

export interface MatchConfig {
  seed: number;
  pitch: PitchCondition;
  wicketRule: WicketRule;
  oversPerInnings?: number;
  botDifficulty?: BotDifficulty;
}

export interface MatchState {
  id: string;
  config: MatchConfig;
  rngState: number;
  teamA: MatchTeamLineup;
  teamB: MatchTeamLineup;
  tossWinnerId: string;
  tossDecision: "BAT" | "BOWL";
  phase: "INNINGS_1" | "INNINGS_BREAK" | "INNINGS_2" | "SUPER_OVER_1" | "SUPER_OVER_2" | "COMPLETE";
  innings1: InningsState;
  innings2: InningsState | null;
  superOver1: InningsState | null;
  superOver2: InningsState | null;
  winnerTeamId: string | null;
  resultText: string;
}

/** Deterministic 32-bit PRNG step (Mulberry32). Returns [value in [0,1), nextState]. */
export function nextRandom(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) | 0;
  const nextState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const val = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [val, nextState];
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function formatOvers(legalBalls: number): string {
  const ov = Math.floor(legalBalls / 6);
  const b = legalBalls % 6;
  return `${ov}.${b}`;
}

export function gradeTiming(timing: number, signedOffset = 0): TimingGrade {
  if (timing >= 0.86) return "PERFECT";
  if (timing >= 0.64) return signedOffset < 0 ? "GOOD_EARLY" : "GOOD_LATE";
  if (timing >= 0.38) return signedOffset < 0 ? "TOO_EARLY" : "TOO_LATE";
  return "MISSED";
}

export function createInnings(
  inningsNumber: 1 | 2,
  batting: MatchTeamLineup,
  bowling: MatchTeamLineup,
  config: MatchConfig,
  targetRuns: number | null,
  isSuperOver = false,
): InningsState {
  const maxOvers = isSuperOver ? 1 : config.oversPerInnings ?? 6;
  const maxWickets = isSuperOver
    ? 2
    : config.wicketRule === "THREE_WICKETS_ALL_OUT"
    ? 3
    : 4;
  const lastManStands = !isSuperOver && config.wicketRule !== "THREE_WICKETS_ALL_OUT";

  const batterStats: Record<number, BatterInningsStats> = {};
  for (const p of batting.players) {
    batterStats[p.id] = {
      playerId: p.id,
      name: p.name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
    };
  }

  const bowlerStats: Record<number, BowlerInningsStats> = {};
  for (const p of bowling.players) {
    bowlerStats[p.id] = {
      playerId: p.id,
      name: p.name,
      legalBalls: 0,
      runsConceded: 0,
      wickets: 0,
      wides: 0,
      noBalls: 0,
    };
  }

  const openingBowler = selectSmartBowler(bowling.players, bowlerStats, null, maxOvers, 0);

  return {
    inningsNumber,
    isSuperOver,
    battingTeamId: batting.teamId,
    bowlingTeamId: bowling.teamId,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    maxOvers,
    maxWickets,
    lastManStands,
    strikerId: batting.players[0].id,
    nonStrikerId: batting.players[1]?.id ?? null,
    nextBatterIndex: 2,
    currentBowlerId: openingBowler.id,
    lastCompletedBowlerId: null,
    lastLengthInOver: null,
    isFreeHit: false,
    targetRuns,
    currentOverBalls: [],
    ballLog: [],
    batterStats,
    bowlerStats,
    completed: false,
  };
}

export function getEligibleBowlers(
  bowlingLineup: MatchTeamLineup,
  innings: InningsState,
): MatchPlayer[] {
  const maxBallsPerBowler = innings.isSuperOver ? 6 : 12; // max 2 overs per bowler
  const oversBowled = Math.floor(innings.legalBalls / 6);
  const oversRemaining = innings.maxOvers - oversBowled;

  const baseEligible = bowlingLineup.players.filter((p) => {
    const st = innings.bowlerStats[p.id];
    if (!st || st.legalBalls >= maxBallsPerBowler) return false;
    if (p.id === innings.lastCompletedBowlerId && bowlingLineup.players.length > 1) return false;
    return true;
  });

  if (!innings.isSuperOver && oversRemaining > 0) {
    const unbowledEligible = baseEligible.filter(
      (p) => (innings.bowlerStats[p.id]?.legalBalls ?? 0) === 0,
    );
    const totalUnbowled = bowlingLineup.players.filter(
      (p) => (innings.bowlerStats[p.id]?.legalBalls ?? 0) === 0,
    ).length;
    if (totalUnbowled >= oversRemaining && unbowledEligible.length > 0) {
      return unbowledEligible;
    }
  }

  return baseEligible.length > 0 ? baseEligible : bowlingLineup.players;
}

export function selectSmartBowler(
  players: MatchPlayer[],
  bowlerStats: Record<number, BowlerInningsStats>,
  lastBowlerId: number | null,
  maxOvers: number,
  oversBowled: number,
): MatchPlayer {
  const oversRemaining = maxOvers - oversBowled;
  const maxBalls = maxOvers === 1 ? 6 : 12;

  const eligible = players.filter((p) => {
    const balls = bowlerStats[p.id]?.legalBalls ?? 0;
    return balls < maxBalls && (p.id !== lastBowlerId || players.length === 1);
  });

  const unbowled = eligible.filter((p) => (bowlerStats[p.id]?.legalBalls ?? 0) === 0);
  const allUnbowledCount = players.filter((p) => (bowlerStats[p.id]?.legalBalls ?? 0) === 0).length;

  const pool =
    oversRemaining > 0 && allUnbowledCount >= oversRemaining && unbowled.length > 0
      ? unbowled
      : eligible.length > 0
      ? eligible
      : players;

  // Prefer higher bowlOvr in key overs, rotating unbowled specialists early
  return pool
    .slice()
    .sort((a, b) => b.bowlOvr - a.bowlOvr || a.id - b.id)[0];
}

export function createMatchState(
  id: string,
  teamA: MatchTeamLineup,
  teamB: MatchTeamLineup,
  config: MatchConfig,
  tossWinnerId?: string,
  tossDecision?: "BAT" | "BOWL",
): MatchState {
  let rngState = config.seed | 0 || 1234567;
  let r1: number;
  [r1, rngState] = nextRandom(rngState);
  let r2: number;
  [r2, rngState] = nextRandom(rngState);

  const winnerId = tossWinnerId ?? (r1 < 0.5 ? teamA.teamId : teamB.teamId);
  const decision: "BAT" | "BOWL" =
    tossDecision ??
    (config.pitch === "Green" && r2 < 0.65 ? "BOWL" : "BAT");

  const firstBatting =
    (winnerId === teamA.teamId && decision === "BAT") ||
    (winnerId === teamB.teamId && decision === "BOWL")
      ? teamA
      : teamB;
  const firstBowling = firstBatting.teamId === teamA.teamId ? teamB : teamA;

  const innings1 = createInnings(1, firstBatting, firstBowling, config, null, false);

  return {
    id,
    config,
    rngState,
    teamA,
    teamB,
    tossWinnerId: winnerId,
    tossDecision: decision,
    phase: "INNINGS_1",
    innings1,
    innings2: null,
    superOver1: null,
    superOver2: null,
    winnerTeamId: null,
    resultText: "Match in progress",
  };
}

export function getLineupById(match: MatchState, teamId: string): MatchTeamLineup {
  return match.teamA.teamId === teamId ? match.teamA : match.teamB;
}

export function getActiveInnings(match: MatchState): InningsState | null {
  if (match.phase === "INNINGS_1") return match.innings1;
  if (match.phase === "INNINGS_2") return match.innings2;
  if (match.phase === "SUPER_OVER_1") return match.superOver1;
  if (match.phase === "SUPER_OVER_2") return match.superOver2;
  return null;
}

function estimateBallSpeedKmh(bowler: MatchPlayer, length: BowlingLength, rngVal: number): number {
  const isSpinner = /spin|orthodox|chinaman|lbs|obs/i.test(`${bowler.type} ${bowler.bowl}`);
  const base = isSpinner ? 84 + (bowler.paceOrSpin - 70) * 0.35 : 132 + (bowler.paceOrSpin - 70) * 0.55;
  const lenAdj = length === "Yorker" ? 3 : length === "Short" ? 2 : 0;
  return Math.round(clamp(base + lenAdj + (rngVal - 0.5) * 6, 76, 154));
}

/** Core ball-by-ball resolution following exact Phase 2 equations. */
export function resolveDelivery(
  match: MatchState,
  input: DeliveryInput,
): { match: MatchState; outcome: BallOutcome } {
  const active = getActiveInnings(match);
  if (!active || active.completed) {
    throw new Error("No active innings to bowl into.");
  }

  let rng = match.rngState;
  const rand = (): number => {
    const [v, nxt] = nextRandom(rng);
    rng = nxt;
    return v;
  };

  const battingTeam = getLineupById(match, active.battingTeamId);
  const bowlingTeam = getLineupById(match, active.bowlingTeamId);
  const batter = battingTeam.players.find((p) => p.id === active.strikerId) || battingTeam.players[0];
  const bowler = bowlingTeam.players.find((p) => p.id === active.currentBowlerId) || bowlingTeam.players[0];

  const releaseAccuracy = clamp(input.releaseAccuracy, 0, 1);
  const rawTiming = clamp(input.timing, 0, 1);
  const shotType = input.shotType;
  const aggression = clamp(
    SHOT_AGGRESSION[shotType] + (input.lofted ? 0.08 : 0) + (input.stepOut ? 0.06 : 0),
    0,
    1.1,
  );

  const overNumber = Math.floor(active.legalBalls / 6) + 1;
  const ballNumberInOver = (active.legalBalls % 6) + 1;
  const skill = (batter.batOvr - bowler.bowlOvr) / 100;
  const speedKmh = estimateBallSpeedKmh(bowler, input.length, rand());

  // Repeating same length makes batter timing easier; poor accuracy lowers batter difficulty
  const repeatLengthBonus = active.lastLengthInOver === input.length ? 0.06 : 0;
  const poorReleaseHelp = (1 - releaseAccuracy) * 0.16;
  const batterTimingSkillBonus = (batter.timing - 75) * 0.0015;
  const effectiveTiming = clamp(rawTiming + repeatLengthBonus + poorReleaseHelp + batterTimingSkillBonus, 0, 1);
  const timingGrade = input.timingGrade ?? gradeTiming(rawTiming);

  // Wide / No-Ball check from releaseAccuracy & line
  const wideRisk = 0.015 + Math.max(0, (0.68 - releaseAccuracy) * 0.24) + (input.line === "Leg" ? 0.015 : 0);
  const noBallRisk = 0.01 + Math.max(0, (0.55 - releaseAccuracy) * 0.14) + (input.length === "Yorker" && releaseAccuracy < 0.6 ? 0.025 : 0);
  const rExtra = rand();

  let extraType: "NONE" | "WIDE" | "NO_BALL" = "NONE";
  let extraRuns = 0;
  let runs = 0;
  let isLegalBall = true;
  let isWicket = false;
  let wicketKind: BallOutcome["wicketKind"];
  let isFreeHitNext = false;
  let shotDistanceM: number | undefined;

  if (rExtra < wideRisk) {
    extraType = "WIDE";
    extraRuns = 1;
    isLegalBall = false;
    isFreeHitNext = active.isFreeHit; // Free hit carries over on wide
  } else if (rExtra < wideRisk + noBallRisk) {
    extraType = "NO_BALL";
    extraRuns = 1;
    isLegalBall = false;
    isFreeHitNext = true; // Next legal delivery is a Free Hit
  }

  if (extraType !== "WIDE") {
    // Wicket probability formula
    const yorkerVsAggPenalty = aggression >= 0.8 && input.length === "Yorker" ? 0.05 : 0;
    const rawPwkt =
      0.02 +
      0.07 * aggression +
      0.16 * (1 - effectiveTiming) * (0.4 + aggression) -
      0.08 * skill +
      yorkerVsAggPenalty;
    const pWicket = active.isFreeHit || extraType === "NO_BALL" ? 0 : clamp(rawPwkt, 0.008, 0.5);

    if (rand() < pWicket) {
      isWicket = true;
      const rk = rand();
      wicketKind =
        input.length === "Yorker" || input.length === "Full"
          ? rk < 0.45
            ? "BOWLED"
            : rk < 0.72
            ? "LBW"
            : "CAUGHT"
          : rk < 0.72
          ? "CAUGHT"
          : rk < 0.88
          ? "BOWLED"
          : "RUN_OUT";
    } else {
      // Run scoring equation
      const powerplayBonus = !active.isSuperOver && overNumber <= 2 ? 0.08 : 0;
      const lengthEffect =
        input.length === "Yorker"
          ? -0.07
          : input.length === "Full"
          ? 0.05
          : input.length === "Short"
          ? 0.03
          : 0;
      const pitchEffect =
        match.config.pitch === "Dead" ? 0.04 : match.config.pitch === "Green" ? -0.03 : -0.01;
      const powerEdge = (batter.power - 78) * 0.0012;
      const noise = (rand() - 0.5) * 0.52;

      const s =
        0.4 * aggression +
        0.5 * effectiveTiming +
        0.25 * skill +
        powerplayBonus +
        lengthEffect +
        pitchEffect +
        powerEdge +
        noise;

      if (shotType === "Defend") {
        runs = s >= 0.68 ? 1 : 0;
      } else if (s < 0.52) {
        runs = 0;
      } else if (s < 0.76) {
        runs = 1;
      } else if (s < 0.88) {
        runs = 2;
      } else if (s < 1.03) {
        runs = 4;
      } else {
        runs = 6;
        shotDistanceM = Math.round(74 + effectiveTiming * 24 + (batter.power - 70) * 0.45 + rand() * 8);
      }

      if (extraType === "NO_BALL" && runs === 0 && aggression >= 0.55 && rand() < 0.35) {
        runs = 4;
      }
    }
  }

  // Interactive fielding overrides (Caught Meter & Direct Throw Meter)
  if (input.catchAttempt === "CAUGHT" && extraType === "NONE" && !active.isFreeHit) {
    if ((isWicket && wicketKind === "CAUGHT") || (!isWicket && runs === 0)) {
      isWicket = true;
      wicketKind = "CAUGHT";
      runs = 0;
    }
  } else if (input.catchAttempt === "DROPPED") {
    if (isWicket && wicketKind === "CAUGHT") {
      isWicket = false;
      wicketKind = undefined;
      runs = 1;
    } else if (!isWicket && runs === 0 && extraType === "NONE") {
      runs = 1;
    }
  }

  if (input.throwQuality && extraType === "NONE") {
    if (input.throwQuality === "PERFECT") {
      if (isWicket && wicketKind === "RUN_OUT") {
        runs = Math.min(runs, 1);
      } else if (!isWicket && runs === 2) {
        isWicket = true;
        wicketKind = "RUN_OUT";
        runs = 1;
      } else if (!isWicket && runs === 1) {
        if (rand() < 0.45) {
          isWicket = true;
          wicketKind = "RUN_OUT";
          runs = 0;
        } else {
          runs = 0;
        }
      }
    } else if (input.throwQuality === "WAYWARD") {
      if (isWicket && wicketKind === "RUN_OUT") {
        isWicket = false;
        wicketKind = undefined;
        runs = Math.max(1, runs);
      } else if (!isWicket && runs === 1) {
        runs = 2;
      }
    }
  }

  const totalBallRuns = runs + extraRuns;
  const commentary = buildCommentary(
    batter.name,
    bowler.name,
    shotType,
    input.length,
    runs,
    extraType,
    isWicket,
    wicketKind,
    active.isFreeHit,
    shotDistanceM,
  );

  const outcome: BallOutcome = {
    ballNumberInOver,
    overNumber,
    runs,
    extraRuns,
    totalBallRuns,
    extraType,
    isLegalBall,
    isWicket,
    wicketKind,
    wasFreeHit: active.isFreeHit,
    isFreeHitNext,
    shotType,
    length: input.length,
    line: input.line,
    timingGrade,
    ballSpeedKmh: speedKmh,
    shotDistanceM,
    batterId: batter.id,
    batterName: batter.name,
    nonStrikerId: active.nonStrikerId,
    bowlerId: bowler.id,
    bowlerName: bowler.name,
    commentary,
  };

  // Clone and update innings state
  const nextBatterStats = { ...active.batterStats };
  const nextBowlerStats = { ...active.bowlerStats };

  const curBatStat = { ...nextBatterStats[batter.id] };
  if (extraType !== "WIDE") {
    curBatStat.balls += 1;
    curBatStat.runs += runs;
    if (runs === 4) curBatStat.fours += 1;
    if (runs === 6) curBatStat.sixes += 1;
  }
  if (isWicket) {
    curBatStat.isOut = true;
    curBatStat.dismissalText = `${wicketKind === "BOWLED" ? "b" : wicketKind === "LBW" ? "lbw b" : wicketKind === "RUN_OUT" ? "run out" : "c & b"} ${bowler.name}`;
  }
  nextBatterStats[batter.id] = curBatStat;

  const curBowlStat = { ...nextBowlerStats[bowler.id] };
  curBowlStat.runsConceded += totalBallRuns;
  if (extraType === "WIDE") curBowlStat.wides += 1;
  if (extraType === "NO_BALL") curBowlStat.noBalls += 1;
  if (isLegalBall) curBowlStat.legalBalls += 1;
  if (isWicket && wicketKind !== "RUN_OUT") curBowlStat.wickets += 1;
  nextBowlerStats[bowler.id] = curBowlStat;

  const nextRuns = active.runs + totalBallRuns;
  const nextWickets = active.wickets + (isWicket ? 1 : 0);
  const nextLegalBalls = active.legalBalls + (isLegalBall ? 1 : 0);

  // Handle striker & non-striker updates
  let nextStrikerId = active.strikerId;
  let nextNonStrikerId = active.nonStrikerId;
  let nextBatterIndex = active.nextBatterIndex;

  if (isWicket) {
    if (nextBatterIndex < battingTeam.players.length) {
      nextStrikerId = battingTeam.players[nextBatterIndex].id;
      nextBatterIndex += 1;
    } else if (active.lastManStands && nextWickets < active.maxWickets && nextNonStrikerId !== null) {
      // Last-Man-Stands: 4th batter bats alone!
      nextStrikerId = nextNonStrikerId;
      nextNonStrikerId = null;
    }
  } else if (runs % 2 === 1 && nextNonStrikerId !== null) {
    // Rotate strike only when partner is at non-striker end (not Last-Man-Stands solo)
    const tmp = nextStrikerId;
    nextStrikerId = nextNonStrikerId;
    nextNonStrikerId = tmp;
  }

  // Over completion & strike rotation
  const overJustFinished = isLegalBall && nextLegalBalls > 0 && nextLegalBalls % 6 === 0;
  let nextCurrentOverBalls = [...active.currentOverBalls, outcome];
  let nextCurrentBowlerId = active.currentBowlerId;
  let nextLastCompletedBowlerId = active.lastCompletedBowlerId;
  let nextLastLength = extraType === "NONE" ? input.length : active.lastLengthInOver;

  if (overJustFinished) {
    if (nextNonStrikerId !== null) {
      const tmp = nextStrikerId;
      nextStrikerId = nextNonStrikerId;
      nextNonStrikerId = tmp;
    }
    nextLastCompletedBowlerId = bowler.id;
    nextLastLength = null;
    nextCurrentOverBalls = [];
  }

  const maxBalls = active.maxOvers * 6;
  const targetChased = active.targetRuns !== null && nextRuns >= active.targetRuns;
  const allOut = nextWickets >= active.maxWickets;
  const oversDone = nextLegalBalls >= maxBalls;
  const inningsCompleted = targetChased || allOut || oversDone;

  if (overJustFinished && !inningsCompleted) {
    const autoNextBowler = selectSmartBowler(
      bowlingTeam.players,
      nextBowlerStats,
      bowler.id,
      active.maxOvers,
      Math.floor(nextLegalBalls / 6),
    );
    nextCurrentBowlerId = autoNextBowler.id;
  }

  const nextInnings: InningsState = {
    ...active,
    runs: nextRuns,
    wickets: nextWickets,
    legalBalls: nextLegalBalls,
    strikerId: nextStrikerId,
    nonStrikerId: nextNonStrikerId,
    nextBatterIndex,
    currentBowlerId: nextCurrentBowlerId,
    lastCompletedBowlerId: nextLastCompletedBowlerId,
    lastLengthInOver: nextLastLength,
    isFreeHit: isFreeHitNext,
    currentOverBalls: nextCurrentOverBalls,
    ballLog: [...active.ballLog, outcome],
    batterStats: nextBatterStats,
    bowlerStats: nextBowlerStats,
    completed: inningsCompleted,
  };

  let nextMatch: MatchState = {
    ...match,
    rngState: rng,
  };

  if (match.phase === "INNINGS_1") {
    nextMatch.innings1 = nextInnings;
    if (inningsCompleted) {
      nextMatch.phase = "INNINGS_BREAK";
      nextMatch.innings2 = createInnings(
        2,
        bowlingTeam,
        battingTeam,
        match.config,
        nextInnings.runs + 1,
        false,
      );
    }
  } else if (match.phase === "INNINGS_2") {
    nextMatch.innings2 = nextInnings;
    if (inningsCompleted) {
      const target = nextInnings.targetRuns ?? match.innings1.runs + 1;
      if (nextInnings.runs >= target) {
        const wktsRemaining = nextInnings.maxWickets - nextInnings.wickets;
        nextMatch.phase = "COMPLETE";
        nextMatch.winnerTeamId = bowlingTeam.teamId; // batting in 2nd innings is bowlingTeam? Wait: active.battingTeamId!
        nextMatch.winnerTeamId = nextInnings.battingTeamId;
        const winLineup = getLineupById(match, nextInnings.battingTeamId);
        nextMatch.resultText = `${winLineup.name} won by ${wktsRemaining} wicket${wktsRemaining === 1 ? "" : "s"}`;
      } else if (nextInnings.runs === match.innings1.runs) {
        // Exact tie -> 1-over, 2-wicket Super Over
        const soBatting = getLineupById(match, nextInnings.battingTeamId);
        const soBowling = getLineupById(match, nextInnings.bowlingTeamId);
        nextMatch.phase = "SUPER_OVER_1";
        nextMatch.superOver1 = createInnings(1, soBatting, soBowling, match.config, null, true);
        nextMatch.resultText = "Tied! Heading to 1-Over Super Over";
      } else {
        const margin = match.innings1.runs - nextInnings.runs;
        const firstBatLineup = getLineupById(match, match.innings1.battingTeamId);
        nextMatch.phase = "COMPLETE";
        nextMatch.winnerTeamId = match.innings1.battingTeamId;
        nextMatch.resultText = `${firstBatLineup.name} won by ${margin} run${margin === 1 ? "" : "s"}`;
      }
    }
  } else if (match.phase === "SUPER_OVER_1") {
    nextMatch.superOver1 = nextInnings;
    if (inningsCompleted) {
      const so1Bat = getLineupById(match, nextInnings.battingTeamId);
      const so1Bowl = getLineupById(match, nextInnings.bowlingTeamId);
      nextMatch.phase = "SUPER_OVER_2";
      nextMatch.superOver2 = createInnings(
        2,
        so1Bowl,
        so1Bat,
        match.config,
        nextInnings.runs + 1,
        true,
      );
    }
  } else if (match.phase === "SUPER_OVER_2" && match.superOver1) {
    nextMatch.superOver2 = nextInnings;
    if (inningsCompleted) {
      const soTarget = match.superOver1.runs + 1;
      if (nextInnings.runs >= soTarget) {
        const winLineup = getLineupById(match, nextInnings.battingTeamId);
        nextMatch.phase = "COMPLETE";
        nextMatch.winnerTeamId = nextInnings.battingTeamId;
        nextMatch.resultText = `${winLineup.name} won the Super Over!`;
      } else if (nextInnings.runs < match.superOver1.runs) {
        const winLineup = getLineupById(match, match.superOver1.battingTeamId);
        nextMatch.phase = "COMPLETE";
        nextMatch.winnerTeamId = match.superOver1.battingTeamId;
        nextMatch.resultText = `${winLineup.name} won the Super Over!`;
      } else {
        // Boundary countback tiebreaker
        const b1 = match.superOver1.ballLog.filter((b) => b.runs === 4 || b.runs === 6).length;
        const b2 = nextInnings.ballLog.filter((b) => b.runs === 4 || b.runs === 6).length;
        const winId =
          b2 > b1 ? nextInnings.battingTeamId : match.superOver1.battingTeamId;
        const winLineup = getLineupById(match, winId);
        nextMatch.phase = "COMPLETE";
        nextMatch.winnerTeamId = winId;
        nextMatch.resultText = `${winLineup.name} won Super Over on boundary countback!`;
      }
    }
  }

  return { match: nextMatch, outcome };
}

export function startSecondInnings(match: MatchState): MatchState {
  if (match.phase !== "INNINGS_BREAK") return match;
  return { ...match, phase: "INNINGS_2" };
}

export function setInningsBowler(match: MatchState, bowlerId: number): MatchState {
  const active = getActiveInnings(match);
  if (!active || active.legalBalls % 6 !== 0) return match;
  const updated: InningsState = { ...active, currentBowlerId: bowlerId };
  if (match.phase === "INNINGS_1") return { ...match, innings1: updated };
  if (match.phase === "INNINGS_2") return { ...match, innings2: updated };
  if (match.phase === "SUPER_OVER_1") return { ...match, superOver1: updated };
  if (match.phase === "SUPER_OVER_2") return { ...match, superOver2: updated };
  return match;
}

/** AI picks delivery settings based on bot difficulty and game situation. */
export function chooseBotDelivery(
  innings: InningsState,
  difficulty: BotDifficulty = "Medium",
  rngState: number,
  isBotBowling: boolean,
  isBotBatting: boolean,
): { input: DeliveryInput; nextRng: number } {
  let rng = rngState;
  const rand = () => {
    const [v, nxt] = nextRandom(rng);
    rng = nxt;
    return v;
  };

  const lengths: BowlingLength[] = ["Yorker", "Full", "Good", "Short"];
  const lines: BowlingLine[] = ["Off", "Middle", "Leg"];

  const diffAccuracyBase =
    difficulty === "Hard" ? 0.88 : difficulty === "Medium" ? 0.74 : 0.56;
  const diffTimingBase =
    difficulty === "Hard" ? 0.82 : difficulty === "Medium" ? 0.67 : 0.48;

  const length = isBotBowling
    ? lengths[Math.floor(rand() * lengths.length)]
    : "Good";
  const line = isBotBowling
    ? lines[Math.floor(rand() * lines.length)]
    : "Off";

  const releaseAccuracy = isBotBowling
    ? clamp(diffAccuracyBase + (rand() - 0.5) * 0.24, 0.3, 0.99)
    : 0.82;

  let shotType: ShotType = "Drive";
  if (isBotBatting) {
    const r = rand();
    const overNum = Math.floor(innings.legalBalls / 6) + 1;
    const isDeath = overNum >= 5;
    if (innings.isFreeHit) {
      shotType = r < 0.5 ? "Slog" : "Loft";
    } else if (isDeath) {
      shotType = r < 0.35 ? "Slog" : r < 0.75 ? "Loft" : "Drive";
    } else if (overNum <= 2) {
      shotType = r < 0.35 ? "Loft" : r < 0.8 ? "Drive" : "Rotate";
    } else {
      shotType = r < 0.2 ? "Loft" : r < 0.55 ? "Drive" : r < 0.85 ? "Rotate" : "Defend";
    }
  }

  const timing = isBotBatting
    ? clamp(diffTimingBase + (rand() - 0.5) * 0.32, 0.25, 0.98)
    : 0.68;

  return {
    input: {
      length,
      line,
      releaseAccuracy,
      shotType,
      timing,
      timingGrade: gradeTiming(timing, rand() < 0.5 ? -1 : 1),
      lofted: shotType === "Loft" || shotType === "Slog",
    },
    nextRng: rng,
  };
}

/** Auto-simulates an entire match (or remaining balls) cleanly using the pure engine. */
export function simulateFullMatch(
  initialMatch: MatchState,
  difficulty: BotDifficulty = "Medium",
): MatchState {
  let state = initialMatch;
  let guard = 0;
  while (state.phase !== "COMPLETE" && guard < 400) {
    guard += 1;
    if (state.phase === "INNINGS_BREAK") {
      state = startSecondInnings(state);
      continue;
    }
    const active = getActiveInnings(state);
    if (!active) break;
    const { input, nextRng } = chooseBotDelivery(active, difficulty, state.rngState, true, true);
    state = { ...state, rngState: nextRng };
    state = resolveDelivery(state, input).match;
  }
  return state;
}

function buildCommentary(
  batterName: string,
  bowlerName: string,
  shotType: ShotType,
  length: BowlingLength,
  runs: number,
  extraType: "NONE" | "WIDE" | "NO_BALL",
  isWicket: boolean,
  wicketKind: BallOutcome["wicketKind"],
  wasFreeHit: boolean,
  distanceM?: number,
): string {
  if (extraType === "WIDE") {
    return `${bowlerName} strays down the side — called WIDE (+1).`;
  }
  if (extraType === "NO_BALL") {
    return `Overstep! NO BALL by ${bowlerName}${runs > 0 ? `, ${batterName} takes ${runs}` : ""} — FREE HIT coming up!`;
  }
  if (isWicket) {
    if (wicketKind === "BOWLED") {
      return `CLEAN BOWLED! ${bowlerName} rattles ${batterName}'s timber with a sharp ${length.toLowerCase()} delivery!`;
    }
    if (wicketKind === "LBW") {
      return `PLUMB LBW! ${bowlerName} traps ${batterName} right in front!`;
    }
    if (wicketKind === "RUN_OUT") {
      return `DIRECT HIT! ${batterName} is caught short — RUN OUT!`;
    }
    return `CAUGHT! ${batterName} holes out off ${bowlerName} attempting a ${shotType.toLowerCase()}!`;
  }
  const fhPrefix = wasFreeHit ? "Free Hit! " : "";
  if (runs === 6) {
    return `${fhPrefix}MASSIVE SIX! ${batterName} launches ${bowlerName} ${distanceM ?? 88}m into the stands!`;
  }
  if (runs === 4) {
    return `${fhPrefix}CRACKING FOUR! ${batterName} threads the gap with a crisp ${shotType.toLowerCase()}.`;
  }
  if (runs === 0) {
    return `${fhPrefix}Dot ball — ${bowlerName} hits the ${length.toLowerCase()} mark against ${batterName}.`;
  }
  return `${fhPrefix}${batterName} tucks ${bowlerName}'s ${length.toLowerCase()} ball for ${runs} run${runs > 1 ? "s" : ""}.`;
}
