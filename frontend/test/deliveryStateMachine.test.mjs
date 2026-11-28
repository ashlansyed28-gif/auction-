import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_LAUNCH_DELAY_MS,
  createIdleResetState,
  getAutoLaunchSpec,
  getNextBowlReleaseTarget,
} from "../src/components/match/deliveryStateMachine.ts";
import { createMatchState, resolveDelivery } from "../src/engine/matchEngine.ts";
import { players as rosterPlayers } from "../src/data/roster.ts";
import { JERSEY_THEMES } from "../src/utils/auctionRules.ts";

function makeLineup(idx, slice) {
  const kit = JERSEY_THEMES[idx];
  return {
    teamId: `t-${idx}`,
    code: kit.code,
    name: kit.franchiseName,
    kit,
    captainId: slice[0].id,
    players: slice.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      battingOrder: 1,
      batOvr: 78,
      bowlOvr: 76,
      power: 75,
      timing: 76,
      bowlingType: p.bowlingType,
    })),
  };
}

test("6-second auto-launch timer covers both bowling and batting windows without stalling", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  // 1. Bowling READY -> Auto-Bowl at 6000ms
  const bowlReady = getAutoLaunchSpec({
    hasActiveInnings: true,
    watchAiMode: false,
    drawerOpen: false,
    matchPhase: "INNINGS_1",
    phaseGate: "READY",
    isBowlerMode: true,
    isBatterMode: false,
    controlMode: "VS_BOT",
    hasOnlinePendingBowl: false,
  });
  assert.deepEqual(bowlReady, {
    label: "Auto-Bowl",
    triggerKind: "START",
    delayMs: AUTO_LAUNCH_DELAY_MS,
  });

  // 2. Bowling BOWL_METER (RELEASE) -> Auto-Release at 6000ms (never holds ball indefinitely)
  const bowlRelease = getAutoLaunchSpec({
    hasActiveInnings: true,
    watchAiMode: false,
    drawerOpen: false,
    matchPhase: "INNINGS_1",
    phaseGate: "BOWL_METER",
    isBowlerMode: true,
    isBatterMode: false,
    controlMode: "VS_BOT",
    hasOnlinePendingBowl: false,
  });
  assert.deepEqual(bowlRelease, {
    label: "Auto-Release",
    triggerKind: "RELEASE",
    delayMs: AUTO_LAUNCH_DELAY_MS,
  });

  // 3. Batting READY & BAT_TIMING -> Auto-Face / Auto-Shot at 6000ms
  const batReady = getAutoLaunchSpec({
    hasActiveInnings: true,
    watchAiMode: false,
    drawerOpen: false,
    matchPhase: "INNINGS_1",
    phaseGate: "READY",
    isBowlerMode: false,
    isBatterMode: true,
    controlMode: "VS_BOT",
    hasOnlinePendingBowl: false,
  });
  assert.equal(batReady?.triggerKind, "START");
  assert.equal(batReady?.delayMs, 6000);

  const batTiming = getAutoLaunchSpec({
    hasActiveInnings: true,
    watchAiMode: false,
    drawerOpen: false,
    matchPhase: "INNINGS_1",
    phaseGate: "BAT_TIMING",
    isBowlerMode: false,
    isBatterMode: true,
    controlMode: "VS_BOT",
    hasOnlinePendingBowl: false,
  });
  assert.equal(batTiming?.triggerKind, "BAT");
  assert.equal(batTiming?.delayMs, 6000);

  // 4. Simulate 6-second inactivity timer firing across Bowling -> Release -> Batting
  let state = "READY";
  setTimeout(() => {
    state = "BOWL_METER";
    setTimeout(() => {
      state = "BAT_TIMING";
      setTimeout(() => {
        state = "RESOLVING";
      }, bowlRelease.delayMs);
    }, batTiming.delayMs);
  }, bowlReady.delayMs);

  t.mock.timers.tick(5999);
  assert.equal(state, "READY");
  t.mock.timers.tick(1);
  assert.equal(state, "BOWL_METER");
  t.mock.timers.tick(6000);
  assert.equal(state, "BAT_TIMING");
  t.mock.timers.tick(6000);
  assert.equal(state, "RESOLVING");
});

test("multiple consecutive deliveries resolve and reset cleanly to pitch READY / IDLE state", () => {
  const teamA = makeLineup(0, rosterPlayers.slice(0, 4));
  const teamB = makeLineup(1, rosterPlayers.slice(4, 8));
  let match = createMatchState("multi-ball-test", teamA, teamB, {
    totalOvers: 6,
    pitch: "Dusty",
    tossWinnerId: teamA.teamId,
    tossDecision: "BAT",
  });

  // Pass & Play release transitions immediately to BAT_TIMING
  assert.equal(getNextBowlReleaseTarget("PASS_PLAY", true), "BAT_TIMING");
  assert.equal(getNextBowlReleaseTarget("VS_BOT", false), "BOT_BAT_AND_RESOLVE");

  // Play 6 consecutive deliveries resetting state between each ball
  for (let ball = 0; ball < 6; ball += 1) {
    const res = resolveDelivery(match, {
      length: "Good",
      line: ball % 2 === 0 ? "Off" : "Leg",
      releaseAccuracy: 0.88,
      shotType: "Drive",
      timing: 0.85,
      timingGrade: "PERFECT",
      lofted: ball === 2,
      stepOut: false,
    });
    match = res.match;
    const reset = createIdleResetState("Good", "Off");
    assert.equal(reset.phaseGate, "READY");
    assert.equal(reset.animation.phase, "IDLE");
    assert.equal(reset.directThrowNotice, false);
    assert.equal(reset.lockedBowl, null);
    assert.equal(reset.meterPos, 0.5);
  }

  assert.ok(match.innings1.ballLog.length >= 6);
});
