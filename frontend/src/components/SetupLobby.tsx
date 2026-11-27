import { useEffect, useState } from "react";
import type {
  AuthenticatedUser,
  ChallengeConfig,
  JerseyKitId,
} from "../types/auction";
import { DEFAULT_TEAM_NAMES, JERSEY_THEMES } from "../utils/auctionRules";
import { normalizeRoomCode } from "../utils/realtimeSync";
import { voiceEngine } from "../utils/voiceEngine";
import { CricketJerseySvg } from "./illustrations/CricketJerseySvg";

export type LobbyTab = "LOCAL" | "CREATE" | "JOIN";

interface SetupLobbyProps {
  currentUser: AuthenticatedUser | null;
  initialConfig: ChallengeConfig;
  initialJoinCode?: string;
  activeTab: LobbyTab;
  transportMode: "supabase" | "local";
  selectedKitId: JerseyKitId | null;
  joinStatus: string | null;
  onChangeTab: (tab: LobbyTab) => void;
  onSelectKit: (kitId: JerseyKitId | null) => void;
  onJoinRoom: (code: string, kitId: JerseyKitId | null) => void;
  onConfigChange: (config: ChallengeConfig) => void;
  onStartLocal: (config: ChallengeConfig) => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

const PURSE_PRESETS = [60, 80, 100, 120];

export function SetupLobby({
  currentUser,
  initialConfig,
  initialJoinCode = "",
  activeTab,
  transportMode,
  selectedKitId,
  joinStatus,
  onChangeTab,
  onSelectKit,
  onJoinRoom,
  onConfigChange,
  onStartLocal,
  onOpenAuth,
  onSignOut,
}: SetupLobbyProps) {
  const [config, setConfig] = useState<ChallengeConfig>(initialConfig);
  const [joinCodeInput, setJoinCodeInput] = useState(() => normalizeRoomCode(initialJoinCode));

  useEffect(() => {
    if (initialJoinCode) {
      setJoinCodeInput(normalizeRoomCode(initialJoinCode));
    }
  }, [initialJoinCode]);

  const syncConfig = (next: ChallengeConfig) => {
    setConfig(next);
    onConfigChange(next);
  };

  const safeTeamNames = Array.isArray(config.teamNames) ? config.teamNames : DEFAULT_TEAM_NAMES;

  const updateTeamName = (idx: number, val: string) => {
    const next = [...safeTeamNames];
    next[idx] = val;
    syncConfig({ ...config, teamNames: next });
  };

  const handleSubmitLocal = (e: React.FormEvent) => {
    e.preventDefault();
    voiceEngine.unlock();
    const cleanedNames = safeTeamNames.map((n, i) => n.trim() || DEFAULT_TEAM_NAMES[i]);
    onStartLocal({ ...config, teamNames: cleanedNames });
  };

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 py-6 max-w-5xl mx-auto">
      <header className="text-center mb-5">
        {/* Top Auth Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-3.5 py-2 rounded-2xl bg-slate-900/85 border border-white/10">
          {currentUser ? (
            <>
              <div className="flex items-center gap-2 text-left">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-black text-white">@{currentUser.username}</span>
                <span className="text-[11px] text-slate-400">({currentUser.emailMasked})</span>
                <span
                  className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${
                    currentUser.provider === "guest"
                      ? "bg-amber-400/15 border-amber-400/35 text-amber-300"
                      : "bg-emerald-500/15 border-emerald-400/35 text-emerald-300"
                  }`}
                >
                  {currentUser.provider === "guest" ? "⚡ Guest Mode" : "🔒 Verified Email"}
                </span>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="px-3 py-1 rounded-lg bg-slate-800 border border-white/10 text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                {currentUser.provider === "guest" ? "Switch Player / Login" : "Sign Out"}
              </button>
            </>
          ) : (
            <>
              <span className="text-xs font-semibold text-slate-300">
                Offline Pass &amp; Play Mode (Enter as Guest or Email for Rooms)
              </span>
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
              >
                Guest / Login →
              </button>
            </>
          )}
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/35 text-amber-300 text-xs font-extrabold tracking-widest uppercase mb-2.5">
          🏏 Live T20 Squad Auction • Squad Vote &amp; Captain Lock
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          CRICKET <span className="text-amber-400">BID WARS</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-2xl mx-auto">
          Form 2–4 member squads, vote live on players, let your Captain seal the deal, and build the ultimate XI.
        </p>

        {/* Mode Switcher Tabs */}
        <div className="mt-4 inline-grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-white/10">
          {(
            [
              ["CREATE", "Create Custom Room"],
              ["JOIN", "Join Room Code"],
              ["LOCAL", "Pass & Play"],
            ] as const
          ).map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => onChangeTab(tabKey)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === tabKey
                  ? "bg-amber-400 text-slate-950 shadow-md"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* JOIN ROOM CODE PANEL */}
      {activeTab === "JOIN" ? (
        <div className="flex-1 max-w-2xl w-full mx-auto space-y-4">
          <section className="rounded-2xl bg-slate-900/85 border border-white/10 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-300">
                Enter Custom Room Code
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 border border-white/10 text-slate-300">
                {transportMode === "supabase" ? "Supabase Realtime" : "Local Channel Sync"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  6-Character Room ID
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(normalizeRoomCode(e.target.value))}
                  placeholder="e.g. HT8K4M"
                  className="w-full rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2.5 text-base font-black tracking-[0.25em] uppercase text-amber-300 tnum focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Player Username
                </label>
                <div className="w-full rounded-xl bg-slate-950/75 border border-emerald-400/35 px-3.5 py-2.5 text-sm font-black text-emerald-300 flex items-center justify-between">
                  <span>@{currentUser?.username || "Guest"}</span>
                  <span className="text-[10px] text-slate-400">
                    {currentUser?.provider === "guest" ? "⚡ Guest" : "🔒 Verified"}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Pick Initial Team (You can switch seats inside the Room)
                </span>
                <button
                  type="button"
                  onClick={() => onSelectKit(null)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                    selectedKitId === null
                      ? "bg-amber-400 text-slate-950 border-amber-300"
                      : "bg-slate-950 text-slate-300 border-white/15"
                  }`}
                >
                  👁 Join Observe (Pick Later)
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {JERSEY_THEMES.map((kit) => {
                  const selected = selectedKitId === kit.id;
                  return (
                    <button
                      key={kit.id}
                      type="button"
                      onClick={() => onSelectKit(kit.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        selected
                          ? "bg-amber-400/15 border-amber-400 shadow-lg shadow-amber-400/10"
                          : "bg-slate-950/70 border-white/10 hover:border-white/25"
                      }`}
                    >
                      <CricketJerseySvg kit={kit} size={40} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-white truncate">{kit.franchiseName}</div>
                        <div className="text-[10px] font-bold" style={{ color: kit.accent }}>
                          {kit.code} • {kit.label}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {joinStatus && (
              <div className="rounded-xl bg-slate-950/80 border border-sky-400/35 px-3.5 py-2.5 text-xs font-semibold text-sky-200">
                {joinStatus}
              </div>
            )}

            <button
              type="button"
              disabled={joinCodeInput.length !== 6}
              onClick={() => {
                voiceEngine.unlock();
                onJoinRoom(joinCodeInput, selectedKitId);
              }}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-sm uppercase tracking-wider disabled:opacity-45 cursor-pointer"
            >
              Enter Custom Room →
            </button>
          </section>
        </div>
      ) : (
        /* PASS & PLAY SETUP */
        <form onSubmit={handleSubmitLocal} className="space-y-4 flex-1">
          <section className="rounded-2xl bg-slate-900/80 border border-white/10 p-5 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-300">
                  1. Franchises ({config.teamCount} Teams)
                </h2>
                <p className="text-xs text-slate-400">
                  CSK, MBI, RCB, KRC, DDC, SRH, RRG, PBK, GPT &amp; LSG.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {([2, 3, 4, 6, 10] as const).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => syncConfig({ ...config, teamCount: cnt })}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                      config.teamCount === cnt
                        ? "bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/20"
                        : "bg-slate-800/80 text-slate-200 border-white/10 hover:border-white/25"
                    }`}
                  >
                    {cnt} Teams
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {JERSEY_THEMES.slice(0, config.teamCount).map((kit, idx) => (
                <div
                  key={kit.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/70 border border-white/10"
                >
                  <CricketJerseySvg kit={kit} size={56} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: kit.accent }}>
                      {kit.label} Kit ({kit.code})
                    </div>
                    <input
                      type="text"
                      maxLength={26}
                      value={safeTeamNames[idx] ?? kit.franchiseName}
                      onChange={(e) => updateTeamName(idx, e.target.value)}
                      placeholder={DEFAULT_TEAM_NAMES[idx] ?? kit.franchiseName}
                      className="mt-1 w-full rounded-lg bg-slate-900 border border-white/15 px-2.5 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="rounded-2xl bg-slate-900/80 border border-white/10 p-5">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-300 mb-3">
                2. Franchise Purse (Default ₹80 Cr)
              </h2>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {PURSE_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => syncConfig({ ...config, purseCr: p })}
                    className={`py-2.5 rounded-xl text-xs font-extrabold tnum border transition cursor-pointer ${
                      config.purseCr === p
                        ? "bg-amber-400 text-slate-950 border-amber-300"
                        : "bg-slate-800/80 text-slate-200 border-white/10 hover:border-white/25"
                    }`}
                  >
                    ₹{p} Cr
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between bg-slate-950/70 rounded-xl px-3 py-2 border border-white/10">
                <span className="text-xs font-semibold text-slate-300">Custom Purse</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => syncConfig({ ...config, purseCr: Math.max(30, config.purseCr - 5) })}
                    className="w-8 h-8 rounded-lg bg-slate-800 text-white font-black hover:bg-slate-700 cursor-pointer"
                  >
                    −
                  </button>
                  <span className="tnum font-black text-amber-300 text-sm min-w-[68px] text-center">
                    ₹{config.purseCr} Cr
                  </span>
                  <button
                    type="button"
                    onClick={() => syncConfig({ ...config, purseCr: Math.min(200, config.purseCr + 5) })}
                    className="w-8 h-8 rounded-lg bg-slate-800 text-white font-black hover:bg-slate-700 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-slate-900/80 border border-white/10 p-5 space-y-2.5">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-300 mb-1">
                3. Squad Limits &amp; Player Deck
              </h2>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Min / Max Squad Size</span>
                <div className="flex items-center gap-1.5 tnum">
                  <button
                    type="button"
                    onClick={() => syncConfig({ ...config, minSquadSize: Math.max(3, config.minSquadSize - 1) })}
                    className="w-7 h-7 rounded-lg bg-slate-800 font-bold cursor-pointer"
                  >
                    −
                  </button>
                  <span className="font-bold text-white px-1.5">{config.minSquadSize}</span>
                  <button
                    type="button"
                    onClick={() =>
                      syncConfig({ ...config, minSquadSize: Math.min(config.maxSquadSize, config.minSquadSize + 1) })
                    }
                    className="w-7 h-7 rounded-lg bg-slate-800 font-bold cursor-pointer"
                  >
                    +
                  </button>
                  <span className="text-slate-500">/</span>
                  <button
                    type="button"
                    onClick={() =>
                      syncConfig({ ...config, maxSquadSize: Math.max(config.minSquadSize, config.maxSquadSize - 1) })
                    }
                    className="w-7 h-7 rounded-lg bg-slate-800 font-bold cursor-pointer"
                  >
                    −
                  </button>
                  <span className="font-bold text-amber-300 px-1.5">{config.maxSquadSize}</span>
                  <button
                    type="button"
                    onClick={() => syncConfig({ ...config, maxSquadSize: Math.min(18, config.maxSquadSize + 1) })}
                    className="w-7 h-7 rounded-lg bg-slate-800 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Max Overseas per Squad</span>
                <div className="flex items-center gap-2 tnum">
                  <button
                    type="button"
                    onClick={() => syncConfig({ ...config, maxOverseas: Math.max(1, config.maxOverseas - 1) })}
                    className="w-7 h-7 rounded-lg bg-slate-800 font-bold cursor-pointer"
                  >
                    −
                  </button>
                  <span className="font-bold text-white min-w-[20px] text-center">{config.maxOverseas}</span>
                  <button
                    type="button"
                    onClick={() => syncConfig({ ...config, maxOverseas: Math.min(8, config.maxOverseas + 1) })}
                    className="w-7 h-7 rounded-lg bg-slate-800 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => syncConfig({ ...config, poolMode: "CURATED_24" })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                    config.poolMode === "CURATED_24"
                      ? "bg-blue-600/30 border-blue-400 text-blue-200"
                      : "bg-slate-800/70 border-white/10 text-slate-300"
                  }`}
                >
                  Quick 24 Stars
                </button>
                <button
                  type="button"
                  onClick={() => syncConfig({ ...config, poolMode: "FULL_165" })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                    config.poolMode === "FULL_165"
                      ? "bg-blue-600/30 border-blue-400 text-blue-200"
                      : "bg-slate-800/70 border-white/10 text-slate-300"
                  }`}
                >
                  Full 165-Player Pool
                </button>
              </div>
            </section>
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-base tracking-wider uppercase shadow-xl shadow-amber-400/25 hover:brightness-105 active:scale-[0.99] transition cursor-pointer"
          >
            Launch Pass &amp; Play Stage →
          </button>
        </form>
      )}

      <footer className="text-center text-[11px] text-slate-500 mt-5">
        Free-to-play entertainment only • Zero real-money entry fees, wallets, or gambling mechanics.
      </footer>
    </div>
  );
}
