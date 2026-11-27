import type { BroadcastPlayer, FriendTeam } from "../types/auction";
import type {
  InningsState,
  MatchConfig,
  MatchPlayer,
  MatchState,
  MatchTeamLineup,
  PitchCondition,
  WicketRule,
} from "./matchEngine";
import { createMatchState, simulateFullMatch } from "./matchEngine.ts";

export interface TeamLineupStrength {
  teamId: string;
  battingRating: number;
  bowlingRating: number;
  balanceMeter: number; // 0..100
  overallStrength: number;
  projectedRank: number;
}

export type FixtureStage = "GROUP" | "SEMI_FINAL" | "FINAL";

export interface TournamentFixture {
  id: string;
  roundNumber: number;
  stage: FixtureStage;
  groupName?: "Group A" | "Group B";
  label: string;
  teamAId: string | null;
  teamBId: string | null;
  pitch: PitchCondition;
  completedMatch: MatchState | null;
}

export interface PointsTableRow {
  teamId: string;
  code: string;
  name: string;
  kit: FriendTeam["kit"];
  groupName?: "Group A" | "Group B";
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  runsFor: number;
  oversForBalls: number; // effective balls for NRR (all out -> 36)
  runsAgainst: number;
  oversAgainstBalls: number;
  nrr: number;
}

export interface CumulativePlayerSeasonStats {
  player: MatchPlayer;
  teamId: string;
  teamCode: string;
  teamName: string;
  matches: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  mvpPoints: number;
  paidCr: number;
  valueScore: number;
}

export interface SeasonAwards {
  championTeamId: string | null;
  runnerUpTeamId: string | null;
  orangeCap: CumulativePlayerSeasonStats | null;
  purpleCap: CumulativePlayerSeasonStats | null;
  mvp: CumulativePlayerSeasonStats | null;
  bestValueBuy: CumulativePlayerSeasonStats | null;
}

export interface TournamentState {
  id: string;
  formatLabel: string;
  wicketRule: WicketRule;
  lineups: MatchTeamLineup[];
  fixtures: TournamentFixture[];
  seedBase: number;
  completed: boolean;
}

const PITCH_ROTATION: PitchCondition[] = ["Green", "Dusty", "Dead"];

/** Builds Playing-4 lineups from auction squads (auto-topping up from pool if < 4). */
export function buildLineupsFromAuctionTeams(
  teams: FriendTeam[],
  fallbackPool: BroadcastPlayer[],
): MatchTeamLineup[] {
  const claimedIds = new Set<number>();
  for (const t of teams) {
    for (const s of t.squad) claimedIds.add(s.player.id);
  }
  const sparePool = fallbackPool.filter((p) => !claimedIds.has(p.id));
  let spareCursor = 0;

  return teams.map((team) => {
    const owned: MatchPlayer[] = team.squad.map((s) => ({
      ...s.player,
      paidCr: s.paidCr,
    }));

    // Rank owned players so top balanced 4 make Playing IV by default
    const sorted = owned.slice().sort((a, b) => b.ovr - a.ovr);
    const playing4: MatchPlayer[] = sorted.slice(0, 4);

    while (playing4.length < 4 && spareCursor < sparePool.length) {
      const p = sparePool[spareCursor++];
      playing4.push({ ...p, paidCr: p.basePriceCr });
    }
    while (playing4.length < 4 && fallbackPool.length > 0) {
      const p = fallbackPool[playing4.length % fallbackPool.length];
      playing4.push({ ...p, paidCr: p.basePriceCr });
    }

    const captain =
      playing4.find((p) => p.role === "All-Rounder" || p.role === "WK-Batter") ||
      playing4[0];

    return {
      teamId: team.id,
      code: team.kit.code,
      name: team.name,
      kit: team.kit,
      captainId: captain?.id ?? playing4[0]?.id ?? 1,
      players: playing4.slice(0, 4),
    };
  });
}

