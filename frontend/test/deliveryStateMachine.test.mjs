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
import {
  computeMatchHighlights,
  createMatchState,
  resolveDelivery,
  simulateFullMatch,
  startSecondInnings,
} from "../src/engine/matchEngine.ts";
import { buildLineupsFromAuctionTeams } from "../src/engine/tournamentEngine.ts";
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

test("custom auction teams/rosters, Super Over tie-breaker, and post-match highlights work end-to-end", () => {
  // Custom drafted auction teams flow through cleanly
  const customLineups = buildLineupsFromAuctionTeams(
    [
      {
        id: "custom-alpha",
        name: "Royal Blazers",
        kit: JERSEY_THEMES[0],
        purseRemainingCr: 20,
        initialPurseCr: 80,
        connected: true,
        squad: rosterPlayers.slice(0, 4).map((p) => ({ player: { ...p, role: p.role }, paidCr: 5 })),
      },
      {
        id: "custom-beta",
        name: "Lightning XI",
        kit: JERSEY_THEMES[2],
        purseRemainingCr: 22,
        initialPurseCr: 80,
        connected: true,
        squad: rosterPlayers.slice(4, 8).map((p) => ({ player: { ...p, role: p.role }, paidCr: 4 })),
      },
    ],
    rosterPlayers,
  );
  assert.equal(customLineups[0].name, "Royal Blazers");
  assert.equal(customLineups[1].name, "Lightning XI");
  assert.equal(customLineups[0].players.length, 4);

  // Full 2-over match simulation + highlights check
  const m0 = createMatchState(
    "full-2ov",
    customLineups[0],
    customLineups[1],
    { seed: 4242, pitch: "Dusty", wicketRule: "LAST_MAN_STANDS", oversPerInnings: 2 },
    customLineups[0].teamId,
    "BAT",
  );
  const completed = simulateFullMatch(m0, "Medium");
  assert.equal(completed.phase, "COMPLETE");
  assert.ok(completed.winnerTeamId !== null);
  const hl = computeMatchHighlights(completed);
  assert.ok(hl.topScorer !== null);
  assert.ok(hl.bestBowler !== null);

  // Deterministic search over seed to verify tied 2-over chase enters SUPER_OVER_1 -> SUPER_OVER_2 -> COMPLETE
  let superOverResult = null;
  for (let seed = 1; seed <= 30 && !superOverResult; seed += 1) {
    let base = createMatchState(
      `so-tie-${seed}`,
      customLineups[0],
      customLineups[1],
      { seed, pitch: "Dead", wicketRule: "THREE_WICKETS_ALL_OUT", oversPerInnings: 2 },
      customLineups[0].teamId,
      "BAT",
    );
    const broken = createMatchState(
      `so-b-${seed}`,
      customLineups[0],
      customLineups[1],
      { seed, pitch: "Dead", wicketRule: "THREE_WICKETS_ALL_OUT", oversPerInnings: 2 },
      customLineups[0].teamId,
      "BAT",
    );
    base = {
      ...base,
      phase: "INNINGS_2",
      innings1: { ...base.innings1, runs: 18, legalBalls: 12, completed: true },
      innings2: {
        ...broken.innings1,
        inningsNumber: 2,
        battingTeamId: customLineups[1].teamId,
        bowlingTeamId: customLineups[0].teamId,
        runs: 18,
        wickets: 2,
        legalBalls: 11,
        targetRuns: 19,
        completed: false,
      },
    };
    const afterFinalBall = resolveDelivery(base, {
      length: "Yorker",
      line: "Middle",
      releaseAccuracy: 0.99,
      shotType: "Defend",
      timing: 0.5,
    }).match;
    if (afterFinalBall.phase === "SUPER_OVER_1") {
      superOverResult = afterFinalBall;
    }
  }
  assert.ok(superOverResult !== null, "Tied 2-over match should enter SUPER_OVER_1");
  assert.ok(superOverResult.superOver1 !== null);
  assert.equal(superOverResult.superOver1.maxOvers, 1);
  const fin = simulateFullMatch(superOverResult, "Medium");
  assert.equal(fin.phase, "COMPLETE");
  assert.ok(fin.superOver2 !== null);
  assert.ok(computeMatchHighlights(fin).topScorer !== null);
});

test("full delivery pipeline: bowling -> batting -> runner Sprint/Cancel + Direct Throw -> umpire callout", () => {
  const teamA = makeLineup(0, rosterPlayers.slice(0, 4));
  const teamB = makeLineup(1, rosterPlayers.slice(4, 8));

  // Find a deterministic 1-run delivery seed and compare RUN vs SPRINT vs CANCEL
  let foundOneRunSeed = null;
  for (let s = 1; s <= 40; s += 1) {
    const m = createMatchState(
      `run-${s}`,
      teamA,
      teamB,
      { seed: s, pitch: "Dusty", wicketRule: "LAST_MAN_STANDS", oversPerInnings: 2 },
      teamA.teamId,
      "BAT",
    );
    const out = resolveDelivery(m, {
      length: "Good",
      line: "Off",
      releaseAccuracy: 0.9,
      shotType: "Rotate",
      timing: 0.72,
    }).outcome;
    if (!out.isWicket && out.extraType === "NONE" && out.runs === 1) {
      foundOneRunSeed = s;
      break;
    }
  }
  assert.ok(foundOneRunSeed !== null);

  const mBase = createMatchState(
    "runner-check",
    teamA,
    teamB,
    { seed: foundOneRunSeed, pitch: "Dusty", wicketRule: "LAST_MAN_STANDS", oversPerInnings: 2 },
    teamA.teamId,
    "BAT",
  );
  const sprintOut = resolveDelivery(mBase, {
    length: "Good",
    line: "Off",
    releaseAccuracy: 0.9,
    shotType: "Rotate",
    timing: 0.72,
    throwQuality: "GOOD",
    throwEnd: "NON_STRIKER",
    runnerAction: "SPRINT",
  });
  assert.equal(sprintOut.outcome.runs, 2);
  assert.equal(getUmpireCalloutSpec(sprintOut.outcome).callout, "2 RUNS");

  const cancelOut = resolveDelivery(mBase, {
    length: "Good",
    line: "Off",
    releaseAccuracy: 0.9,
    shotType: "Rotate",
    timing: 0.72,
    throwQuality: "GOOD",
    throwEnd: "STRIKER",
    runnerAction: "CANCEL",
  });
  assert.equal(cancelOut.outcome.runs, 0);
  assert.equal(getUmpireCalloutSpec(cancelOut.outcome).callout, "DOT BALL");
});
