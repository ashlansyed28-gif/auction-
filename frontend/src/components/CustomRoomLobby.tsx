import { useEffect, useRef, useState } from "react";
import type {
  AuthenticatedUser,
  ChallengeConfig,
  ConnectedMember,
  JerseyKitId,
  RoomChatMessage,
  RoomEventBanner,
} from "../types/auction";
import { DEFAULT_TEAM_NAMES, JERSEY_THEMES } from "../utils/auctionRules";
import { isTouchOrMobileViewport, requestLandscapeFullscreen } from "../utils/orientation";
import { normalizeRoomCode } from "../utils/realtimeSync";
import { voiceEngine } from "../utils/voiceEngine";
import { FullscreenLandscapeButton } from "./LandscapeGuard";
import { CricketJerseySvg } from "./illustrations/CricketJerseySvg";

interface CustomRoomLobbyProps {
  currentUser: AuthenticatedUser;
  myClientId: string;
  isHost: boolean;
  roomCode: string;
  transportMode: "supabase" | "local";
  config: ChallengeConfig;
  members: ConnectedMember[];
  chatMessages: RoomChatMessage[];
  eventBanner?: RoomEventBanner | null;
  joinStatus: string | null;
  onUpdateConfig: (next: ChallengeConfig) => void;
  onRegenerateCode: () => void;
  onSwitchTeam: (kitId: JerseyKitId | null) => void;
  onPromoteCaptain: (kitId: JerseyKitId, targetClientId: string) => void;
  onSendChat: (text: string) => void;
  onQuickJoinCode?: (code: string) => void;
  onStartMatch: (finalConfig: ChallengeConfig) => void;
  onLeaveRoom: () => void;
  onSignOut: () => void;
}

const PURSE_PRESETS = [60, 80, 100, 120];