export function evaluateLineupStrengths(lineups: MatchTeamLineup[]): TeamLineupStrength[] {
  const raw = lineups.map((l) => {
    const p = l.players;
    const avgBat = p.reduce((s, x) => s + x.batOvr, 0) / Math.max(1, p.length);
    const avgBowl = p.reduce((s, x) => s + x.bowlOvr, 0) / Math.max(1, p.length);
    const bowlersCapable = p.filter((x) => x.bowlOvr >= 60).length;
    const battersCapable = p.filter((x) => x.batOvr >= 65).length;
    const balancePenalty = Math.abs(avgBat - avgBowl) * 0.45;
    const balanceMeter = Math.round(
      Math.max(25, Math.min(100, 62 + bowlersCapable * 7 + battersCapable * 5 - balancePenalty)),
    );
    const battingRating = Math.round(avgBat);
    const bowlingRating = Math.round(avgBowl);
    const overallStrength = Math.round(battingRating * 0.45 + bowlingRating * 0.4 + balanceMeter * 0.15);

    return {
      teamId: l.teamId,
      battingRating,
      bowlingRating,
      balanceMeter,
      overallStrength,
      projectedRank: 1,
    };
  });

  const ranked = raw
    .slice()
    .sort((a, b) => b.overallStrength - a.overallStrength || b.battingRating - a.battingRating);

  return raw.map((item) => ({
    ...item,
    projectedRank: ranked.findIndex((r) => r.teamId === item.teamId) + 1,
  }));
}

function generateRoundRobinPairs(ids: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  return pairs;
}

export function createTournament(
  lineups: MatchTeamLineup[],
  wicketRule: WicketRule = "LAST_MAN_STANDS",
  seedBase = Date.now(),
): TournamentState {
  const n = lineups.length;
  const fixtures: TournamentFixture[] = [];
  let round = 1;
  let formatLabel = "Round-Robin + Final";

  if (n === 8) {
    formatLabel = "2 Groups of 4 → Semi-Finals → Final";
    const groupA = lineups.slice(0, 4).map((l) => l.teamId);
    const groupB = lineups.slice(4, 8).map((l) => l.teamId);
    const pairsA = generateRoundRobinPairs(groupA);
    const pairsB = generateRoundRobinPairs(groupB);

    const maxLen = Math.max(pairsA.length, pairsB.length);
    for (let i = 0; i < maxLen; i++) {
      if (pairsA[i]) {
        fixtures.push({
          id: `fx_ga_${i + 1}`,
          roundNumber: round++,
          stage: "GROUP",
          groupName: "Group A",
          label: `Group A • Match ${i + 1}`,
          teamAId: pairsA[i][0],
          teamBId: pairsA[i][1],
          pitch: PITCH_ROTATION[i % PITCH_ROTATION.length],
          completedMatch: null,
        });
      }
      if (pairsB[i]) {
        fixtures.push({
          id: `fx_gb_${i + 1}`,
          roundNumber: round++,
          stage: "GROUP",
          groupName: "Group B",
          label: `Group B • Match ${i + 1}`,
          teamAId: pairsB[i][0],
          teamBId: pairsB[i][1],
          pitch: PITCH_ROTATION[(i + 1) % PITCH_ROTATION.length],
          completedMatch: null,
        });
      }
    }

    fixtures.push(
      {
        id: "fx_sf_1",
        roundNumber: round++,
        stage: "SEMI_FINAL",
        label: "Semi-Final 1 (A1 vs B2)",
        teamAId: null,
        teamBId: null,
        pitch: "Green",
        completedMatch: null,
      },
      {
        id: "fx_sf_2",
        roundNumber: round++,
        stage: "SEMI_FINAL",
        label: "Semi-Final 2 (B1 vs A2)",
        teamAId: null,
        teamBId: null,
        pitch: "Dusty",
        completedMatch: null,
      },
      {
        id: "fx_final",
        roundNumber: round++,
        stage: "FINAL",
        label: "Grand Championship Final",
        teamAId: null,
        teamBId: null,
        pitch: "Dead",
        completedMatch: null,
      },
    );
  } else {
    const hasSemis = n >= 5;
    formatLabel =
      n === 4
        ? "4-Team Round-Robin → Final"
        : hasSemis
        ? `${n}-Team Round-Robin → Top-4 Semi-Finals → Final`
        : `${n}-Team Series → Final`;

    const pairs = generateRoundRobinPairs(lineups.map((l) => l.teamId));
    pairs.forEach(([a, b], idx) => {
      fixtures.push({
        id: `fx_grp_${idx + 1}`,
        roundNumber: round++,
        stage: "GROUP",
        label: `League Match ${idx + 1}`,
        teamAId: a,
        teamBId: b,
        pitch: PITCH_ROTATION[idx % PITCH_ROTATION.length],
        completedMatch: null,
      });
    });

    if (hasSemis) {
      fixtures.push(
        {
          id: "fx_sf_1",
          roundNumber: round++,
          stage: "SEMI_FINAL",
          label: "Semi-Final 1 (#1 vs #4)",
          teamAId: null,
          teamBId: null,
          pitch: "Green",
          completedMatch: null,
        },
        {
          id: "fx_sf_2",
          roundNumber: round++,
          stage: "SEMI_FINAL",
          label: "Semi-Final 2 (#2 vs #3)",
          teamAId: null,
          teamBId: null,
          pitch: "Dusty",
          completedMatch: null,
        },
      );
    }

    fixtures.push({
      id: "fx_final",
      roundNumber: round++,
      stage: "FINAL",
      label: "Grand Championship Final",
      teamAId: null,
      teamBId: null,
      pitch: "Dead",
      completedMatch: null,
    });
  }

  return {
    id: `tour_${seedBase}`,
    formatLabel,
    wicketRule,
    lineups,
    fixtures,
    seedBase,
    completed: false,
  };
}

