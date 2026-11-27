import { useState } from "react";
import type { MatchTeamLineup, PitchCondition, WicketRule } from "../../engine/matchEngine";
import { CricketJerseySvg } from "../illustrations/CricketJerseySvg";

interface MatchPreGameProps {
  teamA: MatchTeamLineup;
  teamB: MatchTeamLineup;
  pitch: PitchCondition;
  wicketRule: WicketRule;
  fixtureLabel?: string;
  isTeamABot?: boolean;
  isTeamBBot?: boolean;
  isOnlineGuest?: boolean;
  onStartMatch: (tossWinnerId: string, tossDecision: "BAT" | "BOWL") => void;
  onBack: () => void;
}

const PITCH_INFO: Record<PitchCondition, string> = {
  Green: "Extra seam & swing • Fast bowlers thrive",
  Dusty: "Grip & turn • Spinners & Yorkers shine",
  Dead: "True bounce • Batter's paradise",
};

export function MatchPreGame({
  teamA,
  teamB,
  pitch,
  wicketRule,
  fixtureLabel = "4-a-Side • 6 Overs",
  isTeamABot = false,
  isTeamBBot = false,
  isOnlineGuest = false,
  onStartMatch,
  onBack,
}: MatchPreGameProps) {
  const [coinCall, setCoinCall] = useState<"HEADS" | "TAILS">("HEADS");
  const [flipping, setFlipping] = useState(false);
  const [tossResult, setTossResult] = useState<{
    face: "HEADS" | "TAILS";
    winnerId: string;
    winnerName: string;
  } | null>(null);
  const [decision, setDecision] = useState<"BAT" | "BOWL">("BAT");

  const handleFlipCoin = () => {
    if (flipping || isOnlineGuest) return;
    setFlipping(true);
    setTimeout(() => {
      const face: "HEADS" | "TAILS" = Math.random() < 0.5 ? "HEADS" : "TAILS";
      const teamAWon = face === coinCall;
      const winner = teamAWon ? teamA : teamB;
      const autoDec: "BAT" | "BOWL" =
        pitch === "Green" && Math.random() < 0.65 ? "BOWL" : "BAT";
      setDecision(autoDec);
      setTossResult({ face, winnerId: winner.teamId, winnerName: winner.name });
      setFlipping(false);
    }, 950);
  };

  const winnerIsBot =
    tossResult &&
    ((tossResult.winnerId === teamA.teamId && isTeamABot) ||
      (tossResult.winnerId === teamB.teamId && isTeamBBot));

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between p-3 sm:p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-xs font-bold text-slate-200 cursor-pointer"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[11px] font-black text-emerald-300">
            Pitch: {pitch}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-[11px] font-black text-amber-300">
            {wicketRule === "LAST_MAN_STANDS" ? "Last-Man-Stands" : "3-Wkt All-Out"}
          </span>
        </div>
      </header>

      <main className="my-4 space-y-5">
        {/* Split-Panel Broadcast VS Card */}
        <section className="rounded-3xl bg-slate-950/90 border border-amber-400/35 shadow-2xl overflow-hidden">
          <div className="px-4 py-2 bg-slate-900/90 border-b border-white/10 text-center text-[11px] font-black uppercase tracking-[0.25em] text-amber-300">
            {fixtureLabel} • {PITCH_INFO[pitch]}
          </div>

          <div className="p-5 sm:p-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
            {/* Team A */}
            <div className="flex flex-col items-center text-center space-y-2">
              <CricketJerseySvg kit={teamA.kit} size={78} />
              <div
                className="px-2.5 py-0.5 rounded-md text-xs font-black tracking-wider"
                style={{ backgroundColor: teamA.kit.secondary, color: teamA.kit.accent }}
              >
                {teamA.code}
              </div>
              <div className="text-sm sm:text-lg font-black text-white leading-tight">{teamA.name}</div>
              <div className="text-[10px] text-slate-400 line-clamp-2">
                {teamA.players.map((p) => p.name.split(" ").slice(-1)[0]).join(" • ")}
              </div>
            </div>

            {/* VS Emblem */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-rose-500 flex items-center justify-center font-black text-slate-950 text-lg sm:text-xl shadow-xl rotate-3">
                VS
              </div>
            </div>

            {/* Team B */}
            <div className="flex flex-col items-center text-center space-y-2">
              <CricketJerseySvg kit={teamB.kit} size={78} />
              <div
                className="px-2.5 py-0.5 rounded-md text-xs font-black tracking-wider"
                style={{ backgroundColor: teamB.kit.secondary, color: teamB.kit.accent }}
              >
                {teamB.code}
              </div>
              <div className="text-sm sm:text-lg font-black text-white leading-tight">{teamB.name}</div>
              <div className="text-[10px] text-slate-400 line-clamp-2">
                {teamB.players.map((p) => p.name.split(" ").slice(-1)[0]).join(" • ")}
              </div>
            </div>
          </div>
        </section>

        {/* Coin Toss Panel */}
        <section className="rounded-2xl bg-slate-900/90 border border-white/15 p-5 text-center space-y-4">
          {isOnlineGuest ? (
            <div className="text-sm font-bold text-amber-300 py-4">
              Waiting for Room Host to complete the Coin Toss…
            </div>
          ) : !tossResult ? (
            <>
              <div className="text-xs font-black uppercase tracking-widest text-amber-300">
                Match Coin Toss ({teamA.code} Calls)
              </div>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setCoinCall("HEADS")}
                  className={`px-4 py-2 rounded-xl text-xs font-black border cursor-pointer ${
                    coinCall === "HEADS"
                      ? "bg-amber-400 text-slate-950 border-amber-300"
                      : "bg-slate-950 text-slate-300 border-white/15"
                  }`}
                >
                  HEADS
                </button>
                <div
                  className={`w-16 h-16 rounded-full border-4 border-amber-300 bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 flex items-center justify-center font-black text-slate-950 text-sm shadow-xl transition-transform duration-700 ${
                    flipping ? "animate-spin scale-110" : ""
                  }`}
                >
                  {flipping ? "★" : coinCall === "HEADS" ? "H" : "T"}
                </div>
                <button
                  type="button"
                  onClick={() => setCoinCall("TAILS")}
                  className={`px-4 py-2 rounded-xl text-xs font-black border cursor-pointer ${
                    coinCall === "TAILS"
                      ? "bg-amber-400 text-slate-950 border-amber-300"
                      : "bg-slate-950 text-slate-300 border-white/15"
                  }`}
                >
                  TAILS
                </button>
              </div>
              <button
                type="button"
                disabled={flipping}
                onClick={handleFlipCoin}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer shadow-lg disabled:opacity-50"
              >
                {flipping ? "Coin in the Air..." : "🪙 Spin Coin Toss"}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-xs font-black text-emerald-300">
                🪙 {tossResult.face}! {tossResult.winnerName} won the toss
              </div>

              {!winnerIsBot ? (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300">Choose what to do first:</div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setDecision("BAT")}
                      className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase border cursor-pointer ${
                        decision === "BAT"
                          ? "bg-amber-400 text-slate-950 border-amber-300 shadow"
                          : "bg-slate-950 text-slate-300 border-white/15"
                      }`}
                    >
                      🏏 Bat First
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision("BOWL")}
                      className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase border cursor-pointer ${
                        decision === "BOWL"
                          ? "bg-amber-400 text-slate-950 border-amber-300 shadow"
                          : "bg-slate-950 text-slate-300 border-white/15"
                      }`}
                    >
                      ⚾ Bowl First
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm font-black text-amber-300">
                  Bot elected to {decision} first!
                </div>
              )}

              <button
                type="button"
                onClick={() => onStartMatch(tossResult.winnerId, decision)}
                className="w-full sm:w-auto px-10 py-3.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-sm uppercase tracking-wider cursor-pointer shadow-xl"
              >
                Take the Field →
              </button>
            </div>
          )}
        </section>
      </main>

      <div className="text-center text-[11px] text-slate-500">
        4 players per side • Max 2 overs per bowler • Overs 1–2 Powerplay
      </div>
    </div>
  );
}
