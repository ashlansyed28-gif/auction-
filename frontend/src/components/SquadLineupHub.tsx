import { useMemo, useState } from "react";
import type { MatchTeamLineup, WicketRule } from "../engine/matchEngine";
import { evaluateLineupStrengths } from "../engine/tournamentEngine";
import { CricketJerseySvg } from "./illustrations/CricketJerseySvg";
import { PlayerPortrait } from "./PlayerPortrait";

interface SquadLineupHubProps {
  initialLineups: MatchTeamLineup[];
  initialWicketRule?: WicketRule;
  onBack: () => void;
  onStartTournament: (lineups: MatchTeamLineup[], wicketRule: WicketRule) => void;
}

export function SquadLineupHub({
  initialLineups,
  initialWicketRule = "LAST_MAN_STANDS",
  onBack,
  onStartTournament,
}: SquadLineupHubProps) {
  const [lineups, setLineups] = useState<MatchTeamLineup[]>(initialLineups);
  const [wicketRule, setWicketRule] = useState<WicketRule>(initialWicketRule);

  const strengths = useMemo(() => evaluateLineupStrengths(lineups), [lineups]);

  const movePlayer = (teamIdx: number, playerIdx: number, dir: -1 | 1) => {
    const target = playerIdx + dir;
    setLineups((prev) =>
      prev.map((l, idx) => {
        if (idx !== teamIdx) return l;
        if (target < 0 || target >= l.players.length) return l;
        const copy = [...l.players];
        const tmp = copy[playerIdx];
        copy[playerIdx] = copy[target];
        copy[target] = tmp;
        return { ...l, players: copy };
      }),
    );
  };

  const setCaptain = (teamIdx: number, playerId: number) => {
    setLineups((prev) =>
      prev.map((l, idx) => (idx === teamIdx ? { ...l, captainId: playerId } : l)),
    );
  };

  return (
    <div className="min-h-[100dvh] px-3 sm:px-6 py-4 max-w-6xl mx-auto flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-900/90 border border-white/15">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/15 text-xs font-bold text-slate-200 cursor-pointer"
          >
            ← Back
          </button>
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-amber-300">
              Mode 1 • Step B
            </div>
            <h1 className="text-lg sm:text-2xl font-black text-white">Squad &amp; Lineup Hub</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-950 border border-white/15 p-1 text-[11px]">
            <button
              type="button"
              onClick={() => setWicketRule("LAST_MAN_STANDS")}
              className={`px-2.5 py-1 rounded-lg font-extrabold cursor-pointer ${
                wicketRule === "LAST_MAN_STANDS"
                  ? "bg-amber-400 text-slate-950"
                  : "text-slate-300"
              }`}
            >
              Last-Man-Stands (4 Wkt)
            </button>
            <button
              type="button"
              onClick={() => setWicketRule("THREE_WICKETS_ALL_OUT")}
              className={`px-2.5 py-1 rounded-lg font-extrabold cursor-pointer ${
                wicketRule === "THREE_WICKETS_ALL_OUT"
                  ? "bg-amber-400 text-slate-950"
                  : "text-slate-300"
              }`}
            >
              3-Wickets All-Out
            </button>
          </div>

          <button
            type="button"
            onClick={() => onStartTournament(lineups, wicketRule)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer"
          >
            Start 4-a-Side Tournament →
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lineups.map((team, teamIdx) => {
          const st = strengths.find((s) => s.teamId === team.teamId);
          return (
            <section
              key={team.teamId}
              className="rounded-2xl bg-slate-900/90 border border-white/15 p-4 space-y-3 shadow-xl"
            >
              {/* Header + Strength Bars */}
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-white/10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CricketJerseySvg kit={team.kit} size={42} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-black"
                        style={{ backgroundColor: team.kit.secondary, color: team.kit.accent }}
                      >
                        {team.code}
                      </span>
                      <h2 className="text-sm sm:text-base font-black text-white truncate">{team.name}</h2>
                    </div>
                    <div className="text-[11px] text-slate-400 tnum">
                      Projected Rank:{" "}
                      <strong className="text-amber-300">#{st?.projectedRank ?? 1}</strong>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center tnum text-[10px]">
                  <div className="rounded-lg bg-slate-950/75 px-2 py-1 border border-white/10">
                    <div className="text-slate-400 font-bold">BAT</div>
                    <div className="text-sm font-black text-emerald-300">{st?.battingRating}</div>
                  </div>
                  <div className="rounded-lg bg-slate-950/75 px-2 py-1 border border-white/10">
                    <div className="text-slate-400 font-bold">BOWL</div>
                    <div className="text-sm font-black text-sky-300">{st?.bowlingRating}</div>
                  </div>
                  <div className="rounded-lg bg-slate-950/75 px-2 py-1 border border-white/10">
                    <div className="text-slate-400 font-bold">BAL</div>
                    <div className="text-sm font-black text-amber-300">{st?.balanceMeter}%</div>
                  </div>
                </div>
              </div>

              {/* Balance Meter */}
              <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400"
                  style={{ width: `${st?.balanceMeter ?? 75}%` }}
                />
              </div>

              {/* Playing 4 Batting Order & Captaincy */}
              <div className="space-y-1.5">
                {team.players.map((p, pIdx) => {
                  const isCap = team.captainId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border ${
                        isCap
                          ? "bg-amber-400/12 border-amber-400/45"
                          : "bg-slate-950/70 border-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 text-center text-[11px] font-black text-slate-400 tnum">
                          #{pIdx + 1}
                        </span>
                        <PlayerPortrait player={p} className="w-8 h-9 rounded-md shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-white truncate">
                            {p.name} {isCap ? "👑" : ""}
                          </div>
                          <div className="text-[10px] text-slate-400 tnum">
                            {p.role} • BAT {p.batOvr} • BOWL {p.bowlOvr}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCaptain(teamIdx, p.id)}
                          className={`px-2 py-1 rounded text-[10px] font-black border cursor-pointer ${
                            isCap
                              ? "bg-amber-400 text-slate-950 border-amber-300"
                              : "bg-slate-800 text-slate-300 border-white/10"
                          }`}
                        >
                          {isCap ? "CAPTAIN" : "Make C"}
                        </button>
                        <button
                          type="button"
                          disabled={pIdx === 0}
                          onClick={() => movePlayer(teamIdx, pIdx, -1)}
                          className="w-6 h-6 rounded bg-slate-800 text-xs font-bold disabled:opacity-30 cursor-pointer"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={pIdx === team.players.length - 1}
                          onClick={() => movePlayer(teamIdx, pIdx, 1)}
                          className="w-6 h-6 rounded bg-slate-800 text-xs font-bold disabled:opacity-30 cursor-pointer"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
