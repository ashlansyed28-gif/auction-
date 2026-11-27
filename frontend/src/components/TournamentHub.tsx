import { useMemo, useState } from "react";
import type { TournamentFixture, TournamentState } from "../engine/tournamentEngine";
import {
  computePointsTable,
  computeSeasonStatsAndAwards,
} from "../engine/tournamentEngine";
import { formatLakhsCrores } from "../utils/auctionRules";
import { CricketJerseySvg } from "./illustrations/CricketJerseySvg";
import { PlayerPortrait } from "./PlayerPortrait";

interface TournamentHubProps {
  tournament: TournamentState;
  onPlayFixture: (fixture: TournamentFixture, mode: "PLAY" | "WATCH_AI") => void;
  onSimFixture: (fixtureId: string) => void;
  onSimAllGroupMatches: () => void;
  onNewSeason: () => void;
  onBackHome: () => void;
}

export function TournamentHub({
  tournament,
  onPlayFixture,
  onSimFixture,
  onSimAllGroupMatches,
  onNewSeason,
  onBackHome,
}: TournamentHubProps) {
  const [copiedCard, setCopiedCard] = useState(false);

  const isTwoGroup = tournament.lineups.length === 8;
  const tableAll = useMemo(
    () => computePointsTable(tournament.lineups, tournament.fixtures),
    [tournament.lineups, tournament.fixtures],
  );
  const tableA = useMemo(
    () => (isTwoGroup ? computePointsTable(tournament.lineups, tournament.fixtures, "Group A") : []),
    [isTwoGroup, tournament.lineups, tournament.fixtures],
  );
  const tableB = useMemo(
    () => (isTwoGroup ? computePointsTable(tournament.lineups, tournament.fixtures, "Group B") : []),
    [isTwoGroup, tournament.lineups, tournament.fixtures],
  );

  const { playerStats, awards } = useMemo(
    () => computeSeasonStatsAndAwards(tournament),
    [tournament],
  );

  const championLineup = awards.championTeamId
    ? tournament.lineups.find((l) => l.teamId === awards.championTeamId) || null
    : null;

  const hasPendingGroups = tournament.fixtures.some(
    (f) => f.stage === "GROUP" && !f.completedMatch,
  );

  const handleShareChampion = async () => {
    if (!championLineup) return;
    const text = [
      `🏆 CRICKET BID WARS CHAMPION: ${championLineup.name} (${championLineup.code})!`,
      awards.orangeCap ? `🧢 Orange Cap: ${awards.orangeCap.player.name} (${awards.orangeCap.runs} runs)` : "",
      awards.purpleCap ? `🧢 Purple Cap: ${awards.purpleCap.player.name} (${awards.purpleCap.wickets} wkts)` : "",
      awards.mvp ? `⭐ MVP: ${awards.mvp.player.name} (${awards.mvp.mvpPoints} pts)` : "",
      awards.bestValueBuy
        ? `💎 Best Value Buy: ${awards.bestValueBuy.player.name} (${formatLakhsCrores(awards.bestValueBuy.paidCr)})`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
    setCopiedCard(true);
    setTimeout(() => setCopiedCard(false), 1800);
  };

  const renderPointsTable = (title: string, rows: typeof tableAll) => (
    <section className="rounded-2xl bg-slate-900/90 border border-white/15 p-4 space-y-2.5">
      <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">{title}</h2>
      <div className="overflow-x-auto text-xs tnum">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase text-slate-400 border-b border-white/10">
              <th className="py-1.5">#</th>
              <th>Team</th>
              <th>P</th>
              <th>W</th>
              <th>L</th>
              <th>Pts</th>
              <th>NRR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.teamId} className="border-b border-white/5">
                <td className="py-1.5 font-bold text-slate-400">{i + 1}</td>
                <td className="py-1.5 font-extrabold text-white flex items-center gap-1.5">
                  <CricketJerseySvg kit={r.kit} size={20} />
                  <span>{r.code}</span>
                </td>
                <td>{r.played}</td>
                <td>{r.won}</td>
                <td>{r.lost}</td>
                <td className="font-black text-amber-300">{r.points}</td>
                <td>{r.nrr >= 0 ? `+${r.nrr.toFixed(3)}` : r.nrr.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="min-h-[100dvh] px-3 sm:px-6 py-4 max-w-6xl mx-auto space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-slate-900/90 border border-white/15">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/15 text-xs font-bold text-slate-200 cursor-pointer"
          >
            ← Home
          </button>
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-amber-300">
              {tournament.formatLabel}
            </div>
            <h1 className="text-lg sm:text-2xl font-black text-white">4-a-Side Tournament Hub</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasPendingGroups && (
            <button
              type="button"
              onClick={onSimAllGroupMatches}
              className="px-3.5 py-2 rounded-xl bg-slate-800 border border-amber-400/40 text-xs font-black text-amber-300 cursor-pointer"
            >
              ⏩ Sim All Group Matches
            </button>
          )}
          <button
            type="button"
            onClick={onNewSeason}
            className="px-3.5 py-2 rounded-xl bg-slate-800 border border-white/15 text-xs font-bold text-slate-200 cursor-pointer"
          >
            New Tournament
          </button>
        </div>
      </header>

      {/* CHAMPION CARD & SEASON AWARDS */}
      {tournament.completed && championLineup && (
        <section
          className="rounded-3xl bg-slate-950 border-2 p-5 sm:p-6 shadow-2xl space-y-4"
          style={{ borderColor: championLineup.kit.primary, boxShadow: `0 0 40px ${championLineup.kit.glow}` }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CricketJerseySvg kit={championLineup.kit} size={62} />
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">
                  🏆 TOURNAMENT CHAMPIONS
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">{championLineup.name}</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={handleShareChampion}
              className="px-4 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
            >
              {copiedCard ? "✓ Champion Card Copied!" : "📤 Share Champion Card"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {[
              {
                title: "🧢 Orange Cap (Runs)",
                stat: awards.orangeCap,
                value: awards.orangeCap ? `${awards.orangeCap.runs} runs (${awards.orangeCap.balls}b)` : "—",
              },
              {
                title: "🧢 Purple Cap (Wickets)",
                stat: awards.purpleCap,
                value: awards.purpleCap ? `${awards.purpleCap.wickets} wkts` : "—",
              },
              {
                title: "⭐ Tournament MVP",
                stat: awards.mvp,
                value: awards.mvp ? `${awards.mvp.mvpPoints} impact pts` : "—",
              },
              {
                title: "💎 Best Value Buy",
                stat: awards.bestValueBuy,
                value: awards.bestValueBuy
                  ? `${awards.bestValueBuy.valueScore} pts/Cr (${formatLakhsCrores(awards.bestValueBuy.paidCr)})`
                  : "—",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl bg-slate-900/90 border border-white/10 p-3 flex items-center gap-2.5"
              >
                {card.stat && <PlayerPortrait player={card.stat.player} className="w-11 h-14 rounded shrink-0" />}
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase text-amber-300">{card.title}</div>
                  <div className="text-sm font-black text-white truncate">{card.stat?.player.name || "—"}</div>
                  <div className="text-[11px] text-emerald-300 font-bold tnum">{card.value}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Points Table + Fixtures */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.4fr] gap-4 items-start">
        <div className="space-y-4">
          {isTwoGroup ? (
            <>
              {renderPointsTable("Group A Standings", tableA)}
              {renderPointsTable("Group B Standings", tableB)}
            </>
          ) : (
            renderPointsTable("Live Points Table (2 pts/win • NRR Tiebreak)", tableAll)
          )}

          {/* Top Performers */}
          <section className="rounded-2xl bg-slate-900/90 border border-white/15 p-4 space-y-2 text-xs">
            <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">Season Leaders</h2>
            <div className="space-y-1.5 tnum">
              {playerStats
                .slice()
                .sort((a, b) => b.mvpPoints - a.mvpPoints)
                .slice(0, 6)
                .map((s) => (
                  <div key={s.player.id} className="flex items-center justify-between gap-2 bg-slate-950/70 rounded-lg px-2.5 py-1.5">
                    <span className="font-bold text-white truncate">
                      [{s.teamCode}] {s.player.name}
                    </span>
                    <span className="text-slate-300 shrink-0">
                      {s.runs}r • {s.wickets}w • <strong className="text-amber-300">{s.mvpPoints}</strong> pts
                    </span>
                  </div>
                ))}
            </div>
          </section>
        </div>

        {/* Fixtures Bracket */}
        <section className="rounded-2xl bg-slate-900/90 border border-white/15 p-4 space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">
            Fixtures &amp; Playoffs Bracket
          </h2>
          <div className="space-y-2">
            {tournament.fixtures.map((fx) => {
              const teamA = tournament.lineups.find((l) => l.teamId === fx.teamAId);
              const teamB = tournament.lineups.find((l) => l.teamId === fx.teamBId);
              const done = fx.completedMatch?.phase === "COMPLETE";
              const ready = Boolean(teamA && teamB && !done);

              return (
                <div
                  key={fx.id}
                  className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-2 ${
                    fx.stage === "FINAL"
                      ? "bg-amber-400/10 border-amber-400/45"
                      : "bg-slate-950/75 border-white/10"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase text-amber-300">
                      {fx.label} • Pitch: {fx.pitch}
                    </div>
                    <div className="text-sm font-black text-white">
                      {teamA && teamB ? `${teamA.code} vs ${teamB.code}` : "TBD (Pending Qualifiers)"}
                    </div>
                    {done && fx.completedMatch && (
                      <div className="text-xs text-emerald-300 font-bold tnum">
                        ✓ {fx.completedMatch.resultText} ({fx.completedMatch.innings1.runs}/
                        {fx.completedMatch.innings1.wickets} vs {fx.completedMatch.innings2?.runs ?? 0}/
                        {fx.completedMatch.innings2?.wickets ?? 0})
                      </div>
                    )}
                  </div>

                  {ready && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => onPlayFixture(fx, "PLAY")}
                        className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black cursor-pointer"
                      >
                        🏏 Play Live
                      </button>
                      <button
                        type="button"
                        onClick={() => onPlayFixture(fx, "WATCH_AI")}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[11px] font-bold cursor-pointer"
                      >
                        👁 Watch AI
                      </button>
                      <button
                        type="button"
                        onClick={() => onSimFixture(fx.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/15 text-slate-200 text-[11px] font-bold cursor-pointer"
                      >
                        ⏩ Auto-Sim
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
