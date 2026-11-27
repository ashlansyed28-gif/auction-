import type { BroadcastPlayer, ConnectedMember, FriendTeam } from "../types/auction";
import { formatCompactPurse, formatLakhsCrores } from "../utils/auctionRules";
import { PlayerPortrait } from "./PlayerPortrait";
import { CricketJerseySvg } from "./illustrations/CricketJerseySvg";

interface PlayerSoldCardProps {
  player: BroadcastPlayer;
  team: FriendTeam;
  soldPriceCr: number;
  lotNumber: number;
  bidCount: number;
  maxSquadSize: number;
  teamMembers: ConnectedMember[];
  isGuest: boolean;
  isLastLot: boolean;
  onNextLot: () => void;
  onDismiss: () => void;
}

export function PlayerSoldCard({
  player,
  team,
  soldPriceCr,
  lotNumber,
  bidCount,
  maxSquadSize,
  teamMembers,
  isGuest,
  isLastLot,
  onNextLot,
  onDismiss,
}: PlayerSoldCardProps) {
  const captain = teamMembers.find((m) => m.teamRole === "CAPTAIN");

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-slate-950 border-2 shadow-2xl overflow-hidden"
        style={{
          borderColor: team.kit.primary,
          boxShadow: `0 0 60px ${team.kit.glow}`,
        }}
      >
        {/* Top Broadcast Ribbon */}
        <div
          className="px-6 py-3 flex items-center justify-between border-b border-white/15"
          style={{
            background: `linear-gradient(90deg, ${team.kit.secondary}, ${team.kit.primary}55, ${team.kit.secondary})`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black uppercase tracking-widest">
              🔨 HAMMER DOWN • LOT #{lotNumber}
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-white">
              Official Transfer Confirmation
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="px-2.5 py-1 rounded-lg bg-slate-900/80 border border-white/15 text-[11px] font-bold text-slate-200 hover:text-white cursor-pointer"
          >
            Inspect Stage
          </button>
        </div>

        {/* Main Card Body */}
        <div className="p-6 space-y-5">
          <div className="text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.26em] text-amber-300">
              PLAYER HAS BEEN SOLD TO
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-black text-white tracking-tight">
              <span style={{ color: team.kit.accent }}>{team.kit.code}</span> • {team.name}
            </h2>
          </div>

          {/* Player + Winning Franchise Split Card */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-center rounded-2xl bg-slate-900/80 border border-white/10 p-4">
            {/* Player Block */}
            <div className="flex items-center gap-3.5 min-w-0">
              <PlayerPortrait player={player} className="w-20 h-24 shrink-0 border-2 border-amber-400/50" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black tnum">
                    OVR {player.ovr}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-slate-200">
                    {player.category}
                  </span>
                </div>
                <div className="text-lg font-black text-white truncate mt-1">{player.name}</div>
                <div className="text-xs font-bold text-amber-300">
                  {player.role} • {player.type}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {player.bat} • {player.bowl}
                </div>
              </div>
            </div>

            {/* Arrow / Sold Stamp */}
            <div className="flex sm:flex-col items-center justify-center gap-1 px-2">
              <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-xs font-black tracking-widest">
                SOLD TO →
              </div>
              <div className="text-[11px] font-bold text-slate-400 tnum">
                {bidCount} {bidCount === 1 ? "bid" : "bids"}
              </div>
            </div>

            {/* Winning Team Block */}
            <div className="flex items-center gap-3.5 min-w-0 sm:justify-end">
              <div className="min-w-0 sm:text-right order-2 sm:order-1">
                <div
                  className="inline-block px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase"
                  style={{ backgroundColor: team.kit.secondary, color: team.kit.accent }}
                >
                  {team.kit.code} • {team.kit.label}
                </div>
                <div className="text-base font-black text-white truncate mt-1">{team.name}</div>
                {captain && (
                  <div className="text-[11px] font-bold text-amber-300 mt-0.5">
                    👑 Captain: @{captain.friendName}
                  </div>
                )}
                <div className="text-[11px] text-slate-400 mt-0.5 tnum">
                  Purse Left: {formatCompactPurse(team.purseRemainingCr)} • Squad {team.squad.length}/{maxSquadSize}
                </div>
              </div>
              <CricketJerseySvg kit={team.kit} size={68} className="shrink-0 order-1 sm:order-2" />
            </div>
          </div>

          {/* Price Strip + Team Squad Voters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-amber-400/12 border border-amber-400/45 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-200 font-bold">Final Sold Price</div>
                <div className="text-2xl font-black text-amber-300 tnum">{formatLakhsCrores(soldPriceCr)}</div>
              </div>
              <div className="text-right text-[11px] text-slate-300 tnum">
                <div>Base: {formatLakhsCrores(player.basePriceCr)}</div>
                <div className="text-emerald-300 font-bold">Confirmed Deal</div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-900 border border-white/10 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                {team.kit.code} Bidding Squad ({teamMembers.length || 1})
              </div>
              {teamMembers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {teamMembers.map((m) => (
                    <span
                      key={m.clientId}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                        m.teamRole === "CAPTAIN"
                          ? "bg-amber-400/15 border-amber-400/45 text-amber-300"
                          : "bg-slate-950 border-white/10 text-slate-200"
                      }`}
                    >
                      {m.teamRole === "CAPTAIN" ? "👑" : "•"} @{m.friendName}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs font-semibold text-slate-300">{team.ownerName || team.name}</div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div>
            {!isGuest ? (
              <button
                type="button"
                onClick={onNextLot}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl cursor-pointer hover:brightness-105"
              >
                {isLastLot ? "View Final Squad Scorecard →" : "Bring Next Player to Block →"}
              </button>
            ) : (
              <div className="w-full py-3 rounded-xl bg-slate-900 border border-white/15 text-center text-xs font-bold text-slate-300">
                Waiting for Host to bring the next player to the auction block…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