export function CustomRoomLobby({
  currentUser,
  myClientId,
  isHost,
  roomCode,
  transportMode,
  config,
  members,
  chatMessages,
  eventBanner,
  joinStatus,
  onUpdateConfig,
  onRegenerateCode,
  onSwitchTeam,
  onPromoteCaptain,
  onSendChat,
  onQuickJoinCode,
  onStartMatch,
  onLeaveRoom,
  onSignOut,
}: CustomRoomLobbyProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showObserveDrawer, setShowObserveDrawer] = useState(false);
  const [quickJoinInput, setQuickJoinInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [copiedType, setCopiedType] = useState<"CODE" | "INVITE" | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const membersPerTeam = config.membersPerTeam ?? 4;
  const activeThemes = JERSEY_THEMES.slice(0, config.teamCount || 10);
  const safeTeamNames = Array.isArray(config.teamNames) ? config.teamNames : DEFAULT_TEAM_NAMES;
  const safeMembers = Array.isArray(members) ? members : [];
  const spectators = safeMembers.filter((m) => !m.kitId || m.teamRole === "SPECTATOR");
  const seatedCount = safeMembers.filter((m) => Boolean(m.kitId)).length;
  const totalSlots = activeThemes.length * membersPerTeam;
  const me = safeMembers.find((m) => m.clientId === myClientId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  const copyText = async (text: string, kind: "CODE" | "INVITE") => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
    setCopiedType(kind);
    setTimeout(() => setCopiedType(null), 1800);
  };

  const handleCopyInvite = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://auction-liard-iota.vercel.app";
    const inviteUrl = `${origin}/?room=${roomCode}`;
    const payload = `Join my Cricket Bid Wars Auction Room!\nRoom Code: ${roomCode}\nLink: ${inviteUrl}`;
    copyText(payload, "INVITE");
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = chatInput.trim();
    if (!cleaned) return;
    onSendChat(cleaned.slice(0, 140));
    setChatInput("");
  };

  const updateTeamName = (idx: number, val: string) => {
    const next = [...safeTeamNames];
    next[idx] = val;
    onUpdateConfig({ ...config, teamNames: next });
  };

  const teamsWithMembersCount = activeThemes.filter((k) =>
    safeMembers.some((m) => m.kitId === k.id),
  ).length;

  return (
    <div className="min-h-[100dvh] landscape-lock-vh flex flex-col bg-gradient-to-b from-slate-950 via-[#080d1d] to-slate-950 text-slate-100">
      {/* Top Broadcast Profile & Utility Bar */}
      <header className="shrink-0 border-b border-white/10 bg-slate-950/90 backdrop-blur-md px-2.5 sm:px-4 py-1.5 sm:py-2 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-400 to-rose-600 flex items-center justify-center font-black text-slate-950 text-xs sm:text-sm shadow">
            {currentUser.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-black text-white truncate">@{currentUser.username}</span>
              <span
                className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${
                  currentUser.provider === "guest"
                    ? "bg-amber-400/20 border-amber-400/40 text-amber-300"
                    : "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                }`}
              >
                {currentUser.provider === "guest" ? "⚡ Guest" : "Verified"}
              </span>
              {me?.teamRole === "CAPTAIN" && me.kitId && (
                <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-[9px] font-black text-amber-300 uppercase">
                  👑 {me.kitId.toUpperCase()} Captain
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 truncate hide-short-landscape">{currentUser.emailMasked}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {onQuickJoinCode && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const cleaned = normalizeRoomCode(quickJoinInput);
                if (cleaned.length === 6) {
                  onQuickJoinCode(cleaned);
                  setQuickJoinInput("");
                }
              }}
              className="flex items-center gap-1 bg-slate-900 border border-white/15 rounded-lg p-0.5"
            >
              <input
                type="text"
                maxLength={6}
                value={quickJoinInput}
                onChange={(e) => setQuickJoinInput(normalizeRoomCode(e.target.value))}
                placeholder="Join Code"
                className="w-20 bg-transparent px-1.5 py-0.5 text-[10px] sm:text-[11px] font-black tracking-widest uppercase text-amber-300 focus:outline-none tnum"
              />
              <button
                type="submit"
                disabled={quickJoinInput.length !== 6}
                className="px-2 py-0.5 rounded bg-sky-400 text-slate-950 text-[10px] font-black disabled:opacity-35 cursor-pointer"
              >
                Go
              </button>
            </form>
          )}
          <FullscreenLandscapeButton />
          <span className="px-2 py-0.5 sm:py-1 rounded-full bg-slate-900 border border-white/10 text-[10px] font-bold text-amber-300 tnum">
            Purse ₹{config.purseCr} Cr
          </span>
          <span
            className={`px-2 py-0.5 sm:py-1 rounded-full text-[10px] font-bold border ${
              transportMode === "supabase"
                ? "bg-emerald-500/15 border-emerald-400/35 text-emerald-300"
                : "bg-sky-500/15 border-sky-400/35 text-sky-300"
            }`}
          >
            {transportMode === "supabase" ? "● Live" : "● Local"}
          </span>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/15 text-[11px] font-bold text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            Leave
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="px-2 py-1 rounded-lg bg-slate-900 border border-white/10 text-[10px] font-bold text-slate-400 hover:text-white cursor-pointer"
          >
            {currentUser.provider === "guest" ? "Switch" : "Sign Out"}
          </button>
        </div>
      </header>

      {(joinStatus || eventBanner) && (
        <div className="shrink-0 max-w-7xl w-full mx-auto px-2.5 pt-1.5 space-y-1">
          {eventBanner && (
            <div
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-black truncate ${
                eventBanner.kind === "LEAVE"
                  ? "bg-rose-500/20 border-rose-400/50 text-rose-200"
                  : "bg-emerald-500/15 border-emerald-400/35 text-emerald-200"
              }`}
            >
              {eventBanner.text}
            </div>
          )}
          {joinStatus && (
            <div className="rounded-lg bg-sky-500/15 border border-sky-400/35 px-2.5 py-1 text-[11px] font-semibold text-sky-200 truncate">
              {joinStatus}
            </div>
          )}
        </div>
      )}

      {/* Main Custom Room Body (Side-by-side & viewport-fit on Mobile & Tablet Landscape) */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto p-1.5 sm:p-2.5 lg:p-4 grid grid-cols-1 sm:grid-cols-[215px_1fr] md:grid-cols-[245px_1fr] lg:grid-cols-[330px_1fr] gap-2 sm:gap-3 lg:gap-4 items-stretch overflow-y-auto sm:overflow-hidden">
        {/* LEFT COLUMN: Room ID + Arena Card + Live Room Chat */}
        <aside className="flex flex-col gap-2 min-w-0 min-h-0">
          {/* Room ID & Arena Card */}
          <section className="shrink-0 rounded-xl sm:rounded-2xl bg-slate-900/90 border border-white/15 overflow-hidden shadow-2xl">
            {/* Room ID Header */}
            <div className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-slate-950/90 border-b border-white/10 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] sm:text-xs font-black tracking-wider text-white tnum">
                  ID <span className="text-amber-300 tracking-[0.14em]">{roomCode}</span>
                </span>
                <button
                  type="button"
                  onClick={() => copyText(roomCode, "CODE")}
                  className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/15 text-[9px] sm:text-[10px] font-bold text-slate-200 hover:text-white cursor-pointer"
                >
                  {copiedType === "CODE" ? "✓" : "Copy"}
                </button>
              </div>

              <div className="flex items-center gap-1">
                {isHost && (
                  <>
                    <button
                      type="button"
                      onClick={onRegenerateCode}
                      title="Generate new Room ID"
                      className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
                    >
                      ↻
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSettings((s) => !s)}
                      className={`px-2 py-0.5 rounded border text-[10px] font-extrabold uppercase cursor-pointer ${
                        showSettings
                          ? "bg-amber-400 text-slate-950 border-amber-300"
                          : "bg-slate-800 border-white/15 text-amber-300 hover:bg-slate-700"
                      }`}
                    >
                      ⚙ Rules
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Arena Preview Thumbnail (Hidden on ultra-short landscape phones to keep Chat input visible) */}
            <div className="relative h-14 sm:h-16 lg:h-24 landscape-compact-arena-banner hide-short-landscape bg-gradient-to-br from-sky-900 via-indigo-950 to-slate-950 overflow-hidden border-b border-white/10">
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 25% 25%, rgba(250, 204, 21, 0.35), transparent 45%), radial-gradient(circle at 80% 30%, rgba(56, 189, 248, 0.35), transparent 50%)",
                }}
              />
              <svg viewBox="0 0 340 112" className="absolute inset-0 w-full h-full opacity-80">
                <ellipse cx="170" cy="84" rx="140" ry="34" fill="rgba(16,185,129,0.22)" stroke="#34d399" strokeWidth="1.2" />
                <ellipse cx="170" cy="84" rx="70" ry="16" fill="none" stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
                <rect x="155" y="75" width="30" height="18" rx="3" fill="rgba(245,158,11,0.3)" stroke="#fbbf24" />
              </svg>
              <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 backdrop-blur-sm py-0.5 text-center text-[10px] font-black tracking-[0.2em] text-white border-t border-white/10">
                T20 AUCTION ARENA
              </div>
            </div>

            {/* Room Specifications Grid */}
            <div className="p-2 sm:p-2.5 space-y-1 text-[10px] sm:text-[11px]">
              <div className="text-amber-300 font-black uppercase tracking-wider truncate hide-short-landscape">
                FRANCHISE SQUAD-BIDDING MODE
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-300 tnum">
                <div className="flex justify-between">
                  <span className="text-slate-400">SEATS</span>
                  <strong className="text-emerald-300">
                    {seatedCount}/{totalSlots}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">TEAM</span>
                  <strong className="text-amber-300">2–{membersPerTeam}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PURSE</span>
                  <strong className="text-white">₹{config.purseCr} Cr</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">LOTS</span>
                  <strong className="text-white">{config.poolMode === "FULL_165" ? "165" : "24"}</strong>
                </div>
              </div>
            </div>
          </section>

          {/* Host Inline Rules Drawer */}
          {isHost && showSettings && (
            <section className="shrink-0 max-h-[48dvh] overflow-y-auto rounded-2xl bg-slate-900/95 border border-amber-400/45 p-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black uppercase tracking-wider text-amber-300">Host Room Rules</span>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="text-slate-400 hover:text-white font-bold cursor-pointer"
                >
                  Done ✕
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Room Title</label>
                <input
                  type="text"
                  maxLength={32}
                  value={config.roomTitle ?? "CRICKET BID WARS • T20 ARENA"}
                  onChange={(e) => onUpdateConfig({ ...config, roomTitle: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg bg-slate-950 border border-white/15 px-2.5 py-1.5 text-xs font-black text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Members Per Team (2 to 4)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([2, 3, 4] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => onUpdateConfig({ ...config, membersPerTeam: cnt })}
                      className={`py-1.5 rounded-lg font-black border cursor-pointer ${
                        membersPerTeam === cnt
                          ? "bg-amber-400 text-slate-950 border-amber-300"
                          : "bg-slate-950 text-slate-300 border-white/10"
                      }`}
                    >
                      {cnt} Members
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Teams in Room</label>
                <div className="grid grid-cols-5 gap-1">
                  {([2, 3, 4, 6, 10] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => onUpdateConfig({ ...config, teamCount: cnt })}
                      className={`py-1.5 rounded-lg font-black border cursor-pointer ${
                        config.teamCount === cnt
                          ? "bg-amber-400 text-slate-950 border-amber-300"
                          : "bg-slate-950 text-slate-300 border-white/10"
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Purse (Cr)</label>
                  <div className="grid grid-cols-2 gap-1">
                    {PURSE_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onUpdateConfig({ ...config, purseCr: p })}
                        className={`py-1 rounded font-bold border cursor-pointer ${
                          config.purseCr === p
                            ? "bg-amber-400 text-slate-950 border-amber-300"
                            : "bg-slate-950 text-slate-300 border-white/10"
                        }`}
                      >
                        ₹{p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Player Pool</label>
                  <div className="grid grid-cols-2 gap-1">
                    {(
                      [
                        ["CURATED_24", "24"],
                        ["FULL_165", "165"],
                      ] as const
                    ).map(([modeKey, lbl]) => (
                      <button
                        key={modeKey}
                        type="button"
                        onClick={() => onUpdateConfig({ ...config, poolMode: modeKey })}
                        className={`py-1 rounded font-bold border cursor-pointer ${
                          config.poolMode === modeKey
                            ? "bg-amber-400 text-slate-950 border-amber-300"
                            : "bg-slate-950 text-slate-300 border-white/10"
                        }`}
                      >
                        {lbl} Lots
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Customize Team Names
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {activeThemes.map((kit, idx) => (
                    <div key={kit.id} className="flex items-center gap-1.5">
                      <span
                        className="w-10 text-center py-1 rounded text-[10px] font-black shrink-0"
                        style={{ backgroundColor: kit.secondary, color: kit.accent }}
                      >
                        {kit.code}
                      </span>
                      <input
                        type="text"
                        maxLength={26}
                        value={safeTeamNames[idx] ?? kit.franchiseName}
                        onChange={(e) => updateTeamName(idx, e.target.value)}
                        className="flex-1 rounded bg-slate-950 border border-white/10 px-2 py-1 text-[11px] font-semibold text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Bottom-Left Live Room Chat Box (Pinned input on mobile landscape) */}
          <section className="flex-1 min-h-[150px] sm:min-h-0 rounded-xl sm:rounded-2xl bg-slate-900/90 border border-white/15 flex flex-col overflow-hidden shadow-xl">
            <div className="shrink-0 px-2.5 sm:px-3.5 py-1.5 bg-slate-950/90 border-b border-white/10 flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-300">
                Room Chat
              </span>
              <span className="text-[9px] text-slate-400 hide-short-landscape">All squads</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3 space-y-1 text-[11px] sm:text-xs">
              {chatMessages.length === 0 ? (
                <div className="text-slate-500 text-[11px] italic">
                  Squad strategy &amp; room announcements appear here…
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const kit = msg.kitId ? JERSEY_THEMES.find((k) => k.id === msg.kitId) : null;
                  return (
                    <div key={msg.id} className="leading-snug break-words">
                      {msg.isSystem ? (
                        <span className="text-[11px] text-emerald-300 font-semibold">★ {msg.text}</span>
                      ) : (
                        <>
                          {kit && (
                            <span
                              className="inline-block mr-1.5 px-1.5 py-0.2 rounded text-[9px] font-black"
                              style={{ backgroundColor: kit.secondary, color: kit.accent }}
                            >
                              {kit.code}
                            </span>
                          )}
                          <span className="font-bold text-amber-300">@{msg.senderName}</span>
                          <span className="text-slate-400">: </span>
                          <span className="text-slate-100">{msg.text}</span>
                        </>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChat} className="p-2 border-t border-white/10 bg-slate-950/80 flex gap-1.5">
              <input
                type="text"
                maxLength={140}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Tap to reply in room..."
                className="flex-1 rounded-lg bg-slate-900 border border-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black uppercase cursor-pointer"
              >
                Send
              </button>
            </form>
          </section>
        </aside>

        {/* RIGHT COLUMN: Room Title + 2-Col Franchise Team Blocks (Pinned bottom action bar) */}
        <section className="flex flex-col min-w-0 min-h-0">
          <div className="rounded-xl sm:rounded-2xl bg-slate-900/90 border border-white/15 overflow-hidden shadow-2xl flex-1 min-h-0 flex flex-col">
            {/* Title Header Strip */}
            <div className="shrink-0 px-3 sm:px-4 py-1.5 sm:py-2.5 bg-gradient-to-r from-amber-500/20 via-slate-900 to-slate-950 border-b border-amber-400/35 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-5 rounded-full bg-amber-400 shrink-0" />
                <h2 className="text-xs sm:text-base lg:text-lg font-black tracking-wide text-amber-300 uppercase truncate">
                  {config.roomTitle || "CRICKET BID WARS • T20 ARENA"}
                </h2>
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-300 tnum whitespace-nowrap">
                Teams:{" "}
                <span className="text-white font-black">
                  {teamsWithMembersCount}/{activeThemes.length}
                </span>{" "}
                • <span className="text-amber-300 font-black">2–{membersPerTeam}</span>/team
              </div>
            </div>

            {/* 2-Column Grid of Franchise Blocks (Internal Scroll on Mobile Landscape) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3 lg:p-4 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 content-start">
              {activeThemes.map((kit, idx) => {
                const teamName = safeTeamNames[idx] || kit.franchiseName;
                const teamMembers = safeMembers.filter((m) => m.kitId === kit.id);
                const iAmOnThisTeam = me?.kitId === kit.id;
                const amICaptainOfThisTeam = iAmOnThisTeam && me?.teamRole === "CAPTAIN";
                const isFull = teamMembers.length >= membersPerTeam;

                return (
                  <div
                    key={kit.id}
                    className={`grid grid-cols-[74px_1fr] sm:grid-cols-[84px_1fr] lg:grid-cols-[102px_1fr] rounded-xl overflow-hidden border transition ${
                      iAmOnThisTeam
                        ? "border-amber-400 shadow-lg shadow-amber-400/15"
                        : "border-white/15 bg-slate-950/75"
                    }`}
                  >
                    {/* LEFT COLUMN OF BLOCK: Team Name & Code (Replaces Slot Number) */}
                    <div
                      className="p-1.5 sm:p-2 flex flex-col items-center justify-center text-center border-r border-white/15"
                      style={{
                        background: `linear-gradient(180deg, ${kit.secondary}, rgba(15,23,42,0.95))`,
                      }}
                    >
                      <CricketJerseySvg kit={kit} size={28} />
                      <div
                        className="mt-0.5 text-xs sm:text-sm font-black tracking-wider leading-none"
                        style={{ color: kit.accent }}
                      >
                        {kit.code}
                      </div>
                      <div className="mt-0.5 text-[9px] sm:text-[10px] font-bold text-slate-200 leading-tight line-clamp-2">
                        {teamName}
                      </div>
                      <div className="mt-0.5 text-[9px] font-extrabold text-slate-400 tnum">
                        {teamMembers.length}/{membersPerTeam}
                      </div>
                    </div>

                    {/* RIGHT STACK OF BLOCK: 2 to 4 Single-Line Member Rows */}
                    <div className="divide-y divide-white/10 bg-slate-950/60 flex flex-col justify-stretch min-w-0">
                      {Array.from({ length: membersPerTeam }).map((_, seatIdx) => {
                        const occupant = teamMembers[seatIdx];
                        if (occupant) {
                          const isMe = occupant.clientId === myClientId;
                          const canMakeCaptain =
                            (isHost || amICaptainOfThisTeam) && occupant.teamRole !== "CAPTAIN";

                          return (
                            <div
                              key={occupant.clientId}
                              className={`px-2 sm:px-2.5 py-1 flex items-center justify-between gap-1.5 min-h-[28px] sm:min-h-[34px] ${
                                isMe ? "bg-amber-400/12" : ""
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                                    occupant.teamRole === "CAPTAIN"
                                      ? "bg-amber-400 text-slate-950"
                                      : "bg-slate-800 text-sky-300 border border-white/10"
                                  }`}
                                >
                                  {occupant.teamRole === "CAPTAIN" ? "👑 C" : "MEM"}
                                </span>
                                <span className="text-[11px] sm:text-xs font-extrabold text-white truncate">
                                  @{occupant.friendName}
                                </span>
                                {isMe && (
                                  <span className="text-[9px] font-black text-emerald-300 uppercase shrink-0">
                                    (You)
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {canMakeCaptain && (
                                  <button
                                    type="button"
                                    onClick={() => onPromoteCaptain(kit.id, occupant.clientId)}
                                    title="Assign single Captain for this team"
                                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 border border-white/15 text-[9px] font-black text-amber-300 cursor-pointer whitespace-nowrap"
                                  >
                                    Make C
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={`empty-${kit.id}-${seatIdx}`}
                            type="button"
                            disabled={iAmOnThisTeam || isFull}
                            onClick={() => onSwitchTeam(kit.id)}
                            className={`px-2 sm:px-2.5 py-1 min-h-[28px] sm:min-h-[34px] text-left flex items-center justify-between gap-1.5 text-[10px] sm:text-[11px] transition min-w-0 ${
                              iAmOnThisTeam || isFull
                                ? "text-slate-600 cursor-default"
                                : "text-slate-300 hover:text-amber-300 hover:bg-white/5 cursor-pointer"
                            }`}
                          >
                            <span className="truncate whitespace-nowrap">
                              {iAmOnThisTeam ? `Open #${seatIdx + 1}` : `+ Join ${kit.code}`}
                            </span>
                            {seatIdx === 0 && !teamMembers.length && !iAmOnThisTeam && (
                              <span className="text-[9px] font-black text-amber-300/85 uppercase whitespace-nowrap shrink-0">
                                1st = 👑 C
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Controls Bar (Always Pinned & Visible on Mobile Landscape!) */}
            <div className="shrink-0 px-2.5 sm:px-4 py-1.5 sm:py-2.5 bg-slate-950/95 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setShowObserveDrawer((v) => !v)}
                  className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-slate-900 border border-white/20 text-[10px] sm:text-xs font-black text-slate-200 hover:bg-slate-800 cursor-pointer tnum whitespace-nowrap"
                >
                  👁 OBSERVE ({spectators.length})
                </button>

                {me?.kitId && (
                  <button
                    type="button"
                    onClick={() => onSwitchTeam(null)}
                    className="px-2.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-slate-900 border border-white/10 text-[10px] sm:text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    Observe
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-white text-slate-950 text-[10px] sm:text-xs font-black uppercase tracking-wider cursor-pointer shadow whitespace-nowrap"
                >
                  {copiedType === "INVITE" ? "✓ Copied Link!" : "Invite Friends"}
                </button>
              </div>

              <div>
                {isHost ? (
                  <button
                    type="button"
                    onClick={() => {
                      voiceEngine.unlock();
                      if (isTouchOrMobileViewport()) {
                        void requestLandscapeFullscreen();
                      }
                      onStartMatch(config);
                    }}
                    className="px-6 sm:px-10 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-widest shadow-xl shadow-amber-400/25 hover:brightness-105 cursor-pointer"
                  >
                    START
                  </button>
                ) : (
                  <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-slate-900 border border-amber-400/35 text-[10px] sm:text-xs font-extrabold text-amber-300 whitespace-nowrap">
                    Waiting for Host…
                  </div>
                )}
              </div>
            </div>

            {showObserveDrawer && (
              <div className="px-4 py-2.5 bg-slate-950 border-t border-white/10 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Spectators:
                </span>
                {spectators.length === 0 ? (
                  <span className="text-slate-500">No unassigned players in Observe.</span>
                ) : (
                  spectators.map((s) => (
                    <span
                      key={s.clientId}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-200 font-bold"
                    >
                      @{s.friendName}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
