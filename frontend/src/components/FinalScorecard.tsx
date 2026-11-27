import type { ChallengeConfig, FriendTeam } from "../types/auction";
import { evaluateFriendScorecard, formatCompactPurse, formatLakhsCrores } from "../utils/auctionRules";
import { CricketJerseySvg } from "./illustrations/CricketJerseySvg";

interface FinalScorecardProps {
  teams: FriendTeam[];
  config: ChallengeConfig;
  unsoldCount: number;
  onProceedToTournament?: () => void;
  onRematch: () => void;
  onBackToSetup: () => void;
}

export function FinalScorecard({
  teams,
  config,
  unsoldCount,
  onProceedToTournament,
  onRematch,
  onBackToSetup,
}: FinalScorecardProps) {
  const cards = teams
    .map((t) => evaluateFriendScorecard(t, config.minSquadSize))
    .sort((a, b) => b.squadRating - a.squadRating || b.purseLeftCr - a.purseLeftCr);

  const champion = cards[0];

  return (
    <div className="min-h-screen px-4 py-6 max-w-6xl mx-auto flex flex-col justify-between">
      <div>
        <header className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs font-extrabold uppercase tracking-widest mb-2">
            Final Squad Scorecard • {unsoldCount} Unsold
          </div>
          <h1 className="text-3xl font-black text-white">FRIEND CHALLENGE VERDICT</h1>
          {champion && champion.team.squad.length > 0 && (
            <div className="mt-3 inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-400/20 to-yellow-500/10 border border-amber-400/45">
              <CricketJerseySvg kit={champion.team.kit} size={42} />
              <div className="text-left">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                  Top Rated Franchise
                </div>
                <div className="text-base font-black text-white tnum">
                  {champion.team.name} — {champion.squadRating}/100
                </div>
              </div>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card, rank) => (
            <section
              key={card.team.id}
              className={`rounded-2xl p-5 border shadow-xl ${
                rank === 0 && card.team.squad.length > 0
                  ? "bg-slate-900/95 border-amber-400/60"
                  : "bg-slate-900/80 border-white/10"
              }`}
            >
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <CricketJerseySvg kit={card.team.kit} size={52} />
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: card.team.kit.accent }}>
                      Rank #{rank + 1} • {card.team.kit.label}
                    </div>
                    <h2 className="text-lg font-black text-white">{card.team.name}</h2>
                    <div className="text-xs text-slate-400 tnum">
                      Spent {formatCompactPurse(card.totalSpentCr)} • Left {formatCompactPurse(card.purseLeftCr)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-black text-amber-300 tnum">{card.squadRating}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Rating / 100</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 my-3 text-center text-xs tnum">
                <div className="rounded-lg bg-slate-950/65 p-2">
                  <span className="block text-[10px] text-slate-400">BAT</span>
                  <strong className="text-white">{card.roleCounts.Batter}</strong>
                </div>
                <div className="rounded-lg bg-slate-950/65 p-2">
                  <span className="block text-[10px] text-slate-400">WK</span>
                  <strong className="text-white">{card.roleCounts["WK-Batter"]}</strong>
                </div>
                <div className="rounded-lg bg-slate-950/65 p-2">
                  <span className="block text-[10px] text-slate-400">AR</span>
                  <strong className="text-white">{card.roleCounts["All-Rounder"]}</strong>
                </div>
                <div className="rounded-lg bg-slate-950/65 p-2">
                  <span className="block text-[10px] text-slate-400">BOWL</span>
                  <strong className="text-white">{card.roleCounts.Bowler}</strong>
                </div>
              </div>

              <div className="space-y-1.5 text-xs mb-3">
                <div className="flex justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5">
                  <span className="text-emerald-300 font-bold">Biggest Steal</span>
                  <span className="text-white font-semibold tnum">
                    {card.biggestSteal
                      ? `${card.biggestSteal.player.name} (${formatLakhsCrores(card.biggestSteal.paidCr)})`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-rose-500/10 border border-rose-500/25 px-3 py-1.5">
                  <span className="text-rose-300 font-bold">Biggest Overpay</span>
                  <span className="text-white font-semibold tnum">
                    {card.biggestOverpay
                      ? `${card.biggestOverpay.player.name} (${formatLakhsCrores(card.biggestOverpay.paidCr)})`
                      : "—"}
                  </span>
                </div>
              </div>

              {card.warnings.length > 0 && (
                <div className="text-[11px] text-amber-300/90 mb-2 font-semibold">
                  Notes: {card.warnings.join(" • ")}
                </div>
              )}

              <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                {card.team.squad.length === 0 ? (
                  <div className="text-xs text-slate-500 py-3 text-center">No players signed.</div>
                ) : (
                  card.team.squad.map((s) => (
                    <div
                      key={s.player.id}
                      className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-white/5"
                    >
                      <span className="font-semibold text-slate-100">
                        {s.player.name}{" "}
                        <span className="text-[10px] text-slate-400">
                          ({s.player.role} • OVR {s.player.ovr})
                        </span>
                      </span>
                      <span className="font-bold text-amber-300 tnum">{formatLakhsCrores(s.paidCr)}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        {onProceedToTournament && (
          <button
            type="button"
            onClick={onProceedToTournament}
            className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black uppercase tracking-wider cursor-pointer shadow-lg"
          >
            🏏 Step B: Squad Lineups &amp; 4-a-Side Tournament →
          </button>
        )}
        <button
          type="button"
          onClick={onRematch}
          className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 text-slate-950 font-black uppercase tracking-wider cursor-pointer"
        >
          Rematch Auction
        </button>
        <button
          type="button"
          onClick={onBackToSetup}
          className="flex-1 py-3.5 px-4 rounded-xl bg-slate-800 border border-white/15 text-white font-bold uppercase tracking-wider cursor-pointer"
        >
          Home / Lobby
        </button>
      </div>
    </div>
  );
}
