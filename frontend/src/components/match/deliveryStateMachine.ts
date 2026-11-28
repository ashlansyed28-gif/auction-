import type { BallOutcome, BowlingLength, BowlingLine } from "../../engine/matchEngine";

export type PhaseGate =
  | "READY"
  | "BOWL_METER"
  | "BAT_TIMING"
  | "CAUGHT_METER"
  | "DIRECT_THROW_METER"
  | "ANIMATING"
  | "UMPIRE_CALL";

export type AnimationPhase =
  | "IDLE"
  | "BOWLING"
  | "AWAITING_HIT"
  | "BALL_CAUGHT_CHANCE"
  | "AWAITING_THROW"
  | "RESOLVING"
  | "UMPIRE_SIGNAL";

export type AutoTriggerKind = "START" | "RELEASE" | "BAT" | "THROW" | "CATCH";
export type ThrowTargetEnd = "STRIKER" | "NON_STRIKER";
export type UmpireSignal = "DOT" | "SINGLE" | "TWO_RUNS" | "FOUR" | "SIX" | "OUT" | "WIDE" | "NO_BALL";

export const AUTO_LAUNCH_DELAY_MS = 6000;
export const UMPIRE_CALLOUT_DURATION_MS = 1050;

export interface AutoLaunchSpec {
  label: string;
  triggerKind: AutoTriggerKind;
  delayMs: number;
}

export interface AutoLaunchParams {
  hasActiveInnings: boolean;
  watchAiMode: boolean;
  drawerOpen: boolean;
  matchPhase: string;
  phaseGate: PhaseGate;
  isBowlerMode: boolean;
  isBatterMode: boolean;
  controlMode: string;
  hasOnlinePendingBowl: boolean;
}

/**
 * Determines whether the 6-second auto-launch inactivity timer should run
 * for bowling, batting, Direct Throw, or Caught meter windows so play never stalls.
 */
export function getAutoLaunchSpec(params: AutoLaunchParams): AutoLaunchSpec | null {
  const pausedOrFinished =
    !params.hasActiveInnings ||
    params.watchAiMode ||
    params.drawerOpen ||
    params.matchPhase === "COMPLETE" ||
    params.matchPhase === "INNINGS_BREAK";

  if (pausedOrFinished) return null;

  if (params.phaseGate === "DIRECT_THROW_METER") {
    return { label: "Auto-Throw", triggerKind: "THROW", delayMs: AUTO_LAUNCH_DELAY_MS };
  }
  if (params.phaseGate === "CAUGHT_METER") {
    return { label: "Auto-Catch", triggerKind: "CATCH", delayMs: AUTO_LAUNCH_DELAY_MS };
  }
  if (params.phaseGate === "READY" && params.isBowlerMode) {
    return { label: "Auto-Bowl", triggerKind: "START", delayMs: AUTO_LAUNCH_DELAY_MS };
  }
  if (params.phaseGate === "BOWL_METER" && params.isBowlerMode) {
    return { label: "Auto-Release", triggerKind: "RELEASE", delayMs: AUTO_LAUNCH_DELAY_MS };
  }
  if (
    params.phaseGate === "READY" &&
    params.isBatterMode &&
    params.controlMode !== "ONLINE_FRIEND"
  ) {
    return { label: "Auto-Face", triggerKind: "START", delayMs: AUTO_LAUNCH_DELAY_MS };
  }
  if (
    params.phaseGate === "BAT_TIMING" &&
    params.isBatterMode &&
    !(params.controlMode === "ONLINE_FRIEND" && !params.hasOnlinePendingBowl)
  ) {
    return { label: "Auto-Shot", triggerKind: "BAT", delayMs: AUTO_LAUNCH_DELAY_MS };
  }

  return null;
}

export function getNextBowlReleaseTarget(
  controlMode: string,
  userControlsBatting: boolean,
): "ONLINE_WAIT" | "BAT_TIMING" | "BOT_BAT_AND_RESOLVE" {
  if (controlMode === "ONLINE_FRIEND" && !userControlsBatting) return "ONLINE_WAIT";
  if (userControlsBatting) return "BAT_TIMING";
  return "BOT_BAT_AND_RESOLVE";
}

export function evaluateDirectThrowMeter(meterPos: number): {
  quality: "PERFECT" | "GOOD" | "WAYWARD";
  label: string;
} {
  const offset = meterPos - 0.5;
  const dist = Math.abs(offset);
  if (dist <= 0.1) {
    return { quality: "PERFECT", label: "PERFECT DIRECT HIT!" };
  }
  if (dist <= 0.24) {
    return {
      quality: "GOOD",
      label: offset < 0 ? "GOOD • EARLY THROW" : "GOOD • LATE THROW",
    };
  }
  return {
    quality: "WAYWARD",
    label: offset < 0 ? "TOO EARLY • WIDE" : "TOO LATE • OVERTHROW",
  };
}

