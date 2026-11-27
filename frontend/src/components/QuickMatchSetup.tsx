import { useMemo, useState } from "react";
import type {
  BotDifficulty,
  MatchPlayer,
  MatchTeamLineup,
  PitchCondition,
  WicketRule,
} from "../engine/matchEngine";
import { ALL_PLAYERS } from "../data/players";
import { JERSEY_THEMES, generateRoomCode } from "../utils/auctionRules";
import { normalizeRoomCode } from "../utils/realtimeSync";
import { CricketJerseySvg } from "./illustrations/CricketJerseySvg";
import { PlayerPortrait } from "./PlayerPortrait";

export type QuickSubMode = "BOT" | "FRIEND_LOCAL" | "FRIEND_ONLINE";

interface QuickMatchSetupProps {
  initialSubMode: QuickSubMode;
  onlineRoomCode: string | null;
  onlineConnectedNames: string[];
  onlineWaitingStatus: string | null;
  onlineIsHost: boolean;
  onCreateOnlineMatchRoom: (
    code: string,
    lineupA: MatchTeamLineup,
    pitch: PitchCondition,
    wicketRule: WicketRule,
  ) => void;
  onJoinOnlineMatchRoom: (code: string, lineupB: MatchTeamLineup) => void;
  onLaunchOfflineMatch: (opts: {
    subMode: "BOT" | "FRIEND_LOCAL";
    teamA: MatchTeamLineup;
    teamB: MatchTeamLineup;
    pitch: PitchCondition;
    wicketRule: WicketRule;
    botDifficulty: BotDifficulty;
  }) => void;
  onStartOnlinePreGame: () => void;
  onBack: () => void;
}

function autoPick4(seedOffset: number, excludeIds: Set<number>): MatchPlayer[] {
  const available = ALL_PLAYERS.filter((p) => !excludeIds.has(p.id));
  const batters = available.filter((p) => p.role === "Batter" || p.role === "WK-Batter");
  const allRounders = available.filter((p) => p.role === "All-Rounder");
  const bowlers = available.filter((p) => p.role === "Bowler");

  const picks = [
    batters[(seedOffset * 2) % batters.length],
    batters[(seedOffset * 2 + 1) % batters.length],
    allRounders[seedOffset % allRounders.length],
    bowlers[seedOffset % bowlers.length],
  ].filter(Boolean);

  for (const p of picks) excludeIds.add(p.id);
  return picks.map((p) => ({ ...p, paidCr: p.basePriceCr }));
}

