import { useState } from "react";
import type { ChallengeConfig, ConnectedMember, JerseyKitId } from "../types/auction";
import { DEFAULT_TEAM_NAMES, JERSEY_THEMES } from "../utils/auctionRules";
import { normalizeRoomCode } from "../utils/realtimeSync";
import { voiceEngine } from "../utils/voiceEngine";
import { CricketJerseySvg } from "./illustrations/CricketJerseySvg";

export type LobbyTab = "LOCAL" | "CREATE" | "JOIN";

interface SetupLobbyProps {
  initialConfig: ChallengeConfig;
  activeTab: LobbyTab;
  roomCode: string;
  transportMode: "supabase" | "local";
  friendName: string;
  selectedKitId: JerseyKitId;
  connectedMembers: ConnectedMember[];
  joinStatus: string | null;
  isJoinedWaiting: boolean;
  onChangeTab: (tab: LobbyTab) => void;
  onFriendNameChange: (name: string) => void;
  onSelectKit: (kitId: JerseyKitId) => void;
  onRegenerateCode: () => void;
  onJoinRoom: (code: string, friendName: string, kitId: JerseyKitId) => void;
  onLeaveRoom: () => void;
  onConfigChange: (config: ChallengeConfig) => void;
  onStartLocal: (config: ChallengeConfig) => void;
  onStartHostedRoom: (config: ChallengeConfig) => void;
}

const PURSE_PRESETS = [60, 80, 100, 120];

