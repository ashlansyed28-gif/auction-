import type { BroadcastPlayer } from "../types/auction";
import { formatLakhsCrores } from "../utils/auctionRules";
import { PlayerPortrait } from "./PlayerPortrait";

interface PlayerRecordsModalProps {
  player: BroadcastPlayer;
  onClose: () => void;
}

export function PlayerRecordsModal({ player, onClose }: PlayerRecordsModalProps) {
  const milestones = player.careerRecords
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${player.name} career records and stats`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-slate-900 border border-amber-400/45 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-gradient-to-r from-slate-950 via-blue-950/60 to-slate-950 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <PlayerPortrait player={player} className="w-16 h-20" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-white truncate">{player.name}</h2>
                <span className="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 text-[10px] font-black text-amber-300 shrink-0">
                  {player.category}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                Lot #{player.lotNumber} • {player.role} • {player.type}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-slate-800 border border-white/15 text-slate-200 font-black hover:bg-slate-700 shrink-0 cursor-pointer"
            aria-label="Close Records & Stats"
          >
            ✕
          </button>
        </div>

        {/* Highlight Records Cards */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-xl bg-slate-950/80 border border-amber-400/35 p-3 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Highest Score</div>
              <div className="text-xl font-black text-amber-300 tnum mt-0.5 truncate">
                {player.highestScore || "—"}
              </div>
            </div>
            <div className="rounded-xl bg-slate-950/80 border border-sky-400/35 p-3 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Best Bowling</div>
              <div className="text-xl font-black text-sky-300 tnum mt-0.5 truncate">
                {player.bestBowling || "—"}
              </div>
            </div>
            <div className="rounded-xl bg-slate-950/80 border border-emerald-400/35 p-3 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Base Price</div>
              <div className="text-sm font-black text-emerald-300 tnum mt-1.5 truncate">
                {formatLakhsCrores(player.basePriceCr)}
              </div>
            </div>
          </div>

          {/* Match Specs Grid */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 min-w-0">
              <span className="block text-[10px] text-slate-400 font-bold">BAT</span>
              <strong className="text-sm text-white truncate block">{player.bat}</strong>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 min-w-0">
              <span className="block text-[10px] text-slate-400 font-bold">BOWL</span>
              <strong className="text-sm text-white truncate block">{player.bowl}</strong>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 min-w-0">
              <span className="block text-[10px] text-slate-400 font-bold">TYPE</span>
              <strong className="text-xs text-white truncate block mt-0.5">{player.type}</strong>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 min-w-0">
              <span className="block text-[10px] text-slate-400 font-bold">OVR</span>
              <strong className="text-sm text-amber-300 tnum block">{player.ovr}</strong>
            </div>
          </div>

          {/* Career Milestones */}
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 mb-2">
              Career Records &amp; Milestones
            </div>
            <ul className="space-y-1.5">
              {milestones.map((m) => (
                <li
                  key={m}
                  className="flex items-start gap-2 text-xs text-slate-100 bg-slate-950/65 border border-white/10 rounded-lg px-3 py-2"
                >
                  <span className="text-amber-400 font-black shrink-0">★</span>
                  <span className="leading-relaxed">{m}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