export function QuickMatchSetup({
  initialSubMode,
  onlineRoomCode,
  onlineConnectedNames,
  onlineWaitingStatus,
  onlineIsHost,
  onCreateOnlineMatchRoom,
  onJoinOnlineMatchRoom,
  onLaunchOfflineMatch,
  onStartOnlinePreGame,
  onBack,
}: QuickMatchSetupProps) {
  const [subMode, setSubMode] = useState<QuickSubMode>(initialSubMode);
  const [kitAIdx, setKitAIdx] = useState(0);
  const [kitBIdx, setKitBIdx] = useState(1);
  const [pitch, setPitch] = useState<PitchCondition>("Dusty");
  const [wicketRule, setWicketRule] = useState<WicketRule>("LAST_MAN_STANDS");
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("Medium");
  const [joinInput, setJoinInput] = useState("");
  const [draftSeed, setDraftSeed] = useState(0);
  const [pickingSlot, setPickingSlot] = useState<{ side: "A" | "B"; idx: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { defaultA, defaultB } = useMemo(() => {
    const used = new Set<number>();
    const pA = autoPick4(draftSeed, used);
    const pB = autoPick4(draftSeed + 3, used);
    return { defaultA: pA, defaultB: pB };
  }, [draftSeed]);

  const [playersA, setPlayersA] = useState<MatchPlayer[]>(defaultA);
  const [playersB, setPlayersB] = useState<MatchPlayer[]>(defaultB);

  const rerollSquads = () => {
    const nextSeed = draftSeed + 2;
    setDraftSeed(nextSeed);
    const used = new Set<number>();
    setPlayersA(autoPick4(nextSeed, used));
    setPlayersB(autoPick4(nextSeed + 3, used));
  };

  const kitA = JERSEY_THEMES[kitAIdx];
  const kitB = JERSEY_THEMES[kitBIdx === kitAIdx ? (kitAIdx + 1) % JERSEY_THEMES.length : kitBIdx];

  const lineupA: MatchTeamLineup = {
    teamId: `qm-${kitA.id}-a`,
    code: kitA.code,
    name: kitA.franchiseName,
    kit: kitA,
    captainId: playersA[0]?.id ?? 1,
    players: playersA,
  };
  const lineupB: MatchTeamLineup = {
    teamId: `qm-${kitB.id}-b`,
    code: kitB.code,
    name: kitB.franchiseName,
    kit: kitB,
    captainId: playersB[0]?.id ?? 2,
    players: playersB,
  };

  const filteredPool = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return ALL_PLAYERS.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q),
    ).slice(0, 30);
  }, [searchTerm]);

  return (
    <div className="min-h-[100dvh] px-3 sm:px-6 py-4 max-w-6xl mx-auto space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-slate-900/90 border border-white/15">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/15 text-xs font-bold text-slate-200 cursor-pointer"
          >
            ← Back
          </button>
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-sky-300">
              Mode 2 • 4-a-Side, 6-Over Quick Match
            </div>
            <h1 className="text-lg sm:text-2xl font-black text-white">Quick Match Draft</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["BOT", "🤖 vs Bot"],
              ["FRIEND_LOCAL", "👥 Friend (Local)"],
              ["FRIEND_ONLINE", "🌐 Friend (Room Code)"],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSubMode(k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer ${
                subMode === k
                  ? "bg-amber-400 text-slate-950 border-amber-300"
                  : "bg-slate-800 text-slate-300 border-white/10"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </header>

      {/* Match Settings Strip */}
      <section className="rounded-2xl bg-slate-900/90 border border-white/15 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1.5">Stadium Pitch</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(["Green", "Dusty", "Dead"] as const).map((pt) => (
              <button
                key={pt}
                type="button"
                onClick={() => setPitch(pt)}
                className={`py-1.5 rounded-lg font-bold border cursor-pointer ${
                  pitch === pt ? "bg-emerald-400 text-slate-950 border-emerald-300" : "bg-slate-950 text-slate-300 border-white/10"
                }`}
              >
                {pt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1.5">Wicket Rule</div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setWicketRule("LAST_MAN_STANDS")}
              className={`py-1.5 rounded-lg font-bold border cursor-pointer ${
                wicketRule === "LAST_MAN_STANDS"
                  ? "bg-amber-400 text-slate-950 border-amber-300"
                  : "bg-slate-950 text-slate-300 border-white/10"
              }`}
            >
              Last-Man (4 Wkt)
            </button>
            <button
              type="button"
              onClick={() => setWicketRule("THREE_WICKETS_ALL_OUT")}
              className={`py-1.5 rounded-lg font-bold border cursor-pointer ${
                wicketRule === "THREE_WICKETS_ALL_OUT"
                  ? "bg-amber-400 text-slate-950 border-amber-300"
                  : "bg-slate-950 text-slate-300 border-white/10"
              }`}
            >
              3-Wkt All-Out
            </button>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1.5">
            {subMode === "BOT" ? "Bot Difficulty" : "Draft Actions"}
          </div>
          {subMode === "BOT" ? (
            <div className="grid grid-cols-3 gap-1.5">
              {(["Easy", "Medium", "Hard"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setBotDifficulty(d)}
                  className={`py-1.5 rounded-lg font-bold border cursor-pointer ${
                    botDifficulty === d
                      ? "bg-sky-400 text-slate-950 border-sky-300"
                      : "bg-slate-950 text-slate-300 border-white/10"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={rerollSquads}
              className="w-full py-1.5 rounded-lg bg-slate-800 border border-white/15 font-black text-amber-300 cursor-pointer"
            >
              🎲 Auto-Draft New 4-Player Squads
            </button>
          )}
        </div>
      </section>

      {/* Two Squad Draft Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(
          [
            { side: "A" as const, label: subMode === "BOT" ? "Your Squad" : "Player 1 Squad", kit: kitA, kitIdx: kitAIdx, setKitIdx: setKitAIdx, squad: playersA },
            { side: "B" as const, label: subMode === "BOT" ? "Bot Squad" : "Player 2 Squad", kit: kitB, kitIdx: kitBIdx, setKitIdx: setKitBIdx, squad: playersB },
          ]
        ).map((col) => (
          <section
            key={col.side}
            className="rounded-2xl bg-slate-900/90 border border-white/15 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <CricketJerseySvg kit={col.kit} size={40} />
                <div>
                  <div className="text-[10px] font-black uppercase text-amber-300">{col.label}</div>
                  <select
                    value={col.kitIdx}
                    onChange={(e) => col.setKitIdx(Number(e.target.value))}
                    className="mt-0.5 rounded-lg bg-slate-950 border border-white/15 px-2 py-1 text-xs font-black text-white"
                  >
                    {JERSEY_THEMES.map((k, idx) => (
                      <option key={k.id} value={idx}>
                        {k.code} — {k.franchiseName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {subMode === "BOT" && col.side === "A" && (
                <button
                  type="button"
                  onClick={rerollSquads}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/15 text-[11px] font-black text-amber-300 cursor-pointer"
                >
                  🎲 Re-Draft
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {col.squad.map((p, idx) => (
                <div
                  key={`${col.side}_${p.id}_${idx}`}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/75 border border-white/10"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <PlayerPortrait player={p} className="w-8 h-9 rounded shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 tnum">
                        {p.role} • BAT {p.batOvr} • BOWL {p.bowlOvr} • PWR {p.power}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickingSlot({ side: col.side, idx })}
                    className="px-2 py-1 rounded-lg bg-slate-800 border border-white/15 text-[10px] font-bold text-sky-300 shrink-0 cursor-pointer"
                  >
                    Swap
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Online Friend Room Code Panel OR Offline Launch Button */}
      {subMode === "FRIEND_ONLINE" ? (
        <section className="rounded-2xl bg-slate-900/95 border border-emerald-400/40 p-4 space-y-3">
          {!onlineRoomCode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <button
                type="button"
                onClick={() => onCreateOnlineMatchRoom(generateRoomCode(6), lineupA, pitch, wicketRule)}
                className="py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer"
              >
                ⚡ Create Online Match Room →
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = normalizeRoomCode(joinInput);
                  if (clean.length >= 4) onJoinOnlineMatchRoom(clean, lineupB);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  maxLength={6}
                  value={joinInput}
                  onChange={(e) => setJoinInput(normalizeRoomCode(e.target.value))}
                  placeholder="4-6 Char Room Code"
                  className="flex-1 rounded-xl bg-slate-950 border border-white/15 px-3 py-2.5 text-sm font-black tracking-widest uppercase text-amber-300 tnum"
                />
                <button
                  type="submit"
                  disabled={joinInput.length < 4}
                  className="px-4 py-2.5 rounded-xl bg-emerald-400 text-slate-950 font-black text-xs uppercase disabled:opacity-45 cursor-pointer"
                >
                  Join →
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase text-emerald-300">
                  Match Room Code: <span className="text-lg tracking-widest text-amber-300">{onlineRoomCode}</span>
                </div>
                <div className="text-xs text-slate-300">
                  Connected: {onlineConnectedNames.join(" vs ") || "Waiting for opponent…"}
                </div>
                {onlineWaitingStatus && (
                  <div className="text-[11px] text-sky-300 mt-0.5">{onlineWaitingStatus}</div>
                )}
              </div>
              {onlineIsHost && (
                <button
                  type="button"
                  disabled={onlineConnectedNames.length < 2}
                  onClick={onStartOnlinePreGame}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-xs uppercase disabled:opacity-45 cursor-pointer"
                >
                  Start Toss &amp; Match →
                </button>
              )}
            </div>
          )}
        </section>
      ) : (
        <button
          type="button"
          onClick={() =>
            onLaunchOfflineMatch({
              subMode,
              teamA: lineupA,
              teamB: lineupB,
              pitch,
              wicketRule,
              botDifficulty,
            })
          }
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-sm sm:text-base uppercase tracking-wider shadow-xl cursor-pointer"
        >
          Proceed to VS Screen &amp; Coin Toss →
        </button>
      )}

      {/* Player Swap Modal */}
      {pickingSlot && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPickingSlot(null)}
        >
          <div
            className="w-full max-w-lg max-h-[82dvh] flex flex-col rounded-2xl bg-slate-900 border border-amber-400/45 p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-amber-300">
                Swap Player for Team {pickingSlot.side} (#{pickingSlot.idx + 1})
              </span>
              <button
                type="button"
                onClick={() => setPickingSlot(null)}
                className="px-2.5 py-1 rounded bg-slate-800 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search 165 players by name or role..."
              className="w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs text-white"
            />
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredPool.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const mp: MatchPlayer = { ...p, paidCr: p.basePriceCr };
                    if (pickingSlot.side === "A") {
                      setPlayersA((prev) => prev.map((x, i) => (i === pickingSlot.idx ? mp : x)));
                    } else {
                      setPlayersB((prev) => prev.map((x, i) => (i === pickingSlot.idx ? mp : x)));
                    }
                    setPickingSlot(null);
                  }}
                  className="w-full flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950/75 border border-white/10 hover:border-amber-400 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <PlayerPortrait player={p} className="w-8 h-9 rounded shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 tnum">
                        {p.role} • BAT {p.batOvr} • BOWL {p.bowlOvr}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 text-[10px] font-black tnum">
                    OVR {p.ovr}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