export function SetupLobby({
  initialConfig,
  activeTab,
  roomCode,
  transportMode,
  friendName,
  selectedKitId,
  connectedMembers,
  joinStatus,
  isJoinedWaiting,
  onChangeTab,
  onFriendNameChange,
  onSelectKit,
  onRegenerateCode,
  onJoinRoom,
  onLeaveRoom,
  onConfigChange,
  onStartLocal,
  onStartHostedRoom,
}: SetupLobbyProps) {
  const [config, setConfig] = useState<ChallengeConfig>(initialConfig);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [copied, setCopied] = useState(false);

  const syncConfig = (next: ChallengeConfig) => {
    setConfig(next);
    onConfigChange(next);
  };

  const safeMembers = Array.isArray(connectedMembers) ? connectedMembers : [];
  const safeTeamNames = Array.isArray(config.teamNames) ? config.teamNames : DEFAULT_TEAM_NAMES;

  const updateTeamName = (idx: number, val: string) => {
    const next = [...safeTeamNames];
    next[idx] = val;
    syncConfig({ ...config, teamNames: next });
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    voiceEngine.unlock();
    const cleanedNames = safeTeamNames.map((n, i) => n.trim() || DEFAULT_TEAM_NAMES[i]);
    const finalCfg = { ...config, teamNames: cleanedNames };
    if (activeTab === "CREATE") {
      onStartHostedRoom(finalCfg);
    } else if (activeTab === "LOCAL") {
      onStartLocal(finalCfg);
    }
  };

  const takenKitIds = new Set(safeMembers.map((m) => m.kitId));

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 py-6 max-w-5xl mx-auto">
      <header className="text-center mb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/35 text-amber-300 text-xs font-extrabold tracking-widest uppercase mb-2.5">
          T20 Friend Challenge • Room &amp; Pass-and-Play
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          HAMMER TIME <span className="text-amber-400">T20 AUCTION</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-xl mx-auto">
          Create a live room with a 6-character code, join a friend&apos;s franchise jersey, or play pass-and-play on one screen.
        </p>

        {/* Mode Switcher Tabs */}
        <div className="mt-4 inline-grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-white/10">
          {(
            [
              ["LOCAL", "Pass & Play"],
              ["CREATE", "Create Room"],
              ["JOIN", "Join Room"],
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

      {/* JOIN ROOM FLOW */}
      {activeTab === "JOIN" ? (
        <div className="flex-1 max-w-2xl w-full mx-auto space-y-4">
          <section className="rounded-2xl bg-slate-900/85 border border-white/10 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-300">
                Join Friend&apos;s Auction Room
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 border border-white/10 text-slate-300">
                {transportMode === "supabase" ? "Supabase Realtime" : "Local Channel Sync"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  6-Character Room Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(normalizeRoomCode(e.target.value))}
                  placeholder="e.g. HT8K4M"
                  disabled={isJoinedWaiting}
                  className="w-full rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2.5 text-base font-black tracking-[0.25em] uppercase text-amber-300 tnum focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Your Friend Name
                </label>
                <input
                  type="text"
                  maxLength={22}
                  value={friendName}
                  onChange={(e) => onFriendNameChange(e.target.value)}
                  placeholder="Enter your name"
                  disabled={isJoinedWaiting}
                  className="w-full rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Pick Franchise Jersey
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {JERSEY_THEMES.map((kit) => {
                  const selected = selectedKitId === kit.id;
                  const takenBy = connectedMembers.find((m) => m.kitId === kit.id);
                  return (
                    <button
                      key={kit.id}
                      type="button"
                      disabled={isJoinedWaiting}
                      onClick={() => onSelectKit(kit.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition cursor-pointer ${
                        selected
                          ? "bg-amber-400/15 border-amber-400 shadow-lg shadow-amber-400/10"
                          : "bg-slate-950/70 border-white/10 hover:border-white/25"
                      }`}
                    >
                      <CricketJerseySvg kit={kit} size={48} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-white">{kit.franchiseName}</div>
                        <div className="text-[11px] font-bold" style={{ color: kit.accent }}>
                          {kit.label} ({kit.code})
                        </div>
                        {takenBy && (
                          <div className="text-[10px] text-emerald-300 font-semibold mt-0.5">
                            Claimed by {takenBy.friendName}
                          </div>
                        )}
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

            {isJoinedWaiting ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-slate-950/75 border border-emerald-400/35 p-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 mb-2">
                    Connected Teams in Room {normalizeRoomCode(joinCodeInput)} ({connectedMembers.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {connectedMembers.map((m) => {
                      const kit = JERSEY_THEMES.find((k) => k.id === m.kitId) || JERSEY_THEMES[0];
                      return (
                        <span
                          key={m.clientId}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/15 text-xs font-bold"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span style={{ color: kit.accent }}>{kit.code}</span>
                          <span className="text-white">{m.friendName}</span>
                          {m.isHost && <span className="text-[10px] text-amber-300">(Host)</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLeaveRoom}
                  className="w-full py-3 rounded-xl bg-slate-800 border border-white/15 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Leave Room
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={joinCodeInput.length !== 6}
                onClick={() => {
                  voiceEngine.unlock();
                  onJoinRoom(joinCodeInput, friendName.trim() || "Friend", selectedKitId);
                }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-sm uppercase tracking-wider disabled:opacity-45 cursor-pointer"
              >
                Join Room →
              </button>
            )}
          </section>
        </div>
      ) : (
        /* PASS & PLAY or CREATE ROOM */
        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          {activeTab === "CREATE" && (
            <section className="rounded-2xl bg-slate-900/90 border border-amber-400/40 p-5 shadow-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Live Room Code
                  </div>
                  <div className="flex items-center gap-2.5 mt-1">
                    <span className="text-2xl sm:text-3xl font-black tracking-[0.22em] text-white tnum bg-slate-950 px-4 py-1.5 rounded-xl border border-amber-400/40">
                      {roomCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="px-3.5 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                    >
                      {copied ? "✓ Copied" : "Copy Code"}
                    </button>
                    <button
                      type="button"
                      onClick={onRegenerateCode}
                      className="px-3 py-2 rounded-xl bg-slate-800 border border-white/15 text-xs font-bold text-slate-200 cursor-pointer"
                    >
                      ↻ New
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300">
                    {transportMode === "supabase" ? "● Supabase Realtime" : "● Local Channel Sync"}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Share code with friends to join in another tab or device
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Host Friend Name
                  </label>
                  <input
                    type="text"
                    maxLength={22}
                    value={friendName}
                    onChange={(e) => onFriendNameChange(e.target.value)}
                    placeholder="Host Name"
                    className="w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Host Franchise Jersey
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {JERSEY_THEMES.slice(0, config.teamCount).map((kit) => (
                      <button
                        key={kit.id}
                        type="button"
                        onClick={() => onSelectKit(kit.id)}
                        className={`py-1.5 px-2.5 rounded-xl border text-[11px] font-black cursor-pointer ${
                          selectedKitId === kit.id
                            ? "border-amber-400 bg-amber-400/20 text-amber-300"
                            : "border-white/10 bg-slate-950 text-slate-300"
                        }`}
                      >
                        {kit.code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Connected Teams */}
              <div className="rounded-xl bg-slate-950/75 border border-white/10 p-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 mb-2">
                  Connected Teams ({connectedMembers.length} / {config.teamCount})
                </div>
                <div className="flex flex-wrap gap-2">
                  {connectedMembers.map((m) => {
                    const kit = JERSEY_THEMES.find((k) => k.id === m.kitId) || JERSEY_THEMES[0];
                    return (
                      <span
                        key={m.clientId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/15 text-xs font-bold"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span style={{ color: kit.accent }}>{kit.franchiseName}</span>
                        <span className="text-slate-300">• {m.friendName}</span>
                      </span>
                    );
                  })}
                  {JERSEY_THEMES.slice(0, config.teamCount)
                    .filter((k) => !takenKitIds.has(k.id))
                    .map((k) => (
                      <span
                        key={k.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/40 border border-dashed border-white/15 text-xs text-slate-400"
                      >
                        Waiting for {k.franchiseName}…
                      </span>
                    ))}
                </div>
              </div>
            </section>
          )}

          {/* Team Count & Jerseys */}
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

          {/* Purse & Squad Limits */}
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
            {activeTab === "CREATE" ? `Start Live Room (${roomCode}) →` : "Launch Broadcast Stage →"}
          </button>
        </form>
      )}

      <footer className="text-center text-[11px] text-slate-500 mt-5">
        Free-to-play entertainment only • Zero real-money entry fees, wallets, or gambling mechanics.
      </footer>
    </div>
  );
}
