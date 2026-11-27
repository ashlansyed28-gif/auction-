import { useEffect, useState } from "react";
import type { BroadcastPlayer } from "../types/auction";

interface PlayerPortraitProps {
  player: BroadcastPlayer;
  className?: string;
}

export function PlayerPortrait({ player, className = "w-16 h-20" }: PlayerPortraitProps) {
  const src = player.photoUrl || `/players/${player.slug}.jpg`;
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border-2 border-amber-400/80 bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-950 shadow-lg shrink-0 ${className}`}
    >
      {!hasError ? (
        <img
          src={src}
          alt={player.name}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover object-top block"
          loading="eager"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-700 via-indigo-900 to-rose-800 text-white px-1">
          <span className="text-base font-black leading-none tracking-tight">{player.initials}</span>
          <span className="mt-1 text-[9px] font-extrabold uppercase tracking-wider text-amber-300">
            {player.role.split("-")[0]}
          </span>
        </div>
      )}

      {/* OVR badge pinned cleanly at bottom-right corner without overlapping text */}
      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-950/90 border border-amber-400/60 text-[9px] font-black text-amber-300 tnum leading-none">
        OVR {player.ovr}
      </div>
    </div>
  );
}