function getEffectiveNrrBalls(innings: InningsState): number {
  const maxBalls = innings.maxOvers * 6;
  const allOut = innings.wickets >= innings.maxWickets;
  return allOut ? maxBalls : Math.max(1, innings.legalBalls);
}

export function computePointsTable(
  lineups: MatchTeamLineup[],
  fixtures: TournamentFixture[],
  groupFilter?: "Group A" | "Group B",
): PointsTableRow[] {
  const rows = new Map<string, PointsTableRow>();
  lineups.forEach((l, idx) => {
    const groupName =
      lineups.length === 8 ? (idx < 4 ? "Group A" : "Group B") : undefined;
    if (groupFilter && groupName !== groupFilter) return;
    rows.set(l.teamId, {
      teamId: l.teamId,
      code: l.code,
      name: l.name,
      kit: l.kit,
      groupName,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      points: 0,
      runsFor: 0,
      oversForBalls: 0,
      runsAgainst: 0,
      oversAgainstBalls: 0,
      nrr: 0,
    });
  });

  for (const fx of fixtures) {
    if (fx.stage !== "GROUP" || !fx.completedMatch) continue;
    const m = fx.completedMatch;
    if (m.phase !== "COMPLETE" || !m.innings2) continue;

    const inn1 = m.innings1;
    const inn2 = m.innings2;
    const r1 = rows.get(inn1.battingTeamId);
    const r2 = rows.get(inn2.battingTeamId);

    if (r1) {
      r1.played += 1;
      r1.runsFor += inn1.runs;
      r1.oversForBalls += getEffectiveNrrBalls(inn1);
      r1.runsAgainst += inn2.runs;
      r1.oversAgainstBalls += getEffectiveNrrBalls(inn2);
      if (m.winnerTeamId === r1.teamId) {
        r1.won += 1;
        r1.points += 2;
      } else if (m.winnerTeamId === null) {
        r1.tied += 1;
        r1.points += 1;
      } else {
        r1.lost += 1;
      }
    }

    if (r2) {
      r2.played += 1;
      r2.runsFor += inn2.runs;
      r2.oversForBalls += getEffectiveNrrBalls(inn2);
      r2.runsAgainst += inn1.runs;
      r2.oversAgainstBalls += getEffectiveNrrBalls(inn1);
      if (m.winnerTeamId === r2.teamId) {
        r2.won += 1;
        r2.points += 2;
      } else if (m.winnerTeamId === null) {
        r2.tied += 1;
        r2.points += 1;
      } else {
        r2.lost += 1;
      }
    }
  }

  return Array.from(rows.values())
    .map((r) => {
      const forRate = r.oversForBalls > 0 ? r.runsFor / (r.oversForBalls / 6) : 0;
      const agRate = r.oversAgainstBalls > 0 ? r.runsAgainst / (r.oversAgainstBalls / 6) : 0;
      return {
        ...r,
        nrr: Math.round((forRate - agRate) * 1000) / 1000,
      };
    })
    .sort((a, b) => b.points - a.points || b.nrr - a.nrr || b.won - a.won);
}

