import type { BowlingLength, BowlingLine } from "../../engine/matchEngine";

export type PhaseGate = "READY" | "BOWL_METER" | "BAT_TIMING" | "ANIMATING";
export type AnimationPhase = "IDLE" | "BOWLING" | "AWAITING_HIT" | "RESOLVING";
export type AutoTriggerKind = "START" | "RELEASE" | "BAT";

export const AUTO_LAUNCH_DELAY_MS = 6000;

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
 * for the current bowling or batting state, ensuring gameplay never stalls.
 */
export function getAutoLaunchSpec(params: AutoLaunchParams): AutoLaunchSpec | null {
  const pausedOrFinished =
    !params.hasActiveInnings ||
    params.watchAiMode ||
    params.drawerOpen ||
    params.matchPhase === "COMPLETE" ||
    params.matchPhase === "INNINGS_BREAK";

  if (pausedOrFinished) return null;

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

export function createIdleResetState(activeLength: BowlingLength, activeLine: BowlingLine) {
  return {
    phaseGate: "READY" as PhaseGate,
    meterPos: 0.5,
    timingCallout: null,
    directThrowNotice: false,
    lockedBowl: null,
    animation: {
      key: Date.now(),
      outcome: null,
      phase: "IDLE" as AnimationPhase,
      activeLength,
      activeLine,
    },
  };
}