export function evaluateCaughtMeter(meterPos: number): {
  attempt: "CAUGHT" | "DROPPED";
  label: string;
} {
  const offset = meterPos - 0.5;
  const dist = Math.abs(offset);
  if (dist <= 0.15) {
    return { attempt: "CAUGHT", label: "CLEAN CATCH!" };
  }
  return {
    attempt: "DROPPED",
    label: offset < 0 ? "TOO EARLY • DROPPED!" : "TOO LATE • PARRIED!",
  };
}

export function getPostHitInteractionKind(
  outcome: BallOutcome,
  canFieldInteract: boolean,
): "CAUGHT_CHANCE" | "DIRECT_THROW" | "NONE" {
  if (!canFieldInteract) return "NONE";
  if (outcome.isWicket && outcome.wicketKind === "CAUGHT") {
    return "CAUGHT_CHANCE";
  }
  if (
    !outcome.isWicket &&
    outcome.extraType === "NONE" &&
    !outcome.wasFreeHit &&
    outcome.runs === 0 &&
    (outcome.shotType === "Drive" || outcome.shotType === "Loft" || outcome.shotType === "Slog") &&
    (outcome.overNumber + outcome.ballNumberInOver) % 2 === 0
  ) {
    return "CAUGHT_CHANCE";
  }
  if (
    (!outcome.isWicket && outcome.extraType === "NONE" && (outcome.runs === 1 || outcome.runs === 2)) ||
    (outcome.isWicket && outcome.wicketKind === "RUN_OUT")
  ) {
    return "DIRECT_THROW";
  }
  return "NONE";
}

export interface UmpireCalloutSpec {
  signal: UmpireSignal;
  callout: string;
  detail: string;
  isWicket: boolean;
  isBoundary: boolean;
}

export function getUmpireCalloutSpec(outcome: BallOutcome): UmpireCalloutSpec {
  if (outcome.isWicket) {
    if (outcome.wicketKind === "CAUGHT") {
      return {
        signal: "OUT",
        callout: "CAUGHT!",
        detail: `${outcome.batterName} dismissed`,
        isWicket: true,
        isBoundary: false,
      };
    }
    if (outcome.wicketKind === "RUN_OUT") {
      return {
        signal: "OUT",
        callout: "RUN OUT!",
        detail: `${outcome.batterName} short of crease`,
        isWicket: true,
        isBoundary: false,
      };
    }
    return {
      signal: "OUT",
      callout: outcome.wicketKind === "LBW" ? "OUT! LBW!" : "OUT! BOWLED!",
      detail: `${outcome.batterName} departs`,
      isWicket: true,
      isBoundary: false,
    };
  }
  if (outcome.extraType === "WIDE") {
    return {
      signal: "WIDE",
      callout: "WIDE BALL",
      detail: "+1 Extra Run",
      isWicket: false,
      isBoundary: false,
    };
  }
  if (outcome.extraType === "NO_BALL") {
    return {
      signal: "NO_BALL",
      callout: "NO BALL!",
      detail: "Free Hit next legal delivery",
      isWicket: false,
      isBoundary: false,
    };
  }
  if (outcome.runs === 6) {
    return {
      signal: "SIX",
      callout: "SIX!",
      detail: `${outcome.shotDistanceM ?? 88}m Maximum!`,
      isWicket: false,
      isBoundary: true,
    };
  }
  if (outcome.runs === 4) {
    return {
      signal: "FOUR",
      callout: "FOUR!",
      detail: `${outcome.shotType} to the boundary`,
      isWicket: false,
      isBoundary: true,
    };
  }
  if (outcome.runs === 2) {
    return {
      signal: "TWO_RUNS",
      callout: "2 RUNS",
      detail: "Crisp running between wickets",
      isWicket: false,
      isBoundary: false,
    };
  }
  if (outcome.runs === 1) {
    return {
      signal: "SINGLE",
      callout: "1 RUN",
      detail: "Single rotated",
      isWicket: false,
      isBoundary: false,
    };
  }
  return {
    signal: "DOT",
    callout: "DOT BALL",
    detail: "No run scored",
    isWicket: false,
    isBoundary: false,
  };
}

export function createIdleResetState(activeLength: BowlingLength, activeLine: BowlingLine) {
  return {
    phaseGate: "READY" as PhaseGate,
    meterPos: 0.5,
    timingCallout: null,
    directThrowNotice: false,
    meterFeedback: null as string | null,
    lockedBowl: null,
    pendingFielding: null,
    umpireCallout: null as UmpireCalloutSpec | null,
    animation: {
      key: Date.now(),
      outcome: null,
      phase: "IDLE" as AnimationPhase,
      activeLength,
      activeLine,
    },
  };
}
