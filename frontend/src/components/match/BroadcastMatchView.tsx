import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BotDifficulty,
  BowlingLength,
  BowlingLine,
  MatchState,
  ShotType,
  TimingGrade,
} from "../../engine/matchEngine";
import {
  chooseBotDelivery,
  formatOvers,
  getActiveInnings,
  getEligibleBowlers,
  getLineupById,
  resolveDelivery,
  setInningsBowler,
  simulateFullMatch,
  startSecondInnings,
} from "../../engine/matchEngine";
import type { PointsTableRow } from "../../engine/tournamentEngine";
import type { ThemeMode } from "../../types/auction";
import { soundEngine } from "../../utils/soundEngine";
import { CricketJerseySvg } from "../illustrations/CricketJerseySvg";
import { FullscreenLandscapeButton } from "../LandscapeGuard";
import { StadiumCanvas, type DeliveryAnimationState } from "./StadiumCanvas";

export type MatchControlMode = "VS_BOT" | "PASS_PLAY" | "WATCH_AI" | "ONLINE_FRIEND";

interface StingerBanner {
  id: number;
  kind: "FOUR" | "SIX" | "WICKET" | "FREE_HIT" | "NEW_BATTER";
  title: string;
  subtitle: string;
}

interface BroadcastMatchViewProps {
  initialMatch: MatchState;
  controlMode: MatchControlMode;
  botDifficulty?: BotDifficulty;
  myOnlineTeamId?: string | null;
  onlinePendingBowl?: {
    deliveryId: string;
    length: BowlingLength;
    line: BowlingLine;
    releaseAccuracy: number;
  } | null;
  onlineLeftNotice?: string | null;
  pointsTable?: PointsTableRow[];
  theme: ThemeMode;
  onToggleTheme: () => void;
  onMatchStateChange?: (match: MatchState) => void;
  onOnlineSubmitBowl?: (length: BowlingLength, line: BowlingLine, releaseAccuracy: number) => void;
  onOnlineSubmitBat?: (
    deliveryId: string,
    shotType: ShotType,
    timing: number,
    timingGrade: TimingGrade,
    lofted: boolean,
    stepOut: boolean,
  ) => void;
  onMatchComplete: (completed: MatchState) => void;
  onExit: () => void;
}

const SHOTS: ShotType[] = ["Defend", "Rotate", "Drive", "Loft", "Slog"];

function timingGradeLabel(g: TimingGrade): string {
  if (g === "PERFECT") return "PERFECT";
  if (g === "GOOD_EARLY") return "GOOD - EARLY";
  if (g === "GOOD_LATE") return "GOOD - LATE";
  if (g === "TOO_EARLY") return "TOO EARLY";
  if (g === "TOO_LATE") return "TOO LATE";
  return "MISSED";
}

