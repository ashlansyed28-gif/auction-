import { createRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import type {
  BroadcastPlayer,
  ChallengeConfig,
  ConnectedMember,
  FriendTeam,
  RoomAuctionSnapshot,
  RoomChatMessage,
  RoomEventBanner,
  RoomMode,
  TeamBidVote,
  TeamVoteChoice,
} from "../types/auction";
import {
  checkTeamBidEligibility,
  computeFairValueCr,
  formatCompactPurse,
  formatIncrementTag,
  formatLakhsCrores,
  nextBidIncrementCr,
} from "../utils/auctionRules";
import { summarizeTeamVotes } from "../utils/teamRoomHelpers";
import { soundEngine } from "../utils/soundEngine";
import { voiceEngine } from "../utils/voiceEngine";
import { FullscreenLandscapeButton } from "./LandscapeGuard";
import { PlayerPortrait } from "./PlayerPortrait";
import { PlayerRecordsModal } from "./PlayerRecordsModal";
import { PlayerSoldCard } from "./PlayerSoldCard";
import { ArenaBackdropSvg } from "./illustrations/ArenaBackdropSvg";
import { AuctioneerPodiumSvg } from "./illustrations/AuctioneerPodiumSvg";
import { CricketJerseySvg } from "./illustrations/CricketJerseySvg";
import { FranchiseTableSvg } from "./illustrations/FranchiseTableSvg";

export interface IncomingRoomCommand {
  seq: number;
  type: "BID" | "PASS";
  teamId: string;
  clientId?: string;
}

interface AuctionStageProps {
  config: ChallengeConfig;
  initialTeams: FriendTeam[];
  players: BroadcastPlayer[];
  roomMode: RoomMode;
  roomCode: string | null;
  transportMode: "supabase" | "local";
  myClientId: string;
  myUsername?: string;
  connectedMembers: ConnectedMember[];
  myTeamId: string | null;
  teamVotes: Record<string, Record<string, TeamBidVote>>;
  chatMessages: RoomChatMessage[];
  eventBanner?: RoomEventBanner | null;
  syncedSnapshot: RoomAuctionSnapshot | null;
  incomingCommand: IncomingRoomCommand | null;
  onHostPublishState?: (
    patch: Omit<
      RoomAuctionSnapshot,
      "roomCode" | "hostClientId" | "version" | "screen" | "config" | "members" | "chatMessages" | "teamVotes" | "updatedAt"
    >,
  ) => void;
  onGuestBid?: (teamId: string) => void;
  onGuestPass?: (teamId: string) => void;
  onCastVote?: (teamId: string, choice: TeamVoteChoice, lotIdx: number, bidStepCount: number) => void;
  onSendChat?: (text: string) => void;
  onFinishChallenge: (finalTeams: FriendTeam[], unsoldCount: number) => void;
  onExitSetup: () => void;
}

type LotResolution = "BIDDING" | "FINAL_CALL" | "SOLD" | "UNSOLD";

function getCameraTarget(bidderIdx: number, totalTeams: number) {
  if (bidderIdx === 0) return { x: 30, y: 12, scale: 1.05, rotationY: 4 };
  if (bidderIdx === 1) return { x: -30, y: 12, scale: 1.05, rotationY: -4 };
  if (totalTeams === 3 && bidderIdx === 2) return { x: 0, y: -16, scale: 1.07, rotationY: 0 };
  const col = (bidderIdx - 2) % 4;
  const x = col === 0 ? 28 : col === 1 ? 10 : col === 2 ? -10 : -28;
  return { x, y: -16, scale: 1.05, rotationY: x > 0 ? 3 : -3 };
}

export function AuctionStage({
  config,
  initialTeams,
  players,
  roomMode,
  roomCode,
  transportMode,
  myClientId,
  myUsername,
  connectedMembers,
  myTeamId,
  teamVotes,
  chatMessages,
  eventBanner,
  syncedSnapshot,
  incomingCommand,
  onHostPublishState,
  onGuestBid,
  onGuestPass,
  onCastVote,
  onSendChat,
  onFinishChallenge,
  onExitSetup,
}: AuctionStageProps) {
  const [teams, setTeams] = useState<FriendTeam[]>(initialTeams);
  const [lotIdx, setLotIdx] = useState(0);
  const [currentBidCr, setCurrentBidCr] = useState<number | null>(null);
  const [highestBidderId, setHighestBidderId] = useState<string | null>(null);
  const [passedIds, setPassedIds] = useState<string[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [bidStepCount, setBidStepCount] = useState(0);
  const [lotBidderIds, setLotBidderIds] = useState<string[]>([]);
  const [resolution, setResolution] = useState<LotResolution>("BIDDING");
  const [unsoldCount, setUnsoldCount] = useState(0);
  const [isMuted, setIsMuted] = useState(soundEngine.isMuted());
  const [voiceEnabled, setVoiceEnabled] = useState(voiceEngine.isEnabled());
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [showSoldCard, setShowSoldCard] = useState(false);
  const [soldCardDismissed, setSoldCardDismissed] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const arenaRef = useRef<HTMLDivElement>(null);
  const cameraRigRef = useRef<HTMLDivElement>(null);
  const gavelRef = useRef<SVGGElement>(null);
  const bidBoxRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  const lastProcessedCmdSeq = useRef<number>(0);

  const isGuest = roomMode === "GUEST";

  // Effective state (Host/Local owns local state; Guest mirrors syncedSnapshot)
  const effectiveTeams =
    isGuest && syncedSnapshot && Array.isArray(syncedSnapshot.teams) ? syncedSnapshot.teams : teams;
  const effectiveLotIdx = isGuest && syncedSnapshot ? syncedSnapshot.lotIdx ?? 0 : lotIdx;
  const effectiveBidCr = isGuest && syncedSnapshot ? syncedSnapshot.currentBidCr ?? null : currentBidCr;
  const effectiveHighestBidderId = isGuest && syncedSnapshot ? syncedSnapshot.highestBidderId ?? null : highestBidderId;
  const effectivePassedIds =
    isGuest && syncedSnapshot && Array.isArray(syncedSnapshot.passedIds) ? syncedSnapshot.passedIds : passedIds;
  const effectiveTurnIndex = isGuest && syncedSnapshot ? syncedSnapshot.turnIndex ?? 0 : turnIndex;
  const effectiveBidStepCount = isGuest && syncedSnapshot ? syncedSnapshot.bidStepCount ?? 0 : bidStepCount;
  const effectiveResolution = isGuest && syncedSnapshot ? syncedSnapshot.resolution ?? "BIDDING" : resolution;
  const effectiveUnsoldCount = isGuest && syncedSnapshot ? syncedSnapshot.unsoldCount ?? 0 : unsoldCount;
  const effectiveVotes = isGuest && syncedSnapshot ? syncedSnapshot.teamVotes || {} : teamVotes;
  const effectiveChat = isGuest && syncedSnapshot ? syncedSnapshot.chatMessages || [] : chatMessages;

  const paddleRefs = useMemo(
    () => effectiveTeams.map(() => createRef<SVGGElement>()),
    [effectiveTeams.length],
  );

  const player = players[effectiveLotIdx] || null;
  const leadingTeam = effectiveTeams.find((t) => t.id === effectiveHighestBidderId) || null;
  const myTeam = myTeamId ? effectiveTeams.find((t) => t.id === myTeamId) || null : null;
  const myMember = connectedMembers.find((m) => m.clientId === myClientId) || null;
  const isMyCaptain = roomMode === "LOCAL" || myMember?.teamRole === "CAPTAIN";
  const myTeamMembers = myTeam
    ? connectedMembers.filter((m) => m.kitId === myTeam.kit.id)
    : [];
  const myTeamCaptain = myTeamMembers.find((m) => m.teamRole === "CAPTAIN") || null;

  // Show Sold Celebration Card shortly after hammer slam
  useEffect(() => {
    setSoldCardDismissed(false);
    setShowSoldCard(false);
  }, [effectiveLotIdx]);

  useEffect(() => {
    if (effectiveResolution === "SOLD" && !soldCardDismissed) {
      const timer = setTimeout(() => setShowSoldCard(true), 620);
      return () => clearTimeout(timer);
    }
    if (effectiveResolution !== "SOLD") {
      setShowSoldCard(false);
    }
  }, [effectiveResolution, soldCardDismissed]);

  // Publish state from Host whenever local state updates
  useEffect(() => {
    if (roomMode !== "HOST" || !onHostPublishState) return;
    onHostPublishState({
      teams,
      lotIdx,
      currentBidCr,
      highestBidderId,
      passedIds,
      turnIndex,
      bidStepCount,
      lotBidderIds,
      resolution,
      unsoldCount,
    });
  }, [
    roomMode,
    teams,
    lotIdx,
    currentBidCr,
    highestBidderId,
    passedIds,
    turnIndex,
    bidStepCount,
    lotBidderIds,
    resolution,
    unsoldCount,
    onHostPublishState,
  ]);

  const eligibleTeams = useMemo(() => {
    if (!player) return [];
    return effectiveTeams.filter(
      (t) =>
        !effectivePassedIds.includes(t.id) &&
        checkTeamBidEligibility(
          t,
          player,
          effectiveBidCr,
          effectiveHighestBidderId,
          config.minSquadSize,
          config.maxSquadSize,
          config.maxOverseas,
        ).canBid,
    );
  }, [effectiveTeams, player, effectivePassedIds, effectiveBidCr, effectiveHighestBidderId, config]);

  const activeTurnTeam =
    eligibleTeams.length > 0
      ? eligibleTeams[effectiveTurnIndex % eligibleTeams.length]
      : null;

  // Reset lot animations on new lot
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (cameraRigRef.current) {
        gsap.to(cameraRigRef.current, {
          x: 0,
          y: 0,
          scale: 1,
          rotationY: 0,
          duration: 0.6,
          ease: "power2.inOut",
        });
      }
      paddleRefs.forEach((ref) => {
        if (ref.current) {
          gsap.to(ref.current, { rotation: 0, y: 0, scale: 1, duration: 0.25, ease: "power2.out" });
        }
      });
      if (gavelRef.current) {
        gsap.to(gavelRef.current, { rotation: 0, duration: 0.3, ease: "power2.out" });
      }
      if (stampRef.current) {
        gsap.set(stampRef.current, { opacity: 0, scale: 1.8 });
      }
    }, arenaRef);
    return () => ctx.revert();
  }, [effectiveLotIdx, paddleRefs]);

  // Trigger camera glide & paddle lift whenever highestBidderId / bidStepCount changes
  useEffect(() => {
    if (!effectiveHighestBidderId || effectiveBidStepCount === 0) return;
    const bidderIdx = effectiveTeams.findIndex((t) => t.id === effectiveHighestBidderId);
    if (bidderIdx < 0) return;
    const camTarget = getCameraTarget(bidderIdx, effectiveTeams.length);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      if (cameraRigRef.current) {
        tl.to(
          cameraRigRef.current,
          {
            x: camTarget.x,
            y: camTarget.y,
            scale: camTarget.scale,
            rotationY: camTarget.rotationY,
            duration: 0.52,
            ease: "power3.out",
          },
          0,
        );
      }

      paddleRefs.forEach((ref, i) => {
        if (!ref.current) return;
        if (i === bidderIdx) {
          tl.fromTo(
            ref.current,
            { rotation: 14, y: 10, scale: 0.92 },
            { rotation: -26, y: -12, scale: 1.08, duration: 0.28, ease: "back.out(2.2)" },
            0,
          );
        } else {
          tl.to(ref.current, { rotation: 0, y: 0, scale: 1, duration: 0.24, ease: "power2.out" }, 0);
        }
      });

      if (bidBoxRef.current) {
        tl.fromTo(
          bidBoxRef.current,
          { scale: 1.09 },
          { scale: 1, duration: 0.3, ease: "back.out(2.4)" },
          0,
        );
      }
    }, arenaRef);

    return () => ctx.revert();
  }, [effectiveHighestBidderId, effectiveBidStepCount, effectiveTeams, paddleRefs]);

  // Stop speech cleanly when lot changes or stage unmounts
  useEffect(() => {
    return () => {
      voiceEngine.stop();
    };
  }, [effectiveLotIdx]);

  const prevGuestRes = useRef<LotResolution>("BIDDING");
  useEffect(() => {
    if (!isGuest) return;
    if (effectiveResolution !== prevGuestRes.current) {
      prevGuestRes.current = effectiveResolution;
      if (effectiveResolution === "SOLD" && leadingTeam && player) {
        soundEngine.playGavelSold();
        voiceEngine.announceSold(player, leadingTeam);
        playSoldAnimations(leadingTeam.kit.primary);
      } else if (effectiveResolution === "UNSOLD") {
        soundEngine.playUnsold();
        if (stampRef.current) {
          gsap.fromTo(stampRef.current, { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, rotation: -3, duration: 0.28 });
        }
      } else if (effectiveResolution === "FINAL_CALL") {
        soundEngine.playFinalCall(2);
      }
    }
  }, [isGuest, effectiveResolution, leadingTeam, player]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
    voiceEngine.setMuted(next);
  };

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    voiceEngine.setEnabled(next);
    if (next) voiceEngine.unlock();
  };

  const handleCopyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch {}
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1600);
  };

  const spawnConfetti = (accentColor: string) => {
    const container = confettiRef.current;
    if (!container) return;
    container.innerHTML = "";
    const colors = [accentColor, "#FACC15", "#FFFFFF", "#38BDF8"];
    for (let i = 0; i < 42; i++) {
      const piece = document.createElement("div");
      piece.className = "absolute w-2.5 h-2.5 rounded-sm";
      piece.style.backgroundColor = colors[i % colors.length];
      piece.style.left = "50%";
      piece.style.top = "44%";
      container.appendChild(piece);

      const angle = (Math.PI * 2 * i) / 42 + (Math.random() - 0.5) * 0.25;
      const dist = 110 + Math.random() * 240;
      gsap.to(piece, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist + 45,
        rotation: Math.random() * 480,
        opacity: 0,
        duration: 1.0 + Math.random() * 0.45,
        ease: "power2.out",
        onComplete: () => piece.remove(),
      });
    }
  };

  const playSoldAnimations = (accentColor: string) => {
    const tl = gsap.timeline();
    if (gavelRef.current) {
      tl.to(gavelRef.current, { rotation: -42, duration: 0.14, ease: "power2.out" })
        .to(gavelRef.current, { rotation: 34, duration: 0.12, ease: "power4.in" })
        .to(gavelRef.current, { rotation: 10, duration: 0.18, ease: "elastic.out(1, 0.5)" });
    }
    if (cameraRigRef.current) {
      tl.to(cameraRigRef.current, { x: 0, y: 0, scale: 1.03, rotationY: 0, duration: 0.28, ease: "power3.out" }, 0.12)
        .fromTo(cameraRigRef.current, { y: -4 }, { y: 0, duration: 0.22, ease: "bounce.out" }, 0.26);
    }
    if (stampRef.current) {
      tl.fromTo(
        stampRef.current,
        { opacity: 0, scale: 2.2, rotation: -12 },
        { opacity: 1, scale: 1, rotation: -4, duration: 0.34, ease: "back.out(1.7)" },
        0.2,
      );
    }
    spawnConfetti(accentColor);
  };

  const handleBidAsTeam = (team: FriendTeam, fromClick = true) => {
    if (isGuest) {
      if (fromClick) soundEngine.playBidClick(effectiveBidStepCount + 1);
      onGuestBid?.(team.id);
      return;
    }
    if (!player || resolution === "SOLD" || resolution === "UNSOLD") return;
    const elig = checkTeamBidEligibility(
      team,
      player,
      currentBidCr,
      highestBidderId,
      config.minSquadSize,
      config.maxSquadSize,
      config.maxOverseas,
    );
    if (!elig.canBid) return;

    const nextStep = bidStepCount + 1;
    const nextBidders = lotBidderIds.includes(team.id) ? lotBidderIds : [...lotBidderIds, team.id];
    setLotBidderIds(nextBidders);
    setCurrentBidCr(elig.nextBidCr);
    setHighestBidderId(team.id);
    setBidStepCount(nextStep);
    setResolution("BIDDING");

    if (fromClick) {
      soundEngine.playBidClick(nextStep);
    }
    voiceEngine.announceBid(team, elig.nextBidCr, nextStep);

    const remainingAfter = teams.filter(
      (t) =>
        t.id !== team.id &&
        !passedIds.includes(t.id) &&
        checkTeamBidEligibility(
          t,
          player,
          elig.nextBidCr,
          team.id,
          config.minSquadSize,
          config.maxSquadSize,
          config.maxOverseas,
        ).canBid,
    );
    if (remainingAfter.length === 0) {
      setResolution("FINAL_CALL");
      soundEngine.playFinalCall(2);
    }
    setTurnIndex((prev) => prev + 1);
  };

  const handlePassTurn = (team: FriendTeam) => {
    if (isGuest) {
      onGuestPass?.(team.id);
      return;
    }
    if (!player || resolution === "SOLD" || resolution === "UNSOLD") return;
    if (passedIds.includes(team.id)) return;
    const nextPassed = [...passedIds, team.id];
    setPassedIds(nextPassed);
    soundEngine.playPassTick();

    const stillEligible = teams.filter(
      (t) =>
        !nextPassed.includes(t.id) &&
        checkTeamBidEligibility(
          t,
          player,
          currentBidCr,
          highestBidderId,
          config.minSquadSize,
          config.maxSquadSize,
          config.maxOverseas,
        ).canBid,
    );

    if (stillEligible.length === 0) {
      if (highestBidderId && currentBidCr !== null) {
        setResolution("FINAL_CALL");
        soundEngine.playFinalCall(2);
      } else {
        triggerUnsold();
      }
    } else {
      setTurnIndex((prev) => prev + 1);
    }
  };

  // Process remote guest BID / PASS actions on Host (enforcing single Captain per team)
  useEffect(() => {
    if (roomMode !== "HOST" || !incomingCommand) return;
    if (incomingCommand.seq <= lastProcessedCmdSeq.current) return;
    lastProcessedCmdSeq.current = incomingCommand.seq;
    const targetTeam = teams.find((t) => t.id === incomingCommand.teamId);
    if (!targetTeam) return;
    if (incomingCommand.clientId) {
      const sender = connectedMembers.find((m) => m.clientId === incomingCommand.clientId);
      if (!sender || sender.kitId !== targetTeam.kit.id || sender.teamRole !== "CAPTAIN") {
        return;
      }
    }
    if (incomingCommand.type === "BID") {
      handleBidAsTeam(targetTeam, false);
    } else if (incomingCommand.type === "PASS") {
      handlePassTurn(targetTeam);
    }
  });

  const handleFinalCall = () => {
    if (isGuest || !highestBidderId || currentBidCr === null || resolution === "SOLD") return;
    setResolution("FINAL_CALL");
    soundEngine.playFinalCall(1);
    if (gavelRef.current) {
      gsap.to(gavelRef.current, { rotation: -24, duration: 0.25, ease: "power2.out" });
    }
  };

  const handleSold = () => {
    if (isGuest || !player || !highestBidderId || currentBidCr === null || resolution === "SOLD") return;
    setResolution("SOLD");
    soundEngine.playGavelSold();

    const winner = teams.find((t) => t.id === highestBidderId);
    const fairVal = computeFairValueCr(player, config.purseCr);
    const updatedTeams = teams.map((t) =>
      t.id === highestBidderId
        ? {
            ...t,
            purseRemainingCr: Math.max(0, Math.round((t.purseRemainingCr - currentBidCr) * 100) / 100),
            squad: [...t.squad, { player, paidCr: currentBidCr, fairValueCr: fairVal, lotNumber: lotIdx + 1 }],
          }
        : t,
    );
    setTeams(updatedTeams);

    if (winner) {
      playSoldAnimations(winner.kit.primary);
      voiceEngine.announceSold(player, winner);
    }
  };

  const triggerUnsold = () => {
    if (isGuest || resolution === "UNSOLD" || resolution === "SOLD") return;
    setResolution("UNSOLD");
    setUnsoldCount((c) => c + 1);
    soundEngine.playUnsold();
    if (stampRef.current) {
      gsap.fromTo(
        stampRef.current,
        { opacity: 0, scale: 1.6 },
        { opacity: 1, scale: 1, rotation: -3, duration: 0.28, ease: "power2.out" },
      );
    }
  };

  const advanceNextLot = () => {
    if (isGuest) return;
    const nextIdx = lotIdx + 1;
    const allFull = teams.every((t) => t.squad.length >= config.maxSquadSize);
    if (nextIdx >= players.length || allFull) {
      onFinishChallenge(teams, unsoldCount);
      return;
    }
    setLotIdx(nextIdx);
    setCurrentBidCr(null);
    setHighestBidderId(null);
    setPassedIds([]);
    setLotBidderIds([]);
    setTurnIndex(0);
    setBidStepCount(0);
    setResolution("BIDDING");
  };

  const currentIncrementCr = effectiveBidCr === null ? 0 : nextBidIncrementCr(effectiveBidCr);
  const displayedBidCr = effectiveBidCr ?? player?.basePriceCr ?? 0;
  const activeSpotlight = leadingTeam?.kit.spotlight || "rgba(250, 204, 21, 0.22)";

  const myEligibility =
    myTeam && player && !effectivePassedIds.includes(myTeam.id)
      ? checkTeamBidEligibility(
          myTeam,
          player,
          effectiveBidCr,
          effectiveHighestBidderId,
          config.minSquadSize,
          config.maxSquadSize,
          config.maxOverseas,
        )
      : null;

  const activeTurnEligibility =
    activeTurnTeam && player
      ? checkTeamBidEligibility(
          activeTurnTeam,
          player,
          effectiveBidCr,
          effectiveHighestBidderId,
          config.minSquadSize,
          config.maxSquadSize,
          config.maxOverseas,
        )
      : null;

  const podiumReadout =
    effectiveResolution === "SOLD" && leadingTeam
      ? `SOLD! ${formatLakhsCrores(displayedBidCr)} to ${leadingTeam.name}`
      : effectiveResolution === "UNSOLD"
      ? "UNSOLD — Moving to next lot"
      : effectiveResolution === "FINAL_CALL" && leadingTeam
      ? `GOING ONCE... GOING TWICE! ${formatLakhsCrores(displayedBidCr)} (${leadingTeam.kit.code})`
      : leadingTeam
      ? `${formatLakhsCrores(displayedBidCr)} — ${leadingTeam.name}`
      : `Opening Base Price: ${formatLakhsCrores(player?.basePriceCr ?? 0)}`;

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between bg-[#070B16] text-white">
      {/* Top Broadcast Header with Room Code & Connected Teams */}
      <header className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-6 py-1.5 sm:py-2.5 bg-gradient-to-r from-slate-950/95 via-rose-950/80 to-slate-950/95 border-b border-amber-400/25 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExitSetup}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/15 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
          >
            ← Lobby
          </button>
          <div>
            <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-400">
              Cricket Bid Wars • Live Stage
            </div>
            <div className="text-[11px] text-slate-300 tnum">
              LOT #{effectiveLotIdx + 1} of {players.length} • {player ? `${player.category} • ${player.role}` : "COMPLETE"}
            </div>
          </div>

          {roomMode !== "LOCAL" && roomCode && (
            <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-white/15">
              <button
                type="button"
                onClick={handleCopyRoomCode}
                title="Copy Room Code"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-amber-400/40 text-xs font-black text-amber-300 tnum cursor-pointer"
              >
                <span>ROOM: {roomCode}</span>
                <span className="text-[10px] text-slate-300">{copiedCode ? "✓" : "⧉"}</span>
              </button>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/35 text-[11px] font-bold text-emerald-300 tnum">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {connectedMembers.length} Connected ({transportMode === "supabase" ? "Live" : "Local"})
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {roomMode !== "LOCAL" && myUsername && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-white/15 text-[11px] font-bold">
              <span className="text-white">@{myUsername}</span>
              <span
                className={
                  myMember?.teamRole === "CAPTAIN"
                    ? "text-amber-300 font-black"
                    : myMember?.teamRole === "MEMBER"
                    ? "text-sky-300 font-bold"
                    : "text-slate-400"
                }
              >
                {myMember?.teamRole === "CAPTAIN"
                  ? "👑 Captain"
                  : myMember?.teamRole === "MEMBER"
                  ? "🗳️ Member"
                  : "👁️ Observe"}
              </span>
            </span>
          )}
          {roomMode !== "LOCAL" && (
            <button
              type="button"
              onClick={() => setShowChatDrawer((s) => !s)}
              className="px-2.5 py-1.5 rounded-full bg-slate-900/85 border border-white/15 text-xs font-bold text-slate-200 hover:text-white cursor-pointer"
            >
              💬 Chat ({effectiveChat.length})
            </button>
          )}
          {roomMode !== "LOCAL" && roomCode && (
            <button
              type="button"
              onClick={handleCopyRoomCode}
              className="sm:hidden px-2.5 py-1 rounded-lg bg-slate-900 border border-amber-400/40 text-[11px] font-black text-amber-300 tnum"
            >
              {copiedCode ? "Copied!" : roomCode}
            </button>
          )}
          <FullscreenLandscapeButton />
          <button
            type="button"
            onClick={toggleVoice}
            className={`px-3 py-1.5 rounded-full border text-xs font-bold cursor-pointer ${
              voiceEnabled && !isMuted
                ? "bg-amber-400/15 border-amber-400/50 text-amber-300"
                : "bg-slate-900/80 border-white/15 text-slate-400"
            }`}
          >
            {voiceEnabled && !isMuted ? "🎙️ Voice" : "🎙️ Off"}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="px-3 py-1.5 rounded-full bg-slate-900/80 border border-white/15 text-xs font-bold text-slate-200 cursor-pointer"
          >
            {isMuted ? "🔇 Muted" : "🔊 Audio"}
          </button>
          {!isGuest && (
            <button
              type="button"
              onClick={() => onFinishChallenge(effectiveTeams, effectiveUnsoldCount)}
              className="px-3 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-xs font-extrabold text-amber-300 hover:bg-amber-400/25 cursor-pointer"
            >
              Scorecard ▸
            </button>
          )}
          <div className="inline-flex items-center gap-1.5 bg-red-600 px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wider shadow-md shadow-red-600/40">
            <span className="w-2 h-2 rounded-full bg-white live-dot" />
            LIVE
          </div>
        </div>
      </header>

      {/* Player Left / Room Event Alert */}
      {(() => {
        const activeBanner = (isGuest ? syncedSnapshot?.lastEventBanner : eventBanner) || eventBanner;
        if (!activeBanner) return null;
        return (
          <div className="max-w-6xl w-full mx-auto px-2.5 sm:px-4 pt-2">
            <div
              className={`rounded-xl border px-3 py-1.5 text-xs font-black text-center ${
                activeBanner.kind === "LEAVE"
                  ? "bg-rose-500/20 border-rose-400/50 text-rose-200"
                  : "bg-emerald-500/15 border-emerald-400/35 text-emerald-200"
              }`}
            >
              {activeBanner.text}
            </div>
          </div>
        );
      })()}

      {/* Purse Strip for All Friend Teams (Single-row scroll on mobile landscape, grid on desktop) */}
      <div className="max-w-6xl w-full mx-auto px-2.5 sm:px-4 pt-2">
        <div
          className={`flex overflow-x-auto no-scrollbar gap-2 pb-1 lg:grid lg:overflow-visible lg:pb-0 ${
            effectiveTeams.length > 4 ? "lg:grid-cols-5" : "lg:grid-cols-4"
          }`}
        >
          {effectiveTeams.map((t) => {
            const isLeader = t.id === effectiveHighestBidderId;
            const isTurn = activeTurnTeam?.id === t.id && effectiveResolution === "BIDDING";
            const isPassed = effectivePassedIds.includes(t.id);
            const isMine = myTeamId === t.id;
            const isOnline = connectedMembers.some((m) => m.kitId === t.kit.id);
            return (
              <div
                key={t.id}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition min-w-[146px] sm:min-w-[160px] lg:min-w-0 shrink-0 ${
                  isLeader
                    ? "bg-amber-400/15 border-amber-400 shadow-lg shadow-amber-400/15"
                    : isTurn
                    ? "bg-slate-800/90 border-sky-400/70"
                    : isMine
                    ? "bg-slate-900/95 border-emerald-400/45"
                    : "bg-slate-900/80 border-white/10"
                } ${isPassed ? "opacity-55" : ""}`}
              >
                <CricketJerseySvg kit={t.kit} size={36} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {roomMode !== "LOCAL" && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isOnline ? "bg-emerald-400" : "bg-slate-600"
                        }`}
                      />
                    )}
                    <span className="text-xs font-extrabold truncate text-white">
                      {t.name}
                      {isMine ? " (You)" : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] tnum">
                    <span className="font-bold" style={{ color: t.kit.accent }}>
                      {formatCompactPurse(t.purseRemainingCr)}
                    </span>
                    <span className="text-slate-400">
                      {t.squad.length}/{config.maxSquadSize}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Arena Stage */}
      <main className="max-w-6xl w-full mx-auto px-2.5 sm:px-4 py-1.5 sm:py-2.5 flex-1 flex items-center">
        <section
          ref={arenaRef}
          className="relative w-full rounded-2xl border border-amber-400/25 overflow-hidden shadow-2xl arena-perspective px-3 py-3 sm:px-6 sm:py-5 landscape-compact-stage"
        >
          <ArenaBackdropSvg
            spotlightColor={activeSpotlight}
            playerName={player?.name.toUpperCase() || "AUCTION COMPLETE"}
            bidReadout={formatLakhsCrores(displayedBidCr)}
            statusLabel={
              effectiveResolution === "SOLD"
                ? `SOLD • ${leadingTeam?.kit.code || ""}`
                : effectiveResolution === "FINAL_CALL"
                ? "FINAL CALL"
                : leadingTeam
                ? `BID BY ${leadingTeam.kit.code}`
                : "BASE PRICE"
            }
          />

          <div ref={cameraRigRef} className="relative z-10 camera-rig-3d">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-end">
              {effectiveTeams[0] && (
                <div
                  className={`rounded-2xl p-2 transition ${
                    effectiveHighestBidderId === effectiveTeams[0].id
                      ? "ring-2 ring-amber-400 bg-slate-950/35"
                      : ""
                  }`}
                >
                  <FranchiseTableSvg
                    team={effectiveTeams[0]}
                    isLeading={effectiveHighestBidderId === effectiveTeams[0].id}
                    isActiveTurn={activeTurnTeam?.id === effectiveTeams[0].id}
                    hasPassed={effectivePassedIds.includes(effectiveTeams[0].id)}
                    paddleRef={paddleRefs[0]}
                  />
                </div>
              )}

              <div className="flex flex-col items-center text-center landscape-compact-podium">
                <AuctioneerPodiumSvg
                  gavelRef={gavelRef}
                  isFinalCall={effectiveResolution === "FINAL_CALL"}
                  isSold={effectiveResolution === "SOLD"}
                />
                <div className="mt-1 px-3.5 py-1.5 rounded-full bg-slate-950/85 border border-amber-400/40 text-xs font-extrabold text-amber-300 tnum shadow-lg">
                  {podiumReadout}
                </div>
              </div>

              {effectiveTeams[1] && (
                <div
                  className={`rounded-2xl p-2 transition ${
                    effectiveHighestBidderId === effectiveTeams[1].id
                      ? "ring-2 ring-amber-400 bg-slate-950/35"
                      : ""
                  }`}
                >
                  <FranchiseTableSvg
                    team={effectiveTeams[1]}
                    isLeading={effectiveHighestBidderId === effectiveTeams[1].id}
                    isActiveTurn={activeTurnTeam?.id === effectiveTeams[1].id}
                    hasPassed={effectivePassedIds.includes(effectiveTeams[1].id)}
                    paddleRef={paddleRefs[1]}
                  />
                </div>
              )}
            </div>

            {effectiveTeams.length > 2 && (
              <div
                className={`mt-4 grid gap-3 ${
                  effectiveTeams.length === 3
                    ? "grid-cols-1 max-w-sm mx-auto"
                    : effectiveTeams.length <= 4
                    ? "grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto"
                    : "grid-cols-2 sm:grid-cols-4"
                }`}
              >
                {effectiveTeams.slice(2).map((team, offset) => {
                  const realIdx = offset + 2;
                  return (
                    <div
                      key={team.id}
                      className={`rounded-2xl p-2 transition ${
                        effectiveHighestBidderId === team.id ? "ring-2 ring-amber-400 bg-slate-950/35" : ""
                      }`}
                    >
                      <FranchiseTableSvg
                        team={team}
                        isLeading={effectiveHighestBidderId === team.id}
                        isActiveTurn={activeTurnTeam?.id === team.id}
                        hasPassed={effectivePassedIds.includes(team.id)}
                        paddleRef={paddleRefs[realIdx]}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div ref={confettiRef} className="absolute inset-0 pointer-events-none z-20 overflow-hidden" />
          <div
            ref={stampRef}
            className="absolute inset-0 grid place-items-center pointer-events-none z-30 opacity-0"
          >
            <div
              className={`px-8 py-4 rounded-2xl border-4 backdrop-blur-md text-center shadow-2xl ${
                effectiveResolution === "UNSOLD"
                  ? "bg-slate-950/90 border-rose-500 text-rose-400"
                  : "bg-slate-950/90 border-amber-400 text-amber-300"
              }`}
            >
              <div className="text-3xl sm:text-4xl font-black tracking-[0.2em]">
                {effectiveResolution === "UNSOLD" ? "UNSOLD" : "SOLD!"}
              </div>
              {effectiveResolution === "SOLD" && leadingTeam && (
                <div className="mt-1 text-sm font-extrabold text-white tnum">
                  {formatLakhsCrores(displayedBidCr)} • {leadingTeam.name}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Broadcast HUD */}
      <footer className="max-w-6xl w-full mx-auto px-2.5 sm:px-4 pb-2.5 sm:pb-4">
        {player && (
          <div className="rounded-2xl bg-slate-950/90 border border-white/15 border-t-2 border-t-amber-400 p-3 sm:p-4 landscape-compact-hud backdrop-blur-xl shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-[auto_1.45fr_0.75fr_1.05fr_1.45fr] gap-2.5 sm:gap-3 lg:gap-4 items-center">
              {/* Player Portrait (/players/<slug>.jpg with object-cover object-top + fallback) */}
              <div className="flex items-center gap-3 md:block min-w-0">
                <PlayerPortrait player={player} className="w-14 h-16 sm:w-16 sm:h-20" />
                <div className="md:hidden flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-black text-white truncate">{player.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/35 text-[9px] font-black text-amber-300 shrink-0">
                      {player.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">{player.careerRecords}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecordsModal(true)}
                  className="md:hidden px-3 py-1.5 rounded-lg bg-slate-800 border border-amber-400/40 text-[11px] font-extrabold text-amber-300 shrink-0 cursor-pointer"
                >
                  Records &amp; Stats
                </button>
              </div>

              {/* Player Name, Core Tags, Highest/Best & Career Records */}
              <div className="min-w-0">
                <div className="hidden md:flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base lg:text-xl font-black text-white tracking-wide truncate">{player.name}</span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-400/15 border border-amber-400/40 text-[10px] font-extrabold text-amber-300 shrink-0">
                      {player.category}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRecordsModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-amber-400/45 text-[11px] font-extrabold text-amber-300 hover:bg-amber-400/15 shrink-0 cursor-pointer"
                  >
                    📊 Records
                  </button>
                </div>

                <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-300 mb-2 min-w-0">
                  <span className="line-clamp-1 min-w-0 flex-1">{player.careerRecords}</span>
                </div>

                <div className="grid grid-cols-5 gap-1.5 text-[11px]">
                  <div className="bg-white/5 rounded-lg px-2 py-1.5 min-w-0">
                    <span className="block text-[9px] text-slate-400 font-bold">BAT</span>
                    <strong className="text-white truncate block">{player.bat}</strong>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2 py-1.5 min-w-0">
                    <span className="block text-[9px] text-slate-400 font-bold">BOWL</span>
                    <strong className="text-white truncate block">{player.bowl}</strong>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2 py-1.5 min-w-0">
                    <span className="block text-[9px] text-slate-400 font-bold">TYPE</span>
                    <strong className="text-white truncate block">{player.type}</strong>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2 py-1.5 min-w-0">
                    <span className="block text-[9px] text-slate-400 font-bold">ROLE</span>
                    <strong className="text-amber-300 truncate block">{player.role}</strong>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2 py-1.5 min-w-0">
                    <span className="block text-[9px] text-slate-400 font-bold">
                      {player.highestScore && player.bestBowling
                        ? "HS / BEST"
                        : player.highestScore
                        ? "HIGHEST"
                        : "BEST"}
                    </span>
                    <strong className="text-sky-300 tnum truncate block">
                      {player.highestScore && player.bestBowling
                        ? `${player.highestScore} • ${player.bestBowling}`
                        : player.highestScore || player.bestBowling || "—"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Base Price */}
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-center">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Base Price</div>
                <div className="text-base font-black text-white tnum mt-0.5">
                  {formatLakhsCrores(player.basePriceCr)}
                </div>
              </div>

              {/* Current Bid & BID BY */}
              <div
                ref={bidBoxRef}
                className="rounded-xl bg-amber-400/12 border border-amber-400/45 px-3 py-2.5 text-center"
              >
                <div className="text-[10px] uppercase tracking-wider text-amber-200 font-bold">Current Bid</div>
                <div className="text-lg font-black text-amber-300 tnum mt-0.5">
                  {formatLakhsCrores(displayedBidCr)}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-bold">
                  {leadingTeam ? (
                    <>
                      <CricketJerseySvg kit={leadingTeam.kit} size={18} />
                      <span style={{ color: leadingTeam.kit.accent }}>BID BY: {leadingTeam.name}</span>
                    </>
                  ) : (
                    <span className="text-slate-300">Waiting for opening bid</span>
                  )}
                </div>
              </div>

              {/* Action Controls (Squad Vote + Captain Agreement vs Pass & Play) */}
              <div className="space-y-2">
                {effectiveResolution === "SOLD" || effectiveResolution === "UNSOLD" ? (
                  <div className="space-y-1.5">
                    {effectiveResolution === "SOLD" && leadingTeam && (
                      <button
                        type="button"
                        onClick={() => {
                          setSoldCardDismissed(false);
                          setShowSoldCard(true);
                        }}
                        className="w-full py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-black text-xs uppercase tracking-wider cursor-pointer"
                      >
                        🏆 View Player Sold Card
                      </button>
                    )}
                    {!isGuest ? (
                      <button
                        type="button"
                        onClick={advanceNextLot}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 text-slate-950 font-black text-sm uppercase tracking-wider cursor-pointer shadow-lg"
                      >
                        {effectiveLotIdx + 1 >= players.length ? "View Final Scorecard →" : "Next Player on Block →"}
                      </button>
                    ) : (
                      <div className="rounded-xl bg-slate-900 border border-white/15 px-3 py-3 text-center text-xs font-bold text-slate-300">
                        Waiting for Host to advance to next lot…
                      </div>
                    )}
                  </div>
                ) : roomMode !== "LOCAL" ? (
                  <div className="space-y-2">
                    {myTeam ? (
                      (() => {
                        const voteSummary = summarizeTeamVotes(
                          effectiveVotes,
                          myTeam.id,
                          effectiveLotIdx,
                          effectiveBidStepCount,
                        );
                        const myCurrentVote = voteSummary.voters.find((v) => v.clientId === myClientId)?.choice;
                        const canVote = Boolean(myEligibility?.canBid) && !effectivePassedIds.includes(myTeam.id);

                        return (
                          <div className="space-y-2">
                            {/* Live Squad Vote Huddle Bar */}
                            <div className="rounded-xl bg-slate-900/90 border border-white/10 px-2.5 py-1.5 text-[10px]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black uppercase tracking-wider" style={{ color: myTeam.kit.accent }}>
                                  {myTeam.kit.code} Squad Votes ({myTeamMembers.length})
                                </span>
                                <span className="font-bold text-slate-300 tnum">
                                  👍 {voteSummary.bidCount} BID · 👎 {voteSummary.passCount} PASS
                                </span>
                              </div>
                              {voteSummary.voters.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {voteSummary.voters.map((v) => (
                                    <span
                                      key={v.clientId}
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                        v.choice === "BID"
                                          ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
                                          : "bg-rose-500/15 border-rose-400/40 text-rose-300"
                                      }`}
                                    >
                                      {v.choice === "BID" ? "👍" : "👎"} @{v.username}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {isMyCaptain ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={!myEligibility?.canBid}
                                  onClick={() => handleBidAsTeam(myTeam)}
                                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm disabled:opacity-45 cursor-pointer shadow-lg shadow-amber-400/20 tnum"
                                >
                                  {myEligibility?.canBid
                                    ? `👑 AGREE & BID ${formatLakhsCrores(myEligibility.nextBidCr)}`
                                    : myEligibility?.reason || "PASSED / LOCKED"}
                                </button>
                                <button
                                  type="button"
                                  disabled={effectivePassedIds.includes(myTeam.id)}
                                  onClick={() => handlePassTurn(myTeam)}
                                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 border border-white/15 text-slate-200 font-extrabold text-xs hover:bg-slate-700 disabled:opacity-45 cursor-pointer"
                                >
                                  PASS
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={!canVote}
                                    onClick={() =>
                                      onCastVote?.(myTeam.id, "BID", effectiveLotIdx, effectiveBidStepCount)
                                    }
                                    className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs border transition cursor-pointer disabled:opacity-45 tnum ${
                                      myCurrentVote === "BID"
                                        ? "bg-emerald-500 text-slate-950 border-emerald-300 shadow-lg"
                                        : "bg-emerald-500/15 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/25"
                                    }`}
                                  >
                                    {myCurrentVote === "BID" ? "✓ VOTED BID" : "👍 VOTE BID"}{" "}
                                    {myEligibility?.canBid ? formatLakhsCrores(myEligibility.nextBidCr) : ""}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={effectivePassedIds.includes(myTeam.id)}
                                    onClick={() =>
                                      onCastVote?.(myTeam.id, "PASS", effectiveLotIdx, effectiveBidStepCount)
                                    }
                                    className={`px-3.5 py-2.5 rounded-xl font-extrabold text-xs border transition cursor-pointer disabled:opacity-45 ${
                                      myCurrentVote === "PASS"
                                        ? "bg-rose-500 text-white border-rose-300"
                                        : "bg-slate-800 text-slate-200 border-white/15 hover:bg-slate-700"
                                    }`}
                                  >
                                    👎 VOTE PASS
                                  </button>
                                </div>
                                <div className="text-[10px] text-center text-slate-400">
                                  Member vote sent • Single Captain{" "}
                                  <strong className="text-amber-300">
                                    @{myTeamCaptain?.friendName || "Captain"}
                                  </strong>{" "}
                                  must agree to lock bid
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="rounded-xl bg-slate-900 border border-white/15 px-3 py-2.5 text-center text-xs font-bold text-slate-300">
                        👁️ Observing Room as Spectator
                      </div>
                    )}

                    {/* Host Auctioneer Gavel Controls */}
                    {roomMode === "HOST" && (
                      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-white/10">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Auctioneer:
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={!effectiveHighestBidderId}
                            onClick={handleFinalCall}
                            className="px-2.5 py-1 rounded-lg bg-rose-600/80 text-white text-[11px] font-extrabold disabled:opacity-35 cursor-pointer"
                          >
                            CALL
                          </button>
                          <button
                            type="button"
                            disabled={!effectiveHighestBidderId}
                            onClick={handleSold}
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black disabled:opacity-35 cursor-pointer"
                          >
                            SOLD
                          </button>
                          <button
                            type="button"
                            onClick={advanceNextLot}
                            className="px-2.5 py-1 rounded-lg bg-slate-700 text-slate-100 text-[11px] font-bold cursor-pointer"
                          >
                            SKIP
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!activeTurnTeam || !activeTurnEligibility?.canBid}
                        onClick={() => activeTurnTeam && handleBidAsTeam(activeTurnTeam)}
                        className="flex-1 py-3 px-3 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm disabled:opacity-45 cursor-pointer shadow-lg shadow-amber-400/20 tnum"
                      >
                        {activeTurnTeam && activeTurnEligibility
                          ? `BID ${formatLakhsCrores(activeTurnEligibility.nextBidCr)} (${
                              effectiveBidCr === null ? "OPEN" : formatIncrementTag(currentIncrementCr)
                            }) • ${activeTurnTeam.kit.code}`
                          : "NO ELIGIBLE BIDDER"}
                      </button>

                      <button
                        type="button"
                        disabled={!activeTurnTeam}
                        onClick={() => activeTurnTeam && handlePassTurn(activeTurnTeam)}
                        className="px-4 py-3 rounded-xl bg-slate-800 border border-white/15 text-slate-200 font-extrabold text-xs hover:bg-slate-700 disabled:opacity-45 cursor-pointer"
                      >
                        PASS
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex gap-1.5 flex-wrap">
                        {effectiveTeams.map((t) => {
                          const canQuickBid =
                            !effectivePassedIds.includes(t.id) &&
                            checkTeamBidEligibility(
                              t,
                              player,
                              effectiveBidCr,
                              effectiveHighestBidderId,
                              config.minSquadSize,
                              config.maxSquadSize,
                              config.maxOverseas,
                            ).canBid;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              disabled={!canQuickBid}
                              onClick={() => handleBidAsTeam(t)}
                              title={`Bid as ${t.name}`}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-black border border-white/20 disabled:opacity-35 cursor-pointer"
                              style={{ backgroundColor: t.kit.secondary, color: t.kit.accent }}
                            >
                              {t.kit.code}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={!effectiveHighestBidderId}
                          onClick={handleFinalCall}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600/80 text-white text-[11px] font-extrabold disabled:opacity-35 cursor-pointer"
                        >
                          CALL
                        </button>
                        <button
                          type="button"
                          disabled={!effectiveHighestBidderId}
                          onClick={handleSold}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-black disabled:opacity-35 cursor-pointer"
                        >
                          SOLD
                        </button>
                        <button
                          type="button"
                          onClick={advanceNextLot}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-700 text-slate-100 text-[11px] font-bold cursor-pointer"
                        >
                          SKIP
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </footer>

      {/* Room Chat Drawer (Stage) */}
      {showChatDrawer && roomMode !== "LOCAL" && (
        <div className="fixed bottom-24 right-4 z-40 w-80 max-w-[92vw] rounded-2xl bg-slate-950/95 border border-amber-400/40 shadow-2xl overflow-hidden backdrop-blur-xl">
          <div className="px-3.5 py-2 bg-slate-900 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-300">Room Chat</span>
            <button
              type="button"
              onClick={() => setShowChatDrawer(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="h-52 overflow-y-auto p-3 space-y-1.5 text-xs">
            {effectiveChat.length === 0 ? (
              <div className="text-slate-500 text-[11px]">No messages yet…</div>
            ) : (
              effectiveChat.map((m) => (
                <div key={m.id} className="break-words">
                  {m.isSystem ? (
                    <span className="text-[11px] text-emerald-300 font-semibold">★ {m.text}</span>
                  ) : (
                    <>
                      <span className="font-bold text-amber-300">@{m.senderName}: </span>
                      <span className="text-slate-100">{m.text}</span>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const clean = chatDraft.trim();
              if (!clean) return;
              onSendChat?.(clean.slice(0, 140));
              setChatDraft("");
            }}
            className="p-2 border-t border-white/10 flex gap-1.5"
          >
            <input
              type="text"
              maxLength={140}
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Message room..."
              className="flex-1 rounded-lg bg-slate-900 border border-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {showSoldCard && effectiveResolution === "SOLD" && player && leadingTeam && (
        <PlayerSoldCard
          player={player}
          team={leadingTeam}
          soldPriceCr={displayedBidCr}
          lotNumber={effectiveLotIdx + 1}
          bidCount={effectiveBidStepCount}
          maxSquadSize={config.maxSquadSize}
          teamMembers={connectedMembers.filter((m) => m.kitId === leadingTeam.kit.id)}
          isGuest={isGuest}
          isLastLot={effectiveLotIdx + 1 >= players.length}
          onNextLot={advanceNextLot}
          onDismiss={() => {
            setSoldCardDismissed(true);
            setShowSoldCard(false);
          }}
        />
      )}

      {showRecordsModal && player && (
        <PlayerRecordsModal player={player} onClose={() => setShowRecordsModal(false)} />
      )}
    </div>
  );
}
