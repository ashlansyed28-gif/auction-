import { useState } from "react";
import type { AuthenticatedUser, ThemeMode } from "../types/auction";
import { normalizeRoomCode } from "../utils/realtimeSync";
import { FullscreenLandscapeButton } from "./LandscapeGuard";

interface HomeModeHubProps {
  currentUser: AuthenticatedUser;
  theme: ThemeMode;
  hasSavedTournament: boolean;
  hasSavedAuctionSquads: boolean;
  onToggleTheme: () => void;
  onCreateAuctionRoom: () => void;
  onJoinAuctionRoom: (code: string) => void;
  onPassAndPlayAuction: () => void;
  onResumeTournament: () => void;
  onOpenLineupHubFromSaved: () => void;
  onOpenQuickMatch: (subMode: "BOT" | "FRIEND_LOCAL" | "FRIEND_ONLINE") => void;
  onSignOut: () => void;
}

export function HomeModeHub({
  currentUser,
  theme,
  hasSavedTournament,
  hasSavedAuctionSquads,
  onToggleTheme,
  onCreateAuctionRoom,
  onJoinAuctionRoom,
  onPassAndPlayAuction,
  onResumeTournament,
  onOpenLineupHubFromSaved,
  onOpenQuickMatch,
  onSignOut,
}: HomeModeHubProps) {
  const [joinCode, setJoinCode] = useState("");

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between px-3 sm:px-6 py-4 max-w-6xl mx-auto">
      {/* Top User & Utility Bar */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-900/90 border border-white/15 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-rose-600 flex items-center justify-center font-black text-slate-950 text-xs shrink-0">
            {currentUser.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-black text-white truncate">@{currentUser.username}</span>
              <span
                className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${
                  currentUser.provider === "guest"
                    ? "bg-amber-400/15 border-amber-400/35 text-amber-300"
                    : "bg-emerald-500/15 border-emerald-400/35 text-emerald-300"
                }`}
              >
                {currentUser.provider === "guest" ? "⚡ Guest" : "🔒 Verified"}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">Cricket Bid Wars • 165-Player T20 Edition</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <FullscreenLandscapeButton />
          <button
            type="button"
            onClick={onToggleTheme}
            className="px-2.5 py-1 rounded-lg bg-slate-800 border border-white/15 text-[11px] font-bold text-slate-200 cursor-pointer"
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/15 text-[11px] font-bold text-slate-300 cursor-pointer"
          >
            {currentUser.provider === "guest" ? "Switch" : "Sign Out"}
          </button>
        </div>
      </header>

      {/* Main Title & Resume Strip */}
      <main className="my-4 space-y-5 flex-1 flex flex-col justify-center">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/35 text-amber-300 text-[11px] font-black uppercase tracking-widest">
            🏏 4-a-Side 6-Over Broadcast Cricket + Live Squad Auction
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            CRICKET <span className="text-amber-400">BID WARS</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
            Draft superstar squads in a live custom war room or jump straight onto the broadcast pitch in 6-over arcade action.
          </p>
        </div>

        {(hasSavedTournament || hasSavedAuctionSquads) && (
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {hasSavedTournament && (
              <button
                type="button"
                onClick={onResumeTournament}
                className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-black uppercase tracking-wider cursor-pointer hover:bg-emerald-500/30"
              >
                ▶ Resume Saved Tournament
              </button>
            )}
            {hasSavedAuctionSquads && (
              <button
                type="button"
                onClick={onOpenLineupHubFromSaved}
                className="px-4 py-2 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-300 text-xs font-black uppercase tracking-wider cursor-pointer hover:bg-sky-500/30"
              >
                📋 Open Last Auction Lineups
              </button>
            )}
          </div>
        )}

        {/* Two Top-Level Modes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          {/* MODE 1: AUCTION & PLAY */}
          <section className="rounded-3xl bg-slate-900/90 border border-amber-400/40 p-5 shadow-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-widest">
                  Mode 1 • Full Loop
                </span>
                <span className="text-[11px] font-bold text-amber-300">Auction → Lineups → Trophy</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Auction &amp; Play Tournament</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Host or join a 2–4 member-per-team custom auction room (4+ players/squad), set batting orders &amp; captains in the Squad Hub, then battle through a Round-Robin + Playoffs tournament!
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onCreateAuctionRoom}
                  className="py-3 px-3 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
                >
                  ⚡ Create Room
                </button>
                <button
                  type="button"
                  onClick={onPassAndPlayAuction}
                  className="py-3 px-3 rounded-xl bg-slate-800 border border-white/15 text-slate-100 font-black text-xs uppercase tracking-wider cursor-pointer hover:bg-slate-700"
                >
                  Pass &amp; Play
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = normalizeRoomCode(joinCode);
                  if (clean.length >= 4) onJoinAuctionRoom(clean);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
                  placeholder="Enter 6-Char Room Code"
                  className="flex-1 min-w-0 rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs font-black tracking-widest uppercase text-amber-300 focus:outline-none focus:border-amber-400 tnum"
                />
                <button
                  type="submit"
                  disabled={joinCode.length < 4}
                  className="px-4 py-2 rounded-xl bg-sky-400 text-slate-950 font-black text-xs uppercase disabled:opacity-40 cursor-pointer shrink-0"
                >
                  Join →
                </button>
              </form>
            </div>
          </section>

          {/* MODE 2: QUICK MATCH */}
          <section className="rounded-3xl bg-slate-900/90 border border-sky-400/40 p-5 shadow-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-sky-400 text-slate-950 text-[10px] font-black uppercase tracking-widest">
                  Mode 2 • Instant 6-Over
                </span>
                <span className="text-[11px] font-bold text-sky-300">WCC3 Broadcast Pitch</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Quick Match (4-a-Side)</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Skip the auction and jump straight into a 6-over showdown! Auto-draft or pick 4 stars from 165 players, flip the coin, aim yorkers on the pitch grid, and time lofts to the stands.
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onOpenQuickMatch("BOT")}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer shadow-lg"
              >
                🤖 Play vs. Bot (Easy / Med / Hard) →
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenQuickMatch("FRIEND_LOCAL")}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 border border-white/15 text-slate-100 font-black text-xs uppercase cursor-pointer hover:bg-slate-700"
                >
                  👥 Friend (Pass &amp; Play)
                </button>
                <button
                  type="button"
                  onClick={() => onOpenQuickMatch("FRIEND_ONLINE")}
                  className="py-2.5 px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/45 text-emerald-300 font-black text-xs uppercase cursor-pointer hover:bg-emerald-500/30"
                >
                  🌐 Friend (Room Code)
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="text-center text-[11px] text-slate-500">
        Free-to-play arcade cricket &amp; squad auction • State saves automatically in browser storage.
      </footer>
    </div>
  );
}
