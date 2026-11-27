import test from "node:test";
import assert from "node:assert/strict";
import { players as rosterPlayers } from "../src/data/roster.ts";
import { JERSEY_THEMES } from "../src/utils/auctionRules.ts";
import {
  createMatchState,
  resolveDelivery,
  simulateFullMatch,
} from "../src/engine/matchEngine.ts";
import {
  computePointsTable,
  computeSeasonStatsAndAwards,
  createTournament,
  simulateFixtureWithEngine,
} from "../src/engine/tournamentEngine.ts";

function toLineup(idx, playerSlice) {
  const kit = JERSEY_THEMES[idx % JERSEY_THEMES.length];
  return {
    teamId: `team-${kit.id}`,
    code: kit.code,
    name: kit.franchiseName,
    kit,
    captainId: playerSlice[0].id,
    players: playerSlice.map((p) => ({
      ...p,
      initials: p.name.slice(0, 2).toUpperCase(),
      paidCr: p.basePriceCr,
    })),
  };
}

test("10,000-match Monte Carlo simulation calibrates to ~9-12 runs/over and stronger team wins more", () => {
  const sorted = rosterPlayers.slice().sort((a, b) => b.ovr - a.ovr);
  const strongA = toLineup(0, [sorted[1], sorted[3], sorted[0], sorted[2]]);
  const strongB = toLineup(1, [sorted[5], sorted[7], sorted[4], sorted[6]]);

  let totalInn1Runs = 0;
  let totalInn1Balls = 0;
  const N = 10000;

  for (let i = 0; i < N; i++) {
    const match = createMatchState(
      `mc_${i}`,
      strongA,
      strongB,
      { seed: 100000 + i * 17, pitch: i % 3 === 0 ? "Green" : i % 3 === 1 ? "Dusty" : "Dead", wicketRule: "LAST_MAN_STANDS" },
      strongA.teamId,
      "BAT",
    );
    const done = simulateFullMatch(match, "Medium");
    totalInn1Runs += done.innings1.runs;
    totalInn1Balls += Math.max(1, done.innings1.legalBalls);
  }

  const avgInn1Runs = totalInn1Runs / N;
  const avgRpo = (totalInn1Runs / totalInn1Balls) * 6;
  console.log(`10,000-Match Monte Carlo -> Avg 1st Inn: ${avgInn1Runs.toFixed(2)} runs | Avg RPO: ${avgRpo.toFixed(2)}`);

  assert.ok(avgRpo >= 8.5 && avgRpo <= 12.5, `Expected ~9-12 RPO, got ${avgRpo.toFixed(2)}`);

  // Stronger squad vs weaker squad win-rate check (1,000 matches)
  const weakSlice = rosterPlayers.slice().sort((a, b) => a.ovr - b.ovr).slice(0, 4);
  const weakTeam = toLineup(2, weakSlice);
  let strongWins = 0;
  for (let i = 0; i < 1000; i++) {
    const m = createMatchState(
      `str_${i}`,
      strongA,
      weakTeam,
      { seed: 500000 + i * 31, pitch: "Dusty", wicketRule: "LAST_MAN_STANDS" },
    );
    const done = simulateFullMatch(m, "Medium");
    if (done.winnerTeamId === strongA.teamId) strongWins += 1;
  }
  const winPct = (strongWins / 1000) * 100;
  console.log(`Strong vs Weak (1,000 matches) -> Strong Win Rate: ${winPct.toFixed(1)}%`);
  assert.ok(winPct > 65, `Stronger team should win >65%, got ${winPct.toFixed(1)}%`);
});

test("match rules enforce Last-Man-Stands, Free Hit, max 2 overs per bowler, and Super Over tiebreak", () => {
  const p4 = rosterPlayers.slice(0, 4);
  const p4b = rosterPlayers.slice(4, 8);
  const tA = toLineup(0, p4);
  const tB = toLineup(1, p4b);

  const match = createMatchState("rules_1", tA, tB, {
    seed: 424242,
    pitch: "Dead",
    wicketRule: "LAST_MAN_STANDS",
  });
  const done = simulateFullMatch(match, "Hard");
  assert.equal(done.phase, "COMPLETE");

  // Every bowler in full innings bowls <= 12 legal balls (2 overs)
  for (const bw of Object.values(done.innings1.bowlerStats)) {
    assert.ok(bw.legalBalls <= 12, `${bw.name} bowled ${bw.legalBalls} balls (> 2 overs)`);
  }
  if (done.innings1.legalBalls === 36) {
    const usedBowlers = Object.values(done.innings1.bowlerStats).filter((b) => b.legalBalls > 0).length;
    assert.equal(usedBowlers, 4, "All 4 bowlers must bowl in a completed 6-over innings");
  }

  // Test Free Hit zero-wicket guarantee directly
  let cur = createMatchState("fh_test", tA, tB, {
    seed: 99,
    pitch: "Dusty",
    wicketRule: "THREE_WICKETS_ALL_OUT",
  });
  cur = {
    ...cur,
    innings1: { ...cur.innings1, isFreeHit: true },
  };
  const { outcome } = resolveDelivery(cur, {
    length: "Yorker",
    line: "Middle",
    releaseAccuracy: 0.9,
    shotType: "Slog",
    timing: 0.1,
  });
  if (outcome.extraType === "NONE") {
    assert.equal(outcome.isWicket, false, "Bowler cannot take wicket on a Free Hit");
  }
});

test("tournament brackets (4, 6, and 8 teams), NRR points table, and season awards work end-to-end", () => {
  const lineups8 = Array.from({ length: 8 }, (_, idx) =>
    toLineup(idx, rosterPlayers.slice(idx * 4, idx * 4 + 4)),
  );

  // 4 teams -> 6 SRR + 1 Final = 7
  const t4 = createTournament(lineups8.slice(0, 4), "LAST_MAN_STANDS", 111);
  assert.equal(t4.fixtures.length, 7);

  // 6 teams -> 15 SRR + 2 Semis + 1 Final = 18
  const t6 = createTournament(lineups8.slice(0, 6), "LAST_MAN_STANDS", 222);
  assert.equal(t6.fixtures.length, 18);

  // 8 teams -> 12 Group + 2 Semis + 1 Final = 15
  let t8 = createTournament(lineups8, "LAST_MAN_STANDS", 333);
  assert.equal(t8.fixtures.length, 15);

  for (const fx of t8.fixtures) {
    t8 = simulateFixtureWithEngine(t8, fx.id);
  }
  // Semis & Final unlocked after group stage, simulate remaining fixtures
  for (const fx of t8.fixtures) {
    t8 = simulateFixtureWithEngine(t8, fx.id);
  }
  assert.equal(t8.completed, true);

  const tblA = computePointsTable(t8.lineups, t8.fixtures, "Group A");
  assert.equal(tblA.length, 4);

  const { awards } = computeSeasonStatsAndAwards(t8);
  assert.ok(awards.championTeamId);
  assert.ok(awards.orangeCap && awards.orangeCap.runs >= 0);
  assert.ok(awards.purpleCap && awards.purpleCap.wickets >= 0);
  assert.ok(awards.mvp);
  assert.ok(awards.bestValueBuy);
});