export function BroadcastMatchView({
  initialMatch,
  controlMode,
  botDifficulty = "Medium",
  myOnlineTeamId,
  onlinePendingBowl,
  onlineLeftNotice,
  pointsTable,
  theme,
  onToggleTheme,
  onMatchStateChange,
  onOnlineSubmitBowl,
  onOnlineSubmitBat,
  onMatchComplete,
  onExit,
}: BroadcastMatchViewProps) {
  const [match, setMatch] = useState<MatchState>(initialMatch);
  const [watchAiMode, setWatchAiMode] = useState(controlMode === "WATCH_AI");
  const [aiSpeedMs, setAiSpeedMs] = useState<number>(1150);

  // Bowling & Batting HUD states
  const [selectedLength, setSelectedLength] = useState<BowlingLength>("Good");
  const [selectedLine, setSelectedLine] = useState<BowlingLine>("Off");
  const [selectedShot, setSelectedShot] = useState<ShotType>("Drive");
  const [loftToggle, setLoftToggle] = useState(false);
  const [stepOutToggle, setStepOutToggle] = useState(false);

  // Curved Release Meter & Radial Batting Arc progress (0..1 oscillating)
  const [meterPos, setMeterPos] = useState(0.5);
  const [phaseGate, setPhaseGate] = useState<"READY" | "BOWL_METER" | "BAT_TIMING" | "ANIMATING">("READY");
  const [lockedBowl, setLockedBowl] = useState<{
    length: BowlingLength;
    line: BowlingLine;
    releaseAccuracy: number;
  } | null>(null);
  const [timingCallout, setTimingCallout] = useState<TimingGrade | null>(null);
  const [stinger, setStinger] = useState<StingerBanner | null>(null);
  const [isMuted, setIsMuted] = useState(soundEngine.isMuted());
  const [drawer, setDrawer] = useState<"NONE" | "SCORECARD" | "COMMENTARY" | "POINTS">("NONE");
  const [animation, setAnimation] = useState<DeliveryAnimationState>({
    key: 1,
    outcome: null,
    phase: "IDLE",
    activeLength: "Good",
    activeLine: "Off",
  });

  const stingerSeq = useRef(1);
  const prevStrikerIdRef = useRef<number | null>(null);
  const lastRemoteBallCountRef = useRef<number>(0);

  // Sync external updates in Online Friend mode + play 3D ball animation & procedural Web Audio SFX
  useEffect(() => {
    if (controlMode !== "ONLINE_FRIEND") return;
    setMatch(initialMatch);
    const totalBalls =
      initialMatch.innings1.ballLog.length +
      (initialMatch.innings2?.ballLog.length ?? 0) +
      (initialMatch.superOver1?.ballLog.length ?? 0) +
      (initialMatch.superOver2?.ballLog.length ?? 0);
    if (totalBalls > lastRemoteBallCountRef.current) {
      lastRemoteBallCountRef.current = totalBalls;
      const curInn = getActiveInnings(initialMatch) || initialMatch.innings2 || initialMatch.innings1;
      const latest = curInn.ballLog[curInn.ballLog.length - 1];
      if (latest) {
        soundEngine.playDeliveryAudio(latest);
        setTimingCallout(latest.timingGrade);
        setPhaseGate("ANIMATING");
        setAnimation({
          key: Date.now(),
          outcome: latest,
          phase: "RESOLVING",
          activeLength: latest.length,
          activeLine: latest.line,
          speedPreviewKmh: latest.ballSpeedKmh,
        });
        setTimeout(() => {
          setPhaseGate("READY");
        }, 1050);
      }
    }
  }, [controlMode, initialMatch]);

  const active = getActiveInnings(match);
  const battingLineup = active ? getLineupById(match, active.battingTeamId) : match.teamA;
  const bowlingLineup = active ? getLineupById(match, active.bowlingTeamId) : match.teamB;

  const striker = active
    ? battingLineup.players.find((p) => p.id === active.strikerId) || battingLineup.players[0]
    : null;
  const nonStriker =
    active && active.nonStrikerId
      ? battingLineup.players.find((p) => p.id === active.nonStrikerId) || null
      : null;
  const currentBowler = active
    ? bowlingLineup.players.find((p) => p.id === active.currentBowlerId) || bowlingLineup.players[0]
    : null;

  const eligibleBowlers = useMemo(
    () => (active ? getEligibleBowlers(bowlingLineup, active) : []),
    [active, bowlingLineup],
  );

  const isStartOfOver = Boolean(active && active.legalBalls % 6 === 0 && !active.completed);

  // Determine which side human controls right now
  const userControlsBatting = (() => {
    if (!active || watchAiMode) return false;
    if (controlMode === "PASS_PLAY") return true;
    if (controlMode === "VS_BOT") return active.battingTeamId === match.teamA.teamId;
    if (controlMode === "ONLINE_FRIEND") return active.battingTeamId === myOnlineTeamId;
    return false;
  })();

  const userControlsBowling = (() => {
    if (!active || watchAiMode) return false;
    if (controlMode === "PASS_PLAY") return true;
    if (controlMode === "VS_BOT") return active.bowlingTeamId === match.teamA.teamId;
    if (controlMode === "ONLINE_FRIEND") return active.bowlingTeamId === myOnlineTeamId;
    return false;
  })();

  const showStinger = useCallback(
    (kind: StingerBanner["kind"], title: string, subtitle: string) => {
      const id = stingerSeq.current++;
      setStinger({ id, kind, title, subtitle });
      setTimeout(() => {
        setStinger((cur) => (cur?.id === id ? null : cur));
      }, 1250);
    },
    [],
  );

  // New Batter Lower-Third Stinger when striker changes after a wicket
  useEffect(() => {
    if (!active || !striker) return;
    if (prevStrikerIdRef.current !== null && prevStrikerIdRef.current !== striker.id) {
      const prevStat = active.batterStats[prevStrikerIdRef.current];
      if (prevStat?.isOut) {
        showStinger(
          "NEW_BATTER",
          `NEW BATTER: ${striker.name}`,
          `${striker.role} • BAT ${striker.batOvr} • PWR ${striker.power}`,
        );
      }
    }
    prevStrikerIdRef.current = striker.id;
  }, [active, striker, showStinger]);

  // Meter sweep animation at 60fps during BOWL_METER or BAT_TIMING
  useEffect(() => {
    if (phaseGate !== "BOWL_METER" && phaseGate !== "BAT_TIMING") return;
    let rafId = 0;
    const start = performance.now();
    const speed = phaseGate === "BAT_TIMING" ? 0.0029 : 0.0024;
    const tick = (now: number) => {
      const t = (now - start) * speed;
      // Smooth triangle wave 0 -> 1 -> 0
      const mod = t % 2;
      const val = mod <= 1 ? mod : 2 - mod;
      setMeterPos(val);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phaseGate]);

  const executeAndAnimateBall = useCallback(
    (
      length: BowlingLength,
      line: BowlingLine,
      releaseAccuracy: number,
      shotType: ShotType,
      timing: number,
      timingGrade: TimingGrade,
      lofted = false,
      stepOut = false,
    ) => {
      const { match: nextM, outcome } = resolveDelivery(match, {
        length,
        line,
        releaseAccuracy,
        shotType,
        timing,
        timingGrade,
        lofted,
        stepOut,
      });

      setTimingCallout(timingGrade);
      setPhaseGate("ANIMATING");
      setAnimation({
        key: Date.now(),
        outcome,
        phase: "RESOLVING",
        activeLength: length,
        activeLine: line,
        speedPreviewKmh: outcome.ballSpeedKmh,
      });

      soundEngine.playDeliveryAudio(outcome);

      if (outcome.isWicket) {
        showStinger(
          "WICKET",
          outcome.wicketKind === "BOWLED"
            ? "BOWLED HIM!"
            : outcome.wicketKind === "RUN_OUT"
            ? "RUN OUT!"
            : "WICKET!",
          `${outcome.batterName} ${outcome.wicketKind} b ${outcome.bowlerName}`,
        );
      } else if (outcome.runs === 6) {
        showStinger("SIX", `MAXIMUM SIX • ${outcome.shotDistanceM ?? 88}m`, outcome.batterName);
      } else if (outcome.runs === 4) {
        showStinger("FOUR", "CRACKING FOUR!", `${outcome.batterName} • ${outcome.shotType}`);
      } else if (outcome.isFreeHitNext) {
        showStinger("FREE_HIT", "NO BALL • FREE HIT!", "Next delivery is a Free Hit");
      }

      setTimeout(() => {
        setMatch(nextM);
        onMatchStateChange?.(nextM);
        setPhaseGate("READY");
        setLockedBowl(null);
      }, 1050);
    },
    [match, onMatchStateChange, showStinger],
  );

  // Trigger Bowling Release Meter Lock
  const handleBowlRelease = useCallback(() => {
    if (!active || phaseGate !== "BOWL_METER") return;
    // Green sweet spot is center [0.40..0.60]
    const dist = Math.abs(meterPos - 0.5);
    const releaseAccuracy = Math.max(0.2, Math.min(1, 1 - dist * 1.85));

    if (controlMode === "ONLINE_FRIEND" && !userControlsBatting) {
      onOnlineSubmitBowl?.(selectedLength, selectedLine, releaseAccuracy);
      setPhaseGate("ANIMATING");
      setAnimation({
        key: Date.now(),
        outcome: null,
        phase: "BOWLING",
        activeLength: selectedLength,
        activeLine: selectedLine,
      });
      return;
    }

    if (!userControlsBatting) {
      // Bot bats against user's delivery!
      const botBat = chooseBotDelivery(active, botDifficulty, match.rngState, false, true);
      executeAndAnimateBall(
        selectedLength,
        selectedLine,
        releaseAccuracy,
        botBat.input.shotType,
        botBat.input.timing,
        botBat.input.timingGrade ?? "GOOD_LATE",
        Boolean(botBat.input.lofted),
        false,
      );
    } else {
      // Pass & Play: Player 1 locked bowl -> hand off to Player 2 batter timing arc!
      setLockedBowl({ length: selectedLength, line: selectedLine, releaseAccuracy });
      setPhaseGate("BAT_TIMING");
      setAnimation({
        key: Date.now(),
        outcome: null,
        phase: "AWAITING_HIT",
        activeLength: selectedLength,
        activeLine: selectedLine,
      });
    }
  }, [
    active,
    phaseGate,
    meterPos,
    controlMode,
    userControlsBatting,
    selectedLength,
    selectedLine,
    onOnlineSubmitBowl,
    botDifficulty,
    match.rngState,
    executeAndAnimateBall,
  ]);

  // Trigger Batting Timing Lock
  const handleBatHit = useCallback(() => {
    if (!active || phaseGate !== "BAT_TIMING") return;
    const offset = meterPos - 0.5;
    const dist = Math.abs(offset);
    const timing = Math.max(0.12, Math.min(1, 1 - dist * 1.9));
    const grade: TimingGrade =
      dist <= 0.08
        ? "PERFECT"
        : dist <= 0.2
        ? offset < 0
          ? "GOOD_EARLY"
          : "GOOD_LATE"
        : dist <= 0.35
        ? offset < 0
          ? "TOO_EARLY"
          : "TOO_LATE"
        : "MISSED";

    if (controlMode === "ONLINE_FRIEND" && onlinePendingBowl) {
      onOnlineSubmitBat?.(
        onlinePendingBowl.deliveryId,
        selectedShot,
        timing,
        grade,
        loftToggle,
        stepOutToggle,
      );
      setTimingCallout(grade);
      setPhaseGate("ANIMATING");
      return;
    }

    const bowl =
      lockedBowl ||
      chooseBotDelivery(active, botDifficulty, match.rngState, true, false).input;

    executeAndAnimateBall(
      bowl.length,
      bowl.line,
      bowl.releaseAccuracy,
      selectedShot,
      timing,
      grade,
      loftToggle,
      stepOutToggle,
    );
  }, [
    active,
    phaseGate,
    meterPos,
    controlMode,
    onlinePendingBowl,
    onOnlineSubmitBat,
    selectedShot,
    loftToggle,
    stepOutToggle,
    lockedBowl,
    botDifficulty,
    match.rngState,
    executeAndAnimateBall,
  ]);

  // Start Ball Delivery / Batting Arc automatically or via button
  const handleStartBall = useCallback(() => {
    if (!active || phaseGate !== "READY") return;
    if (userControlsBowling) {
      setPhaseGate("BOWL_METER");
      setAnimation({
        key: Date.now(),
        outcome: null,
        phase: "BOWLING",
        activeLength: selectedLength,
        activeLine: selectedLine,
      });
    } else if (userControlsBatting) {
      const botBowl = chooseBotDelivery(active, botDifficulty, match.rngState, true, false).input;
      setLockedBowl({
        length: botBowl.length,
        line: botBowl.line,
        releaseAccuracy: botBowl.releaseAccuracy,
      });
      setPhaseGate("BAT_TIMING");
      setAnimation({
        key: Date.now(),
        outcome: null,
        phase: "AWAITING_HIT",
        activeLength: botBowl.length,
        activeLine: botBowl.line,
      });
    }
  }, [active, phaseGate, userControlsBowling, userControlsBatting, selectedLength, selectedLine, botDifficulty, match.rngState]);

  // Online Friend: when bowler sends pendingBowl, unlock Batter's timing arc!
  useEffect(() => {
    if (
      controlMode === "ONLINE_FRIEND" &&
      userControlsBatting &&
      onlinePendingBowl &&
      phaseGate === "READY"
    ) {
      setLockedBowl({
        length: onlinePendingBowl.length,
        line: onlinePendingBowl.line,
        releaseAccuracy: onlinePendingBowl.releaseAccuracy,
      });
      setPhaseGate("BAT_TIMING");
      setAnimation({
        key: Date.now(),
        outcome: null,
        phase: "AWAITING_HIT",
        activeLength: onlinePendingBowl.length,
        activeLine: onlinePendingBowl.line,
      });
    }
  }, [controlMode, userControlsBatting, onlinePendingBowl, phaseGate]);

  // Watch (AI vs AI) Auto-Playback Loop
  useEffect(() => {
    if (!watchAiMode || match.phase === "COMPLETE" || match.phase === "INNINGS_BREAK") return;
    if (!active || phaseGate !== "READY") return;
    const timer = setTimeout(() => {
      const { input } = chooseBotDelivery(active, botDifficulty, match.rngState, true, true);
      executeAndAnimateBall(
        input.length,
        input.line,
        input.releaseAccuracy,
        input.shotType,
        input.timing,
        input.timingGrade ?? "GOOD_LATE",
        Boolean(input.lofted),
        false,
      );
    }, aiSpeedMs);
    return () => clearTimeout(timer);
  }, [watchAiMode, match.phase, match.rngState, active, phaseGate, botDifficulty, aiSpeedMs, executeAndAnimateBall]);

  // Spacebar shortcut for Release / Hit
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        if (phaseGate === "BOWL_METER") handleBowlRelease();
        else if (phaseGate === "BAT_TIMING") handleBatHit();
        else if (phaseGate === "READY") handleStartBall();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phaseGate, handleBowlRelease, handleBatHit, handleStartBall]);

  const handleInstantSim = () => {
    const simmed = simulateFullMatch(match, botDifficulty);
    setMatch(simmed);
    onMatchStateChange?.(simmed);
  };

  // Compute RRR if chasing
  const chaseInfo = useMemo(() => {
    if (!active || active.targetRuns === null) return null;
    const needed = Math.max(0, active.targetRuns - active.runs);
    const ballsLeft = Math.max(1, active.maxOvers * 6 - active.legalBalls);
    const rrr = ((needed / ballsLeft) * 6).toFixed(2);
    return { needed, ballsLeft, rrr };
  }, [active]);

  const greenSweetStart = 0.36;
  const greenSweetEnd = 0.64;
  const inSweetSpot = meterPos >= greenSweetStart && meterPos <= greenSweetEnd;

  return (
    <div className="min-h-[100dvh] h-[100dvh] overflow-hidden flex flex-col bg-[#070B16] text-white">
      {/* Slim Top Utility Bar */}
      <header className="shrink-0 flex items-center justify-between gap-2 px-2.5 sm:px-4 py-1.5 bg-slate-950/95 border-b border-white/10">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={onExit}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/15 text-[11px] font-bold text-slate-200 cursor-pointer"
          >
            ✕ Exit
          </button>
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/35 text-[10px] font-black text-emerald-300">
            {match.config.pitch} Pitch
          </span>
          {active?.isFreeHit && (
            <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black animate-pulse">
              ★ FREE HIT
            </span>
          )}
          {!active?.isSuperOver && active && Math.floor(active.legalBalls / 6) < 2 && (
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-[10px] font-black text-sky-300">
              P1 POWERPLAY
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setDrawer((d) => (d === "SCORECARD" ? "NONE" : "SCORECARD"))}
            className="px-2 py-1 rounded-lg bg-slate-900 border border-white/15 text-[10px] sm:text-[11px] font-bold text-slate-200 cursor-pointer"
          >
            📊 Card
          </button>
          <button
            type="button"
            onClick={() => setDrawer((d) => (d === "COMMENTARY" ? "NONE" : "COMMENTARY"))}
            className="px-2 py-1 rounded-lg bg-slate-900 border border-white/15 text-[10px] sm:text-[11px] font-bold text-slate-200 cursor-pointer"
          >
            🎙 Comm
          </button>
          {pointsTable && pointsTable.length > 0 && (
            <button
              type="button"
              onClick={() => setDrawer((d) => (d === "POINTS" ? "NONE" : "POINTS"))}
              className="px-2 py-1 rounded-lg bg-slate-900 border border-white/15 text-[10px] sm:text-[11px] font-bold text-slate-200 cursor-pointer"
            >
              🏆 Table
            </button>
          )}
          {controlMode !== "ONLINE_FRIEND" && match.phase !== "COMPLETE" && (
            <>
              <button
                type="button"
                onClick={() => setWatchAiMode((w) => !w)}
                className={`px-2 py-1 rounded-lg border text-[10px] font-black cursor-pointer ${
                  watchAiMode
                    ? "bg-amber-400 text-slate-950 border-amber-300"
                    : "bg-slate-900 text-slate-300 border-white/15"
                }`}
              >
                {watchAiMode ? "⏸ Manual" : "👁 Watch AI"}
              </button>
              <button
                type="button"
                onClick={handleInstantSim}
                className="px-2 py-1 rounded-lg bg-slate-800 border border-white/15 text-[10px] font-bold text-amber-300 cursor-pointer"
              >
                ⏩ Sim
              </button>
            </>
          )}
          <FullscreenLandscapeButton />
          <button
            type="button"
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              soundEngine.setMuted(next);
            }}
            className="px-2 py-1 rounded-lg bg-slate-900 border border-white/15 text-[11px] font-bold cursor-pointer"
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="px-2 py-1 rounded-lg bg-slate-900 border border-white/15 text-[11px] font-bold cursor-pointer"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* Player Left Notice Banner */}
      {onlineLeftNotice && (
        <div className="shrink-0 bg-rose-600/90 text-white px-4 py-1.5 text-center text-xs font-black tracking-wide">
          ⚠️ {onlineLeftNotice}
        </div>
      )}

      {/* ZONE 1: Center 3D WebGL Stadium Canvas + Floating Release/Timing Rings + Kinetic TV Stingers */}
      <main className="relative flex-1 min-h-0 p-2 sm:p-3 flex flex-col gap-2">
        <div className="relative flex-1 min-h-0">
          <StadiumCanvas
            pitch={match.config.pitch}
            battingColor={battingLineup.kit.primary}
            bowlingColor={bowlingLineup.kit.primary}
            canPickTarget={Boolean(userControlsBowling && (phaseGate === "READY" || phaseGate === "BOWL_METER"))}
            isBowlingCamera={Boolean(userControlsBowling && phaseGate !== "BAT_TIMING")}
            selectedLength={selectedLength}
            selectedLine={selectedLine}
            onPickTarget={(len, ln) => {
              setSelectedLength(len);
              setSelectedLine(ln);
            }}
            animation={animation}
          />

          {/* Floating Curved Release Meter beside Bowler */}
          {phaseGate === "BOWL_METER" && (
            <button
              type="button"
              onClick={handleBowlRelease}
              className="absolute bottom-4 right-4 z-20 flex flex-col items-center gap-1 rounded-2xl bg-slate-950/85 border border-sky-400/50 px-3 py-2 shadow-2xl cursor-pointer preserve-dark"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-300">
                Release Arc (Tap / Space)
              </span>
              <svg viewBox="0 0 120 46" className="w-32 h-11">
                <path d="M 10 40 Q 60 2 110 40" fill="none" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
                <path d="M 44 17 Q 60 9 76 17" fill="none" stroke="#22c55e" strokeWidth="8" strokeLinecap="round" />
                {(() => {
                  const x = 10 + meterPos * 100;
                  const y = 40 - Math.sin(meterPos * Math.PI) * 21;
                  return <circle cx={x} cy={y} r="6.5" fill={inSweetSpot ? "#fde047" : "#ffffff"} stroke="#0f172a" strokeWidth="2" />;
                })()}
              </svg>
            </button>
          )}

          {/* Floating Radial Timing Ring near Batsman (Tap anywhere on ring/canvas or press Space!) */}
          {phaseGate === "BAT_TIMING" && (
            <button
              type="button"
              onClick={handleBatHit}
              className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 rounded-full bg-slate-950/85 border-2 border-amber-400/60 p-3 shadow-2xl cursor-pointer preserve-dark"
            >
              <svg viewBox="0 0 84 84" className="w-16 h-16">
                <circle cx="42" cy="42" r="34" fill="none" stroke="#334155" strokeWidth="7" />
                {/* Green Sweet Spot Arc */}
                <circle
                  cx="42"
                  cy="42"
                  r="34"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="7"
                  strokeDasharray="48 166"
                  strokeDashoffset="-82"
                  strokeLinecap="round"
                />
                {/* Moving Timing Dot */}
                {(() => {
                  const ang = -Math.PI + meterPos * Math.PI * 2;
                  const dx = 42 + Math.cos(ang) * 34;
                  const dy = 42 + Math.sin(ang) * 34;
                  return <circle cx={dx} cy={dy} r="6.5" fill={inSweetSpot ? "#fde047" : "#ffffff"} stroke="#0f172a" strokeWidth="2" />;
                })()}
                <text x="42" y="46" textAnchor="middle" fill="#fde047" fontSize="13" fontWeight="900">
                  HIT!
                </text>
              </svg>
            </button>
          )}

          {/* Instant Timing Callout Badge */}
          {timingCallout && phaseGate === "ANIMATING" && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-1 rounded-full bg-slate-950/90 border border-amber-400/60 text-xs font-black tracking-widest text-amber-300 shadow-lg">
              TIMING: {timingGradeLabel(timingCallout)}
            </div>
          )}

          {/* Kinetic TV Stinger (1.2s Auto-Dismiss) */}
          {stinger && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none z-30 px-4">
              <div
                className={`px-6 py-2.5 rounded-2xl border-2 backdrop-blur-md shadow-2xl text-center preserve-dark transition-all ${
                  stinger.kind === "WICKET"
                    ? "bg-rose-950/95 border-rose-400 text-white"
                    : stinger.kind === "SIX"
                    ? "bg-amber-950/95 border-amber-300 text-amber-200"
                    : stinger.kind === "FOUR"
                    ? "bg-sky-950/95 border-sky-400 text-sky-200"
                    : "bg-slate-950/95 border-emerald-400 text-emerald-200"
                }`}
              >
                <div className="text-lg sm:text-2xl font-black tracking-widest uppercase">
                  {stinger.kind === "WICKET" && "🏏💥 "}
                  {stinger.title}
                </div>
                <div className="text-xs font-bold text-slate-200">{stinger.subtitle}</div>
              </div>
            </div>
          )}

          {/* INNINGS BREAK OVERLAY */}
          {match.phase === "INNINGS_BREAK" && (
            <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-amber-400/50 p-5 text-center space-y-3 shadow-2xl">
                <div className="text-xs font-black uppercase tracking-widest text-amber-300">
                  End of 1st Innings
                </div>
                <div className="text-2xl font-black text-white tnum">
                  {getLineupById(match, match.innings1.battingTeamId).name}:{" "}
                  <span className="text-amber-300">
                    {match.innings1.runs}/{match.innings1.wickets}
                  </span>{" "}
                  ({formatOvers(match.innings1.legalBalls)})
                </div>
                <div className="text-sm font-bold text-emerald-300">
                  Target to Win: {match.innings1.runs + 1} runs in 6.0 overs
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const started = startSecondInnings(match);
                    setMatch(started);
                    onMatchStateChange?.(started);
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer"
                >
                  Start 2nd Innings Chase →
                </button>
              </div>
            </div>
          )}

          {/* MATCH COMPLETE OVERLAY */}
          {match.phase === "COMPLETE" && (
            <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="max-w-md w-full rounded-3xl bg-slate-900 border-2 border-amber-400 p-6 text-center space-y-4 shadow-2xl">
                <div className="text-xs font-black uppercase tracking-[0.25em] text-amber-300">
                  🏆 MATCH RESULT
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">{match.resultText}</h2>
                <div className="grid grid-cols-2 gap-2 text-xs tnum">
                  <div className="rounded-xl bg-slate-950/80 border border-white/10 p-2.5">
                    <div className="font-bold text-slate-400">
                      {getLineupById(match, match.innings1.battingTeamId).code}
                    </div>
                    <div className="text-lg font-black text-white">
                      {match.innings1.runs}/{match.innings1.wickets}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {formatOvers(match.innings1.legalBalls)} ov
                    </div>
                  </div>
                  {match.innings2 && (
                    <div className="rounded-xl bg-slate-950/80 border border-white/10 p-2.5">
                      <div className="font-bold text-slate-400">
                        {getLineupById(match, match.innings2.battingTeamId).code}
                      </div>
                      <div className="text-lg font-black text-white">
                        {match.innings2.runs}/{match.innings2.wickets}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatOvers(match.innings2.legalBalls)} ov
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onMatchComplete(match)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer shadow-lg"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ZONE 3: Contextual Thumb Dock (Only Active Controls) */}
        {active && match.phase !== "COMPLETE" && match.phase !== "INNINGS_BREAK" && (
          <section className="shrink-0 rounded-2xl bg-slate-950/95 border border-white/15 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            {watchAiMode ? (
              <div className="w-full flex items-center justify-between gap-2 text-xs">
                <span className="font-black text-amber-300">👁 Watching AI vs AI Broadcast…</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAiSpeedMs(1200)}
                    className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                      aiSpeedMs === 1200 ? "bg-amber-400 text-slate-950" : "bg-slate-800"
                    }`}
                  >
                    1x
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiSpeedMs(520)}
                    className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                      aiSpeedMs === 520 ? "bg-amber-400 text-slate-950" : "bg-slate-800"
                    }`}
                  >
                    2x Fast
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Left Side: Bowler Picker (Start of over) or Shot Selector (When Batting) */}
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  {isStartOfOver && userControlsBowling && phaseGate === "READY" && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] font-black uppercase text-sky-300">Bowler:</span>
                      {eligibleBowlers.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setMatch((m) => setInningsBowler(m, b.id))}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                            currentBowler?.id === b.id
                              ? "bg-sky-400 text-slate-950 border-sky-300"
                              : "bg-slate-900 text-slate-200 border-white/10"
                          }`}
                        >
                          {b.name.split(" ").slice(-1)[0]} ({b.bowlOvr})
                        </button>
                      ))}
                    </div>
                  )}

                  {(userControlsBatting && (phaseGate === "BAT_TIMING" || (!userControlsBowling && phaseGate === "READY"))) && (
                    <div className="flex flex-wrap items-center gap-1">
                      {SHOTS.map((sh) => (
                        <button
                          key={sh}
                          type="button"
                          onClick={() => setSelectedShot(sh)}
                          className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black border cursor-pointer ${
                            selectedShot === sh
                              ? "bg-amber-400 text-slate-950 border-amber-300"
                              : "bg-slate-900 text-slate-200 border-white/10"
                          }`}
                        >
                          {sh}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setLoftToggle((v) => !v)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                          loftToggle
                            ? "bg-rose-500 text-white border-rose-300"
                            : "bg-slate-900 text-slate-300 border-white/10"
                        }`}
                      >
                        Loft
                      </button>
                      <button
                        type="button"
                        onClick={() => setStepOutToggle((v) => !v)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                          stepOutToggle
                            ? "bg-sky-500 text-slate-950 border-sky-300"
                            : "bg-slate-900 text-slate-300 border-white/10"
                        }`}
                      >
                        Step Out
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Side: Curved Release / Radial Timing Arc + Primary Action Button */}
                <div className="flex items-center gap-2.5 ml-auto">
                  {(phaseGate === "BOWL_METER" || phaseGate === "BAT_TIMING") && (
                    <div className="flex items-center gap-2">
                      {/* Curved Sweet-Spot Meter SVG */}
                      <svg viewBox="0 0 120 44" className="w-28 h-10 shrink-0">
                        <path
                          d="M 10 38 Q 60 2 110 38"
                          fill="none"
                          stroke="#334155"
                          strokeWidth="7"
                          strokeLinecap="round"
                        />
                        <path
                          d="M 44 16 Q 60 8 76 16"
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="7"
                          strokeLinecap="round"
                        />
                        {(() => {
                          const x = 10 + meterPos * 100;
                          const y = 38 - Math.sin(meterPos * Math.PI) * 20;
                          return (
                            <circle
                              cx={x}
                              cy={y}
                              r="6"
                              fill={inSweetSpot ? "#fde047" : "#f8fafc"}
                              stroke="#0f172a"
                              strokeWidth="2"
                            />
                          );
                        })()}
                      </svg>
                    </div>
                  )}

                  {phaseGate === "READY" && (userControlsBowling || userControlsBatting) ? (
                    <button
                      type="button"
                      onClick={handleStartBall}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
                    >
                      {userControlsBowling ? "⚾ Bowl Delivery" : "🏏 Face Delivery"}
                    </button>
                  ) : phaseGate === "BOWL_METER" ? (
                    <button
                      type="button"
                      onClick={handleBowlRelease}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
                    >
                      RELEASE (Space)
                    </button>
                  ) : phaseGate === "BAT_TIMING" ? (
                    <button
                      type="button"
                      onClick={handleBatHit}
                      className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-300 to-rose-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
                    >
                      HIT! (Space)
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400">
                      {controlMode === "ONLINE_FRIEND" && phaseGate === "READY"
                        ? "Waiting for opponent…"
                        : "Playing delivery…"}
                    </span>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {/* ZONE 2: Bottom Slim TV Scorebug */}
      {active && (
        <footer className="shrink-0 bg-slate-950/95 border-t-2 border-amber-400/70 px-2.5 sm:px-4 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs tnum">
            {/* Team Crest | Score/Wkts | Overs */}
            <div className="flex items-center gap-2">
              <CricketJerseySvg kit={battingLineup.kit} size={28} />
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-black text-amber-300">{battingLineup.code}</span>
                  <span className="text-base sm:text-lg font-black text-white">
                    {active.runs}/{active.wickets}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({formatOvers(active.legalBalls)}/{active.maxOvers})
                  </span>
                </div>
              </div>
            </div>

            {/* Crease Batters (R/B) */}
            <div className="flex items-center gap-3 text-[11px]">
              {striker && (
                <div className="font-bold">
                  <span className="text-amber-300">*</span>{" "}
                  <span className="text-white">{striker.name.split(" ").slice(-1)[0]}</span>{" "}
                  <span className="text-emerald-300">
                    {active.batterStats[striker.id]?.runs ?? 0}({active.batterStats[striker.id]?.balls ?? 0})
                  </span>
                </div>
              )}
              {nonStriker && (
                <div className="hidden sm:block text-slate-300">
                  {nonStriker.name.split(" ").slice(-1)[0]}{" "}
                  <span>
                    {active.batterStats[nonStriker.id]?.runs ?? 0}({active.batterStats[nonStriker.id]?.balls ?? 0})
                  </span>
                </div>
              )}
            </div>

            {/* 6-Ball Over Chips */}
            <div className="flex items-center gap-1">
              {Array.from({ length: 6 }).map((_, idx) => {
                const ball = active.currentOverBalls[idx];
                return (
                  <span
                    key={idx}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
                      !ball
                        ? "border-white/15 text-slate-600"
                        : ball.isWicket
                        ? "bg-rose-600 border-rose-400 text-white"
                        : ball.runs === 6
                        ? "bg-amber-400 border-amber-300 text-slate-950"
                        : ball.runs === 4
                        ? "bg-sky-400 border-sky-300 text-slate-950"
                        : ball.extraType !== "NONE"
                        ? "bg-purple-500/40 border-purple-400 text-purple-200"
                        : "bg-slate-800 border-white/15 text-slate-200"
                    }`}
                  >
                    {!ball
                      ? ""
                      : ball.isWicket
                      ? "W"
                      : ball.extraType === "WIDE"
                      ? "Wd"
                      : ball.extraType === "NO_BALL"
                      ? "Nb"
                      : ball.runs}
                  </span>
                );
              })}
            </div>

            {/* Bowler Figures / Target & RRR */}
            <div className="flex items-center gap-3 text-[11px]">
              {currentBowler && (
                <div className="text-slate-300">
                  <span className="font-bold text-white">{currentBowler.name.split(" ").slice(-1)[0]}</span>{" "}
                  <span className="text-sky-300 font-bold">
                    {active.bowlerStats[currentBowler.id]?.wickets ?? 0}-
                    {active.bowlerStats[currentBowler.id]?.runsConceded ?? 0}
                  </span>{" "}
                  ({formatOvers(active.bowlerStats[currentBowler.id]?.legalBalls ?? 0)})
                </div>
              )}
              {chaseInfo && (
                <div className="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/35 text-amber-300 font-black">
                  Need {chaseInfo.needed} off {chaseInfo.ballsLeft}b • RRR {chaseInfo.rrr}
                </div>
              )}
            </div>
          </div>
        </footer>
      )}

      {/* Slide-Up Drawers (Scorecard / Commentary / Points Table) */}
      {drawer !== "NONE" && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-end justify-center p-2 sm:p-4"
          onClick={() => setDrawer("NONE")}
        >
          <div
            className="w-full max-w-3xl max-h-[75dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-white/15 p-4 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex gap-2">
                {(["SCORECARD", "COMMENTARY", ...(pointsTable?.length ? ["POINTS"] : [])] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDrawer(tab as typeof drawer)}
                      className={`px-3 py-1 rounded-lg text-xs font-black cursor-pointer ${
                        drawer === tab ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {tab}
                    </button>
                  ),
                )}
              </div>
              <button
                type="button"
                onClick={() => setDrawer("NONE")}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-bold cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            {drawer === "SCORECARD" && (
              <div className="space-y-4 text-xs">
                {[match.innings1, match.innings2].filter(Boolean).map((inn) => {
                  if (!inn) return null;
                  const batTeam = getLineupById(match, inn.battingTeamId);
                  return (
                    <div key={inn.inningsNumber} className="space-y-2">
                      <div className="font-black text-amber-300">
                        Innings {inn.inningsNumber}: {batTeam.name} — {inn.runs}/{inn.wickets} (
                        {formatOvers(inn.legalBalls)})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="rounded-xl bg-slate-950/75 p-2.5 space-y-1 tnum">
                          <div className="text-[10px] font-bold uppercase text-slate-400">Batting</div>
                          {Object.values(inn.batterStats).map((b) => (
                            <div key={b.playerId} className="flex justify-between gap-2">
                              <span className="truncate">
                                {b.name} {b.isOut ? "(out)" : ""}
                              </span>
                              <span className="font-bold text-white shrink-0">
                                {b.runs} ({b.balls}) • {b.fours}x4 {b.sixes}x6
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-xl bg-slate-950/75 p-2.5 space-y-1 tnum">
                          <div className="text-[10px] font-bold uppercase text-slate-400">Bowling</div>
                          {Object.values(inn.bowlerStats).map((bw) => (
                            <div key={bw.playerId} className="flex justify-between gap-2">
                              <span className="truncate">{bw.name}</span>
                              <span className="font-bold text-sky-300 shrink-0">
                                {formatOvers(bw.legalBalls)}-{bw.runsConceded}-{bw.wickets}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {drawer === "COMMENTARY" && (
              <div className="space-y-1.5 text-xs">
                {(active?.ballLog || [])
                  .slice()
                  .reverse()
                  .map((b, i) => (
                    <div
                      key={`${b.overNumber}_${b.ballNumberInOver}_${i}`}
                      className="rounded-lg bg-slate-950/75 border border-white/10 px-3 py-2 flex items-start gap-2.5"
                    >
                      <span className="font-black text-amber-300 tnum shrink-0">
                        {b.overNumber - 1}.{b.ballNumberInOver}
                      </span>
                      <span className="text-slate-200">{b.commentary}</span>
                    </div>
                  ))}
              </div>
            )}

            {drawer === "POINTS" && pointsTable && (
              <div className="overflow-x-auto text-xs tnum">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-white/10">
                      <th className="py-1.5">Team</th>
                      <th>P</th>
                      <th>W</th>
                      <th>L</th>
                      <th>Pts</th>
                      <th>NRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointsTable.map((r) => (
                      <tr key={r.teamId} className="border-b border-white/5">
                        <td className="py-1.5 font-bold text-white">
                          {r.code} • {r.name}
                        </td>
                        <td>{r.played}</td>
                        <td>{r.won}</td>
                        <td>{r.lost}</td>
                        <td className="font-black text-amber-300">{r.points}</td>
                        <td>{r.nrr >= 0 ? `+${r.nrr.toFixed(3)}` : r.nrr.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