/** Records a completed match into a tournament and unlocks Semi-Finals / Final when ready. */
export function recordTournamentMatchResult(
  tournament: TournamentState,
  fixtureId: string,
  completedMatch: MatchState,
): TournamentState {
  const nextFixtures = tournament.fixtures.map((fx) =>
    fx.id === fixtureId ? { ...fx, completedMatch } : fx,
  );

  const groupFixtures = nextFixtures.filter((f) => f.stage === "GROUP");
  const allGroupsDone = groupFixtures.every((f) => f.completedMatch?.phase === "COMPLETE");

  if (allGroupsDone) {
    const sf1 = nextFixtures.find((f) => f.id === "fx_sf_1");
    const sf2 = nextFixtures.find((f) => f.id === "fx_sf_2");
    const finalFx = nextFixtures.find((f) => f.id === "fx_final");

    if (sf1 && sf2 && (!sf1.teamAId || !sf2.teamAId)) {
      if (tournament.lineups.length === 8) {
        const tblA = computePointsTable(tournament.lineups, nextFixtures, "Group A");
        const tblB = computePointsTable(tournament.lineups, nextFixtures, "Group B");
        sf1.teamAId = tblA[0]?.teamId ?? null;
        sf1.teamBId = tblB[1]?.teamId ?? null;
        sf2.teamAId = tblB[0]?.teamId ?? null;
        sf2.teamBId = tblA[1]?.teamId ?? null;
      } else {
        const tbl = computePointsTable(tournament.lineups, nextFixtures);
        sf1.teamAId = tbl[0]?.teamId ?? null;
        sf1.teamBId = tbl[3]?.teamId ?? null;
        sf2.teamAId = tbl[1]?.teamId ?? null;
        sf2.teamBId = tbl[2]?.teamId ?? null;
      }
    } else if (!sf1 && finalFx && !finalFx.teamAId) {
      const tbl = computePointsTable(tournament.lineups, nextFixtures);
      finalFx.teamAId = tbl[0]?.teamId ?? null;
      finalFx.teamBId = tbl[1]?.teamId ?? null;
    }

    if (sf1?.completedMatch?.phase === "COMPLETE" && sf2?.completedMatch?.phase === "COMPLETE" && finalFx && !finalFx.teamAId) {
      finalFx.teamAId = sf1.completedMatch.winnerTeamId;
      finalFx.teamBId = sf2.completedMatch.winnerTeamId;
    }
  }

  const finalCompleted =
    nextFixtures.find((f) => f.id === "fx_final")?.completedMatch?.phase === "COMPLETE";

  return {
    ...tournament,
    fixtures: nextFixtures,
    completed: Boolean(finalCompleted),
  };
}

