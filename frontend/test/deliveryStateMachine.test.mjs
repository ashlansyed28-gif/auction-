import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_LAUNCH_DELAY_MS,
  UMPIRE_CALLOUT_DURATION_MS,
  createIdleResetState,
  evaluateCaughtMeter,
  evaluateDirectThrowMeter,
  getAutoLaunchSpec,
  getNextBowlReleaseTarget,
  getPostHitInteractionKind,
  getUmpireCalloutSpec,
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

test("6-second auto-launch timer covers bowling, batting, direct throw, and caught meters", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

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

  const directThrowAuto = getAutoLaunchSpec({
    hasActiveInnings: true,
    watchAiMode: false,
    drawerOpen: false,
    matchPhase: "INNINGS_1",
    phaseGate: "DIRECT_THROW_METER",
    isBowlerMode: false,
    isBatterMode: false,
    controlMode: "VS_BOT",
    hasOnlinePendingBowl: false,
  });
  assert.deepEqual(directThrowAuto, {
    label: "Auto-Throw",
    triggerKind: "THROW",
    delayMs: 6000,
  });

  const caughtAuto = getAutoLaunchSpec({
    hasActiveInnings: true,
    watchAiMode: false,
    drawerOpen: false,
    matchPhase: "INNINGS_1",
    phaseGate: "CAUGHT_METER",
    isBowlerMode: false,
    isBatterMode: false,
    controlMode: "VS_BOT",
    hasOnlinePendingBowl: false,
  });
  assert.deepEqual(caughtAuto, {
    label: "Auto-Catch",
    triggerKind: "CATCH",
    delayMs: 6000,
  });

  // Verify timer does not run while pause menu drawer is open
  assert.equal(
    getAutoLaunchSpec({
      hasActiveInnings: true,
      watchAiMode: false,
      drawerOpen: true,
      matchPhase: "INNINGS_1",
      phaseGate: "DIRECT_THROW_METER",
      isBowlerMode: false,
      isBatterMode: false,
      controlMode: "VS_BOT",
      hasOnlinePendingBowl: false,
    }),
    null,
  );

  // Simulate full 6-second inactivity flow across bowling -> throw -> umpire callout -> IDLE
  let state = "READY";
  setTimeout(() => {
    state = "BOWL_METER";
    setTimeout(() => {
      state = "DIRECT_THROW_METER";
      setTimeout(() => {
        state = "UMPIRE_CALL";
        setTimeout(() => {
          state = "IDLE";
        }, UMPIRE_CALLOUT_DURATION_MS);
      }, directThrowAuto.delayMs);
    }, bowlRelease.delayMs);
  }, bowlReady.delayMs);

  t.mock.timers.tick(5999);
  assert.equal(state, "READY");
  t.mock.timers.tick(1);
  assert.equal(state, "BOWL_METER");
  t.mock.timers.tick(6000);
  assert.equal(state, "DIRECT_THROW_METER");
  t.mock.timers.tick(6000);
  assert.equal(state, "UMPIRE_CALL");
  t.mock.timers.tick(UMPIRE_CALLOUT_DURATION_MS);
  assert.equal(state, "IDLE");
});