export function simulateFixtureWithEngine(
  tournament: TournamentState,
  fixtureId: string,
): TournamentState {
  const fx = tournament.fixtures.find((f) => f.id === fixtureId);
  if (!fx || !fx.teamAId || !fx.teamBId || fx.completedMatch?.phase === "COMPLETE") {
    return tournament;
  }
  const teamA = tournament.lineups.find((l) => l.teamId === fx.teamAId);
  const teamB = tournament.lineups.find((l) => l.teamId === fx.teamBId);
  if (!teamA || !teamB) return tournament;

  const cfg: MatchConfig = {
    seed: (tournament.seedBase + fx.roundNumber * 7919) | 0,
    pitch: fx.pitch,
    wicketRule: tournament.wicketRule,
    oversPerInnings: 6,
    botDifficulty: "Medium",
  };
  const match = createMatchState(fx.id, teamA, teamB, cfg);
  const finished = simulateFullMatch(match, "Medium");
  return recordTournamentMatchResult(tournament, fixtureId, finished);
}

export function computeSeasonStatsAndAwards(tournament: TournamentState): {
  playerStats: CumulativePlayerSeasonStats[];
  awards: SeasonAwards;
} {
  const map = new Map<number, CumulativePlayerSeasonStats>();

  for (const l of tournament.lineups) {
    for (const p of l.players) {
      map.set(p.id, {
        player: p,
        teamId: l.teamId,
        teamCode: l.code,
        teamName: l.name,
        matches: 0,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        wickets: 0,
        ballsBowled: 0,
        runsConceded: 0,
        mvpPoints: 0,
        paidCr: p.paidCr ?? p.basePriceCr,
        valueScore: 0,
      });
    }
  }

  for (const fx of tournament.fixtures) {
    const m = fx.completedMatch;
    if (!m || m.phase !== "COMPLETE") continue;
    const seenInMatch = new Set<number>();

    const inningsList = [m.innings1, m.innings2].filter(Boolean) as InningsState[];
    for (const inn of inningsList) {
      for (const b of Object.values(inn.batterStats)) {
        const cur = map.get(b.playerId);
        if (!cur) continue;
        if (!seenInMatch.has(b.playerId) && (b.balls > 0 || b.isOut)) {
          cur.matches += 1;
          seenInMatch.add(b.playerId);
        }
        cur.runs += b.runs;
        cur.balls += b.balls;
        cur.fours += b.fours;
        cur.sixes += b.sixes;
      }
      for (const bw of Object.values(inn.bowlerStats)) {
        const cur = map.get(bw.playerId);
        if (!cur) continue;
        if (!seenInMatch.has(bw.playerId) && bw.legalBalls > 0) {
          cur.matches += 1;
          seenInMatch.add(bw.playerId);
        }
        cur.wickets += bw.wickets;
        cur.ballsBowled += bw.legalBalls;
        cur.runsConceded += bw.runsConceded;
      }
    }
  }

  const playerStats = Array.from(map.values()).map((s) => {
    const mvpPoints = Math.round(
      (s.runs + s.wickets * 22 + s.fours * 1.5 + s.sixes * 3 - s.balls * 0.2) * 10,
    ) / 10;
    const paid = Math.max(0.4, s.paidCr);
    const valueScore = Math.round((mvpPoints / paid) * 10) / 10;
    return { ...s, mvpPoints, valueScore };
  });

  const orangeCap =
    playerStats
      .slice()
      .sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0] || null;
  const purpleCap =
    playerStats
      .slice()
      .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)[0] || null;
  const mvp =
    playerStats
      .slice()
      .sort((a, b) => b.mvpPoints - a.mvpPoints)[0] || null;
  const bestValueBuy =
    playerStats
      .slice()
      .sort((a, b) => b.valueScore - a.valueScore)[0] || null;

  const finalFx = tournament.fixtures.find((f) => f.id === "fx_final")?.completedMatch;
  const championTeamId = finalFx?.winnerTeamId ?? null;
  const runnerUpTeamId =
    championTeamId && finalFx
      ? finalFx.teamA.teamId === championTeamId
        ? finalFx.teamB.teamId
        : finalFx.teamA.teamId
      : null;

  return {
    playerStats,
    awards: {
      championTeamId,
      runnerUpTeamId,
      orangeCap,
      purpleCap,
      mvp,
      bestValueBuy,
    },
  };
}