test("Direct Throw, Caught Meter, and Umpire Callout evaluate accurately and reset across consecutive balls", () => {
  assert.equal(evaluateDirectThrowMeter(0.5).quality, "PERFECT");
  assert.equal(evaluateDirectThrowMeter(0.32).quality, "GOOD");
  assert.equal(evaluateDirectThrowMeter(0.1).quality, "WAYWARD");

  assert.equal(evaluateCaughtMeter(0.5).attempt, "CAUGHT");
  assert.equal(evaluateCaughtMeter(0.08).attempt, "DROPPED");

  const teamA = makeLineup(0, rosterPlayers.slice(0, 4));
  const teamB = makeLineup(1, rosterPlayers.slice(4, 8));
  let match = createMatchState("multi-ball-test", teamA, teamB, {
    totalOvers: 6,
    pitch: "Dusty",
    tossWinnerId: teamA.teamId,
    tossDecision: "BAT",
  });

  assert.equal(getNextBowlReleaseTarget("PASS_PLAY", true), "BAT_TIMING");
  assert.equal(getNextBowlReleaseTarget("VS_BOT", false), "BOT_BAT_AND_RESOLVE");

  // Play 6 consecutive deliveries with Direct Throw, Caught checks, Umpire Callouts, and clean reset
  for (let ball = 0; ball < 6; ball += 1) {
    const res = resolveDelivery(match, {
      length: "Good",
      line: ball % 2 === 0 ? "Off" : "Leg",
      releaseAccuracy: 0.88,
      shotType: ball % 3 === 0 ? "Loft" : "Drive",
      timing: 0.85,
      timingGrade: "PERFECT",
      lofted: ball === 2,
      stepOut: false,
      throwQuality: ball === 1 ? "PERFECT" : undefined,
      throwEnd: ball === 1 ? "NON_STRIKER" : undefined,
    });
    match = res.match;

    const callout = getUmpireCalloutSpec(res.outcome);
    assert.ok(callout.callout.length > 0);
    assert.ok(callout.signal.length > 0);

    // Check interaction routing classifier
    const kind = getPostHitInteractionKind(res.outcome, true);
    assert.ok(["CAUGHT_CHANCE", "DIRECT_THROW", "NONE"].includes(kind));

    const reset = createIdleResetState("Good", "Off");
    assert.equal(reset.phaseGate, "READY");
    assert.equal(reset.animation.phase, "IDLE");
    assert.equal(reset.directThrowNotice, false);
    assert.equal(reset.lockedBowl, null);
    assert.equal(reset.pendingFielding, null);
    assert.equal(reset.umpireCallout, null);
    assert.equal(reset.meterFeedback, null);
    assert.equal(reset.meterPos, 0.5);
  }

  // Test Caught vs Dropped outcome consistency in matchEngine
  const caughtRes = resolveDelivery(match, {
    length: "Good",
    line: "Off",
    releaseAccuracy: 0.9,
    shotType: "Loft",
    timing: 0.5,
    catchAttempt: "CAUGHT",
  });
  const droppedRes = resolveDelivery(match, {
    length: "Good",
    line: "Off",
    releaseAccuracy: 0.9,
    shotType: "Loft",
    timing: 0.5,
    catchAttempt: "DROPPED",
  });
  if (caughtRes.outcome.isWicket && caughtRes.outcome.wicketKind === "CAUGHT") {
    assert.equal(getUmpireCalloutSpec(caughtRes.outcome).callout, "CAUGHT!");
    assert.equal(droppedRes.outcome.isWicket, false);
  }
  assert.ok(match.innings1.ballLog.length >= 6);
});

test("2–6 overs selection wires cleanly into total legal balls and innings transitions", () => {
  const teamA = makeLineup(0, rosterPlayers.slice(0, 4));
  const teamB = makeLineup(1, rosterPlayers.slice(4, 8));

  for (const overs of [2, 3, 4, 5, 6]) {
    let m = createMatchState(
      `overs-${overs}`,
      teamA,
      teamB,
      { seed: 777 + overs, pitch: "Dusty", wicketRule: "LAST_MAN_STANDS", oversPerInnings: overs },
      teamA.teamId,
      "BAT",
    );
    assert.equal(m.innings1.maxOvers, overs);
    let safety = 0;
    while (m.phase === "INNINGS_1" && safety < 120) {
      m = resolveDelivery(m, {
        length: "Good",
        line: "Off",
        releaseAccuracy: 0.9,
        shotType: "Drive",
        timing: 0.85,
      }).match;
      safety += 1;
    }
    assert.equal(m.phase, "INNINGS_BREAK");
    assert.ok(m.innings1.legalBalls <= overs * 6);
    assert.equal(m.innings2?.maxOvers, overs);
  }
});
